import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import React from "react";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";

import { LoadingIndicator, runTest, type TestSession } from "../src/index.js";

// [LAW:behavior-not-structure] Every expectation below is something a reader
// could see on screen or query from the app — never a call the component
// happens to make on the way there.

// [LAW:one-source-of-truth] The frame real Textual settles on with animations
// off, read out of the committed baseline rather than restated as literals
// here. The fixture is `height: 3` at 80 columns, so the indicator's region is
// the first three rows and the rest of the screen belongs to the Screen.
const BASELINE_PATH = new URL(
  "../visual-tests/snapshots/python/loading_indicator.txt",
  import.meta.url,
);
const BASELINE_ANSI_PATH = new URL(
  "../visual-tests/snapshots/python/loading_indicator.ansi",
  import.meta.url,
);

const INDICATOR_HEIGHT = 3;

const BASELINE_ROWS = readFileSync(fileURLToPath(BASELINE_PATH), "utf8")
  .split("\n")
  .slice(0, INDICATOR_HEIGHT);

/** The first truecolour foreground the baseline sets — the indicator's own. */
function baselineForegroundSgr(): string {
  const ansi = readFileSync(fileURLToPath(BASELINE_ANSI_PATH), "utf8");
  const match = /38;2;\d+;\d+;\d+/.exec(ansi);

  if (match === null) {
    throw new Error(`no truecolour foreground in ${fileURLToPath(BASELINE_ANSI_PATH)}`);
  }

  return match[0];
}

const FIXTURE_CSS = "LoadingIndicator { height: 3; }";

function paintedRows(session: TestSession): string[] {
  return stripAnsi(session.lastFrame() ?? "")
    .split("\n")
    .slice(0, INDICATOR_HEIGHT);
}

describe("LoadingIndicator", () => {
  it("renders the frame Textual settles on with animations off", async () => {
    // Upstream's animated arm is five pulsing dots; the still arm is the
    // literal text `Loading...`, centred in the widget's region. Comparing the
    // whole three-row block rather than searching for the caption is what makes
    // this see three separate ways to be wrong at once: the wrong caption, the
    // caption in the wrong place, and a region with unpainted holes in it.
    // Ink colours Text and not Box, so a cell this widget does not emit is a
    // cell its colour never reaches — and a row short of 80 characters is
    // exactly that hole.
    const session = await runTest(<LoadingIndicator />, {
      appProps: { css: FIXTURE_CSS },
    });
    await session.app.whenIdle();

    expect(paintedRows(session)).toEqual(BASELINE_ROWS);

    session.unmount();
  });

  it("paints the caption in the colour Textual painted", async () => {
    // The row-text assertion above cannot see colour at all — the blind spot a
    // plain-text match always has. Upstream's `color: $primary` resolves to
    // #0178d4 under the default dark theme, and that hex reaching the screen is
    // the difference between this widget and an uncoloured Static.
    const session = await runTest(<LoadingIndicator />, {
      appProps: { css: FIXTURE_CSS },
    });
    await session.app.whenIdle();

    expect(session.lastFrame() ?? "").toContain(baselineForegroundSgr());

    session.unmount();
  });

  it("renders the identical frame every time it is rendered", async () => {
    // The property that makes this widget capturable at all. Upstream derives
    // its animated frame from elapsed wall-clock time, so a port that kept that
    // arm would produce a different frame per capture and no baseline could
    // pin it. Two sessions rather than two reads of one, so a cached frame
    // cannot satisfy this. [LAW:no-ambient-temporal-coupling]
    const first = await runTest(<LoadingIndicator />, { appProps: { css: FIXTURE_CSS } });
    await first.app.whenIdle();
    const firstFrame = first.lastFrame();
    first.unmount();

    const second = await runTest(<LoadingIndicator />, { appProps: { css: FIXTURE_CSS } });
    await second.app.whenIdle();

    expect(second.lastFrame()).toBe(firstFrame);

    second.unmount();
  });

  it("fills the screen when no rule gives it a height", async () => {
    // The one behaviour no fixture can reach: `loading_indicator.py` pins
    // `height: 3`, so every baseline in the suite measures the overridden case
    // and none of them measures upstream's own `height: 100%`. Left untested it
    // could resolve to a single row — `1fr` does exactly that in this port —
    // and every green baseline would still be green.
    const session = await runTest(<LoadingIndicator />);
    await session.app.whenIdle();

    const rows = stripAnsi(session.lastFrame() ?? "").split("\n");

    expect(rows).toHaveLength(24);
    expect(rows.every((row) => row.length === 80)).toBe(true);
    // Upstream centres one line in 24 rows at floor((24 - 1) / 2).
    expect(rows[11]?.trim()).toBe("Loading...");

    session.unmount();
  });

  it("takes its colour from a LoadingIndicator rule", async () => {
    // The observable consequence of registering under upstream's type name: a
    // stylesheet can reach it by that name and nothing else.
    const session = await runTest(<LoadingIndicator />, {
      appProps: { css: "LoadingIndicator { height: 3; color: #55ffff; }" },
    });
    await session.app.whenIdle();

    expect(session.lastFrame() ?? "").toContain("38;2;85;255;255");

    session.unmount();
  });

  it("does not take focus", async () => {
    // `can_focus = False` upstream; the observable is that tabbing leaves focus
    // where it was rather than landing on the indicator.
    const session = await runTest(<LoadingIndicator />, {
      appProps: { css: FIXTURE_CSS },
    });
    await session.app.whenIdle();

    session.app.focusNext();
    await session.app.whenIdle();

    expect(session.app.focusedNodeId).toBeNull();

    session.unmount();
  });
});
