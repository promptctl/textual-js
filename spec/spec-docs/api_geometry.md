# Geometry

The `textual.geometry` module provides classes and functions for managing terminal geometry: coordinates, dimensions, rectangular regions, and spacing. All geometry types are `NamedTuple` subclasses, making them immutable and hashable.

## Module-Level

### clamp() Function

Restricts a value to a given range. If `minimum` and `maximum` are given in reverse order, they are swapped automatically.

```python
from textual.geometry import clamp
clamp(5, 0, 10)   # 5
clamp(-3, 0, 10)  # 0
clamp(15, 0, 10)  # 10
clamp(5, 10, 0)   # 5  (reversed min/max handled)
```

| Parameter | Type | Description |
|---|---|---|
| `value` | `int \| float` | The value to clamp |
| `minimum` | `int \| float` | Minimum bound |
| `maximum` | `int \| float` | Maximum bound |

Returns the clamped value, same type as input.

### Type Aliases

| Name | Definition | Description |
|---|---|---|
| `SpacingDimensions` | `Union[int, Tuple[int], Tuple[int, int], Tuple[int, int, int, int]]` | Valid ways to specify spacing in CSS style |

### Constants

| Name | Type | Value | Description |
|---|---|---|---|
| `NULL_OFFSET` | `Offset` | `Offset(0, 0)` | Zero offset constant |
| `NULL_REGION` | `Region` | `Region(0, 0, 0, 0)` | Null region at origin with zero area |
| `NULL_SIZE` | `Size` | `Size(0, 0)` | Null size with zero area |
| `NULL_SPACING` | `Spacing` | `Spacing(0, 0, 0, 0)` | No-space constant |

## Offset

A cell offset defined by x and y coordinates. Offsets are typically relative to the top left of the terminal or other container. Supports addition, subtraction, multiplication, and negation.

```python
from textual.geometry import Offset
offset = Offset(3, 2)
offset += Offset(10, 0)  # Offset(x=13, y=2)
-offset                   # Offset(x=-13, y=-2)
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `x` | `int` | `0` | Horizontal offset |
| `y` | `int` | `0` | Vertical offset |

### Properties

| Property | Type | Description |
|---|---|---|
| `is_origin` | `bool` | `True` if the offset is `(0, 0)` |
| `clamped` | `Offset` | Offset with `x` and `y` restricted to values >= 0 |
| `transpose` | `tuple[int, int]` | Returns `(y, x)` (reversed order) |

### Operators

| Operator | Right Operand | Result | Description |
|---|---|---|---|
| `+` | `tuple[int, int]` | `Offset` | Component-wise addition |
| `-` | `tuple[int, int]` | `Offset` | Component-wise subtraction |
| `*` | `int \| float` | `Offset` | Scalar multiplication (truncated to int) |
| `*` | `tuple[int, int]` | `Offset` | Component-wise multiplication (truncated to int) |
| `-` (unary) | -- | `Offset` | Negation of both components |
| `bool()` | -- | `bool` | `False` if `(0, 0)`, `True` otherwise |

### Methods

#### blend(destination, factor)

Calculate a new offset on a line between this offset and a destination offset.

| Parameter | Type | Description |
|---|---|---|
| `destination` | `Offset` | Point where factor would be 1.0 |
| `factor` | `float` | A value between 0 and 1.0 |

Returns a new `Offset` interpolated between self and destination.

#### get_distance_to(other)

Get the Euclidean distance to another offset.

| Parameter | Type | Description |
|---|---|---|
| `other` | `Offset` | An offset |

Returns `float` distance.

#### clamp(width, height)

Clamp the offset to fit within a rectangle of width x height (0 to width-1, 0 to height-1).

| Parameter | Type | Description |
|---|---|---|
| `width` | `int` | Width to clamp within |
| `height` | `int` | Height to clamp within |

Returns a new `Offset`.

## Size

The dimensions (width and height) of a rectangular region.

```python
from textual.geometry import Size
size = Size(2, 3)
size.area       # 6
size + Size(10, 20)  # Size(width=12, height=23)
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `width` | `int` | `0` | Width in cells |
| `height` | `int` | `0` | Height in cells |

### Properties

| Property | Type | Description |
|---|---|---|
| `area` | `int` | `width * height` |
| `region` | `Region` | A region of the same size at the origin `(0, 0)` |
| `line_range` | `range` | `range(0, height)` |

### Operators

| Operator | Right Operand | Result | Description |
|---|---|---|---|
| `+` | `tuple[int, int]` | `Size` | Component-wise addition (clamped to 0) |
| `-` | `tuple[int, int]` | `Size` | Component-wise subtraction (clamped to 0) |
| `bool()` | -- | `bool` | `False` if area is 0 |
| `in` | `tuple[int, int]` | `bool` | `True` if point is within `(0, 0)` to `(width, height)` exclusive |

### Methods

#### with_width(width)

Returns a new `Size` with the width changed, height preserved.

#### with_height(height)

Returns a new `Size` with the height changed, width preserved.

#### contains(x, y)

Check if point `(x, y)` is within `0 <= x < width` and `0 <= y < height`. Returns `bool`.

#### contains_point(point)

Same as `contains` but takes a `tuple[int, int]`.

#### clamp_offset(offset)

Clamp an `Offset` to fit within the width x height. Returns a new `Offset`.

## Region

Defines a rectangular region with a coordinate (x, y) and dimensions (width, height).

```python
from textual.geometry import Region
region = Region(4, 5, 20, 10)
region.area    # 200
region.size    # Size(width=20, height=10)
region.offset  # Offset(x=4, y=5)
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `x` | `int` | `0` | Horizontal offset |
| `y` | `int` | `0` | Vertical offset |
| `width` | `int` | `0` | Width of the region |
| `height` | `int` | `0` | Height of the region |

### Properties

| Property | Type | Description |
|---|---|---|
| `right` | `int` | `x + width` (exclusive) |
| `bottom` | `int` | `y + height` (exclusive) |
| `area` | `int` | `width * height` |
| `offset` | `Offset` | Top left corner as `Offset(x, y)` |
| `size` | `Size` | `Size(width, height)` |
| `center` | `tuple[float, float]` | Center point (may be non-integer) |
| `corners` | `tuple[int, int, int, int]` | `(x, y, x+width, y+height)` |
| `column_span` | `tuple[int, int]` | `(x, x+width)` exclusive end |
| `line_span` | `tuple[int, int]` | `(y, y+height)` exclusive end |
| `column_range` | `range` | `range(x, x+width)` |
| `line_range` | `range` | `range(y, y+height)` |
| `bottom_left` | `Offset` | `Offset(x, y+height)` |
| `top_right` | `Offset` | `Offset(x+width, y)` |
| `bottom_right` | `Offset` | `Offset(x+width, y+height)` |
| `bottom_right_inclusive` | `Offset` | `Offset(x+width-1, y+height-1)` |
| `reset_offset` | `Region` | Same size at `(0, 0)` |

### Operators

| Operator | Right Operand | Result | Description |
|---|---|---|---|
| `+` | `tuple[int, int]` | `Region` | Translate region by offset |
| `-` | `tuple[int, int]` | `Region` | Translate region by negative offset |
| `in` | `tuple[int, int]` | `bool` | Point containment check |
| `in` | `Region` | `bool` | Region containment check |
| `bool()` | -- | `bool` | `False` if area is 0 |

### Class Methods

#### from_union(regions)

Create a `Region` from the union of a collection of regions. Raises `ValueError` if the collection is empty.

#### from_corners(x1, y1, x2, y2)

Construct a `Region` from top-left `(x1, y1)` and bottom-right `(x2, y2)` corners.

#### from_offset(offset, size)

Create a `Region` from an offset tuple and a size tuple.

#### get_scroll_to_visible(window_region, region, *, top=False)

Calculate the smallest `Offset` required to translate a window so it contains another region. Used for scroll-into-view calculations. If `top=True`, scrolls the region to the top of the window.

### Methods

#### contains(x, y)

Check if point `(x, y)` is within the region. Returns `bool`.

#### contains_point(point)

Check if a `tuple[int, int]` point is within the region. Returns `bool`.

#### contains_region(other)

Check if another `Region` is entirely contained within this region. Returns `bool`. Results are LRU-cached.

#### overlaps(other)

Check if another region overlaps (shares any cells with) this region. Returns `bool`. Results are LRU-cached.

#### translate(offset)

Move the region by the given offset. Returns a new `Region`. Results are LRU-cached.

#### at_offset(offset)

Get a new `Region` with the same size at a given offset.

#### crop_size(size)

Get a region with the same offset, with dimensions no larger than `size`.

#### expand(size)

Increase the size by adding a border of `(expand_width, expand_height)` on all sides.

#### clip(width, height)

Clip this region to fit within bounds of `(0, 0, width, height)`.

#### grow(margin)

Grow the region by adding spacing `(top, right, bottom, left)`. Returns a new `Region`. Results are LRU-cached.

#### shrink(margin)

Shrink the region by subtracting spacing `(top, right, bottom, left)`. Dimensions are clamped to 0. Results are LRU-cached.

#### intersection(region)

Get the overlapping portion of two regions. Returns a new `Region`. Results are LRU-cached.

#### union(region)

Get the smallest region that contains both regions. Returns a new `Region`. Results are LRU-cached.

#### split(cut_x, cut_y)

Split the region into 4 sub-regions from given x and y offsets. Negative values cut from the right/bottom edge. Returns `tuple[Region, Region, Region, Region]`. Results are LRU-cached.

#### split_vertical(cut)

Split into two regions at a given x offset. Negative values cut from the right edge. Returns `tuple[Region, Region]`. Results are LRU-cached.

#### split_horizontal(cut)

Split into two regions at a given y offset. Negative values cut from the bottom edge. Returns `tuple[Region, Region]`. Results are LRU-cached.

#### get_spacing_between(region)

Get `Spacing` between two regions. Returns spacing that if subtracted from `self` produces `region`.

#### translate_inside(container, x_axis=True, y_axis=True)

Translate this region so it fits within a container. The top left of the returned region is guaranteed to be within the container. Axes can be individually controlled.

#### inflect(x_axis=+1, y_axis=+1, margin=None)

Inflect a region around one or both axes. Positive values move right/down, negative values move left/up, zero leaves that axis unmodified. An optional `Spacing` margin adds space between the original and inflected position.

#### constrain(constrain_x, constrain_y, margin, container)

Constrain a region to fit within a container using different methods per axis.

| Parameter | Type | Description |
|---|---|---|
| `constrain_x` | `Literal["none", "inside", "inflect"]` | Constrain method for X-axis |
| `constrain_y` | `Literal["none", "inside", "inflect"]` | Constrain method for Y-axis |
| `margin` | `Spacing` | Margin to maintain around region |
| `container` | `Region` | Container to constrain to |

## Spacing

Stores spacing around a widget (padding, border, margin). Defined by four integers: top, right, bottom, left.

```python
from textual.geometry import Region, Spacing
region = Region(2, 3, 20, 10)
spacing = Spacing(1, 2, 3, 4)
region.grow(spacing)    # Region(x=-2, y=2, width=26, height=14)
region.shrink(spacing)  # Region(x=6, y=4, width=14, height=6)
spacing.css             # '1 2 3 4'
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `top` | `int` | `0` | Space from the top |
| `right` | `int` | `0` | Space from the right |
| `bottom` | `int` | `0` | Space from the bottom |
| `left` | `int` | `0` | Space from the left |

### Properties

| Property | Type | Description |
|---|---|---|
| `width` | `int` | `left + right` |
| `height` | `int` | `top + bottom` |
| `max_width` | `int` | `max(left, right)` - overlap spacing in X |
| `max_height` | `int` | `max(top, bottom)` - overlap spacing in Y |
| `top_left` | `tuple[int, int]` | `(left, top)` |
| `bottom_right` | `tuple[int, int]` | `(right, bottom)` |
| `totals` | `tuple[int, int]` | `(left + right, top + bottom)` |
| `css` | `str` | CSS-format string: `"1"`, `"2 4"`, or `"4 2 8 2"` |

### Operators

| Operator | Right Operand | Result | Description |
|---|---|---|---|
| `+` | `tuple[int, int, int, int]` | `Spacing` | Component-wise addition |
| `-` | `tuple[int, int, int, int]` | `Spacing` | Component-wise subtraction |
| `bool()` | -- | `bool` | `False` if all zeros |

### Class Methods

#### unpack(pad)

Unpack padding specified in CSS style. Accepts an `int` or tuple of 1, 2, or 4 integers.

| Input | Result |
|---|---|
| `int` | `Spacing(n, n, n, n)` |
| `(n,)` | `Spacing(n, n, n, n)` |
| `(v, h)` | `Spacing(v, h, v, h)` |
| `(t, r, b, l)` | `Spacing(t, r, b, l)` |

Raises `ValueError` for other tuple lengths.

#### vertical(amount)

Returns `Spacing(amount, 0, amount, 0)`.

#### horizontal(amount)

Returns `Spacing(0, amount, 0, amount)`.

#### all(amount)

Returns `Spacing(amount, amount, amount, amount)`.

### Methods

#### grow_maximum(other)

Returns a new `Spacing` where each edge is the maximum of the two corresponding edges.
