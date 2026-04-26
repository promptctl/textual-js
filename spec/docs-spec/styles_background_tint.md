# Docs Spec: Background, Tint, and Hatch Styles

## Purpose
Describes the docs page covering the four TCSS properties that control widget background appearance: `background` (solid color), `background-tint` (blend over background), `tint` (blend over the whole widget), and `hatch` (character pattern fill).

## Audience
Widget authors and theme authors working on visual styling, emphasis, and state indication.

## Required sections
1. Overview — four related properties, what each one affects, how they differ.
2. `background` — syntax, default (transparent), TCSS and TypeScript examples, supported color formats.
3. `background-tint` — syntax, blending semantics, when to use it (e.g., focused-widget emphasis), alpha behavior at 0% / 100%.
4. `tint` — syntax, semantics (covers content and background), alpha requirement, behavior at 0% / 100%.
5. `hatch` — syntax, named hatch patterns (`cross`, `horizontal`, `left`, `right`, `vertical`) and custom single-character form, color and percentage parameters.
6. Property interactions — rendering order: background, background-tint, content, tint, hatch overlay.
7. `background-tint` vs `tint` comparison table.
8. Property summary table — TCSS property, TS style key, value shape, default.

## Key concepts
- `background` is a solid color (with optional alpha) that fills the widget's background cells.
- `background-tint` blends a color with whatever the background already is; useful for subtle state emphasis without overriding the theme background.
- `tint` blends a color over the entire rendered widget (background + content + borders).
- `hatch` draws a repeating character (built-in or custom) on top of the background but behind content.
- All four properties accept the same `<color> [<percentage>]` syntax where the trailing percentage modulates alpha.

## Behaviors and contracts
- Default for all four is effectively transparent / none — unset values must not alter rendering.
- A trailing percentage in the value (e.g., `red 20%`) must multiply the color's alpha channel.
- `background-tint` at 100% alpha must visually replace the background; at 0% must be a no-op.
- `tint` at 100% alpha must fully obscure widget content; docs must warn that tint values typically need alpha less than 100%.
- `hatch` accepts named patterns or a single-character quoted string; multi-character strings must be a parse error.
- Rendering order is deterministic: background → background-tint → content → tint (→ hatch pattern for background-decoration order as specified by the engine).
- `background-tint` affects only the background region; `tint` affects the whole widget output.
- Hatch character must be exactly one grapheme when the custom-character form is used.

## Example requirements
All examples JSX/TypeScript, using Ink primitives and textual-js widgets:
- A widget with `background: blue`.
- A widget with a semi-transparent `background: red 20%` showing the parent background bleeding through.
- A focused-state rule using `background-tint: $accent 10%` to emphasize focus.
- A widget with `tint: red 20%` indicating an error state without changing its text explicitly.
- A widget with `hatch: cross red` and another with a custom-character hatch like `"T" blue 80%`.
- An example combining `background`, `hatch`, and `tint` to show rendering order.
- A TCSS authoring example (preferred surface) alongside an imperative style-object example.

## Cross-references
- `spec/docs-spec/styles_colors.md` — `color`, `opacity`, `text-opacity`, shared color formats.
- `spec/docs-spec/styles_display_visibility.md` — opacity vs. tint clarification.
- `spec/docs-spec/styles_borders.md` — border colors that can be tinted.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS parsing for these properties.
- `spec/spec-src/05-layout-render-and-compositor.md` — composition / rendering order.

## Notes for writers
- Drop the Python `Color(120, 60, 100, 0.5)` / `Color.parse("pink")` examples. In textual-js, colors are strings (TCSS values) or the framework's color object exposed in TS.
- Do not mention `from textual.color import Color`; describe the TS-side color helper that the library exposes (if any) without importing Python names.
- Terminal color caveat applies equally: there is no true transparency — blending is approximated by compositing against the resolved parent background. Keep this caveat in the page.
- Clarify that tint/background-tint semantics are computed at render time in the compositor layer, not by Ink directly — Ink does not implement tint natively.
- `hatch` patterns are drawn by the compositor; mention that they interact with wide-character content.
