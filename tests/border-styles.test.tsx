import React from "react";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";

import { Placeholder, parseTcss, runTest, type TestSession } from "../src/index.js";
import { BORDER_STYLE_NAMES } from "../src/styles/edge-types.js";

// The frame a 5x3 `Placeholder("x")` paints under each border style, as textual
// 8.2.3 renders it. The border cells come from Textual's BORDER_CHARS rather
// than from the port's own table, so a mistyped glyph there has something to
// disagree with.
const FRAMES: Record<string, readonly [string, string, string]> = {
  ascii: ["+---+", "| x |", "+---+"],
  blank: ["     ", "  x  ", "     "],
  block: ["▄▄▄▄▄", "█ x █", "▀▀▀▀▀"],
  dashed: ["┏╍╍╍┓", "╏ x ╏", "┗╍╍╍┛"],
  double: ["╔═══╗", "║ x ║", "╚═══╝"],
  heavy: ["┏━━━┓", "┃ x ┃", "┗━━━┛"],
  hkey: ["▔▔▔▔▔", "  x  ", "▁▁▁▁▁"],
  inner: ["▗▄▄▄▖", "▐ x ▌", "▝▀▀▀▘"],
  outer: ["▛▀▀▀▜", "▌ x ▐", "▙▄▄▄▟"],
  panel: ["▊███▎", "▊ x ▎", "▊▁▁▁▎"],
  round: ["╭───╮", "│ x │", "╰───╯"],
  solid: ["┌───┐", "│ x │", "└───┘"],
  tab: ["▁▁▁▁▁", "▎ x ▊", "▔▔▔▔▔"],
  tall: ["▊▔▔▔▎", "▊ x ▎", "▊▁▁▁▎"],
  thick: ["█▀▀▀█", "█ x █", "█▄▄▄█"],
  vkey: ["▏   ▕", "▏ x ▕", "▏   ▕"],
  wide: ["▁▁▁▁▁", "▎ x ▊", "▔▔▔▔▔"],
  // Textual normalises both to no border: the label centres in the whole region.
  none: ["     ", "  x  ", "     "],
  hidden: ["     ", "  x  ", "     "],
};

async function rawFrameOf(declaration: string): Promise<string[]> {
  const session = await runTest(<Placeholder label="x" />, {
    appProps: { css: `Placeholder { width: 5; height: 3; ${declaration}; }` },
  });
  await session.app.whenIdle();

  const lines = (session.lastFrame() ?? "").split("\n");
  session.unmount();

  return lines;
}

// Ink trims trailing blanks, so each row is padded back out to the widget's
// width. Every expected frame carries the `x`, so a missing row cannot pass.
function cellsOf(lines: string[]): string[] {
  return [0, 1, 2].map((y) => stripAnsi(lines[y] ?? "").padEnd(5).slice(0, 5));
}

async function frameOf(declaration: string): Promise<string[]> {
  return cellsOf(await rawFrameOf(declaration));
}

async function recascadedFrame(session: TestSession): Promise<string[]> {
  await session.app.whenIdle();
  await new Promise((resolve) => setTimeout(resolve, 0));

  return cellsOf((session.lastFrame() ?? "").split("\n"));
}

/** The SGR parameters in force where `glyph` first appears on `line`. */
function sgrBefore(line: string, glyph: string): string[] {
  const prefix = line.slice(0, line.indexOf(glyph));

  return [...prefix.matchAll(/\[([0-9;]*)m/g)].map((match) => match[1] ?? "");
}

/** The SGRs painting the cell `glyph` sits in: its own foreground and background. */
function cellSgr(line: string, glyph: string): string {
  return sgrBefore(line, glyph).slice(-2).join(";");
}

describe("border styles", () => {
  // [LAW:verifiable-goals] A style the stylesheet starts accepting without a
  // frame here fails this test, so the parser and the renderer cannot drift
  // apart again unnoticed.
  it("has a frame for every style the stylesheet accepts", () => {
    expect(Object.keys(FRAMES).sort()).toEqual([...BORDER_STYLE_NAMES].sort());
  });

  it.each(Object.entries(FRAMES))("paints `border: %s`", async (style, frame) => {
    expect(await frameOf(`border: ${style} red`)).toEqual(frame);
  });

  // Textual 8.2.3 emits this cell as `#0178d4 on #4d1144`: the border colour in
  // truecolor, over the background of the app's first placeholder. A border
  // coloured through Ink carried neither.
  it("paints an edge cell in the border's truecolor over the widget's background", async () => {
    const [top = ""] = await rawFrameOf("border: dashed #0178D4");

    expect(sgrBefore(top, "┏")).toEqual(expect.arrayContaining(["38;2;1;120;212", "48;2;77;17;68"]));
  });

  // Textual 8.2.3 emits panel's `▊` as `reverse #0178d4`: the border colour fills
  // the cell and the glyph is cut out of it.
  it("paints a reversed edge cell with the border colour filling it", async () => {
    const [top = ""] = await rawFrameOf("border: panel #0178D4");

    expect(sgrBefore(top, "▊")).toEqual(expect.arrayContaining(["38;2;1;120;212", "7"]));
  });

  // Textual 8.2.3, same CSS: `['┌────', '┃ x  ', '┃    ']`, the top row
  // `#ff0000` and the left cells `#0000ff`.
  it("draws each edge from its own declaration, and no edge where none is declared", async () => {
    const declaration = "border-top: solid red; border-left: heavy blue";
    const [top = "", middle = ""] = await rawFrameOf(declaration);

    expect(await frameOf(declaration)).toEqual(["┌────", "┃ x  ", "┃    "]);
    expect(sgrBefore(top, "┌")).toContain("38;2;255;0;0");
    expect(sgrBefore(middle, "┃")).toContain("38;2;0;0;255");
  });

  // Textual 8.2.3 reports these content sizes for a 9x5 Placeholder: a drawn
  // edge takes one cell and an undeclared edge takes none.
  it.each([
    ["border-top: solid red; border-left: heavy blue", "8 x 4"],
    ["border-top: solid red", "9 x 4"],
    ["border-right: solid red", "8 x 5"],
    ["border: solid red", "7 x 3"],
  ])("sizes the content region of `%s` to the edges it draws", async (declaration, size) => {
    const session = await runTest(<Placeholder variant="size" />, {
      appProps: { css: `Placeholder { width: 9; height: 5; ${declaration}; }` },
    });
    await session.app.whenIdle();

    expect(stripAnsi(session.lastFrame() ?? "")).toContain(size);

    session.unmount();
  });

  // Ink hands a re-render only the style keys that changed, so a side that stays
  // hidden while the border beside it changes is missing from that update. Ink
  // 5.2.1 read the missing flag as shown and reserved a cell for it, so a
  // re-cascaded widget laid out differently from a fresh one with the same CSS.
  it("frames a re-cascaded widget exactly as a first render of the same styles", async () => {
    const session = await runTest(<Placeholder id="toggled" label="x" />, {
      appProps: { css: "Placeholder { width: 5; height: 3; } Placeholder.-topped { border-top: solid red; }" },
    });
    await session.app.whenIdle();
    const widget = session.app.registry.getByCssId("toggled") ?? expect.unreachable("no #toggled widget");

    widget.addClass("-topped");
    expect(await recascadedFrame(session)).toEqual(await frameOf("border-top: solid red"));

    widget.removeClass("-topped");
    expect(await recascadedFrame(session)).toEqual(await frameOf("border: none"));

    session.unmount();
  });

  // Textual 8.2.3, same CSS: `['┌───┐', '║ x ┃', '┗╍╍╍┛']`, coloured #ff0000,
  // #ffff00 and #0000ff, #008000 by row. The whole top row is the top edge's,
  // corners included, and the bottom row is the bottom edge's — whose corners
  // are heavy, because that is what dashed's own box draws them as.
  it("draws all four edges, each from its own declaration", async () => {
    const declaration =
      "border-top: solid red; border-right: heavy blue; border-bottom: dashed green; border-left: double yellow";
    const [top = "", middle = "", bottom = ""] = await rawFrameOf(declaration);

    expect(await frameOf(declaration)).toEqual(["┌───┐", "║ x ┃", "┗╍╍╍┛"]);
    expect(cellSgr(top, "┌")).toContain("38;2;255;0;0");
    expect(cellSgr(middle, "║")).toContain("38;2;255;255;0");
    expect(cellSgr(middle, "┃")).toContain("38;2;0;0;255");
    expect(cellSgr(bottom, "┗")).toContain("38;2;0;128;0");
  });

  it("paints an outline from the same vocabulary", async () => {
    // Only the top row is Textual's today: the port still lays an outline out as
    // space inside the widget, where Textual paints it over the edge cells.
    const [top] = await frameOf("outline: tall red");

    expect(top).toBe(FRAMES.tall[0]);
  });

  it("rejects a style it cannot draw where the stylesheet is written, naming it", () => {
    expect(() => parseTcss("Placeholder { border: groove red; }", { origin: "user" })).toThrow(/groove/);
    expect(() => parseTcss("Placeholder { outline: groove red; }", { origin: "user" })).toThrow(/groove/);
  });
});
