import { describe, expect, it, vi } from "vitest";

import { captureFixtures } from "../visual-tests/capture_js.ts";
import { summarizeReports } from "../visual-tests/compare.ts";
import { derivePairedFixtureNames, derivePythonBaselineFixtureNames } from "../visual-tests/discover-fixtures.ts";
import { diffStyledGrids, parseAnsiToStyledGrid } from "../visual-tests/styled-grid.ts";

describe("visual harness gating", () => {
  it("records JS fixture capture failures instead of downgrading them to success", async () => {
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      const summary = await captureFixtures(
        ["ok", "broken"],
        async (name) => {
          if (name === "broken") {
            throw new Error("boom");
          }
        },
      );

      expect(summary.failedFixtures).toEqual(["broken"]);
      expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining("ERROR capturing broken: boom"));
    } finally {
      stderrWrite.mockRestore();
    }
  });

  it("derives active fixtures from paired python and js files", () => {
    expect(
      derivePairedFixtureNames([
        "button_markup.py",
        "button_markup.tsx",
        "static_basic.py",
        "static_basic.tsx",
        "python_only.py",
        "js_only.tsx",
        "README.md",
      ]),
    ).toEqual(["button_markup", "static_basic"]);
  });

  it("excludes todo fixtures from the active visual gate", () => {
    expect(
      derivePairedFixtureNames(
        [
          "button_markup.py",
          "button_markup.tsx",
          "header_basic.py",
          "header_basic.tsx",
          "python_only.py",
        ],
        new Set(["header_basic"]),
      ),
    ).toEqual(["button_markup"]);
  });

  it("includes todo python fixtures in baseline generation", () => {
    expect(
      derivePythonBaselineFixtureNames(
        [
          "button_markup.py",
          "button_markup.tsx",
          "header_basic.py",
          "header_basic.tsx",
          "footer_basic.py",
          "python_only.py",
        ],
        new Set(["header_basic", "footer_basic"]),
      ),
    ).toEqual(["button_markup", "footer_basic", "header_basic"]);
  });

  it("parses ANSI output into styled cells", () => {
    const grid = parseAnsiToStyledGrid("\u001B[91;1mA\u001B[0m\u001B[48;5;249mB\u001B[0m");

    expect(grid.rows).toEqual([
      [
        {
          text: "A",
          foreground: "standard:9",
          background: null,
          bold: true,
          dim: false,
          italic: false,
          underline: false,
          strikethrough: false,
          inverse: false,
          continuation: false,
        },
        {
          text: "B",
          foreground: null,
          background: "eight-bit:249",
          bold: false,
          dim: false,
          italic: false,
          underline: false,
          strikethrough: false,
          inverse: false,
          continuation: false,
        },
      ],
    ]);
  });

  it("treats style-only snapshot differences as comparison failures", () => {
    const { diffs, matchPercentage } = diffStyledGrids(
      {
        rows: [[{ text: "A", foreground: "standard:9", background: null, bold: false, dim: false, italic: false, underline: false, strikethrough: false, inverse: false, continuation: false }]],
      },
      {
        rows: [[{ text: "A", foreground: "standard:4", background: null, bold: false, dim: false, italic: false, underline: false, strikethrough: false, inverse: false, continuation: false }]],
      },
    );

    expect(matchPercentage).toBe(0);
    expect(diffs).toHaveLength(1);
  });

  it("treats translated snapshots as comparison failures", () => {
    const { diffs, matchPercentage } = diffStyledGrids(
      {
        rows: [[{ text: "A", foreground: "standard:9", background: null, bold: false, dim: false, italic: false, underline: false, strikethrough: false, inverse: false, continuation: false }]],
      },
      {
        rows: [[
          { text: " ", foreground: null, background: null, bold: false, dim: false, italic: false, underline: false, strikethrough: false, inverse: false, continuation: false },
          { text: "A", foreground: "standard:9", background: null, bold: false, dim: false, italic: false, underline: false, strikethrough: false, inverse: false, continuation: false },
        ]],
      },
    );

    expect(matchPercentage).toBe(0);
    expect(diffs).toHaveLength(2);
  });

  it("treats missing snapshots as comparison failures", () => {
    const summary = summarizeReports([
      {
        name: "missing-js",
        status: "missing-js",
        diffs: [],
        pythonLines: 1,
        jsLines: 0,
        matchPercentage: 0,
      },
      {
        name: "missing-python",
        status: "missing-python",
        diffs: [],
        pythonLines: 0,
        jsLines: 1,
        matchPercentage: 0,
      },
      {
        name: "match",
        status: "match",
        diffs: [],
        pythonLines: 1,
        jsLines: 1,
        matchPercentage: 100,
      },
    ]);

    expect(summary).toEqual({ matched: 1, diffed: 0, missing: 2 });
  });
});
