import { describe, expect, it } from "vitest";

import { Offset, Region } from "../src/index.js";

describe("scroll geometry", () => {
  it("computes zero offset when the target is already within the window", () => {
    const window = new Region(0, 0, 80, 24);
    const target = new Region(10, 5, 20, 3);

    expect(window.getScrollToVisible(target).equals(Offset.ZERO)).toBe(true);
  });

  it("computes negative offset when the target is above or left of the window", () => {
    const window = new Region(10, 10, 40, 20);

    const above = new Region(15, 5, 10, 3);
    expect(window.getScrollToVisible(above).equals(new Offset(0, -5))).toBe(true);

    const left = new Region(3, 15, 5, 5);
    expect(window.getScrollToVisible(left).equals(new Offset(-7, 0))).toBe(true);

    const aboveLeft = new Region(2, 3, 4, 4);
    expect(window.getScrollToVisible(aboveLeft).equals(new Offset(-8, -7))).toBe(true);
  });

  it("computes positive offset when the target is below or right of the window", () => {
    const window = new Region(0, 0, 80, 24);

    const below = new Region(10, 30, 10, 5);
    expect(window.getScrollToVisible(below).equals(new Offset(0, 11))).toBe(true);

    const right = new Region(90, 5, 20, 3);
    expect(window.getScrollToVisible(right).equals(new Offset(30, 0))).toBe(true);
  });

  it("produces an offset that guarantees the target overlaps the shifted window", () => {
    const window = new Region(0, 0, 40, 20);
    const target = new Region(50, 25, 10, 5);

    const offset = window.getScrollToVisible(target);
    const shifted = window.translate(offset.x, offset.y);

    expect(shifted.overlaps(target)).toBe(true);
    expect(shifted.containsRegion(target)).toBe(true);
  });

  it("handles partially visible targets by scrolling just enough", () => {
    const window = new Region(0, 0, 80, 24);

    // Target extends below the window by 6 rows
    const partialBelow = new Region(10, 20, 10, 10);
    const offsetBelow = window.getScrollToVisible(partialBelow);
    expect(offsetBelow.equals(new Offset(0, 6))).toBe(true);

    // Target extends right of the window by 15 columns
    const partialRight = new Region(70, 5, 25, 3);
    const offsetRight = window.getScrollToVisible(partialRight);
    expect(offsetRight.equals(new Offset(15, 0))).toBe(true);
  });
});

describe("scrollbar-size CSS property", () => {
  it("parses scrollbar-size values in the TCSS engine", async () => {
    const { parseTcss } = await import("../src/index.js");

    const stylesheet = parseTcss("Widget { scrollbar-size: 5 3; }", { origin: "user" });
    const declaration = stylesheet.rules[0]?.declarations.find(
      (decl) => decl.property === "scrollbar-size",
    );

    expect(declaration).toBeDefined();
    expect(declaration?.value).toEqual([5, 3]);
  });

  it("expands single scrollbar-size value to both axes", async () => {
    const { parseTcss } = await import("../src/index.js");

    const stylesheet = parseTcss("Widget { scrollbar-size: 2; }", { origin: "user" });
    const declaration = stylesheet.rules[0]?.declarations.find(
      (decl) => decl.property === "scrollbar-size",
    );

    expect(declaration?.value).toEqual([2, 2]);
  });
});
