import { describe, expect, it } from "vitest";

import { clamp, Offset, Region, Size, Spacing } from "../src/index.js";

describe("geometry", () => {
  it("clamps numbers across forward and reverse ranges", () => {
    expect(clamp(5, 10, 0)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("supports offset arithmetic and derived helpers", () => {
    const offset = new Offset(2, 3);

    expect(offset.add(new Offset(4, 5)).equals(new Offset(6, 8))).toBe(true);
    expect(offset.subtract(new Offset(1, 1)).equals(new Offset(1, 2))).toBe(true);
    expect(offset.negate().equals(new Offset(-2, -3))).toBe(true);
    expect(offset.multiply(2).equals(new Offset(4, 6))).toBe(true);
    expect(offset.blend(new Offset(6, 7), 0.5).equals(new Offset(4, 5))).toBe(true);
    expect(offset.clamp(2, 2).equals(new Offset(1, 1))).toBe(true);
    expect(new Offset(-1, -2).clamped.equals(Offset.ZERO)).toBe(true);
    expect(offset.getDistanceTo(new Offset(5, 7))).toBeCloseTo(5);
  });

  it("supports size containment and clamped offsets", () => {
    const size = new Size(3, 4);

    expect(size.area).toBe(12);
    expect(size.region.equals(new Region(0, 0, 3, 4))).toBe(true);
    expect(size.lineRange).toEqual([0, 1, 2, 3]);
    expect(size.contains(2, 3)).toBe(true);
    expect(size.containsPoint(new Offset(1, 1))).toBe(true);
    expect(size.add(new Size(2, 2)).equals(new Size(5, 6))).toBe(true);
    expect(size.subtract(new Size(1, 2)).equals(new Size(2, 2))).toBe(true);
    expect(size.clampOffset(new Offset(99, 99)).equals(new Offset(2, 3))).toBe(true);
  });

  it("supports region creation, union, intersection, translation, and clipping", () => {
    const outer = new Region(1, 2, 10, 6);
    const inner = new Region(3, 4, 2, 1);

    expect(new Region().equals(Region.EMPTY)).toBe(true);
    expect(outer.containsRegion(inner)).toBe(true);
    expect(outer.intersection(new Region(8, 4, 10, 10)).equals(new Region(8, 4, 3, 4))).toBe(true);
    expect(outer.union(new Region(-1, 0, 2, 2)).equals(new Region(-1, 0, 12, 8))).toBe(true);
    expect(outer.translate(2, 3).equals(new Region(3, 5, 10, 6))).toBe(true);
    expect(outer.translateOffset(new Offset(2, 3)).equals(new Region(3, 5, 10, 6))).toBe(true);
    expect(outer.atOffset(new Offset(0, 0)).equals(new Region(0, 0, 10, 6))).toBe(true);
    expect(outer.clip(8, 6).equals(new Region(1, 2, 7, 4))).toBe(true);
    expect(outer.cropSize(new Size(5, 3)).equals(new Region(1, 2, 5, 3))).toBe(true);
    expect(outer.shrink(Spacing.all(1)).equals(new Region(2, 3, 8, 4))).toBe(true);
    expect(inner.grow(Spacing.symmetric(1, 2)).equals(new Region(1, 3, 6, 3))).toBe(true);
    expect(Region.fromOffset(new Offset(5, 6), new Size(7, 8)).equals(new Region(5, 6, 7, 8))).toBe(true);
    expect(
      Region.fromUnion([new Region(0, 0, 1, 1), new Region(3, 4, 2, 2)]).equals(new Region(0, 0, 5, 6)),
    ).toBe(true);
    expect(outer.containsPoint([3, 4])).toBe(true);
  });

  it("supports spacing deltas, expansion, splitting, and translation inside containers", () => {
    const outer = new Region(10, 10, 12, 8);
    const inner = new Region(13, 12, 4, 2);

    expect(outer.getSpacingBetween(inner).equals(new Spacing(2, 5, 4, 3))).toBe(true);
    expect(inner.expand([2, 3]).equals(new Region(11, 9, 8, 8))).toBe(true);
    expect(outer.split(3, 2)).toEqual([
      new Region(10, 10, 3, 2),
      new Region(13, 10, 9, 2),
      new Region(10, 12, 3, 6),
      new Region(13, 12, 9, 6),
    ]);
    expect(outer.split(-4, -3)).toEqual([
      new Region(10, 10, 8, 5),
      new Region(18, 10, 4, 5),
      new Region(10, 15, 8, 3),
      new Region(18, 15, 4, 3),
    ]);
    expect(outer.splitVertical(-4)).toEqual([new Region(10, 10, 8, 8), new Region(18, 10, 4, 8)]);
    expect(outer.splitHorizontal(-3)).toEqual([new Region(10, 10, 12, 5), new Region(10, 15, 12, 3)]);
    expect(new Region(18, 17, 6, 4).translateInside(new Region(10, 10, 10, 10)).equals(new Region(14, 16, 6, 4))).toBe(true);
  });

  it("supports scroll deltas, inflection, and constrained placement", () => {
    const window = new Region(0, 0, 10, 5);

    expect(Region.getScrollToVisible(window, new Region(8, 3, 4, 4)).equals(new Offset(2, 2))).toBe(true);
    expect(Region.getScrollToVisible(window, new Region(3, 4, 2, 1), { top: true }).equals(new Offset(0, 4))).toBe(true);
    expect(new Region(10, 10, 4, 2).inflect(1, -1, Spacing.symmetric(2, 3)).equals(new Region(17, 6, 4, 2))).toBe(true);
    expect(
      new Region(8, 8, 4, 2).constrain("inside", "inside", Spacing.all(1), new Region(0, 0, 10, 10)).equals(
        new Region(5, 7, 4, 2),
      ),
    ).toBe(true);
    expect(
      new Region(8, 8, 4, 2).constrain("inflect", "inflect", Spacing.all(1), new Region(0, 0, 10, 10)).equals(
        new Region(3, 5, 4, 2),
      ),
    ).toBe(true);
  });

  it("supports spacing arithmetic and compact css formatting", () => {
    const spacing = new Spacing(1, 2, 3, 4);

    expect(spacing.width).toBe(6);
    expect(spacing.height).toBe(4);
    expect(spacing.topLeft).toEqual([4, 1]);
    expect(spacing.bottomRight).toEqual([2, 3]);
    expect(spacing.totals).toEqual([6, 4]);
    expect(spacing.add(Spacing.all(1)).equals(new Spacing(2, 3, 4, 5))).toBe(true);
    expect(spacing.subtract(Spacing.all(1)).equals(new Spacing(0, 1, 2, 3))).toBe(true);
    expect(Spacing.all(2).css).toBe("2");
    expect(Spacing.symmetric(1, 3).css).toBe("1 3");
    expect(spacing.css).toBe("1 2 3 4");
    expect(spacing.maxWidth).toBe(4);
    expect(spacing.maxHeight).toBe(3);
    expect(Spacing.vertical(5).equals(new Spacing(5, 0, 5, 0))).toBe(true);
    expect(Spacing.horizontal(6).equals(new Spacing(0, 6, 0, 6))).toBe(true);
    expect(Spacing.unpack([2, 4]).equals(Spacing.symmetric(2, 4))).toBe(true);
    expect(spacing.growMaximum(new Spacing(4, 1, 0, 5)).equals(new Spacing(4, 2, 3, 5))).toBe(true);
  });

  it("rejects invalid geometry inputs that the spec defines as errors", () => {
    expect(() => Region.fromUnion([])).toThrow("at least one");
    expect(() => Spacing.unpack([] as unknown as [number])).toThrow();
    expect(() => Spacing.unpack([1, 2, 3] as unknown as [number])).toThrow();
  });
});
