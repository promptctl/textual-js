# Docs Spec: Content Markup — Inline Styled Text Syntax

## Purpose
Describes the docs page that teaches developers how to write and parse inline markup strings (with `[style]...[/style]` tags) into styled `Content` for use in labels, logs, and other widgets.

## Audience
Application authors building UIs that render styled inline text (toolbars, status lines, notifications, logs), and widget authors accepting markup input from users.

## Required sections
1. Overview — what markup is and when to use it (versus constructing `Content` manually).
2. Markup syntax reference — opening tags, closing tags, auto-close, escaping, literals, template variables.
3. Style token reference — named styles (`bold`, `dim`, `italic`, `underline`, `underline2`, `reverse`, `strike`, `blink`) and their short abbreviations (`b`, `d`, `i`, `u`, `uu`, `r`, `s`).
4. `escape(markup)` — escaping user-supplied text so brackets are treated as literal.
5. `toContent(markup, options)` — parsing markup into a `Content` object, with an optional base style and template variables.
6. `parseStyle(style, variables?)` — parsing a style string into a `Style` object, with TCSS variable substitution.
7. Error handling — the error raised when markup is malformed.
8. Interaction with themes and TCSS variables.

## Key concepts
- Markup string: a plain string with `[tag]...[/tag]` segments that apply styles inline, plus `\[` escape for literal brackets.
- Style tag: content of the brackets interpreted as a style (for example, `[bold red on blue]`), following the same grammar as the style-string parser.
- Auto-close tag: `[/]` closes the most recently opened tag.
- Named close tag: `[/style]` closes a specific tag by normalized form.
- Literal tags: brackets that do not parse as styles are rendered as literal text rather than raising; empty or whitespace-only brackets are literals too.
- Template variable: `$name` or `${name}` substituted against a caller-provided map.
- Style string: supports colors (foreground, `on` background), named styles, `not` negation, `auto` for automatic colors, percentage alpha, `link` metadata, `key=value` metadata, and TCSS variable references like `$text-accent`.

## Behaviors and contracts
- `escape` escapes `[` so it does not start a tag; trailing single backslashes are doubled so escaping remains stable when concatenated.
- `toContent` returns a `Content` object on success; on malformed input (unclosed tag, unmatched closing tag) it throws a markup error. Empty or unrecognized tags are rendered as literal text — only structurally invalid markup throws.
- Unclosed tags at end-of-input are implicitly closed.
- Closing tags match opening tags by normalized form (whitespace-normalized, case handling consistent with the style parser).
- `parseStyle` resolves TCSS variables from a caller-supplied map, or from the active app's stylesheet variables if none is given.
- `parseStyle` accepts `not` before a style token to negate it; unknown tokens raise a markup error.
- Template variable substitution is safe — missing variables are left as literal `$name` rather than throwing.

## Example requirements
All examples are JSX/TypeScript using Ink primitives and textual-js widgets:
- Rendering a label with inline color and weight, e.g. a status bar showing `[bold red]offline[/]` alongside plain text.
- Escaping user-supplied text before embedding it in markup so user brackets are not interpreted.
- Substituting template variables into a dynamic message.
- Parsing a style string separately to apply to a whole widget.
- Handling a markup error in code that accepts user-supplied markup.

## Cross-references
- `spec/docs-spec/api_content.md` — `Content` objects and spans.
- `spec/docs-spec/api_style.md` — the `Style` type and style-string grammar.
- `spec/docs-spec/api_color.md` — color parsing.
- `spec/docs-spec/api_highlight.md` — related syntax highlighting that produces `Content`.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS variables that markup references.

## Notes for writers
- Python Textual uses `string.Template.safe_substitute` for variable substitution and a Pygments-like tokenizer (`MarkupTokenizer`, `StyleTokenizer`) internally. Do not document `TokenizerState`, `expect_markup`, or the `STATE_MAP` / `STATE_PUSH` / `STATE_POP` tables — those are implementation details.
- Do not use Python f-string or `string.Template` references in examples. Use template literals for construction and document the `$name` / `${name}` syntax as the markup's own template grammar, separate from JS template literals.
- Do not call the namespace "`textual.markup`"; use textual-js module names in API references.
- Make clear that markup is a string format, not JSX — it is useful for user-facing styling where JSX authoring is not available (for example, user content, config files, command palette results).
- Call out the difference between markup tags (`[bold]`) and TCSS style variables (`$text-accent`) — they coexist in style strings but serve different roles.
- Avoid reproducing the full Pygments-like token lists; stick to the user-facing style names and abbreviations.
