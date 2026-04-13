# Layout, Rendering, and Compositor

## Layout Abstraction

`textual.layout.Layout` (in `layout.py`) is the abstract base for arrangement
strategies. Subclasses implement:

- `arrange(parent, children, size, greedy=True) -> list[WidgetPlacement]` —
  produce placements for layout (non-docked, non-split) children within a given
  container size. Strategies call `parent.pre_layout(self)` first.
- `get_content_width(widget, container, viewport) -> int` and
  `get_content_height(widget, container, viewport, width) -> int` — compute
  auto content extents by arranging at a probe size and taking the bounding
  region of the result (`arrangement.total_region`). `get_content_width` calls
  `widget.arrange(..., optimal=True)` so non-greedy sizing is used.
- `render_keyline(container) -> StripRenderable` — draws rectangles around
  visible children on a `Canvas` using the container's `keyline` style.

`WidgetPlacement` is a `NamedTuple` of `(region, offset, margin, widget, order,
fixed, overlay, absolute)`. Classmethods provide `translate` (bulk shift of
non-absolute placements), `apply_absolute` (reset origin for `absolute`
entries, mutating in place), and `get_bounds` (union of margin-grown regions).
`process_offset` applies per-widget absolute positioning and `constrain_x` /
`constrain_y` clamping against the container region.

`DockArrangeResult` (defined in `layout.py`) carries the placements, the set
of participating widgets, a `scroll_spacing` Spacing, and a lazily-built
`SpatialMap` for visibility queries. `total_region` grows the spatial map's
total region to account for right/bottom scroll spacing, and
`get_visible_placements(region)` uses the spatial map plus an overlap test
that respects `fixed` placements.

`LAYOUT_MAP` in `textual.layouts.factory` registers the built-in strategies
(`horizontal`, `vertical`, `grid`, `stream`); `get_layout(name)` instantiates
one or raises `MissingLayout`.

## Global Arrange Pipeline

`textual._arrange.arrange(widget, children, size, viewport, optimal=False)`
drives per-container arrangement. The phases (applied per layer) are:

1. Filter children by `display` and group the survivors by `styles.layer`
   (`_build_layers`). Each layer is arranged independently.
2. Within a layer, partition into split vs non-split widgets via
   `styles.is_split`. If any split widgets are present,
   `_arrange_split_widgets` shrinks the initial view region by consuming
   top/bottom/left/right slices (using each split widget's box model); the
   split placements go out with `fixed=True` and `order=1`. Otherwise the
   layer's dock region starts as the full `size.region`.
3. The spacing between the original size and the post-split dock region is
   recorded as `split_spacing`.
4. Partition the remaining widgets into dock vs layout widgets via
   `styles.is_docked`. `_arrange_dock_widgets` resolves each dock widget's
   box model, places it along its `styles.dock` edge (top/right/bottom/left),
   shrinks the dock region by the accumulated per-edge maxima, and emits
   placements with `order=TOP_Z` and `fixed=True`. `greedy` is derived from
   `not optimal`.
5. The remaining layout widgets are arranged by calling
   `widget.layout.arrange(widget, layout_widgets, dock_region.size,
   greedy=not optimal)`. The result is passed through
   `widget.process_layout(...)` before being consumed.
6. `scroll_spacing` is accumulated via `grow_maximum(dock_spacing)` across
   layers so that scrollable area reductions from docks are preserved.
7. If the container has non-default `align_horizontal`/`align_vertical`,
   the bounding region of the layout placements is aligned within the
   container using `styles._align_size`, taking the widget's auto-size
   extrema into account. A `placement_offset` (dock region offset plus
   alignment) is applied via `WidgetPlacement.translate`, which skips any
   widget whose `absolute_offset` is set.
8. `WidgetPlacement.apply_absolute` resets the origin of placements marked
   `absolute`.

`arrange` returns `DockArrangeResult(placements, set(display_widgets),
scroll_spacing)`. The spatial map is built on first access.

// [LAW:dataflow-not-control-flow] Arrangement is a fixed multi-stage
// transform; style values vary the outputs, not the stage order.

## Built-in Layout Strategies

### Vertical (`layouts/vertical.py`)

- Resolves per-child vertical box models via `_resolve.resolve_box_models`,
  passing the computed `resolve_margin` (max side margin and collapsed
  between-siblings margin) so `auto`/`fr` heights see the correct remaining
  space.
- Stacks children along `y`, using margin collapse (max of adjacent
  `margin.bottom` / `margin.top`) between siblings.
- Widgets with `overlay: screen` are positioned but do not advance `y` and
  are excluded from the resolved margin computation.
- `absolute`-positioned widgets (`position: absolute`) are emitted without
  advancing `y`; their final origin is reset by `apply_absolute`.
- Per-placement `offset` is resolved from `styles.offset` against the
  child's resolved content size and the app viewport.

### Horizontal (`layouts/horizontal.py`)

Mirror of vertical along the `x` axis: resolves widths, collapses horizontal
margins between siblings, supports `offset`, `overlay: screen`, and
`position: absolute`.

### Grid (`layouts/grid.py`)

- Row/column tracks come from `styles.grid_rows` / `styles.grid_columns`
  (scalars). Missing columns default to one `1fr` track; missing rows
  default to `1fr` when the parent has an explicit height, otherwise
  `auto`.
- Gutter comes from `grid_gutter_horizontal` / `grid_gutter_vertical`.
- Children carry `column_span` / `row_span` placement.
- Supports `min_column_width` / `max_column_width`, `stretch_height`,
  `regular` (no remainder last row), `expand`, `shrink`, and
  `auto_minimum`.
- Keyline rendering is coordinated with a shrink/offset adjustment.

### Stream (`layouts/stream.py`)

- Optimized fast path for long vertical lists (e.g. chat logs).
- Treats every child as effectively full-width (`1fr`) and auto-height.
- Supports only `max-height` in units; other extrema are ignored.
- Ignores absolute positioning, `overlay: screen`, layers, and non-TCSS
  styles.
- Caches placements keyed by container width so unchanged widths reuse
  prior results.

## Compositor Responsibilities

`textual._compositor.Compositor` owns the screen-wide arrangement and
incremental rendering state. Its state includes:

- `_full_map: CompositorMap` — widget → `MapGeometry` for every widget
  considered, plus an `_full_map_invalidated` flag.
- `_visible_map: CompositorMap | None` — the visible-only fast path map
  populated by `reflow_visible`.
- `widgets: set[Widget]` — display-visible participants (may be a superset
  of the map once `visible_map` is active).
- `_visible_widgets` — lazily computed `widget -> (region, clip)` in
  back-to-front order, used by `get_widget_at`, hit-testing, cuts, and
  rendering.
- `_layers` / `_layers_visible` — caches of widgets ordered by their
  painting order and, for `_layers_visible`, a per-screen-line list of
  `(widget, cropped_region, region)` used by point queries.
- `_cuts` — per-line sorted cut points (0, widget edges, width) used to
  slice strips into chops for incremental updates.
- `_dirty_regions: set[Region]` — accumulated regions requiring redraw.
- `root: Widget | None` and `size: Size` — the top-level screen widget and
  its current size.

## Arrange Pipeline (compositor)

`reflow(root, size)` rebuilds the full map:

1. Invalidate cached caches (`_cuts`, `_layers`, `_layers_visible`,
   `_visible_widgets`, `_visible_map`).
2. Keep a reference to the old `_full_map` and call `_arrange_root(root,
   size, visible_only=False)` to build the new map and participating
   widget set.
3. Compute `shown = new - old`, `hidden = old_widgets - new_widgets`,
   and `resized` (widgets present in both with a different region size).
4. Intersect each changed widget's `(clip ∩ region)` into `_dirty_regions`
   unless the whole screen is already dirty.
5. Return `ReflowResult(hidden, shown, resized)`.

`reflow_visible(root, size)` is the scroll fast path: it skips building
the full map (setting `_full_map_invalidated=True`), builds a
`_visible_map` via `_arrange_root(..., visible_only=True)`, diffs against
the previous visible map, updates `_dirty_regions`, and returns the set
of newly exposed widgets.

`_arrange_root` walks the widget tree recursively. For each widget it:

- Skips widgets that are not `_is_mounted`.
- Reads `styles.visibility` to decide whether it is visible.
- Computes `container_region = region.shrink(styles.gutter)`.
- For scrollable widgets, derives `child_region` from
  `widget._get_scrollable_region(container_region)` (shrunken for
  scrollbars), calls `widget.arrange(child_region.size)` to produce the
  `DockArrangeResult`, then processes each placement via
  `process_offset` (absolute offsets + constrain). If the widget is
  anchored (`_anchored` / `_anchor_released`), the y scroll and target
  are snapped to the bottom of the arranged content.
- When `visible_only=True`, only placements returned by
  `get_visible_placements(sub_clip - child_region.offset + scroll_offset)`
  are walked.
- Expands `total_region` to include `arrange_result.total_region` so the
  virtual size reflects scroll content.
- Uses `widget.layers` to map `layer` names to per-widget layer indices;
  a placement's painting order becomes `parent.order + ((layer_index,
  z, layer_order),)`. Overlay placements get an order of `((1, 0, 0),)`
  and their `clip` is expanded to the full screen (`no_clip`) so they
  escape the parent scrollport.
- Emits scrollbar chrome for visible scrollable widgets via
  `widget._arrange_scrollbars(container_region)` when
  `show_vertical_scrollbar` / `show_horizontal_scrollbar` is set and
  `styles.scrollbar_visibility == "visible"`. Each chrome widget is
  inserted into the map with its own region.
- Writes `MapGeometry(region, order, clip, virtual_size, container_size,
  virtual_region, dock_gutter)` into the map under `widget._render_widget`
  (so cover widgets / proxies are honored). A `_cover_widget` short
  circuits child traversal and paints the cover over the widget's content
  region.
- Non-scrollable visible widgets are recorded with their own region as
  both region and virtual size.

// [LAW:single-enforcer] The compositor is the single source of truth for
// widget geometry, visibility ordering, and dirty regions; widgets
// never compute their own screen placements.

## Lookups

- `find_widget(widget)` returns the cached `MapGeometry`, preferring the
  full map when not invalidated, then the visible map, and finally
  triggering a full map rebuild via the `full_map` property.
- `get_offset(widget)` returns the region offset from either map.
- `get_widget_at(x, y)` / `get_widgets_at(x, y)` iterate
  `layers_visible[y]`, testing cropped regions and `widget.visible`.
- `get_style_at(x, y)` renders a single-line crop of the widget under
  the coordinate and walks segments to find the covering style; if the
  widget is not in `visible_widgets`, returns `Style.null()`.
- `get_widget_and_offset_at(x, y)` renders a full line and reads
  per-segment `offset` metadata so callers can recover an offset within
  the content.
- `cuts` returns per-line sorted lists of x positions where widget edges
  fall; used to chop strips for partial updates.

## Render Update Forms

The compositor emits three `CompositorUpdate` subclasses:

- `LayoutUpdate(strips, region)` — a full-region strip update. Emits a
  `Control.move_to` per line and the strips for each line. Used by
  `render_full_update` when the dirty set covers the whole screen or
  when a simplified SVG export is requested.
- `InlineUpdate(strips, clear=False)` — inline (non-fullscreen) render
  used by `render_inline`. Writes strips sequentially, clears below when
  shrinking, moves the cursor back to the origin row, and issues a
  cursor-position query so the driver can track the new inline row.
- `ChopsUpdate(chops, spans, chop_ends)` — span-based partial update.
  Each dirty span `(y, x1, x2)` is rewritten from the cached
  per-column chops, moving the cursor to the first column whose range
  overlaps `[x1, x2]` and emitting only the segments needed to cover the
  span.

`render_update(full=False, screen_stack=None, simplify=False)` chooses
between full and partial updates based on whether the screen region is
already fully dirty; `render_full_update` clears `_dirty_regions` and
rebuilds all chops; `render_partial_update` snapshots and clears
`_dirty_regions`, computes the union crop plus per-line spans, and
rebuilds only those chops. `render_strips` returns joined strips for the
current size and is used for screenshots, inline, and `__rich__` export.

`_render_chops` walks `_get_renders` front-to-back (the iteration order
is the same as `visible_widgets`, which is back-to-front sorted by
painting order): it asks each widget for cropped `render_lines`, slices
each strip at the cached cut points, and fills per-column buckets using
a first-write-wins rule so the topmost widget's segments survive.

## Dirty-Region Bookkeeping

- `reflow` / `reflow_visible` add `(clip ∩ region)` for every changed
  widget to `_dirty_regions`.
- `update_widgets(widgets)` is called in response to widget repaint
  requests. For visible widgets it drains
  `widget._exchange_repaint_regions()`, translates each into screen
  coordinates, intersects with the widget's clip, and adds the result
  to `_dirty_regions`. If any requested widget is not in
  `visible_widgets`, `_full_map_invalidated` is flipped so the next
  lookup rebuilds the map.
- A render cycle (`render_full_update` / `render_partial_update`)
  always clears `_dirty_regions` before returning.

## Styles Cache and Strip Rendering

`_styles_cache.StylesCache` owns per-widget line caching. Its
responsibilities on the render path:

- `set_dirty(*regions)` marks the lines touched by each region dirty
  (empty call clears the cache). `is_dirty(y)` reports per-line dirtiness.
- `render_widget(widget, crop)` is the widget entry point: it resolves
  the widget's title/subtitle, background colors, padding, line
  filters, opacity, and ANSI theme, then delegates to `render`.
- `render` classifies each line in the widget's region as border,
  border+padding, or content (see the diagram in the module), calls
  `render_line` per line, and caches the non-dirty results. A
  `_simple_strip` (left border + blank + right border) is reused for
  content-free decorative lines.
- `render_line` post-processes each produced line: it applies
  `styles.tint` via `Tint.process_segments`, applies `styles.text_opacity`
  via `TextOpacity`, and applies widget `opacity` via `_apply_opacity`.
  Border and border-label colors are composited with `opacity`.

The compositor's `_get_renders` calls `widget.render_lines(region)`
which in turn drives the styles cache, so opacity, tint, filters, and
border/title rendering all live behind a single cached pipeline.

## Scroll and Visibility Integration

For every scrollable widget the compositor:

- Derives the scrollport from `widget._get_scrollable_region(container_region)`
  so the chrome area is excluded from child placement.
- Applies `placement_scroll_offset = container_region.offset -
  widget.scroll_offset` to child placements so scroll becomes a
  compositor translation rather than a per-widget concern.
- Unions the arrangement's `total_region` into the widget's virtual
  size so the recorded `MapGeometry.virtual_size` reflects the full
  scrollable extent.
- When anchored content changes size, the compositor snaps `scroll_y`
  and `scroll_target_y` (and the vertical scrollbar's reactive
  position) to the bottom of the content during the reflow itself.
- Overlay placements escape the scrollport's clip (by using the screen
  region as their clip), and their painting order is forced above the
  rest of the layer.

## Dirtying and Refresh

`Widget.refresh(...)` translates to internal flags (`_repaint_required`,
`_layout_required`, `_scroll_required`) and enqueues pending repaint
regions. `Screen` drains these on its message/idle cycle, translating
them into `Update`, `Layout`, and `UpdateScroll` work against the
compositor (`update_widgets`, `reflow`, `reflow_visible`). `App._display`
renders whichever `CompositorUpdate` the compositor returns and writes
the raw segments through the driver, using synchronized-output escapes
when the terminal supports them.

// [LAW:single-enforcer] Final visible composition, dirty-region policy,
// and screen write serialization are centralized in `Compositor` and
// `App._display`, not distributed across widgets.
