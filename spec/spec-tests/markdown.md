# Markdown and MarkdownViewer Widgets

The `Markdown` widget renders markdown-formatted text as a set of Textual widgets. The `MarkdownViewer` widget wraps `Markdown` and adds a navigable table of contents sidebar.

## Behavior

### Rendering Markdown Content

`Markdown` accepts a markdown string at construction time or via `update()`. It parses the string and mounts corresponding child widgets for each block-level element.

- An empty string produces no child widgets.
- Calling `update()` replaces the rendered content and posts a `Markdown.TableOfContentsUpdated` message.

### Supported Elements

The following markdown elements are parsed into dedicated widget types:

- `# Heading` through `###### Heading` produce `MarkdownH1` through `MarkdownH6`.
- `---` produces `MarkdownHorizontalRule`.
- Plain text produces `MarkdownParagraph`. Consecutive lines within a single paragraph are merged into one `MarkdownParagraph`.
- `> blockquote` produces a `MarkdownBlockQuote` containing a `MarkdownParagraph`.
- `- item` (unordered list) produces `MarkdownBulletList`.
- `1. item` (ordered list) produces `MarkdownOrderedList` with a `MarkdownParagraph` per list item.
- Indented code blocks and fenced code blocks (with or without a language identifier) produce `MarkdownFence`.
- Pipe-delimited tables produce `MarkdownTable`.

When a list is interrupted by a fenced code block, the parser closes the current list, emits the fence, and opens a new list for subsequent items.

### Inline Links

Links within paragraphs are rendered as clickable spans. When a link spans multiple lines separated by soft breaks, the soft breaks are collapsed and the link text is joined into a single contiguous span.

Non-ASCII characters in link targets are preserved as-is (not percent-encoded) when the link is clicked.

### Links in Tables

Links inside markdown tables are clickable and post `Markdown.LinkClicked` when clicked, the same as links in paragraphs.

### Open Links

The `open_links` parameter controls whether clicking a link opens it in the system browser. When `open_links=False`, links only post `Markdown.LinkClicked` messages without opening a browser.

### Loading Files

`Markdown.load(path)` reads a markdown file from disk and renders its content.

- Loading a non-existent file raises `FileNotFoundError`.

### Anchor Navigation

`goto_anchor(anchor)` scrolls to the heading whose slug matches the given anchor string.

- Returns `True` when the anchor is found and navigation succeeds.
- Returns `False` when the anchor does not exist in the document.
- Anchor slugs are derived from heading text (e.g., `# Hello There` becomes `hello-there`).

### Unhandled Tokens

Subclasses of `Markdown` can override `unhandled_token(token)` to return a custom `MarkdownBlock` widget for any token type not natively supported. Returning `None` ignores the token.

### Messages

- `Markdown.TableOfContentsUpdated` is posted whenever the document content is set or updated, including on initial mount and on subsequent calls to `update()`.
- `Markdown.LinkClicked` is posted when a link is clicked (regardless of `open_links` setting). The `href` attribute contains the link target.

## MarkdownViewer

### Construction

`MarkdownViewer` can be constructed with a markdown string directly or left empty and populated later via `go(path)`.

- `open_links=False` disables automatic browser opening for links, same as on `Markdown`.

### Table of Contents

`MarkdownViewer` includes a `MarkdownTableOfContents` sidebar that displays a `Tree` widget derived from the document headings.

- `show_table_of_contents` controls visibility of the sidebar. Setting it to `False` hides the table of contents.
- Headings that contain text resembling Rich markup (e.g., `[i]text[/i]`) or square-bracket patterns (e.g., `[[/test]]`) are escaped and displayed literally in the table of contents.

### File Navigation

`go(path)` loads a markdown file and renders it in the viewer.

- Anchor links within a loaded file (e.g., `[text](filename#anchor)` or `[text](#anchor)`) navigate to the corresponding heading within the same document without raising file-not-found errors.
- Anchor links work both when the viewer was populated from a file via `go()` and when populated from a string at construction time.

## Code Block Syntax Highlighting

`MarkdownFence` (the widget produced by fenced and indented code blocks) applies syntax highlighting via `textual.highlight`.

### Language Detection

`guess_language(code, path)` selects a highlighting language from available signals:

- If `path` has a recognised file extension (e.g. `.py` → `python`, `.xml` → `xml`, `.json` → `json`, `.tcss` → `scss`), the extension determines the language.
- If the code begins with a shebang line that names a language (e.g. `#! python`), the shebang determines the language.
- If neither signal is present (empty code, empty path), the language falls back to `"default"`.
- A path with an extension takes precedence over a shebang line; the extension alone is sufficient even with empty code.

### Applying Highlights

`highlight(code, language)` returns a `Content` object whose `.plain` is the original source text. Highlight spans are overlaid on top: a base span covers the full text, and additional spans apply language-specific token styles (e.g. keyword, name).

## Constraints

- An empty markdown string always produces zero child block widgets.
- `load()` with a non-existent path always raises `FileNotFoundError`.
- `goto_anchor()` always returns a boolean indicating success; it never raises.
- `Markdown.TableOfContentsUpdated` is posted exactly once per content update (initial render counts as one update).
- `Markdown.LinkClicked` is posted for every link click regardless of the `open_links` setting. The `href` preserves the original link target without re-encoding.
- Headings in the table of contents always display literal text; markup-like content is escaped, never interpreted as Rich markup.
- Document structure is always a flat sequence of block-level widgets; nesting only occurs where the markdown spec requires it (e.g., paragraphs inside block quotes or lists).
