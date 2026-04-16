# Integration notes for spec-src/04-styling-and-css-engine.md

## Critical context

- **Rich-js role**: TCSS `<color>` values resolve to rich-js `Color` instances (not strings). Theme variables are `Color` instances. `color: auto` computes via `Color.contrastRatio()`. Animated color transitions use `Color.blend()`. Style output includes a rich-js `Style` for content segments in addition to Ink props for Box/Text.
- **Terminal-UI reality**: cell-width-aware scalar units (`w`/`h`/`vw`/`vh`/`fr`) resolve against terminal dimensions. Component classes resolve to rich-js `Style` per segment.

## Gaps to fix

### 1. Color value type

**Where**: "Color values" subsection under "Scalar Units and Values".
**Current state**: Lists color formats (hex, rgb, hsl, named, opacity suffix, theme variables).
**Why insufficient**: Doesn't say that at cascade resolution time, all of these become rich-js `Color` instances.
**Required change**: Add sentence at end of Color values section: "All color values resolve to rich-js `Color` instances during cascade resolution. Ink color props at the render boundary are produced via `Color.toAnsi()` respecting the active color depth and output filter pipeline. The string forms above are input syntax; `Color` is the internal representation."

### 2. `initial` fallback uses Color blending

**Where**: "`initial` handling" step in Style Application Algorithm.
**Current state**: Describes the fallback mechanism.
**Why insufficient**: No issue — the mechanism is independent of color type. But add a note that color-valued `initial` fallbacks produce `Color` instances like any other resolution.
**Required change**: No structural change needed. (If convenient, a one-sentence clarification.)

### 3. `color: auto` contrast computation

**Where**: "Style Application Algorithm" or "Color values".
**Current state**: Not mentioned.
**Why insufficient**: `color: auto` is a Textual feature — the foreground color auto-contrasts against the widget's background.
**Required change**: Add a subsection "Auto-contrast (`color: auto`)". When a TCSS declaration uses `color: auto` (or `background-tint: auto`), cascade resolution computes the contrasting color via rich-js `Color.contrastRatio()` and `Color.luminance`. The result is a concrete `Color`; it is resolved lazily (depends on the final resolved `background` of the widget).

### 4. ResolvedStyles contains both Ink props and rich-js Style

**Where**: "Style Application Algorithm" step 8 ("Store").
**Current state**: Says "write the resolved styles to the widget's `ResolvedStyles` MobX observable."
**Why insufficient**: Doesn't specify the shape. `ResolvedStyles` has multiple branches:
  - `box` — Ink `<Box>` props
  - `text` — Ink `<Text>` props
  - `style` — rich-js `Style` for content segments (used by Line API widgets)
  - `components` — `Map<componentClassName, rich-js Style>` for per-component-class styling
**Required change**: Expand the Store step to describe `ResolvedStyles` structure. Also update the "TCSS → Ink prop translation" section to show the `components` map and `style` field, not only `box` and `text`.

### 5. Animation via Color.blend

**Where**: "Animation Integration" section.
**Current state**: "The Animator interpolates from old → new over the specified duration."
**Why insufficient**: For color-valued properties, interpolation is specifically `Color.blend(old, new, t)` — rich-js. Non-color animatable properties use numeric interpolation.
**Required change**: Add one sentence: "Color-valued properties interpolate via rich-js `Color.blend(from, to, t)` per animator tick; numeric properties use linear or easing-function numeric interpolation."

### 6. Theme CSS variables

**Where**: "Theme Integration" / "Theme swap contract".
**Current state**: "New theme → CSS variable map" — doesn't say what values are in the map.
**Why insufficient**: Map is `name → rich-js Color` (for color variables) and `name → string/number` (for non-color variables).
**Required change**: Step 1 becomes: "New theme → CSS variable map (`Record<string, Color | string | number>`). Color fields are parsed into rich-js `Color` at registration; derived variables (`$primary-lighten-2`, `$surface-darken-1`) are computed via `Color.lighten/darken/blend`."

### 7. Cell-width truth for scalar units

**Where**: "Scalar Units and Values" section.
**Current state**: Describes units (fr, %, cells, vw, vh, auto).
**Why insufficient**: Doesn't say that "cells" means terminal cells (not characters) and wide characters count as 2.
**Required change**: Add sentence to the "Cells" row description or to a note after the table: "A 'cell' is a terminal column. Wide characters (CJK, emoji) occupy 2 cells; combining characters occupy 0. Cell counts come from rich-js `cellLength`, not `str.length`."

## Do not change

- Parsing pipeline (css-tree integration)
- Selector capabilities and pseudo-classes
- Specificity, `!important`, cascade rules
- Stylesheet source model and cache invalidation
- Margin collapse mechanics (spec 05 territory)
- Existing property registry tables — they're accurate
- Error reporting taxonomy
