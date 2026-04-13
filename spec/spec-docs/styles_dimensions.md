# Dimension Style Properties

This spec describes the behavior of the dimension-related CSS style properties: `width`, `height`, `min-width`, `max-width`, `min-height`, and `max-height`.

## Scalar Values

All six dimension properties accept a `<scalar>` value. A scalar can be any of the following:

| Unit | Syntax | Description |
|------|--------|-------------|
| Cell | `10` | Absolute number of cells (columns for width, rows for height). Floats are truncated to integers. |
| Fraction | `1fr` | Proportional share of available space relative to sibling widgets. |
| Percent | `50%` | Percentage relative to the container widget's corresponding dimension (width for horizontal, height for vertical). |
| Width | `25w` | Percentage relative to the container widget's width, regardless of which dimension is being set. |
| Height | `75h` | Percentage relative to the container widget's height, regardless of which dimension is being set. |
| Viewport width | `25vw` | Percentage relative to the viewport width (terminal width minus docked left/right widgets). |
| Viewport height | `75vh` | Percentage relative to the viewport height (terminal height minus docked top/bottom widgets). |
| Auto | `auto` | Computes the optimal size to fit content without scrolling. |

### Programmatic Value Types

When set via Python (`widget.styles.<property>`), dimension properties accept:

- `None` -- clears the value (equivalent to unsetting the rule).
- `int` or `float` -- interpreted as cell units.
- Numeric strings (e.g., `"20"`) -- interpreted as cell units.
- `Scalar` objects directly.
- Unit strings (e.g., `"50%"`, `"1fr"`, `"25vw"`, `"auto"`).
- Invalid types (`complex`, `Decimal`, `list`, `tuple`, `dict`, non-numeric strings, scientific notation strings) raise `StyleValueError`.

Numeric values are normalized to `Scalar` with `Unit.CELLS` and `Unit.WIDTH` as the percent unit. Percentage-unit scalars are normalized: the unit becomes `Unit.WIDTH` and the value becomes a float.

## `width`

Sets the horizontal size of a widget.

- **Syntax (CSS):** `width: <scalar>;`
- **Default:** Not set (widget uses layout-determined sizing).
- **Scope:** By default, sets the width of the content area. If `box-sizing` is set to `border-box`, it sets the width of the border area (content + padding + border).
- **Percent unit:** When using `%`, the value is relative to the container's width.

### CSS Examples

```css
width: 10;       /* 10 columns */
width: 50%;      /* half the container width */
width: auto;     /* fit content */
width: 1fr;      /* proportional */
width: 25vw;     /* 25% of viewport width */
```

### Python Examples

```python
widget.styles.width = 10        # 10 columns (int)
widget.styles.width = "50%"     # half the container width
widget.styles.width = "auto"    # fit content
```

## `height`

Sets the vertical size of a widget.

- **Syntax (CSS):** `height: <scalar>;`
- **Default:** Not set (widget uses layout-determined sizing).
- **Scope:** By default, sets the height of the content area. If `box-sizing` is set to `border-box`, it sets the height of the border area (content + padding + border).
- **Percent unit:** When using `%`, the value is relative to the container's height.

### CSS Examples

```css
height: 10;      /* 10 rows */
height: 50%;     /* half the container height */
height: auto;    /* fit content */
height: 2fr;     /* proportional */
height: 25vh;    /* 25% of viewport height */
```

### Python Examples

```python
widget.styles.height = 10       # 10 rows (int)
widget.styles.height = "50%"    # half the container height
widget.styles.height = "auto"   # fit content
```

## `min-width`

Sets a lower bound on a widget's width. The widget's rendered width will never be less than this value.

- **Syntax (CSS):** `min-width: <scalar>;`
- **Default:** Not set (no minimum enforced).
- **Behavior:** If the widget's computed `width` is less than `min-width`, the widget is rendered at `min-width` instead. If the widget's computed `width` is already greater than or equal to `min-width`, this property has no effect.

### CSS Examples

```css
min-width: 10;      /* at least 10 columns */
min-width: 25vw;    /* at least 25% of viewport width */
```

### Python Examples

```python
widget.styles.min_width = 10       # at least 10 columns
widget.styles.min_width = "25vw"   # at least 25% of viewport width
```

## `max-width`

Sets an upper bound on a widget's width. The widget's rendered width will never exceed this value.

- **Syntax (CSS):** `max-width: <scalar>;`
- **Default:** Not set (no maximum enforced).
- **Behavior:** If the widget's computed `width` exceeds `max-width`, the widget is rendered at `max-width` instead. If the widget's computed `width` is already less than or equal to `max-width`, this property has no effect.

### CSS Examples

```css
max-width: 10;      /* no more than 10 columns */
max-width: 25vw;    /* no more than 25% of viewport width */
```

### Python Examples

```python
widget.styles.max_width = 10       # no more than 10 columns
widget.styles.max_width = "25vw"   # no more than 25% of viewport width
```

## `min-height`

Sets a lower bound on a widget's height. The widget's rendered height will never be less than this value.

- **Syntax (CSS):** `min-height: <scalar>;`
- **Default:** Not set (no minimum enforced).
- **Behavior:** If the widget's computed `height` is less than `min-height`, the widget is rendered at `min-height` instead. If the widget's computed `height` is already greater than or equal to `min-height`, this property has no effect.

### CSS Examples

```css
min-height: 10;     /* at least 10 rows */
min-height: 25vh;   /* at least 25% of viewport height */
```

### Python Examples

```python
widget.styles.min_height = 10      # at least 10 rows
widget.styles.min_height = "25vh"  # at least 25% of viewport height
```

## `max-height`

Sets an upper bound on a widget's height. The widget's rendered height will never exceed this value.

- **Syntax (CSS):** `max-height: <scalar>;`
- **Default:** Not set (no maximum enforced).
- **Behavior:** If the widget's computed `height` exceeds `max-height`, the widget is rendered at `max-height` instead. If the widget's computed `height` is already less than or equal to `max-height`, this property has no effect.

### CSS Examples

```css
max-height: 10;     /* no more than 10 rows */
max-height: 25vh;   /* no more than 25% of viewport height */
```

### Python Examples

```python
widget.styles.max_height = 10      # no more than 10 rows
widget.styles.max_height = "25vh"  # no more than 25% of viewport height
```

## Constraint Resolution Order

When `min-*` and `max-*` properties interact with `width`/`height`, the resolved size is determined as follows:

1. Compute the base size from `width`/`height` (or the layout default).
2. Clamp the base size to be at least `min-width`/`min-height` (if set).
3. Clamp the result to be at most `max-width`/`max-height` (if set).

If `min-width` exceeds `max-width` (or `min-height` exceeds `max-height`), the minimum takes precedence.

## Box Sizing Interaction

The `box-sizing` property affects what `width` and `height` measure:

- **`content-box` (default):** `width`/`height` set the size of the content area only. Padding and border are added outside this area, increasing the total rendered size.
- **`border-box`:** `width`/`height` set the size of the border area (content + padding + border). The content area shrinks to accommodate padding and border within the specified dimension.

The `min-*` and `max-*` constraints apply to the same box as `width`/`height` (i.e., they respect `box-sizing`).

## Cross-Axis Unit Behavior

The `w` and `h` units allow referencing the opposite axis of the container:

- `width: 25h` sets the width to 25% of the container's **height**.
- `height: 25w` sets the height to 25% of the container's **width**.

This enables aspect-ratio-like sizing where one dimension is derived from the other axis of the parent container.

## Fraction Unit Behavior

The `fr` unit distributes remaining space proportionally among siblings:

- If two siblings have `width: 1fr` and `width: 3fr`, the second is three times as wide as the first.
- Fraction units divide the space left over after all fixed-size and percentage-size siblings have been allocated.
- `fr` values are relative to siblings within the same container, not to the container itself.

## Auto Sizing

The `auto` value computes the optimal size to fit the widget's content without scrolling:

- For `width: auto`, the widget becomes as wide as its content requires (e.g., a label with text `"hello"` gets width 5).
- For `height: auto`, the widget becomes as tall as its content requires (e.g., single-line content gets height 1).
- The auto-computed size is still subject to `min-*` and `max-*` constraints.
