# Display, Visibility, and Opacity

## Overview

Textual provides several styles that control whether and how a widget appears on screen. **display** controls whether a widget participates in layout at all. **visibility** controls whether a widget is drawn while still reserving its layout space. **opacity** and **text-opacity** control the degree to which a widget or its text blends with the background.

## Display

The `display` style determines whether a widget is included in the layout. A widget with `display: none` is removed from the layout entirely -- no space is reserved for it.

### Syntax

```
display: block | none;
```

### Values

| Value             | Description                                                              |
|-------------------|--------------------------------------------------------------------------|
| `block` (default) | Display the widget as normal.                                            |
| `none`            | The widget is not displayed and space will no longer be reserved for it. |

### CSS

```css
display: block;
display: none;
```

### Python

```python
widget.styles.display = "block"
widget.styles.display = "none"
```

The `Widget.display` property also accepts boolean values as a shortcut:

```python
widget.display = False  # Equivalent to display: none
widget.display = True   # Equivalent to display: block
```

## Visibility

The `visibility` style determines whether a widget is drawn. Unlike `display: none`, an invisible widget still occupies its layout space -- it is simply not rendered.

### Syntax

```
visibility: visible | hidden;
```

### Values

| Value               | Description                             |
|---------------------|-----------------------------------------|
| `visible` (default) | The widget is displayed as normal.      |
| `hidden`            | The widget is invisible.                |

### Inheritance

Children inherit the visibility of their parent by default. If a container is set to `visibility: hidden`, all its children are also hidden. However, a child can override this by explicitly setting `visibility: visible`, making that child visible even inside an invisible container.

### CSS

```css
visibility: visible;
visibility: hidden;
```

### Python

```python
widget.styles.visibility = "visible"
widget.styles.visibility = "hidden"
```

The `Widget.visible` property also accepts boolean values as a shortcut:

```python
widget.visible = False  # Equivalent to visibility: hidden
widget.visible = True   # Equivalent to visibility: visible
```

## Display vs Visibility

| Aspect            | `display: none`                        | `visibility: hidden`                   |
|-------------------|----------------------------------------|----------------------------------------|
| Layout space      | No space reserved.                     | Space is reserved.                     |
| Child inheritance | Children are also removed from layout. | Children inherit hidden but can override to visible. |
| Effect            | Widget does not exist in layout.       | Widget exists in layout but is not drawn. |

## Opacity

The `opacity` style controls how much a widget blends with its background. Terminals do not support true transparency; Textual approximates opacity by blending widget colors with the background color.

### Syntax

```
opacity: <number> | <percentage>;
```

The value is a number between `0` and `1`, or a percentage between `0%` and `100%`. A value of `0` (or `0%`) makes the widget fully transparent (showing only the background color). A value of `1` (or `100%`) renders the widget fully opaque (normal).

### Default

`100%` (fully opaque).

### CSS

```css
opacity: 50%;
opacity: 0.7;
```

### Python

```python
widget.styles.opacity = "50%"
```

## Text-Opacity

The `text-opacity` style blends only the foreground color (text) with the widget's background color, leaving borders and other non-text elements unaffected.

### Syntax

```
text-opacity: <number> | <percentage>;
```

The value is a number between `0` and `1`, or a percentage between `0%` and `100%`. A value of `0` (or `0%`) makes the foreground color match the background, rendering text invisible. A value of `1` (or `100%`) displays text at full opacity (normal).

### Default

`100%` (fully opaque).

### CSS

```css
text-opacity: 50%;
text-opacity: 0.3;
```

### Python

```python
widget.styles.text_opacity = "50%"
```

## Opacity vs Text-Opacity

| Aspect       | `opacity`                                    | `text-opacity`                               |
|--------------|----------------------------------------------|----------------------------------------------|
| What it affects | The entire widget (text, borders, all content). | Only the foreground (text) color.          |
| Background   | Widget blends with parent background.        | Text blends with the widget's own background. |

## Property Summary

| CSS Property    | Python Attribute               | Type / Values                  | Default   |
|-----------------|--------------------------------|--------------------------------|-----------|
| `display`       | `widget.styles.display`        | `block` / `none`               | `block`   |
| `visibility`    | `widget.styles.visibility`     | `visible` / `hidden`           | `visible` |
| `opacity`       | `widget.styles.opacity`        | `<number>` or `<percentage>`   | `100%`    |
| `text-opacity`  | `widget.styles.text_opacity`   | `<number>` or `<percentage>`   | `100%`    |
