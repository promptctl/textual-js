# Alignment

## Overview

Textual provides two alignment mechanisms: **align** positions a container's children within available space, while **content-align** positions content inside a widget. Both use the same axis model with horizontal and vertical components, but operate at different levels of the widget hierarchy.

## Axis Values

Both alignment styles use the same set of values for each axis:

| Axis       | Values                       |
|------------|------------------------------|
| Horizontal | `left`, `center`, `right`    |
| Vertical   | `top`, `middle`, `bottom`    |

## Align

The `align` style controls where a container's **children** are positioned within the container's available space. It is applied to the parent container, not to the children themselves.

### Syntax

```
align: <horizontal> <vertical>;
align-horizontal: <horizontal>;
align-vertical: <vertical>;
```

The shorthand `align` takes a horizontal value followed by a vertical value. The individual axis properties `align-horizontal` and `align-vertical` set alignment on a single axis.

### CSS

```css
align: center middle;
align: right top;
align-horizontal: right;
align-vertical: middle;
```

### Python

```python
widget.styles.align = ("center", "middle")
widget.styles.align = ("right", "top")
widget.styles.align_horizontal = "right"
widget.styles.align_vertical = "middle"
```

## Content-Align

The `content-align` style controls how content is positioned **inside** a widget. This is distinct from `align`, which positions child widgets within a container.

### Syntax

```
content-align: <horizontal> <vertical>;
content-align-horizontal: <horizontal>;
content-align-vertical: <vertical>;
```

The shorthand `content-align` takes a horizontal value followed by a vertical value. The individual axis properties `content-align-horizontal` and `content-align-vertical` set alignment on a single axis.

### CSS

```css
content-align: center middle;
content-align: right top;
content-align-horizontal: right;
content-align-vertical: middle;
```

### Python

```python
widget.styles.content_align = ("center", "middle")
widget.styles.content_align = ("right", "top")
widget.styles.content_align_horizontal = "right"
widget.styles.content_align_vertical = "middle"
```

## Align vs Content-Align

| Aspect         | `align`                                      | `content-align`                            |
|----------------|----------------------------------------------|--------------------------------------------|
| What it aligns | Child widgets within a container.            | Content inside a single widget.            |
| Applied to     | The parent container.                        | The widget containing the content.         |
| Use case       | Positioning children in layout space.        | Positioning text or rendered content.      |

## Property Summary

| CSS Property               | Python Attribute                           | Type / Values                    | Default |
|----------------------------|--------------------------------------------|----------------------------------|---------|
| `align`                    | `widget.styles.align`                      | `(<horizontal>, <vertical>)`     | -       |
| `align-horizontal`         | `widget.styles.align_horizontal`           | `<horizontal>`                   | -       |
| `align-vertical`           | `widget.styles.align_vertical`             | `<vertical>`                     | -       |
| `content-align`            | `widget.styles.content_align`              | `(<horizontal>, <vertical>)`     | -       |
| `content-align-horizontal` | `widget.styles.content_align_horizontal`   | `<horizontal>`                   | -       |
| `content-align-vertical`   | `widget.styles.content_align_vertical`     | `<vertical>`                     | -       |

## Related Styles

- `text-align` -- Sets the alignment of text within a widget (distinct from both `align` and `content-align`).
