# Docs Spec: MapGeometry — Absolute Widget Geometry

## Purpose
Describes the docs page that explains the `MapGeometry` data type — a snapshot of a widget's screen-absolute position, clipping, painting order, and virtual (scrollable) dimensions, as returned by screen lookup APIs.

## Audience
Test authors using the pilot to make spatial assertions, devtools consumers rendering overlays, and widget authors implementing advanced hit-testing or scroll-aware behavior.

## Required sections
1. Overview — when you get a `MapGeometry` and what it tells you.
2. Fields — `region`, `order`, `clip`, `virtualSize`, `containerSize`, `virtualRegion`, `dockGutter`.
3. `visibleRegion` — the visible portion after clipping.
4. How painting order is represented (tuple-of-triples per ancestor).
5. Relation to scrolling — virtual vs container size, virtual region vs region.
6. Typical use cases (hit-testing, spatial assertions, overlay rendering).

## Key concepts
- Absolute geometry: `region` is in screen coordinates, not parent-local.
- Clip: the region, possibly shrunk by an ancestor scroll container, that bounds the widget's visible pixels.
- Painting order: a sequence of triples, one per ancestor, where each triple encodes stacking information at that level. Comparing two widgets' `order` tuples lexicographically determines paint order.
- Virtual size: the scrollable extent of a container (only relevant for scrollable widgets).
- Container size: the size available to children, excluding scrollbar tracks.
- Virtual region: the widget's region in the parent's virtual (scrollable) coordinate space; may extend outside the visible area.
- Dock gutter: space reserved by docked children; excluded from the scrollable region.

## Behaviors and contracts
- `MapGeometry` is an immutable snapshot. It does not update when the DOM changes; re-query the screen to get fresh geometry.
- `visibleRegion` equals the intersection of `clip` and `region`; it is empty if the widget is fully scrolled off-screen.
- `order` supports total ordering across all widgets on a screen — lexicographic comparison of the tuple determines which widget paints on top.
- `virtualSize` is zero-sized for widgets that are not scroll containers.
- `virtualRegion` is relative to the container; `region` is relative to the screen.

## Example requirements
All examples are JSX/TypeScript using Ink primitives and textual-js widgets:
- Using the screen's `findWidget` (or equivalent) in a test to get a widget's `MapGeometry` and asserting on its `region`.
- Computing `visibleRegion` to check whether a widget is currently on-screen after scrolling.
- Comparing two widgets' `order` to determine which is painted on top.
- Using `virtualRegion` and `containerSize` to compute scroll offset needed to reveal a widget.

## Cross-references
- `spec/docs-spec/api_geometry.md` — `Region`, `Size`, `Spacing` primitives.
- `spec/docs-spec/api_layout.md` — how placements and arrangement produce geometry.
- `spec/docs-spec/api_screen.md` — `findWidget` and related screen APIs.
- `spec/docs-spec/api_scroll_view.md` — scrolling semantics.
- `spec/spec-src/05-layout-render-and-compositor.md` — compositor and paint order.

## Notes for writers
- Python Textual exposes `MapGeometry` as a `NamedTuple`. In textual-js, describe it as an immutable object type (an interface / readonly record), not a Python tuple.
- Do not mention `@property` or `__property__` syntax; describe `visibleRegion` as a derived accessor or computed field.
- Keep the explanation of `order` concrete — show a paint-order comparison in code rather than trying to explain the three-integer triple in the abstract.
- Clarify that `MapGeometry` is a read-only snapshot used for inspection; it is not an input to layout.
- Cross-link heavily to `api_geometry.md` rather than redefining `Region` and `Size`.
