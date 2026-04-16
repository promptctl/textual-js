# Docs Spec: DataTable Widget

## Purpose
Describes the docs page for `DataTable` -- a focusable widget that displays tabular data with keyboard and mouse navigation, cell-level rendering, sorting, row/column operations, and cursor-based selection.

## Audience
App authors displaying tabular data; widget authors integrating complex datasets; anyone building spreadsheet-like or list-like UIs.

## Required sections
1. Overview -- focusable, not a container, cursor-driven selection, rich cell content.
2. Key types -- `RowKey`, `ColumnKey`, `CellKey` (and their relationship to coordinates). Stable keys across sort/insert/delete.
3. Reactive/observable attributes -- `showHeader`, `showRowLabels`, `fixedRows`, `fixedColumns`, `zebraStripes`, `headerHeight`, `showCursor`, `cursorType`, `cursorCoordinate`, `hoverCoordinate`. Include defaults.
4. Cursor modes -- `"cell"`, `"row"`, `"column"`, `"none"`; which messages each mode emits on move and select; effect of changing `cursorType`.
5. Messages -- CellHighlighted, CellSelected, RowHighlighted, RowSelected, ColumnHighlighted, ColumnSelected, HeaderSelected, RowLabelSelected. For each: when it fires and payload attributes.
6. Bindings -- full table of default key bindings (enter, arrows, pageup/pagedown, ctrl+home/end, home/end) and their actions; note that all default bindings are not shown in the footer.
7. Component classes for TCSS targeting (`datatable--cursor`, `datatable--hover`, `datatable--fixed`, `datatable--fixed-cursor`, `datatable--header`, `datatable--header-cursor`, `datatable--header-hover`, `datatable--odd-row`, `datatable--even-row`).
8. Adding data -- `addColumn`, `addColumns`, `addRow`, `addRows`; parameters and return values (keys).
9. Reading data -- `getCell`, `getCellAt`, `getCellCoordinate`, `getRow`, `getRowAt`, `getRowIndex`, `getColumn`, `getColumnAt`, `getColumnIndex`, `getRowHeight`.
10. Updating data -- `updateCell`, `updateCellAt` (with optional `updateWidth` to recalc column width).
11. Removing data -- `removeRow`, `removeColumn`, `clear({ columns: boolean })`.
12. Navigation -- `moveCursor({ row, column, animate })`, `coordinateToCellKey`.
13. `rowCount` property.
14. Sorting -- `sort(...columns, { key, reverse })`; the three usage modes (by column, by key function, combined); multi-column tiebreakers.
15. Cell content -- any renderable node is accepted (not just strings); styled text objects for per-cell styling.
16. Row labels -- attached via `addRow({ label })`, appear in a leftmost non-interactive column.
17. Fixed rows and columns -- pin top rows / left columns during scrolling.
18. Mouse interaction -- hover updates `hoverCoordinate`; clicks move cursor and emit both Highlighted and Selected messages for the active cursor type; clicks on headers and labels emit their own messages.

## Key concepts
- Keys (row/column/cell) decouple identity from visual position, so sorting and insertion/deletion do not invalidate references held by the app.
- Coordinate objects represent (row, column) positions in the current visual order; keys map to coordinates via helper methods.
- Cursor mode is a first-class reactive that chooses which highlight region exists and which message stream fires.
- Clicks emit both a Highlighted (cursor-moved-here) and a Selected (user chose this) message in that order.
- Header-row clicks and row-label clicks emit their own specialized messages; these fire in addition to, or instead of, cursor messages depending on cursor mode.
- Column widths can be auto-sized or fixed; `updateCell` with `updateWidth: true` triggers recomputation.
- Fixed rows/columns stay visible while the body scrolls behind them.
- Cell values can be any renderable node; styled text objects allow per-cell formatting, justification, and color.

## Behaviors and contracts
- Defaults:
  - `showHeader`: true; `showRowLabels`: true; `fixedRows`: 0; `fixedColumns`: 0; `zebraStripes`: false; `headerHeight`: 1; `showCursor`: true; `cursorType`: `"cell"`; `cursorCoordinate`: (0, 0); `hoverCoordinate`: (0, 0).
- Changing `cursorType` posts the Highlighted message for the new mode (if applicable) so subscribers can re-sync.
- When `cursorType` is `"none"`, no highlight/select messages are emitted.
- `addColumn`/`addRow` return the new key; `addColumns`/`addRows` return arrays of keys. Custom string keys can be supplied; otherwise keys are auto-generated.
- `getColumn`/`getColumnAt` return iterables (lazy); other getters return concrete values or arrays.
- `moveCursor` accepts an optional `animate` flag; axes omitted remain unchanged.
- `sort`:
  - With column args only: sort by natural column order, using later columns as tiebreakers.
  - With a key function only: the function receives a tuple of all row values and returns a sort key.
  - With both: the key function receives only the values from the specified columns.
  - `reverse: true` reverses the sort.
- All default bindings have `show: false` (they are functional but not listed in the footer).
- Clicking a cell moves the cursor and emits the pair (Highlighted, Selected) for the active mode.
- Clicking a header emits `HeaderSelected` with the column's key, index, and label.
- Clicking a row label emits `RowLabelSelected` with the row's key, index, and label.

## Example requirements
All examples are JSX/TypeScript. Examples must demonstrate:
- Mounting a DataTable, adding columns and rows via `addColumn`/`addRow`, and populating from an array of data.
- Subscribing to `RowSelected` under `cursorType: "row"` and extracting the selected row's data via `getRow(row_key)`.
- Subscribing to `CellSelected` under `cursorType: "cell"` and reading the cell value.
- Sorting by a single column; sorting by two columns with tiebreakers; sorting by a key function.
- Updating a cell and causing a column-width recompute via `updateCell(..., { updateWidth: true })`.
- Using row labels and reading the `RowLabelSelected` message.
- Fixing rows/columns and observing that they stay pinned during scroll.
- Using styled text objects for a cell (e.g., colored or right-justified values).
- Styling the cursor and hover via the component classes.

## Cross-references
- `spec/docs-spec/api_on.md` -- message subscription conventions used for all DataTable messages.
- `spec/docs-spec/api_getters.md` -- `queryOne`/`query` used to retrieve the DataTable instance.
- `spec/spec-src/10-widget-catalog.md` -- catalog entry.
- `spec/spec-src/09-widget-base-contract.md` -- base widget contract (focus, messages, bindings).
- `spec/spec-src/05-layout-render-and-compositor.md` -- scrolling and fixed-region rendering.

## Notes for writers
- Remove Rich-specific type names. Replace `rich.text.Text` and `RenderableType` with the textual-js renderable node type (likely `React.ReactNode` or a typed subset used for labels/cells); state the name once.
- Replace `StringKey` / `NamedTuple` / `Literal` with TypeScript equivalents (opaque string type, tuple/record type, string union).
- `Coordinate` becomes a textual-js record type with `row` and `column`; describe it once.
- `CellType` becomes a type alias for renderable values; do not use the Python name.
- Rename snake_case methods and attributes to camelCase per the textual-js convention: `add_row` -> `addRow`, `cursor_type` -> `cursorType`, `row_count` -> `rowCount`, `coordinate_to_cell_key` -> `coordinateToCellKey`, `update_width` -> `updateWidth`, `zebra_stripes` -> `zebraStripes`, etc. Keep class/message names as `CellHighlighted`, `RowSelected`, etc.
- `sort(..., key=callable)` -- describe as "a comparator-style or key-returning function," use TypeScript function signatures in examples. Do not reuse Python's `sorted` terminology.
- The `show=False` binding attribute becomes `show: false` in the textual-js bindings declaration; state the convention once.
- Do not describe keys as "`StringKey` subclasses" -- the TypeScript form is an opaque branded string type.
- Handler subscription examples should use the textual-js on-handler convention stated once at the top.
