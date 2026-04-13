# Styles: Colors and Opacity

Color-related style properties that control text color, background color, tinting, and opacity of widgets and their content.

## Properties at a Glance

| Property | Type | Default | Affects |
|---|---|---|---|
| `color` | `<color>` or `auto` | `Color(255, 255, 255)` (white) | Foreground text color |
| `background` | `<color>` | `Color(0, 0, 0, 0)` (transparent black) | Widget background |
| `background-tint` | `<color>` | `Color(0, 0, 0, 0)` (transparent) | Blended over background |
| `tint` | `<color>` | `transparent` | Blended over entire widget |
| `opacity` | `<number>` or `<percentage>` | `1.0` (fully opaque) | Entire widget (including children) |
| `text-opacity` | `<number>` or `<percentage>` | `1.0` (fully opaque) | Foreground text only |

## `color`

Sets the foreground (text) color of a widget.

### Syntax

```
color: (<color> | auto) [<percentage>];
```

- Accepts a `<color>` value followed by an optional `<percentage>` that controls the color's alpha/opacity.
- The special value `auto` instructs Textual to pick white or black text automatically for best contrast against the current background.

### Python

```python
widget.styles.color = "blue"
widget.styles.color = "auto"
widget.styles.color = Color.parse("pink")
```

## `background`

Sets the background color of a widget.

### Syntax

```
background: <color> [<percentage>];
```

- Accepts a `<color>` optionally followed by a `<percentage>` for opacity (clamped 0%--100%).
- The default is fully transparent (`Color(0, 0, 0, 0)`), meaning the parent's background shows through.

### Python

```python
widget.styles.background = "blue"
widget.styles.background = "hsl(351, 32%, 89%)"
widget.styles.background = Color(120, 60, 100)
```

## `background-tint`

Blends a color with the widget's existing background color. Used for subtle emphasis (e.g., highlighting a focused widget).

### Syntax

```
background-tint: <color> [<percentage>];
```

- Accepts a `<color>` optionally followed by a `<percentage>` for opacity (clamped 0%--100%).
- The tint color should typically have alpha less than 100%; at 100% alpha the tint replaces the background entirely.
- Default is fully transparent (`Color(0, 0, 0, 0)`), meaning no tinting.

### Python

```python
widget.styles.background_tint = "blue 20%"
widget.styles.background_tint = Color(120, 60, 100, 0.5)
```

## `tint`

Blends a color over the entire rendered widget (text, borders, background -- everything).

### Syntax

```
tint: <color> [<percentage>];
```

- Accepts a `<color>` optionally followed by a `<percentage>`.
- The color should have an alpha component (via the color itself or the trailing percentage); without alpha, the tint will completely obscure widget content.
- Default is `transparent`.

### Python

```python
widget.styles.tint = "rgba(0, 200, 0, 0.3)"
widget.styles.tint = Color.parse("red").with_alpha(0.2)
```

## `opacity`

Sets the overall opacity of a widget by blending it with its parent's background color. Terminals cannot do true transparency; Textual approximates it by color blending.

### Syntax

```
opacity: <number> | <percentage>;
```

- As a `<number>`: value between `0` (invisible, matches background) and `1` (fully opaque).
- As a `<percentage>`: `0%` (invisible) to `100%` (fully opaque).
- Values are clamped to the 0--1 range.
- Default is `1.0`.
- **Propagates to children**: changing a widget's opacity affects all its descendants.

### Python

```python
widget.styles.opacity = 0.5
widget.styles.opacity = "50%"
```

## `text-opacity`

Blends the foreground (text) color toward the widget's background color, making text appear faded. Does not affect borders, scrollbars, or other non-text elements.

### Syntax

```
text-opacity: <number> | <percentage>;
```

- As a `<number>`: value between `0` (text invisible, matches background) and `1` (fully opaque text).
- As a `<percentage>`: `0%` (invisible) to `100%` (fully opaque).
- Values are clamped to the 0--1 range.
- Default is `1.0`.
- Does **not** propagate to children (unlike `opacity`).

### Python

```python
widget.styles.text_opacity = 0.7
widget.styles.text_opacity = "50%"
```

## Color Value Formats

All `<color>` properties accept these formats:

| Format | Example |
|---|---|
| Named color | `red`, `blue`, `dodgerblue` |
| Hex | `#FF00FF`, `#f0f` |
| RGB function | `rgb(100, 120, 200)` |
| RGBA function | `rgba(0, 200, 0, 0.3)` |
| HSL function | `hsl(290, 70%, 80%)` |
| HSLA function | `hsla(290, 70%, 80%, 0.5)` |
| Textual ANSI colors | `ansi_red`, `ansi_bright_magenta` |

When a trailing `<percentage>` follows a color value (e.g., `red 20%`), it multiplies the color's alpha channel, controlling how much of the color is applied.

## Interaction Between Properties

### Rendering order

The compositing pipeline applies these properties in the following order:

1. **`background`** -- establishes the base background color of the widget.
2. **`background-tint`** -- blended over the background. At 0% alpha it has no effect; at 100% alpha it replaces the background.
3. **`color`** -- the foreground text is rendered on top.
4. **`text-opacity`** -- the foreground color is blended toward the (already-tinted) background. Only affects text, not borders or other chrome.
5. **`tint`** -- applied over the entire rendered widget (all pixels: text, borders, background).
6. **`opacity`** -- the final composited widget is blended toward the parent's background color. Affects the widget and all its children.

### Key distinctions

- **`opacity` vs `text-opacity`**: `opacity` fades the entire widget (including borders, scrollbars, and children). `text-opacity` fades only the text color. Use `text-opacity` for dimmed/disabled text appearance while keeping chrome fully visible.
- **`background-tint` vs `tint`**: `background-tint` modifies only the background color. `tint` covers the entire widget output (text, borders, everything). Use `background-tint` for subtle background emphasis; use `tint` for full-widget color overlays (e.g., an error state indicator).
- **`color: auto`**: Automatically selects white or black text for maximum contrast against the resolved background. Useful when backgrounds are dynamic or theme-dependent.
- **`opacity` propagation**: `opacity` is the only color-related property declared with `children=True`, meaning changing it triggers a refresh of the widget and all descendants. `text-opacity` refreshes only the widget itself.
