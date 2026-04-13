# Scrollbar Style Properties

## Overview

Textual widgets that overflow their content area display scrollbars. A set of CSS properties controls scrollbar colors, sizing, gutter reservation, and visibility. Default themes provide sensible colors, but all properties can be overridden per-widget.

A scrollbar has two visual regions: the **track** (background) and the **thumb** (the draggable handle). When both horizontal and vertical scrollbars are present, a **corner** square appears where they meet.

## Color Properties

All scrollbar color properties accept a `<color>` value with an optional `<percentage>` for opacity.

```
<property>: <color> [<percentage>];
```

### Thumb Colors

| CSS Property | Python Attribute | Default | Description |
|---|---|---|---|
| `scrollbar-color` | `scrollbar_color` | `ansi_bright_magenta` | Thumb color at rest. |
| `scrollbar-color-hover` | `scrollbar_color_hover` | `ansi_yellow` | Thumb color when the cursor hovers over the scrollbar. |
| `scrollbar-color-active` | `scrollbar_color_active` | `ansi_bright_yellow` | Thumb color while being dragged. |

### Track (Background) Colors

| CSS Property | Python Attribute | Default | Description |
|---|---|---|---|
| `scrollbar-background` | `scrollbar_background` | `#555555` | Track color at rest. |
| `scrollbar-background-hover` | `scrollbar_background_hover` | `#444444` | Track color when the cursor hovers over the scrollbar. |
| `scrollbar-background-active` | `scrollbar_background_active` | `black` | Track color while the thumb is being dragged. |

### Corner Color

| CSS Property | Python Attribute | Default | Description |
|---|---|---|---|
| `scrollbar-corner-color` | `scrollbar_corner_color` | `#666666` | Color of the gap where horizontal and vertical scrollbars meet. |

### Color State Transitions

The three states -- rest, hover, and active -- apply independently to both the thumb and track. The state changes are:

1. **Rest** -- no mouse interaction with the scrollbar.
2. **Hover** -- the mouse cursor is over the scrollbar but not clicking.
3. **Active** -- the user is clicking/dragging the thumb.

### CSS Examples

```css
scrollbar-color: cyan;
scrollbar-color-hover: pink;
scrollbar-color-active: yellow;

scrollbar-background: blue;
scrollbar-background-hover: purple;
scrollbar-background-active: red;

scrollbar-corner-color: white;

/* With opacity */
scrollbar-background: blue 50%;
```

### Python Examples

```python
widget.styles.scrollbar_color = "cyan"
widget.styles.scrollbar_color_hover = "pink"
widget.styles.scrollbar_color_active = "yellow"

widget.styles.scrollbar_background = "blue"
widget.styles.scrollbar_background_hover = "purple"
widget.styles.scrollbar_background_active = "red"

widget.styles.scrollbar_corner_color = "white"
```

## scrollbar-size

Controls the width (cross-axis dimension) of scrollbars. The scrollbar length always fills 100% of the container edge.

### Syntax

The shorthand sets both axes at once:

```
scrollbar-size: <integer> <integer>;
               /* horizontal vertical */
```

Individual properties:

```
scrollbar-size-horizontal: <integer>;
scrollbar-size-vertical: <integer>;
```

### Defaults

| Property | Default |
|---|---|
| `scrollbar-size-horizontal` | `1` (cell tall) |
| `scrollbar-size-vertical` | `2` (cells wide) |

### Python

There is no Python equivalent for the shorthand `scrollbar-size`. Set each axis independently:

```python
widget.styles.scrollbar_size_horizontal = 10
widget.styles.scrollbar_size_vertical = 4
```

### Notes

- Setting a scrollbar size to `0` hides the scrollbar visually while still allowing scrolling via mousewheel, keyboard, or gestures.
- Values are in terminal cells.

## scrollbar-gutter

Reserves space for the vertical scrollbar even when it is not visible, preventing layout shifts.

### Syntax

```
scrollbar-gutter: auto | stable;
```

### Values

| Value | Description |
|---|---|
| `auto` (default) | No space reserved. Layout recomputes when a scrollbar appears or disappears. |
| `stable` | Space is always reserved for the vertical scrollbar, preventing content reflow. |

### CSS

```css
scrollbar-gutter: stable;
```

### Python

```python
widget.styles.scrollbar_gutter = "stable"
```

## scrollbar-visibility

Shows or hides scrollbars. Hidden scrollbars do not prevent scrolling -- the user can still scroll via mousewheel, keyboard, or gestures.

### Syntax

```
scrollbar-visibility: hidden | visible;
```

### Values

| Value | Description |
|---|---|
| `visible` (default) | Scrollbars are displayed when content overflows. |
| `hidden` | Scrollbars are not rendered, but scrolling still works. |

### CSS

```css
scrollbar-visibility: hidden;
```

### Python

```python
widget.styles.scrollbar_visibility = "hidden"
```

## Property Interactions

- **`scrollbar-visibility: hidden` vs `scrollbar-size: 0`**: Both hide the scrollbar visually and allow continued scrolling. `scrollbar-size: 0` sets each axis independently; `scrollbar-visibility: hidden` hides all scrollbars on the widget at once.
- **`scrollbar-gutter: stable`** reserves space for the vertical scrollbar regardless of whether content overflows. This has no effect if the scrollbar is hidden via `scrollbar-visibility: hidden`.
- **Color properties** are only visible when the scrollbar is rendered (i.e., `scrollbar-visibility` is `visible` and the scrollbar size is greater than 0).
- All scrollbar style properties trigger a layout refresh when changed, except the color properties which only trigger a repaint.

## Source References

- Style definitions: `src/textual/css/styles.py` (the `Styles` class, around line 405)
- Color property descriptor: `ScrollbarColorProperty` in `src/textual/css/styles.py`
- Size property descriptor: `IntegerProperty` in `src/textual/css/styles.py`
