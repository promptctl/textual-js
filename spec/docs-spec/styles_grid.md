# Docs Spec: Grid Style Properties

## Purpose
Describes the docs page that teaches readers how to configure grid layouts in textual-js using the `grid-size`, `grid-columns`, `grid-rows`, `grid-gutter`, `column-span`, and `row-span` TCSS properties.

## Audience
Widget authors and app developers building two-dimensional layouts such as dashboards, forms, and tabular compositions.

## Required sections
1. Overview (grid layout is opt-in via `layout: grid`; container vs. cell properties)
2. `grid-size` (columns and optional rows, auto vs explicit rows)
3. `grid-columns` (scalar list, cycling rules, accepted scalar types)
4. `grid-rows` (scalar list, cycling rules, defaults by container sizing)
5. `grid-gutter` (one or two values, horizontal vs vertical)
6. `column-span` (applied to direct children)
7. `row-span` (applied to direct children)
8. How properties work together (container props vs cell props, placement algorithm, sizing pipeline, keyline interaction)
9. Complete worked example

## Key concepts
- A grid is enabled when the container has `layout: grid`.
- Container properties (`grid-size`, `grid-columns`, `grid-rows`, `grid-gutter`) define structure; cell properties (`column-span`, `row-span`) are set on direct children.
- Children are placed in document order left-to-right, top-to-bottom, and skip cells already occupied by prior spans.
- Accepted scalars include integer cells, percentages, fractional units (`fr`), and `auto`.
- Scalar lists cycle when there are more tracks than scalars; excess scalars are ignored.
- Gutter is applied between cells only, not at container edges.
- Keyline, when set on the grid container, reserves 2 cells per dimension and uses gutter as keyline spacing.

## Behaviors and contracts
- Defaults: `grid-size` columns default to 1, rows default to 0 (auto-computed).
- Explicit row count: extra children beyond the fixed count are not displayed; empty cells remain blank.
- Default track sizes: columns default to `1fr`; rows default to `1fr` if the container has a fixed height, otherwise `auto`.
- `grid-gutter` horizontal and vertical defaults are 0; a common idiom uses horizontal gutter = 2 * vertical gutter to compensate for terminal cell aspect ratio.
- `column-span` and `row-span` default to 1.
- Percentage resolution: column percentages resolve against container width; row percentages against container height.
- Sizing pipeline order: (1) compute track counts, (2) cycle scalar lists, (3) resolve `auto` by measuring content, (4) distribute remaining space across `fr` units, (5) subtract gutter before resolution.

## Example requirements
- JSX/TypeScript component composing several children inside a grid-styled container.
- TCSS snippets showing `grid-size`, `grid-columns`, `grid-rows`, `grid-gutter` combinations.
- JSX/TypeScript example demonstrating `column-span` on a header child and `row-span` on a sidebar child.
- A complete worked example reproducing a 3x4 dashboard grid with a header that spans 3 columns and a sidebar that spans 2 rows.
- A short example showing `auto` column sizing against mixed content widths.

## Cross-references
- `spec/docs-spec/styles_layout.md` — parent `layout` property including `layout: grid`.
- `spec/docs-spec/styles_keyline.md` — keyline styles that interact with grid gutter.
- `spec/docs-spec/styles_dock_offset.md` — docked children within a grid.
- `spec/spec-src/05-layout-render-and-compositor.md` — layout pass including grid placement and track sizing.

## Notes for writers
- textual-js layout is powered by Ink/Yoga flexbox plus a grid layout engine; describe the grid algorithm as documented without referencing Python implementation details.
- Do NOT use Python snake_case attribute names like `grid_size_columns` or `grid_columns` on a Python object. Use TCSS strings; in rare cases where JS-side programmatic access is shown, use the camelCase or string-valued accessor described in the styles spec.
- Stress that `column-span` / `row-span` go on children, not the grid container — users frequently forget this.
- Explain cycling with a concrete example (e.g., 5 columns with `grid-columns: 1fr 2fr` applies `1fr 2fr 1fr 2fr 1fr`).
- Do not mention Python tuples or paired-property restrictions; in TCSS the shorthand forms work normally.
