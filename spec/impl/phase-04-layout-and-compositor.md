# Phase 4: Style-Driven Layout, Compositor & Scrolling

## Preconditions

Phases 1–3 complete:
- Test harness exists
- Reactive pipeline with validators and computed properties
- CSS engine: parser, selector matching, `RenderStyles` per widget, stylesheet application
- Style-backed `display` and `visible`
- Query API working
- All prior tests pass

## Goal

Replace placeholder layout logic with the staged render pipeline and establish the compositor as the single owner of widget geometry and dirty regions.

## Architectural Rationale

// [LAW:single-enforcer] The compositor becomes the single enforcer of geometry, visibility ordering, and dirty-region tracking. Without it, every widget that needs its position or visibility will build its own coordinate logic, creating parallel truth.

// [LAW:one-source-of-truth] Widget placement comes from the compositor. Scroll changes are compositor translations, not ad hoc widget-local coordinate rewrites.

// [LAW:dataflow-not-control-flow] The layout pipeline is staged: filter → dock → layout strategy → alignment → absolute offsets. Every stage always runs; variability is in the data (empty dock list, zero margins).

## Current State (before this phase)

**`src/layout/`** contains:
- `LayoutStrategy` (abstract base): `arrange(parent, children, size, scrollEnabled)` returns `WidgetPlacement[]`
- `VerticalLayout`: stacks children top-to-bottom, each child gets full width and height 1
- `HorizontalLayout`: places children left-to-right, equal widths
- `GridLayout`: 2D cell-map with `colSpan`/`rowSpan` support, but `_resolveSpans()` returns `{colSpan: 1, rowSpan: 1}` always

All layouts use **fixed placeholder sizing** — they do not read from `RenderStyles`.

**`src/widget.ts`** has:
- `arrange(size)`: filters displayed children, delegates to `this._layout.arrange()`
- `scrollOffset`, `virtualSize` as plain fields
- `_size` set externally by renderer

**`src/geometry/`**: `Size`, `Offset`, `Region`, `Spacing` — all immutable, complete operator sets.

**No compositor exists** — no visibility map, no dirty regions, no `CompositorUpdate`.

## Scope

### Style-Driven Sizing

- Layout strategies read `width`, `height`, `min-width`, `max-width`, `min-height`, `max-height` from `RenderStyles`
- Support scalar types: `fr` (fractional), `%` (percentage of parent), `auto` (content-driven), fixed units (integer cells)
- Size resolution: resolve `fr`/`%` relative to available space, apply min/max constraints

### Box Model

- `margin` from styles: reserves space outside the widget
- `padding` from styles: reserves space inside the widget
- `border` from styles: reserves 1-cell border space
- Layout accounts for margin/padding/border when placing children

### Dock Layout

- `dock: top | bottom | left | right` from styles
- Docked widgets removed from flow and placed at edges of parent
- Dock widgets processed first, remaining space given to flow layout
- Dock order follows DOM order

### Staged Arrangement

Upgrade `Widget.arrange()` to a staged pipeline:
1. **Filter**: exclude `display: none` widgets
2. **Dock**: extract and place docked widgets, reduce available space
3. **Layout strategy**: apply `VerticalLayout`/`HorizontalLayout`/`GridLayout` to remaining children with style-driven sizing
4. **Alignment**: apply `align` and `content-align` from styles
5. **Absolute offsets**: apply any absolute positioning

### Compositor

- `Compositor` class takes `WidgetPlacement[]` from layout
- Builds a visibility map: for each cell (x, y), which widget is topmost-visible
- Tracks dirty regions: when a widget's content or placement changes, mark affected cells
- Produces `CompositorUpdate` segments: list of (region, widget, content-offset) tuples for the renderer
- Point queries: given (x, y), return the widget at that point (used by mouse hit-testing in Phase 5)

### Scroll Integration

- Widgets with `overflow: scroll | auto` become scroll containers
- Scroll offset applied as a compositor translation — the compositor shifts child placements by the scroll offset
- Scrollport calculation: visible portion of the virtual content
- Scrollbar chrome injection: scrollbar widgets added as internal children of scroll containers

### Render Caches

- `CompositorUpdate` supports full update (entire screen) and partial update (dirty regions only)
- Render cache: store last-rendered content per widget to detect no-change cases
- These data structures exist now for the future driver to consume (Phase 9)

### Region-to-Span Conversion

- Convert 2D regions into 1D line spans for terminal-style output
- Each span is (y, x_start, x_end, content) — ready for a driver to write

## Spec References

- `spec/spec-src/05-layout-render-and-compositor.md` — layout pipeline and compositor specification
- `spec/spec-tests/layouts.md` — layout test cases
- `spec/spec-tests/scrolling.md` — scroll test cases
- `spec/spec-tests/compositor.md` — compositor test cases
- `spec/spec-tests/renderables.md` — renderable output test cases

## Uber-Divergence Resolutions

None directly relevant to this phase.

## Exit Criteria

1. Layout tests verify style-driven sizing: `fr`, `%`, `auto`, fixed, with min/max constraints.
2. Dock placement tests: top, bottom, left, right docking with correct space reduction.
3. Box model tests: margin, padding, border affecting placement.
4. Compositor tests: visibility map construction, dirty-region tracking, point queries.
5. Scroll tests: scroll offset as compositor translation, scrollport calculation.
6. Both partial and full update paths are exercised in tests.
7. Existing layout tests updated to use style-driven sizing (old placeholder behavior replaced).
8. All prior phase tests still pass.
9. `npm run build` and `npm run lint` pass.

## What the Next Phase Expects

Phase 5 (Input, Bindings, Actions) expects:
- Compositor with point queries — mouse events need to find the widget at (x, y)
- Style-driven layout producing correct `WidgetPlacement` — bindings/actions interact with correctly positioned widgets
- Scroll containers working — scroll events need to update scroll offset through the compositor
