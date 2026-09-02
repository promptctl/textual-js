// A thin horizontal bar with a portion highlighted — the renderable Textual's
// ProgressBar draws through (textual/renderables/bar.py). It is a separate
// module for the same reason Textual keeps it separate: the bar is a shape, not
// a widget, and nothing about it knows what is being measured.
//
// [LAW:effects-at-boundaries] This computes a *description* of the paint — a
// Content of coloured runs — and hands it outward. It touches no terminal, no
// Ink, no React, so its whole contract is checkable without any of them.

import { Content } from "../content/index.js";

const BAR = "━";
const HALF_BAR_LEFT = "╺";
const HALF_BAR_RIGHT = "╸";

// Python's `"x" * n` is empty for negative n; JS `String.repeat` throws. The
// port's arithmetic produces negative counts at the ends of the bar (a full
// highlight leaves `width - end - 1 === -1` cells of tail), so the difference
// is load-bearing rather than hypothetical.
function repeat(glyph: string, count: number): string {
  return glyph.repeat(Math.max(0, count));
}

// [LAW:one-source-of-truth] Python's `round` breaks a .5 tie toward even;
// JS `Math.round` breaks it upward. The snap below is `round(x * 2) / 2`, so a
// range landing exactly on a quarter cell picks a different glyph in the two
// implementations — the one place where the idiomatic JS spelling is wrong.
function roundHalfToEven(value: number): number {
  const floor = Math.floor(value);
  if (value - floor !== 0.5) {
    return Math.round(value);
  }
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Draw a bar of `width` cells with `[rangeStart, rangeEnd]` highlighted.
 *
 * The range is measured in cells and may be fractional: the bar snaps it to the
 * nearest half cell and spends the leftover half on `╺` / `╸`, which is how a
 * 50%-of-33-cells bar reads as half full rather than rounding visibly. An empty
 * range landing on a half cell overruns `width` by one, because its two
 * boundary glyphs each claim half a cell and neither yields; Python does the
 * same, so the port keeps it.
 */
export function renderBar(
  width: number,
  [rangeStart, rangeEnd]: readonly [number, number],
  highlightColor: string,
  railColor: string,
): Content {
  const clampedStart = Math.max(rangeStart, 0);
  const clampedEnd = Math.min(rangeEnd, width);

  // A bar with nothing highlighted is the whole rail — not an absent bar.
  if ((clampedStart === 0 && clampedEnd === 0) || clampedEnd < 0 || clampedStart > clampedEnd) {
    return Content.assemble([repeat(BAR, width), railColor]);
  }

  const start = roundHalfToEven(clampedStart * 2) / 2;
  const end = roundHalfToEven(clampedEnd * 2) / 2;
  const halfStart = start - Math.trunc(start) > 0;
  const halfEnd = end - Math.trunc(end) > 0;
  const highlightWidth = Math.trunc(end) - Math.trunc(start);

  // Every run is emitted unconditionally and carries its own width; a run the
  // geometry does not call for comes out as the empty string rather than as a
  // skipped statement. [LAW:dataflow-not-control-flow]
  return Content.assemble(
    [repeat(BAR, Math.trunc(start - 0.5)), railColor],
    [halfStart || start === 0 ? "" : HALF_BAR_RIGHT, railColor],
    [
      halfStart ? HALF_BAR_LEFT + repeat(BAR, highlightWidth - 1) : repeat(BAR, highlightWidth),
      highlightColor,
    ],
    [halfEnd ? HALF_BAR_RIGHT : "", highlightColor],
    [halfEnd || end === width ? "" : HALF_BAR_LEFT, railColor],
    [repeat(BAR, Math.trunc(width) - Math.trunc(end) - 1), railColor],
  );
}
