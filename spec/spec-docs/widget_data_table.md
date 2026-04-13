# DataTable Widget Spec

## Purpose

DataTable displays tabular data with keyboard and mouse navigation, cell-level rendering via Rich renderables, sorting, row/column operations, and cursor-based selection. It is focusable but not a container.

## Key Types

- **RowKey** (`StringKey`): Uniquely identifies a row regardless of visual position. Returned by `add_row`/`add_rows`.
- **ColumnKey** (`StringKey`): Uniquely identifies a column regardless of visual position. Returned by `add_column`/`add_columns`.
- **CellKey** (`NamedTuple[RowKey, ColumnKey]`): Uniquely identifies a cell. Returned by `coordinate_to_cell_key`.

Keys are stable across sorting, insertion, and deletion. When adding rows/columns, a custom string key can be supplied (e.g., database primary key) or one is auto-generated.

## Reactive Attributes

| Name                | Type         | Default            | Description                                          |
|---------------------|--------------|--------------------|------------------------------------------------------|
| `show_header`       | `bool`       | `True`             | Show the table header row.                           |
| `show_row_labels`   | `bool`       | `True`             | Show the row labels column (if any rows have labels).|
| `fixed_rows`        | `int`        | `0`                | Number of rows pinned at top (do not scroll).        |
| `fixed_columns`     | `int`        | `0`                | Number of columns pinned at left (do not scroll).    |
| `zebra_stripes`     | `bool`       | `False`            | Alternate row background colors.                     |
| `header_height`     | `int`        | `1`                | Height of the header row in terminal lines.          |
| `show_cursor`       | `bool`       | `True`             | Whether the cursor is visible.                       |
| `cursor_type`       | `str`        | `"cell"`           | One of `"cell"`, `"row"`, `"column"`, `"none"`.      |
| `cursor_coordinate` | `Coordinate` | `Coordinate(0, 0)` | Current cursor position.                             |
| `hover_coordinate`  | `Coordinate` | `Coordinate(0, 0)` | Position the mouse is hovering over.                 |

## Cursor Modes

| Mode       | Highlight unit | Messages emitted on move / select               |
|------------|----------------|--------------------------------------------------|
| `"cell"`   | Single cell    | `CellHighlighted` / `CellSelected`               |
| `"row"`    | Entire row     | `RowHighlighted` / `RowSelected`                  |
| `"column"` | Entire column  | `ColumnHighlighted` / `ColumnSelected`            |
| `"none"`   | Nothing        | No highlight/select messages.                     |

The cursor type is changed by setting the `cursor_type` reactive. Changing the type posts the corresponding Highlighted message for the new mode.

## Messages

### CellHighlighted
Posted when cursor moves to a new cell (`cursor_type="cell"`). Also posted when cursor is re-enabled or cursor type changes to `"cell"`.
- `data_table`: The DataTable instance.
- `value`: The cell value.
- `coordinate`: The `Coordinate` of the cell.
- `cell_key`: The `CellKey` of the cell.

### CellSelected
Posted when a cell is selected via Enter or click (`cursor_type="cell"`).
- `data_table`, `value`, `coordinate`, `cell_key`: Same as CellHighlighted.

### RowHighlighted
Posted when cursor highlights a row (`cursor_type="row"`).
- `data_table`: The DataTable instance.
- `cursor_row`: The y-coordinate of the highlighted row.
- `row_key`: The `RowKey` of the highlighted row.

### RowSelected
Posted when a row is selected (`cursor_type="row"`).
- `data_table`, `cursor_row`, `row_key`: Same as RowHighlighted.

### ColumnHighlighted
Posted when cursor highlights a column (`cursor_type="column"`).
- `data_table`: The DataTable instance.
- `cursor_column`: The x-coordinate of the highlighted column.
- `column_key`: The `ColumnKey` of the highlighted column.

### ColumnSelected
Posted when a column is selected (`cursor_type="column"`).
- `data_table`, `cursor_column`, `column_key`: Same as ColumnHighlighted.

### HeaderSelected
Posted when a column header label is clicked.
- `data_table`: The DataTable instance.
- `column_key`: The `ColumnKey` of the clicked header.
- `column_index`: The integer index of the column.
- `label`: The `Text` content of the header label.

### RowLabelSelected
Posted when a row label is clicked.
- `data_table`: The DataTable instance.
- `row_key`: The `RowKey` of the clicked label.
- `row_index`: The integer index of the row.
- `label`: The `Text` content of the row label.

## Bindings

| Key          | Action            | Description                            |
|--------------|-------------------|----------------------------------------|
| `enter`      | `select_cursor`   | Select cells under the cursor.         |
| `up`         | `cursor_up`       | Move the cursor up.                    |
| `down`       | `cursor_down`     | Move the cursor down.                  |
| `right`      | `cursor_right`    | Move the cursor right.                 |
| `left`       | `cursor_left`     | Move the cursor left.                  |
| `pageup`     | `page_up`         | Move one page up.                      |
| `pagedown`   | `page_down`       | Move one page down.                    |
| `ctrl+home`  | `scroll_top`      | Scroll to the top.                     |
| `ctrl+end`   | `scroll_bottom`   | Scroll to the bottom.                  |
| `home`       | `scroll_home`     | Move to the home position (leftmost).  |
| `end`        | `scroll_end`      | Move to the end position (rightmost).  |

All bindings have `show=False`.

## Component Classes

| Class                       | Description                                  |
|-----------------------------|----------------------------------------------|
| `datatable--cursor`         | Target the cursor.                           |
| `datatable--hover`          | Target cells under the hover cursor.         |
| `datatable--fixed`          | Target fixed (non-scrolling) rows/columns.   |
| `datatable--fixed-cursor`   | Target the cursor in a fixed row/column.     |
| `datatable--header`         | Target the header row.                       |
| `datatable--header-cursor`  | Target the cursor in the header row.         |
| `datatable--header-hover`   | Target the header under the hover cursor.    |
| `datatable--odd-row`        | Target odd rows (for zebra striping).        |
| `datatable--even-row`       | Target even rows (for zebra striping).       |

## Methods

### Adding Data

- **`add_column(label, *, width=None, key=None, default=None) -> ColumnKey`**: Add a single column. `label` is the header text (str or Rich Text). `width` overrides auto-sizing. `key` sets a custom string key. `default` provides a default value for existing rows.
- **`add_columns(*columns) -> list[ColumnKey]`**: Add multiple columns. Each argument is a label string or a `(label, key)` tuple.
- **`add_row(*cells, height=1, key=None, label=None) -> RowKey`**: Add a single row. `cells` are the cell values (one per column). `height` sets row height in lines. `key` sets a custom string key. `label` attaches a row label (displayed in a non-interactive left column).
- **`add_rows(rows) -> list[RowKey]`**: Add multiple rows. Each row is an iterable of cell values.

### Reading Data

- **`get_cell(row_key, column_key) -> CellType`**: Get cell value by keys.
- **`get_cell_at(coordinate) -> CellType`**: Get cell value by coordinate.
- **`get_cell_coordinate(row_key, column_key) -> Coordinate`**: Get current coordinate for a cell identified by keys.
- **`get_row(row_key) -> list[CellType]`**: Get all values in a row by key.
- **`get_row_at(row_index) -> list[CellType]`**: Get all values in a row by current index.
- **`get_row_index(row_key) -> int`**: Get current index for a row key.
- **`get_column(column_key) -> Iterable[CellType]`**: Get all values in a column by key.
- **`get_column_at(column_index) -> Iterable[CellType]`**: Get all values in a column by current index.
- **`get_column_index(column_key) -> int`**: Get current index for a column key.
- **`get_row_height(row_key) -> int`**: Get height of a row in terminal cells.

### Updating Data

- **`update_cell(row_key, column_key, value, *, update_width=False)`**: Update a cell by keys. `update_width=True` recalculates column width.
- **`update_cell_at(coordinate, value, *, update_width=False)`**: Update a cell by coordinate.

### Removing Data

- **`remove_row(row_key)`**: Remove a row by key.
- **`remove_column(column_key)`**: Remove a column by key.
- **`clear(columns=False) -> Self`**: Remove all rows. If `columns=True`, also remove all columns.

### Navigation

- **`move_cursor(*, row=None, column=None, animate=False)`**: Move the cursor to a given row/column index. `None` leaves that axis unchanged.
- **`coordinate_to_cell_key(coordinate) -> CellKey`**: Convert a coordinate to its current cell key (stable across sort/delete).

### Properties

- **`row_count -> int`**: Number of rows currently in the table.

### Sorting

- **`sort(*columns, key=None, reverse=False) -> Self`**: Sort rows. Three usage modes:
  1. **By column**: Pass `ColumnKey` or string key arguments to sort by natural order of those columns. Multiple columns establish tiebreakers.
  2. **By key function**: Pass a `key` callable that receives a tuple of all row values and returns a sort key (like Python's `sorted`).
  3. **Combined**: Pass column arguments and a `key` callable. The key function receives only the values from the specified columns.

  `reverse=True` reverses the sort order.

## Cell Content

Cells accept any Rich renderable (not just strings). `rich.text.Text` objects allow per-cell styling, justification, and formatting. The cell type is `CellType` (a type alias for objects renderable by Rich).

## Row Labels

A label can be attached to any row via the `label` parameter of `add_row`. Labels appear in a dedicated leftmost column that the cursor cannot enter (similar to spreadsheet row numbers). Labels are Rich `TextType` values.

## Fixed Rows and Columns

Setting `fixed_rows` or `fixed_columns` to a positive integer pins that many rows/columns to the top/left edge of the table. Fixed rows and columns remain visible during scrolling.

## Mouse Interaction

- Hovering updates `hover_coordinate` and styles the hovered cell.
- Clicking a cell moves the cursor and emits both the Highlighted and Selected messages for the active cursor type.
- Clicking a column header emits `HeaderSelected`.
- Clicking a row label emits `RowLabelSelected`.
