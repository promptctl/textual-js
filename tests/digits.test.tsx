import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import React from "react";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";

import { Digits, runTest, type TestSession } from "../src/index.js";
import { digitsContent, digitsRows } from "../src/widgets/digits.js";
import { CHARSET_VALUES } from "../visual-tests/fixtures/digits_charset.tsx";

// [LAW:behavior-not-structure] Every expectation below is glyphs a reader could
// see on screen, or a widget they could query — never a call the component
// happens to make on the way there.
//
// The two row-triples are transcribed cell-for-cell from the committed Python
// baselines, visual-tests/snapshots/python/digits_basic.txt and
// digits_large.txt, rather than assembled from the same font table the
// implementation reads. A test that rebuilt the rows from GLYPHS would
// agree with the implementation by construction and could never catch a
// mistranscribed glyph — which is the single most likely defect in a port whose
// whole job is copying a font.
const BASELINE_PI: readonly string[] = [
  "╶─╮ ╶╮ ╷ ╷",
  " ─┤  │ ╰─┤",
  "╶─╯•╶┴╴  ╵",
];

const BASELINE_CLOCK: readonly string[] = [
  "╶╮ ╶─╮   ╶─╮╷ ╷",
  " │ ┌─┘ :  ─┤╰─┤",
  "╶┴╴╰─╴   ╶─╯  ╵",
];

// The rows real Textual drew for the digits_charset fixture, read from its
// committed baseline rather than copied into a literal here.
//
// [LAW:one-source-of-truth] CLAUDE.md: derive from the committed baseline
// instead of storing a second copy, so the expectation cannot disagree with the
// frame Gate 4 measures. Deriving also makes this the one assertion in the file
// that a bad glyph table could not satisfy by construction — the two row-triples
// above are hand-transcribed for the same reason, and this covers the characters
// they do not reach.
const CHARSET_BASELINE_ROWS = readFileSync(
  fileURLToPath(new URL("../visual-tests/snapshots/python/digits_charset.txt", import.meta.url)),
  "utf8",
).split("\n");

function screenRows(session: TestSession, count: number): string[] {
  return stripAnsi(session.lastFrame() ?? "")
    .split("\n")
    .slice(0, count)
    .map((row) => row.trimEnd());
}

describe("digits font", () => {
  it("draws '3.14' exactly as the Python baseline does", () => {
    expect(digitsRows("3.14")).toEqual(BASELINE_PI);
  });

  it("draws '12:34' exactly as the Python baseline does", () => {
    expect(digitsRows("12:34")).toEqual(BASELINE_CLOCK);
  });

  it("draws a period as a bullet resting on the bottom row", () => {
    // The one character substitution the font makes, and the reason "3.14"
    // above is 10 cells rather than 12.
    expect(digitsRows(".")).toEqual([" ", " ", "•"]);
  });

  it("draws every character in the font exactly as Python Textual drew it", () => {
    // The whole 27-character font, checked against real Textual output. A
    // literal table here would have been pasted from the same generator that
    // produced GLYPHS, so it would have agreed with the implementation however
    // wrong both were; the baseline was drawn by upstream and cannot.
    //
    // Trailing spaces are trimmed on both sides because the baseline capture
    // trims them. Only the last glyph on each line is affected, and the cells it
    // loses carry no ink — the paired PNG covers them.
    CHARSET_VALUES.forEach((value, index) => {
      const expected = CHARSET_BASELINE_ROWS.slice(index * 3, index * 3 + 3);

      expect(digitsRows(value).map((row) => row.trimEnd())).toEqual(
        expected.map((row) => row.trimEnd()),
      );
    });
  });

  it("draws a character the font does not know verbatim on the bottom row", () => {
    // Degrading to the raw character keeps an unexpected value readable instead
    // of dropping it, and is how the bullet above reaches the screen at all.
    // The title stops at "verbatim" on purpose — the wide-character case below
    // is the same rule and is not one cell wide.
    expect(digitsRows("?")).toEqual([" ", " ", "?"]);
  });

  it("stays three lines even when the value contains a line break", () => {
    // The one place this port deliberately parts company with Textual, which
    // draws the newline verbatim on the bottom row and emits four lines.
    // DigitsRows promises three, and a widget painting a fourth row lands
    // outside the box Ink measured it into — so line terminators are drawn
    // blank instead.
    expect(digitsContent("1\n2").plain.split("\n")).toHaveLength(3);
    expect(digitsRows("1\r\n2").join("")).not.toContain("\n");
  });

  it("draws a wide character verbatim, exactly as Textual does", () => {
    // Upstream's fallback puts the raw character on the bottom row whatever its
    // width, so `文` runs two columns under two rows of one space and the rows
    // fall out of step. Pinned rather than corrected: substituting a placeholder
    // Textual does not draw is what would make this port diverge.
    expect(digitsRows("文")).toEqual([" ", " ", "文"]);
  });

  it("stays three rows tall for the empty value", () => {
    // Height is a property of the font, not of how much was drawn: upstream
    // answers `3` unconditionally, and here the empty value is the fold's
    // starting point rather than a special case.
    expect(digitsRows("")).toEqual(["", "", ""]);
  });

  it("keeps three rows however many characters are drawn", () => {
    expect(digitsRows("1234567890")).toHaveLength(3);
  });

  it("draws square brackets as characters rather than reading them as markup", () => {
    // [LAW:parse-dont-validate] The regression this guards: handing the rows
    // downstream as a plain string routes them through Content.fromMarkup,
    // where "[3]" opens a tag and the digit disappears. Returning a Content
    // means the markup boundary was crossed once, here.
    // The brackets survive on the bottom row, where the font puts every
    // character it does not know, with a blank cell above each.
    expect(digitsContent("[3]").plain.split("\n")).toEqual([
      " ╶─╮ ",
      "  ─┤ ",
      "[╶─╯]",
    ]);
  });
});

describe("Digits widget", () => {
  it("paints the value on screen exactly as the Python baseline does", async () => {
    const session = await runTest(<Digits value="3.14" />);

    expect(screenRows(session, 3)).toEqual(BASELINE_PI);

    session.unmount();
  });

  it("paints a value containing a colon across all three rows", async () => {
    const session = await runTest(<Digits value="12:34" />);

    expect(screenRows(session, 3)).toEqual(BASELINE_CLOCK);

    session.unmount();
  });

  it("accepts a number as readily as a string", async () => {
    const session = await runTest(<Digits value={314} />);

    expect(screenRows(session, 3)).toEqual(digitsRows("314"));

    session.unmount();
  });

  it("shows nothing when given no value", async () => {
    const session = await runTest(<Digits />);

    expect(screenRows(session, 3)).toEqual(["", "", ""]);

    session.unmount();
  });

  it("registers with the framework as typeName Digits", async () => {
    const session = await runTest(<Digits id="clock" value="12:34" />);
    await session.app.whenIdle();

    expect(session.app.findWidgets("Digits").map((widget) => widget.id)).toEqual(["clock"]);

    session.unmount();
  });

  it("is not reached by Static rules the way a Label is", async () => {
    // Upstream is `class Digits(Widget)`, not a Static subclass. The distinction
    // is only observable through the cascade, so that is where it is checked.
    const session = await runTest(<Digits value="1" />);
    await session.app.whenIdle();

    expect(session.app.findWidgets("Static")).toHaveLength(0);

    session.unmount();
  });

  it("takes its colour from a Digits rule", async () => {
    const session = await runTest(<Digits value="1" />, {
      appProps: { css: "Digits { color: #55ffff; }" },
    });

    expect(session.lastFrame() ?? "").toContain("38;2;85;255;255");

    session.unmount();
  });

  it("does not take focus", async () => {
    // canFocus is false upstream; the observable is that tabbing past it leaves
    // focus where it was rather than landing on the digits.
    const session = await runTest(<Digits value="1" />);
    await session.app.whenIdle();

    session.app.focusNext();
    await session.app.whenIdle();

    expect(session.app.focusedNodeId).toBeNull();

    session.unmount();
  });
});
