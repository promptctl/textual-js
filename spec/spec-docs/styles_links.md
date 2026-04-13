# Link Style Properties

Specification for CSS properties that control the appearance of inline action links in Textual widgets.

## Scope

These properties apply exclusively to Textual action links (links that trigger actions via `@click` metadata). They do not affect regular internet hyperlinks. Inline links are not widgets and cannot receive focus.

## Properties

There are six link style properties, organized into three pairs (normal state and hover state):

| Property | Type | Default | Description |
|---|---|---|---|
| `link-color` | `<color> [<percentage>]` | `transparent` | Foreground color of link text. |
| `link-color-hover` | `<color> [<percentage>]` | `white` | Foreground color of link text when the mouse cursor is over it. |
| `link-background` | `<color> [<percentage>]` | `transparent` | Background color of link text. |
| `link-background-hover` | `<color> [<percentage>]` | `$accent` | Background color of link text when the mouse cursor is over it. |
| `link-style` | `<text-style>` | `underline` | Text style (bold, italic, underline, etc.) of link text. |
| `link-style-hover` | `<text-style>` | `bold` | Text style of link text when the mouse cursor is over it. |

## Syntax

### Color properties

```
link-color: <color> [<percentage>];
link-color-hover: <color> [<percentage>];
link-background: <color> [<percentage>];
link-background-hover: <color> [<percentage>];
```

The `<color>` value defines the color. The optional `<percentage>` sets the opacity level.

### Style properties

```
link-style: <text-style>;
link-style-hover: <text-style>;
```

The `<text-style>` value accepts one or more space-separated text style tokens: `bold`, `italic`, `underline`, `reverse`, `strike`.

## CSS Examples

```css
link-color: red 70%;
link-color: $accent;

link-color-hover: black;
link-color-hover: red 70%;

link-background: dodgerblue;
link-background: $accent;

link-background-hover: red 70%;
link-background-hover: $accent;

link-style: bold;
link-style: bold italic underline;

link-style-hover: bold;
link-style-hover: bold italic reverse;
```

## Python API

All six properties are accessible on `widget.styles` using underscored names:

```python
widget.styles.link_color = "red 70%"
widget.styles.link_color = "$accent"
widget.styles.link_color = Color(100, 30, 173)

widget.styles.link_color_hover = "black"
widget.styles.link_color_hover = Color(100, 30, 173)

widget.styles.link_background = "dodgerblue"
widget.styles.link_background = Color(100, 30, 173)

widget.styles.link_background_hover = "$accent"
widget.styles.link_background_hover = Color(100, 30, 173)

widget.styles.link_style = "bold"
widget.styles.link_style = "bold italic reverse"

widget.styles.link_style_hover = "bold"
widget.styles.link_style_hover = "bold italic reverse"
```

Color properties accept string values or `Color` objects directly. Style properties accept string values only.

## Auto Link Color

Each color pair has an associated `auto_link_color` / `auto_link_color_hover` boolean property. When set to `True`, the link foreground color is computed automatically as the contrast text color against the link background, ignoring the explicit `link-color` / `link-color-hover` value. These properties default to `False`.

## Default Hover Behavior

Out of the box, action links display with `underline` text style and transparent color/background. On hover, the defaults change to `bold` text style, `white` foreground, and `$accent` background. This provides a visible hover effect without any custom CSS.

## Rendering

Link styles are resolved in `Widget.link_style` and `Widget.link_style_hover` properties. The resolved style combines:

1. The link background color composited over the widget background.
2. Either the explicit link foreground color, or an auto-contrast color if `auto_link_color` is enabled.
3. The text style flags (bold, italic, underline, etc.).

The resulting Rich `Style` is applied to any text span that carries `@click` metadata.

## Notes

- These properties are inherited through the widget hierarchy via CSS, so setting them on a container applies to all action links within descendant widgets.
- The `transparent` default for `link-color` and `link-background` means link text uses the widget's normal text color and background unless explicitly overridden.
- The `auto_link_color` mechanism uses `Color.get_contrast_text()` to ensure readability against the link background.
