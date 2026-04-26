# Docs Spec: CSS Value Types

## Purpose
Describes the CSS value-types reference page — the formal grammar for every value accepted by a TCSS property, cross-referenced from the per-property pages in the styles reference.

## Audience
App authors writing `.tcss`, widget authors documenting their own properties, and anyone consulting the styles reference to understand a `<foo>` placeholder.

## Required sections
1. Conventions — types are denoted `<name>` in angle brackets; per-property pages reference these types.
2. `<name>` — identifier grammar (letter/underscore start, then letters/digits/underscores/hyphens); examples.
3. `<integer>` — signed integers; per-property bounds may apply.
4. `<number>` — real numbers, optionally with a decimal point; supertype of `<integer>`.
5. `<percentage>` — `<number>` immediately followed by `%`; distinguish from `<scalar>`.
6. `<scalar>` — length grammar: `<number>` with an optional unit suffix, or `auto`. Table of units: cell (no unit), `fr`, `%`, `w`, `h`, `vw`, `vh`, and the `auto` keyword. Explain the semantics of each and the viewport definition (terminal width/height minus docked widgets).
7. `<color>` — every accepted color form: named, hex RGB/RGBA (3/4/6/8 digits), `rgb()`, `rgba()`, `hsl()`, `hsla()`, and CSS-variable references (`$name`). Note that Textual themes ship many variables.
8. `<border>` — enumerated border keywords (`ascii`, `blank`, `dashed`, `double`, `heavy`, `hidden`, `hkey`, `inner`, `none`, `outer`, `panel`, `round`, `solid`, `tall`, `thick`, `vkey`, `wide`), usually paired with a color.
9. `<hatch>` — `cross`, `horizontal`, `left`, `right`, `vertical`.
10. `<keyline>` — `none`, `thin`, `heavy`, `double`.
11. `<horizontal>` — `left`, `center`, `right`.
12. `<vertical>` — `top`, `middle`, `bottom`.
13. `<text-align>` — `left`, `center`, `right`, `justify`, `start` (alias for left until RTL), `end` (alias for right until RTL).
14. `<text-style>` — `none` or a space-separated combination of `bold`, `italic`, `reverse`, `strike`, `underline`.
15. `<overflow>` — `auto`, `hidden`, `scroll`.
16. `<position>` — `relative`, `absolute` (controls how `offset` is applied).
17. `<pointer>` — full list of cursor-shape keywords, with a note about terminal support requirements.

## Key concepts
- Every value-type section is self-contained and linked from property pages via the `<type>` placeholder.
- `<scalar>` and `<percentage>` are distinct: a bare `50%` is a percentage; in a size context it's interpreted as `<scalar>` (same sigil, richer unit set).
- Colors can come from themes via CSS-variable references.
- Some value types are rendered only when the terminal supports the corresponding protocol (mouse pointer shapes).

## Behaviors and contracts
- Parsers accept all forms listed; any other form is a parse error.
- `<text-style>` combines values additively; duplicates collapse.
- Hex color values with an alpha pair produce translucent colors; rgba/hsla accept a float 0..1 alpha.
- `fr` units allocate proportional space among siblings; `%`, `w`, `h`, `vw`, `vh` resolve against different references (container dimension, container width, container height, viewport width, viewport height).
- `auto` resolves to the intrinsic content size.
- `<border>` keywords have visual equivalents that may differ when terminal Unicode support is limited; the border renderer picks the closest representation.

## Example requirements
Describe (do not inline) examples covering:
- A property page using `<scalar>` and showing accepted values (`60`, `1fr`, `50%`, `25w`, `75vh`, `auto`).
- A color table demonstrating named, hex with and without alpha, `rgb`/`rgba`/`hsl`, and `$variable` forms.
- Combining `<text-style>` keywords (`bold italic underline`).
- A border declaration pairing `<border>` with `<color>`.
Examples are TCSS; no Python.

## Cross-references
- `spec/docs-spec/css_overview.md` — loading, selectors, specificity.
- `spec/docs-spec/design.md` — theme variables used by `<color>`.
- `spec/docs-spec/content.md` — markup shares the `<color>` grammar.
- `spec/spec-src/04-styling-and-css-engine.md` — authoritative parser/semantics.

## Notes for writers
- Drop the "Python type: `int`/`float`" annotations from the source. Replace with TypeScript idioms only where useful ("accepts `number`", "accepts a string or a Color instance").
- Do not reference `textual.color.Color`. Use the textual-js `Color` type (name it by whatever the implementation exports — likely `Color` from a `color` module).
- The `auto` color keyword from the markup grammar is a Content-markup feature, not a CSS color keyword; keep this page focused on CSS `<color>` and link to the Content page for markup-specific extensions.
- RTL-aware `start`/`end` remain aliases until RTL support lands; say so.
- Pointer shapes require the Kitty pointer-shape protocol. Note support is terminal-dependent; do not document a fallback mechanism unless one exists.
- Do not document `Color.parse()` in Python terms — if textual-js exposes parsing, describe it in TS.
