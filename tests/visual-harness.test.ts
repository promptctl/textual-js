import { readFileSync } from "node:fs";
import { join } from "node:path";

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

describe("capture environment", () => {
  const VISUAL_TESTS = join(import.meta.dirname, "..", "visual-tests");

  function declaredCaptureVariables(): string[] {
    return readFileSync(join(VISUAL_TESTS, "capture-env"), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => line.split("=", 1)[0]);
  }

  it("declares the variables both capture paths depend on", () => {
    // Animations are the one that has actually bitten: an animating widget never
    // holds still, so the frame a capture lands on is arbitrary, and the two paths
    // landed on different ones. Truecolor is what makes AE == 0 reachable at all.
    expect(declaredCaptureVariables()).toEqual(
      expect.arrayContaining(["TEXTUAL_ANIMATIONS", "TEXTUAL_COLOR_SYSTEM", "FORCE_COLOR"]),
    );
  });

  it.each(["render-fixture-xvfb.sh", "capture_python.py"])(
    "leaves %s with no capture variable of its own",
    (script) => {
      // [LAW:one-source-of-truth] A fixture's PNG and its cell grid are the same
      // frame only while both paths run the app under the same environment. That
      // held by two files agreeing, and they stopped agreeing: progress_indeterminate's
      // JSON recorded an unhighlighted rail its PNG did not have. Re-hardcoding any
      // of these values here reopens exactly that gap, and no baseline diff shows it.
      const source = readFileSync(join(VISUAL_TESTS, script), "utf8")
        .split("\n")
        .filter((line) => !line.trim().startsWith("#"))
        .join("\n");

      // Both spellings, because the two paths write assignments differently:
      // `TEXTUAL_ANIMATIONS=none` in shell, `os.environ["TEXTUAL_ANIMATIONS"] = "none"`
      // in Python. A pattern anchored to `NAME=` alone matches only the first and
      // waves the second through — verified by running this test against the source
      // before this change, where it caught the shell file and missed the Python one.
      for (const variable of declaredCaptureVariables()) {
        expect(source).not.toMatch(new RegExp(`${variable}["'\\]\\s]*=`));
      }
    },
  );
});
