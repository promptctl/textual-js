# Pointer Properties

## Overview

The `pointer` style controls the shape of the mouse cursor when it hovers over a widget. This property requires terminal support for the Kitty pointer shapes protocol. Terminals that do not support this protocol will ignore the property and display the default cursor.

## pointer

### Syntax

```
pointer: <pointer>;
```

### Default

`default`

### Values

| Value | Description |
|---|---|
| `default` | Default pointer shape. |
| `pointer` | Pointing hand (typically used for clickable elements). |
| `text` | Text selection cursor (I-beam). |
| `crosshair` | Crosshair cursor. |
| `help` | Help cursor (often a question mark). |
| `wait` | Wait/busy cursor. |
| `progress` | Progress cursor (indicating background activity). |
| `move` | Move cursor (four-directional arrows). |
| `grab` | Open hand (grabbable). |
| `grabbing` | Closed hand (actively grabbing). |
| `cell` | Cell selection cursor. |
| `vertical-text` | Vertical text selection cursor. |
| `alias` | Alias/shortcut cursor. |
| `copy` | Copy cursor. |
| `no-drop` | No drop allowed cursor. |
| `not-allowed` | Not allowed/prohibited cursor. |
| `n-resize` | Resize cursor pointing north. |
| `s-resize` | Resize cursor pointing south. |
| `e-resize` | Resize cursor pointing east. |
| `w-resize` | Resize cursor pointing west. |
| `ne-resize` | Resize cursor pointing northeast. |
| `nw-resize` | Resize cursor pointing northwest. |
| `se-resize` | Resize cursor pointing southeast. |
| `sw-resize` | Resize cursor pointing southwest. |
| `ew-resize` | Resize cursor for horizontal resizing. |
| `ns-resize` | Resize cursor for vertical resizing. |
| `nesw-resize` | Resize cursor for diagonal (NE-SW) resizing. |
| `nwse-resize` | Resize cursor for diagonal (NW-SE) resizing. |
| `zoom-in` | Zoom in cursor (magnifying glass with +). |
| `zoom-out` | Zoom out cursor (magnifying glass with -). |

### CSS

```css
/* Show a pointing hand cursor */
pointer: pointer;

/* Show a text selection cursor */
pointer: text;

/* Show a grab cursor */
pointer: grab;

/* Show a crosshair cursor */
pointer: crosshair;
```

### Python

```python
widget.styles.pointer = "pointer"
widget.styles.pointer = "text"
widget.styles.pointer = "grab"
widget.styles.pointer = "crosshair"
```

### Notes

- Many built-in widgets (e.g., buttons) and scrollbars set the pointer style automatically.
- The pointer shape only changes while the mouse cursor is within the widget's bounds.
- This feature depends on the Kitty pointer shapes protocol. Terminals without support will display the default system cursor regardless of the `pointer` value.
