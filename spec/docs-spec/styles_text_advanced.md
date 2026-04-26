# Docs Spec: Text Wrap and Overflow (advanced)

## Purpose
Describes a focused docs page explaining the `text-wrap` and `text-overflow` TCSS properties and how they interact when a widget's text content exceeds the available width.

## Audience
App authors who need to control truncation, wrapping, or ellipsis behavior on widgets that display text (labels, static content, list items).

## Required sections
1. Overview: when text overflows and why these two properties exist.
2. `text-wrap` -- values (`wrap`, `nowrap`), default, behavior.
3. `text-overflow` -- values (`clip`, `fold`, `ellipsis`), default, behavior.
4. Property interactions (when `text-overflow` actually takes effect).
5. Edge cases: a single token wider than the container; wrap + fold distinction.

## Key concepts
- `text-wrap: wrap` breaks at word boundaries; `nowrap` keeps text on a single line.
- `text-overflow` only has a visible effect when overflow actually happens: either `text-wrap: nowrap` is set, or a single word is wider than the container even with wrapping on.
- `clip` truncates; `fold` breaks at character boundaries (not word boundaries); `ellipsis` truncates with a trailing ellipsis character to indicate hidden content.
- `wrap` and `fold` are different: `wrap` respects word boundaries, `fold` does not.

## Behaviors and contracts
- Default for `text-wrap` is `wrap`.
- Default for `text-overflow` is `clip` (note: spec describes this property as applicable when overflow occurs; when wrapping is active and all words fit, `text-overflow` is inert).
- `ellipsis` replaces the last visible character on the truncated line with an ellipsis glyph.
- `fold` can break inside a word, producing mid-word line breaks.
- These properties apply to widgets whose rendered content is treated as text; the specific widgets to which these apply should be cross-referenced to the widget contract page.

## Example requirements
Examples should be TCSS snippets plus JSX/TypeScript (Ink primitives such as `<Text>` wrapped by the textual-js widget base) demonstrating:
- `text-wrap: nowrap` with each of the three `text-overflow` values.
- A container narrower than a long word, showing how `fold` vs `clip` vs `ellipsis` differ.
- `text-wrap: wrap` (the default) to contrast with `nowrap`.

## Cross-references
- `spec/docs-spec/styles_text.md` -- covers these two properties in combination with `text-style` and `text-align`; this advanced page is the deeper treatment.
- `spec/spec-src/04-styling-and-css-engine.md` -- property schema.
- `spec/spec-src/05-layout-render-and-compositor.md` -- how Ink/Yoga and the textual-js layout stage consume the wrap/overflow decisions before terminal output.

## Notes for writers
- Remove all Python setter examples. The TCSS properties are the canonical surface; the TypeScript styles API can be mentioned narratively.
- Be precise about where width is measured: the widget's content area (after padding and border subtraction under `border-box`).
- Do not conflate `text-wrap` with browser CSS `white-space`; terminology overlaps but semantics differ.
- Note that in a terminal cell grid, "width" is counted in cells (with east-asian wide character considerations); the renderer handles cell width calculation -- docs should link to the styling chapter for cell width behavior rather than re-specify it here.
