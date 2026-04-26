import { Style } from "rich-js";
import { describe, expect, it } from "vitest";

import { Content, combineBorderQuads, renderBorderLabel, renderBorderRow } from "../src/index.js";

describe("border helpers", () => {
  it("renders border rows for each corner combination", () => {
    expect(renderBorderRow(["┌", "─", "┐"], 5, false, false).map((segment) => segment.text)).toEqual(["─────"]);
    expect(renderBorderRow(["┌", "─", "┐"], 5, true, false).map((segment) => segment.text)).toEqual(["┌", "────"]);
    expect(renderBorderRow(["┌", "─", "┐"], 5, false, true).map((segment) => segment.text)).toEqual(["────", "┐"]);
    expect(renderBorderRow(["┌", "─", "┐"], 5, true, true).map((segment) => segment.text)).toEqual(["┌", "───", "┐"]);
  });

  it("renders single-line border labels with border-style composition", () => {
    const segments = renderBorderLabel("[bold]Hi\nthere", 7, {
      borderStyle: Style.parse("red"),
    });

    expect(segments.map((segment) => segment.text).join("")).toBe(" Hi ");
    expect(segments[0]?.style?.equals(Style.parse("red"))).toBe(true);
    expect(segments[1]?.style?.equals(Style.parse("bold red"))).toBe(true);
    expect(segments[2]?.style?.equals(Style.parse("red"))).toBe(true);
  });

  it("omits empty labels, truncates long labels with an ellipsis, and caches quad composition", () => {
    expect(renderBorderLabel("[bold][/]", 10)).toEqual([]);
    expect(renderBorderLabel("[blue]", 10)).toEqual([]);
    expect(renderBorderLabel("hey", 4)).toEqual([]);
    expect(renderBorderLabel("hey", 5).map((segment) => segment.text).join("")).toBe(" hey ");

    const truncated = renderBorderLabel(new Content("hello world"), 7, {
      hasLeftCorner: true,
      hasRightCorner: true,
    });

    expect(truncated.map((segment) => segment.text).join("")).toBe(" he… ");

    const left = [0, 0, 0, 2] as const;
    const right = [0, 0, 0, 1] as const;
    const first = combineBorderQuads(left, right);
    const second = combineBorderQuads(left, right);

    expect(first).toEqual([0, 0, 0, 1]);
    expect(first).toBe(second);
  });
});
