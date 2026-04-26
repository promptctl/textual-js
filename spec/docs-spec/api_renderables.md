# Docs Spec: Built-in Renderables

## Purpose
Document the library of reusable visual primitives — progress bars, blank fills, block-digit displays, gradients, and sparklines — that widget authors can use inside a widget's render output.

## Audience
Widget authors building custom widgets who want ready-made visual components, and theme/style authors customizing the appearance of built-in widgets (e.g. progress bar, digits display).

## Required sections
1. Overview — what "renderables" are in textual-js (small composable visual primitives for terminal output) and how they fit into a widget's render.
2. `Bar` — thin horizontal bar with highlighted range, optional clickable sub-ranges, optional gradient, optional fixed width.
3. `Blank` — solid color background fill.
4. `Digits` — 3x3 block-unicode numeric font (normal and bold variants), supported character set, measurement.
5. `VerticalGradient` — simple two-color top-to-bottom gradient.
6. `LinearGradient` — multi-stop gradient with rotation angle.
7. `Sparkline` — data-to-bar-chart compactor with min/max color blending and summary-function bucketing.
8. Sizing/measurement contract — how each renderable responds to width and height constraints.
9. Styling contract — how styles are applied and how themes can override defaults.

## Key concepts
- Renderables are pure visual values produced by widget render code; they are not widgets themselves and do not participate in layout/focus/events (other than optional click metadata on `Bar` ranges).
- Sub-cell precision — `Bar` rounds to half-cells using the left/right half-bar glyphs for smooth animation; `ScrollBar`-style sub-cell glyph arrays are used analogously here.
- Gradient math — `LinearGradient` computes per-cell colors given a rotation; `VerticalGradient` is the common simple case.
- Bar characters — `Sparkline` uses the 8 height-levels `▁▂▃▄▅▆▇█`, bucketed by a summary function (default: max).
- Digits use `DIGITS3X3` or `DIGITS3X3_BOLD` glyph tables keyed by a fixed supported character set.
- `Bar` can annotate click-targets on sub-ranges via metadata; click metadata is surfaced as actions on the host widget.
- Measurement (width/height) is reported via the framework's renderable measurement protocol so layout can allocate space.

## Behaviors and contracts
- `Bar`:
  - Highlight range is rounded to the nearest half-cell.
  - Empty or inverted highlight range renders the full bar in the background style.
  - Clickable ranges map name → `[start, end]` cell range and emit a range-click action keyed by name when clicked.
  - A supplied gradient is applied to the highlighted portion only.
- `Blank`:
  - Optimal width equals container width.
  - Height is 1 line by default; supply an explicit height to fill multiple lines.
  - Every rendered line is the same blank strip.
- `Digits`:
  - Characters in the supported set render as 3x3 glyph tiles (3 rows, 3 cells wide).
  - Unsupported characters render as single-cell glyphs in the bottom row.
  - `getWidth(text)` returns rendered cell width without rendering.
  - Style's bold flag selects between bold and normal glyph tables.
  - Period character is displayed as `•`.
- `VerticalGradient`:
  - Fills its area with full-width space characters on each row; each row's background color interpolates between the two endpoint colors.
- `LinearGradient`:
  - Uses the upper-half-block glyph so each cell carries two vertical color samples.
  - Special-cases near-vertical angles for efficiency (falls back to full-width per-row rendering).
- `Sparkline`:
  - Empty data renders as the shortest-bar glyph repeated in the min color.
  - Single-point data renders as the tallest-bar glyph repeated in the max color.
  - Multi-point data is partitioned into `width` buckets, each summarized (default max), mapped to a bar glyph, and colored by interpolating between min and max colors based on the value's position in the data's range.

## Example requirements
JSX/TypeScript examples using Ink primitives. Include at minimum:
- A widget rendering a `Bar` with a highlighted range and a gradient.
- A widget rendering a `Bar` with clickable ranges and handling the resulting action.
- Using `Blank` to paint a solid-color panel background.
- A digital-clock-style widget using `Digits` with different styles.
- A status panel with a `VerticalGradient` backdrop.
- A sparkline of numeric data with custom min/max colors and a non-default summary function (e.g. mean).

## Cross-references
- `api_style.md` / `api_color.md` in `spec/docs-spec/` — style and color types used by renderables.
- `api_content.md` in `spec/docs-spec/` — content/text rendering integration.
- `api_widget.md` in `spec/docs-spec/` — how a widget's `render` produces these values.
- `api_strip.md` in `spec/docs-spec/` — the line-level primitive that ultimately carries rendered output.
- `spec/spec-src/05-layout-render-and-compositor.md` — rendering pipeline.
- `spec/spec-src/14-renderer-integration-seams.md` — Ink renderer integration.

## Notes for writers
- The source uses the term "Rich renderable"; textual-js does not use Rich. The JS port produces cell-based output consumed by the framework compositor and ultimately rendered through Ink. Describe these as "framework renderables" and do not mention Rich.
- Do not describe `__rich_console__` / `__rich_measure__` as Python-style protocols. The JS port exposes equivalent measurement/produce-cells methods described in the framework's renderable protocol.
- Colors should be described using the framework's `Color` type or a parseable color string.
- `Gradient` (singular, as a color interpolator used inside `Bar`) is distinct from `LinearGradient`/`VerticalGradient` renderables. Make sure the doc distinguishes "a color interpolator" from "a renderable that paints a gradient".
- The sparkline `summaryFunction` is a plain function; describe with TS signature `(bucket: number[]) => number`.
- Avoid documenting the internal helper `_applyGradient` as public API — describe it as an implementation detail used by `Bar`.
