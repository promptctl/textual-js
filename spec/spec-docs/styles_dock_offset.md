# Dock, Offset, and Position

## Overview

Textual provides styles for placing widgets outside of normal layout flow. **dock** fixes a widget to an edge of its container. **offset** shifts a widget from its computed position. **position** determines whether the offset is relative to the widget's normal position or absolute from the container origin.

## Dock

The `dock` style fixes a widget to one edge of its parent container. A docked widget remains in place even when the container scrolls. Docked widgets are removed from normal layout flow and placed along the specified edge.

### Syntax

```
dock: top | right | bottom | left;
```

### Values

| Value    | Description                               |
|----------|-------------------------------------------|
| `top`    | Dock to the top edge of the container.    |
| `right`  | Dock to the right edge of the container.  |
| `bottom` | Dock to the bottom edge of the container. |
| `left`   | Dock to the left edge of the container.   |

### Default

Not docked (no default value).

### CSS

```css
dock: top;
dock: right;
dock: bottom;
dock: left;
```

### Python

```python
widget.styles.dock = "top"
widget.styles.dock = "right"
widget.styles.dock = "bottom"
widget.styles.dock = "left"
```

## Offset

The `offset` style shifts a widget from its computed position by a specified amount along the horizontal and vertical axes. The offset is purely visual -- it does not affect layout of other widgets.

### Syntax

```
offset: <scalar> <scalar>;
offset-x: <scalar>;
offset-y: <scalar>;
```

The shorthand `offset` takes two `<scalar>` values: the horizontal offset followed by the vertical offset. The individual axis properties `offset-x` and `offset-y` set the offset on a single axis.

A `<scalar>` may be an integer (number of cells/lines) or a percentage of the widget's dimensions.

### Default

`0 0` (no offset).

### CSS

```css
offset: 8 2;
offset-x: 4;
offset-y: -3;
```

### Python

The offset must be set as a tuple of both axes simultaneously; individual axis assignment is not supported in Python.

```python
widget.styles.offset = (2, 4)
```

## Position

The `position` style determines the reference point for the `offset` style. It controls whether offset values are relative to the widget's normal computed position or absolute from the container's origin (top-left corner).

### Syntax

```
position: relative | absolute;
```

### Values

| Value                | Description                                                                 |
|----------------------|-----------------------------------------------------------------------------|
| `relative` (default) | Offset is applied relative to the widget's normal position in the layout.  |
| `absolute`           | Offset is applied relative to the container's top-left origin.             |

### Behavior

With `relative` positioning (default), an offset of `(1, 1)` moves the widget 1 cell right and 1 line down from where it would normally appear.

With `absolute` positioning, an offset of `(1, 1)` places the widget 1 cell right and 1 line down from the top-left corner of its container, regardless of where the widget would normally be positioned.

Absolute positioning takes precedence over the parent container's alignment rules.

### CSS

```css
position: relative;
position: absolute;
```

### Python

```python
widget.styles.position = "relative"
widget.styles.position = "absolute"
```

## Property Summary

| CSS Property | Python Attribute              | Type / Values                   | Default    |
|--------------|-------------------------------|---------------------------------|------------|
| `dock`       | `widget.styles.dock`          | `top` / `right` / `bottom` / `left` | (none) |
| `offset`     | `widget.styles.offset`        | `(<scalar>, <scalar>)`          | `0 0`      |
| `offset-x`   | (set via `offset` tuple)      | `<scalar>`                      | `0`        |
| `offset-y`   | (set via `offset` tuple)      | `<scalar>`                      | `0`        |
| `position`   | `widget.styles.position`      | `relative` / `absolute`        | `relative` |

## Related Styles

- `align` -- Controls where children are positioned within a container; absolute positioning overrides alignment.
- `layers` / `layer` -- Controls z-ordering of widgets, which interacts with docked and positioned widgets.
