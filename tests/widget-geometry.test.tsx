import { describe, expect, it } from "vitest";
import React from "react";
import { Box } from "ink";

import { runTest } from "../src/testing/run-test.js";
import { Button, ProgressBar, Rule, Static, Switch } from "../src/widgets/index.js";

// [LAW:behavior-not-structure] These assert the contract `widget.screenRegion`
// owes its consumers — the widget's own placed rectangle in screen coordinates,
// margins excluded, exactly as Python Textual defines `Widget.region`. The
// expected numbers are Python Textual's output for this same layout on an
// 80-column screen, not a record of what textual-js happens to produce.
function ParityApp(): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Button id="button" label="hi" />
      <Rule id="rule" />
      <Static id="static" content="hello" />
    </Box>
  );
}

function regionOf(session: Awaited<ReturnType<typeof runTest>>, id: string) {
  const widget = session.app.getByCssId(id);

  if (widget === undefined || widget === null) {
    throw new Error(`fixture widget #${id} was never registered`);
  }

  const { x, y, width, height } = widget.screenRegion;
  return { x, y, width, height };
}

describe("widget screenRegion matches Python Textual's Widget.region", () => {
  it("gives each widget its own placed rectangle, margins excluded", async () => {
    const session = await runTest(<ParityApp />);

    // Button is `width: auto; min-width: 16` — 16 cells wide, not the 80-cell
    // container it sits in.
    expect(regionOf(session, "button")).toEqual({ x: 0, y: 0, width: 16, height: 3 });
    // Rule is `margin: 1 0` around a 1-row line: the region is the line itself
    // at y=4, with the margin rows excluded rather than folded into height.
    expect(regionOf(session, "rule")).toEqual({ x: 0, y: 4, width: 80, height: 1 });
    // Static fills its container width, so here the widget rect and the
    // container rect legitimately coincide.
    expect(regionOf(session, "static")).toEqual({ x: 0, y: 6, width: 80, height: 1 });

    session.unmount();
  });

  // A widget whose CSS gives it a concrete cell width is a third case, distinct
  // from `width: auto` (Button) and default-fill (Static): the width is neither
  // a hug policy nor absent, and must reach the measured box as a size.
  it("sizes a fixed-width widget from its declared width, not its container", async () => {
    const session = await runTest(
      <Box flexDirection="column">
        <Switch id="switch" />
      </Box>,
    );

    // Switch is `width: 10; height: 3`.
    expect(regionOf(session, "switch")).toEqual({ x: 0, y: 0, width: 10, height: 3 });

    session.unmount();
  });

  // The vertical Rule measures the opposite axis from the horizontal one and
  // decomposes its margin the other way (`margin: 0 2` vs `1 0`).
  it("gives a vertical rule the width of its line, not of its container", async () => {
    const session = await runTest(
      <Box flexDirection="column">
        <Rule id="rule" orientation="vertical" />
      </Box>,
    );

    const region = regionOf(session, "rule");
    // `margin: 0 2` places the 1-column line at x=2 and excludes the margin
    // from the region, exactly as the horizontal case excludes its margin rows.
    expect(region.x).toBe(2);
    expect(region.width).toBe(1);

    session.unmount();
  });

  // ProgressBar is the widget whose overflow motivated this ticket: it derived
  // its width from the container and painted a ~75-cell bar across 80 columns.
  it("hugs a progress bar to its content instead of filling the container", async () => {
    const session = await runTest(
      <Box flexDirection="column">
        <ProgressBar id="progress" total={100} progress={50} showEta={false} />
      </Box>,
    );

    // The exact total is deliberately not pinned. Python renders 37 columns
    // (a 32-cell bar plus a percentage field right-aligned to 4, plus a 1-cell
    // margin); textual-js renders 36 because formatPercentage does not pad --
    // a defect owned by textual-progress-fixture-pixel-parity-qyb. Asserting 36
    // would bake that in and break when qyb fixes it. What this ticket owns is
    // that the region is the widget's content, not its container.
    const { width } = regionOf(session, "progress");
    expect(width).toBeGreaterThanOrEqual(32);
    expect(width).toBeLessThan(80);

    session.unmount();
  });

  // `display: none` and margin have to be applied to the same box. Split across
  // the two halves, the widget empties while its margin is still reserved, and
  // a hidden widget leaves blank rows behind.
  it("removes a hidden widget's layout slot, margin included", async () => {
    const session = await runTest(
      <Box flexDirection="column">
        <Static id="top" content="TOP" />
        <Static id="hidden" classes="gone" content="MID" />
        <Static id="bottom" content="BOT" />
      </Box>,
      { appProps: { css: `Static.gone { display: none; margin: 1; }` } },
    );

    // The hidden widget occupies nothing, so the widget after it sits directly
    // below the one before it.
    expect(regionOf(session, "bottom").y).toBe(regionOf(session, "top").y + 1);

    session.unmount();
  });

  it("does not hit-test a 16-cell button 54 columns to its right", async () => {
    const session = await runTest(
      <Box flexDirection="column">
        <Button id="button" label="hi" />
      </Box>,
    );

    // Python Textual returns the Screen here. textual-js registers no Screen
    // widget, so the equivalent contract is "no widget occupies (70, 1)".
    expect(session.app.hitTest(70, 1)).toBeUndefined();
    // The button is still hit where it actually is.
    expect(session.app.hitTest(2, 1)?.id).toBe("button");

    session.unmount();
  });
});
