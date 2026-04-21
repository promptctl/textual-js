import { describe, expect, it } from "vitest";

import { normalizeScalar, Scalar, StyleValueError, Unit, parseScalar, scalarToInkValue } from "../src/index.js";

describe("css scalars", () => {
  it("copies scalars without mutating the source", () => {
    const source = new Scalar(10, Unit.PERCENT, Unit.WIDTH);
    const copy = source.copyWith({ value: 25, unit: Unit.WIDTH });
    const snakeCopy = source.copy_with({ value: 30, percent_unit: Unit.HEIGHT });

    expect(source.equals(new Scalar(10, Unit.PERCENT, Unit.WIDTH))).toBe(true);
    expect(copy.equals(new Scalar(25, Unit.WIDTH, Unit.WIDTH))).toBe(true);
    expect(snakeCopy.equals(new Scalar(30, Unit.PERCENT, Unit.HEIGHT))).toBe(true);
  });

  it("parses axis-aware scalar units", () => {
    expect(parseScalar("-5.5%", "width").equals(new Scalar(-5.5, Unit.PERCENT, Unit.WIDTH))).toBe(true);
    expect(parseScalar("3fr", "height").equals(new Scalar(3, Unit.FRACTION, Unit.HEIGHT))).toBe(true);
    expect(parseScalar("10vh", "height").equals(new Scalar(10, Unit.HEIGHT, Unit.HEIGHT))).toBe(true);
    expect(parseScalar(".5w", "width").equals(new Scalar(0.5, Unit.WIDTH, Unit.WIDTH))).toBe(true);
    expect(parseScalar("2h", "height").equals(new Scalar(2, Unit.HEIGHT, Unit.HEIGHT))).toBe(true);
    expect(parseScalar("auto", "width").equals(new Scalar(0, Unit.AUTO, Unit.WIDTH))).toBe(true);
  });

  it("translates scalars to ink-friendly values", () => {
    expect(scalarToInkValue(new Scalar(12, Unit.CELLS, Unit.WIDTH), { width: 200, height: 80 })).toBe(12);
    expect(scalarToInkValue(new Scalar(50, Unit.WIDTH, Unit.WIDTH), { width: 200, height: 80 })).toBe(100);
    expect(scalarToInkValue(new Scalar(25, Unit.HEIGHT, Unit.HEIGHT), { width: 200, height: 80 })).toBe(20);
    expect(scalarToInkValue(new Scalar(2, Unit.FRACTION, Unit.WIDTH), { width: 200, height: 80 })).toBe(2);
    expect(scalarToInkValue(new Scalar(2, Unit.FRACTION, Unit.WIDTH), { width: 200, height: 80 }, 12)).toBe(24);
    expect(scalarToInkValue(new Scalar(50, Unit.PERCENT, Unit.WIDTH), { width: 200, height: 80 })).toBe("50%");
    expect(scalarToInkValue(new Scalar(0, Unit.AUTO, Unit.WIDTH), { width: 200, height: 80 })).toBe("auto");
  });

  it("normalizes programmatic scalar assignments to one stable representation", () => {
    expect(normalizeScalar(20, "width").equals(new Scalar(20, Unit.CELLS, Unit.WIDTH))).toBe(true);
    expect(normalizeScalar("1.4", "width").equals(new Scalar(1.4, Unit.CELLS, Unit.WIDTH))).toBe(true);
    expect(normalizeScalar(new Scalar(10.5, Unit.PERCENT, Unit.WIDTH), "width").equals(new Scalar(10.5, Unit.WIDTH, Unit.WIDTH))).toBe(true);
    expect(normalizeScalar(new Scalar(10.6, Unit.PERCENT, Unit.PERCENT), "width").equals(new Scalar(10.6, Unit.WIDTH, Unit.WIDTH))).toBe(true);
    expect(normalizeScalar(new Scalar(11, Unit.PERCENT, Unit.HEIGHT), "width").equals(new Scalar(11, Unit.WIDTH, Unit.WIDTH))).toBe(true);
    expect(normalizeScalar(new Scalar(10.7, Unit.HEIGHT, Unit.PERCENT), "width").equals(new Scalar(10.7, Unit.HEIGHT, Unit.PERCENT))).toBe(true);
  });

  it("raises explicit scalar errors for invalid units, tokens, and axes", () => {
    expect(() => parseScalar("12px", "width")).toThrow(StyleValueError);
    expect(() => parseScalar("wide", "width")).toThrow(StyleValueError);
    expect(() => parseScalar("1%", "depth" as never)).toThrow(StyleValueError);
    expect(() => normalizeScalar({} as never, "width")).toThrow(StyleValueError);
  });
});
