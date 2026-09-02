import { describe, expect, it } from "vitest";
import React from "react";
import { Box } from "ink";
import { observable, runInAction } from "mobx";
import { observer } from "mobx-react-lite";

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

    // 37 columns: a 32-cell bar plus the percentage field, which Textual sizes
    // at 5 and right-aligns. Pinning the number is what this test can now do --
    // it used to allow a range because textual-js rendered 36, having left the
    // percentage unpadded. What this test owns either way is that the region is
    // the widget's content and not its container.
    const { width } = regionOf(session, "progress");
    expect(width).toBe(37);

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

  // A width bound has to be measured on the same box as the width it bounds.
  // Split apart, the widget was measured at its declared 5 cells while painting
  // the 16 its `min-width` floor forced — the region/paint divergence this whole
  // ticket exists to remove.
  it("measures a widget at its min-width floor, not its smaller declared width", async () => {
    const session = await runTest(
      <Box flexDirection="column">
        <Button id="button" classes="small" label="hi" />
      </Box>,
      { appProps: { css: `Button.small { width: 5; }` } },
    );

    // Button's DEFAULT_CSS `min-width: 16` outranks the authored `width: 5`.
    expect(regionOf(session, "button").width).toBe(16);
    // The consequence that matters: the button is hit across every cell it paints.
    expect(session.app.hitTest(10, 1)?.id).toBe("button");

    session.unmount();
  });

  // Re-measurement has one owner: the widget's own Ink commit. A MobX update
  // that re-renders a single widget re-renders no ancestor, so an ancestor-owned
  // flush never fires — the region a stale owner leaves behind looks plausible
  // and ships. Nothing in this test asks for a measurement pass.
  it("re-measures a widget whose own content grew, with no flush requested", async () => {
    const content = observable.box("one");
    const GrowingStatic = observer(function GrowingStatic(): React.JSX.Element {
      return <Static id="growing" content={content.get()} />;
    });

    const session = await runTest(
      <Box flexDirection="column">
        <GrowingStatic />
      </Box>,
    );

    expect(regionOf(session, "growing").height).toBe(1);

    runInAction(() => {
      content.set("one\ntwo\nthree\nfour");
    });
    await session.pilot.pause();

    expect(regionOf(session, "growing").height).toBe(4);

    session.unmount();
  });

  // The load-bearing half of that design: one widget's commit re-derives the
  // widgets it displaced, which never re-rendered and so have no commit of
  // their own to measure on. A stale `y` here is the plausible-looking wrong
  // rectangle that hit tests would then trust.
  it("moves a sibling the grown widget displaced, though the sibling never re-rendered", async () => {
    const content = observable.box("one");
    const GrowingStatic = observer(function GrowingStatic(): React.JSX.Element {
      return <Static id="growing" content={content.get()} />;
    });

    const session = await runTest(
      <Box flexDirection="column">
        <GrowingStatic />
        <Static id="below" content="below" />
      </Box>,
    );

    expect(regionOf(session, "below").y).toBe(1);

    runInAction(() => {
      content.set("one\ntwo\nthree\nfour");
    });
    await session.pilot.pause();

    expect(regionOf(session, "below").y).toBe(4);

    session.unmount();
  });

  // Obligation (c) of the measured-width seam, made observable. Content wrapped
  // to the measured width is output that feeds back into the measurement, and
  // since r1k.2 every commit re-measures, so the loop is live rather than latent.
  // It terminates only because `updateScreenRegion` writes on change; the seam
  // must not launder that by handing back a width its own output moved.
  it("settles a widget whose content is wrapped to the width it is measured at", async () => {
    const session = await runTest(
      <Box flexDirection="column">
        <Static id="wrapped" content={"lorem ipsum dolor sit amet ".repeat(8)} />
      </Box>,
    );

    const settled = regionOf(session, "wrapped");
    expect(settled.width).toBe(80);
    // Wrapping happened — the content is taller than one row, so the rendered
    // output genuinely depended on the width, which is what makes this a loop.
    expect(settled.height).toBeGreaterThan(1);

    // Idle passes move nothing. A seam that re-derived the width from the wrapped
    // output would drift here, one pass at a time.
    await session.pilot.pause();
    await session.pilot.pause();
    expect(regionOf(session, "wrapped")).toEqual(settled);

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
