# Grid Style Properties

## Overview

Textual provides a set of CSS styles for configuring grid layouts. All grid styles require `layout: grid` on the container widget. Child cell styles (`column-span`, `row-span`) apply to direct children of a grid container.

Grid cells are placed left-to-right, top-to-bottom. When a cell spans multiple rows or columns, subsequent cells flow around it into the next available slot.

## grid-size

Sets the number of columns and rows in the grid.

**Syntax:** `grid-size: <integer> [<integer>];`

- First integer: number of columns (required).
- Second integer: number of rows (optional). If omitted, rows are computed automatically from the number of children and their spans.

**Defaults:**
- `grid_size_columns`: 1
- `grid_size_rows`: 0 (meaning auto-computed)

When the row count is set explicitly, the grid has exactly that many rows regardless of how many children exist. Empty cells remain blank; excess children are not displayed.

**CSS:**
```css
grid-size: 3 5;   /* 3 columns, 5 rows */
grid-size: 4;     /* 4 columns, rows computed automatically */
```

**Python:**
```python
widget.styles.grid_size_columns = 3
widget.styles.grid_size_rows = 5
```

Note: In Python, columns and rows must be set as separate properties.

## grid-columns

Defines the width of each column in the grid.

**Syntax:** `grid-columns: <scalar>+;`

Accepts one or more scalar values (e.g., `1fr`, `50%`, `16`, `auto`). Values are applied to columns in order. If there are more columns than scalars, the scalars **cycle** from the beginning. If there are more scalars than columns, the excess is ignored.

**Default:** If unset, all columns default to `1fr` (equal-width fractional distribution).

**Scalar types:**
- `<number>` -- absolute cell count (e.g., `16` means 16 cells wide).
- `<percentage>` -- percentage of the container width.
- `<fraction>` -- fractional unit (`fr`) distributing remaining space proportionally.
- `auto` -- column width derived from the widest content in that column.

**CSS:**
```css
grid-columns: 50%;          /* all columns 50% width */
grid-columns: 1fr 2fr;      /* alternating: second column twice as wide */
grid-columns: 1fr 16 2fr;   /* cycles if more than 3 columns */
grid-columns: auto;          /* each column sizes to its content */
```

**Python:**
```python
widget.styles.grid_columns = "1fr 2fr"
```

**Percentage resolution:** Percentages resolve relative to the container width (`Unit.WIDTH`).

## grid-rows

Defines the height of each row in the grid.

**Syntax:** `grid-rows: <scalar>+;`

Accepts one or more scalar values. Cycling and excess rules are identical to `grid-columns`.

**Default:** If unset, rows default to `1fr` when the container has a fixed height, or `auto` when the container has auto height.

**CSS:**
```css
grid-rows: 50%;          /* all rows 50% height */
grid-rows: 1fr 2fr;      /* alternating: second row twice as tall */
grid-rows: 1fr 6 25%;    /* cycles if more than 3 rows */
```

**Python:**
```python
widget.styles.grid_rows = "1fr 2fr"
```

**Percentage resolution:** Percentages resolve relative to the container height (`Unit.HEIGHT`).

## grid-gutter

Sets the spacing between adjacent grid cells. Gutter is applied only **between** cells, not between cells and the container edges.

**Syntax:** `grid-gutter: <integer> [<integer>];`

- One value: sets both vertical and horizontal gutter to the same size.
- Two values: first sets vertical gutter, second sets horizontal gutter.

**Defaults:**
- `grid_gutter_horizontal`: 0
- `grid_gutter_vertical`: 0

**CSS:**
```css
grid-gutter: 5;     /* 5 cells vertical and horizontal */
grid-gutter: 1 2;   /* 1 cell vertical, 2 cells horizontal */
```

A common pattern is to set horizontal gutter to double the vertical gutter because terminal cells are typically twice as tall as they are wide, producing visually uniform spacing.

**Python:**
```python
widget.styles.grid_gutter_vertical = 1
widget.styles.grid_gutter_horizontal = 2
```

Note: In Python, vertical and horizontal gutters are separate properties.

## column-span

Specifies how many columns a child widget spans within the grid.

**Syntax:** `column-span: <integer>;`

**Default:** 1

This style is set on grid children, not on the grid container itself. The widget occupies the specified number of consecutive columns starting from its placement position.

**CSS:**
```css
column-span: 2;   /* widget spans 2 columns */
```

**Python:**
```python
widget.styles.column_span = 2
```

## row-span

Specifies how many rows a child widget spans within the grid.

**Syntax:** `row-span: <integer>;`

**Default:** 1

This style is set on grid children, not on the grid container itself. The widget occupies the specified number of consecutive rows starting from its placement position.

**CSS:**
```css
row-span: 3;   /* widget spans 3 rows */
```

**Python:**
```python
widget.styles.row_span = 3
```

## How the Properties Work Together

A grid layout is configured in two layers:

1. **Container properties** (`grid-size`, `grid-columns`, `grid-rows`, `grid-gutter`) are set on the widget that has `layout: grid`. They define the grid structure.
2. **Cell properties** (`column-span`, `row-span`) are set on direct children of the grid container. They control how individual children occupy grid space.

### Placement algorithm

Children are placed in document order, scanning cells left-to-right, top-to-bottom. For each child:
1. Find the next unoccupied cell where the child's span fits without overlapping previously placed children.
2. Mark all cells covered by the child's column-span and row-span as occupied.
3. Continue with the next child from the cell after the one where placement started.

### Column/row sizing pipeline

1. `grid-size` determines the column count (and optionally the row count).
2. `grid-columns` / `grid-rows` scalars are cycled to match the column/row count.
3. `auto` scalars are resolved first by measuring content.
4. Remaining space is distributed among fractional (`fr`) units proportionally.
5. `grid-gutter` values are subtracted from available space before resolving column/row sizes.

### Keyline interaction

When a `keyline` style is set on the grid container, the grid shrinks by 2 cells in each dimension and offsets by (1, 1) to make room for keyline borders. Gutter values are used as keyline spacing.

### Complete example

```css
Screen {
    layout: grid;
    grid-size: 3 4;
    grid-columns: 1fr;
    grid-rows: 1fr;
    grid-gutter: 1;
}

#header {
    column-span: 3;
}

#sidebar {
    row-span: 2;
}
```

This creates a 3-column, 4-row grid with equal-sized cells, 1-cell gutter between them, a header spanning the full width, and a sidebar spanning two rows.
