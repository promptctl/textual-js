# Docs Spec: Keyline Style Property

## Purpose
Describes the docs page that teaches readers how to use the `keyline` TCSS property to draw shared dividing lines between sibling widgets in a container.

## Audience
Widget authors composing grids, toolbars, or dashboards who want continuous dividers between children rather than per-widget borders.

## Required sections
1. Overview (keyline vs. border)
2. Syntax
3. Keyline types (`none`, `thin`, `heavy`, `double`)
4. Color parameter
5. Behavior (where keylines are drawn, requirement for margin or grid-gutter)
6. TCSS examples
7. Notes and caveats

## Key concepts
- `keyline` is applied to a container widget (a widget with a layout).
- Keylines are drawn in the margin area outside each child's border, so adjacent keylines can overlap to form continuous dividing lines.
- Keyline requires `margin` on children or `grid-gutter` on the container to produce visible space for the lines.
- The property value is `[<keyline-type>] [<color>]` — both parts optional but at least one meaningful.
- Keyline types correspond to line weights/glyphs drawn into the dividing space.
- Keylines differ from `border`: border decorates individual widgets, keyline creates dividing lines between siblings.

## Behaviors and contracts
- Setting `keyline: none` disables the effect.
- In grid layouts, the keyline creates grid-line effects between cells and uses the grid gutter as the drawing channel.
- A keyline with no surrounding margin/gutter has nothing to draw into and will not be visible.
- Keyline changes trigger a repaint of the container.

## Example requirements
- JSX/TypeScript example of a container with `layout: grid`, `grid-gutter`, and a `keyline` style.
- JSX/TypeScript example of a `Horizontal`/`Vertical` container with `margin` set on children to reveal a thin keyline.
- TCSS snippets for `thin`, `heavy`, `double`, and disabling with `none`.
- A comparison snippet showing `border` vs `keyline` visually (describe the expected rendered difference).

## Cross-references
- `spec/docs-spec/styles_grid.md` — grid layout which commonly pairs with keyline.
- `spec/docs-spec/styles_layout.md` — container layouts.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS property parsing.
- `spec/spec-src/05-layout-render-and-compositor.md` — rendering behavior for keylines.

## Notes for writers
- Emphasize the margin/gutter requirement; this is the most common source of "why doesn't my keyline appear?" confusion.
- The Python-specific tuple form (`("thin", "green")`) does not apply; use TCSS strings. If describing JS-side programmatic style access, use whatever styles accessor the textual-js API exposes.
- Do not describe Python tuple assignment or Python-specific property naming.
