# DataTable Widget

The `DataTable` widget displays tabular data with support for keyboard and mouse navigation, sorting, row labels, and multiple cursor modes.

## Behavior

### Adding Columns

- `add_column(label, *, key=None, width=None)` adds a single column and returns a `ColumnKey`. If `key` is provided, it becomes the column's identifier; otherwise one is auto-generated.
- `add_columns(*labels)` adds multiple columns at once and returns a list of `ColumnKey` values. Each label may be a plain string or a `(label, key)` tuple to specify the key explicitly.
- Adding a column with a duplicate key raises `DuplicateKey`.
- When `width` is provided, the column uses that fixed width; otherwise the column auto-sizes to fit the label and cell content.
- Column width auto-expands when rows with wider content are added, but a column with an explicit `width` does not auto-expand.

### Adding Rows

- `add_row(*values, key=None, label=None, height=1)` adds a single row and returns a `RowKey`. Values are positional, one per column.
- `add_rows(rows)` adds multiple rows and returns a list of `RowKey` values.
- Adding a row with a duplicate key raises `DuplicateKey`.
- Supplying more values than there are columns raises `ValueError`.
- When `height=None`, the row height is computed automatically based on cell content (e.g., multi-line strings, Rich renderables like `Panel`).
- A `label` argument attaches a row label rendered to the left of the row.
- `row_count` returns the number of rows currently in the table.

### Removing Rows and Columns

- `remove_row(key)` removes the row identified by the given key.
- `remove_column(key)` removes the column identified by the given key. Remaining rows lose the values from that column.
- It is safe to call `update_cell` and then `remove_row` or `remove_column` on the same cell in the same frame without crashing.

### Clearing the Table

- `clear()` removes all rows but preserves columns. Cursor and hover coordinates reset to `Coordinate(0, 0)`.
- `clear(columns=True)` removes both rows and columns.
- After clearing, previously used row and column keys may be reused without raising `DuplicateKey`.

### Cell Access

- `get_cell(row_key, column_key)` returns the value at the given cell. Raises `CellDoesNotExist` if either key is invalid.
- `get_cell_at(coordinate)` returns the value at a `Coordinate(row_index, column_index)`. Raises `CellDoesNotExist` for out-of-range coordinates.
- `get_cell_coordinate(row_key, column_key)` returns the `Coordinate` for a cell identified by keys. Raises `CellDoesNotExist` if either key is invalid.
- `coordinate_to_cell_key(coordinate)` returns a `CellKey(row_key, column_key)` for a coordinate. Raises `CellDoesNotExist` for invalid coordinates.

### Row and Column Access

- `get_row(row_key)` returns a list of values in the row. Raises `RowDoesNotExist` for an invalid key. The returned values are stable across sorts (key-based access always refers to the same logical row).
- `get_row_at(index)` returns a list of values at a positional index. After sorting, the values at a given index may change. Raises `RowDoesNotExist` for out-of-range or negative indices.
- `get_row_index(row_key)` returns the current positional index for a row key. Raises `RowDoesNotExist` for an invalid key.
- `get_column(column_key)` returns an iterator over the values in a column. Raises `ColumnDoesNotExist` for an invalid key.
- `get_column_at(index)` returns an iterator over the values at a positional column index. Raises `ColumnDoesNotExist` for out-of-range or negative indices.
- `get_column_index(column_key)` returns the current positional index for a column key. Raises `ColumnDoesNotExist` for an invalid key.
- `ordered_rows` reflects the current visual order after sorting (a list of `Row` objects; each has a `.key` attribute).
- `ordered_columns` reflects the columns in their current display order (a list of column objects). Column objects expose a `.label` attribute (a `Rich` `Text` object) and a `get_render_width(table)` method returning `content_width + 2 * cell_padding`.

### Updating Cells

- `update_cell(row_key, column_key, value, update_width=False)` updates a cell by key. Raises `CellDoesNotExist` if either key is invalid (including a valid row key with an invalid column key).
- `update_cell_at(coordinate, value, update_width=False)` updates a cell by coordinate. Raises `CellDoesNotExist` for invalid coordinates.
- When `update_width=True`, the column width recalculates to accommodate the new content. The column width is the maximum of the label width and the widest cell content width.

### Cursor Modes

The `cursor_type` reactive controls the cursor style. Four modes are supported: `"cell"`, `"row"`, `"column"`, and `"none"`.

- **cell**: The cursor highlights a single cell. Arrow keys move the cursor in all four directions. Enter selects the highlighted cell.
- **row**: The cursor highlights an entire row. Up/down arrow keys move between rows. Left/right/up at boundaries raise `SkipAction`. Enter selects the highlighted row.
- **column**: The cursor highlights an entire column. Left/right arrow keys move between columns. Up/down/left at boundaries raise `SkipAction`. Enter selects the highlighted column.
- **none**: The cursor is invisible. No highlight or selection messages are emitted regardless of keyboard or mouse input.

Changing `cursor_type` emits the corresponding highlight message for the new mode (e.g., switching to `"row"` emits `RowHighlighted`).

### Cursor Visibility

- `show_cursor` controls whether the cursor is rendered. When `False`, no highlight or selection messages are emitted even if `cursor_type` is a visible mode.
- Setting `show_cursor` back to `True` emits the appropriate highlight message for the current cursor type.
- When `cursor_type` is `"none"` and `show_cursor` is `True`, no messages are emitted (cursor type takes precedence).

### Cursor Navigation

- Arrow keys, `home`, `end`, `pageup`, and `pagedown` move the cursor.
- `home` moves the cursor to `Coordinate(row, 0)`. `end` moves it to the last column.
- `pagedown` moves the cursor to the last row. `pageup` moves it to the first row.
- Moving the cursor beyond a boundary (e.g., left at column 0) does not emit a highlight event.
- `move_cursor(row=None, column=None, animate=False)` programmatically repositions the cursor. Omitted parameters leave that axis unchanged. When `animate=True`, the scroll animation is used.
- Setting `cursor_coordinate` directly also scrolls the cursor into view.

### Hover

- `hover_coordinate` tracks the cell under the mouse pointer.
- When the mouse leaves the DataTable or moves outside any cell (but still within the widget), hover highlighting is hidden.

### Sorting

- `sort(*column_keys, key=None, reverse=False)` sorts rows in place.
- When called with no column keys and no key function, rows are sorted by all columns in order (lexicographic tuple comparison).
- When called with specific column keys, rows are sorted by those columns in the given priority order.
- `reverse=True` reverses the sort order.
- A custom `key` function receives the row data (as a list of values for the specified columns, or all columns if none specified) and returns a sort key.
- After sorting, key-based access (`get_cell`, `get_row`) still returns the same logical data. Coordinate-based access (`get_cell_at`, `get_row_at`) reflects the new visual order.

### Row Labels

- Rows can have labels set via the `label` parameter of `add_row`.
- Row labels appear to the left of the row data.
- `show_row_labels` controls whether row labels are rendered.
- Clicking a visible row label emits `RowLabelSelected`.

### Header

- `show_header` controls whether the column header row is rendered.
- Clicking a visible header cell emits `HeaderSelected`.
- Header visibility does not affect cursor navigation behavior.

## Messages

All messages are attributes of the `DataTable` class (e.g., `DataTable.CellHighlighted`).

### CellHighlighted

Emitted when the cell cursor moves to a new cell, or when data is first added to an empty table (highlighting the origin cell). Contains `value`, `coordinate`, and `cell_key`.

### CellSelected

Emitted when Enter is pressed or a highlighted cell is clicked a second time. Contains `value`, `coordinate`, and `cell_key`.

### RowHighlighted

Emitted when the row cursor moves to a new row. Contains `row_key` and `cursor_row` (the row index).

### RowSelected

Emitted when Enter is pressed or a highlighted row is clicked a second time. Contains `row_key` and `cursor_row`.

### ColumnHighlighted

Emitted when the column cursor moves to a new column. Contains `column_key` and `cursor_column` (the column index).

### ColumnSelected

Emitted when Enter is pressed or a highlighted column is clicked a second time. Contains `column_key` and `cursor_column`.

### HeaderSelected

Emitted when a column header is clicked (while `show_header=True`). Contains `label` (a `Text` object), `column_index`, and `column_key`.

### RowLabelSelected

Emitted when a row label is clicked (while `show_row_labels=True`). Contains `label` (a `Text` object), `row_index`, and `row_key`.

## Styling

- `cell_padding` controls the horizontal padding on each side of every cell. It affects the virtual size of the table. Cannot be negative (clamped to 0).
- Column render width equals the content width plus `2 * cell_padding`.
- Changing `cell_padding` by Δ alters the total virtual width by `Δ * 2 * column_count` (two padding sides per column, applied across all columns).
- The default cell padding is 1.

## Keys

- `RowKey` and `ColumnKey` are string-compatible identifiers. A `RowKey("foo")` compares equal to the plain string `"foo"` and shares its hash, so either form can be used for dictionary lookups.
- A `RowKey` is equal to itself but not equal to a `ColumnKey`, even when both carry no explicit string value. The two types are distinct and never compare equal to each other.
- `CellKey` is a named pair of `(row_key, column_key)`.

## Empty Table

- Pressing navigation keys or Enter on an empty table (no rows or columns) emits no messages and does not raise exceptions.

## Constraints

- Duplicate row keys raise `DuplicateKey`. Duplicate column keys raise `DuplicateKey`.
- Supplying more row values than there are columns raises `ValueError`.
- Accessing a nonexistent cell (by key or coordinate) raises `CellDoesNotExist`.
- Accessing a nonexistent row by key or out-of-range index raises `RowDoesNotExist`.
- Accessing a nonexistent column by key or out-of-range index raises `ColumnDoesNotExist`.
- Negative row and column indices are treated as invalid (raise the corresponding exception).
- `cell_padding` is clamped to a minimum of 0.
- A column with an explicit `width` does not auto-expand when wider content is added.
- `show_cursor=False` suppresses all cursor-related messages regardless of `cursor_type`.
- `cursor_type="none"` suppresses all cursor-related messages regardless of `show_cursor`.
- Clicking a border link on the DataTable does not crash (border clicks are not interpreted as cell clicks).
