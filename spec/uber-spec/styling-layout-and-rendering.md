# Styling, Layout, And Rendering

## CSS And Style Rules

Textual styling applies one CSS-based style system across widgets.

- programmatic and stylesheet-driven updates interact through one style system
- selector matching across type, class, ID, and pseudo-classes, with combinators limited to same-node qualifiers, descendant (whitespace), and child (`>`); there is no general sibling combinator
- specificity-based resolution using a per-selector `(id, class, type)` triple, extended at rule-extraction time into a 6-tuple `(user_vs_default, important, id, class, type, tie_breaker)`
- variable substitution, including variables referencing other variables, with unresolved references raising a diagnostic error
- `DEFAULT_CSS` participating as default rule input, scoped to its widget type
- the accepted style-key surface is the framework's fixed inventory defined by `RulesMap`; `ANIMATABLE` names the subset eligible for transition animation

### `!important`

`!important` is promoted at rule-extraction time by setting the `important` bit in the 6-tuple. The effect is that `!important` beats non-important regardless of user-vs-default origin, while `!important` rules are still ordered against each other by origin and selector specificity.

### `initial`

`initial` is property reset.

- a non-default rule using `initial` falls back to the most specific default-rule value for that property when one exists
- otherwise it falls back to the built-in framework default for that property

This is why `initial` can reset one property back to a class default while resetting another property to the framework default.

## Style Application

Conflict resolution, `!important` promotion, `initial` fallback, and the final write to a node's base styles all occur in one place. No other site mutates a node's base styles as a result of CSS matching.

- candidate rules are reduced by intersecting the rule index with the node's selector names
- pseudo-class capability flags on the node are refreshed from the union of candidate rules' pseudo-classes
- a shared application cache is reused only when the node's applicable pseudo-classes are disjoint from the positional/sibling-dependent set (`first-of-type`, `last-of-type`, `first-child`, `last-child`, `odd`, `even`, `focus-within`, `empty`); those pseudo-classes force a full re-evaluation
- for each key, the value with the maximum 6-tuple specificity wins
- `initial` sentinels are re-resolved against the opposite origin as described above
- the resolved rules are written through a single arbiter that either writes directly or schedules a transition animation, then always notifies the node of a style update

Whether a given key animates is decided by data (the transition map plus the animatable set), not by branching the write path: every modified key is written or scheduled in the same pass.

Component-class styles are resolved by applying the stylesheet to a virtual node carrying each declared component class and snapshotting the result; when a component style changes versus the previous snapshot, the owning node is refreshed.

## Stylesheet Source Model And Cache Invalidation

Stylesheet sources are held in insertion order keyed by location. Parsed rule lists are cached; CSS that previously failed to parse is rejected on re-entry to avoid infinite reparse loops. Cache invalidation contracts:

- registering or mutating a source marks the stylesheet as requiring parse and clears the selector-to-rules index
- setting theme variables clears the invalid-CSS set, the parse cache, the parsed-style cache, and the cached variable tokens; it does not itself reparse — the next parse or rules access does
- parsing or reparsing resets the selector-to-rules index so it is lazily rebuilt on next access
- a reparse that fails retains the previous rules and records the offending CSS

Theme swaps flow through this contract: a new theme produces a CSS variable map, variable assignment clears caches, the next parse rebuilds rules, and the stylesheet re-applies to the DOM.

## Render-Line Cache

Each widget owns a per-line render cache keyed by line index with an accompanying dirty-line set. It is the sole owner of cached per-line rendered strips for a widget: all invalidation flows through its dirty-marking and clear operations. Invalidation is driven by the style-update notification at the end of stylesheet application, by widget resize, and by explicit refresh. The cache classifies each line as border, border+padding, or content, and composes tint, text opacity, and widget opacity through one cached pipeline.

## Layout

Textual layout behavior is a staged placement pipeline, applied per layer:

1. non-displayable children are excluded
2. children are grouped by layer; each layer is arranged independently
3. split widgets are resolved first, consuming slices from the container region and emitting fixed placements
4. dock widgets are resolved next, placed along their dock edge and shrinking the remaining dock region
5. the active layout strategy places remaining layout children within the post-dock region
6. container alignment and absolute offsets are applied; placements marked absolute have their origin reset after translation

This pipeline is stable even though different layouts and style values produce different placements: style values vary the outputs, not the stage order. Scroll-spacing from docks is preserved across layers so scrollable area reductions are not lost.

Built-in layout strategies are `vertical`, `horizontal`, `grid`, and `stream`. Vertical and horizontal stack children with margin collapse between siblings; `overlay: screen` children are positioned without advancing the main axis; absolutely positioned children are emitted without advancing and have their origin reset afterward. Grid resolves row/column tracks (defaulting missing columns to one `1fr` track), honors gutter, spans, min/max column width, stretch, regular, expand, shrink, and auto-minimum. Stream is an optimized fast path for long vertical lists: every child is effectively full-width auto-height, only `max-height` extrema apply, absolute positioning and overlay and layers are ignored, and placements are cached by container width.

## Rendering And Compositor

The compositor is the single source of truth for widget geometry, visibility ordering, and dirty regions; widgets never compute their own screen placements. It owns:

- a full widget-to-geometry map and a visible-only fast-path map
- per-line caches of painting order, used for point queries and cuts
- per-line cut points (widget edges) used to chop strips for partial updates
- an accumulated set of dirty regions

### Reflow Variants

There are two reflow entry points and they are not interchangeable:

- full reflow rebuilds the full map, diffs against the previous map to compute shown, hidden, and resized widgets, and intersects each changed widget's clip-and-region into the dirty set
- visible reflow is the scroll fast path: it marks the full map invalidated, builds only a visible-only map, diffs against the previous visible map, and returns newly exposed widgets

Lookups prefer the full map when it is not invalidated, fall back to the visible map, and finally trigger a full-map rebuild on demand.

### Arrangement Integration

For each widget the compositor reads visibility from styles, shrinks the container region by gutter, and for scrollable widgets derives the scrollport from the widget's scrollable-region helper (excluding chrome). Child placements are produced by the widget's arrange call and then translated by the scroll offset, so scroll is a compositor translation rather than a per-widget concern. Overlay placements are forced above their layer and their clip is expanded to the whole screen so they escape the parent scrollport. Anchored content snaps the scroll position and target to the bottom of the content during reflow itself.

### Scrollbar Chrome

Scrollbar chrome widgets are injected into the compositor map by the compositor itself when a scrollable widget has a visible vertical or horizontal scrollbar and its scrollbar-visibility style allows it. Each chrome widget is mapped with its own region alongside the content placements.

### Render Update Forms

The compositor emits three update forms, and the choice is data-driven by the dirty set:

- a full-region strip update, used when the dirty set covers the whole screen or a simplified export is requested
- an inline (non-fullscreen) update, used for inline rendering; writes strips sequentially, clears below when shrinking, returns the cursor to the origin row, and queries cursor position so the driver tracks the new inline row
- a span-based partial update: per-line dirty spans are rewritten from cached per-column chops, emitting only the segments needed to cover each span

The span-based partial update walks visible widgets front-to-back and fills per-column buckets using a first-write-wins rule, so the topmost widget's segments survive.

### Dirty-Region Bookkeeping

- reflow and visible reflow add each changed widget's clip-and-region intersection to the dirty set
- repaint requests drain each widget's pending repaint regions, translate them into screen coordinates, intersect with the widget's clip, and add the result to the dirty set; if a requested widget is not currently visible, the full map is flagged invalidated so the next lookup rebuilds it
- every render cycle clears the dirty set before returning

Observable rendering behavior includes:

- partially visible widgets remain visible when still intersecting the viewport
- overlapping and adjacent redraw spans are merged by row
- dirty-line and style-cache behavior affects what gets rerendered and when

Final visible composition, dirty-region policy, and screen write serialization are centralized in the compositor and the app's display path, not distributed across widgets.

## Animation

Animation changes widget, app, and style state over time through one animation model.

- attribute animation through app, widget, and style animation APIs
- animation levels controlling whether particular animations run
- replacement of an existing animation on the same object attribute
- completion callbacks being delivered outside the immediate mutation path rather than as part of the caller's state-setting logic
- only keys in the animatable subset are eligible for CSS transitions; non-animatable or non-transitioned keys are written directly so the final value is always applied in the same pass

## Animation Completion

- stopping or replacing an animation preserves the same completion-notification contract as normal completion

## Renderables

Renderable helpers such as `Bar`, `Sparkline`, `Tint`, and `TextOpacity` are part of the framework's behavior surface.

For `Sparkline` specifically:

- the default summary function is `max`
- `width=None` means use available render width
- custom summary functions are supported
