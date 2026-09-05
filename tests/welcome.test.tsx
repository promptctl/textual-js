import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import React from "react";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";

import { ButtonPressed, Content, Welcome, WELCOME_MARKDOWN, runTest, type TestSession } from "../src/index.js";

// [LAW:behavior-not-structure] Every expectation below is glyphs a reader could
// see on screen, or a message the app could observe — never a call the component
// happens to make on the way there.
//
// Welcome's body is markdown, and this port has no Markdown widget until Stage
// 10, so `welcome_default`'s body rows are a recorded known diff. That is a
// statement about the *body*, not about the widget: the dismiss button is the
// full contract Welcome owns today, and rows 22-24 of the baseline are the
// oracle for it. Nothing below asserts the body's markdown *rendering*; what it
// does assert is that a caller's body arrives on screen unmangled, which is the
// part that must keep working when Markdown lands underneath it.

const BASELINE_PATH = new URL(
  "../visual-tests/snapshots/python/welcome_default.txt",
  import.meta.url,
);

const SCREEN_WIDTH = 80;
const SCREEN_HEIGHT = 24;
const BUTTON_HEIGHT = 3;

// [LAW:one-source-of-truth] The three button rows real Textual drew, read out of
// the committed baseline rather than restated as literals. A stored copy would
// agree with whatever this port happens to produce; the baseline is the frame
// Gate 4 measures.
const BASELINE_BUTTON_ROWS = readFileSync(fileURLToPath(BASELINE_PATH), "utf8")
  .split("\n")
  .slice(0, SCREEN_HEIGHT)
  .slice(-BUTTON_HEIGHT);

function paintedRows(session: TestSession): string[] {
  return stripAnsi(session.lastFrame() ?? "").split("\n");
}

describe("Welcome", () => {
  it("paints the dismiss button exactly as Textual drew it", async () => {
    // Three ways to be wrong at once, and one assertion that sees all of them:
    // the wrong glyphs, a button that is not full width, and a button that is
    // not docked to the last row. The width is the one with teeth — Button is
    // `width: auto; min-width: 16` by default, and upstream widens it with
    // `Welcome #close { width: 100% }`. A Welcome that failed to widen it would
    // paint a 16-cell bar and still look like a button.
    const session = await runTest(<Welcome />);
    await session.app.whenIdle();

    expect(paintedRows(session).slice(-BUTTON_HEIGHT)).toEqual(BASELINE_BUTTON_ROWS);

    session.unmount();
  });

  it("fills the region it is given", async () => {
    // Upstream is `width: 100%; height: 100%`, and the dock above depends on it:
    // a Welcome that hugged its content would put the button directly under the
    // body instead of at the bottom of the screen.
    //
    // Asserted on the widget's own placed rectangle, not on the frame's row
    // count. The frame is 24 rows tall whatever Welcome does — a row-count
    // assertion here passes with `height: 100%` deleted, which is a test
    // measuring the harness.
    const session = await runTest(<Welcome id="welcome" />);
    await session.app.whenIdle();

    const welcome = session.app.getByCssId("welcome");
    expect(welcome).toBeDefined();
    expect(welcome!.screenRegion.height).toBe(SCREEN_HEIGHT);
    expect(welcome!.screenRegion.width).toBe(SCREEN_WIDTH);

    session.unmount();
  });

  it("insets the body the way upstream's container and margin do", async () => {
    // Upstream reaches this inset through two nested rules — `Welcome Container
    // { padding: 1 }` around `Welcome #text { margin: 0 1 }`. Neither survives
    // here (no Container widget, and a parent's DEFAULT_CSS does not reach a
    // child of another type), so the inset is applied in the render body, and
    // this is what holds it to the same numbers. It is the one part of the body
    // region that already agrees with the baseline, so the baseline is the
    // oracle: row 1 blank from the top margin, and body rows starting at
    // column 3 from the 1 + 1 of padding and margin.
    const session = await runTest(<Welcome />);
    await session.app.whenIdle();

    const baselineRows = readFileSync(fileURLToPath(BASELINE_PATH), "utf8").split("\n");
    const indentOf = (row: string): number => row.length - row.trimStart().length;

    const rows = paintedRows(session);
    expect(rows[0]?.trim()).toBe("");
    expect(baselineRows[0]?.trim()).toBe("");
    // Baseline row 4 is the first left-aligned body row; row 2's heading is
    // centred and says nothing about the inset.
    expect(indentOf(rows[3] ?? "")).toBe(indentOf(baselineRows[3] ?? ""));

    session.unmount();
  });

  it("posts ButtonPressed from its dismiss button and nothing else", async () => {
    // Upstream Welcome declares no message of its own — the OK button posts
    // `Button.Pressed` and the application decides what dismissing means. A port
    // that re-posted it under a second name would give one event two sources.
    // [LAW:one-source-of-truth]
    const pressed: string[] = [];
    const session = await runTest(<Welcome />, {
      messageHook: (message) => {
        if (message instanceof ButtonPressed) {
          pressed.push("pressed");
        }
      },
    });
    await session.app.whenIdle();

    const close = session.app.getByCssId("close");
    expect(close).toBeDefined();
    session.app.focusWidget(close!.nodeId);
    await session.pilot.pause();
    await session.pilot.press("enter");

    expect(pressed).toEqual(["pressed"]);

    session.unmount();
  });

  it("paints the body it is handed, in place of the default copy", async () => {
    // Upstream documents Welcome as usable "as a form of placeholder within a
    // Textual application", which is a claim about arbitrary content. The
    // default body is a value, not a fixed part of the widget.
    const session = await runTest(<Welcome content={new Content("a borrowed body")} />);
    await session.app.whenIdle();

    const rows = paintedRows(session);
    expect(rows.join("\n")).toContain("a borrowed body");
    expect(rows.join("\n")).not.toContain("Dune quote");
    // Replacing the body does not cost the button.
    expect(rows.slice(-BUTTON_HEIGHT)).toEqual(BASELINE_BUTTON_ROWS);

    session.unmount();
  });

  it("does not re-parse a Content body as markup", async () => {
    // The defect this widget is most likely to ship, and Placeholder already
    // paid for it once (src/widgets/placeholder.ts:191, and CLAUDE.md's rule).
    // A caller who has already built a `Content` has said what their text is;
    // running it back through the markup parser reads `[draft]` as an unknown
    // tag and silently eats seven visible characters. Asserted through the
    // rendered screen rather than against `Content` directly, so it is Welcome's
    // seam under test and not the primitive's.
    const session = await runTest(<Welcome content={new Content("[draft] notes")} />);
    await session.app.whenIdle();

    expect(paintedRows(session).join("\n")).toContain("[draft] notes");

    session.unmount();
  });

  it("carries upstream's welcome copy verbatim", () => {
    // The body is markdown *source* until Stage 10 renders it, so the string
    // itself is the contract — and it is upstream's, not a paraphrase. The
    // structural markers are what the Markdown widget will consume; if the copy
    // drifted, the fixture would keep passing and Stage 10 would render the
    // wrong document. Verified against the oracle:
    //   uv run python -c "from textual.widgets._welcome import WELCOME_MD; print(WELCOME_MD)"
    expect(WELCOME_MARKDOWN.startsWith("# Welcome!\n")).toBe(true);
    expect(WELCOME_MARKDOWN).toContain("## Dune quote");
    expect(WELCOME_MARKDOWN).toContain("> \"I must not fear.");
    expect(WELCOME_MARKDOWN.trimEnd().endsWith("Only I will remain.\"")).toBe(true);
  });
});
