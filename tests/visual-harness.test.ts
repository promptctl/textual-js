import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  const VISUAL_TESTS = join(dirname(fileURLToPath(import.meta.url)), "..", "visual-tests");

  function captureEnvDirectives(): string[] {
    return readFileSync(join(VISUAL_TESTS, "capture-env"), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  }

  function declaredCaptureVariables(): string[] {
    return captureEnvDirectives().map((line) => line.replace(/^-/, "").split("=", 1)[0]);
  }

  function removedCaptureVariables(): string[] {
    return captureEnvDirectives()
      .filter((line) => line.startsWith("-"))
      .map((line) => line.slice(1));
  }

  // [LAW:single-enforcer] One statement of the grammar, checked once. Two hand-written
  // loaders read this file, and three review rounds each found a NEW way they disagreed
  // about a legal-looking line — whitespace around the line, an indented comment,
  // whitespace around the delimiter, a removal directive carrying an `=`. Mirroring
  // validators is what kept producing those. A line the two could read differently now
  // cannot be committed, so the disagreements are unrepresentable rather than matched.
  it("holds capture-env to a grammar neither loader can read two ways", () => {
    for (const directive of captureEnvDirectives()) {
      expect(directive).toMatch(/^(?:[A-Z][A-Z0-9_]*=\S(?:.*\S)?|-[A-Z][A-Z0-9_]*)$/);
    }
  });

  // Per-line legality is not enough: setting and removing the same name is two legal
  // lines that the loaders resolve in OPPOSITE directions. capture_python.py updates
  // then pops, so the removal wins; the shell hands `env` its -u options ahead of the
  // NAME=VALUE operands, so the assignment wins. Same file, same names, two outcomes —
  // and no per-line check can see it, because the conflict lives between the lines.
  it("refuses a name that capture-env both sets and removes", () => {
    const assigned = captureEnvDirectives()
      .filter((line) => !line.startsWith("-"))
      .map((line) => line.split("=", 1)[0]);

    expect(assigned.filter((name) => removedCaptureVariables().includes(name))).toEqual([]);
  });

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
      // [LAW:one-source-of-truth] A fixture's PNG and its cell record are the same
      // frame only while both paths run the app under the same environment. That held
      // by two files agreeing, and they stopped agreeing: progress_indeterminate's cell
      // record showed an unhighlighted rail its PNG did not have. Re-hardcoding any of
      // these values here reopens that gap, and no baseline diff shows it.
      const source = readFileSync(join(VISUAL_TESTS, script), "utf8")
        .split("\n")
        .filter((line) => !line.trim().startsWith("#"))
        .join("\n");

      // Three spellings, because the paths write assignments three different ways:
      // `NAME=value` in shell, `os.environ["NAME"] = value`, and `os.environ.update(
      // {"NAME": value})` — the last being the idiom capture_python.py itself uses to
      // apply this very file, so it is the one a reintroduction is most likely to
      // reach for. Each was added only after watching the previous pattern wave the
      // new spelling through; a guard is worth exactly what it has been tested against.
      for (const variable of declaredCaptureVariables()) {
        expect(source).not.toMatch(new RegExp(`${variable}["'\\]\\s]*[=:]`));
      }

      // A `-KEY` variable is never assigned, so no assignment pattern can protect it —
      // and NO_COLOR is in this file precisely because it cannot be written as one,
      // which makes it the likeliest to be hand-duplicated back. The two spellings it
      // would take are the two lines this very change removed from these scripts:
      // `os.environ.pop("NO_COLOR", None)` and `env -u NO_COLOR`.
      for (const variable of removedCaptureVariables()) {
        expect(source).not.toMatch(new RegExp(`\\.pop\\(\\s*["']${variable}`));
        expect(source).not.toMatch(new RegExp(`del\\s+os\\.environ\\[\\s*["']${variable}`));
        expect(source).not.toMatch(new RegExp(`-u\\s+["']?${variable}`));
      }
    },
  );
});
