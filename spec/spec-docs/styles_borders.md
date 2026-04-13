# Borders and Outlines

## Overview

Textual provides two mechanisms for drawing boxes around widgets: **border** and **outline**. Both use the same set of border types but differ in how they interact with widget layout. Borders and outlines cannot coexist on the same edge of a widget.

## Border Types

The following border types are available for both `border` and `outline`:

| Type     | Description                                            |
|----------|--------------------------------------------------------|
| `ascii`  | Plus, hyphen, and vertical bar characters.             |
| `blank`  | Reserves space for a border without drawing one.       |
| `dashed` | Dashed line border.                                    |
| `double` | Double lined border.                                   |
| `heavy`  | Heavy border.                                          |
| `hidden` | Alias for `none`.                                      |
| `hkey`   | Horizontal key-line border.                            |
| `inner`  | Thick solid border.                                    |
| `none`   | Disabled border.                                       |
| `outer`  | Solid border with additional space around content.     |
| `panel`  | Solid border with thick top.                           |
| `round`  | Rounded corners.                                       |
| `solid`  | Solid border.                                          |
| `tall`   | Solid border with additional space top and bottom.     |
| `thick`  | Consistently thick across all edges.                   |
| `vkey`   | Vertical key-line border.                              |
| `wide`   | Solid border with additional space left and right.     |

Border types can be explored interactively via `textual borders`.

## Border

The `border` style draws a box around a widget. The border occupies space in the widget's layout, pushing content inward. The `box-sizing` style controls whether the border is included in or excluded from the widget's declared dimensions.

### Syntax

```
border: [<border>] [<color>] [<percentage>];
```

The border type and color are both optional. The optional percentage blends the border color with the background color.

Per-edge variants:

- `border-top`
- `border-right`
- `border-bottom`
- `border-left`

Each per-edge variant accepts the same syntax as the shorthand.

### CSS

```css
border: heavy white;
border-left: outer red;
border: round orange 50%;
```

### Python

In Python, borders are set as a tuple of `(border_type, color)`.

```python
widget.styles.border = ("heavy", "white")
widget.styles.border_left = ("outer", "red")
```

## Outline

The `outline` style draws a box around the content area of a widget. Unlike `border`, the outline frame is drawn **over** the content -- it does not consume layout space and will occlude any content underneath it.

Outline is useful for temporary emphasis such as focus indicators, since it does not affect layout.

### Syntax

```
outline: [<border>] [<color>];
```

Per-edge variants:

- `outline-top`
- `outline-right`
- `outline-bottom`
- `outline-left`

### CSS

```css
outline: heavy white;
outline-left: outer red;
```

### Python

```python
widget.styles.outline = ("heavy", "white")
widget.styles.outline_left = ("outer", "red")
```

## Border vs Outline

| Aspect             | Border                              | Outline                            |
|--------------------|-------------------------------------|------------------------------------|
| Layout impact      | Consumes space; pushes content in.  | No layout impact; drawn over content. |
| Content occlusion  | No -- content sits inside border.   | Yes -- outline overlaps content.   |
| `box-sizing` aware | Yes.                                | No.                                |
| Same-edge conflict | Cannot coexist with outline.        | Cannot coexist with border.        |
| Opacity blend      | Supports percentage for blending.   | No percentage parameter.           |

## Border Title

A widget can display a title string embedded in its top border edge via the `border_title` attribute (set in Python, not CSS). The title text and its positioning are styled through CSS properties.

### `border-title-align`

Sets the horizontal alignment of the border title along the top edge. Border corners remain visible regardless of alignment.

- **Values:** `left`, `center`, `right`
- **Default:** `left`

```css
border-title-align: center;
```

```python
widget.styles.border_title_align = "center"
```

### `border-title-color`

Sets the foreground color of the border title text. Accepts a `<color>` or `auto`. An optional `<percentage>` blends the color.

```css
border-title-color: red;
```

```python
widget.styles.border_title_color = "red"
```

### `border-title-background`

Sets the background color of the border title text. Accepts a `<color>` or `auto`. An optional `<percentage>` blends the color.

```css
border-title-background: blue;
```

```python
widget.styles.border_title_background = "blue"
```

### `border-title-style`

Sets the text style (bold, italic, underline, etc.) of the border title.

```css
border-title-style: bold underline;
```

```python
widget.styles.border_title_style = "bold underline"
```

## Border Subtitle

A widget can display a subtitle string embedded in its bottom border edge via the `border_subtitle` attribute (set in Python, not CSS). It mirrors the title properties but applies to the bottom edge.

### `border-subtitle-align`

Sets the horizontal alignment of the border subtitle along the bottom edge. Border corners remain visible.

- **Values:** `left`, `center`, `right`
- **Default:** `right`

```css
border-subtitle-align: center;
```

```python
widget.styles.border_subtitle_align = "center"
```

### `border-subtitle-color`

Sets the foreground color of the border subtitle text. Accepts a `<color>` or `auto`. An optional `<percentage>` blends the color.

```css
border-subtitle-color: red;
```

```python
widget.styles.border_subtitle_color = "red"
```

### `border-subtitle-background`

Sets the background color of the border subtitle text. Accepts a `<color>` or `auto`. An optional `<percentage>` blends the color.

```css
border-subtitle-background: blue;
```

```python
widget.styles.border_subtitle_background = "blue"
```

### `border-subtitle-style`

Sets the text style of the border subtitle.

```css
border-subtitle-style: bold underline;
```

```python
widget.styles.border_subtitle_style = "bold underline"
```

## Property Summary

| CSS Property                  | Python Attribute                       | Type / Values                        | Default   |
|-------------------------------|----------------------------------------|--------------------------------------|-----------|
| `border`                      | `widget.styles.border`                 | `(<border>, <color>)`                | `none`    |
| `border-top`                  | `widget.styles.border_top`             | `(<border>, <color>)`                | `none`    |
| `border-right`                | `widget.styles.border_right`           | `(<border>, <color>)`                | `none`    |
| `border-bottom`               | `widget.styles.border_bottom`          | `(<border>, <color>)`                | `none`    |
| `border-left`                 | `widget.styles.border_left`            | `(<border>, <color>)`                | `none`    |
| `outline`                     | `widget.styles.outline`                | `(<border>, <color>)`                | `none`    |
| `outline-top`                 | `widget.styles.outline_top`            | `(<border>, <color>)`                | `none`    |
| `outline-right`               | `widget.styles.outline_right`          | `(<border>, <color>)`                | `none`    |
| `outline-bottom`              | `widget.styles.outline_bottom`         | `(<border>, <color>)`                | `none`    |
| `outline-left`                | `widget.styles.outline_left`           | `(<border>, <color>)`                | `none`    |
| `border-title-align`          | `widget.styles.border_title_align`     | `left` / `center` / `right`         | `left`    |
| `border-title-color`          | `widget.styles.border_title_color`     | `<color>` or `auto`                 | `auto`    |
| `border-title-background`     | `widget.styles.border_title_background`| `<color>` or `auto`                 | `auto`    |
| `border-title-style`          | `widget.styles.border_title_style`     | `<text-style>`                       | (none)    |
| `border-subtitle-align`       | `widget.styles.border_subtitle_align`  | `left` / `center` / `right`         | `right`   |
| `border-subtitle-color`       | `widget.styles.border_subtitle_color`  | `<color>` or `auto`                 | `auto`    |
| `border-subtitle-background`  | `widget.styles.border_subtitle_background` | `<color>` or `auto`             | `auto`    |
| `border-subtitle-style`       | `widget.styles.border_subtitle_style`  | `<text-style>`                       | (none)    |

## Related Styles

- `box-sizing` -- Controls whether border width is included in declared widget dimensions.
