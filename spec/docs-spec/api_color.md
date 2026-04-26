# Docs Spec: API — Color

## Purpose
Describes the API reference doc for the color module: the Color value type, color-space representations (HSL, HSV, Lab), parsing, manipulation (blend, tint, darken, lighten, with-alpha, contrast text), gradients, and module-level color constants and conversion helpers.

## Audience
Widget authors and theme authors working with colors (parsing user input, animating colors, picking contrast text, creating gradients).

## Required sections
1. Overview: Color is the value type used throughout styling and the animation system.
2. Color-space records: HSL, HSV, Lab — fields and ranges for each.
3. The Color value: RGBA fields, ANSI index, "automatic" flag.
4. Color properties: inverse, is_transparent, clamped, normalized RGB, RGB tuple, HSL/HSV conversions, perceived brightness, hex and hex-without-alpha, CSS string form, monochrome/luminance version.
5. Color construction: from RGB, from HSL, from HSV, automatic (contrast-driven) colors, and parsing.
6. Color parsing: the full supported grammar (hex, decimal rgb/rgba, hsl/hsla with degrees and percentages, named colors, ANSI names, "transparent"), and the structured error with a suggested-name hint.
7. Color manipulation: with_alpha, multiply_alpha, blend (with the animatable blend protocol), tint, darken, lighten, get_contrast_text.
8. Operator behavior: adding a color overlays it onto this color using its alpha as the blend factor.
9. Gradient: defining a gradient with stops (must start at 0 and end at 1, at least two stops), constructing one from evenly-spaced colors, computing pre-computed color steps, and looking up a color by position.
10. Module-level constants: WHITE, BLACK, TRANSPARENT.
11. Module-level conversions: RGB to Lab and Lab to RGB (via XYZ with D65/2 degree illuminant).

## Key concepts
- Color is immutable; every mutation returns a new Color.
- Color implements the animatable protocol (has a `blend(destination, factor)` method) so it participates in the animation system directly.
- "Automatic" colors are resolved against their surrounding color to maximize contrast at render time.
- ANSI-indexed colors are preserved end-to-end through blends/tints (blending an ANSI color returns it unchanged).
- Gradients pre-compute a fixed number of stops (quality) and blend between adjacent stops for intermediate positions.

## Behaviors and contracts
- Parsing an invalid color must throw the color parse error and, when close to a known named color, include a suggested name.
- Alpha is a 0.0–1.0 float; `clamped` forces all channels and alpha into their valid ranges.
- `get_contrast_text` returns an off-white or off-black determined by perceived brightness against a documented threshold.
- Blending an automatic destination color resolves the destination via contrast logic before blending.
- A gradient must have stops that start at 0.0 and end at 1.0 with at least two entries; other configurations must throw.
- `from_colors` derives evenly spaced stops from a color list.

## Example requirements
All examples must be JSX/TypeScript using Ink primitives and textual-js APIs:
- Parsing several strings in different formats into Color instances, including a failing parse that surfaces a suggested name.
- Manipulating a Color: darken, lighten, add alpha, blend toward another color.
- Using `get_contrast_text` to pick a readable foreground over a background.
- Creating a gradient with explicit stops and with evenly spaced colors, then reading intermediate colors by position.
- Animating a Color property by passing a target color (demonstrating the blend protocol integration).

## Cross-references
- `spec/docs-spec/animation.md` (Color participates in the animation system).
- `spec/spec-src/04-styling-and-css-engine.md` (CSS color parsing and theme token usage).
- `spec/spec-src/05-layout-render-and-compositor.md` (how colors reach the terminal via Ink).

## Notes for writers
- Drop Python specifics: NamedTuple, `Final`, `functools.lru_cache`, `@rich.repr.auto`, the Rich `Color` interop. Describe Color as a plain TS value type; caching of parsed colors is an implementation detail that may be documented as "parse results are memoized" without referencing `lru_cache`.
- The `from_rich_color` method does not apply to textual-js; omit it.
- The ANSI-preservation behavior (ANSI index survives blends/tints) still applies because terminal ANSI mapping is a real concern; document it without invoking Rich.
- Keep the full parse grammar — every format is user-observable via CSS and theme definitions.
- Keep the module-level RGB<->Lab conversion helpers; they are useful for custom color work and are not Python-specific.
- Do not mention `__add__`/`__radd__` Python operators by name; describe the overlay behavior as a method (for example, `over(other)`) if textual-js exposes it that way, or omit operator overloading entirely.
