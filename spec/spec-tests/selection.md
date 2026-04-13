# Selection

Text selection behavior in Textual, provided by the `Selection` class.

## Overview

A `Selection` represents a range of text defined by a start and end `Offset`. It can extract substrings from text content based on those offsets. Selections operate across single-line and multi-line text, and support double-width characters (e.g., emoji).

### Construction

A `Selection` is constructed with two optional `Offset` values: a start and an end. Either or both may be `None`, indicating the beginning or end of the text respectively.

- `Selection(None, None)` -- selects the entire text.
- `Selection(Offset(x, y), None)` -- selects from the given offset to the end of the text.
- `Selection(None, Offset(x, y))` -- selects from the beginning of the text to the given offset.
- `Selection(Offset(x1, y1), Offset(x2, y2))` -- selects the range between the two offsets.

### Extracting Text

`Selection.extract(text)` returns the substring of `text` covered by the selection.

- When both start and end are `None`, the full text is returned (single-line or multi-line).
- When only start is set, text from that offset through the end is returned. For example, `Selection(Offset(0, 1), None)` on `"Hello\nWorld"` yields `"World"`.
- When only end is set, text from the beginning up to that offset is returned. For example, `Selection(None, Offset(5, 0))` on `"Hello\nWorld"` yields `"Hello"`.
- When both are set, the bounded substring is returned. Offsets use `(column, row)` coordinates. For example, `Selection(Offset(0, 0), Offset(2, 0))` on `"Foo"` yields `"Fo"`.

### Double-Width Character Support

Selection works correctly with double-width and multi-codepoint characters such as emoji. A mouse-driven selection (mouse_down to mouse_up) across content containing emoji produces the expected text, with double-width characters treated as occupying two columns.

### Screen-Level Selection via Mouse

The screen exposes `get_selected_text()` to retrieve the currently selected text. A selection is created by a `mouse_down` at one offset and a `mouse_up` at another offset, spanning across widget content rendered on screen.

## Constraints

- Offsets use `(column, row)` ordering (matching `textual.geometry.Offset`).
- A `None` start means "beginning of text"; a `None` end means "end of text".
- Selections must handle multi-line text (newline-delimited) and double-width characters correctly.
- Screen-level selection is retrieved via `Screen.get_selected_text()`, not directly from the `Selection` object.
