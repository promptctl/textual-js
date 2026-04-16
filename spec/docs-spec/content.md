# Docs Spec: Content and Text Rendering

## Purpose
Describes the Content page — textual-js's immutable styled-text primitive, its construction and manipulation API, the markup language parsed into styled spans, and how Content participates in the Ink-based rendering pipeline.

## Audience
Widget authors producing styled output (labels, rich messages, markup-enabled notifications) and framework extenders adding new visual types.

## Required sections
1. Overview — Content is an immutable container for text with style spans; all mutations return new instances, enabling caching and safe sharing. Strip (the per-line render result) is described as a compositor-level concept and may be abbreviated compared to the source.
2. Content Class
   - Construction — from plain text, from markup, from text/markup autodetection, from a styled string, blank, empty, and assembly (concatenation of strings/Content/tuples).
   - Properties — `plain`, `cellLength`, `spans`, `markup`, `withoutSpans`, `firstLine`.
   - Manipulation — stylize (append and prepend variants), append/append text, join, truncate, padding (left/right/both), center, right-align, right-crop, extend-right, extend-style, rstrip variants, expand-tabs, split, divide, fold, wrap (with alignment and overflow), add-spans, simplify, highlight-regex.
   - Equality and identity — `==` compares plain text only; `isSame` compares text + spans; hashing is on plain text.
3. Span — the `{ start, end, style }` record, extension helper, and the rule that later spans take priority when styles overlap.
4. Content Markup
   - Overview and the markup playground entry (mention the CLI/demo tool for experimenting, if available in textual-js).
   - Tag syntax — opening, closing, auto-close, combined tags, nesting.
   - Supported styles — bold (b), dim (d), italic (i), underline (u), strike (s), reverse (r); inversion with `not`.
   - Colors — every `<color>` form from the CSS types spec, including CSS variables, alpha, percentage shorthand, and `on ...` backgrounds.
   - Links and actions — `[link=...]...[/link]` and `[@click=...]` forms.
   - Escaping — backslash escaping of `[`, the `escape()` helper, and markup-disable options on widget/API surfaces.
   - Template variables — `$name` substitution with injection-safe literal bracket handling.
5. Strip — brief description of what a Strip is (one horizontal line of rendered cells) and why authors rarely construct them directly. Reference the rendering pipeline section for how Content becomes Strips via the compositor.
6. Rendering Pipeline — widget render → visual conversion → strips → composition → terminal output. Emphasize that Ink owns the terminal output stage in textual-js.
7. Visual Protocol — the minimal contract an object implements to participate in rendering (render-strips, optimal/minimum width, height). Usually authors return Content directly and the framework adapts.
8. Type Aliases — names and meanings of the content-related unions exposed to authors (`ContentType`, `ContentText`, `VisualType`).
9. Caching Strategy — immutability enables aggressive memoization; Content and Strip cache derived results.

## Key concepts
- Immutability: every manipulation returns a fresh Content; old references remain valid and cacheable.
- Styled spans are layered: overlapping spans stack, and later spans in the list have priority.
- Markup is a text-first syntax; template variables are the injection-safe way to embed user input.
- Plain text is the identity for equality, sort, and hash; visual/style identity requires `isSame`.
- Content participates in the render pipeline by implementing the Visual protocol; most authors produce Content and the framework converts it to Strips for Ink.

## Behaviors and contracts
- `stylize` appends a span (later = higher priority); `stylizeBefore` inserts at the head (lower priority).
- `truncate` enforces a cell budget and can append an ellipsis or pad to the budget.
- `wrap` performs word wrapping at cell boundaries with the requested alignment and overflow mode (`fold` or `ellipsis`).
- `highlightRegex` applies a style to every regex match up to an optional cap.
- `fromMarkup` with template variables treats brackets in variable values as literal text; authors should prefer variables over string interpolation.
- Empty and blank constructors return singletons or cached values where possible.
- `simplify()` merges adjacent identical-style spans; it is a no-op on rendered output but speeds downstream work.
- Hashing and equality are intentionally text-only so Content can be used as a map key by its text identity.

## Example requirements
Describe (do not inline) JSX/TypeScript examples covering:
- Creating Content from markup and passing it to a widget that accepts a `ContentType` prop.
- Assembling heterogeneous parts with `Content.assemble(...)` and rendering inside an Ink component.
- Using template variables (`Content.fromMarkup("Hello $name", { name: userInput })`) to safely embed untrusted input.
- Applying `stylize`, `truncate`, and `wrap` in a label widget.
- Registering a clickable link/action with `[@click=app.bell]` and the corresponding action handler.
- Disabling markup parsing on an API that accepts either plain strings or Content.
All examples are JSX/TypeScript; no Python, no Rich Text references.

## Cross-references
- `spec/docs-spec/css_overview.md` and `spec/docs-spec/css_types.md` — color syntax used inside markup color tags.
- `spec/docs-spec/design.md` — theme variables referenced in markup (`[$accent]`).
- `spec/docs-spec/actions_and_bindings.md` (if present) — `[@click=...]` action syntax.
- `spec/spec-src/05-layout-render-and-compositor.md` — rendering pipeline and compositor behavior.
- `spec/spec-src/14-renderer-integration-seams.md` — how Content integrates with Ink.

## Notes for writers
- Do not describe Rich `Text`, Rich `Segment`, Rich `Console`, or Rich renderables as public API. textual-js's public surface is Content (and the `Visual` protocol for extenders). Mention that internally the renderer emits terminal cells via Ink; skip Rich entirely.
- Do not document the `StripRenderable` wrapper or `rich.print` integration — they have no textual-js equivalent.
- Do not document `render_ansi`/`render_style` low-level helpers; those are internal to the compositor and Ink handles the final output.
- The markup playground may or may not ship in textual-js. If it does, mention how to launch it; if not, omit that subsection rather than fabricating one.
- Do not describe Python `NamedTuple` or `Sequence` types. Spans are `{ start: number, end: number, style: Style | string }` objects; span lists are arrays.
- Auto-contrast color keyword `auto` is a color value; keep the color grammar consistent with the CSS types spec.
- When describing equality/hashing, avoid saying `__hash__`/`__eq__` — use "equality comparison" and "hash key" in JS terms.
