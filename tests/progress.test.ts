import { describe, expect, it } from "vitest";

import type { Content } from "../src/content/index.js";
import { renderBar } from "../src/widgets/bar-renderable.js";
import { ProgressBarModel as ProgressBar } from "../src/widgets/progress-bar.js";

const FILL = "#0178d4";
const RAIL = "#1e1e1e";

// The bar's contract is what each cell shows and what colour it shows it in --
// the same two facts visual-tests/snapshots/python/progress_*.json records per
// cell. Collapsing the Content back into coloured runs lets a test state the
// expectation the way the baseline states it, and leaves renderBar free to
// split its spans however it likes.
function runs(content: Content): [string, string | undefined][] {
  return [...content.plain].reduce<[string, string | undefined][]>((acc, char, index) => {
    const style = content.spans.find((span) => span.start <= index && index < span.end)?.style;
    const last = acc[acc.length - 1];
    if (last !== undefined && last[1] === style) {
      last[0] += char;
      return acc;
    }
    return [...acc, [char, style]];
  }, []);
}

describe("renderBar", () => {
  it("draws an unhighlighted bar as one rail-coloured run", () => {
    expect(runs(renderBar(32, [0, 0], FILL, RAIL))).toEqual([["━".repeat(32), RAIL]]);
  });

  it("draws a full highlight with no rail behind it", () => {
    expect(runs(renderBar(32, [0, 32], FILL, RAIL))).toEqual([["━".repeat(32), FILL]]);
  });

  it("caps a half-filled bar with a rail-coloured half cell", () => {
    // Textual's own output at 50%: the unfilled remainder opens on U+257A, and
    // it is painted rail, not fill -- the boundary belongs to the empty side.
    expect(runs(renderBar(32, [0, 16], FILL, RAIL))).toEqual([
      ["━".repeat(16), FILL],
      [`╺${"━".repeat(15)}`, RAIL],
    ]);
  });

  it("spends a fractional cell on a highlighted half cell", () => {
    expect(runs(renderBar(32, [0, 15.5], FILL, RAIL))).toEqual([
      [`${"━".repeat(15)}╸`, FILL],
      ["━".repeat(16), RAIL],
    ]);
  });

  it("shows a leading rail half cell for a highlight thinner than half a cell", () => {
    // A non-empty range is not the unhighlighted case even when it snaps to
    // zero cells, so the bar opens on the boundary glyph and paints nothing in
    // the fill colour. Textual draws the leading edge of an animating pulse
    // this way, before it has covered its first whole cell.
    expect(runs(renderBar(32, [0, 0.2], FILL, RAIL))).toEqual([
      [`╺${"━".repeat(31)}`, RAIL],
    ]);
  });

  it("keeps the bar exactly as wide as it was asked to be", () => {
    for (const end of [0, 0.2, 1, 7.5, 16, 31.5, 32]) {
      expect(renderBar(32, [0, end], FILL, RAIL).plain).toHaveLength(32);
    }
  });
});

describe("ProgressBar model", () => {
  it("constructs as indeterminate by default", () => {
    const bar = new ProgressBar();

    expect(bar.total).toBeNull();
    expect(bar.progress).toBe(0);
    expect(bar.percentage).toBeNull();
  });

  it("constructs as determinate with total", () => {
    const bar = new ProgressBar(100);

    expect(bar.total).toBe(100);
    expect(bar.progress).toBe(0);
    expect(bar.percentage).toBe(0);
  });

  it("clamps negative total to zero", () => {
    const bar = new ProgressBar(-10);
    expect(bar.total).toBe(0);
  });

  it("computes percentage clamped to [0, 1]", () => {
    const bar = new ProgressBar(100, 50);
    expect(bar.percentage).toBe(0.5);

    bar.progress = 200;
    expect(bar.percentage).toBe(1);

    bar.progress = -10;
    expect(bar.percentage).toBe(0);
  });

  it("returns null percentage when total is zero", () => {
    const bar = new ProgressBar(0);
    expect(bar.percentage).toBeNull();
  });

  it("advances progress by amount", () => {
    const bar = new ProgressBar(100, 10);

    bar.advance(5);
    expect(bar.progress).toBe(15);

    bar.advance(-3);
    expect(bar.progress).toBe(12);

    bar.advance(0.5);
    expect(bar.progress).toBe(12.5);
  });

  it("updates total, progress, and advance in order", () => {
    const bar = new ProgressBar(100, 0);

    bar.update({ total: 200, progress: 50, advance: 10 });
    expect(bar.total).toBe(200);
    expect(bar.progress).toBe(60);
  });

  it("supports partial update options", () => {
    const bar = new ProgressBar(100, 25);

    bar.update({ advance: 5 });
    expect(bar.progress).toBe(30);
    expect(bar.total).toBe(100);

    bar.update({ total: null });
    expect(bar.total).toBeNull();
    expect(bar.percentage).toBeNull();
  });

  it("supports direct property assignment", () => {
    const bar = new ProgressBar();

    bar.total = 50;
    bar.progress = 25;

    expect(bar.total).toBe(50);
    expect(bar.progress).toBe(25);
    expect(bar.percentage).toBe(0.5);
  });
});
