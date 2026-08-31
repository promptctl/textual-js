import { describe, expect, it } from "vitest";
import React from "react";
import { Box } from "ink";

import { runTest } from "../src/testing/run-test.js";
import { Button, Rule, Static } from "../src/widgets/index.js";

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
