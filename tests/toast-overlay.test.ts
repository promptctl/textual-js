import { describe, expect, it } from "vitest";

import { Notification } from "../src/index.js";
import {
  buildToastContent,
  resolveToastPalette,
  toastGeometry,
} from "../src/app/toast-overlay.js";

// The values Textual actually produces, read out of
// visual-tests/snapshots/python/notifications_basic.ansi rather than restated
// from the CSS: at 80 columns the toast is 39 cells wide and starts at column 39.
const TERMINAL_WIDTH = 80;
const TOAST_WIDTH = 39;
const TOAST_LEFT = 39;

// textual-dark's generated palette, from `App.get_css_variables()`. Only the three
// tokens a toast reads are needed; the port's own table currently disagrees with
// these, which is textual-theme-palette-jx1 and not this module's business.
const PALETTE = {
  "--success": "#4EBF71",
  "--text-success": "#8AD4A1",
  "--warning": "#FFA62B",
  "--text-warning": "#FFC473",
  "--error": "#B93C5B",
  "--text-error": "#D17E92",
  "--panel-lighten-1": "#343F49",
};

function rowsOf(notification: Notification, width = TOAST_WIDTH): string[] {
  return buildToastContent(notification, width, PALETTE).plain.split("\n");
}

describe("toast geometry", () => {
  it("puts a toast where Textual puts it at the fixture's terminal size", () => {
    expect(toastGeometry(TERMINAL_WIDTH)).toEqual({ width: TOAST_WIDTH, left: TOAST_LEFT });
  });

  it("stops widening at 60 once half the rack exceeds it", () => {
    // `Toast { width: 60; max-width: 50% }` — below 124 columns the percentage
    // binds and above it the 60 does. The 80-column fixture only ever exercises
    // one side of that, so the ceiling is asserted here or nowhere.
    expect(toastGeometry(200)).toEqual({ width: 60, left: 138 });
    expect(toastGeometry(124)).toEqual({ width: 60, left: 62 });
    expect(toastGeometry(122)).toEqual({ width: 60, left: 60 });
  });

  it("never produces a negative width or offset on a terminal too narrow to hold one", () => {
    expect(toastGeometry(1)).toEqual({ width: 0, left: 0 });
    expect(toastGeometry(0)).toEqual({ width: 0, left: 0 });
  });
});

describe("toast painting", () => {
  it("emits every cell of its region, so the panel colour has somewhere to live", () => {
    // The reason this matters is Ink, not Textual: `backgroundColor` belongs to
    // Text and not to Box, so a row that stops early is a row of transparent
    // cells. A ragged right edge would still read correctly in the .txt and be
    // wrong in the PNG.
    const rows = rowsOf(new Notification("File saved successfully", { title: "Success" }));

    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row).toHaveLength(TOAST_WIDTH);
    }
  });

  it("lays out padding, title and message the way the baseline does", () => {
    const rows = rowsOf(new Notification("File saved successfully", { title: "Success" }));

    expect(rows[0]).toBe(`▌${" ".repeat(TOAST_WIDTH - 1)}`);
    expect(rows[1]).toBe(`▌ Success${" ".repeat(TOAST_WIDTH - 9)}`);
    expect(rows[2]).toBe(`▌ File saved successfully${" ".repeat(TOAST_WIDTH - 25)}`);
    expect(rows[3]).toBe(rows[0]);
  });

  it("grows downward when the message wraps, keeping the block rectangular", () => {
    const rows = rowsOf(new Notification("word ".repeat(40).trim(), { title: "Long" }));

    expect(rows.length).toBeGreaterThan(4);
    for (const row of rows) {
      expect(row).toHaveLength(TOAST_WIDTH);
    }
  });

  it("drops the title row entirely when there is no title", () => {
    expect(rowsOf(new Notification("Just a message"))).toEqual([
      `▌${" ".repeat(TOAST_WIDTH - 1)}`,
      `▌ Just a message${" ".repeat(TOAST_WIDTH - 16)}`,
      `▌${" ".repeat(TOAST_WIDTH - 1)}`,
    ]);
  });

  it("treats a title as plain text while the message is markup", () => {
    // Upstream assembles the title as a styled span and only runs the message
    // through from_markup, so a bracketed title keeps its brackets.
    const rows = rowsOf(new Notification("saved", { title: "[draft] Report" }));

    expect(rows[1]).toContain("[draft] Report");
  });
});

describe("toast palette", () => {
  it("reads each severity from its own pair of theme tokens", () => {
    expect(resolveToastPalette("information", PALETTE)).toEqual({
      border: "#4EBF71",
      title: "#8AD4A1",
      background: "#343F49",
    });
    expect(resolveToastPalette("error", PALETTE).border).toBe("#B93C5B");
    expect(resolveToastPalette("warning", PALETTE).title).toBe("#FFC473");
  });

  it("refuses a theme that does not define the token rather than substituting one", () => {
    // A near-enough default is the failure a pixel baseline is worst at catching.
    const { "--text-error": _missing, ...incomplete } = PALETTE;

    expect(() => resolveToastPalette("error", incomplete)).toThrow(/--text-error/);
  });
});
