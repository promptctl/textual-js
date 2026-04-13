# Layout-Related Style Properties

Specification for CSS style properties that control widget positioning, arrangement, and visibility in Textual.

## display

Controls whether a widget is included in layout.

### Syntax

```
display: block | none;
```

### Values

| Value | Description |
|---|---|
| `block` (default) | Widget participates in layout normally. |
| `none` | Widget is removed from layout entirely. No space is reserved for it. |

### Python API

```python
widget.styles.display = "block"
widget.styles.display = "none"
```

The `Widget.display` property provides a boolean shortcut:

```python
widget.display = False  # equivalent to styles.display = "none"
widget.display = True   # equivalent to styles.display = "block"
```

### Behavior

- A widget with `display: none` is not rendered and occupies no space.
- Differs from `visibility: hidden`, which hides the widget but still reserves its space in layout.

---

## visibility

Controls whether a widget is visible while still reserving its space in layout.

### Syntax

```
visibility: visible | hidden;
```

### Values

| Value | Description |
|---|---|
| `visible` (default) | Widget is rendered normally. |
| `hidden` | Widget is invisible but still occupies space in layout. |

### Inheritance

Children inherit the visibility of their parent by default. If a container is `hidden`, all children are hidden. However, a child can override this by explicitly setting `visibility: visible` on itself, making the child visible even inside an invisible container.

### Python API

```python
widget.styles.visibility = "visible"
widget.styles.visibility = "hidden"
```

The `Widget.visible` property provides a boolean shortcut:

```python
widget.visible = False  # equivalent to styles.visibility = "hidden"
widget.visible = True   # equivalent to styles.visibility = "visible"
```

### Behavior

- A hidden widget still occupies its normal space in the layout (unlike `display: none`).
- Children inherit visibility from parents but can override it.

---

## layout

Defines how a widget arranges its children.

### Syntax

```
layout: vertical | horizontal | grid;
```

### Values

| Value | Description |
|---|---|
| `vertical` (default) | Children are arranged top to bottom. |
| `horizontal` | Children are arranged left to right. |
| `grid` | Children are arranged in a two-dimensional grid. Grid properties (`grid-size`, `grid-columns`, `grid-rows`, etc.) configure the grid. |

### Python API

```python
widget.styles.layout = "vertical"
widget.styles.layout = "horizontal"
widget.styles.layout = "grid"
```

### Behavior

- `vertical` is the default layout for all containers.
- `horizontal` wraps children into rows when the container width is exceeded (if overflow allows).
- `grid` requires additional grid configuration styles (see grid style properties).
- Textual's `Horizontal` and `Vertical` container widgets set this style automatically.

---

## dock

Fixes a widget to an edge of its parent container.

### Syntax

```
dock: top | right | bottom | left;
```

### Values

| Value | Description |
|---|---|
| `top` | Widget is fixed to the top edge. |
| `right` | Widget is fixed to the right edge. |
| `bottom` | Widget is fixed to the bottom edge. |
| `left` | Widget is fixed to the left edge. |

There is no default value; `dock` is unset by default.

### Python API

```python
widget.styles.dock = "top"
widget.styles.dock = "right"
widget.styles.dock = "bottom"
widget.styles.dock = "left"
```

### Behavior

- A docked widget is removed from the normal layout flow and fixed to the specified edge of its parent container.
- Docked widgets remain fixed even when the container scrolls.
- Multiple widgets can be docked to the same edge; they stack in DOM order.
- A `top` or `bottom` docked widget spans the full width of its container. A `left` or `right` docked widget spans the full height.
- Docked widgets reduce the available area for non-docked children.

---

## position

Controls whether `offset` is applied relative to the widget's normal position or relative to the container origin.

### Syntax

```
position: relative | absolute;
```

### Values

| Value | Description |
|---|---|
| `relative` (default) | Offset is applied from the widget's normal layout position. |
| `absolute` | Offset is applied from the top-left corner of the parent container. |

### Python API

```python
widget.styles.position = "relative"
widget.styles.position = "absolute"
```

### Behavior

- With `relative` positioning, `offset: 1 1` moves the widget 1 cell right and 1 line down from where layout placed it.
- With `absolute` positioning, `offset: 1 1` places the widget 1 cell right and 1 line down from the container's top-left corner.
- Absolute positioning takes precedence over the parent's `align` rule.
- Position does not remove the widget from layout flow; the original space is still reserved (unlike CSS `position: absolute`).

---

## offset

Defines a positional offset for a widget.

### Syntax

```
offset: <scalar> <scalar>;
offset-x: <scalar>;
offset-y: <scalar>;
```

The two scalars define horizontal (x) and vertical (y) offsets respectively. Scalars can be integer cells or percentages (e.g., `50%` means 50% of the widget's own width/height).

### Default

`0 0` (no offset).

### Python API

```python
# Set both axes at once (required; cannot set a single axis)
widget.styles.offset = (2, 4)
```

Note: Python API requires setting both axes simultaneously as a tuple. There is no separate `offset_x` / `offset_y` setter.

### Behavior

- Offset moves the widget visually without affecting layout. Other widgets are not displaced.
- Whether the offset is relative to the widget's layout position or the container origin depends on the `position` style.
- Scalar values can be negative to move left/up.
- Percentage values are relative to the widget's own dimensions.
- Offset can be animated for smooth transitions.

---

## align

Controls the alignment of a container's children within that container.

### Syntax

```
align: <horizontal> <vertical>;
align-horizontal: <horizontal>;
align-vertical: <vertical>;
```

### Horizontal Values

| Value | Description |
|---|---|
| `left` (default) | Children are aligned to the left edge. |
| `center` | Children are centered horizontally. |
| `right` | Children are aligned to the right edge. |

### Vertical Values

| Value | Description |
|---|---|
| `top` (default) | Children are aligned to the top edge. |
| `middle` | Children are centered vertically. |
| `bottom` | Children are aligned to the bottom edge. |

### Python API

```python
# Set both axes
widget.styles.align = ("center", "middle")

# Set individual axes
widget.styles.align_horizontal = "right"
widget.styles.align_vertical = "middle"
```

### Behavior

- `align` is set on a **container** and affects the position of its **children**.
- It positions children within the available space of the container.
- Only affects children that are smaller than the container in the relevant dimension.
- Differs from `content-align`, which aligns content **inside** a widget rather than child widgets inside a container.
- Absolute-positioned children ignore the parent's `align` rule.

---

## content-align

Controls the alignment of a widget's own content within its bounding box.

### Syntax

```
content-align: <horizontal> <vertical>;
content-align-horizontal: <horizontal>;
content-align-vertical: <vertical>;
```

### Horizontal Values

| Value | Description |
|---|---|
| `left` (default) | Content is aligned to the left. |
| `center` | Content is centered horizontally. |
| `right` | Content is aligned to the right. |

### Vertical Values

| Value | Description |
|---|---|
| `top` (default) | Content is aligned to the top. |
| `middle` | Content is centered vertically. |
| `bottom` | Content is aligned to the bottom. |

### Python API

```python
# Set both axes
widget.styles.content_align = ("center", "middle")

# Set individual axes
widget.styles.content_align_horizontal = "right"
widget.styles.content_align_vertical = "middle"
```

### Behavior

- `content-align` aligns the rendered content **inside** a single widget (e.g., centering text within a label).
- Differs from `align`, which positions **child widgets** inside a container.
- Differs from `text-align`, which controls inline text alignment within a line.

---

## Summary of Distinctions

| Property | Applied to | Controls |
|---|---|---|
| `display` | Any widget | Whether the widget participates in layout at all. |
| `visibility` | Any widget | Whether the widget is drawn (space is still reserved). |
| `layout` | Container | How children are arranged (vertical, horizontal, grid). |
| `dock` | Any widget | Fixing a widget to a container edge, outside normal flow. |
| `position` | Any widget | Whether offset is relative to layout position or container origin. |
| `offset` | Any widget | Visual displacement of a widget from its position. |
| `align` | Container | Where children are positioned within available space. |
| `content-align` | Any widget | Where content is positioned within the widget itself. |
