# Overflow and Scroll Control Properties

## Overview

Textual provides a set of CSS properties that control how content overflow is handled and how scrollbars behave. The `overflow` property determines whether scrollbars appear, while `scrollbar-gutter`, `scrollbar-size`, and `scrollbar-visibility` provide finer control over scrollbar layout and display.

## overflow

The `overflow` property specifies if and when scrollbars should be displayed on a container widget.

### Syntax

The shorthand sets both axes at once:

```
overflow: <overflow> <overflow>;
          /* horizontal vertical */
```

Individual properties:

```
overflow-x: <overflow>;
overflow-y: <overflow>;
```

### Values

| Value | Description |
|---|---|
| `auto` (default) | Scrollbars are shown automatically when content overflows. |
| `hidden` | Content is clipped and no scrollbar is displayed. |
| `scroll` | A scrollbar is always shown, even if content does not overflow. |

### Defaults

The default for containers is `overflow: auto auto`.

Some built-in containers override these defaults. For example, `Horizontal` and `VerticalScroll` set axis-specific overflows.

### CSS

```css
/* Automatic scrollbars on both axes (the default) */
overflow: auto auto;

/* Hide the vertical scrollbar */
overflow-y: hidden;

/* Always show the horizontal scrollbar */
overflow-x: scroll;
```

### Python

Overflow cannot be set for both axes simultaneously in Python. Set each axis independently:

```python
# Hide the vertical scrollbar
widget.styles.overflow_y = "hidden"

# Always show the horizontal scrollbar
widget.styles.overflow_x = "scroll"
```

## scrollbar-gutter

Reserves space for the vertical scrollbar even when it is not visible, preventing layout shifts when content changes cause a scrollbar to appear or disappear.

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
scrollbar-gutter: auto;
scrollbar-gutter: stable;
```

### Python

```python
widget.styles.scrollbar_gutter = "auto"
widget.styles.scrollbar_gutter = "stable"
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

### CSS

```css
/* Set horizontal scrollbar to 10, and vertical scrollbar to 4 */
scrollbar-size: 10 4;

/* Set horizontal scrollbar to 10 */
scrollbar-size-horizontal: 10;

/* Set vertical scrollbar to 4 */
scrollbar-size-vertical: 4;
```

### Python

There is no Python equivalent for the shorthand `scrollbar-size`. Set each axis independently:

```python
widget.styles.scrollbar_size_horizontal = 10
widget.styles.scrollbar_size_vertical = 4
```

### Notes

- Setting a scrollbar size to `0` hides the scrollbar visually while still allowing scrolling via mousewheel, keyboard, or gestures.
- Values are in terminal cells.

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
scrollbar-visibility: visible;
scrollbar-visibility: hidden;
```

### Python

```python
widget.styles.scrollbar_visibility = "visible"
widget.styles.scrollbar_visibility = "hidden"
```

## Property Interactions

- **`overflow: hidden` vs `scrollbar-visibility: hidden`**: `overflow: hidden` disables scrolling entirely and hides the scrollbar. `scrollbar-visibility: hidden` hides the scrollbar but scrolling still works via mousewheel, keyboard, or gestures.
- **`overflow: scroll`** forces a scrollbar to always be visible, regardless of whether content overflows.
- **`scrollbar-gutter: stable`** reserves space for the vertical scrollbar regardless of whether content overflows. This prevents layout shifts but has no visible effect if the scrollbar is hidden via `scrollbar-visibility: hidden`.
- **`scrollbar-size: 0`** hides the scrollbar visually on a per-axis basis while still allowing scrolling. This achieves a similar visual effect to `scrollbar-visibility: hidden` but is controlled independently per axis.
- All overflow and scrollbar properties trigger a layout refresh when changed.
