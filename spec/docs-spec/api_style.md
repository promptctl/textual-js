# Docs Spec: Style (visual style object)

## Purpose
Describe the `Style` value object used in the textual-js rendering pipeline: what it holds, how styles compose, and how they integrate with TCSS-derived styling on a widget.

## Audience
Widget authors and framework extenders who need to construct, combine, or reason about visual styles below the TCSS layer (e.g., when producing content spans, custom renderables, or theme-aware output).

## Required sections
1. Overview (what a `Style` is, how it differs from TCSS widget styles)
2. Fields (background, foreground, text decorations, link, meta, auto-contrast)
3. Tri-state semantics (unset vs explicit false vs true for boolean decorations)
4. Composition and addition semantics (alpha-composited background, right-wins foreground and booleans, meta merge rules)
5. Construction helpers (null/empty style, parse from text, build from widget styles, build from a meta bag, combine a sequence)
6. Derived views (style-without-color, background-only style, round-trippable string form)
7. Equality, hashing, and truthiness (what makes a style "null")
8. Integration with rendering (how widgets obtain a `Style` from their resolved TCSS styles, how Ink receives color/decoration attributes)

## Key concepts
- `Style` is immutable; every operation returns a new `Style`.
- Tri-state booleans: `undefined` means "inherit / not set", `true`/`false` are explicit.
- Addition is the canonical composition primitive: `a + b` yields a merged style used for layered rendering.
- Alpha-aware background compositing vs. right-wins semantics for other fields.
- `meta` carries arbitrary data (e.g., hyperlink targets, selection offsets) alongside visual attributes.
- A canonical null/empty style sentinel exists and is reused.
- Text-form parsing exists so styles can round-trip through strings (for TCSS values and content markup).

## Behaviors and contracts
- Combining a `Style` with `null`/`undefined` returns the original.
- Composition is associative when applied left-to-right; callers must not assume commutativity.
- The string form produced by the "definition" accessor parses back into an equivalent `Style`.
- Equality and hashing are content-based; two styles with identical fields are equal.
- `auto_color` / auto-contrast adjusts foreground against the effective background at resolution time, not at construction time.
- Meta merging uses key-level merge, not wholesale replace, when both sides have meta.

## Example requirements
All examples are JSX/TypeScript. The doc must show:
- Creating a `Style` literal with a foreground, background, and bold.
- Combining two styles and observing right-wins vs alpha-composited background.
- Deriving a style from a widget's resolved TCSS styles inside an `observer()` function component.
- Producing a Style-annotated span in rendered content.
- Parsing a text representation (e.g., `"bold #ff0000 on #000000"`) into a `Style`.

## Cross-references
- `spec/docs-spec/api_color.md` (Color type used for foreground/background)
- `spec/docs-spec/api_content.md` (Content spans that carry `Style`)
- `spec/docs-spec/api_markup.md` (parsing markup into styled content)
- `spec/spec-src/04-styling-and-css-engine.md`
- `spec/spec-src/05-layout-render-and-compositor.md`

## Notes for writers
- Do not describe a frozen Python dataclass; in textual-js `Style` is a plain immutable TypeScript value object.
- Do not mention Rich / RichStyle conversion — textual-js renders via Ink, not Rich. Replace any "convert to Rich style" language with "produce the attributes the terminal renderer consumes".
- Do not expose `_meta` byte encoding; meta is a plain object in JS.
- Avoid LRU-cache sizes and other Python implementation details; mention only that composition is cheap and pure.
- Be explicit that TCSS `styles` on a widget (spec: styling engine) are the authoritative source of styling; `Style` is the lower-level representation used for rendered spans.
