# Docs Spec: Box Model (box-sizing)

## Purpose
Describes the docs page covering the `box-sizing` property, which determines whether a widget's declared width and height include padding and border or refer only to the content area.

## Audience
Widget authors and app authors who set explicit dimensions and need to understand how padding and border affect the on-screen size.

## Required sections
1. Overview — what "box sizing" means and why it matters in a cell grid.
2. `box-sizing` syntax and allowed values (`border-box`, `content-box`).
3. Value semantics — how each value changes the meaning of `width` and `height`.
4. Behavior with worked examples — two widgets with the same declared height but different `box-sizing` values.
5. TCSS authoring examples.
6. TypeScript style-object examples.
7. Notes on interactions with `padding`, `border`, `width`, `height`, `min-*`, `max-*`.

## Key concepts
- `border-box` (default in textual-js): declared `width`/`height` includes content + padding + border.
- `content-box`: declared `width`/`height` refers to the content area only; padding and border are added outside.
- This property does not change how padding or border are drawn — only how declared dimensions are interpreted.
- It interacts with every dimension constraint: `width`, `height`, `min-*`, `max-*` all respect the chosen box sizing.

## Behaviors and contracts
- Default is `border-box` (matching Python Textual and web CSS `box-sizing: border-box` convention).
- Switching from `border-box` to `content-box` without adjusting padding/border must increase the widget's outer dimensions accordingly; the framework must not silently compensate.
- `min-*` / `max-*` constraints apply to the same box indicated by `box-sizing` — they do not mix content-box and border-box semantics.
- Invalid values must raise a TCSS parse error at load time.

## Example requirements
All examples JSX/TypeScript using Ink primitives and textual-js widgets:
- Two widgets with `height: 5`, one `box-sizing: border-box` and one `box-sizing: content-box`, both with the same padding/border, showing the observable size difference.
- A widget that changes `box-sizing` at runtime via the imperative style API and observes layout changes.
- TCSS rule demonstrating the default; TCSS rule demonstrating `content-box`.

## Cross-references
- `spec/docs-spec/styles_dimensions.md` — `width`, `height`, `min-*`, `max-*` and how they interpret box-sizing.
- `spec/docs-spec/styles_spacing.md` — `padding` / `margin`.
- `spec/docs-spec/styles_borders.md` — `border` (which participates in box-sizing).
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS parser for `box-sizing`.
- `spec/spec-src/05-layout-render-and-compositor.md` — layout engine consumption of box-sizing.

## Notes for writers
- Do not reference `widget.box_sizing = "border-box"` (Python snake_case attribute). In textual-js use TCSS as the primary authoring surface and describe the imperative equivalent as a property on the style object with the TS naming convention.
- The `widget.box_sizing` attribute in the source is actually a shortcut; describe the TS equivalent without copying the Python attribute name.
- Make explicit that this is a textual-js TCSS property and is implemented by the framework's layout pass, not by Ink's Yoga layout directly — Yoga has its own box sizing conventions and we translate TCSS semantics onto it.
- Keep the worked example very short: two rectangles side by side with a note on cell count. Readers remember the picture.
