## Rule

The `Rule` widget renders a visual separator line, either horizontal or vertical, to divide content within a layout.

### Import

`Rule` is imported from `textual.widgets`. Related exceptions `InvalidLineStyle` and `InvalidRuleOrientation` are imported from `textual.widgets.rule`.

### Orientation

A `Rule` has an `orientation` property that controls whether it renders as a horizontal or vertical line. Orientation can be set at construction via the `orientation` parameter and changed afterward as a reactive attribute.

Setting `orientation` to an unrecognized value raises `InvalidRuleOrientation`, both at construction time and when assigned reactively after creation.

### Line Style

A `Rule` has a `line_style` property that controls the visual appearance of the rendered line. Line style can be set at construction via the `line_style` parameter and changed afterward as a reactive attribute.

Setting `line_style` to an unrecognized value raises `InvalidLineStyle`, both at construction time and when assigned reactively after creation.

### Default Construction

`Rule()` with no arguments creates a valid rule using default orientation and line style values.

## Constraints

- `orientation` must be a recognized value; invalid values raise `InvalidRuleOrientation`.
- `line_style` must be a recognized value; invalid values raise `InvalidLineStyle`.
- Both `orientation` and `line_style` are reactive: validation is enforced on every assignment, not only at construction.
