import { describe, expect, it, vi } from "vitest";

import { captureFixtures } from "../visual-tests/capture_js.ts";
import { summarizeReports } from "../visual-tests/compare.ts";

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
