# Renderables

Rich renderables used internally by Textual for styled terminal output.

## Sparkline

### Overview

`Sparkline` renders a sequence of numeric data as a compact bar chart using Unicode block characters (e.g., `▁`, `▄`, `█`). It accepts a `width` and an optional `height`, and colors bars on a gradient from green (minimum) to red (maximum).

### Data and Width

- When `data` is empty, the sparkline renders all minimum-height blocks (`▁`) at the width, colored green.
- A single data point fills the entire width with maximum-height blocks (`█`), colored red.
- When the data has fewer points than the width, values are expanded (repeated) to fill the width. For non-evenly-divisible widths, the expansion truncates rather than rounds up.
- When the data has more points than the width, values are aggregated (averaged per bucket) to shrink to the target width.

### Color Blending

Each bar's color is interpolated between green (min value) and red (max value) based on where the data point falls in the range. A value halfway between min and max produces a blended yellow-ish color.

### Height

- At `height=1` (the default), the sparkline is a single row.
- At `height > 1`, the sparkline expands vertically. Higher bars extend into upper rows, and cells without bar content are rendered as spaces. The bottom row always contains content for every column.

### Accepted Sequence Types

`Sparkline` accepts any `Sequence` of numbers, including `list`, `tuple`, `bytes`, `bytearray`, `deque`, `range`, and `UserList`.

## Text Opacity

### Overview

`TextOpacity` wraps a Rich `Text` object and renders it with a specified opacity level, blending the foreground color toward the background color.

### Opacity Behavior

- At `opacity=1`, the output is identical to rendering the original text (no-op).
- At `opacity=0`, the text characters are replaced with spaces, and only the background color remains visible.
- At intermediate values (e.g., `opacity=0.5`), the foreground color is blended toward the background color proportionally.

### No-Op Conditions

`TextOpacity` acts as a no-op (produces output identical to the unstyled text) when:

- The text has no style at all.
- The text has only a foreground color (no background).
- The text has only a background color (no foreground).

Blending requires both a foreground and a background color to be present.

## Tint

### Overview

`Tint` applies a color overlay to a sequence of Rich segments. It operates via a static `process_segments` method that takes existing segments, a `Color` with an alpha component, and an ANSI theme for resolving named colors.

### Color Application

The tint color's alpha channel controls blend strength. For example, a `Color(0, 100, 0, 0.5)` applies a 50% green tint, shifting both foreground and background colors of each segment toward that green.

### ANSI Theme Resolution

Named ANSI colors (e.g., `red`, `yellow`) are resolved through the provided `ansi_theme` before blending. Different themes produce different output for the same ANSI color names, since the resolved RGB values differ.

## Underline Bar

### Overview

`Bar` renders a horizontal line of `━` characters at a given `width`, with an optional highlighted range. It is used for underline-style indicators (e.g., tab bars).

### Highlight Range

- `highlight_range` is a tuple of `(start, end)` floats specifying which portion of the bar to highlight.
- The default highlight style is magenta; the default background style is grey.
- Both `highlight_style` and `background_style` can be customized with any Rich style string.

### Sub-Character Precision

The bar supports half-character precision at range boundaries using `╸` (left half) and `╺` (right half) characters:

- A range starting at a `.5` offset begins with a `╺` in the highlight color.
- A range ending at a `.5` offset ends with a `╸` in the highlight color.
- Transitions between highlighted and non-highlighted sections also use these half-characters for smooth visual boundaries.

### Out-of-Bounds Ranges

- Ranges that extend beyond the bar width (e.g., end > width) are clamped; the highlight simply continues to the edge.
- Ranges whose start is negative but whose end is positive are also clamped; the highlight begins at position 0 and continues to the (possibly clamped) end. For example, `highlight_range=(-2, 3)` on a width-6 bar produces a highlight from position 0 to 3.
- Ranges entirely outside the bar (e.g., start and end both negative, or both beyond width) produce no highlight; the bar renders as fully unhighlighted.

### Clickable Ranges

`Bar` accepts a `clickable_ranges` dictionary mapping string keys to `(start, end)` tuples. Each range is annotated with Rich metadata so that clicking the range emits a `range_clicked('<key>')` action. Multiple clickable ranges can coexist on a single bar.

## Constraints

- `Sparkline` requires an explicit `width`. The `height` defaults to 1.
- `Sparkline` data must be a `Sequence` of numbers. Non-sequence iterables are not supported.
- `TextOpacity` only blends when both foreground and background colors are present on the text style. Missing either color results in no blending.
- `Tint.process_segments` requires an `ansi_theme` to resolve named ANSI colors to RGB before blending.
- `Bar` highlight ranges use float coordinates where integer values align to character boundaries and `.5` values align to half-characters.
- `Bar` clickable ranges attach metadata to the Rich `Text` spans; the consumer is responsible for handling the `range_clicked` action.
