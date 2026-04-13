# Box Model Properties

## Overview

The `box-sizing` property determines how the total width and height of a widget are calculated, specifically whether padding and border dimensions are included within or added on top of the declared size.

## box-sizing

### Syntax

```
box-sizing: border-box | content-box;
```

### Values

| Value | Description |
|---|---|
| `border-box` (default) | Padding and border are included in the widget's declared width and height. Adding padding or border reduces the space available for content but does not change the widget's outer dimensions. |
| `content-box` | Padding and border are added outside the widget's declared width and height. The content area remains the declared size, and the widget's outer dimensions grow to accommodate padding and border. |

### Behavior

When two widgets have the same declared height (e.g., `height: 5`):

- With `border-box`, the widget's total size on screen is exactly 5 cells. Padding and border consume cells from that budget, leaving fewer cells for content.
- With `content-box`, the content area is exactly 5 cells. Padding and border add to the total, so the widget occupies more than 5 cells on screen.

### CSS

```css
/* Set box sizing to border-box (default) */
box-sizing: border-box;

/* Set box sizing to content-box */
box-sizing: content-box;
```

### Python

```python
# Set box sizing to border-box (default)
widget.box_sizing = "border-box"

# Set box sizing to content-box
widget.box_sizing = "content-box"
```

### Notes

- The default `border-box` matches the behavior of `box-sizing: border-box` in web CSS, where the declared size includes padding and border.
- This property interacts with `border` and `padding` styles. Changing `box-sizing` without adjusting padding or border values will cause the content area to grow or shrink accordingly.
