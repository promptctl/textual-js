# Color

The `Color` class represents an RGBA color value used throughout Textual for styling. It supports construction from multiple color spaces, parsing from CSS-like strings, arithmetic operations for compositing, and conversion between color representations.

## Construction

### Direct RGBA

- `Color(r, g, b)` creates a color with full opacity (alpha defaults to 1.0).
- `Color(r, g, b, a)` creates a color with explicit alpha, where `a` is a float from 0.0 to 1.0.
- `Color(r, g, b, a, ansi=N)` creates an ANSI-mapped color with an ANSI color index.
- `Color(r, g, b, a, auto=True)` creates an automatic color that resolves to white or black based on the background luminance.

### From HSL

- `Color.from_hsl(h, s, l)` creates a color from hue (0.0-1.0), saturation (0.0-1.0), and lightness (0.0-1.0).
- Round-tripping through `color.hsl` and `Color.from_hsl()` preserves the normalized RGB values within floating-point tolerance.

### From HSV

- `Color.from_hsv(h, s, v)` creates a color from hue (0.0-1.0), saturation (0.0-1.0), and value (0.0-1.0).
- Round-tripping through `color.hsv` and `Color.from_hsv()` preserves the normalized RGB values within floating-point tolerance.

### From Rich Color

- `Color.from_rich_color(rich_color)` converts a `rich.color.Color` into a Textual `Color` with full opacity.

### Automatic Colors

- `Color.automatic()` creates an automatic color that resolves to white on dark backgrounds and black on light backgrounds.
- `Color.automatic(percentage)` creates an automatic color that blends toward the resolved white/black by the given percentage.

## Parsing

### `Color.parse()`

- Accepts 3-digit hex shorthand: `"#fab"` expands to `Color(255, 170, 187, 1.0)`.
- Accepts 4-digit hex shorthand (with alpha): `"#fab0"` expands to `Color(255, 170, 187, 0.0)`.
- Accepts 6-digit hex: `"#000000"` produces `Color(0, 0, 0, 1.0)`. Case-insensitive (`"#FFFFFF"` and `"#ffffff"` are equivalent).
- Accepts 8-digit hex (with alpha): `"#020304ff"` produces `Color(2, 3, 4, 1.0)`.
- Accepts `rgb(r,g,b)` functional notation: `"rgb(0,0,0)"` produces `Color(0, 0, 0, 1.0)`.
- Accepts `rgba(r,g,b,a)` functional notation: `"rgba(2,3,4,1.0)"` produces `Color(2, 3, 4, 1.0)`.
- Accepts `hsl(deg,s%,l%)` functional notation: `"hsl(45,25%,25%)"` produces `Color(80, 72, 48)`.
- Accepts `hsla(deg,s%,l%,a)` functional notation: `"hsla(45,25%,25%,0.35)"` produces `Color(80, 72, 48, 0.35)`.
- Accepts ANSI color names: `"ansi_red"` parses to an ANSI-indexed color.
- Whitespace inside functional notation is tolerated: `"rgb( 300, 300 , 300 )"` parses successfully.
- HSL accepts negative degrees: `"hsl(-90, 50%, 50%)"` is equivalent to `"hsl(270, 50%, 50%)"`.
- HSLA accepts negative degrees: `"hsla(-45, 50%, 50%, 0.2)"` is equivalent to `"hsla(315, 50%, 50%, 0.2)"`.
- If passed a `Color` object directly, returns that same object (identity).

### Clamping on Parse

- RGB values above 255 clamp to 255: `"rgb(300, 300, 300)"` produces `Color(255, 255, 255)`.
- Alpha values above 1.0 clamp to 1.0: `"rgba(300, 300, 300, 300)"` produces `Color(255, 255, 255, 1.0)`.
- HSL percentages above 100% clamp to 100%: `"hsl(400, 200%, 250%)"` produces `Color(255, 255, 255, 1.0)`.

## Properties

### Component Access

- `color.rgb` returns an `(r, g, b)` tuple of integers, excluding alpha.
- `color.normalized` returns an `(r, g, b)` tuple of floats in the range 0.0-1.0.
- `color.hsl` returns an `(h, s, l)` named tuple; `color.hsl.css` produces a CSS-formatted string like `"hsl(356,81.8%,43.1%)"`.
- `color.hsv` returns an `(h, s, v)` tuple.
- `color.brightness` returns a float from 0.0 (black) to 1.0 (white) representing perceptual luminance.

### Serialization

- `color.hex` returns an uppercase hex string: `"#FF007F"` for opaque colors, `"#FF007F7F"` when alpha is not 1.0.
- `color.hex6` always returns a 6-digit hex string, ignoring alpha: `"#FF007F"`.
- `color.css` returns `"rgb(r,g,b)"` for opaque colors, `"rgba(r,g,b,a)"` when alpha is not 1.0.
- ANSI colors serialize via `color.css` as their name: `"ansi_red"`.
- Automatic colors serialize as `"auto 50%"` or `"auto 70.5%"`.

### Rich Interop

- `color.rich_color` returns a `rich.color.Color` constructed from the RGB components.

### Transparency

- `color.is_transparent` is `True` when alpha is 0 and the color has no ANSI index.
- A zero-alpha color with an ANSI index is NOT transparent.
- Any color with alpha > 0 is NOT transparent.

## Derived Colors

### Clamping

- `color.clamped` returns a new `Color` with all components clamped to valid ranges (0-255 for RGB, 0.0-1.0 for alpha).

### Monochrome

- `color.monochrome` converts to a grayscale equivalent, preserving alpha.
- Pure black remains black; pure white remains white.

### Inverse

- `color.inverse` returns a color with each RGB channel inverted (255 - value), preserving alpha.

### Alpha Modification

- `color.with_alpha(a)` returns a new color with the given alpha, preserving RGB.
- `color.multiply_alpha(factor)` returns a new color whose alpha is the original alpha multiplied by the factor.

## Color Arithmetic

### Blending

- `color.blend(other, factor)` linearly interpolates between `color` and `other`.
- Factor 0.0 returns the original color; factor 1.0 returns `other`; 0.5 is the midpoint.

### Tinting

- `color.tint(tint_color)` applies a tint overlay to the base color.
- Tinting with an opaque color replaces the base entirely.
- Tinting with a semi-transparent color blends proportionally.
- The result always carries the base color's alpha; the tint color's alpha only controls blending weight, not the output alpha.
- Tinting with an ANSI color is a no-op (returns the base unchanged).

### Compositing (Addition)

- `color1 + color2` composites `color2` over `color1`.
- If `color2` has no alpha (fully opaque), the result is `color2`.
- If `color2` has partial alpha, the result is a blend weighted by that alpha.
- If `color2` is an automatic color, it resolves to white or black based on `color1`'s brightness, then blends if a percentage is specified.
- Adding a non-Color value returns `NotImplemented`.

### Darken and Lighten

- `color.darken(amount)` darkens the color by the given amount (0.0-1.0). An amount of 1.0 produces black; a negative amount lightens.
- `color.lighten(amount)` lightens the color by the given amount (0.0-1.0). An amount of 1.0 produces white; a negative amount darkens.

## CIE-L*ab Color Space

### Conversion Functions

- `rgb_to_lab(color)` converts a `Color` to a `Lab` named tuple with `L`, `a`, `b` fields.
- `lab_to_rgb(lab)` converts a `Lab` back to a `Color`.
- Black `(0,0,0)` maps to `Lab(0, 0, 0)`; white `(255,255,255)` maps to `Lab(100, 0, 0)`.
- Round-tripping `Color -> Lab -> Color` preserves RGB values within +/-1.

## Gradient

### Construction

- `Gradient((stop, color), ...)` creates a gradient from a sequence of `(position, color)` stops where positions range from 0.0 to 1.0.
- Color stops can be specified as `Color` objects or parseable strings (e.g., `"blue"`).
- A `quality` parameter controls interpolation resolution.

### Validation Errors

- An empty `Gradient()` raises `ValueError`.
- A single stop raises `ValueError`.
- Stops that do not start at 0.0 raise `ValueError`.
- Stops that do not end at 1.0 raise `ValueError`.
- `Gradient.from_colors()` with fewer than two colors raises `ValueError`.

### Sampling

- `gradient.get_color(position)` returns the interpolated color at the given position.
- Positions below 0.0 clamp to the first stop's color.
- Positions above 1.0 clamp to the last stop's color.
- Exact stop positions return the stop's color exactly.

## Constraints

- RGB component values are integers in the range 0-255. Out-of-range values are accepted at construction but clamped via `.clamped` or during parsing.
- Alpha is a float in the range 0.0-1.0. Values outside this range are clamped where appropriate.
- HSL and HSV hue values are in the range 0.0-1.0 (not degrees) when using `from_hsl`/`from_hsv`. The parse functions accept degrees (including negative).
- CIE-L*ab round-trip conversions are accurate to within +/-1 per RGB channel.
- Gradient stops must span the full 0.0-1.0 range and require at least two stops.
- Automatic colors resolve lazily: they produce white or black only when composited over a concrete background via addition.
