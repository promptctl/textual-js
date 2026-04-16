# Docs Spec: Alignment Styles (align, content-align)

## Purpose
Describes the docs page that teaches users how to position child widgets within a container (`align`) and how to position content within a single widget (`content-align`), including the axis values and per-axis shorthand.

## Audience
Widget authors and app authors laying out UIs. Anyone who has asked "how do I center this?"

## Required sections
1. Overview — two distinct mechanisms (`align` vs. `content-align`) share the same axis model.
2. Axis values — horizontal (`left`/`center`/`right`) and vertical (`top`/`middle`/`bottom`).
3. `align` — syntax (shorthand and per-axis), TCSS examples, TypeScript style-object examples.
4. `content-align` — syntax (shorthand and per-axis), TCSS examples, TypeScript style-object examples.
5. `align` vs `content-align` comparison table (what each aligns, where it is applied, typical use case).
6. Property summary table — CSS property, TS style key, value type, default.
7. Related styles — pointer to `text-align` as a distinct concept.

## Key concepts
- `align` is applied to the parent container and positions the container's children within the available space.
- `content-align` is applied to the widget itself and positions the widget's own rendered content (e.g., its text or rich output) within its content area.
- Both styles accept a shorthand pair (horizontal then vertical) and per-axis variants.
- Neither style has a default — unset means no explicit alignment is applied and default layout behavior governs.

## Behaviors and contracts
- `align: <horizontal> <vertical>` must require exactly two tokens in the shorthand; single-token forms go through the per-axis properties.
- `align-horizontal` and `align-vertical` must be settable independently and must compose into the effective alignment.
- `content-align` mirrors the same contract for the in-widget axis.
- `text-align` is distinct from both — it affects only text layout inside a widget, not the widget-as-child or the widget's rendered block.
- Invalid axis tokens (e.g., `horizontal: "middle"` or `vertical: "center"`) must produce a TCSS parse error at load time.

## Example requirements
All examples JSX/TypeScript, using Ink primitives and textual-js widgets:
- A container with `align: center middle` centering a single child in the terminal.
- A container with `align-horizontal: right` and `align-vertical: top` placing children in the top-right.
- A single widget using `content-align: center middle` to center its rendered content.
- A comparison example showing the same axis values applied as `align` vs `content-align` and how the outcome differs.
- A style-object example showing the TypeScript shape used by the framework (pair tuple or object with `horizontal`/`vertical` keys, depending on API).

## Cross-references
- `spec/docs-spec/styles_text.md` — `text-align` / `text-style`.
- `spec/docs-spec/styles_dimensions.md` — width/height that affects available space for alignment.
- `spec/docs-spec/styles_box_model.md` — box-sizing interaction with "available space".
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS parser for alignment tokens.
- `spec/spec-src/05-layout-render-and-compositor.md` — layout-time use of alignment.

## Notes for writers
- Drop the Python examples entirely. In textual-js, style values are assigned via the style object exposed on a widget / via the observer-friendly API — describe the TS shape (likely a tuple `["center", "middle"]` or an object `{ horizontal: "center", vertical: "middle" }` depending on the concrete API).
- Do not use `widget.styles.align = ("center", "middle")` (Python tuple syntax); rewrite as the JS equivalent.
- The source document's "Python" subsections should become "TypeScript" subsections showing either imperative style assignment or the TCSS source form; prefer TCSS for static styles because that is the primary authoring surface.
- Ink/Yoga's own flex alignment is distinct from textual-js `align`; clarify that textual-js alignment is a TCSS concept compiled down to the Ink layout tree and authors should use the TCSS names, not Yoga names.
