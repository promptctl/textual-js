# textual.filter

Filters are used internally to process terminal output after it has been rendered. They are not recommended for use by Textual app developers. Currently used to convert output to monochrome when `NO_COLOR` is set.

## LineFilter (ABC)

`LineFilter` (`textual.filter`) is the abstract base class for all line filters.

### Constructor

- `__init__(enabled: bool = True)` -- Create a filter. If `enabled` is `False`, the filter will not be applied.

### Instance Attributes

- `enabled: bool` -- Whether the filter is currently active.

### Abstract Methods

- `apply(segments: list[Segment], background: Color) -> list[Segment]` -- Transform a list of Rich `Segment` objects. Must be implemented by subclasses. Receives the current background `Color` and returns a new list of segments.

## Monochrome

`Monochrome(LineFilter)` -- Convert all colors to monochrome.

### Methods

- `apply(segments: list[Segment], background: Color) -> list[Segment]` -- Replace all color information with monochrome equivalents by converting each style via `monochrome_style`.

## NoColor

`NoColor(LineFilter)` -- Remove all color information from segments entirely.

### Class Variables

- `DEFAULT_COLORS: Style` -- A Rich `Style` with foreground and background set to `"default"`.

### Methods

- `apply(segments: list[Segment], background: Color) -> list[Segment]` -- Replace all styles with styles that have default (no) colors.

## DimFilter

`DimFilter(LineFilter)` -- Replace dim attributes with modified colors. Can be used as a workaround for terminal dim rendering issues.

### Constructor

- `__init__(dim_factor: float = 0.5, enabled: bool = True)` -- Initialize the filter. `dim_factor` controls the blend: `0` is 100% background (invisible), `1.0` is no change.

### Instance Attributes

- `dim_factor: float` -- The blend factor used for dimming.

### Methods

- `apply(segments: list[Segment], background: Color) -> list[Segment]` -- For segments with `style.dim == True`, replace the dim attribute with a blended color. Non-dim segments are passed through unchanged.

## ANSIToTruecolor

`ANSIToTruecolor(LineFilter)` -- Convert ANSI colors to their truecolor equivalents.

### Constructor

- `__init__(terminal_theme: TerminalTheme, enabled: bool = True)` -- Initialize with a Rich `TerminalTheme` used for ANSI-to-truecolor mapping.

### Instance Attributes

- `_terminal_theme: TerminalTheme` -- The theme used to resolve ANSI colors.

### Methods

- `truecolor_style(style: Style, background: RichColor) -> Style` -- Replace system colors in a style with truecolor equivalents. Also handles dim by blending. Results are cached (LRU, 1024 entries).
- `apply(segments: list[Segment], background: Color) -> list[Segment]` -- Apply truecolor conversion to all segments.

## Module-Level Functions

- `monochrome_style(style: Style) -> Style` -- Convert colors in a Rich `Style` to monochrome. Cached (LRU, 1024 entries).
- `dim_color(background: RichColor, color: RichColor, factor: float = DIM_FACTOR) -> RichColor` -- Dim a color by blending it towards the background color. Cached (LRU, 1024 entries).
- `dim_style(style: Style, background: Color, factor: float) -> Style` -- Replace the dim attribute on a style with a dimmed color. Cached (LRU, 1024 entries).

## Module-Level Constants

- `NO_DIM: Style` -- A Rich `Style` with `dim=False`, used to remove the dim attribute after color replacement.
- `DEFAULT_COLOR: RichColor` -- A Rich `Color` set to default, used as a fallback.
