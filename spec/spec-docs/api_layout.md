# textual.layout

Layout system for arranging widgets within containers. Provides the abstract base class for layout implementations, plus data structures for describing widget placements.

## Type Aliases

- `ArrangeResult: TypeAlias = "list[WidgetPlacement]"` -- The return type of `Layout.arrange`, a list of widget placements.

## DockArrangeResult Class

`DockArrangeResult` (`textual.layout`) is a dataclass holding the result of a layout arrangement operation.

### Fields

- `placements: list[WidgetPlacement]` -- A `WidgetPlacement` for every widget, describing its location on screen.
- `widgets: set[Widget]` -- The set of widgets included in the arrangement.
- `scroll_spacing: Spacing` -- Spacing to reduce the scrollable area (e.g. space consumed by docked widgets).
- `_spatial_map: SpatialMap[WidgetPlacement] | None = None` -- Internal cached spatial map, lazily initialized.

### Properties

- `spatial_map -> SpatialMap[WidgetPlacement]` -- Lazily computed spatial map for querying widget placements by region. On first access, inserts all placements into a `SpatialMap` using each placement's region (grown by its margin), offset, fixed flag, overlay flag, and the placement itself.
- `total_region -> Region` -- The total area occupied by the arrangement. Computed from the spatial map's total region, grown by the right and bottom components of `scroll_spacing`.

### Methods

#### get_visible_placements

```python
def get_visible_placements(self, region: Region) -> list[WidgetPlacement]
```

Get the placements visible within a given region.

**Parameters:**

- `region: Region` -- The region to test visibility against.

**Returns:** `list[WidgetPlacement]` -- The placements that are visible (overlap with the region or are fixed).

**Behavior:**

- If `total_region` is contained within the query `region`, returns all placements (short circuit).
- Otherwise, queries the spatial map for placements in the region, then filters to those that are fixed or whose offset-adjusted region overlaps the query region.

## WidgetPlacement Class

`WidgetPlacement` (`textual.layout`) is a `NamedTuple` describing the position, size, and relative order of a widget within its parent.

### Fields

- `region: Region` -- The region occupied by the widget.
- `offset: Offset` -- An additional offset applied to the widget.
- `margin: Spacing` -- The margin around the widget.
- `widget: Widget` -- The widget being placed.
- `order: int = 0` -- The painting/stacking order of the widget.
- `fixed: bool = False` -- Whether the widget has a fixed position (not affected by scrolling).
- `overlay: bool = False` -- Whether the widget is an overlay.
- `absolute: bool = False` -- Whether the widget uses absolute positioning.

### Properties

- `reset_origin -> WidgetPlacement` -- Returns a new placement with the region moved to origin (0, 0), preserving size. Uses `self.region.reset_offset`.

### Class Methods

#### translate

```python
@classmethod
def translate(cls, placements: list[WidgetPlacement], translate_offset: Offset) -> list[WidgetPlacement]
```

Move all non-absolute placements by a given offset.

**Parameters:**

- `placements: list[WidgetPlacement]` -- List of placements to translate.
- `translate_offset: Offset` -- The offset to add to each placement's region.

**Returns:** `list[WidgetPlacement]` -- New list with adjusted regions, or the same list instance if the offset is null (zero). Widgets with `absolute_offset` set are not translated.

#### apply_absolute

```python
@classmethod
def apply_absolute(cls, placements: list[WidgetPlacement]) -> None
```

Apply absolute offsets to placements in place. For each placement where `absolute` is `True`, replaces it with a version that has its origin reset.

**Parameters:**

- `placements: list[WidgetPlacement]` -- A list of placements (modified in place).

#### get_bounds

```python
@classmethod
def get_bounds(cls, placements: Iterable[WidgetPlacement]) -> Region
```

Get a bounding region around all placements.

**Parameters:**

- `placements: Iterable[WidgetPlacement]` -- The placements to compute bounds for.

**Returns:** `Region` -- An optimal bounding box around all placements (each grown by its margin).

### Instance Methods

#### process_offset

```python
def process_offset(self, constrain_region: Region, absolute_offset: Offset) -> WidgetPlacement
```

Apply any absolute offset or constrain rules to the placement.

**Parameters:**

- `constrain_region: Region` -- The container region used when applying constrain rules.
- `absolute_offset: Offset` -- Default absolute offset that moves the widget into screen coordinates.

**Returns:** `WidgetPlacement` -- The processed placement. May be the same instance if no changes were needed.

**Behavior:**

1. If the widget has no `absolute_offset` and no `constrain_x`/`constrain_y` rules, returns self unchanged.
2. If the widget has an `absolute_offset`, repositions the region to that offset (adjusted by margin top-left and the absolute offset).
3. Applies constrain rules via `region.constrain()` using the widget's `constrain_x` and `constrain_y` styles.
4. If the computed offset differs from the original, returns a new `WidgetPlacement`; otherwise returns self.

## Layout Class (ABC)

`Layout` (`textual.layout`) is the abstract base class for objects responsible for arranging widgets within a container.

### Class Variables

- `name: ClassVar[str] = ""` -- The name of the layout (e.g. `"horizontal"`, `"vertical"`, `"grid"`).

### Abstract Methods

#### arrange

```python
@abstractmethod
def arrange(
    self,
    parent: Widget,
    children: list[Widget],
    size: Size,
    greedy: bool = True,
) -> ArrangeResult
```

Generate a layout map defining where widgets will be drawn on screen.

**Parameters:**

- `parent: Widget` -- The parent container widget.
- `children: list[Widget]` -- The child widgets to arrange.
- `size: Size` -- The size of the container.
- `greedy: bool = True` -- Whether the layout should consume all available space.

**Returns:** `ArrangeResult` (i.e. `list[WidgetPlacement]`) -- A list of widget placements.

### Methods

#### get_content_width

```python
def get_content_width(self, widget: Widget, container: Size, viewport: Size) -> int
```

Get the optimal content width by arranging children.

**Parameters:**

- `widget: Widget` -- The container widget.
- `container: Size` -- The container size.
- `viewport: Size` -- The viewport size.

**Returns:** `int` -- The width of the content. Returns 0 if the widget has no child nodes.

**Behavior:** If the widget has child nodes, arranges them with width set to 0 (if the widget shrinks) or `container.width`, and returns the right edge of the resulting total region.

#### get_content_height

```python
def get_content_height(self, widget: Widget, container: Size, viewport: Size, width: int) -> int
```

Get the content height.

**Parameters:**

- `widget: Widget` -- The container widget.
- `container: Size` -- The container size.
- `viewport: Size` -- The viewport size.
- `width: int` -- The content width.

**Returns:** `int` -- The content height in lines. Returns 0 if the widget has no child nodes.

**Behavior:** If all displayed children have dynamic height and the widget is not docked, arranges with `container.height`; otherwise arranges with height 0.

#### render_keyline

```python
def render_keyline(self, container: Widget) -> StripRenderable
```

Render keylines (decorative borders) around all visible child widgets.

**Parameters:**

- `container: Widget` -- The container widget whose children get keylines.

**Returns:** `StripRenderable` -- A renderable that draws the keylines.

**Behavior:** Creates a `Canvas` at the container's outer size. For each visible child widget, draws a `Rectangle` around its region (expanded by 1 cell on each side) using the container's `keyline` style (line style and color). The keyline color is blended with the container's background color.
