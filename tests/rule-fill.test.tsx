// [LAW:behavior-not-structure] What a Rule owes the screen, asserted by mounting
// one and reading frames — not by grepping the component for the seam it stopped
// using. A Rule that painted its line some other correct way would pass every
// test here, which is the point.

import { describe, expect, it } from "vitest";
import React from "react";
import { Box, Text } from "ink";

import { runTest } from "../src/testing/run-test.js";
import { Rule } from "../src/index.js";

function lineOf(frame: string, glyph: string): string {
  return frame.split("\n").find((row) => row.includes(glyph))?.trim() ?? "";
}

describe("Rule fills from layout", () => {
  it("paints a horizontal line across the width it was measured at", async () => {
    const session = await runTest(
      <Box flexDirection="column">
        <Text>Above</Text>
        <Rule id="r" />
      </Box>,
    );

    const rule = session.app.getByCssId("r")!;
    // The line and the rectangle agree because they are the same number: Ink
    // fills the edge to the width Yoga resolved for that box. Nothing in the
    // component counts glyphs, so the two cannot be a commit out of step.
    expect(lineOf(session.lastFrame!(), "─")).toBe("─".repeat(rule.screenRegion.width));
    expect(rule.screenRegion.width).toBe(80);

    session.unmount();
  });

  it("paints a vertical line one glyph per row of the height it was measured at", async () => {
    const session = await runTest(
      <Box flexDirection="row" height={5}>
        <Text>Left</Text>
        <Rule id="r" orientation="vertical" />
        <Text>Right</Text>
      </Box>,
    );

    const rule = session.app.getByCssId("r")!;
    const rows = session.lastFrame!().split("\n").filter((row) => row.includes("│"));
    expect(rows).toHaveLength(rule.screenRegion.height);
    expect(rule.screenRegion.height).toBe(5);

    session.unmount();
  });

  it("draws the glyph the line style names, on both axes", async () => {
    const session = await runTest(
      <Box flexDirection="column">
        <Rule lineStyle="heavy" />
        <Rule lineStyle="ascii" />
        <Rule lineStyle="double" />
      </Box>,
    );

    const frame = session.lastFrame!();
    expect(lineOf(frame, "━")).toBe("━".repeat(80));
    expect(lineOf(frame, "-")).toBe("-".repeat(80));
    expect(lineOf(frame, "═")).toBe("═".repeat(80));

    session.unmount();
  });

  // The defect that made removing the measured number worth doing, and it was
  // visible on screen rather than merely inelegant. Sizing a fill from a
  // measurement is a loop with a frame of lag in it: on a resize the component
  // still held the previous width, so it repeated 80 glyphs into a box Yoga had
  // just narrowed to 40, the Text wrapped, and a one-row Rule painted two rows
  // tall for one commit before the re-measure collapsed it back. Every terminal
  // resize flickered. A fill Ink derives from the resolved box has no stale
  // number to repeat, so the intermediate frame does not exist.
  it("never paints a horizontal rule taller than one row, mid-resize included", async () => {
    const session = await runTest(
      <Box flexDirection="column">
        <Text>Above</Text>
        <Rule id="r" />
      </Box>,
    );

    await session.pilot.resize(40, 24);

    // Every frame, not just the settled one — the wrap was only ever visible in
    // the frame between the resize and the re-measure.
    for (const frame of session.instance.frames) {
      const ruleRows = frame.split("\n").filter((row) => row.includes("─"));
      expect(ruleRows.length).toBeLessThanOrEqual(1);
    }

    expect(lineOf(session.lastFrame!(), "─")).toBe("─".repeat(40));
    expect(session.app.getByCssId("r")!.screenRegion.width).toBe(40);

    session.unmount();
  });
});
