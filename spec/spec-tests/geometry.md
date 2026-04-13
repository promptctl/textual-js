# Geometry

The `textual.geometry` module provides four primitive types for 2D coordinate math in the terminal grid: `Offset`, `Size`, `Region`, and `Spacing`. It also exposes a `clamp` utility function.

## clamp

- `clamp(value, minimum, maximum)` restricts a value to the inclusive range `[minimum, maximum]`.
- Works correctly when minimum and maximum are given in reverse order: `clamp(5, 10, 0)` yields `5`.
- Boundary values are inclusive: `clamp(0, 0, 10)` yields `0`; `clamp(10, 0, 10)` yields `10`.

## Offset

An `Offset(x, y)` represents a 2D integer coordinate or displacement.

### Construction

- `Offset(x, y)` stores two integer components.

### Truthiness

- An Offset is truthy when either component is non-zero.
- `Offset(0, 0)` is falsy.

### Properties

- `is_origin` is `True` only for `Offset(0, 0)`.
- `transpose` swaps x and y, returning a tuple: `Offset(1, 2).transpose == (2, 1)`.
- `clamped` clamps both components to a minimum of zero: `Offset(-10, -5).clamped == Offset(0, 0)`.

### Arithmetic

- Addition: `Offset(1, 2) + Offset(3, 4) == Offset(4, 6)`. Adding a non-Offset raises `TypeError`.
- Subtraction: `Offset(3, 4) - Offset(2, 1) == Offset(1, 3)`. Subtracting a non-Offset raises `TypeError`.
- Negation: `-Offset(2, -3) == Offset(-2, 3)`.
- Scalar multiplication: `Offset(2, 1) * 2 == Offset(4, 2)`. Multiplying by a non-numeric raises `TypeError`.

### Blending and Distance

- `blend(destination, factor)` linearly interpolates between two offsets. Factor `0` returns self, factor `1` returns destination, factor `0.5` returns the midpoint.
- `get_distance_to(other)` returns the Euclidean distance between two offsets as a float.

### Clamping

- `offset.clamp(width, height)` restricts the offset so `0 <= x < width` and `0 <= y < height`.

## Size

A `Size(width, height)` represents a rectangular dimension.

### Construction

- `Size(width, height)` stores two non-negative integer dimensions.

### Truthiness

- A Size is truthy only when both width and height are non-zero.
- `Size(0, 1)` and `Size(1, 0)` are both falsy.

### Properties

- `area` returns width times height.
- `region` returns a `Region` anchored at the origin: `Size(30, 40).region == Region(0, 0, 30, 40)`.
- `line_range` returns a range over the height: `Size(0, 20).line_range == range(20)`.

### Containment

- `contains(x, y)` tests whether integer coordinates fall within `0 <= x < width` and `0 <= y < height`.
- `contains_point(offset)` performs the same test, accepting an `Offset`.
- The `in` operator supports 2-tuples: `(5, 5) in Size(10, 10)` is `True`. Tuples of length other than 2 raise `TypeError`.

### Arithmetic

- Addition: `Size(5, 10) + Size(2, 3) == Size(7, 13)`. Adding a non-Size raises `TypeError`.
- Subtraction: `Size(5, 10) - Size(2, 3) == Size(3, 7)`. Subtracting a non-Size raises `TypeError`.

### Derived Sizes

- `with_width(w)` returns a new Size with the given width, preserving height.
- `with_height(h)` returns a new Size with the given height, preserving width.

### Clamping

- `clamp_offset(offset)` restricts an offset so it stays within the size's bounds: `Size(3, 3).clamp_offset(Offset(5, 4)) == Offset(2, 2)`.

## Region

A `Region(x, y, width, height)` represents an axis-aligned rectangle positioned in 2D space.

### Construction

- `Region()` with no arguments produces `Region(0, 0, 0, 0)`, which is falsy.
- `Region.from_offset(offset, size)` constructs a region from an Offset and a size tuple.
- `Region.from_union(regions)` returns the bounding box of a non-empty list of regions. An empty list raises `ValueError`.

### Properties

- `area` returns width times height.
- `size` returns a `Size(width, height)`.
- `offset` returns `Offset(x, y)`.
- `right` returns `x + width`; `bottom` returns `y + height`.
- `column_span` returns `(x, x + width)` as a tuple; `line_span` returns `(y, y + height)`.
- `column_range` returns `range(x, x + width)`; `line_range` returns `range(y, y + height)`.
- `top_right` returns `Offset(x + width, y)`.
- `bottom_left` returns `Offset(x, y + height)`.
- `bottom_right` returns `Offset(x + width, y + height)`.
- `bottom_right_inclusive` returns `Offset(x + width - 1, y + height - 1)`.
- `reset_offset` returns the same-sized region at the origin.

### Translation and Repositioning

- Adding a 2-tuple or Offset translates the region: `Region(1, 2, 3, 4) + (10, 20) == Region(11, 22, 3, 4)`. Adding a non-tuple raises `TypeError`.
- Subtraction works analogously: `Region(11, 22, 3, 4) - (10, 20) == Region(1, 2, 3, 4)`.
- `translate(offset)` is equivalent to addition: `Region(1, 2, 3, 4).translate((10, 20)) == Region(11, 22, 3, 4)`.
- `at_offset(offset)` moves the region to a new origin, preserving size: `Region(10, 10, 30, 40).at_offset((0, 0)) == Region(0, 0, 30, 40)`.
- `translate_inside(container)` shifts the region minimally so it fits within the container, without resizing.

### Containment

- `contains(x, y)` tests whether a point is within the region (inclusive start, exclusive end).
- `contains_point(tuple)` accepts a 2-tuple. A tuple of wrong length raises `TypeError`.
- `contains_region(other)` tests whether another region fits entirely inside.
- The `in` operator supports 2-tuples (point test), Region values (containment test), and returns `False` for unsupported types.

### Intersection

- `intersection(other)` returns the overlapping region. If there is no overlap, it returns a falsy (zero-area) region.
- `overlaps(other)` returns `True` if two regions share any area.

### Union

- `union(other)` returns the bounding box that encloses both regions.

### Clipping

- `clip(max_width, max_height)` shrinks the region so it does not extend beyond the given bounds: `Region(10, 10, 20, 30).clip(20, 25) == Region(10, 10, 10, 15)`.
- `crop_size(size)` restricts the region's dimensions to be no larger than the given size, without moving it.

### Shrink and Grow

- `shrink(spacing)` insets the region by a `Spacing` value, moving the origin inward and reducing dimensions.
- `grow(spacing)` is the inverse of shrink, expanding the region outward.
- `get_spacing_between(inner)` returns the `Spacing` that, when applied via `shrink`, produces the inner region from the outer.

### Expand

- `expand(amount)` symmetrically expands the region by `(dx, dy)` in all four directions: `Region(50, 10, 10, 5).expand((2, 3)) == Region(48, 7, 14, 11)`.

### Splitting

- `split(cut_x, cut_y)` divides the region into four quadrants at the given offsets (relative to the region's own origin). Negative offsets count from the far edge.
- `split_vertical(cut)` divides into left and right halves. Negative cut counts from the right edge.
- `split_horizontal(cut)` divides into top and bottom halves. Negative cut counts from the bottom edge.

### Scrolling

- `Region.get_scroll_to_visible(window, target)` returns the `Offset` needed to scroll the window so that the target region becomes visible. The result satisfies `target.overlaps(window + scroll)`.

### Inflection

- `inflect(x_axis=1, y_axis=1, margin=Spacing(0,0,0,0))` repositions the region relative to its own bottom-right corner (plus margin). Negative axis values flip the direction.

### Constraining

- `constrain(constrain_x, constrain_y, margin, container)` adjusts the region to satisfy placement rules within a container.
- `constrain_x` / `constrain_y` accept `"none"`, `"inside"`, or `"inflect"`.
- `"none"` leaves the axis unchanged.
- `"inside"` shifts the region so it fits within the container (respecting margin).
- `"inflect"` reflects the region across the relevant axis when it would overflow.

## Spacing

A `Spacing(top, right, bottom, left)` represents insets or padding around a rectangle, following CSS order.

### Construction

- `Spacing(top, right, bottom, left)` stores four integer values.
- `Spacing.unpack(value)` accepts a single int (all four sides), a 1-tuple (all four), a 2-tuple (vertical, horizontal), or a 4-tuple (top, right, bottom, left). Tuples of length 0, 3, or 5+ raise `ValueError`.
- `Spacing.vertical(n)` produces `Spacing(n, 0, n, 0)`.
- `Spacing.horizontal(n)` produces `Spacing(0, n, 0, n)`.
- `Spacing.all(n)` produces `Spacing(n, n, n, n)`.

### Truthiness

- A Spacing is truthy when any component is non-zero.
- `Spacing(0, 0, 0, 0)` is falsy.

### Properties

- `width` returns `left + right`.
- `height` returns `top + bottom`.
- `top_left` returns `(left, top)`.
- `bottom_right` returns `(right, bottom)`.
- `totals` returns `(width, height)`.
- `css` returns a compact CSS-style string: `"1"` when all sides are equal, `"1 2"` when top/bottom and left/right match, or `"1 2 3 4"` otherwise.

### Arithmetic

- Addition: component-wise addition of two Spacing values. Adding a non-Spacing raises `TypeError`.
- Subtraction: component-wise subtraction. Subtracting a non-Spacing raises `TypeError`.

## Constraints

- All geometry types enforce strict type checking on arithmetic operators; mixing incompatible types raises `TypeError`.
- Region boundaries use half-open intervals: the start coordinate is inclusive and the end coordinate (`x + width`, `y + height`) is exclusive.
- `Region.from_union` requires a non-empty list; an empty input raises `ValueError`.
- `Spacing.unpack` rejects tuples of length 0, 3, or 5+, raising `ValueError`.
- `Size` containment and `Region` containment follow the same half-open convention: a point at exactly (width, height) or (x + width, y + height) is outside.
