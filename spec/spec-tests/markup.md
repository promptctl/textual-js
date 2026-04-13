# Markup and Syntax Highlighting

## Overview

Textual provides a markup language for styled text content and a syntax highlighting system for source code. Markup strings are parsed into `Content` objects composed of plain text and `Span` annotations that carry style information. The highlighting system produces `Content` objects from source code strings using language-aware tokenization.

### Markup Syntax

Markup uses square-bracket tags to apply styles to text. The `to_content` function (from `textual.markup`) parses a markup string into a `Content` object.

**Opening tags** have the form `[style]` where `style` is one or more space-separated style tokens:
- Named styles: `[bold]`, `[red]`, `[i]`
- Shorthand styles: `[b]` for bold, `[i]` for italic
- Combined styles: `[bold red]`, `[on red]`
- RGB colors: `[rgb(10, 20, 30)]`, `[bold rgb(10, 20, 30)]`
- Hex colors: `[#ff0000]`, `[#ffffff]`
- Component variable references: `[$accent]`
- Action annotations: `[@click=app.bell]`, combinable with styles like `[on red @click=app.bell]`
- Link styles: `[link='$name']`

**Closing tags** end a style span:
- `[/]` closes the most recently opened tag (universal close).
- `[/style]` closes a specific style, e.g. `[/bold]`, `[/b]`, `[/on red]`.
- `[/on red @click=]` closes a tag that included an action annotation.

Tags that are opened but never closed are implicitly closed at the end of the string.

### Parsing Rules

- An isolated `[` with no closing `]` is treated as literal text: `"["` produces plain `"["`.
- `[]` is literal text, not a tag.
- `[` followed by whitespace is literal: `"[ "` produces `"[ "`, `"[  ]"` produces `"[  ]"`.
- `[` followed by a digit is literal: `"[0"` produces `"[0"`, `"[0]"` produces `"[0]"`.
- An incomplete tag name with no closing bracket is literal: `"[red"` produces `"[red"`.
- A valid opening tag with no text content produces empty content: `"[red]"` yields `Content("")`.
- A pair of open/close tags with no text between them produces empty content: `"[bold][/bold]"`, `"[bold][/]"`, `"[bold]"` all yield `Content("")`. This holds for interleaved tag sequences with no text as well: `"[red][green][/red]"` yields `Content("")`.
- Newlines within text are preserved as-is.

### Span Generation

When markup is parsed, the result is a `Content` object containing plain text and a list of `Span` objects. Each `Span` has a start offset, end offset, and style string — all offsets are relative to the plain text (tags are stripped).

**Nesting:** Styles nest and each tag produces its own independent `Span`. For example, `[b][on red]What [i]is up[/on red] with you?[/]` produces three spans: `b` covering the full text, `on red` covering `"What is up"`, and `i` covering `"is up with you?"`.

**Overlapping (non-nested) tags:** Tags do not need to be strictly nested. `[red][blue]X[/red][/blue]` is valid and produces two spans both covering `"X"`, one for `blue` and one for `red`. If only one of the overlapping tags is explicitly closed — e.g., `[red][blue]X[/red]` — the unclosed tag still extends to the end of the string per the unclosed-tag rule, producing the same result: two spans over `"X"`, one for `blue` and one for `red`.

**Unclosed tags:** Tags that are never closed extend to the end of the string. `[#ff0000]Hello, [#ffffff]world!\nMy work here is done.` produces two spans: `#ff0000` covering the entire text, and `#ffffff` from offset 7 to the end.

### Template Variables

`Content.from_markup(markup, **variables)` supports `$`-prefixed variable substitution in the text portions of markup. Variables within tag brackets are not substituted.

- `"Hello $name"` with `name="Will"` produces `Content("Hello Will")`.
- `"Hello [bold]$name[/bold]"` with `name="Will"` produces styled content with `"Will"` bolded.
- `"[link='$name']$name[/link]"` with `name="Will"`: the `$name` inside the tag attribute is preserved literally as `link='$name'` in the style, while the `$name` in the text body is replaced with `"Will"`.

### Markup Errors

A `MarkupError` is raised when a closing tag does not match any open tag:
- `"[foo]foo[/bar]"` raises `MarkupError` because `[/bar]` does not match the open `[foo]` tag.
- `"foo[/]"` raises `MarkupError` because there is no open tag to close.

### Syntax Highlighting

The `highlight` function (from `textual.highlight`) takes a source code string and a language identifier, and returns a `Content` object with style spans derived from tokenization.

- `highlight("import this", language="python")` returns content whose `.plain` is `"import this"` and whose spans use component variable styles such as `$text`, `$text-error`, and `$text-primary`.
- Highlight spans use `$`-prefixed component variables (not literal color names), allowing themes to control the final appearance.

### Language Guessing

The `guess_language` function infers a programming language from source code content and/or a file path. It returns a language identifier string.

- Empty code with no path returns `"default"`.
- File extension mapping: `.py` returns `"python"`, `.xml` returns `"xml"`, `.json` returns `"json"`, `.tcss` returns `"scss"`.
- Shebang detection: code starting with `#! python` returns `"python"` regardless of path.
- File extension takes precedence over code content when both are present (e.g., `.tcss` file with Python-like code returns `"scss"`).
- An empty code string with a recognized extension still returns the correct language.

## Constraints

- Markup tag brackets must contain a non-whitespace, non-digit character after `[` to be recognized as a tag; otherwise they are literal text.
- Closing tags must match an open tag or a `MarkupError` is raised. A bare `[/]` with no open tags is an error.
- Closing a specific tag that was never opened (e.g., `[foo]...[/bar]`) is an error.
- Template variable substitution (`$var`) occurs only in text content, never inside tag brackets.
- Highlight spans use component variable styles (`$text`, `$text-error`, `$text-primary`), not concrete colors.
- `guess_language` falls back to `"default"` when neither code content nor file path provides a recognizable language signal.
