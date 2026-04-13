# Log Widget Spec

## Purpose

The `Log` widget displays lines of plain text that may be appended to in real time. It is a lightweight, high-performance text log built on `ScrollView`. For rich content (renderables, markup, etc.), use `RichLog` instead.

- Focusable: Yes
- Container: No
- Added in: v0.32.0

## Inheritance

`Log` extends `ScrollView` (which extends `Widget`). It inherits scrolling behavior, virtual size management, and the `ScrollView` rendering pipeline.

## Constructor

```python
Log(
    highlight: bool = False,
    max_lines: int | None = None,
    auto_scroll: bool = True,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

| Parameter     | Type           | Default | Description                                      |
|---------------|----------------|---------|--------------------------------------------------|
| `highlight`   | `bool`         | `False` | Enable syntax highlighting via `ReprHighlighter`. |
| `max_lines`   | `int \| None`  | `None`  | Maximum number of lines to retain, or `None` for unlimited. |
| `auto_scroll` | `bool`         | `True`  | Scroll to end when new lines are added.          |
| `name`        | `str \| None`  | `None`  | Widget name.                                     |
| `id`          | `str \| None`  | `None`  | Widget DOM ID.                                   |
| `classes`     | `str \| None`  | `None`  | CSS classes.                                     |
| `disabled`    | `bool`         | `False` | Whether the widget is disabled.                  |

**Note:** The docs list `auto_scroll` default as `False`, but the source code default is `True`. The source is authoritative.

## Reactive Attributes

| Name          | Type           | Default | Description                                                  |
|---------------|----------------|---------|--------------------------------------------------------------|
| `max_lines`   | `int \| None`  | `None`  | Maximum number of lines retained. `None` means no limit. When set, excess lines are pruned from the top. |
| `auto_scroll` | `bool`         | `True`  | Automatically scroll to the end when new lines are written.  |

## Instance Attributes

| Name          | Type            | Description                                                  |
|---------------|-----------------|--------------------------------------------------------------|
| `highlight`   | `bool`          | Whether highlighting is enabled.                             |
| `highlighter` | `Highlighter`   | The Rich `Highlighter` instance used when `highlight=True`. Defaults to `ReprHighlighter`. Can be replaced with any Rich highlighter. |

## Properties

| Name         | Type             | Description                                        |
|--------------|------------------|----------------------------------------------------|
| `lines`      | `Sequence[str]`  | Read-only access to the raw lines stored in the log. Mutating the returned sequence does **not** update the display. |
| `line_count` | `int`            | Number of content lines (excludes trailing empty line from internal bookkeeping). |

## Methods

### `write(data: str, scroll_end: bool | None = None) -> Self`

Write arbitrary string data to the log. The data may contain newlines; they will be split into separate lines. Partial lines (no trailing newline) are buffered and appended to on subsequent writes.

- `scroll_end`: Override `auto_scroll` for this call. `None` uses the reactive attribute.
- Returns: The `Log` instance (supports chaining).

### `write_line(line: str, scroll_end: bool | None = None) -> Self`

Write a single line of text. Delegates to `write_lines`.

- `scroll_end`: Override `auto_scroll` for this call.
- Returns: The `Log` instance.

### `write_lines(lines: Iterable[str], scroll_end: bool | None = None) -> Self`

Write multiple lines at once. Each string in the iterable is split on its own newlines, so embedded newlines produce additional lines.

- `scroll_end`: Override `auto_scroll` for this call.
- Auto-scroll behavior: scrolls to end only if `auto_scroll` is true (or `scroll_end` overrides it), the user is not grabbing the vertical scrollbar, and the view was already scrolled to the end before the write.
- Returns: The `Log` instance.

### `clear() -> Self`

Remove all lines from the log and reset virtual size to zero.

- Returns: The `Log` instance.

### `refresh_lines(y_start: int, line_count: int = 1) -> None`

Invalidate the render cache for a range of lines, then call the parent `refresh_lines`.

### `get_selection(selection: Selection) -> tuple[str, str] | None`

Extract text under the given selection. Returns `(text, "\n")` or `None`.

### `render_line(y: int) -> Strip`

Render a single visible line at viewport coordinate `y`, accounting for scroll offset.

## Text Selection

`Log` supports text selection (`ALLOW_SELECT = True`). Selected text is styled with the `screen--selection` component class from the active screen.

## Line Processing

All lines are processed before rendering:
- Tabs are expanded via `str.expandtabs()`.
- Control characters (`\u0000`–`\u0014`) are replaced with the replacement character `�`.

## Max Lines Pruning

When `max_lines` is set and the line count exceeds it, the oldest lines are removed from the top. The internal render cache is re-keyed to match the new line indices.

## Messages

This widget posts no messages.

## Bindings

This widget defines no bindings.

## Component Classes

This widget defines no component classes.

## Default CSS

```css
Log {
    background: $surface;
    color: $text;
    overflow: scroll;
    &:focus {
        background-tint: $foreground 5%;
    }
}
```

## Usage Patterns

### Basic usage

```python
from textual.app import App, ComposeResult
from textual.widgets import Log

class MyApp(App):
    def compose(self) -> ComposeResult:
        yield Log()

    def on_ready(self) -> None:
        log = self.query_one(Log)
        log.write_line("Hello, World!")
```

### Streaming data with `write()`

Use `write()` for data that arrives in chunks without guaranteed line boundaries (e.g., streaming subprocess output). Partial lines are buffered until a newline arrives.

### Limiting memory with `max_lines`

```python
Log(max_lines=1000)
```

Keeps only the most recent 1000 lines, pruning from the top.

### Custom highlighter

```python
from rich.highlighter import RegexHighlighter

log = Log(highlight=True)
log.highlighter = MyCustomHighlighter()
```

### Method chaining

All write and clear methods return `Self`, supporting chaining:

```python
log.clear().write_line("Reset").write_line("Fresh start")
```
