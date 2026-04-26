# Docs Spec: Layout

## Purpose
Describes the doc page that teaches textual-js's layout system: how widgets are arranged inside containers using the layout CSS property, the three layout types (vertical, horizontal, grid), plus the positioning primitives that layer on top of any layout (docking, layers, offsets, fractional units) and the utility container widgets that set these up for you.

## Audience
Widget authors and application authors. Anyone who needs to produce a terminal UI layout more sophisticated than a single column of children.

## Required sections
1. Overview: the `layout` CSS property, the three built-in layouts (vertical, horizontal, grid), and the fact that docking/layers/offset apply on top of any layout.
2. Vertical layout: default behavior, width-expand, height-does-not-expand, auto vertical scrolling when Screen overflow-y is auto.
3. Horizontal layout: width-expands-by-default pitfall (only first child visible without constrained widths), height-does-not-expand, explicit `overflow-x: auto` to enable horizontal scrolling.
4. Grid layout: high-level statement that this is nothing like browser CSS Grid. Then:
   - `grid-size` (columns, optional rows).
   - `grid-columns` and `grid-rows` (positional values, cyclical repeat when fewer values than tracks, `auto` support).
   - Cell spans (`column-span`, `row-span`) applied to child widgets.
   - `grid-gutter` (single-value or `row col` two-value form).
5. Docking: `dock: top|right|bottom|left`. Removes widget from flow; pins to edge; multiple widgets on the same edge stack with later-yielded on top. Height must be set explicitly for top/bottom docks; width for left/right.
6. Layers: the `layers` property on a container (ordered list) + the `layer` property on a child; higher layer draws on top regardless of yield order; unassigned children go to the default (lowest) layer.
7. Offsets: relative offset added after layout placement; does not affect sibling layout, only visual position.
8. Fractional units (`fr`): how a single fr fills remaining space, how multiple fr siblings divide space proportionally.
9. Utility containers: `Vertical`, `Horizontal`, `Grid` — premade widgets that encode the corresponding layout.
10. Widget sizing defaults: width-expands, height-does-not-expand; uniform across all layout types.
11. Runtime layout changes: how to change layout properties at runtime through the reactive style API.

## Key concepts
- A container's `layout` property dictates how its children flow: vertical, horizontal, or grid.
- fr units work only inside a layout that actually distributes space; they don't synthesize space out of nothing.
- Docking takes a widget out of the normal flow; it will overlap siblings if their space assumes the docked region is still available.
- Layers are explicit z-order; they override yield order.
- Offsets are purely visual — they don't reflow siblings.
- Grid in textual-js is a simple row/column cell grid with optional cell spans; it does not implement all of browser CSS Grid semantics.
- Utility containers (`Vertical`, `Horizontal`, `Grid`) are identical to setting the corresponding `layout` property on a generic container; they exist for ergonomics.

## Behaviors and contracts
- Vertical is the default layout for Screen and any container that doesn't override it.
- Width-expands, height-fits-content is the default for every widget in any layout; explicit declarations override.
- In a horizontal layout with unsized children, the first child takes full width and subsequent children are invisible until widths are constrained (explicit width or fr).
- Grid fills cells left-to-right, top-to-bottom in child-declaration order.
- When grid-size is a fixed `cols rows`, children beyond the product are not displayed; when rows are omitted, rows are created on demand.
- grid-columns/grid-rows with fewer values than tracks repeat cyclically.
- Docked widgets on the same edge stack; later-yielded renders on top (same rule as layers for that edge).
- Layers override yield-based z-order but do not change flow.
- Offset is relative to the widget's layout-assigned position; it is not absolute.
- Changing `styles.layout` (or equivalent) at runtime must trigger a re-layout on the next frame, observably.

## Example requirements
All examples JSX/TypeScript, using Ink primitives and the textual-js React API:
- Minimal vertical layout that scrolls automatically when content exceeds screen height.
- Horizontal layout with two children each sized `width: 1fr` to split the screen.
- Horizontal layout with `overflow-x: auto` for a scrollable row of widgets.
- Grid layout with `grid-size: 3 2`, explicit grid-columns, and a widget using column-span.
- Grid layout with `grid-columns: auto 1fr 1fr` to fit-content-first-column.
- Docked header (`dock: top; height: 3`) + docked footer (`dock: bottom; height: 3`) + main content.
- Two docked sidebars on the same edge showing that the later-yielded one appears on top.
- Layers example: two overlapping widgets assigned to `below` and `above`.
- Offset example: a widget visually shifted without affecting its siblings.
- Utility-container example using `Horizontal` with nested `Vertical` children for a four-cell grid without using grid layout.
- Runtime layout change: toggle a container between `horizontal` and `vertical` via a button press.

## Cross-references
- `spec/docs-spec/how_to.md` (layout design workflow, containers, centering).
- `spec/docs-spec/getting_started.md` (introduces containers briefly).
- `spec/docs-spec/api_layout.md`, `spec/docs-spec/api_containers.md`.
- `spec/spec-src/04-styling-and-css-engine.md` and `spec/spec-src/05-layout-render-and-compositor.md` (behavioral specs).

## Notes for writers
- textual-js layout is ultimately delegated to Ink (Yoga flexbox); authors should know that terminals round to cell units but the mental model is still "flex like". Don't expose Yoga as the user-facing API, but do reference Ink where platform limits show through.
- Grid is emphatically not browser CSS Grid; keep that distinction.
- Replace the Python `yield ...` + context manager examples with JSX nesting. The `with Horizontal(): with Vertical(): yield Static("...")` pattern becomes `<Horizontal><Vertical><Static>...</Static></Vertical></Horizontal>`.
- `widget.styles.layout = "horizontal"` stays as a concept but uses the reactive style API in TypeScript. Mirror the framework's actual API.
- No asyncio, no Python types. CSS values are strings or framework-specific enums.
- Keep the "cells are typically twice as tall as wide" advice for grid-gutter; it's a terminal fact, not a Python fact.
- Include an explicit pointer that fr units are resolved by the layout engine, not by CSS-tree parsing alone — the TCSS engine still needs to compute them at layout time.
