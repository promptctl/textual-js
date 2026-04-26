# TextArea Widget

The `TextArea` widget is a multi-line text editing component supporting cursor movement, selection, editing via API and keybindings, undo/redo history, syntax highlighting with language support, theming, and clipboard operations.

## Editing via API

### insert

`insert(text, location=None, maintain_selection_offset=True)` inserts text at a given location (defaulting to the cursor). It returns an `EditResult` containing `end_location` and `replaced_text`.

- When `maintain_selection_offset=True` (default), the existing selection shifts to maintain its relative position in the document. An insert before or at the cursor pushes the cursor forward; an insert after the cursor leaves it unchanged.
- When `maintain_selection_offset=False`, the selection collapses to a cursor at the end of the inserted text.
- Inserting a multiline string splits lines and updates cursor row/column accordingly.
- Windows (`\r\n`) and old Mac (`\r`) newlines are normalized to `\n`.
- Inserting an empty string is a no-op.

### replace

`replace(text, start, end)` replaces a range with new text and returns an `EditResult`. When `maintain_selection_offset` is true (the default), the selection adjusts so previously selected characters remain selected after the replacement. This works for replacements that change both the number of lines and the column offsets.

### delete

`delete(start, end, maintain_selection_offset=True)` removes a range of text and returns an `EditResult` containing the deleted text. Selection offset adjustment follows the same rules as `insert` and `replace`. When `maintain_selection_offset=False`, the selection collapses to a cursor at the `end_location` reported in the `EditResult` (the position just after the deletion point).

### clear

`clear()` removes all document content. Works on empty documents without error.

### load_text and text property

- `load_text(text)` replaces the entire document content.
- The `text` property can be read and written. Setting `text` replaces the document and resets undo history.

### read_only mode and API edits

API methods (`insert`, `replace`, `delete`) still work when `read_only=True`. Only keyboard-driven edits are blocked.

### EditResult

Every editing API returns an `EditResult(end_location, replaced_text)` describing where the edit ended and what text (if any) was replaced.

## Editing via Keybindings

### Character input

Pressing a printable character inserts it at the cursor. If a non-empty selection exists, the selected text is replaced by the typed character.

### Enter

`enter` inserts a newline at the cursor.

### Backspace and Delete

- `backspace` deletes the character to the left of the cursor, or the entire selection if non-empty. At the start of a line it merges with the line above. At `(0, 0)` (the very start of the document), `backspace` is a no-op.
- `delete` deletes the character to the right of the cursor, or the entire selection if non-empty. At the end of a line it merges with the line below. At the end of the document, `delete` is a no-op.
- Both `backspace` and `delete` produce identical results when a non-empty selection exists: the selection is removed and the cursor moves to the selection's start (top-left).

### Tab

When `tab_behavior="indent"`, pressing `tab` inserts spaces to reach the next tab stop (based on `indent_width`, default 4). Tab stops account for the visual width of content including multi-byte characters.

### Cut line / Cut selection (ctrl+x)

- With no selection (cursor only), `ctrl+x` cuts the entire current line and places it in the clipboard.
- With a selection, `ctrl+x` cuts only the selected text.
- In a multiline document with a cursor, the full line (including its trailing newline) is cut.

### Delete line (ctrl+shift+k)

- With a cursor, deletes the entire line the cursor is on.
- With a non-empty single-line selection, deletes that line.
- With a multi-line selection, deletes all lines the selection touches, except: if the selection end is at column 0 of a line, that line is not deleted.

### Delete to end of line (ctrl+k)

- With a cursor, deletes from the cursor to the end of the line.
- With a non-empty selection, deletes from the cursor (selection end) to the end of that line.

### Delete to start of line (ctrl+u)

- With a cursor, deletes from the start of the line to the cursor.
- With a non-empty selection, deletes from the start of the line containing the selection end to the cursor.

### Delete word left (ctrl+w)

- Deletes backward to the previous word boundary on the same line.
- If no word boundary is found, deletes to the start of the line.
- At the start of a line, merges with the line above (deletes the newline).
- When a non-empty selection exists, deletes only the selection.
- Respects both space-separated and tab-separated word boundaries.

### Delete word right (ctrl+f)

- Deletes forward to the next word boundary on the same line.
- If no word boundary is found, deletes to the end of the line.
- At the end of a line, merges with the line below.
- When a non-empty selection exists, deletes only the selection.

### Paste

Pasting (via `Paste` event) replaces the current selection with the pasted text, or inserts at cursor if no selection. Paste is blocked when `read_only=True`.

### Read-only mode

When `read_only=True`, all keyboard editing operations are no-ops. This includes: `enter`, `backspace`, `delete`, `ctrl+u`, `ctrl+f`, `ctrl+w`, `ctrl+k`, `ctrl+x`, `space`, printable characters, `tab`, and paste.

## Selection

### Selection model

A `Selection` has a `start` (anchor) and `end` (cursor) position, each a `(row, column)` tuple. `Selection.cursor((row, col))` creates an empty selection (cursor) at a location. The default selection is `(0, 0)`.

### cursor_location

- Reading `cursor_location` returns `selection.end`.
- Setting `cursor_location` moves the end of the selection; if a selection is active (non-empty), the start/anchor remains, extending the selection.

### move_cursor

`move_cursor(location, select=False)` moves the cursor. When `select=True`, the anchor is preserved and the selection extends. `move_cursor` also accepts `record_width=True` to record the visual column width for vertical movement alignment.

### move_cursor_relative

`move_cursor_relative(rows, columns)` moves the cursor by a relative offset, clamped to document bounds.

### selected_text

Returns the text within the current selection. Works correctly with both forward and backward selections, and with multi-byte characters.

### Selection clamping

Setting a selection with coordinates beyond the document bounds clamps them to valid positions.

### Cursor location helpers

- `get_cursor_left_location()` / `get_cursor_right_location()` — adjacent character positions, wrapping across lines.
- `get_cursor_up_location()` / `get_cursor_down_location()` — vertical movement, snapping to line end if the target line is shorter. Respects recorded visual width for alignment through double-width characters.
- `get_cursor_word_left_location()` / `get_cursor_word_right_location()` — word boundary navigation. Words are delimited by spaces, tabs, and transitions between alphanumeric/non-alphanumeric characters. At line boundaries, wraps to the adjacent line.

### select_all

`select_all()` selects the entire document. For documents ending with a trailing newline, the end of the selection is `(last_line, 0)`.

### select_line

`select_line(index)` selects the content of a specific line by index. If the index is out of range, the selection is not changed.

### Cursor screen offset

`cursor_screen_offset` reports the on-screen position of the cursor, accounting for line numbers and scrolling. This position is also reported to the app as `cursor_position` for IME/emoji popup positioning.

## Selection via Keybindings

### Shift+arrow selection

- `shift+right` / `shift+left` — extend selection character by character, wrapping across lines.
- `shift+up` / `shift+down` — extend selection line by line. On the first line, `shift+up` selects to the start. On the last line, `shift+down` selects to the end.

### Word selection with shift

- `ctrl+shift+right` / `ctrl+shift+left` — extend selection by word.

### Line navigation

- `home` / `ctrl+a` — smart home (wrapping disabled only): first press goes to the first non-whitespace character, second press goes to column 0, third press returns to first non-whitespace. When soft wrapping is enabled, Home goes to the start of the current wrapped section instead (verified in original codebase).
- `end` / `ctrl+e` — jump to end of line.

### Page navigation

- `pagedown` — move cursor down by the visible page height.
- `pageup` — move cursor up by the visible page height.

### Word navigation (without selection)

- `ctrl+right` — move cursor to the next word boundary.
- `ctrl+left` — move cursor to the previous word boundary.

### Select line binding (f6)

Selects the entire content of the current line.

### Select all binding (f7)

Selects all text in the document.

### Vertical visual alignment

When moving the cursor vertically through lines containing double-width characters (e.g., CJK), the cursor maintains visual column alignment rather than character index alignment.

### Mouse click

Clicking positions the cursor at the clicked location. Clicking in the gutter (line number area) positions the cursor at column 0 of that line. Clicking beyond the document bounds clamps the cursor to valid positions.

## Undo/Redo History

### Basic undo/redo

`undo()` reverts the last batch of edits. `redo()` re-applies them. Both are also available via keybindings (`ctrl+z` for undo).

### Selection restoration

Undo restores the selection that was active before the undone edit. Redo restores the selection that was active after the edit.

### Batching rules

Consecutive edits are batched into a single undo checkpoint based on several rules:

- **Time-based**: Edits within the `checkpoint_timer` interval (default 2 seconds) are batched together. A gap longer than the timer starts a new batch.
- **Character limit**: When total characters in a batch exceed `checkpoint_max_characters` (default 100), a new batch starts.
- **Cursor movement**: Moving the cursor (e.g., pressing arrow keys between edits) forces a new checkpoint.
- **Insert vs. delete**: Insertions and deletions are never batched together.
- **Multi-line edits**: Any single edit that spans multiple lines (i.e., the deleted or replaced text contains a newline) is always placed in its own isolated batch and is never combined with adjacent single-character edits, even if they are also deletions.
- **Paste**: Each paste operation is an isolated batch, never combined with adjacent edits.
- **Focus**: Losing and regaining focus creates a checkpoint between edits.

### Max checkpoints

The undo stack has a configurable `max_checkpoints` limit. When the limit is reached, the oldest checkpoint is discarded.

### Redo stack cleared on edit

Any new edit after an undo clears the redo stack. You cannot redo past a point where new edits were made.

### Setting text property resets history

Assigning to `text_area.text` clears both undo and redo stacks entirely.

### No-op conditions

- `undo()` with an empty undo stack is a no-op.
- `redo()` with an empty redo stack is a no-op.

## Language Support (Syntax Highlighting)

### Setting a language

A language can be set via the constructor (`language="python"`) or by assigning to the `language` attribute. Setting `language = None` disables syntax highlighting.

### Unknown language

Setting an unknown language raises `LanguageDoesNotExist`.

### Registering custom languages

`register_language(name, language, highlights)` registers a tree-sitter language with a highlight query. The language then appears in `available_languages` and can be set via `text_area.language = name`.

### Updating highlight queries

`update_highlight_query(language, query)` replaces the highlight query for an already-registered language. Setting an empty query string removes all highlights.

## Messages

### TextArea.Changed

Posted when the document content changes, whether via API (`insert`, `text = ...`) or keyboard input.

### TextArea.SelectionChanged

Posted when the selection changes. This includes cursor movement via API (`cursor_location = ...`) and keyboard typing (which moves the cursor). Note: setting the `text` property does not post `SelectionChanged` even though the selection may reset.

## Themes

### Default theme

The default theme is `"css"`.

### Built-in themes

Built-in themes (e.g., `"vscode_dark"`, `"monokai"`) can be set via the constructor or by assigning to `text_area.theme`.

### Unknown theme

Setting an unknown theme raises `ThemeDoesNotExist`.

### Custom themes

`register_theme(TextAreaTheme(name))` registers a custom theme. Once registered, it appears in `available_themes` and can be activated by setting `text_area.theme = name`.

## Clipboard (Cut, Copy, Paste)

### Cut (ctrl+x)

With a selection, cuts the selected text to the app clipboard and removes it from the document. Without a selection, cuts the entire current line.

### Copy (ctrl+c)

Copies the selected text to the app clipboard without modifying the document.

### Paste (ctrl+v)

Pastes from the app clipboard. If there is a selection, replaces it. Otherwise inserts at the cursor. Repeated pastes insert additional copies.

## Escape Binding

### tab_behavior="focus" (default)

When `tab_behavior` is `"focus"`, pressing `escape` does not shift focus within the TextArea's parent. Instead, the event propagates to parent bindings (e.g., dismissing a modal screen).

### tab_behavior="indent"

When `tab_behavior` is `"indent"`, pressing `escape` shifts focus to the next focusable widget (since `tab` is consumed for indentation, `escape` provides an alternative way to leave the TextArea).

## CodeEditor Variant

`TextArea.code_editor()` is a convenience constructor that returns a `TextArea` pre-configured for code editing. It accepts all the same parameters as `TextArea.__init__`, but overrides defaults for: `theme`, `soft_wrap`, `tab_behavior`, and `show_line_numbers`. All other parameters share identical signatures and defaults with `TextArea.__init__`, and these are kept in sync (verified by meta-test).

## Constraints

- Locations are `(row, column)` tuples, zero-indexed.
- Selections have an anchor (`start`) and a cursor (`end`); direction matters for behavior but `selected_text` normalizes order.
- All newline formats (`\n`, `\r\n`, `\r`) are normalized to `\n` internally.
- API edits work in `read_only` mode; only keyboard edits are blocked.
- Setting the `text` property resets undo/redo history entirely.
- The undo stack has a bounded size (`max_checkpoints`); oldest entries are evicted.
- Redo stack is cleared whenever a new edit occurs after an undo.
- Unknown languages raise `LanguageDoesNotExist`; unknown themes raise `ThemeDoesNotExist`.
- Mouse clicks and selections clamp to document bounds.
- Smart home toggles between first non-whitespace column and column 0. This behavior only applies when wrapping is disabled; with soft wrapping enabled, Home navigates to the start of the current wrapped section (verified in original codebase).
- Vertical cursor movement preserves visual column alignment through double-width characters.
- `CodeEditor` parameters are kept in sync with `TextArea.__init__` (enforced by meta-test); only `theme`, `soft_wrap`, `tab_behavior`, and `show_line_numbers` differ in defaults.
