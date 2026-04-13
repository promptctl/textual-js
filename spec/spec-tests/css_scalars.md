# CSS Scalars

Scalars are the unit-aware numeric values used throughout the Textual CSS system. A `Scalar` combines a numeric value, a primary unit, and a percent-resolution unit that determines which dimension percentage-like values resolve against.

## Scalar Structure

### Scalar Constructor

A `Scalar` is constructed with three arguments: `Scalar(value, unit, percent_unit)`.

- **value** -- a numeric value (int or float). Negative values are permitted (e.g., for offsets).
- **unit** -- the primary unit describing what the value measures (cells, percent, height, width, fraction).
- **percent_unit** -- the contextual unit that determines which dimension percentage-based and fractional values resolve against (WIDTH or HEIGHT).

### Unit Kinds

The `Unit` enum includes at minimum:

- `Unit.CELLS` -- absolute cell (character) units. A bare number like `"10"` parses as cells.
- `Unit.PERCENT` -- a percentage of the parent or relevant container dimension.
- `Unit.WIDTH` -- resolves relative to the width axis.
- `Unit.HEIGHT` -- resolves relative to the height axis.
- `Unit.FRACTION` -- fractional units (`fr`), used in grid layouts to distribute remaining space proportionally.

### Copying and Mutation

Scalars support `copy_with()` to produce a new scalar with selectively replaced fields:

- `scalar.copy_with(value=N)` -- returns a new Scalar with the value changed, unit and percent_unit preserved.
- `scalar.copy_with(unit=U)` -- returns a new Scalar with the primary unit changed, value and percent_unit preserved.
- `scalar.copy_with(percent_unit=U)` -- returns a new Scalar with the percent-resolution unit changed, value and primary unit preserved.

Each call returns a new instance; scalars are not mutated in place.

## Parsing and Normalization

### CSS String Parsing

When CSS declarations are parsed:

- A bare number (e.g., `"10"`, `"40"`) becomes `Scalar(N, Unit.CELLS, ...)`.
- A percentage (e.g., `"5%"`, `"-5.5%"`) becomes `Scalar(N, Unit.PERCENT, ...)`.
- A fractional unit (e.g., `"1fr"`) becomes a Scalar with `Unit.FRACTION` behavior and its `percent_unit` set to the appropriate axis.

The `percent_unit` is assigned based on the axis the property controls. For example, in `offset: X Y`, the X component receives `percent_unit=Unit.WIDTH` and the Y component receives `percent_unit=Unit.HEIGHT`.

### Programmatic Assignment Normalization

When setting a style dimension (e.g., `widget.styles.width`) programmatically:

- `int` or `float` values are normalized to `Scalar(value, Unit.CELLS, Unit.WIDTH)`.
- String representations of numbers (e.g., `"20"`, `"1.4"`) are parsed and normalized to `Scalar(value, Unit.CELLS, Unit.WIDTH)`.
- `Scalar` instances are accepted directly, but percentage-based units are normalized: a `Scalar` with `Unit.PERCENT` as its primary unit is converted so the primary unit becomes the appropriate axis unit (e.g., `Unit.WIDTH` for width).
- Unsupported types (`str` that is not a valid number, complex numbers, `Decimal`, `list`, `tuple`, `dict`) raise `StyleValueError`.

Specifically for width normalization:

| Input | Output |
|---|---|
| `Scalar(10.5, Unit.PERCENT, Unit.WIDTH)` | `Scalar(10.5, Unit.WIDTH, Unit.WIDTH)` |
| `Scalar(10.6, Unit.PERCENT, Unit.PERCENT)` | `Scalar(10.6, Unit.WIDTH, Unit.WIDTH)` |
| `Scalar(11, Unit.PERCENT, Unit.HEIGHT)` | `Scalar(11.0, Unit.WIDTH, Unit.WIDTH)` |
| `Scalar(10.7, Unit.HEIGHT, Unit.PERCENT)` | `Scalar(10.7, Unit.HEIGHT, Unit.PERCENT)` (non-percent primary units are preserved) |

### Axis-Aware Offset Parsing

The `offset` shorthand property parses two values: `offset: X Y`. The parser assigns:

- X component: `percent_unit=Unit.WIDTH`
- Y component: `percent_unit=Unit.HEIGHT`

The same axis assignment applies when using the longhand properties `offset-x` and `offset-y`.

## Grid-Specific Relative Units

### Percent Unit Assignment for Grid Tracks

Grid track definitions (`grid-rows` and `grid-columns`) accept space-separated lists of scalars. The `percent_unit` for each scalar in the list is set according to which axis the property controls:

- `grid-columns`: all scalars (both `fr` and `%`) receive `percent_unit=Unit.WIDTH`.
- `grid-rows`: all scalars (both `fr` and `%`) receive `percent_unit=Unit.HEIGHT`.

This applies identically whether the values are assigned programmatically or parsed from CSS text.

### Fractional Units in Grids

When `"1fr"` appears in a grid track definition, the resulting scalar's `percent_unit` reflects the axis of the grid property, not an intrinsic property of the `fr` unit itself. This ensures fractional space distribution resolves against the correct dimension.

## Constraints

- A `Scalar` always carries all three components: value, unit, and percent_unit. There is no default or omitted field.
- `copy_with` produces a new instance; the original scalar is unchanged.
- Percentage-based primary units (`Unit.PERCENT`) are normalized away during programmatic style assignment -- they are converted to the concrete axis unit (`Unit.WIDTH` or `Unit.HEIGHT`). Non-percent primary units are preserved as-is.
- Negative scalar values are valid and used for properties like offsets.
- Grid track scalars must have their `percent_unit` match the axis of the grid property (`WIDTH` for columns, `HEIGHT` for rows). This is enforced at both parse time and programmatic assignment time.
- Programmatic assignment of unsupported types to dimension style properties must raise `StyleValueError`.
- The `percent_unit` is context-dependent: the same CSS text (e.g., `"5%"`) will resolve to different `percent_unit` values depending on which property it is assigned to.
