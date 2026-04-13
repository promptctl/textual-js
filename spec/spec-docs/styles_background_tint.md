# Background, Tint, and Hatch Properties

## Overview

Textual provides several CSS properties for controlling widget background appearance. The `background` property sets a solid background color, `background-tint` blends a color with the existing background, `tint` blends a color with the entire widget (content and background), and `hatch` fills the background with a repeating character pattern.

## background

Sets the background color of a widget.

### Syntax

```
background: <color> [<percentage>];
```

The property accepts a `<color>` value optionally followed by a `<percentage>` to specify opacity (clamped between `0%` and `100%`).

### Default

`transparent` (no background color).

### CSS

```css
/* Named color */
background: blue;

/* With opacity */
background: red 20%;

/* RGB color */
background: rgb(100, 120, 200);

/* HSL color */
background: hsl(290, 70%, 80%);
```

### Python

```python
# Set with a string
widget.styles.background = "blue"
widget.styles.background = "hsl(351,32%,89%)"

from textual.color import Color
# Set with a Color object
widget.styles.background = Color.parse("pink")
widget.styles.background = Color.parse("#FF00FF")
widget.styles.background = Color(120, 60, 100)
```

## background-tint

Modifies the background color by tinting (blending) it with a new color. This is typically used to subtly change the background of a widget for emphasis, such as highlighting a focused widget.

### Syntax

```
background-tint: <color> [<percentage>];
```

The property accepts a `<color>` value optionally followed by a `<percentage>` to specify opacity (clamped between `0%` and `100%`).

### Behavior

- The tint color is blended with the widget's existing `background` color.
- The tint color should typically have less than 100% alpha to produce a blending effect. At 100% alpha, the tint color replaces the background color entirely.
- At 0% alpha, the tint has no visible effect.

### CSS

```css
/* 10% blue background tint */
background-tint: blue 10%;

/* 20% opacity via RGB alpha */
background-tint: rgb(100, 120, 200, 0.2);
```

### Python

```python
# Set with a string
widget.styles.background_tint = "blue 20%"

from textual.color import Color
# Set with a Color object
widget.styles.background_tint = Color(120, 60, 100, 0.5)
```

## tint

Blends a color with the entire widget, affecting both content and background. Unlike `background-tint`, which only modifies the background, `tint` overlays the entire rendered widget.

### Syntax

```
tint: <color> [<percentage>];
```

The property accepts a `<color>` value optionally followed by a `<percentage>` to specify opacity.

### Behavior

- The tint color should have an alpha component (specified directly or via the optional percentage), otherwise the tint will completely obscure the widget content.
- At 100% alpha, the widget content is fully hidden behind the tint color.
- At 0% alpha, the tint has no visible effect.

### CSS

```css
/* A red tint (could indicate an error) */
tint: red 20%;

/* A green tint via RGBA */
tint: rgba(0, 200, 0, 0.3);
```

### Python

```python
from textual.color import Color

# A red tint
widget.styles.tint = Color.parse("red").with_alpha(0.2)

# A green tint
widget.styles.tint = "rgba(0, 200, 0, 0.3)"
```

## hatch

Fills a widget's background with a repeating character for a textured effect. The hatch pattern is drawn behind widget content.

### Syntax

```
hatch: (<hatch> | CHARACTER) <color> [<percentage>];
```

The hatch type can be specified with a named constant or a custom single-character string.

### Hatch Types

| Value | Description |
|---|---|
| `cross` | A diagonal crossed line pattern. |
| `horizontal` | A horizontal line pattern. |
| `left` | A left-leaning diagonal line pattern. |
| `right` | A right-leaning diagonal line pattern. |
| `vertical` | A vertical line pattern. |
| `"<char>"` | A custom single character (quoted string). |

### CSS

```css
/* Red cross hatch */
hatch: cross red;

/* Right diagonals, 50% transparent green */
hatch: right green 50%;

/* Custom character in 80% blue */
hatch: "T" blue 80%;
```

### Python

```python
widget.styles.hatch = ("cross", "red")
widget.styles.hatch = ("right", "rgba(0,255,0,128)")
widget.styles.hatch = ("T", "blue")
```

## Property Interactions

- **`background` and `background-tint`**: The `background-tint` color is blended on top of the `background` color. Setting `background-tint` without a `background` blends with the inherited or default background.
- **`background` and `tint`**: The `tint` is applied after rendering, covering both background and content. The `background` is set first, content is rendered on top, and then `tint` overlays everything.
- **`background` and `hatch`**: The `hatch` pattern is drawn on top of the background color. Both are visible simultaneously when the hatch color has some transparency.
- **`background-tint` vs `tint`**: `background-tint` only affects the background region. `tint` affects the entire widget including text and other content.
