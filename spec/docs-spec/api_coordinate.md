# Docs Spec: Coordinate

## Purpose
Document the `Coordinate` value type used to address cells in grid widgets (notably `DataTable`) by `{ row, column }`.

## Audience
Developers using `DataTable` and any widget authors that use row/column grids.

## Required sections
1. Overview: what a `Coordinate` is (immutable row/column pair) and where it appears (`DataTable` APIs, cell events, cursor position).
2. Shape: `{ row: number, column: number }`.
3. Directional helpers: `left()`, `right()`, `up()`, `down()` returning a new `Coordinate`.
4. Equality and use as a map key (document structural equality semantics in JS — e.g. using a custom key encoder if needed).
5. Absence of bounds checking — negative coordinates are legal.

## Key concepts
- Immutability: directional methods return a new value; do not mutate.
- Separation from pixel/cell offsets (`Offset`): `Coordinate` is grid-cell-logical, not terminal-cell-geometric.
- Use in `DataTable` cursor, cell selection, and event payloads.

## Behaviors and contracts
- No bounds checking: `left()` on column 0 returns `{ row, column: -1 }`.
- Directional helpers do not mutate; each returns a fresh value.
- Equality is structural (row and column both equal).

## Example requirements
- A TS snippet constructing a coordinate, moving with `down().right()`, and passing it to a `DataTable` API.
- A snippet showing that coordinates are values, not references (two coordinates with the same row/column compare equal).

## Cross-references
- `spec/docs-spec/api_geometry.md` (contrast with `Offset`, `Region`, `Size`).
- `spec/docs-spec/api_events.md` (events that carry `Coordinate`).
- `spec/spec-src/10-widget-catalog.md` (DataTable and grid widgets).

## Notes for writers
- Do not document Python `NamedTuple` mechanics (unpacking, tuple indexing). TS consumers use object destructuring.
- Keep the doc short; this is a small value type. No need to invent extra methods.
- Emphasize that this is distinct from `Offset`/geometry types.
