# Filters

Display filters transform rendered segments before they reach the terminal. Each filter implements an `apply` method that accepts a list of Rich `Segment` objects and a `Color` representing the background, and returns a new list of transformed segments.

## Filter Types

### ANSIToTruecolor

`ANSIToTruecolor` converts ANSI color values (including 8-bit palette colors) into true-color RGB values using a terminal theme. It is constructed with a Rich `TerminalTheme` (e.g., `MONOKAI`).

- Accepts segments whose styles use ANSI or 8-bit color types.
- Produces segments with equivalent true-color styles derived from the theme mapping.
- Handles the `dim` style attribute on 8-bit colors without error (regression: issue #5946).

### DimFilter

`DimFilter` resolves the `dim` style attribute into a concrete color adjustment, then removes the `dim` flag from the style. It requires no constructor arguments.

- For a segment with `dim` set and a foreground color, the filter blends the foreground color toward the background color, producing a muted variant.
- The `dim` attribute is cleared (`not dim`) on the output style so downstream consumers do not double-apply dimming.
- The background color of the style is preserved unchanged.
- Example transformation: foreground `#ffffff` on background `#0000ff` with a screen background of `#000000` becomes foreground `#7f7fff` on background `#0000ff`, with `dim` removed. The blending pulls the white foreground halfway toward black (the screen background), while the blue channel survives from the style's own background.

## Constraints

- Every filter's `apply` method must accept a list of `Segment` and a `Color` (background) and return a list of `Segment`. This is the single enforcer boundary for segment transformation.
- Filters must not mutate the input segment list; they return new segments.
- `ANSIToTruecolor` requires a `TerminalTheme` at construction time; `DimFilter` is stateless.
- Color blending in `DimFilter` uses the screen background color (passed to `apply`), not the segment's own background, as the blend target.
