# Text Wrapping and Overflow Properties

## Overview

Textual provides two CSS properties that control how text is displayed when it does not fit within a widget's available width. The `text-wrap` property controls whether text is word-wrapped, and `text-overflow` controls what happens to text that exceeds the available width (either because wrapping is disabled or because a single word is too long).

## text-wrap

Controls whether text is word-wrapped within a widget.

### Syntax

```
text-wrap: wrap | nowrap;
```

### Values

| Value | Description |
|---|---|
| `wrap` (default) | Text is word-wrapped at the widget boundary. Long lines break at word boundaries to fit within the available width. |
| `nowrap` | Text is not wrapped. Lines extend beyond the widget width and are subject to `text-overflow` behavior. |

### CSS

```css
text-wrap: wrap;
text-wrap: nowrap;
```

### Python

```python
widget.styles.text_wrap = "wrap"
widget.styles.text_wrap = "nowrap"
```

## text-overflow

Defines what happens when text overflows the available width. Text overflow occurs when wrapping is disabled (via `text-wrap: nowrap`) or when a single word is too long to fit within the container width.

### Syntax

```
text-overflow: clip | fold | ellipsis;
```

### Values

| Value | Description |
|---|---|
| `clip` | Overflowing text is clipped. The overflow portion is removed from the rendered output, resulting in a single truncated line. |
| `fold` | Overflowing text folds onto the next line. Unlike word wrapping, folding does not respect word boundaries, so words may be broken across lines. |
| `ellipsis` | Overflowing text is truncated and the last visible character is replaced with an ellipsis (`...`). This indicates to the user that additional text exists beyond the visible area. |

### CSS

```css
text-overflow: clip;
text-overflow: fold;
text-overflow: ellipsis;
```

### Python

```python
widget.styles.text_overflow = "clip"
widget.styles.text_overflow = "fold"
widget.styles.text_overflow = "ellipsis"
```

## Property Interactions

- **`text-wrap` and `text-overflow`**: The `text-overflow` property is most relevant when `text-wrap` is set to `nowrap`, because wrapping normally prevents overflow. However, `text-overflow` also applies when a single word is wider than the container, even with wrapping enabled.
- **`text-wrap: wrap` with `text-overflow: fold`**: When wrapping is enabled, fold behavior is largely redundant since the text already wraps at word boundaries. The distinction is that `fold` breaks at character boundaries while `wrap` breaks at word boundaries.
- **`text-overflow: ellipsis`** is similar to `clip` but provides a visual indicator that text has been truncated.
