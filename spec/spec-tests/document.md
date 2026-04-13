# Document Model

The `Document` is the core text buffer model used by `TextArea`. It stores text as a list of lines, supports range-based editing (insert, delete, replace), and provides index/location conversion utilities. `WrappedDocument` layers soft-wrapping on top, and `DocumentNavigator` provides cursor movement within wrapped text.

## Creation

### Constructing a Document

A `Document` is created from a string. The input text is preserved exactly, including any trailing newline.

- `Document(text).text` returns the original text unchanged.
- The document auto-detects the newline style from the input:
  - Unix text (`\n`) yields `document.newline == "\n"`.
  - Windows text (`\r\n`) yields `document.newline == "\r\n"`.
- All four combinations are supported: Unix/Windows line endings, with or without a trailing newline.

### Line storage

Lines are stored without their line-ending characters:

- `"I must not fear.\nFear is the mind-killer."` produces `["I must not fear.", "Fear is the mind-killer."]`.
- A trailing newline adds an empty final element: `"...\n"` produces `[..., ""]`.
- Windows line endings are stripped identically; `\r\n` is not stored in the line content.

### Document end location

`document.end` returns a `(row, col)` tuple pointing just past the last character. If the text ends with a newline, the end location is `(N, 0)` on the empty trailing line. Otherwise it is `(N-1, len(last_line))`.

### Index and location conversion

- `get_index_from_location((row, col))` converts a `(row, col)` location to a zero-based character index into the full text, counting newline characters (including multi-byte `\r\n`).
- `get_location_from_index(index)` converts a character index back to a `(row, col)` location. For Windows documents (`\r\n`), an index that falls on the `\n` byte of a `\r\n` pair maps to a column one past the `\r` on the same row (i.e., it remains on the current line rather than advancing to the next).

Both round-trip correctly for all positions in the document, including the start, line boundaries, and the end.

### Range selection

`get_text_range(start, end)` extracts text between two `(row, col)` locations:

- An empty range (same start and end) returns `""`.
- A single-line range returns the substring between the two columns.
- A multi-line range includes the document's newline characters between lines.
- Selecting past the end of the document returns all remaining text (no crash).

## Insertion

### Inserting via replace_range

All mutations go through `document.replace_range(start, end, text)`. Insertion is a replace where `start == end`.

- Inserting text without newlines splices into the target line at the given column.
- Inserting an empty string is a no-op; lines remain unchanged.
- Inserting at an out-of-bounds column appends to the end of that line.
- Inserting at an out-of-bounds row creates a new line at the end of the document.

### Inserting newlines

- A `"\n"` at the start of a document pushes existing content down, creating an empty first line.
- A `"\n"` in the middle of a line splits it into two lines at that column.
- When replacing a range with `"\n"`, the replaced characters are removed and the remainder is split.

### Inserting multi-line text

- Text ending with a newline inserts all lines and pushes the remainder of the target line to a new line below.
- Text not ending with a newline joins the last inserted segment with the remainder of the target line.
- Text starting with a newline splits the target line first, then inserts the new lines.

### Replacing text within a line

`replace_range` with differing start and end columns on the same row performs an in-line substitution (e.g., replacing `"must"` with `"MUST"`).

## Deletion

### Deleting via replace_range

Deletion is a `replace_range(start, end, "")` call. It returns an `EditResult` containing `end_location` (the cursor position after deletion) and `replaced_text` (the text that was removed).

### Single-character and single-line deletion

- Deleting one character removes it and shifts the rest of the line left.
- Deleting a newline (either left-to-right or right-to-left) merges two adjacent lines into one.
- Deleting all characters on a line but not the trailing newline leaves an empty line in place.
- Deleting a full line including its trailing newline removes the line entirely.

### Multi-line deletion

- A range spanning parts of the first and last lines removes the selected content and joins the remaining prefix of the first line with the remaining suffix of the last line.
- Deleting from a line to the end of the document leaves the document with the surviving prefix lines plus an empty trailing line.
- Deleting the entire document content results in `[""]` (a single empty line).

### Trailing newline deletion

Deleting the final newline of a document (from the empty trailing line back to the end of the previous line) removes that trailing empty line, leaving the last content line as the final line.

## Navigation

### DocumentNavigator

A `DocumentNavigator` is constructed from a `WrappedDocument`. It provides cursor movement that respects soft-wrap boundaries.

### Vertical movement

`get_location_above(location)` and `get_location_below(location)` move the cursor up or down by one visual (wrapped) line:

- Movement is visual, not logical: on a wrapped line, moving down from the first segment lands on the second segment of the same logical line, not the next logical line.
- The column is preserved across visual lines where possible. When the target visual line is shorter, the column clamps to the last valid position.
- Moving above the first visual line clamps to the start of the document.
- Moving below the last visual line clamps to the end of the document.

### Home and end

`get_location_home(location)` moves the cursor to the beginning of the current visual (wrapped) line segment. `get_location_end(location)` moves to the end of the current visual line segment.

- On a wrapped line, home/end target the segment boundaries, not the full logical line boundaries.
- If the cursor is already at home or end, it stays put.

## Wrapped Document

### Construction

A `WrappedDocument` wraps a `Document` at a given character width.

- `WrappedDocument(document, width=N)` breaks each logical line into segments of at most `N` characters.
- `WrappedDocument(document, width=0)` disables wrapping; each logical line produces a single segment regardless of length.
- An empty document wraps to `[[""]]`.

### Wrapped lines

`wrapped_document.lines` returns a list of lists, one inner list per logical line. Each inner list contains the visual line segments.

For example, with `width=4`, the logical line `"123 4567"` wraps to `["123 ", "4567"]`.

### Incremental re-wrapping

After an edit, `wrap_range(start, old_end, new_end)` re-wraps only the affected region instead of the entire document. It takes the pre-edit start location, the pre-edit end location, and the post-edit end location (from `EditResult.end_location`).

- Edits that shrink or grow the document are handled correctly.
- Edits at the end of the document (previously empty regions) are wrapped properly.
- Incremental re-wrapping with wrapping disabled (`width=0`) also works correctly.

### Offset-to-location mapping

`offset_to_location(Offset(x, y))` converts a visual screen coordinate to a `(row, col)` document location:

- The `y` coordinate addresses visual lines top-to-bottom across all wrapped segments.
- The `x` coordinate addresses the column within the visual line segment, offset by the segment's starting column in the logical line.
- Out-of-bounds offsets (negative, or beyond the document) clamp to valid document locations.
- With wrapping disabled, each visual row maps 1:1 to a logical line.

### Wrap offsets

`get_offsets(line_index)` returns the character offsets within a logical line where wraps occur:

- A line that fits within the width returns `[]` (no wrap points).
- A line wrapped into N segments returns N-1 offsets.
- An invalid `line_index` (negative or beyond document length) raises `ValueError`.

## Constraints

- All text mutations go through `replace_range`. There are no separate insert/delete methods; insertion is `replace_range(pos, pos, text)` and deletion is `replace_range(start, end, "")`.
- The document always contains at least one line. Clearing all content results in `[""]`, never an empty list.
- Newline style is auto-detected from the input and preserved in range selections. Lines are stored without newline characters.
- Location tuples are `(row, col)` with zero-based indexing. Out-of-bounds locations are clamped rather than raising errors (for `replace_range`, navigation, and offset mapping).
- `get_offsets` is the exception: invalid line indices raise `ValueError`.
- `EditResult` always reports the post-edit cursor location (`end_location`) and the text that was replaced (`replaced_text`).
- `WrappedDocument` with `width=0` disables wrapping entirely; each logical line is a single visual segment.
- Navigation (home, end, up, down) operates on visual wrapped-line segments, not logical lines.
