# textual.color

This module contains the `Color` class and related types for color manipulation.

## HSL

`HSL` is a `NamedTuple` representing a color in HSL (Hue, Saturation, Lightness) format.

### Fields

- `h: float` -- Hue in range 0 to 1.
- `s: float` -- Saturation in range 0 to 1.
- `l: float` -- Lightness in range 0 to 1.

### Properties

- `css -> str` -- The color in CSS HSL format, e.g. `"hsl(120,50%,75%)"`.

## HSV

`HSV` is a `NamedTuple` representing a color in HSV (Hue, Saturation, Value) format.

### Fields

- `h: float` -- Hue in range 0 to 1.
- `s: float` -- Saturation in range 0 to 1.
- `v: float` -- Value in range 0 to 1.

## Lab

`Lab` is a `NamedTuple` representing a color in CIE-L*ab format.

### Fields

- `L: float` -- Lightness in range 0 to 100.
- `a: float` -- A axis in range -127 to 128.
- `b: float` -- B axis in range -127 to 128.

## ColorParseError

Exception raised when a color fails to parse.

### Attributes

- `suggested_color: str | None` -- A close color name that can be suggested, if available.

## Color

`Color` is a `NamedTuple` representing a color with RGBA components. Decorated with `@rich.repr.auto`.

### Fields

- `r: int` -- Red component in range 0 to 255.
- `g: int` -- Green component in range 0 to 255.
- `b: int` -- Blue component in range 0 to 255.
- `a: float = 1.0` -- Alpha (opacity) component in range 0.0 to 1.0.
- `ansi: int | None = None` -- ANSI color index. `-1` means default color. `None` if not an ANSI color.
- `auto: bool = False` -- Whether the color is automatic (automatic colors may be white or black to provide maximum contrast).

### Properties

- `inverse -> Color` -- The inverse of this color (255 - r, 255 - g, 255 - b), preserving alpha.
- `is_transparent -> bool` -- Whether the color is transparent (alpha is 0 and `ansi` is `None`).
- `clamped -> Color` -- A copy with all values clamped to their expected ranges (r/g/b: 0-255, a: 0.0-1.0).
- `rich_color -> RichColor` -- The color encoded as a Rich `Color` object. Cached with `lru_cache(1024)`. ANSI colors return the corresponding Rich ANSI color; `-1` returns `"default"`.
- `normalized -> tuple[float, float, float]` -- RGB components normalized to range 0.0 to 1.0.
- `rgb -> tuple[int, int, int]` -- The red, green, and blue components as a tuple.
- `hsl -> HSL` -- The color in HSL format.
- `hsv -> HSV` -- The color in HSV format.
- `brightness -> float` -- Human perceptual brightness. 1.0 for pure white, 0.0 for pure black. Uses weighted formula: `(299*r + 587*g + 114*b) / 1000`.
- `hex -> str` -- CSS hex form with 6 digits for RGB or 8 digits for RGBA (e.g. `"#46B3DE"` or `"#3342457F"`). ANSI colors return `"ansi_default"` or `"ansi_{name}"`.
- `hex6 -> str` -- CSS hex form with 6 digits, ignoring alpha (e.g. `"#46B3DE"`).
- `css -> str` -- CSS format: `"rgb(r,g,b)"` for opaque, `"rgba(r,g,b,a)"` for transparent. Auto colors return `"auto"` or `"auto {percentage}%"`. ANSI colors return `"ansi_default"` or `"ansi_{name}"`.
- `monochrome -> Color` -- A monochrome (grayscale) version using luminance formula: `0.2126*r + 0.7152*g + 0.0722*b`.

### Class Methods

- `automatic(alpha_percentage: float = 100.0) -> Color` -- Create an automatic color (black with `auto=True`). Alpha is `alpha_percentage / 100.0`.
- `from_rich_color(rich_color: RichColor | None, theme: TerminalTheme | None = None) -> Color` -- Create from a Rich Color. Cached with `lru_cache(1024)`. Returns `TRANSPARENT` if `rich_color` is `None`.
- `from_hsl(h: float, s: float, l: float) -> Color` -- Create from HSL components (each in range 0 to 1).
- `from_hsv(h: float, s: float, v: float) -> Color` -- Create from HSV components (each in range 0 to 1).
- `parse(color_text: str | Color) -> Color` -- Parse a string or return an existing Color unchanged. Cached with `lru_cache(1024 * 4)`. Supported formats:
  - `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA` (hex)
  - `rgb(R,G,B)`, `rgba(R,G,B,A)` (decimal, R/G/B 0-255, A 0-1)
  - `hsl(H,S%,L%)`, `hsla(H,S%,L%,A)` (H 0-360, S/L percentage, A 0-1)
  - Named colors (from `COLOR_NAME_TO_RGB`)
  - `ansi_default`, `ansi_{name}` (ANSI colors)
  - Raises `ColorParseError` on failure, with a `suggested_color` if a close named color exists.

### Instance Methods

- `with_alpha(alpha: float) -> Color` -- Create a new color with the given alpha, preserving RGB.
- `multiply_alpha(alpha: float) -> Color` -- Create a new color with alpha multiplied by the given factor. ANSI colors are returned unchanged.
- `blend(destination: Color, factor: float, alpha: float | None = None) -> Color` -- Generate a new color between this and `destination` on a gradient. `factor` 0.0 returns self, 1.0 returns destination. Cached with `lru_cache(1024)`. If `destination` is auto, resolves to contrast text. If `destination` is ANSI, returns destination directly.
- `tint(color: Color) -> Color` -- Apply a tint using the alpha of the given color as blend factor. Cached with `lru_cache(1024)`. ANSI colors are returned unchanged.
- `darken(amount: float, alpha: float | None = None) -> Color` -- Darken by reducing luminance in CIE-L*ab space. `amount` is 0-1 (fraction of 100 L* units). Cached with `lru_cache(1024)`.
- `lighten(amount: float, alpha: float | None = None) -> Color` -- Lighten by increasing luminance. Delegates to `darken(-amount, alpha)`.
- `get_contrast_text(alpha: float = 0.95) -> Color` -- Return an off-white or off-black color that best contrasts this color for text readability. Uses `brightness < 0.5` threshold. Cached with `lru_cache(1024)`.

### Operators

- `__add__(other: Color) -> Color` -- Blend with `other` using `other.a` as factor and result alpha 1.0. Returns `self` if `other` is `None`.
- `__radd__(other: Color) -> Color` -- Same as `__add__`.

## Gradient

`Gradient` defines a color gradient by interpolating between color stops.

### Constructor

`Gradient(*stops: tuple[float, Color | str], quality: int = 50)`

- `stops` -- Color stops as `(position, color)` tuples. Positions are floats between 0.0 and 1.0. Colors may be `Color` instances or parseable strings.
- `quality` -- Number of steps in the gradient (higher = smoother, more pre-computation).
- Raises `ValueError` if fewer than 2 stops, first stop is not 0.0, or last stop is not 1.0.

### Class Methods

- `from_colors(*colors: Color | str, quality: int = 50) -> Gradient` -- Construct a gradient with evenly spaced stops. Requires at least 2 colors. Raises `ValueError` otherwise.

### Properties

- `colors -> list[Color]` -- Pre-computed list of colors in the gradient (length equals `quality`). Lazily computed and cached.

### Methods

- `get_color(position: float) -> Color` -- Get a color at a position between 0 and 1. Positions between pre-computed steps are blended.
- `get_rich_color(position: float) -> RichColor` -- Get a Rich color at a position between 0 and 1.

## Module-Level Constants

- `WHITE: Final = Color(255, 255, 255)` -- Pure white.
- `BLACK: Final = Color(0, 0, 0)` -- Pure black.
- `TRANSPARENT: Final = Color.parse("transparent")` -- Transparent color.

## Module-Level Functions

- `rgb_to_lab(rgb: Color) -> Lab` -- Convert RGB to CIE-L*ab. Uses D65/2 degree standard illuminant, passing through XYZ color space.
- `lab_to_rgb(lab: Lab, alpha: float = 1.0) -> Color` -- Convert CIE-L*ab to RGB. Uses D65/2 degree standard illuminant, passing through XYZ color space.
