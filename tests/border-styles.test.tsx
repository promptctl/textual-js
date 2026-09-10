import React from "react";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";

import { Placeholder, parseTcss, runTest } from "../src/index.js";
import { BORDER_STYLE_NAMES } from "../src/styles/edge-types.js";

// The frame a 5x3 `Placeholder("x")` paints under each border style, as textual
// 8.2.3 renders it. The border cells come from Textual's BORDER_CHARS rather
// than from the port's own table, so a mistyped glyph there has something to
// disagree with.
//
// Two glyphs differ from Textual on purpose. Textual draws a reversed `▊` down
// the left of panel/tall and on the right of tab/wide: the border colour fills
// the cell and shows as a bar across its right quarter. Ink paints border glyphs
// in foreground only, so the port draws that bar as `▕`.
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
  panel: ["▕███▎", "▕ x ▎", "▕▁▁▁▎"],
  round: ["╭───╮", "│ x │", "╰───╯"],
  solid: ["┌───┐", "│ x │", "└───┘"],
  tab: ["▁▁▁▁▁", "▎ x ▕", "▔▔▔▔▔"],
  tall: ["▕▔▔▔▎", "▕ x ▎", "▕▁▁▁▎"],
  thick: ["█▀▀▀█", "█ x █", "█▄▄▄█"],
  vkey: ["▏   ▕", "▏ x ▕", "▏   ▕"],
  wide: ["▁▁▁▁▁", "▎ x ▕", "▔▔▔▔▔"],
  // Textual normalises both to no border: the label centres in the whole region.
  none: ["     ", "  x  ", "     "],
  hidden: ["     ", "  x  ", "     "],
};

async function frameOf(declaration: string): Promise<string[]> {
  const session = await runTest(<Placeholder label="x" />, {
    appProps: { css: `Placeholder { width: 5; height: 3; ${declaration}; }` },
  });
  await session.app.whenIdle();

  const lines = stripAnsi(session.lastFrame() ?? "").split("\n");
  session.unmount();

  // Ink trims trailing blanks, so each row is padded back out to the widget's
  // width. Every expected frame carries the `x`, so a missing row cannot pass.
  return [0, 1, 2].map((y) => (lines[y] ?? "").padEnd(5).slice(0, 5));
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
