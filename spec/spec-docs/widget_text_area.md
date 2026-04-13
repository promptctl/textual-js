# TextArea Widget Spec

## Purpose

`TextArea` is a multi-line text editing widget supporting text selection, soft wrapping, optional syntax highlighting via tree-sitter, undo/redo, and configurable key bindings. It is focusable but not a container.

## Constructors

### `TextArea(...)`

Default multi-line input with soft wrapping enabled.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `text` | `str` | `""` | Initial text content |
| `language` | `str \| None` | `None` | Language for syntax highlighting |
| `theme` | `str` | `"css"` | Theme name |
| `soft_wrap` | `bool` | `True` | Enable soft wrapping |
| `tab_behavior` | `Literal["focus", "indent"]` | `"focus"` | Tab key behavior |
| `read_only` | `bool` | `False` | Prevent keyboard edits |
| `show_cursor` | `bool` | `True` | Show cursor in read-only mode |
| `show_line_numbers` | `bool` | `False` | Show gutter with line numbers |
| `line_number_start` | `int` | `1` | Starting line number in gutter |
| `max_checkpoints` | `int` | `50` | Max undo history checkpoints |
| `compact` | `bool` | `False` | Compact style (no borders) |
| `highlight_cursor_line` | `bool` | `True` | Highlight cursor line |
| `placeholder` | `str \| Content` | `""` | Placeholder text when empty |

### `TextArea.code_editor(...)`

Classmethod convenience constructor with code-editing defaults: soft wrapping off, line numbers on, tab inserts `\t`, theme `"monokai"`.

## Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `language` | `str \| None` | `None` | Language for syntax highlighting |
| `theme` | `str` | `"css"` | Active theme name |
| `selection` | `Selection` | `Selection()` | Current selection (start, end) |
| `show_line_numbers` | `bool` | `False` | Toggle line number gutter |
| `line_number_start` | `int` | `1` | Starting line number |
| `indent_width` | `int` | `4` | Spaces per indent / tab width |
| `match_cursor_bracket` | `bool` | `True` | Highlight matching bracket |
| `cursor_blink` | `bool` | `True` | Cursor blink when focused |
| `soft_wrap` | `bool` | `True` | Soft wrapping |
| `read_only` | `bool` | `False` | Read-only mode |

## Instance Attributes

| Name | Type | Description |
|---|---|---|
| `indent_type` | `Literal["tabs", "spaces"]` | Whether to indent with tabs or spaces |
| `history` | `EditHistory` | Undo/redo history stack |

## Properties

- `text` -- All content as a string (read/write). Setting replaces all content.
- `selected_text` -- Text within the current selection.
- `cursor_location` -- Tuple `(row, col)` of cursor position (read/write). Equivalent to `selection.end`.
- `cursor_at_start_of_line`, `cursor_at_end_of_line`, etc. -- Boolean cursor position queries.
- `available_themes` -- Set of registered theme names.
- `document` -- The underlying `Document` instance. `document.end` gives the end location; `document.newline` gives the detected line separator.

## Reading Content

- `text` property returns the full document text.
- `selected_text` property returns text within the current selection.
- `get_text_range(start, end)` returns text between two `(row, col)` locations.
- Multi-line reads use the document's line separator.

## Editing Content

- `replace(text, start, end)` -- Replace a range (programmatic equivalent of select-then-paste).
- `insert(text, location)` -- Insert text at a location.
- `delete(start, end)` -- Delete a range.
- `clear()` -- Remove all content.

## Selection

`Selection` has `start` and `end` attributes, each a `(row, col)` tuple. Selections can go in either direction (`start` may be after `end`). The `end` always equals `cursor_location`.

- `move_cursor(location, select=False)` -- Move cursor, optionally extending selection.
- `move_cursor_relative(rows, columns, select=False)` -- Move cursor relative to current position.
- `select_line(index)` -- Select an entire line by index.
- `select_all()` -- Select all text.
- `get_cursor_right_location()`, `get_cursor_left_location()`, etc. -- Preview where cursor would land.

## Messages

### `TextArea.Changed`

Posted when content changes. Attributes:
- `text_area` -- The `TextArea` instance that changed.

### `TextArea.SelectionChanged`

Posted when selection or cursor position changes. Attributes:
- `selection` -- The new `Selection`.
- `text_area` -- The `TextArea` instance.

## Key Bindings

### Cursor Movement

| Key | Action |
|---|---|
| Up | Move cursor up |
| Down | Move cursor down |
| Left | Move cursor left |
| Right | Move cursor right |
| Ctrl+Left | Move cursor word left |
| Ctrl+Right | Move cursor word right |
| Home / Ctrl+A | Move to line start |
| End / Ctrl+E | Move to line end |
| PageUp | Page up |
| PageDown | Page down |

### Selection (Shift modifiers)

| Key | Action |
|---|---|
| Shift+Up | Select upward |
| Shift+Down | Select downward |
| Shift+Left | Select left |
| Shift+Right | Select right |
| Ctrl+Shift+Left | Select word left |
| Ctrl+Shift+Right | Select word right |
| Shift+Home | Select to line start |
| Shift+End | Select to line end |
| F6 | Select line |
| F7 | Select all |

### Editing

| Key | Action |
|---|---|
| Backspace | Delete character left |
| Delete / Ctrl+D | Delete character right |
| Ctrl+W | Delete word left |
| Ctrl+F | Delete word right |
| Ctrl+U | Delete to line start |
| Ctrl+K | Delete to line end (or delete line if empty) |
| Ctrl+Shift+K | Delete entire line |

### Clipboard

| Key | Action |
|---|---|
| Ctrl+X | Cut |
| Ctrl+C / Super+C | Copy |
| Ctrl+V | Paste |

### Undo/Redo

| Key | Action |
|---|---|
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |

## Tab and Escape Behavior

- `tab_behavior="focus"` (default): Tab moves focus to next widget.
- `tab_behavior="indent"`: Tab inserts indentation; Escape moves focus.

`indent_type` controls whether tab inserts `\t` or spaces. When `indent_type="spaces"`, Tab inserts up to `indent_width` spaces to align to the next tab stop.

## Undo and Redo

- `undo()` and `redo()` methods.
- Checkpoints are placed heuristically after certain edit types.
- `history.checkpoint()` adds a manual checkpoint.
- `max_checkpoints` constructor parameter caps the undo stack depth (default 50).
- `EditHistory` uses a stack-based system where each stack item represents one checkpoint.

## Read-Only Mode

- `read_only=True` prevents keyboard edits; programmatic edits still work.
- When active, the widget receives the `-read-only` CSS class for custom styling.

## Themes

### Built-in Themes

Available via `available_themes` property: `css`, `dracula`, `github_light`, `monokai`, `vscode_dark`.

- `"css"` (default): Derives all styling from CSS/component classes. Works with both dark and light modes.
- Other themes (e.g., `"monokai"`) use `TextAreaTheme` objects with explicit style values.

### Custom Themes

1. Create a `TextAreaTheme` instance with `name`, optional `cursor_style`, `cursor_line_style`, `gutter_style`, `base_style`, and `syntax_styles` dict.
2. Register with `text_area.register_theme(theme)`.
3. Activate with `text_area.theme = "theme_name"`.

`TextAreaTheme.get_builtin_theme(name)` returns a copy of a built-in theme for modification.

Theme attributes not supplied fall back to CSS component styles.

## Component Classes

| Class | Description |
|---|---|
| `text-area--cursor` | Style the cursor |
| `text-area--gutter` | Style the gutter (line number column) |
| `text-area--cursor-gutter` | Style the gutter on the cursor's line |
| `text-area--cursor-line` | Style the cursor's line |
| `text-area--selection` | Style the current selection |
| `text-area--matching-bracket` | Style matching brackets |
| `text-area--suggestion` | Style suggestion text |
| `text-area--placeholder` | Style placeholder text |

Styles from the active `TextAreaTheme` take priority over component class styles.

## Syntax Highlighting

Requires the `textual[syntax]` extra (`tree-sitter` and `tree-sitter-languages`).

- Set `language` reactive attribute to enable highlighting (e.g., `"python"`, `"markdown"`).
- Tree-sitter parses the document into a syntax tree, which is queried using highlight queries (`.scm` files).
- Highlight queries map tree-sitter node types to names (e.g., `@string`, `@comment`).
- `TextAreaTheme.syntax_styles` maps these names to Rich `Style` objects.

### Custom Languages

Register via `text_area.register_language(name, language_object, highlight_query)`:
1. Obtain a tree-sitter `Language` object (e.g., from `py-tree-sitter-languages`).
2. Provide a highlight query string (`.scm` format).
3. After registration, set `text_area.language = "name"`.

## Line Separators

- On load, the first line separator found is recorded and used for all subsequent reads.
- Mixed line endings are not supported on export.
- Pasted newlines are converted to the document's separator.
- Check via `text_area.document.newline`.

## Navigation and Wrapping Internals

- `navigator` (`DocumentNavigator`): Provides cursor location info and movement destinations.
- `wrapped_document` (`WrappedDocument`): Converts document locations to visual locations accounting for soft wrap; provides convenience methods.

## Extending TextArea

Override `_on_key` to intercept key presses and inject custom behavior (e.g., auto-closing brackets). Use `insert`, `replace`, and `move_cursor` to manipulate content and cursor after interception.

## Additional Notes

- To remove the focus outline, set `border: none; padding: 0;` in CSS.
- `TextArea` is focusable but not a container.
