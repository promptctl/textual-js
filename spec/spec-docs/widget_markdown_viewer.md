# MarkdownViewer Widget

## Overview

`MarkdownViewer` wraps the `Markdown` widget in a scrollable container (`VerticalScroll`) and adds a sidebar table of contents (via `MarkdownTableOfContents`) plus browser-like navigation with back/forward history. Added in version 0.11.0.

## Widget Characteristics

- Focusable: yes (child-focusable; the inner `Markdown` widget has `can_focus=True`)
- Container: no
- Extends: `VerticalScroll`
- `SCOPED_CSS = False`

## Constructor

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

| Parameter | Description |
|---|---|
| `markdown` | Initial markdown string, or `None` for blank. Forwarded to the inner `Markdown` widget. |
| `show_table_of_contents` | Whether the TOC sidebar is displayed. Defaults to `True`. |
| `parser_factory` | Custom factory returning a configured `MarkdownIt` instance. Forwarded to the inner `Markdown` widget. |
| `open_links` | When `True` (default), clicked links are handled via navigation. Forwarded to the inner `Markdown` widget. |

All parameters except `show_table_of_contents` are forwarded to the inner `Markdown` widget.

## Properties

| Property | Type | Description |
|---|---|---|
| `document` | `Markdown` | The inner `Markdown` widget. |
| `table_of_contents` | `MarkdownTableOfContents` | The sidebar TOC widget. |

## Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `show_table_of_contents` | `bool` | `True` | Toggles the TOC sidebar visibility. Adds/removes the `-show-table-of-contents` CSS class on the viewer. |
| `top_block` | `str` | `""` | Tracks the top visible block within the scrollable area. |

## Messages

### `MarkdownViewer.NavigatorUpdated`

Posted when the navigation stack changes (after `go()`, `back()`, or `forward()` loads a new document). Contains no additional data beyond the standard message attributes.

## Bindings

This widget has no bindings.

## Component Classes

This widget has no component classes.

## Composition

`MarkdownViewer` composes two child widgets:

1. A `Markdown` widget (with `can_focus=True`) -- the main document renderer.
2. A `MarkdownTableOfContents` widget -- docked left, hidden by default CSS unless the `-show-table-of-contents` class is present on the viewer.

## Navigator

`MarkdownViewer` contains a `Navigator` instance (accessible as the `navigator` reactive variable) that maintains a browser-like history stack of visited document paths.

### Navigator Methods

| Method | Description |
|---|---|
| `go(path)` | Navigate to a new path. Truncates forward history. Returns the resolved absolute `Path`. |
| `back()` | Move back in history. Returns `True` if the location changed. |
| `forward()` | Move forward in history. Returns `True` if the location changed. |

### Navigator Properties

| Property | Type | Description |
|---|---|---|
| `location` | `Path` | Current document path (or `Path(".")` if stack is empty). |
| `start` | `bool` | Whether at the beginning of the history stack. |
| `end` | `bool` | Whether at the end of the history stack. |

## Methods

### `go(location: str | PurePath) -> None`

Async. Navigate to a new document. If the location is an anchor-only reference (`#anchor`), scrolls within the current document without loading a new file. Otherwise, loads the file via `Navigator.go()` and posts `NavigatorUpdated`.

### `back() -> None`

Async. Go back one step in history. Loads the previous document if the navigator position changed.

### `forward() -> None`

Async. Go forward one step in history. Loads the next document if the navigator position changed.

## Event Handling

`MarkdownViewer` intercepts and stops (does not bubble) three messages from its inner `Markdown` widget:

| Message | Behavior |
|---|---|
| `Markdown.LinkClicked` | Routed through `go()` for navigation. |
| `Markdown.TableOfContentsUpdated` | Forwarded to the `MarkdownTableOfContents` widget to rebuild the tree. |
| `Markdown.TableOfContentsSelected` | Scrolls the viewer to the selected heading block via `scroll_to_widget(block, top=True)`. |

All three messages are stopped and not bubbled further by `MarkdownViewer`.

## Default CSS

- `height: 1fr`
- `scrollbar-gutter: stable`
- `background: $surface`

The `MarkdownTableOfContents` child is docked left and only visible when the `-show-table-of-contents` class is present on the viewer (controlled by the `show_table_of_contents` reactive attribute).

## MarkdownTableOfContents

The sidebar widget used by `MarkdownViewer` to display a `Tree` of headings.

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
| `table_of_contents` | `TableOfContentsType | None` | `None` | Data used to build the heading tree. Set automatically by `MarkdownViewer`. |

`TableOfContentsType` is `list[tuple[int, str, str | None]]` -- level (1-6), heading text, and the DOM id of the heading block widget (or `None`).

### Behavior

- Composes a `Tree` widget with `show_root=False`, `show_guides=True`, `guide_depth=4`, `auto_expand=False`.
- Heading levels determine tree nesting depth. Level 1 headings are top-level nodes; deeper levels nest under the most recent shallower heading.
- Node labels are prefixed with Roman numeral indicators (from `NUMERALS = " IIIIIIIVVVI"`).
- Selecting a tree node posts `Markdown.TableOfContentsSelected` with the heading's `block_id`.

### Default CSS

- `width: auto`, `height: 1fr`, `background: $panel`.
- Inner `Tree`: `padding: 1`, `width: auto`, `height: 1fr`, `background: $panel`.
