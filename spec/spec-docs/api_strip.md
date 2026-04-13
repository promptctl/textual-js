# Strip

## Overview

**Module:** `textual.strip`

A `Strip` represents a single horizontal line of rendered widget output. It wraps an immutable list of Rich `Segment` objects and provides operations for cropping, padding, dividing, styling, and rendering. Immutability enables aggressive internal caching via FIFO caches on each instance.

Strips are the core data structure of the Line API used to build custom widgets.

---

## Module-Level Functions

### `get_line_length(segments)`

Returns the total cell length of an iterable of `Segment` objects, excluding control segments.

- **Parameters:** `segments` -- `Iterable[Segment]`.
- **Returns:** `int` -- total cell width.

---

## `StripRenderable`

A Rich renderable that renders a list of `Strip` objects as consecutive lines.

### Constructor

| Parameter | Type | Description |
|---|---|---|
| `strips` | `list[Strip]` | The strips to render. |
| `width` | `int \| None` | Optional explicit width for measurement. Defaults to `None` (auto-detected from strip widths). |

### Rich Protocol

- `__rich_console__` -- Yields segments from each strip followed by a newline segment.
- `__rich_measure__` -- Returns a `Measurement` using the explicit width or the max strip cell length.

---

## `Strip`

The primary class. Immutable list of Rich `Segment` objects representing one rendered line.

### Constructor

| Parameter | Type | Description |
|---|---|---|
| `segments` | `Iterable[Segment]` | The segments making up this strip. Materialized to a list on construction. |
| `cell_length` | `int \| None` | Pre-computed cell length, or `None` to calculate on demand. |

### Properties

| Property | Type | Description |
|---|---|---|
| `cell_length` | `int` | Total cell width of the strip. Computed lazily and cached. O(n) on first access. |
| `cell_count` | `int` | Sum of character counts (not cell widths) across all segments. Cached. |
| `text` | `str` | Concatenated text content of all segments (no styling). |
| `link_ids` | `set[str]` | Set of all `_link_id` values from segment styles. Cached. |

### Dunder Methods

| Method | Behavior |
|---|---|
| `__bool__` | `True` if the strip contains any segments. |
| `__iter__` | Iterates over the contained `Segment` objects. |
| `__reversed__` | Reversed iteration over segments. |
| `__len__` | Number of segments (not cell length). |
| `__eq__` | Equality by comparing segment lists. |
| `__add__(other)` | Joins two strips via `Strip.join`. |
| `__getitem__(index)` | Supports integer and slice indexing. Delegates to `crop`. |
| `__rich_repr__` | Rich repr yielding segments and cell length. |

### Class Methods

#### `Strip.blank(cell_length, style=None)`

Creates a strip filled with spaces of the given cell length. Results are LRU-cached (up to 1024 entries).

| Parameter | Type | Description |
|---|---|---|
| `cell_length` | `int` | Width in cells. |
| `style` | `StyleType \| None` | Optional style for the blank space. |

**Returns:** `Strip`

#### `Strip.from_lines(lines, cell_length=None)`

Converts a list of segment lists into a list of `Strip` objects.

| Parameter | Type | Description |
|---|---|---|
| `lines` | `list[list[Segment]]` | Each inner list is one line of segments. |
| `cell_length` | `int \| None` | Shared cell length, or `None`. |

**Returns:** `list[Strip]`

#### `Strip.join(strips)`

Joins multiple strips into one. Filters out `None` values and empty strips. Preserves render caches when all input strips have cached renders.

| Parameter | Type | Description |
|---|---|---|
| `strips` | `Iterable[Strip \| None]` | Strips to join. |

**Returns:** `Strip`

#### `Strip.align(strips, style, width, height, horizontal, vertical)`

Aligns a list of strips within a container of the given dimensions.

| Parameter | Type | Description |
|---|---|---|
| `strips` | `list[Strip]` | Strips to align. |
| `style` | `Style` | Style for padding space. |
| `width` | `int` | Container width. |
| `height` | `int \| None` | Container height, or `None` to skip vertical alignment. |
| `horizontal` | `AlignHorizontal` | `"left"`, `"center"`, or `"right"`. |
| `vertical` | `AlignVertical` | `"top"`, `"middle"`, or `"bottom"`. |

**Returns:** `Iterable[Strip]` -- yields aligned strips with blank-line padding for vertical alignment.

#### `Strip.render_ansi(style, color_system)` (classmethod)

Renders ANSI escape codes for a given Rich `Style`. LRU-cached (up to 16384 entries).

**Returns:** `str` -- semicolon-joined SGR parameters.

#### `Strip.render_style(style, text, color_system)` (classmethod)

Renders styled text with ANSI escape sequences including link encoding.

**Returns:** `str`

### Instance Methods

#### `index_to_cell_position(index)`

Converts a character index to its cell position (sum of cell lengths of all preceding characters).

**Returns:** `int`

#### `extend_cell_length(cell_length, style=None)`

Pads the strip with spaces if its current cell length is less than the given value. Returns self if already long enough.

**Returns:** `Strip`

#### `adjust_cell_length(cell_length, style=None)`

Adjusts cell length by either padding (if shorter) or truncating (if longer). Returns self if already exact. Results are FIFO-cached.

**Returns:** `Strip`

#### `simplify()`

Merges adjacent segments with identical styles into single segments.

**Returns:** `Strip`

#### `discard_meta()`

Returns a new strip with all meta information removed from segment styles.

**Returns:** `Strip`

#### `apply_filter(filter, background)`

Applies a `LineFilter` to all segments. Results are FIFO-cached keyed by `(filter, background)`.

| Parameter | Type | Description |
|---|---|---|
| `filter` | `LineFilter` | The filter to apply. |
| `background` | `Color` | Background color for the filter. |

**Returns:** `Strip`

#### `style_links(link_id, link_style)`

Applies a style to all segments whose `_link_id` matches the given id. Returns self if the link id is not present.

**Returns:** `Strip`

#### `crop_extend(start, end, style)`

Crops between two cell positions, extending the strip first if needed. FIFO-cached.

**Returns:** `Strip`

#### `crop(start, end=None)`

Crops the strip between two cell positions (start inclusive, end exclusive). Returns self if the range covers the full strip. Returns empty strip if end <= start. FIFO-cached.

**Returns:** `Strip`

#### `divide(cuts)`

Divides the strip at the given cell positions into multiple sub-strips. FIFO-cached.

| Parameter | Type | Description |
|---|---|---|
| `cuts` | `Iterable[int]` | Cell positions at which to cut. |

**Returns:** `Sequence[Strip]`

#### `apply_style(style)`

Applies a Rich `Style` to all segments. FIFO-cached.

**Returns:** `Strip`

#### `apply_meta(meta)`

Applies a meta dictionary to all segments by converting it to a `Style.from_meta` and delegating to `apply_style`.

**Returns:** `Strip`

#### `render(console)`

Renders the strip into terminal escape sequences using the console's color system. Result is cached on the instance.

**Returns:** `str`

#### `crop_pad(cell_length, left, right, style)`

Adjusts the strip to `cell_length` then adds left and right padding segments.

**Returns:** `Strip`

#### `text_align(width, align)`

Aligns text within a given width using `"left"`, `"center"`, or `"right"` alignment. Pads with null-style spaces.

**Returns:** `Strip`

#### `apply_offsets(x, y)`

Adds offset meta (`{"offset": (x, y)}`) to each segment for text selection. The x offset increments by each segment's text length. FIFO-cached. Preserves the existing render cache.

**Returns:** `Strip`

---

## Caching Strategy

Each `Strip` instance maintains several independent FIFO caches to avoid recomputation:

| Cache | Key | Size |
|---|---|---|
| `_divide_cache` | `tuple[int, ...]` | 4 |
| `_crop_cache` | `(start, end)` | 16 |
| `_style_cache` | `Style` | 16 |
| `_filter_cache` | `(LineFilter, Color)` | 4 |
| `_line_length_cache` | `(cell_length, Style)` | 4 |
| `_crop_extend_cache` | `(start, end, Style)` | 4 |
| `_offsets_cache` | `(x, y)` | 4 |

Class-level caches use `lru_cache`: `blank` (1024), `render_ansi` (16384).
