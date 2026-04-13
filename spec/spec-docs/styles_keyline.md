# Keyline Properties

## Overview

The `keyline` style draws lines around child widgets within a container. Unlike `border`, which draws inside a widget's own box, a keyline is drawn outside the widget's border in the margin area. Keylines can overlap and cross to create dividing lines between widgets in both horizontal and grid layouts.

## keyline

### Syntax

```
keyline: [<keyline>] [<color>];
```

The property accepts an optional keyline type and an optional color.

### Keyline Types

| Value | Description |
|---|---|
| `none` | No line (disables keyline). |
| `thin` | A thin line. |
| `heavy` | A heavy (thicker) line. |
| `double` | A double line. |

### Behavior

- The `keyline` style must be applied to a container widget (a widget with a layout).
- Keylines are drawn in the widget's margin area. The `margin` or `grid-gutter` style must be set on child widgets for the keyline to be visible.
- Unlike `border`, keylines from adjacent widgets can overlap and form continuous dividing lines between widgets.
- In grid layouts, keylines create a grid-line effect between cells.

### CSS

```css
/* Set a thin green keyline */
keyline: thin green;

/* Set a heavy red keyline */
keyline: heavy red;

/* Set a double blue keyline */
keyline: double blue;

/* Disable keyline */
keyline: none;
```

### Python

The keyline is set as a tuple of type and color:

```python
widget.styles.keyline = ("thin", "green")
widget.styles.keyline = ("heavy", "red")
widget.styles.keyline = ("double", "blue")
```

### Notes

- Because keylines are drawn in the margin area, child widgets must have `margin` set (or the container must use `grid-gutter`) for the keyline to be visible.
- Keylines are superficially similar to `border` but serve a different purpose: `border` decorates individual widgets, while `keyline` creates dividing lines between siblings in a container.
