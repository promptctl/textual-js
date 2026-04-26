import { describe, expect, it } from "vitest";

import { ProgressBarModel as ProgressBar } from "../src/widgets/progress-bar.js";

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
