# Layout

The layout system determines how widgets are arranged within a container. Layouts are set via the `layout` CSS property or through `widget.styles.layout` in Python. Textual provides three layout types: `vertical`, `horizontal`, and `grid`. Docking, layers, and offsets provide additional positioning control on top of any layout.

## Vertical Layout

The default layout. Child widgets are arranged top to bottom in the order they are yielded from `compose`.

```css
Screen {
    layout: vertical;
}
```

- Widgets expand to the full width of their parent container automatically.
- Widgets do not expand to fill the parent's height; height must be set explicitly (e.g., `height: 1fr;` or `height: 10;`).
- If total child height exceeds available space and the container has `overflow-y: auto;` (the default for `Screen`), a vertical scrollbar appears automatically.
- `Screen` uses `vertical` layout by default, so the declaration is implicit for the root screen.

## Horizontal Layout

Child widgets are arranged left to right in compose-yield order.

```css
Screen {
    layout: horizontal;
}
```

- Widgets expand to the full width of their parent container by default, which means only the first widget is visible unless widths are constrained (e.g., `width: 1fr;`).
- Widgets do not expand to fill the parent's height; `height: 100%;` must be set explicitly if that is desired.
- Horizontal overflow does not produce a scrollbar automatically. Use `overflow-x: auto;` on the container to enable horizontal scrolling when children exceed available width.

## Grid Layout

Arranges widgets into a two-dimensional grid of rows and columns. Widgets fill cells left to right, top to bottom, in compose-yield order.

```css
Screen {
    layout: grid;
    grid-size: 3 2;  /* 3 columns, 2 rows */
}
```

Grid layout in Textual has little in common with browser CSS Grid.

### grid-size

Defines the number of columns and optionally the number of rows.

- `grid-size: 3 2;` -- 3 columns, 2 rows. Widgets beyond the 6th cell are not visible.
- `grid-size: 3;` -- 3 columns, rows created on demand to fit all widgets.

### grid-columns and grid-rows

Set the dimensions of individual columns and rows. Accepts space-separated values that correspond positionally to each column or row.

```css
grid-columns: 2fr 1fr 1fr;  /* first column gets twice the width */
grid-rows: 25% 75%;
```

- If fewer values are provided than the number of columns/rows, the values repeat cyclically. For example, with 4 columns, `grid-columns: 2 4;` is equivalent to `grid-columns: 2 4 2 4;`.
- Both properties accept `auto` as a value for any position. An `auto` column or row is sized to fit the content of the cells in that column or row.

```css
grid-columns: auto 1fr 1fr;
```

### Cell Spans

A widget can span multiple columns and/or rows using `column-span` and `row-span`. These are set on the child widget, not the grid container.

```css
#widget-id {
    column-span: 2;
    row-span: 2;
}
```

- Spanning expands the widget into adjacent cells to the right (column-span) and/or downward (row-span).
- Subsequent widgets shift to accommodate the spanned cells.
- If `column-span` exceeds available columns from the widget's position, it is clamped to the remaining columns.

### grid-gutter

Controls spacing between cells. Applied to the grid container, not to individual cells.

```css
grid-gutter: 1;       /* 1 row of vertical gutter between cells */
grid-gutter: 1 2;     /* 1 vertical, 2 horizontal */
```

- Gutter appears only between cells, not between cells and the container edges.
- Terminal cells are typically twice as tall as they are wide, so `grid-gutter: 1 2;` produces visually even spacing.

## Docking

Docking removes a widget from the normal layout flow and fixes it to an edge of its parent container. Docked widgets do not scroll with content.

```css
#sidebar {
    dock: left;
    width: 15;
}
```

Valid values: `top`, `right`, `bottom`, `left`.

- Docked widgets are ideal for sticky headers, footers, and sidebars.
- Multiple widgets docked to the same edge overlap. Later-yielded widgets appear on top of earlier-yielded ones.
- Widgets can be docked to different edges within the same container (e.g., a sidebar docked left and a header docked top).
- Yield order determines z-order among docked widgets on the same edge: the last widget yielded from `compose` is drawn on top.

## Layers

Layers provide explicit control over z-ordering, overriding default compose-yield ordering.

Layer names are declared on a container with the `layers` property. Descendants assign themselves to a layer with the `layer` property.

```css
Screen {
    layers: below above;
}

#box1 {
    layer: above;
}

#box2 {
    layer: below;
}
```

- `layers` takes a space-separated list of names. The leftmost name is the lowest (drawn first); the rightmost is the highest (drawn last, on top).
- Widgets on higher layers are drawn over widgets on lower layers, regardless of compose-yield order.
- If a widget is not assigned to a layer, it goes on the default (lowest) layer.

## Offsets

Every widget has a relative offset added to its position after layout placement. The default offset is `(0, 0)`.

```css
#widget {
    offset: 12 6;
}
```

- The first value is horizontal (positive = right, negative = left).
- The second value is vertical (positive = down, negative = up).
- Offsets do not affect the layout of sibling widgets; they only shift the visual position of the target widget.

## Fractional Units

The `fr` unit distributes available space proportionally among siblings.

```css
.box {
    height: 1fr;
}
```

- If three siblings each have `height: 1fr`, they each receive one-third of available space.
- A widget with `2fr` receives twice the space of a `1fr` sibling.
- `fr` units guarantee children fill the parent's available dimension. Fixed-size children (e.g., `height: 10;`) may cause scrolling instead.

## Utility Containers

Textual provides container widgets with pre-set layouts:

- `Vertical` (`textual.containers.Vertical`) -- `layout: vertical`
- `Horizontal` (`textual.containers.Horizontal`) -- `layout: horizontal`
- `Grid` (`textual.containers.Grid`) -- `layout: grid`

Children can be passed as positional arguments or yielded inside a `with` context manager block during `compose`:

```python
def compose(self) -> ComposeResult:
    with Horizontal():
        with Vertical():
            yield Static("Top-left")
            yield Static("Bottom-left")
        with Vertical():
            yield Static("Top-right")
            yield Static("Bottom-right")
```

Both approaches produce identical results. Context managers and positional arguments can be mixed.

## Widget Sizing Defaults

- Widgets expand to fill the width of their parent container.
- Widgets do not expand to fill the height of their parent container.
- These defaults apply uniformly across all layout types; explicit `width` or `height` declarations override them.

## Runtime Layout Changes

Layout can be changed at runtime through Python:

```python
widget.styles.layout = "horizontal"
```

All layout-related CSS properties (grid-size, grid-columns, dock, layer, offset, etc.) can similarly be modified at runtime through the `styles` object.
