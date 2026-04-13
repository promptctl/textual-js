# RichLog

`RichLog` (formerly `TextLog`) is a scrollable widget for writing text and Rich renderables to an append-style log.

## Behaviors

### Writing Content

`RichLog.write()` appends a renderable or string to the log. It accepts:

- Plain strings, which are converted to `rich.text.Text` objects with tab expansion (tabs expand to 8 spaces).
- Rich renderables such as `Text`, `Panel`, or any object Rich can render.
- An `expand` keyword that, when `True`, causes the renderable to fill the full width of the RichLog.
- A `width` keyword that renders the content at a specific width, independent of the widget's actual width.
- A `scroll_end` keyword that, when set to `False`, prevents auto-scrolling to the end after the write even if `auto_scroll` is enabled.

Writing can happen before the widget is mounted (e.g., during `compose`). These writes are deferred and rendered once the widget's size is known.

### Markup

When `markup=True` is passed at construction, strings written via `write()` are interpreted as Rich markup (e.g., `[bold]text[/bold]`). When `markup` is not enabled, strings are treated as literal text.

### Highlighting

When `highlight=True` is passed at construction, written strings are processed by a `ReprHighlighter` to apply syntax-aware styling to values like numbers, strings, and brackets.

### Blank Writes

Writing an empty string (`""`) to the log produces a blank line in the output. The sequence `write("Hello")`, `write("")`, `write("World")` results in three lines with a visible gap between "Hello" and "World".

### Max Lines

The `max_lines` constructor parameter caps the number of lines retained in the log. When new content would exceed this limit, the oldest lines are removed. This bounds memory usage for long-running logs.

### Scrolling

`auto_scroll` is a constructor parameter that controls whether the log automatically scrolls to the bottom when new content is written.

- `auto_scroll=True` (the default): the log scrolls to the end after each `write()`.
- `auto_scroll=False`: the log stays at its current scroll position after writes.
- Per-write override: `write(content, scroll_end=False)` suppresses scrolling for that individual write, even when `auto_scroll=True`.

### Min Width

The `min_width` constructor parameter sets a minimum rendering width for content. When the available widget space is narrower than `min_width`, content is rendered at `min_width` and clips at the widget edge. When no explicit `width` is passed to `write()`, content without `expand=True` falls back to rendering at `min_width`.

### Shrink

Content written to a `RichLog` shrinks to fit the widget width. Renderables like `Panel` that have an intrinsic width are constrained to the available space.

### Print Capture

`begin_capture_print()` redirects Python `print()` output into the RichLog. `end_capture_print()` stops the capture. Captured text arrives via `events.Print` and must be handled by writing it to the log (e.g., in an `on_print` handler).

### Disabled State

A `RichLog` can be constructed with `disabled=True`. Content can still be written to a disabled RichLog via `write()`.

## Log Widget

The `Log` widget is a simpler text log widget (distinct from `RichLog`).

### Line Processing

- `Log._process_line(line)` prepares a line for display.
- Tab characters are expanded to spaces using tab stops (e.g., `"foo\t"` becomes `"foo     "`, padding to the next 8-column boundary).
- Null characters (`\0`) are replaced with the Unicode replacement character (`�`).

### Construction

- `Log` can be constructed with `disabled=True` without raising `AttributeError`. The disabled log is still a valid widget instance with `disabled == True`.

## Constraints

- `RichLog` is append-only through `write()`. There is no API to insert content at arbitrary positions.
- Tab characters in strings are expanded to 8 spaces during the conversion to `Text`.
- Deferred writes (before mount) rely on `min_width` as a fallback rendering width until the true size is known.
- `max_lines` operates on rendered lines, pruning the oldest content when the cap is exceeded.
- `auto_scroll` and `scroll_end` interact: `scroll_end=False` on a single write overrides the widget-level `auto_scroll=True` for that write only.
- Markup interpretation and highlighting are set at construction time and apply uniformly to all `write()` calls.
- `Log._process_line` must replace null characters with `�` and expand tabs to proper column alignment.
- Constructing `Log(disabled=True)` must not raise any exceptions.
