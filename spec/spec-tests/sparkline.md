# Sparkline

`Sparkline` is a Rich renderable that draws a miniature bar chart using Unicode block characters. It maps numeric data to a row (or stack of rows) of colored glyphs, producing an inline data visualization.

Importable from `textual.renderables.sparkline`.

### Data Input

`Sparkline` accepts its data as the first positional argument. Any `Sequence` of numbers is valid, including `list`, `tuple`, `bytes`, `bytearray`, `deque`, `range`, and `UserList`.

### Width and Data Scaling

The `width` parameter controls how many character cells the sparkline occupies. When the data length differs from the width, the renderable rescales:

- **Fewer data points than width**: data points are expanded (repeated) to fill the available cells. For example, two data points rendered at width 4 produce two cells per point. When the width is not evenly divisible by the data length, the expansion is truncated to fit.
- **More data points than width**: data points are bucketed and summarized (by default, using the maximum of each bucket) so that the output shrinks to the requested width.

### Empty and Single-Point Data

- An empty data sequence renders all cells as the lowest block character at the minimum color.
- A single data point renders all cells as the full block character at the maximum color.

### Height

The `height` parameter (default 1) controls the number of vertical rows. When height is greater than 1, the sparkline stacks rows to increase vertical resolution. Lower rows fill first; upper rows contain only the portions of bars that extend above the lower rows. Cells in upper rows that have no bar content are rendered as spaces.

### Color Gradient

Each cell is colored along a gradient between two colors based on its relative value within the data range:

- The minimum value receives the low end of the gradient (green by default).
- The maximum value receives the high end of the gradient (red by default).
- Intermediate values receive a blended color proportional to their position in the range.

### Block Characters

Bar height within a single cell is represented by one of the Unicode block elements (from `▁` for the lowest value up to `█` for the highest), giving eight levels of vertical resolution per row.

## Constraints

- The `data` argument must be a `Sequence` of numeric values; arbitrary iterables are not sufficient.
- `width` must be specified; it determines the exact number of output character cells.
- When data is empty, the sparkline still renders to the given width (all minimum-value glyphs).
- Color blending is linear between exactly two color stops; there is no support for arbitrary color ramp definitions based on the test surface.
- Expansion and shrinking of data to match width is deterministic: expansion repeats points proportionally, and shrinking buckets consecutive points and summarizes them.
