# Docs Spec: Content and Styled Text

## Purpose
Teach authors how to construct, manipulate, and render immutable styled text (`Content`) with style spans for display inside widgets — the framework's primary unit of rich text.

## Audience
Widget authors rendering labels, headings, table cells, command-palette hits, markdown/source highlighting output, and any app code that builds styled strings at runtime.

## Required sections
1. Overview of `Content` as an immutable styled-text container — why immutability matters (caching, safe passing between components).
2. `Span` type: `{ start, end, style }` semantics, half-open interval `[start, end)`, and `extend`.
3. Constructors and factories:
   - Direct construction with plain text, optional spans, optional precomputed cell length.
   - `Content.empty()` singleton.
   - `Content.fromText(value, { markup })`.
   - `Content.fromMarkup(markup, variables?)` with variable substitution.
   - `Content.styled(text, style)` single-style wrapper.
   - `Content.blank(width, style?)` for padding.
   - `Content.assemble(...parts, { end })` from mixed strings/content/styled-tuples.
4. Properties: `markup`, `spans`, `cellLength`, `plain`, `withoutSpans`, `firstLine`.
5. Equality, ordering, hashing: compared by plain text only; `isSame` for full (text + spans) equality.
6. Indexing and slicing semantics (preserves spans; step != 1 is rejected).
7. Concatenation (`+`, `append`, `appendText`, `join`).
8. Wrapping, folding, splitting, dividing, truncating, stripping.
9. Padding and alignment (`padLeft`, `padRight`, `pad`, `extendRight`, `extendStyle`, `center`, `right`, `rightCrop`).
10. Styling (`stylize`, `stylizeBefore`, `highlightRegex`).
11. Style queries (`getStyleAtOffset`).
12. Tab expansion (`expandTabs`).
13. Rendering: iterable `(text, style)` pairs; terminal segment list (Ink-compatible).
14. Visual protocol hooks used by the layout/measurement system (optimal width, minimal width, height at a given width).
15. Type aliases for interchangeable types (`ContentType = Content | string`, etc.).
16. Module-level style constants (`ANSI_DEFAULT`, `TRANSPARENT_STYLE`, `EMPTY_CONTENT` singleton).

## Key concepts
- Immutability: every transformation returns a new `Content`; treat like `string`.
- Spans as sparse overlays — not a per-cell style array.
- `cellLength` (terminal cells) differs from `.length` (code units) for wide characters.
- Markup is the textual representation; `fromMarkup` and `.markup` are inverses.
- Style-stacking rules: `stylize` applies after existing styles; `stylizeBefore` applies with lower priority.
- Rendering flattens overlapping spans using a stack-based resolver.
- Rich `Text` interop: textual-js accepts an equivalent input type for ecosystem compatibility when available; document the JS equivalent, not Rich itself.

## Behaviors and contracts
- `Content` equality and ordering ignore spans and compare plain text only.
- `spans` is an immutable sequence; callers must not mutate.
- `from*` factories return the singleton `EMPTY_CONTENT` when inputs reduce to empty text.
- `fromMarkup` with both a `Content` input and variables must fail loudly.
- Step slicing is unsupported and must throw.
- Spans that extend past the end of text are trimmed/clamped by construction.
- `wrap`, `fold`, `split`, `divide` return arrays of `Content`; results of `split` may be cached.
- `highlightRegex` supports a `maximumHighlights` cap.
- `render` yields `(text, style)` pairs suitable for conversion to Ink's output model.

## Example requirements
- JSX/TypeScript snippets that:
  - Build `Content` from markup with variable substitution.
  - Apply a style to a substring via `stylize`.
  - Append and join multiple `Content` pieces with a styled separator.
  - Wrap long content to a width and display each line inside an Ink-based widget.
  - Highlight regex matches (e.g. numbers) in a log line.
- A table showing which methods return new `Content` vs. simple values, to reinforce immutability.
- A side-by-side: markup string -> resulting spans layout.

## Cross-references
- `spec/docs-spec/api_markup.md` (markup grammar and parsing).
- `spec/docs-spec/api_renderables.md` (renderables that produce `Content`).
- `spec/docs-spec/api_strip.md` (strip/segment rendering downstream of `Content`).
- `spec/docs-spec/api_highlight.md` (highlighters that emit `Content`).
- `spec/spec-src/02-dom-reactivity-and-query.md` (reactive text flows into `Content`).
- `spec/spec-src/05-layout-render-and-compositor.md` (visual protocol and width/height measurement).

## Notes for writers
- Do not reference Rich (`rich.text.Text`, Rich `Console`, Rich `Segment`) as user-facing types. Describe a JS-native `Style` and segment shape compatible with Ink.
- Python decorators (`@total_ordering`, `@cached_property`) are implementation details — document observable contracts instead.
- Do not describe `NamedTuple` for `Span`; describe it as a plain object/type with `{ start, end, style }`.
- The Python `_FormattedLine` internal helper is not part of the public surface — omit.
- Rendering pairs (`[text, style]`) should be described as tuples/arrays appropriate to TS; downstream consumers turn them into Ink output.
- Call out that equality ignores spans; this is a common footgun for authors who expect structural equality.
