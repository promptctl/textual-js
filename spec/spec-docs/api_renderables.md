# textual.renderables

A collection of Rich renderables and Textual visuals which may be returned from a widget's `render()` method.

## textual.renderables.bar

### Bar

`Bar` -- A thin horizontal bar renderable with a highlighted portion. Implements the Rich console protocol.

#### Class Constants

- `HALF_BAR_LEFT: str = "╺"` -- Left half-bar glyph for sub-cell precision.
- `BAR: str = "━"` -- Full bar glyph.
- `HALF_BAR_RIGHT: str = "╸"` -- Right half-bar glyph for sub-cell precision.

#### Initialization

```python
def __init__(
    self,
    highlight_range: tuple[float, float] = (0, 0),
    highlight_style: StyleType = "magenta",
    background_style: StyleType = "grey37",
    clickable_ranges: dict[str, tuple[int, int]] | None = None,
    width: int | None = None,
    gradient: Gradient | None = None,
) -> None
```

- **Parameters:**
  - `highlight_range` -- The `(start, end)` range to highlight within the bar.
  - `highlight_style` -- Style applied to the highlighted portion.
  - `background_style` -- Style applied to non-highlighted portions.
  - `clickable_ranges` -- Optional dictionary mapping range names to `(start, end)` tuples. Each range gets a `@click` meta action of `range_clicked('<name>')`.
  - `width` -- Width of the bar in cells, or `None` to fill available width.
  - `gradient` -- Optional `Gradient` object applied to the highlighted portion.

#### Rich Console Protocol

`__rich_console__` renders the bar with half-cell precision. Start and end positions are rounded to the nearest 0.5. If the highlight range is empty or invalid, the entire bar is rendered in the background style. The gradient, if provided, is applied to the highlighted portion via `_apply_gradient`.

### _apply_gradient

```python
def _apply_gradient(text: Text, gradient: Gradient, width: int) -> None
```

Module-level helper that applies a `Gradient` color to a Rich `Text` instance character by character.

- **Parameters:**
  - `text` -- A Rich `Text` object to colorize.
  - `gradient` -- A Textual `Gradient`.
  - `width` -- Total width of the gradient spread.

## textual.renderables.blank

### Blank

`Blank(Visual)` -- Draws a solid background color. Implements the `Visual` protocol.

#### Initialization

```python
def __init__(self, color: Color | str = "transparent") -> None
```

- **Parameters:**
  - `color` -- Background color as a `Color` or parseable color string.

#### Methods

- `visualize() -> Blank` -- Returns self (already a visual).
- `get_optimal_width(rules: RulesMap, container_width: int) -> int` -- Returns `container_width`.
- `get_height(rules: RulesMap, width: int) -> int` -- Returns `1`.
- `render_strips(width: int, height: int | None, style: Style, options: RenderOptions) -> list[Strip]` -- Renders blank strips filled with the background color. If `height` is `None`, renders 1 line; otherwise renders `height` lines. All lines are identical `Strip.blank` instances.

## textual.renderables.digits

### Constants

- `DIGITS: str = " 0123456789+-^x:ABCDEF$£€()"` -- Character set supported by the digit font.
- `DIGITS3X3_BOLD: str` -- Bold variant of the 3x3 unicode digit font (uses thick box-drawing characters).
- `DIGITS3X3: str` -- Normal variant of the 3x3 unicode digit font (uses thin box-drawing characters).

### Digits

`Digits` -- Renders a 3x3 unicode "font" for numerical values. Implements the Rich console protocol.

#### Class Variables

- `REPLACEMENTS` -- Translation table mapping `"."` to `"•"`.

#### Initialization

```python
def __init__(self, text: str, style: StyleType = "") -> None
```

- **Parameters:**
  - `text: str` -- Text to display. Characters in `DIGITS` are rendered as 3x3 glyphs; other characters are rendered as-is in the bottom row.
  - `style: StyleType` -- Style applied to the rendered digits.

#### Methods

- `render(style: Style) -> RenderResult` -- Renders the digits with the given style. If `style.bold` is `True`, uses `DIGITS3X3_BOLD`; otherwise uses `DIGITS3X3`. Each character produces three rows of three-cell-wide segments. Characters not found in `DIGITS` occupy one cell in the bottom row only.

- `get_width(text: str) -> int` (classmethod) -- Calculate the rendered width without rendering. Characters in `DIGITS` contribute 3 cells; others contribute 1 cell.

#### Rich Console Protocol

- `__rich_console__` -- Delegates to `render` with the resolved style.
- `__rich_measure__` -- Returns a `Measurement` with min and max width equal to `get_width(text)`.

## textual.renderables.gradient

### VerticalGradient

`VerticalGradient` -- Draws a vertical gradient between two colors. Implements the Rich console protocol.

#### Initialization

```python
def __init__(self, color1: str, color2: str) -> None
```

- **Parameters:**
  - `color1: str` -- Top color (parseable color string).
  - `color2: str` -- Bottom color (parseable color string).

#### Rich Console Protocol

`__rich_console__` renders the gradient as full-width space characters, one per line, with the background color blending from `color1` to `color2` across `height` lines.

### LinearGradient

`LinearGradient` -- Renders a linear gradient with a rotation angle. Implements the Rich console protocol.

#### Initialization

```python
def __init__(
    self,
    angle: float,
    stops: Sequence[tuple[float, Color | str]],
) -> None
```

- **Parameters:**
  - `angle: float` -- Angle of rotation in degrees.
  - `stops` -- List of color stops, each a `(offset, color)` pair. Offsets range from 0 to 1. Colors may be `Color` objects or parseable strings.

#### Instance Attributes

- `angle: float` -- The rotation angle.
- `_stops` -- Normalized stops with parsed colors.
- `_color_gradient: Gradient` -- A `Gradient` object constructed from the stops.

#### Rich Console Protocol

`__rich_console__` renders using `"▀"` (upper-half block) characters, computing foreground and background colors per cell based on the rotated gradient. Each cell represents two vertical rows of color. Special-cases near-vertical gradients (delta < 0.0001) for efficiency, rendering full-width segments instead of per-cell segments.

## textual.renderables.sparkline

### Type Aliases

- `T = TypeVar("T", int, float)` -- Numeric type variable.
- `SummaryFunction = Callable[[Sequence[T]], float]` -- Callable that summarizes a bucket of values into a single float.

### Sparkline

`Sparkline(Generic[T])` -- A sparkline representing a series of data as a compact bar chart. Implements the Rich console protocol.

#### Class Constants

- `BARS: str = "▁▂▃▄▅▆▇█"` -- Bar characters from shortest to tallest.

#### Initialization

```python
def __init__(
    self,
    data: Sequence[T],
    *,
    width: int | None,
    height: int | None = None,
    min_color: Color = Color.from_rgb(0, 255, 0),
    max_color: Color = Color.from_rgb(255, 0, 0),
    summary_function: SummaryFunction[T] = max,
) -> None
```

- **Parameters:**
  - `data` -- The sequence of numeric data to render.
  - `width` -- Width of the sparkline (number of buckets). `None` to fill available width.
  - `height` -- Height in terminal lines. `None` defaults to 1.
  - `min_color` -- Color for values equal to the minimum (default green).
  - `max_color` -- Color for values equal to the maximum (default red).
  - `summary_function` -- Function applied to each bucket to produce a representative value (default `max`).

#### Methods

- `_buckets(data: list[T], num_buckets: int) -> Iterable[Sequence[T]]` (classmethod) -- Partitions `data` into `num_buckets` evenly-sized buckets using `Fraction` for precise boundaries.

#### Rich Console Protocol

`__rich_console__` renders the sparkline:
- Empty data: renders `"▁"` repeated across the width in `min_color`.
- Single data point: renders `"█"` repeated across the width in `max_color`.
- Multiple data points: partitions data into buckets, applies the summary function per bucket, maps values to bar characters across `height` lines. Colors are blended between `min_color` and `max_color` based on the value's position within the data range.

`__rich_measure__` returns a `Measurement` with the width and height.
