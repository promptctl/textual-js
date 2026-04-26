# Input Widget

The `Input` widget is a single-line text entry field supporting cursor movement, text selection, clipboard operations, restriction patterns, and configurable focus behavior.

## Properties

### Value and Display

- `value` holds the current text content as a string.
- When `password` is `True`, the displayed value renders each character as a bullet (`"•"`) instead of the actual text. Password mode also changes word-based navigation and deletion to treat the entire content as a single word.
- A `highlighter` (e.g. `JSONHighlighter`) can be assigned; the displayed value is then the result of running that highlighter over the text.
- The intrinsic content height of an `Input` is always 1, even when the CSS `height` is set to `auto`.

### Cursor

- `cursor_position` is a zero-based integer index into the value string.
- `cursor_blink` controls whether the cursor blinks. When set to `False`, the cursor remains permanently visible. Toggling the cursor via `_toggle_cursor` alternates `_cursor_visible` between `True` and `False`.

### Selection

- `selection` is a `Selection(start, end)` pair where `start` is the anchor and `end` is the moving end (cursor).
- `selected_text` returns the text between the two ends of the selection regardless of direction. A forward selection `Selection(0, 4)` and a reverse selection `Selection(4, 0)` yield the same `selected_text`.
- An empty selection (start equals end) produces an empty `selected_text`.
- `delete_selection()` removes the selected text from `value`. Works identically for forward and reverse selections.
- When `value` is updated programmatically, the selection is clamped to remain valid within the new value length.
- `Selection.cursor(pos)` creates a zero-length selection (collapsed cursor) at the given position.

## Messages

### Changed

- A `Changed` message is posted whenever `value` changes.
- Constructing an `Input` with an initial value causes exactly one `Changed` message on startup.
- Constructing an `Input` with no initial value (or empty string) produces no startup messages.
- Each character typed produces one `Changed` message.
- A `Paste` event that inserts text produces one `Changed` message.
- `event.control` and `event.input` both reference the `Input` widget that sent the message.

### Submitted

- A `Submitted` message is posted when the user presses Enter.
- Pressing Enter on an empty input produces a single `Submitted` with no preceding `Changed`.
- Pressing Enter on a pre-populated input (one that had an initial value) produces the initial `Changed` followed by `Submitted`.
- `event.control` and `event.input` both reference the `Input` widget that sent the message.

## Key Actions: Movement

### Single-Character Movement

- `action_cursor_left()`: moves the cursor one position left. At position 0, it stays at 0.
- `action_cursor_right()`: moves the cursor one position right. At the end of the value, it stays put.

### Word Movement

- `action_cursor_left_word()`: moves the cursor left to the start of the current or previous word. Stops at word boundaries defined by whitespace and punctuation. Hyphens act as word separators (e.g. `"quiet-like"` contains two words for navigation). At position 0, no movement occurs.
- `action_cursor_right_word()`: moves the cursor right to the end of the current or next word. At the end of the value, no movement occurs.
- In password mode, word movement treats the entire value as one word: `action_cursor_left_word()` jumps to position 0, and `action_cursor_right_word()` jumps to the end.
- The number of word hops from start to end equals the number of hops from end to start for the same input.

### Home and End

- `action_home()`: moves the cursor to position 0.
- `action_end()`: moves the cursor to `len(value)`.

## Key Actions: Modification

### Delete Left (Backspace)

- `action_delete_left()`: removes one character to the left of the cursor. At position 0, does nothing.
- `action_delete_left_word()`: removes characters leftward to the start of the current or previous word. In password mode, deletes everything to the left.
- `action_delete_left_all()`: removes all characters to the left of the cursor. At position 0, does nothing.

### Delete Right

- `action_delete_right()`: removes one character to the right of the cursor. At the end, does nothing.
- `action_delete_right_word()`: removes characters rightward to the end of the current or next word. In password mode, deletes everything to the right.
- `action_delete_right_all()`: removes all characters to the right of the cursor. At the end, does nothing.

### Programmatic Delete and Replace

- `delete(start, end)` removes characters in the range `[start, end)`. The range is direction-independent: `delete(3, 6)` and `delete(6, 3)` produce the same result. Values beyond the end of the string are clamped. Deleting the range `(0, 0)` removes nothing.
- `replace(text, start, end)` replaces characters in the range `[start, end)` with the given text. Direction-independent and clamped like `delete`.

## Mouse Interaction

- Clicking within the text area positions the cursor at the clicked cell.
- For single-width characters, the click offset maps 1:1 to the character index (accounting for widget decoration offset of 3).
- For double-width characters (e.g. CJK), a click on either cell of a double-width character positions the cursor at that character's index.
- Clicking beyond the end of the text clamps the cursor to `len(value)`.
- Clicking in the padding or border area of the widget still moves the cursor to the nearest cell, enabling smooth drag-to-select behavior.

## Clipboard: Cut, Copy, Paste

- **Cut** (`ctrl+x`): removes the currently selected text from the value and places it in `app.clipboard`.
- **Copy** (`ctrl+c`): places the currently selected text in `app.clipboard` without modifying the value.
- **Paste** (`ctrl+v`): inserts text from `app.clipboard` at the cursor position, replacing any current selection. Pasting when there is no selection inserts at the cursor. Repeated pastes append at the cursor position.
- Selection for clipboard operations is created with Shift+arrow keys (e.g. `shift+left`).

## Restrict Patterns

### Custom Restrict

- The `restrict` parameter accepts a regex pattern. After each keystroke, the proposed new value must fully match (`re.fullmatch`) the pattern or the keystroke is rejected.
- Example: `restrict="[abc]*"` allows only the characters a, b, and c.

### Built-in Types

- `type="integer"` restricts input to integers: optional leading sign (`-` or `+`), digits, and underscores as visual separators. Decimal points, exponent notation, and alphabetic characters are rejected.
- For `type="integer"`, accepted in-progress values include `"+"`, `"-"`, `"+1"`, `"-1"`, and underscore-separated digit groups such as `"1_000"`.
- `type="number"` restricts input to numeric values including decimals and scientific notation (e.g. `"-000_123_456.78e01_234"`). A bare `+` or `-` sign, a bare `.`, and a trailing underscore (e.g. `"1_"`) are all accepted as valid partial (in-progress) entries. `inf`, `nan`, and bare `e` are rejected.
- For `type="number"`, accepted in-progress values include exponent forms still being typed, such as `"1e"`, `"1e+"`, and `"1e-"`, in addition to completed values like `"1e3"` and `"1.5e-2"`.
- `type="text"` applies no restriction; all printable characters are accepted.
- An invalid type string raises `ValueError` on mount.

### Validation

- `is_valid` reflects whether the current value satisfies the type's validation rules. For `type="integer"`, a bare `-` is invalid while `-1` is valid.

### Max Length

- `max_length` caps the number of characters. Once the limit is reached, further character input is silently rejected. Backspace still works to make room. There is no truncation of programmatically-set initial values tested, but typed input is enforced character by character.

## Clear

- `clear()` resets `value` to an empty string.

## Select on Focus

- By default (`select_on_focus=True`), focusing the Input selects all text: `selection == (0, len(value))`.
- When the Input already has focus and the *app* is blurred then re-focused (e.g. alt-tab), the selection is not reset. Only widget-level focus transitions trigger select-on-focus.
- `select_on_focus=False` disables automatic text selection on focus.

## Terminal Cursor

- When the Input is focused, the application's `cursor_position` (terminal cursor) is updated to reflect the visual position of the Input's cursor within the terminal, accounting for widget padding, border, and double-width characters.
- Moving the cursor within the Input updates `app.cursor_position` accordingly. Double-width characters shift the terminal cursor by 2 columns per character.

## Constraints

- `cursor_position` must be in the range `[0, len(value)]`. Setting it to 0 when the value is empty is valid.
- All delete and movement actions are no-ops at the boundary where they would have no effect (e.g. delete-left at position 0, cursor-right at end). They never raise exceptions.
- Word navigation boundaries are determined by whitespace and punctuation. Hyphens count as boundaries. In password mode, the entire value is treated as a single word for all word-based operations (movement and deletion).
- `delete()` and `replace()` clamp out-of-range indices to the value length rather than raising.
- `restrict` patterns are evaluated via `re.fullmatch` against the entire proposed value, not just the newly typed character.
- Custom `restrict` patterns must behave as whole-value predicates even when the supplied regex object is stateful (for example, compiled with global/sticky flags in JavaScript terms); repeated keystrokes must not alternate between accept/reject because of matcher state.
- `Selection` direction (forward vs reverse) does not affect the semantics of `selected_text` or `delete_selection()`.
- An `Input` with `height: auto` still resolves to a content height of 1.
- Mouse click positions account for a decoration offset (3 cells) and handle double-width characters by mapping either cell of a wide character to the same character index.
