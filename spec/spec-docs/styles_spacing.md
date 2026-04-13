# Spacing Style Properties

Specification for margin, padding, and box-sizing style properties that control spacing in Textual widget layout.

## Box Model Overview

Textual uses a box model with three concentric regions around widget content:

```
┌─────────────── margin ───────────────┐
│  ┌──────────── border ────────────┐  │
│  │  ┌───────── padding ────────┐  │  │
│  │  │                          │  │  │
│  │  │        content           │  │  │
│  │  │                          │  │  │
│  │  └──────────────────────────┘  │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- **Margin**: space outside the widget's border; does not receive the widget's background color.
- **Padding**: space inside the widget's border, between the border and the content; receives the widget's background color.
- **Border**: sits between margin and padding (specified separately; see border styles).

The `gutter` is the combined space of padding and border around widget content.

## Margin

The `margin` style specifies spacing around (outside) a widget.

### Syntax

**CSS shorthand:**

```
margin: <integer>;                              /* all four edges */
margin: <integer> <integer>;                    /* top/bottom, left/right */
margin: <integer> <integer> <integer> <integer>; /* top, right, bottom, left */
```

**CSS individual edges:**

```
margin-top: <integer>;
margin-right: <integer>;
margin-bottom: <integer>;
margin-left: <integer>;
```

**Python:**

```python
widget.styles.margin = 1           # all edges
widget.styles.margin = (2, 4)      # top/bottom=2, left/right=4
widget.styles.margin = (1, 2, 3, 4) # top=1, right=2, bottom=3, left=4
```

Python does not expose `margin_top`, `margin_right`, `margin_bottom`, or `margin_left` as individual properties.

### Default Value

`(0, 0, 0, 0)` -- no margin on any edge.

### Value Type

All values are integers representing cell units. The four-value form follows clockwise order: top, right, bottom, left.

### Behavior

- Margin occupies space outside the widget's border.
- Margin space does not display the widget's background color.
- Margin reduces the available space for the widget's content area (the widget shrinks to accommodate its margin within the container).
- Margin is not affected by `box-sizing`; it always occupies space outside the widget's declared dimensions.
- Textual does not collapse adjacent margins (unlike CSS in web browsers). Each widget's margin is independent.
- Margin is animatable.

## Padding

The `padding` style specifies spacing around the content inside a widget (between border and content).

### Syntax

**CSS shorthand:**

```
padding: <integer>;                              /* all four edges */
padding: <integer> <integer>;                    /* top/bottom, left/right */
padding: <integer> <integer> <integer> <integer>; /* top, right, bottom, left */
```

**CSS individual edges:**

```
padding-top: <integer>;
padding-right: <integer>;
padding-bottom: <integer>;
padding-left: <integer>;
```

**Python:**

```python
widget.styles.padding = 1           # all edges
widget.styles.padding = (2, 4)      # top/bottom=2, left/right=4
widget.styles.padding = (1, 2, 3, 4) # top=1, right=2, bottom=3, left=4
```

Python does not expose `padding_top`, `padding_right`, `padding_bottom`, or `padding_left` as individual properties.

### Default Value

`(0, 0, 0, 0)` -- no padding on any edge.

### Value Type

All values are integers representing cell units. The four-value form follows clockwise order: top, right, bottom, left.

### Behavior

- Padding occupies space inside the widget's border, between the border and the content.
- Padding space displays the widget's background color.
- How padding affects widget dimensions depends on `box-sizing` (see below).
- Padding is animatable.

## Box Sizing

The `box-sizing` style determines whether padding and border are included within or added outside a widget's declared width and height.

### Syntax

```
box-sizing: border-box | content-box;
```

**Python:**

```python
widget.styles.box_sizing = "border-box"
widget.styles.box_sizing = "content-box"
```

### Default Value

`border-box`

### Values

| Value | Description |
|---|---|
| `border-box` | The widget's declared `width` and `height` include padding and border. Adding padding or border reduces the content area but does not change the widget's outer dimensions. |
| `content-box` | The widget's declared `width` and `height` specify the content area only. Padding and border are added outside, increasing the widget's total outer dimensions. |

### Behavior

**`border-box` (default):**

- A widget with `width: 20; padding: 2; border: solid;` has a total occupied width of 20 cells. The content area is `20 - 2(padding-left) - 2(padding-right) - 1(border-left) - 1(border-right) = 14` cells wide.
- The `gutter` (padding + border) is subtracted from the declared dimensions to determine the content area.
- Min/max width and height constraints also include gutter in their values, so the gutter is subtracted when computing the content area bounds.

**`content-box`:**

- A widget with `width: 20; padding: 2; border: solid;` has a content area of 20 cells. The total occupied width is `20 + 2 + 2 + 1 + 1 = 26` cells.
- The `gutter` is added on top of the declared dimensions.
- Min/max width and height constraints refer to the content area only; gutter is not subtracted from them.

**Margin is unaffected:**

In both modes, margin is always outside the widget's dimensions and is always subtracted from the available container space independently of `box-sizing`.

## Layout Interaction Summary

Given a widget in a container:

1. The container provides available space.
2. Margin is subtracted from the available space (both box-sizing modes).
3. If `box-sizing: border-box`, the widget's declared width/height includes the gutter (padding + border). The content area is the declared size minus the gutter.
4. If `box-sizing: content-box`, the widget's declared width/height is the content area. The widget's total size is the declared size plus the gutter.

## Spacing NamedTuple

Both margin and padding are stored internally as `Spacing(top, right, bottom, left)` named tuples from `textual.geometry`. Key properties:

| Property | Description |
|---|---|
| `width` | `left + right` |
| `height` | `top + bottom` |
| `totals` | `(left + right, top + bottom)` -- horizontal and vertical totals as a tuple |
| `css` | CSS string representation (e.g., `"1 2 3 4"`) |

Setting margin or padding to `None` in Python clears the rule and reverts to the default `(0, 0, 0, 0)`.

Setting an invalid tuple length (not 1, 2, or 4) raises `StyleValueError`.
