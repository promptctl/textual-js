# Docs Spec: Text Style Properties

## Purpose
Describes a docs page covering the four TCSS properties that control text rendering within widgets: `text-style`, `text-align`, `text-wrap`, and `text-overflow`.

## Audience
App authors styling text-rendering widgets, and widget authors implementing widgets that display textual content.

## Required sections
1. Overview of the four properties and when each applies.
2. `text-style` -- syntax, value list (`none`, `bold`, `italic`, `reverse`, `strike`, `underline`), combining multiple styles, default.
3. `text-align` -- syntax, values (`start`, `end`, `left`, `right`, `center`, `justify`), default, relationship to `align` and `content-align`.
4. `text-wrap` -- syntax, values (`wrap`, `nowrap`), default, overflow implications.
5. `text-overflow` -- syntax, values (`clip`, `fold`, `ellipsis`), default, behavior.
6. Interaction between `text-wrap` and `text-overflow` (when overflow styling is actually observable).

## Key concepts
- `text-style` is composable: multiple space-separated values combine (e.g., bold + underline + italic).
- `text-style: none` explicitly clears styling.
- `text-align` values `start`/`end` are aliases for `left`/`right` under the current left-to-right layout; they exist to remain correct if right-to-left support is added.
- `text-align` applies to text within a widget; `align` applies to children of a container; `content-align` applies to widget content within its own box. These are three distinct properties with three distinct scopes.
- `text-wrap: wrap` is the default -- text wraps at word boundaries by default.
- `text-overflow` only has a visible effect when overflow actually happens (nowrap, or a single word wider than the container).
- Terminal `reverse` swaps foreground and background; not all terminals render every style identically (italic and strike in particular).

## Behaviors and contracts
- Defaults: `text-style: none`, `text-align: start`, `text-wrap: wrap`, `text-overflow: clip`.
- `text-style` combines values additively; later declarations fully replace earlier ones (standard TCSS cascade).
- Invalid `text-style` tokens should fail parsing with a clear error.
- `justify` alignment stretches text to fill the widget width by distributing spaces between words.
- `text-overflow: ellipsis` replaces the final visible character with an ellipsis glyph; `clip` truncates without indication; `fold` breaks at character boundaries onto subsequent lines.

## Example requirements
Examples should be TCSS snippets plus JSX/TypeScript (widgets wrapping Ink `<Text>`), demonstrating:
- Each `text-style` value individually and a combined example.
- Each `text-align` value with visible alignment in a fixed-width widget.
- `text-wrap: nowrap` combined with each `text-overflow` value.
- A narrow widget containing a long single word to show `text-overflow` under `text-wrap: wrap`.

## Cross-references
- `spec/docs-spec/styles_text_advanced.md` -- deeper treatment of wrap/overflow.
- `spec/docs-spec/styles_spacing.md` -- box-sizing affects the content-area width that text is measured against.
- `spec/spec-src/04-styling-and-css-engine.md` -- property schema and parser.
- `spec/spec-src/05-layout-render-and-compositor.md` -- text measurement and layout.

## Notes for writers
- Omit all `widget.styles.text_style = ...` Python snippets; describe the TypeScript styles API narratively where needed but prefer TCSS examples.
- When discussing `reverse`, mention that the ultimate rendering is delegated to Ink/the terminal.
- Do not promise `justify` behaves identically to web `text-align: justify` in every edge case; terminal cell constraints differ.
- Be explicit that `text-align` does not align child widgets -- `align` does.
