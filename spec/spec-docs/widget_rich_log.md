# RichLog Widget

## Overview

RichLog is a scrollable logging widget that displays Rich renderables and text, with content appended in real time. It extends `ScrollView` and is focusable but not a container.

Unlike the simpler `Log` widget (which handles plain text only), RichLog can display any Rich renderable: tables, syntax-highlighted code, markup text, Pretty-printed objects, and arbitrary objects implementing the Rich protocol.

## Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `max_lines` | `int \| None` | `None` | Maximum number of lines retained. `None` means unlimited. Oldest lines are discarded when exceeded. |
| `min_width` | `int` | `78` | Default rendering width used when `write()` is called without an explicit `width`. |
| `wrap` | `bool` | `False` | Enable word wrapping. When `False`, text overflow is ignored and no wrapping occurs. |
| `highlight` | `bool` | `False` | Automatically highlight content using `self.highlighter` (defaults to `ReprHighlighter`). |
| `markup` | `bool` | `False` | Interpret strings as Rich console markup. |
| `auto_scroll` | `bool` | `True` | Automatically scroll to the end when new content is written. |
| `name` | `str \| None` | `None` | Widget name. |
| `id` | `str \| None` | `None` | Widget DOM ID. |
| `classes` | `str \| None` | `None` | CSS classes. |
| `disabled` | `bool` | `False` | Whether the widget is disabled. |

## Reactive Attributes

All constructor-specific parameters (except `name`, `id`, `classes`, `disabled`) are reactive via `var`:

| Name | Type | Default | Description |
|---|---|---|---|
| `highlight` | `bool` | `False` | Automatically highlight content. |
| `markup` | `bool` | `False` | Apply Rich console markup to strings. |
| `max_lines` | `int \| None` | `None` | Maximum number of lines retained, or `None` for no limit. |
| `min_width` | `int` | `78` | Minimum/default rendering width. |
| `wrap` | `bool` | `False` | Enable word wrapping. |
| `auto_scroll` | `bool` | `True` | Auto-scroll to end on write. |

## Instance Attributes

| Name | Type | Description |
|---|---|---|
| `lines` | `list[Strip]` | The rendered lines currently stored in the log. |
| `highlighter` | `Highlighter` | The Rich `Highlighter` instance used when `highlight=True`. Defaults to `ReprHighlighter`. Replace with any `Highlighter` subclass to customize. |

## Methods

### `write(content, width=None, expand=False, shrink=True, scroll_end=None, animate=False) -> Self`

Appends content to the bottom of the log.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `content` | `RenderableType \| object` | (required) | A string, Rich renderable, or arbitrary object. Non-renderable objects are wrapped in `Pretty()`. |
| `width` | `int \| None` | `None` | Explicit rendering width. When specified, `expand`, `shrink`, and `min_width` are all ignored. When `None`, uses `min_width` as a floor. |
| `expand` | `bool` | `False` | Allow content to expand to the widget's content region width. Ignored if `width` is set. |
| `shrink` | `bool` | `True` | Allow content to shrink to fit within the widget's content region width. Ignored if `width` is set. |
| `scroll_end` | `bool \| None` | `None` | Scroll to end after writing. `None` defers to `self.auto_scroll`. |
| `animate` | `bool` | `False` | Animate the scroll if scrolling occurs. |

Returns the `RichLog` instance (supports method chaining).

#### Width Resolution

When `width` is not specified, the effective render width is determined by:

1. Measure the renderable's natural width.
2. If `expand=True` and natural width is less than the scrollable content region, expand to the region width.
3. If `shrink=True` and natural width exceeds the scrollable content region, shrink to the region width.
4. Apply `min_width` as a floor.

#### Deferred Rendering

Calls to `write()` before the widget's size is known (e.g., during `compose` or `on_mount`) are queued internally. Once the first `Resize` event arrives and the size becomes known, all deferred writes are replayed in order. This preserves write ordering regardless of timing.

#### Content Handling

- **Strings**: Converted to `Text`. If `markup=True`, parsed as Rich markup via `Text.from_markup`. If `highlight=True`, the `highlighter` is applied.
- **Rich renderables**: Used directly (tables, syntax blocks, panels, etc.).
- **Non-renderable objects**: Wrapped in `Pretty()` for automatic pretty-printing.
- **Text objects**: Tabs are always expanded via `expand_tabs()`.

### `clear() -> Self`

Clears all content from the log, including any pending deferred renders. Resets virtual size to zero. Returns the `RichLog` instance.

## Line Trimming (`max_lines`)

When `max_lines` is set and a `write()` causes the total line count to exceed the limit, the oldest lines are removed to bring the count back to `max_lines`. An internal `_start_line` offset tracks the logical line index for cache key purposes.

## Default CSS

```css
RichLog {
    background: $surface;
    color: $foreground;
    overflow-y: scroll;
    &:focus {
        background-tint: $foreground 5%;
    }
}
```

## Messages

This widget sends no messages.

## Bindings

This widget defines no bindings. Scrolling is inherited from `ScrollView`.

## Component Classes

This widget defines no component classes.

## Caching

Rendered lines are cached in an LRU cache (capacity 1024). Cache keys incorporate the line index, scroll offset, width, and widest line width. The cache is cleared on style updates and on `clear()`.

## Usage Patterns

### Writing Different Content Types

```python
rich_log = self.query_one(RichLog)

# Plain string
rich_log.write("Hello, world!")

# Rich markup (requires markup=True)
rich_log.write("[bold magenta]Styled text!")

# Rich Table
table = Table("Name", "Value")
table.add_row("foo", "bar")
rich_log.write(table)

# Syntax-highlighted code
rich_log.write(Syntax(code, "python"))

# Arbitrary objects (auto-wrapped in Pretty)
rich_log.write(some_dict)
```

### Custom Highlighter

```python
rich_log = RichLog(highlight=True)
rich_log.highlighter = MyCustomHighlighter()
```

### Logging Events

```python
def on_key(self, event: events.Key) -> None:
    self.query_one(RichLog).write(event)
```
