# Docs Spec: Spacing Style Properties (margin, padding, box-sizing)

## Purpose
Describes a documentation page that teaches readers how to control whitespace around and inside widgets using the TCSS `margin`, `padding`, and `box-sizing` properties, and explains the textual-js box model.

## Audience
App authors styling widgets with TCSS, and widget authors who need to reason about how their widget's declared width/height relates to content area.

## Required sections
1. Box model overview (margin / border / padding / content, and the `gutter` concept).
2. `margin` -- shorthand and per-edge properties, default, value semantics, behavior.
3. `padding` -- shorthand and per-edge properties, default, value semantics, behavior.
4. `box-sizing` -- values (`border-box`, `content-box`), default, behavior, worked size example.
5. How margin, padding, border, and box-sizing interact during layout (summary table or step list).
6. Setting spacing from TypeScript via the reactive styles API (described narratively, not shown inline).
7. Validation and error behavior (invalid shorthand lengths).

## Key concepts
- Three concentric regions around content: margin (outside border), border, padding (inside border).
- Margin does not receive the widget's background color; padding does.
- `gutter` = padding + border (horizontal and vertical totals).
- Shorthand ordering: one value = all edges, two values = vertical/horizontal, four values = top/right/bottom/left (clockwise).
- `box-sizing: border-box` (default) means declared width/height includes gutter; `content-box` means declared width/height is content area and gutter is added outside.
- Margin is independent of `box-sizing` and is always outside the widget's dimensions.
- textual-js does not collapse adjacent margins (unlike CSS in browsers).
- Min/max width/height constraints participate in the same box-sizing arithmetic.
- Integer cell units only (no fractional or length-unit values for these properties).
- Margin and padding are animatable.

## Behaviors and contracts
- Defaults: margin and padding both default to `(0, 0, 0, 0)`.
- Four-value shorthand follows top/right/bottom/left clockwise order.
- Setting margin or padding to a cleared/empty value resets to the default.
- Invalid shorthand length (not 1, 2, or 4 integers) must produce a clear validation error.
- `border-box` subtracts gutter from declared size to compute content area; min/max constraints include gutter.
- `content-box` adds gutter on top of declared size; min/max constraints refer to content area.
- Margin shrinks the space available to the widget but never changes the widget's own declared dimensions.
- Padding participates in hit testing and background fill; margin does not.

## Example requirements
Examples should be TCSS snippets plus JSX/TypeScript usage illustrating:
- Shorthand margin/padding with 1, 2, and 4 values.
- Per-edge properties (`margin-top`, `padding-right`, etc.) in TCSS.
- A worked example showing the same widget under `border-box` vs `content-box` to illustrate the difference in total occupied cells.
- Setting spacing programmatically through the widget's reactive styles (described as "using the styles API" -- no Python).

## Cross-references
- `spec/docs-spec/styles_text.md` -- text alignment interacts with content area width.
- `spec/docs-spec/styles_text_advanced.md` -- wrapping/overflow interacts with effective content width.
- `spec/spec-src/04-styling-and-css-engine.md` -- parser and property schema.
- `spec/spec-src/05-layout-render-and-compositor.md` -- layout pipeline consuming these values.

## Notes for writers
- Do not use Python tuple syntax or Python-only property forms. Present TCSS as the primary surface; describe the TypeScript API narratively.
- Per-edge individual properties (e.g., `marginTop`) are accessible from TypeScript even though the TCSS shorthand is the primary interface; do not claim per-edge setters are unavailable.
- Under Ink, "cells" means terminal character cells; make that terminology explicit once.
- Do not mention asyncio, Python decorators, or `Spacing` named tuples by name. A `{ top, right, bottom, left }` record is the TypeScript analog and can be mentioned.
- Avoid suggesting that adjacent margins collapse -- they do not.
