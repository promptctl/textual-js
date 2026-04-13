# Text Style Properties

## Overview

Textual provides four CSS properties that control text rendering within widgets: `text-style` for visual decoration, `text-align` for horizontal alignment, `text-wrap` for line wrapping behavior, and `text-overflow` for handling text that exceeds available width.

## text-style

Sets the visual style (decoration) applied to text in a widget.

### Syntax

```
text-style: <text-style>;
```

### Values

The value `none` removes all styling. Otherwise, any space-separated combination of the following is accepted:

| Value       | Description                                              |
|-------------|----------------------------------------------------------|
| `none`      | No styling applied (plain text).                         |
| `bold`      | Bold text.                                               |
| `italic`    | Italic text.                                             |
| `reverse`   | Reverse video (foreground and background colors swap).   |
| `strike`    | Strikethrough text.                                      |
| `underline` | Underlined text.                                         |

Multiple values can be combined in a single declaration to apply several styles simultaneously.

### Default

`none` (no text styling).

### CSS

```css
text-style: italic;
text-style: bold underline;
text-style: strike bold italic reverse;
```

### Python

```python
widget.styles.text_style = "italic"
widget.styles.text_style = "bold underline"
```

## text-align

Sets the horizontal alignment of text within a widget.

### Syntax

```
text-align: <text-align>;
```

### Values

| Value     | Description                                    |
|-----------|------------------------------------------------|
| `start`   | Alias for `left` (will change with RTL support). |
| `end`     | Alias for `right` (will change with RTL support). |
| `left`    | Left-aligned text.                              |
| `right`   | Right-aligned text.                             |
| `center`  | Center-aligned text.                            |
| `justify` | Text is justified to fill the widget width.     |

### Default

`start` (equivalent to `left` in LTR contexts).

### CSS

```css
text-align: right;
text-align: center;
text-align: justify;
```

### Python

```python
widget.styles.text_align = "right"
```

### Related Properties

- `align` sets the alignment of children widgets inside a container.
- `content-align` sets the alignment of content inside a widget.

## text-wrap

Controls whether text is word-wrapped within the widget.

### Syntax

```
text-wrap: wrap | nowrap;
```

### Values

| Value    | Description                                        |
|----------|----------------------------------------------------|
| `wrap`   | Text is word-wrapped at the widget boundary.       |
| `nowrap` | Text is not wrapped; it remains on a single line.  |

### Default

`wrap`.

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

### Behavior

When `nowrap` is set, text that exceeds the widget width will overflow. The `text-overflow` property controls how that overflow is handled.

## text-overflow

Defines how text is handled when it overflows the available width. Overflow occurs when wrapping is disabled (via `text-wrap: nowrap`) or when a single word is too wide for its container.

### Syntax

```
text-overflow: clip | fold | ellipsis;
```

### Values

| Value      | Description                                                              |
|------------|--------------------------------------------------------------------------|
| `clip`     | Overflowing text is clipped; the overflow portion is not rendered.        |
| `fold`     | Overflowing text folds onto the next line(s), breaking mid-word if needed. |
| `ellipsis` | Overflowing text is truncated and the last visible character is replaced with an ellipsis. |

### Default

`clip`.

### CSS

```css
text-overflow: clip;
text-overflow: fold;
text-overflow: ellipsis;
```

### Python

```python
widget.styles.text_overflow = "ellipsis"
```

### Behavior

- `clip` produces a single line with the overflowing portion removed entirely.
- `fold` wraps at the character level (not word level), so words may be broken across lines.
- `ellipsis` produces a single line like `clip`, but replaces the last visible character with an ellipsis character to indicate truncated content.

## Interaction Between text-wrap and text-overflow

`text-overflow` only has a visible effect when text actually overflows. This happens in two situations:

1. `text-wrap` is set to `nowrap`, causing the entire text to remain on one line.
2. A single word is wider than the container, even with `text-wrap: wrap` enabled.

When `text-wrap: wrap` is active and all words fit within the container width, `text-overflow` has no effect because there is no overflow to handle.
