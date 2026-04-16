# Docs Spec: Layout System and Widget Placement

## Purpose
Describes the docs page that explains the layout subsystem — how widgets are positioned inside containers, how placements are computed, and the data types that describe an arrangement.

## Audience
Widget authors who need to understand how layout decisions reach the compositor, and advanced users writing custom container widgets or probing layout results for testing.

## Required sections
1. Overview — what "layout" means in textual-js and where it runs in the pipeline.
2. How layout is implemented in textual-js (Ink/Yoga flexbox is the layout engine; TCSS rules translate to Yoga properties).
3. `WidgetPlacement` — the description of a single widget's position, margin, order, and flags.
4. `DockArrangeResult` / arrangement result — the collection of placements returned by arranging a container.
5. Visibility queries — how the system finds placements that intersect a region (spatial map).
6. Absolute vs relative placements — `absolute`, `offset`, `fixed`, `overlay` flags and what each controls.
7. Content sizing — how a container reports its intrinsic content width and height.
8. Keyline rendering — decorative borders around visible children.
9. Extension points — whether/how authors can plug in custom layout behavior (document what is and is not supported; if custom layouts are not exposed in textual-js, say so).

## Key concepts
- Placement: a widget, its region (position + size), offset, margin, stacking order, and flags (`fixed`, `overlay`, `absolute`).
- Arrangement result: the full set of placements for a container plus scroll spacing (space consumed by docked widgets) and a spatial map used for fast region queries.
- Spatial map: an index from region to placement, enabling visibility queries without scanning every child.
- `totalRegion`: the union of all placements grown by scroll spacing — the scrollable area of the container.
- Content width / height: the intrinsic size a container reports when styles ask for shrink-to-content.
- Keyline: optional decorative outline drawn around each visible child at a given line style and color.
- Dock gutter: space reserved by docked widgets, excluded from the scrollable region.

## Behaviors and contracts
- Placements use widget-local coordinates until `translate` shifts them into parent space.
- Placements with `absolute = true` are not translated by parent offsets; their origin is reset to the constrain region.
- `offset` is applied on top of `region` to produce the final drawing position; the underlying `region` is not mutated.
- Visibility: a placement is visible in a query region if it is `fixed` or if its offset-adjusted region intersects the query region. When the full arrangement fits inside the query region, every placement is visible (short-circuit).
- `bounds` of a list of placements is the tight bounding box grown by each placement's margin.
- Content width/height contracts: returns `0` when there are no child nodes; otherwise arranges children and measures the resulting total region.
- `constrainX` / `constrainY` TCSS rules are applied to absolute placements to keep them on-screen.
- Keyline color is blended with the container's background color before drawing.

## Example requirements
All examples are JSX/TypeScript using Ink primitives and textual-js widgets:
- Reading the placements of a container during a test (via the pilot or test harness) and asserting on regions.
- A container configured with docked children and showing how `scrollSpacing` reduces the scrollable area.
- Demonstrating `overlay` and `absolute` placement flags via TCSS, and how they appear in the arrangement result.
- Enabling a keyline on a container via TCSS and showing the resulting outline in a snapshot.
- Measuring intrinsic content size for a shrink-to-content container.

## Cross-references
- `spec/docs-spec/api_geometry.md` — `Region`, `Offset`, `Size`, `Spacing` primitives.
- `spec/docs-spec/api_map_geometry.md` — absolute screen geometry for a widget.
- `spec/docs-spec/api_widget.md` — widget sizing and styling hooks.
- `spec/docs-spec/api_containers.md` — built-in container widgets.
- `spec/spec-src/05-layout-render-and-compositor.md` — layout/compositor pipeline.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS rules that influence layout.

## Notes for writers
- Python Textual provides an abstract `Layout` base class with `horizontal`, `vertical`, `grid`, etc. subclasses. textual-js delegates actual layout to Ink/Yoga, so the doc should explain that users configure layout through TCSS rules (`layout`, `dock`, `grid-*`), not by subclassing a `Layout` class. Explicitly state that custom layout subclasses are not a public extension point in textual-js.
- Do not describe abstract methods like `arrange(parent, children, size, greedy)` as a user-facing API — those are internal adapters between TCSS/Yoga and the placement data.
- Do not mention `NamedTuple`, `dataclass`, Python `ClassVar`, or decorators.
- Clarify that `WidgetPlacement` and `DockArrangeResult` are primarily inspection types (useful in tests and devtools), not types users construct by hand.
- `scrollSpacing`, `virtualSize`, `clip` interact with scrolling — link to the relevant scroll and container docs rather than redefining them here.
- Avoid Python-specific sugar like `Iterable[WidgetPlacement]`; use TypeScript types consistently.
