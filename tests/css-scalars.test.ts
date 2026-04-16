import { describe, expect, it } from "vitest";

import { Scalar, Unit, parseScalar, scalarToInkValue } from "../src/index.js";

describe("css scalars", () => {
  it("copies scalars without mutating the source", () => {
    const source = new Scalar(10, Unit.PERCENT, Unit.WIDTH);
    const copy = source.copyWith({ value: 25, unit: Unit.WIDTH });

    expect(source.equals(new Scalar(10, Unit.PERCENT, Unit.WIDTH))).toBe(true);
    expect(copy.equals(new Scalar(25, Unit.WIDTH, Unit.WIDTH))).toBe(true);
  });

  it("parses axis-aware scalar units", () => {
    expect(parseScalar("-5.5%", "width").equals(new Scalar(-5.5, Unit.PERCENT, Unit.WIDTH))).toBe(true);
    expect(parseScalar("3fr", "height").equals(new Scalar(3, Unit.FRACTION, Unit.HEIGHT))).toBe(true);
    expect(parseScalar("10vh", "height").equals(new Scalar(10, Unit.HEIGHT, Unit.HEIGHT))).toBe(true);
  });

  it("translates scalars to ink-friendly values", () => {
    expect(scalarToInkValue(new Scalar(12, Unit.CELLS, Unit.WIDTH), { width: 200, height: 80 })).toBe(12);
    expect(scalarToInkValue(new Scalar(50, Unit.WIDTH, Unit.WIDTH), { width: 200, height: 80 })).toBe(100);
    expect(scalarToInkValue(new Scalar(25, Unit.HEIGHT, Unit.HEIGHT), { width: 200, height: 80 })).toBe(20);
    expect(scalarToInkValue(new Scalar(2, Unit.FRACTION, Unit.WIDTH), { width: 200, height: 80 })).toBe("2fr");
  });
});
