# Markdown and MarkdownViewer Widgets

## Overview

The `Markdown` widget renders a Markdown document as a collection of child widgets (one per block element). It supports GFM-like syntax via `markdown-it`, produces a table of contents from headings, supports link handling, code fence syntax highlighting, and incremental streaming of markdown content.

`MarkdownViewer` wraps `Markdown` in a scrollable container and adds a sidebar table of contents (via `MarkdownTableOfContents`) plus browser-like navigation (back/forward history).

Both widgets were added in version 0.11.0.

## Markdown

### Widget Characteristics

- Not focusable by default
- Not a container
- Layout: vertical
- Default padding: `0 2 0 2`
- Uses `markdown-it` with `"gfm-like"` preset by default

### Constructor

```python
Markdown(
    markdown: str | None = None,
    *,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    parser_factory: Callable[[], MarkdownIt] | None = None,
    open_links: bool = True,
)
```

| Parameter | Description |
|---|---|
| `markdown` | Initial markdown string, or `None` for blank. Rendered on mount. |
| `parser_factory` | Custom factory returning a configured `MarkdownIt` instance. Defaults to `MarkdownIt("gfm-like")`. |
| `open_links` | When `True` (default), clicked links are opened via `app.open_url`. When `False`, only the `LinkClicked` message is posted. |

### Properties

| Property | Type | Description |
|---|---|---|
| `source` | `str` | The current markdown source text (read-only). |
| `table_of_contents` | `TableOfContentsType` | List of `(level, label, block_id)` tuples derived from headings. Lazily computed and cached; invalidated on `update()` or `append()`. |

`TableOfContentsType` is `list[tuple[int, str, str | None]]` -- level (1-6), heading text, and the DOM id of the heading block widget (or `None`).

### Reactive Attributes

None.

### Messages

#### `Markdown.TableOfContentsUpdated`

Posted after `update()` or `append()` completes (when headings change). Contains:

| Attribute | Type | Description |
|---|---|---|
| `markdown` | `Markdown` | The Markdown widget that was updated. |
| `table_of_contents` | `TableOfContentsType` | The new table of contents data. |
| `control` | `Markdown` | Alias for `markdown` (used by the `on` decorator). |

#### `Markdown.TableOfContentsSelected`

Posted when an item in a `MarkdownTableOfContents` tree is selected. Contains:

| Attribute | Type | Description |
|---|---|---|
| `markdown` | `Markdown` | The Markdown widget containing the heading. |
| `block_id` | `str` | DOM id of the selected heading block. |
| `control` | `Markdown` | Alias for `markdown`. |

#### `Markdown.LinkClicked`

Posted when a link in the rendered document is clicked. Contains:

| Attribute | Type | Description |
|---|---|---|
| `markdown` | `Markdown` | The Markdown widget containing the link. |
| `href` | `str` | The URL-decoded link target. |
| `control` | `Markdown` | Alias for `markdown`. |

When `open_links=True`, the default handler calls `app.open_url(href)`. Set `open_links=False` to intercept and handle links manually.

### Methods

#### `update(markdown: str) -> AwaitComplete`

Replace the entire document. Removes all existing blocks and mounts new ones in batches (batch size 200). Posts `TableOfContentsUpdated` when complete. Returns an `AwaitComplete` that can be awaited to ensure all children are mounted.

#### `append(markdown: str) -> AwaitComplete`

Append a markdown fragment to the existing document. Parses only the new content from the last parsed line onward. Updates the last block in-place if possible (e.g., extending a paragraph), then mounts new blocks. Posts `TableOfContentsUpdated` only if new headings were added. Returns an `AwaitComplete`.

#### `load(path: Path) -> None`

Async method. Reads a file from disk (via executor to avoid blocking) and calls `update()`. Supports `path#anchor` syntax -- after loading, navigates to the anchor if present. Raises `OSError` on file read failure.

#### `goto_anchor(anchor: str) -> bool`

Scroll to a heading matching the given anchor slug. Returns `True` if found, `False` otherwise. Uses GitHub-like slugging.

#### `get_stream(markdown: Markdown) -> MarkdownStream` (classmethod)

Returns a `MarkdownStream` that batches rapid `append()` calls. Useful when streaming content (e.g., from a network source) faster than the widget can render. The stream runs as a background `asyncio.Task`.

#### `unhandled_token(token: Token) -> MarkdownBlock | None`

Override point for subclasses. Called when the parser encounters a token type not in the `BLOCKS` mapping. Return a `MarkdownBlock` to include it in the output, or `None` to skip.

#### `sanitize_location(location: str) -> tuple[Path, str]` (staticmethod)

Splits a location string at `#` into `(path, anchor)`. Returns `(Path(location), "")` when no anchor is present.

#### `get_block_class(block_name: str) -> type[MarkdownBlock]`

Look up a block widget class by name from the `BLOCKS` mapping.

### BLOCKS Mapping

The `BLOCKS` class variable maps token names to widget classes. Override entries to customize rendering:

| Key | Default Class |
|---|---|
| `h1` through `h6` | `MarkdownH1` through `MarkdownH6` |
| `hr` | `MarkdownHorizontalRule` |
| `paragraph_open` | `MarkdownParagraph` |
| `blockquote_open` | `MarkdownBlockQuote` |
| `bullet_list_open` | `MarkdownBulletList` |
| `ordered_list_open` | `MarkdownOrderedList` |
| `list_item_ordered_open` | `MarkdownOrderedListItem` |
| `list_item_unordered_open` | `MarkdownUnorderedListItem` |
| `table_open` | `MarkdownTable` |
| `tbody_open` | `MarkdownTBody` |
| `thead_open` | `MarkdownTHead` |
| `tr_open` | `MarkdownTR` |
| `th_open` | `MarkdownTH` |
| `td_open` | `MarkdownTD` |
| `fence` | `MarkdownFence` |
| `code_block` | `MarkdownFence` |

### BULLETS

`BULLETS = ["* ", "# ", "$ ", "& ", "@ "]` -- Unicode bullet characters cycled for nested unordered lists: `"* "`, `"# "`, `"$ "`, `"& "`, `"@ "`.

Actual values: `["* ", "\u25aa ", "\u2023 ", "\u2b51 ", "\u25e6 "]`.

### Component Classes

Defined on `MarkdownBlock` (the base class for all rendered blocks):

| Class | Description |
|---|---|
| `code_inline` | Inline code spans. Dark theme: warning-tinted background. Light theme: error-tinted background. |
| `em` | Emphasized (italic) text. |
| `strong` | Strong (bold) text. |
| `s` | Strikethrough text. |

## MarkdownBlock Hierarchy

All rendered elements are subclasses of `MarkdownBlock` (which extends `Static`). Each block holds a weak reference to its parent `Markdown` widget.

### Key Properties on MarkdownBlock

| Property | Type | Description |
|---|---|---|
| `source` | `str | None` | The original markdown source lines for this block, sliced from the parent's `source`. |
| `source_range` | `tuple[int, int]` | Start and end line numbers in the source document. |

### Header Classes

`MarkdownHeader` is the base for `MarkdownH1` through `MarkdownH6`. Each has a `LEVEL` class variable (1-6). Headers are themed via CSS design tokens:

- `$markdown-h{N}-color`
- `$markdown-h{N}-background`
- `$markdown-h{N}-text-style`

H1 is center-aligned by default. H3-H6 have `margin: 1 0`.

Heading block ids are generated as `heading-{slug}-{id(block)}` for DOM querying and anchor navigation.

### MarkdownFence

Renders fenced code blocks with syntax highlighting (via `textual.highlight.highlight`). Stores `.code` (raw text) and `.lexer` (language identifier from the info string). Scrollable horizontally. Contains a `Label` child with id `#code-content`.

### MarkdownTable

Renders GFM tables using a grid layout. Columns are sized from the `MarkdownTHead` cells. Contains `MarkdownTHead`, `MarkdownTBody`, `MarkdownTR`, `MarkdownTH`, and `MarkdownTD` sub-blocks.

### MarkdownBlockQuote

Renders blockquotes with a left border, boosted background, and left padding/margin.

### List Classes

- `MarkdownBulletList` / `MarkdownOrderedList` -- containers for list items.
- `MarkdownUnorderedListItem` -- prefixed with a cycling Unicode bullet from `BULLETS`.
- `MarkdownOrderedListItem` -- prefixed with the item number from the token's `info` field.

## MarkdownStream

Manages streaming markdown content to a `Markdown` widget. Created via `Markdown.get_stream()`.

### Methods

| Method | Description |
|---|---|
| `start()` | Start the background update task. Called automatically by `get_stream()`. |
| `stop()` | Cancel the background task, flush remaining content, and prevent further writes. |
| `write(markdown_fragment: str)` | Enqueue a markdown fragment. Fragments are batched and flushed together when the event loop yields. |

Writing to a stopped stream raises `RuntimeError`. Empty strings are silently ignored.

### Batching Behavior

The stream accumulates pending fragments and processes them in bulk. If `write()` is called multiple times before the event loop processes the task, all pending fragments are joined and passed to `Markdown.append()` as a single call. This prevents UI lag when content arrives faster than rendering (around 20+ appends per second).

## MarkdownTableOfContents

A sidebar widget that displays a `Tree` of headings from a `Markdown` document.

### Constructor

```python
MarkdownTableOfContents(
    markdown: Markdown,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

### Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `table_of_contents` | `TableOfContentsType | None` | `None` | Data used to build the tree. Set automatically by `MarkdownViewer`. |

### Behavior

- Composes a `Tree` widget with `show_root=False`, `show_guides=True`, `guide_depth=4`, `auto_expand=False`.
- Heading levels determine tree nesting depth. Level 1 headings are top-level nodes; deeper levels nest under the most recent shallower heading.
- Node labels are prefixed with Roman numeral indicators (from `NUMERALS = " IIIIIIIVVVI"`).
- Selecting a tree node posts `Markdown.TableOfContentsSelected` with the heading's `block_id`.

### Default CSS

- `width: auto`, `height: 1fr`, `background: $panel`.
- Inner `Tree`: `padding: 1`, `width: auto`, `height: 1fr`, `background: $panel`.

## MarkdownViewer

### Widget Characteristics

- Focusable: child-focusable (the inner `Markdown` widget has `can_focus=True`)
- Extends `VerticalScroll`
- `SCOPED_CSS = False`
- Background: `$surface`

### Constructor

```python
MarkdownViewer(
    markdown: str | None = None,
    *,
    show_table_of_contents: bool = True,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    parser_factory: Callable[[], MarkdownIt] | None = None,
    open_links: bool = True,
)
```

All parameters are forwarded to the inner `Markdown` widget except `show_table_of_contents`.

### Properties

| Property | Type | Description |
|---|---|---|
| `document` | `Markdown` | The inner `Markdown` widget. |
| `table_of_contents` | `MarkdownTableOfContents` | The sidebar TOC widget. |

### Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `show_table_of_contents` | `bool` | `True` | Toggles the TOC sidebar. Adds/removes the `-show-table-of-contents` CSS class. |
| `top_block` | `str` | `""` | Tracks the top visible block. |

### Navigator

`MarkdownViewer` contains a `Navigator` instance (accessible as `navigator` reactive var) that maintains a browser-like history stack of visited document paths.

#### Navigator Methods

| Method | Description |
|---|---|
| `go(path)` | Navigate to a new path. Truncates forward history. Returns the resolved absolute `Path`. |
| `back()` | Move back in history. Returns `True` if location changed. |
| `forward()` | Move forward in history. Returns `True` if location changed. |

#### Navigator Properties

| Property | Type | Description |
|---|---|---|
| `location` | `Path` | Current document path (or `Path(".")` if stack is empty). |
| `start` | `bool` | Whether at the beginning of the history stack. |
| `end` | `bool` | Whether at the end of the history stack. |

### Methods

#### `go(location: str | PurePath) -> None`

Async. Navigate to a new document. If the location is an anchor-only reference (`#anchor`), scrolls within the current document. Otherwise, loads the file via `Navigator.go()` and posts `NavigatorUpdated`.

#### `back() -> None`

Async. Go back one step in history. Loads the previous document if the navigator position changed.

#### `forward() -> None`

Async. Go forward one step in history. Loads the next document if the navigator position changed.

### Messages

#### `MarkdownViewer.NavigatorUpdated`

Posted when the navigation stack changes (after `go()`, `back()`, or `forward()` loads a new document). Contains no additional data.

### Composition

`MarkdownViewer` composes:
1. A `Markdown` widget (with `can_focus=True`)
2. A `MarkdownTableOfContents` widget (docked left, hidden by default CSS unless `-show-table-of-contents` class is present)

### Event Handling

- `Markdown.LinkClicked` is intercepted and routed through `go()` for navigation.
- `Markdown.TableOfContentsUpdated` is intercepted and forwarded to the `MarkdownTableOfContents` widget.
- `Markdown.TableOfContentsSelected` is intercepted; the viewer scrolls to the selected heading block with `scroll_to_widget(block, top=True)`.

All three messages are stopped (not bubbled further) by `MarkdownViewer`.

## CSS Theming

### Markdown Design Tokens

Header colors and styles are controlled by theme design tokens:

- `$markdown-h1-color`, `$markdown-h1-background`, `$markdown-h1-text-style`
- `$markdown-h2-color`, `$markdown-h2-background`, `$markdown-h2-text-style`
- Through `$markdown-h6-color`, `$markdown-h6-background`, `$markdown-h6-text-style`

### Key Default Styles

- `Markdown`: `height: auto`, `padding: 0 2`, `color: $foreground`, `overflow-y: hidden`.
- `MarkdownBlock`: `width: 1fr`, `height: auto`.
- `MarkdownHeader`: `color: $text`, `margin: 2 0 1 0`.
- `MarkdownParagraph` (under `Markdown`): `margin: 0 0 1 0`.
- `MarkdownBlockQuote`: `background: $boost`, `border-left: outer $text-primary 50%`, `margin: 1 0`, `padding: 0 1`.
- `MarkdownHorizontalRule`: `border-bottom: solid $secondary`, `height: 1`.
- `MarkdownFence`: `margin: 1 0`, horizontal scroll enabled, `background: black 10%` (dark) / `white 30%` (light).
- `MarkdownViewer`: `height: 1fr`, `scrollbar-gutter: stable`, `background: $surface`.
- `MarkdownTableOfContents`: `width: auto`, `height: 1fr`, `background: $panel`, docked left (controlled by `-show-table-of-contents` class).

## Customization Patterns

### Custom Parser

Supply a `parser_factory` to use a different `markdown-it` configuration (e.g., enabling plugins):

```python
from markdown_it import MarkdownIt

def my_parser():
    return MarkdownIt("commonmark").enable("table")

Markdown(parser_factory=my_parser)
```

### Custom Block Rendering

Subclass `Markdown` and override entries in `BLOCKS` to replace how specific elements render:

```python
class MyMarkdown(Markdown):
    BLOCKS = {**Markdown.BLOCKS, "fence": MyCustomFence}
```

### Handling Unrecognized Tokens

Override `unhandled_token()` to handle token types not in the `BLOCKS` mapping:

```python
class MyMarkdown(Markdown):
    def unhandled_token(self, token):
        if token.type == "my_plugin_token":
            return MyPluginBlock(self, token)
        return None
```

### Intercepting Links

Set `open_links=False` and handle `LinkClicked`:

```python
class MyApp(App):
    def compose(self):
        yield Markdown(open_links=False)

    def on_markdown_link_clicked(self, event: Markdown.LinkClicked):
        # Custom link handling
        self.notify(f"Link: {event.href}")
```
