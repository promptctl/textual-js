# Docs Spec: Syntax Highlighting Utility

## Purpose
Describes the docs page that teaches developers how to produce syntax-highlighted styled content for display in widgets (notably `TextArea`, `RichLog`, and custom widgets), using the built-in highlight utility.

## Audience
Widget authors and application developers who need to render source code with language-aware styling, or who are building custom widgets that embed highlighted snippets.

## Required sections
1. Overview and use cases (code blocks, logs, text areas, markdown fences).
2. `guessLanguage(code, path?)` — language detection helper and its heuristics.
3. `highlight(code, options)` — producing styled `Content` from source.
4. `HighlightTheme` — default token-to-style mapping and how to customize it.
5. Token-to-style mapping reference (table of recognized token categories and default styles).
6. Customization: supplying a custom theme or a custom language.
7. Integration notes: using highlighted content inside widgets and TCSS variable references.

## Key concepts
- Tokenization: source code is split into typed tokens by a syntax highlighter (Shiki in textual-js).
- Token type hierarchy: theme lookup walks up a hierarchy (e.g. `String.Double` falls back to `String`) to find a matching style.
- `Content` object: the highlighted output is a styled `Content` instance with spans, consumable by widgets.
- Theme as data: the theme is a mapping from token category to a TCSS-compatible style string that can reference design-system variables (`$text-accent`, `$text-success`, etc.).
- Language guessing: uses file extension plus optional content sniffing, with a special case mapping `.tcss` to a CSS-like grammar for Textual CSS files.
- Tab handling: the utility converts tabs to a configurable number of spaces before rendering.

## Behaviors and contracts
- `highlight(code, { language?, path?, theme?, tabSize? })` returns a `Content` object with styled spans.
- If `language` is omitted, the utility calls `guessLanguage(code, path)` with the same inputs.
- If the requested language is unknown, the utility falls back to a plain-text grammar (no styles applied beyond the base style) rather than throwing.
- Token types unknown to the theme fall back up the token hierarchy until a style is found, or default to the base text style.
- The returned `Content` is safe to pass directly to any widget that accepts styled content.
- Theme style strings use TCSS syntax and may reference theme variables; they are resolved against the active theme when the content is rendered.
- `guessLanguage` returns a language identifier string suitable for `highlight`; when no guess is possible it returns a stable default.

## Example requirements
All examples are JSX/TypeScript using Ink primitives and textual-js widgets:
- Highlighting a TypeScript source snippet and rendering the result inside a `Static` or `RichLog` widget.
- Highlighting an unknown source by passing a `path` and letting `guessLanguage` pick the grammar.
- Supplying a custom theme that overrides a few token categories (e.g. keywords and strings) while inheriting the rest.
- A `TextArea` configured with a non-default language for highlighting.
- A markdown-fence rendering flow that highlights embedded code blocks.

## Cross-references
- `spec/docs-spec/api_content.md` — the `Content` data type and how spans work.
- `spec/docs-spec/api_style.md` — style strings and how to write them.
- `spec/docs-spec/api_markup.md` — inline markup language used when building content manually.
- `spec/docs-spec/api_widget.md` — widgets that can render styled content.
- `spec/spec-src/05-layout-render-and-compositor.md` — rendering pipeline.
- `spec/spec-src/11-text-editing-and-document-model.md` — `TextArea` integration for highlighted code.

## Notes for writers
- Python Textual uses Pygments as the highlighter; textual-js uses Shiki. Do not mention Pygments, lexer classes, `guess_lexer_for_filename`, or `Token.*` tuple types. Describe token categories in neutral terms (keyword, string, number, comment, name, operator, etc.).
- Do not document the Python `HighlightTheme` as a class with `STYLES` class variable; describe the theme as a data structure (object) mapping token category to style string.
- Do not describe `token_type.parent`; describe fallback as "walks up the token category hierarchy".
- Style strings are TCSS-compatible and reference design-system variables — reference the theme/variables docs rather than redefining the syntax.
- The special-case `.tcss` → CSS-like grammar mapping is worth calling out.
- Avoid reproducing Python function signatures; show TypeScript signatures consistent with textual-js exports.
