import { App } from "../src/index.js";
import { describe, expect, it } from "vitest";
import { Offset, Region, Size, Widget } from "../src/index.js";

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

describe("scrollbar-gutter CSS property", () => {
  it("parses stable scrollbar gutters and rejects unknown values", async () => {
    const { parseTcss, StylesheetParseError } = await import("../src/index.js");

    const stylesheet = parseTcss("Widget { scrollbar-gutter: stable; }", { origin: "user" });
    const declaration = stylesheet.rules[0]?.declarations.find(
      (decl) => decl.property === "scrollbar-gutter",
    );

    expect(declaration?.value).toBe("stable");
    expect(() => parseTcss("Widget { scrollbar-gutter: always; }", { origin: "user" })).toThrow(StylesheetParseError);
  });
});

describe("scroll animation level infrastructure", () => {
  function createScrollWidget(framework: App["framework"]): Widget {
    const widget = new Widget({
      framework,
      nodeId: "scroll-target",
      parentId: null,
      classes: [],
      typeName: "ScrollTarget",
      handlersRef: { current: undefined },
      actionsRef: { current: undefined },
      bindingsRef: { current: [] },
      focusable: false,
      autoFocus: false,
      disabled: false,
      loading: false,
      tooltip: null,
    });

    widget.updateScreenRegion(new Region(0, 0, 10, 5));
    widget.setVirtualSize(new Size(30, 20));
    return widget;
  }

  it("records animated scroll targets for full and basic levels", () => {
    const app = new App();
    const widget = createScrollWidget(app.framework);

    app.animationLevel = "full";
    widget.scrollTo(12, 7, { animate: true, duration: 250 });

    expect(widget.scrollAnimation).toEqual({ x: 12, y: 7, duration: 250 });
    expect(widget.scrollTargetX).toBe(12);
    expect(widget.scrollTargetY).toBe(7);

    app.animationLevel = "basic";
    widget.scrollTo(20, 15, { animate: true, duration: 100 });

    expect(widget.scrollAnimation).toEqual({ x: 20, y: 15, duration: 100 });
  });

  it("suppresses animated scroll metadata when animation level is none", () => {
    const app = new App();
    const widget = createScrollWidget(app.framework);

    app.animationLevel = "none";
    widget.scrollTo(12, 7, { animate: true, duration: 250 });

    expect(widget.scrollOffsetX).toBe(12);
    expect(widget.scrollOffsetY).toBe(7);
    expect(widget.scrollAnimation).toBeNull();
  });
});
