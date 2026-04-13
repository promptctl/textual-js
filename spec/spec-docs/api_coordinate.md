# textual.coordinate

This module contains the `Coordinate` class, used by `DataTable` to represent row/column positions within a grid.

## Coordinate

`Coordinate` is a `NamedTuple` representing a row/column coordinate within a grid.

### Fields

- `row: int` -- The row of the coordinate within a grid.
- `column: int` -- The column of the coordinate within a grid.

### Methods

- `left() -> Coordinate` -- Return the coordinate one column to the left: `Coordinate(row, column - 1)`.
- `right() -> Coordinate` -- Return the coordinate one column to the right: `Coordinate(row, column + 1)`.
- `up() -> Coordinate` -- Return the coordinate one row above: `Coordinate(row - 1, column)`.
- `down() -> Coordinate` -- Return the coordinate one row below: `Coordinate(row + 1, column)`.

### Notes

- No bounds checking is performed by any of the directional methods. Negative coordinates are possible.
- As a `NamedTuple`, `Coordinate` supports tuple unpacking, indexing, comparison, and hashing.
