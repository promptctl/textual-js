# Layouts

The layout system determines how widgets are sized and positioned within their containers. It comprises three built-in layout types (vertical, horizontal, grid), a layout factory for resolving layout names to implementations, a resolve algorithm for distributing space among edges, an arrange function for dock-aware placement, and a box model for computing final widget dimensions.

### Vertical Layout

The default layout. Children are stacked top-to-bottom. A widget with `styles.layout = "vertical"` arranges its displayed children in a vertical sequence. The vertical layout is also the layout returned by the factory for the name `"vertical"`.

### Horizontal Layout

Children are placed side-by-side, left-to-right. A `Horizontal` container sums the widths of its children to determine its content width. For example, children with widths 4, 6, and 5 produce a content width of 15.

### Grid Layout

A two-dimensional layout controlled by `grid-size` and `grid-columns` CSS properties. A grid with `grid-size: 3` and 7 children produces a `grid_size` of `(3, 3)` -- 3 columns and 3 rows (the last row partially filled). Grid columns can use `auto` sizing. The grid container's height can be set to `auto` to shrink to its content.

### Common Layout Features

All three layout types (grid, horizontal, vertical) share the following behaviors:

- **Display property filtering.** A child widget with `display = "none"` is excluded from `displayed_children`. A child with `display = "block"` is included. This applies uniformly regardless of the parent's layout type.
- **Empty widget dimensions.** An empty widget (no children, no content) reports a content width of 0 and a content height of 0 across all layout types. The content height measurement does not depend on the available width.

### Content Dimensions

Each layout implements `get_content_width` and `get_content_height` methods. These methods accept the widget, a container `Size`, a parent `Size`, and (for height) an available width. They return integer values representing the intrinsic content dimensions.

- For an empty widget, both methods return 0 across all layout types.
- For a horizontal layout, `get_content_width` returns the sum of children's widths.

### Layout Factory

The `get_layout` function in `textual.layouts.factory` resolves a layout name string to a layout instance.

- `get_layout("vertical")` returns a `VerticalLayout` instance.
- `get_layout("invalid")` raises `MissingLayout` for unrecognized layout names.

### Layout Resolve Algorithm

The `layout_resolve` function from `textual._layout_resolve` distributes a total available size across a list of edges. Each edge has three properties: an optional fixed `size`, a `fraction` (default 1), and a `min_size` (default 1).

- **Empty input.** Returns an empty list.
- **Fixed-size edges.** An edge with a fixed size always gets that size, even if it exceeds the total available space.
- **Fractional edges.** An edge with `size=None` receives a share of the remaining space proportional to its fraction relative to the sum of all fractional edges.
- **Minimum size.** If a fractional edge's computed share is less than its `min_size`, it receives `min_size` instead. The remaining fractional edges then split whatever space is left.
- **Rounding.** When fractional division does not produce integers, earlier edges round down and the last fractional edge receives the remainder, ensuring the total is exact. For example, splitting 100 among fractions 2:1 yields [66, 34].
- **Total of zero.** Fixed-size edges still receive their declared size even when the total is 0.
- **Mixed edges.** Fixed-size edges are subtracted from the total first; fractional edges then split the remainder.

### Arrangement

The `arrange` function from `textual._arrange` takes a container widget, a list of child widgets, a container size, and a viewport size. It returns an object with `placements` (a list of `WidgetPlacement` objects) and `widgets` (a set of all placed widgets).

- **Empty children.** Returns empty placements and an empty widget set.
- **Docking.** Docked widgets are placed first and reduce the available space for non-docked widgets:
  - `dock = "top"`: widget occupies the full width at the top; remaining children shift down.
  - `dock = "bottom"`: widget occupies the full width at the bottom; remaining children occupy the space above.
  - `dock = "left"`: widget occupies the full height on the left; remaining children shift right.
  - `dock = "right"`: widget occupies the full height on the right; remaining children occupy the space to the left.
- **Z-ordering.** Docked widgets receive `order=TOP_Z` and `fixed=True`. Non-docked widgets receive `order=0` and `fixed=False`.
- **Invalid dock values.** A dock value that is not one of the four valid directions raises `AssertionError`.
- Each `WidgetPlacement` contains: a `Region` (position and size), an offset (`NULL_OFFSET` by default), `Spacing` (margin), the widget reference, an order, and a fixed flag.

### Scalar Resolve

The `resolve` function from `textual._resolve` converts a list of `Scalar` values into `(offset, size)` tuples given a total available size, a gutter between items, a container `Size`, and a parent `Size`.

- **Empty input.** Returns an empty list.
- **Single fixed scalar.** Returns `[(0, size)]` -- one tuple with offset 0 and the declared size.
- **Multiple fixed scalars.** Each item's offset equals the accumulated size of all preceding items (gutter not applied when there is no gutter). For example, scalars `["10", "20"]` with gutter 0 produce `[(0, 10), (10, 20)]`.
- **Gutter.** A non-zero gutter value is added to the offset of each item after the first. For scalars `["10", "20"]` with gutter 1, the result is `[(0, 10), (11, 20)]`.
- **Fractional scalars.** `"1fr"` scalars receive a proportional share of remaining space after fixed sizes are subtracted. Two equal `"1fr"` scalars over 100 units each get 50: `[(0, 50), (50, 50)]`. One fixed scalar plus one `"1fr"` scalar over 100 with gutter 1 gives the `fr` item all remaining space: `[(0, 10), (11, 89)]`.
- **Mixed fixed and fractional.** Fixed-size items are laid out first and their sizes subtracted from the total; fractional items divide the remainder. Gutter values accumulate across all items.

### Fraction Unit Resolution

The `resolve_fraction_unit` function from `textual._resolve` computes the size in pixels of one `fr` unit given a collection of widget styles, a container size, a parent size, a total available space as a `Fraction`, and a `resolve_dimension` of `"width"` or `"height"`.

- **Proportional distribution.** With widgets having widths `"1fr"`, `"2fr"`, `"1fr"` over 80 units, one `fr` equals 20 (one quarter of 80).
- **min_width enforcement.** When a widget's `min_width` forces it to claim more than its fractional share, the remaining fractional widgets split the leftover space. For example, with total=50 and `min_width=20` on the first widget, the remaining 30 units are split among the other fractional widgets.
- **Cascading minimums.** Multiple `min_width` constraints are applied iteratively: if honoring one minimum causes another fractional widget's share to fall below its minimum, that widget is also fixed at its minimum.
- **Minimum exceeds total.** When the sum of minimums exceeds the available space, `resolve_fraction_unit` still returns a valid `Fraction` value without raising an error.
- **Zero-division safety.** `resolve_fraction_unit` must not raise `ZeroDivisionError` even when `max_width` constraints interact with small available space values.

### Box Model

The box model (`textual.box_model.BoxModel`) computes a widget's final width, height, and margin as `Fraction` values via `widget._get_box_model(container_size, parent_size, width_fraction, height_fraction)`.

- **Default sizing.** Without explicit width/height, a widget fills its container. A widget in a 60x20 container gets width=60, height=20.
- **Box sizing -- border-box (default).** `styles.box_sizing == "border-box"` means width and height include padding and border. A widget set to width=10, height=8 with padding=1 and a solid border produces a box model of (10, 8) -- padding and border are inside the declared dimensions.
- **Box sizing -- content-box.** `styles.box_sizing = "content-box"` means width and height refer to the content area only. The same widget (width=10, height=8, padding=1, solid border) produces (14, 12) -- padding and border are added on top of the declared dimensions.
- **Margins.** Margins are subtracted from available container space and reported in the box model's spacing. A margin of (1, 2, 3, 4) on a 60x20 container yields width=54 (60-2-4), height=16 (20-1-3).
- **Auto width.** `styles.width = "auto"` delegates to `get_content_width`, which returns the intrinsic content width.
- **Auto height.** `styles.height = "auto"` delegates to `get_content_height`, which returns the intrinsic content height.
- **Viewport units.** `width = "100vw"` resolves to the parent width (not the container width). `height = "100vh"` resolves to the parent height.
- **Percentage units.** `width = "100%"` fills the container width (minus margins). `height = "100%"` fills the container height (minus margins).
- **max_width / max_height.** Caps the computed dimension. `max_width = "50%"` on a container of width 54 caps at 27. `max_height = "50%"` on a container of height 20 (with margins reducing available to 16) caps at 8.
- **min_width / min_height.** Floors the computed dimension. A widget with width=10 and min_width=40 gets width=40.

## Constraints

- A widget with `display = "none"` must be excluded from its parent's `displayed_children` regardless of layout type.
- An empty widget must report content width and content height of 0 in all layout types.
- The layout factory must raise `MissingLayout` for unrecognized layout names.
- `layout_resolve` must distribute space exactly: the sum of resolved sizes must account for all available space allocated to fractional edges, with rounding adjustments applied to the last fractional edge.
- `layout_resolve` must respect `min_size` even when this causes the total to exceed the available space.
- Fixed-size edges in `layout_resolve` always receive their declared size, even when this exceeds the total available space.
- Docked widgets must reduce available space for non-docked siblings by the docked widget's dimension along its dock axis.
- Docked widgets must have `order=TOP_Z` and `fixed=True`; non-docked widgets must have `order=0` and `fixed=False`.
- An invalid dock direction must raise `AssertionError`.
- `border-box` sizing includes padding and border within declared dimensions; `content-box` adds them on top.
- `max_width` / `max_height` must cap, and `min_width` / `min_height` must floor, the computed box model dimensions.
- Viewport units (`vw`, `vh`) resolve against the parent size; percentage units resolve against the container size.
- The grid's `grid_size` property must return `(columns, rows)` reflecting the actual grid dimensions needed to hold all children.
- `resolve` must return `(offset, size)` tuples where each offset equals the sum of all preceding sizes plus accumulated gutters.
- `resolve_fraction_unit` must never raise `ZeroDivisionError` regardless of `max_width`/`max_height` constraints or available space values.
- `resolve_fraction_unit` must return a valid `Fraction` even when widget minimums collectively exceed the available space.
