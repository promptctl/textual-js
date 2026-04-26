# Docs Spec: Container Widgets

## Purpose
Document the built-in container widgets that provide quick layout/styling primitives (vertical/horizontal stacks, scroll containers, centering wrappers, grids) so authors can compose screens without writing custom TCSS.

## Audience
App authors building layouts and widget authors who wrap children in canonical containers.

## Required sections
1. Overview: when to reach for a container vs. writing TCSS on a plain `Widget`.
2. Full catalog of containers, each with: default layout direction, overflow behavior, default size (width x height), whether it is focusable, and any default bindings.
3. `Container` vs. `ScrollableContainer` — the focus/scrollbar/bindings differences.
4. Directional containers: `Vertical`, `VerticalGroup`, `VerticalScroll`, `Horizontal`, `HorizontalGroup`, `HorizontalScroll` — explain the `*Group` "shrink-to-content" variants.
5. Alignment containers: `Center`, `Right`, `Middle`, `CenterMiddle`.
6. Grid containers: `Grid` and `ItemGrid`, including `ItemGrid`'s reactive props (`stretchHeight`, `minColumnWidth`, `maxColumnWidth`, `regular`).
7. Keyboard bindings table for `ScrollableContainer` (arrow keys, Home/End, PgUp/PgDn, Ctrl+PgUp/PgDn). Note all have `show=false`.
8. How to compose children inside each container using JSX.

## Key concepts
- Expanding (`1fr x 1fr`) vs. non-expanding (`1fr x auto`) defaults.
- Overflow control per axis (`hidden`, `auto`).
- Scrollable containers opt into focus and keyboard scrolling bindings.
- `allowMaximize` behavior (scrollable containers default to not maximizing).
- Grid layout handled by Ink/Yoga where possible; `ItemGrid` applies reactive configuration to its underlying layout object in a `preLayout` hook.

## Behaviors and contracts
- Except for `Center`/`Middle`/`*Group`, containers fill all available space in their parent.
- `ScrollableContainer` bindings must not appear in the footer (`show: false`).
- Setting `canFocus`, `canFocusChildren`, `canMaximize` to `undefined` falls back to the class default; passing a boolean overrides it.
- Changing `ItemGrid` reactive props triggers a layout pass.
- Containers expose their children via composition (JSX children) and participate in the standard DOM query/lookup system.

## Example requirements
- JSX/TypeScript snippets (using textual-js components authored over Ink primitives) for:
  - A `Vertical` with three widgets.
  - A `VerticalScroll` with overflowing content.
  - A `CenterMiddle` wrapping a single widget.
  - A `Grid` with explicit TCSS grid-template configuration.
  - An `ItemGrid` with `minColumnWidth`, `maxColumnWidth`, `regular` configured via props.
- A table mapping container name -> default size, overflow, focusable, and "expands to fill".

## Cross-references
- `spec/docs-spec/api_scroll_view.md` (scroll internals).
- `spec/docs-spec/api_layout.md` (layout modes).
- `spec/spec-src/05-layout-render-and-compositor.md` (layout/composition contract).
- `spec/spec-src/10-widget-catalog.md` (widget catalog including containers).

## Notes for writers
- Do not reference Python class inheritance (`extends: Widget`). Describe containers as React components with documented prop shapes.
- Convert all keyword args (`can_focus`, `can_focus_children`, `can_maximize`, `stretch_height`, `min_column_width`, `max_column_width`) to camelCase props.
- Avoid the Python `*children` spread convention; use JSX children.
- Do not document `compose`/`mount` lifecycle unless it is part of the public JS API — in textual-js children are passed as JSX children.
- `set_reactive` in the Python constructor is an implementation detail; in JSX, props initialize observable state directly.
