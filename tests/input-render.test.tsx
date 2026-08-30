import React from "react";
import { describe, expect, it } from "vitest";
import stripAnsi from "strip-ansi";

import { Input, runTest, type InputHandle } from "../src/index.js";
import { NumberValidator } from "../src/validation/index.js";

// [LAW:behavior-not-structure] These assert what an Input puts on screen — the
// contract Python Textual defines and visual-tests/snapshots/python/input_*.json
// records. None of them reach into the component's runs, palette or CSS, so a
// different implementation of the same contract still passes.

const TARGET_ID = "target";

function numberInput(value: string): React.JSX.Element {
  return (
    <Input
      id={TARGET_ID}
      value={value}
      validators={[new NumberValidator()]}
      validateOn={["changed"]}
    />
  );
}

/**
 * Render once and capture the same Input blurred and focused.
 *
 * Frames keep their escape sequences: focus and validity change colours, not
 * characters, so a stripped frame cannot see the difference. `text` is the
 * stripped blurred frame, for the assertions that are about characters.
 */
async function framesOf(
  element: React.JSX.Element,
  { forceInvalid = false }: { forceInvalid?: boolean } = {},
): Promise<{ blurred: string; focused: string; text: string }> {
  const session = await runTest(element);
  const target = session.app.getByCssId(TARGET_ID) as InputHandle | undefined;

  if (target === undefined) {
    throw new Error(`test harness: no widget with id "${TARGET_ID}"`);
  }

  // An Input built with an initial value carries no verdict until asked, so a
  // test that wants the invalid styling has to ask — exactly as the paired
  // visual fixture does at mount.
  if (forceInvalid) {
    target.validate("not a number");
    await session.app.whenIdle();
  }

  const blurred = session.lastFrame() ?? "";
  session.app.focusWidget(target.nodeId);
  await session.app.whenIdle();
  const focused = session.lastFrame() ?? "";
  session.unmount();

  return { blurred, focused, text: stripAnsi(blurred) };
}

/**
 * The border colour of a rendered frame, as an "r,g,b" string.
 *
 * The first cell the Input emits is its top-left border glyph, so the frame's
 * first truecolor foreground sequence is the border colour. Read as a relation
 * between frames rather than compared to a literal, so the assertions stay
 * independent of which hex DEFAULT_CSS happens to name.
 */
function borderColorOf(frame: string): string {
  const match = /\[38;2;(\d+);(\d+);(\d+)m/.exec(frame);

  if (match === null) {
    throw new Error("frame carries no truecolor foreground — nothing to read a border from");
  }

  return `${match[1]},${match[2]},${match[3]}`;
}

describe("Input rendering", () => {
  it("draws a bordered frame around its value", async () => {
    const { text } = await framesOf(<Input id={TARGET_ID} value="hello world" />);

    expect(text).toContain("hello world");
    // Textual's `border: tall` — half-block rules above, below and either side.
    expect(text).toContain("▔");
    expect(text).toContain("▁");
    expect(text).toContain("▊");
    expect(text).toContain("▎");
  });

  it("shows the placeholder while the value is empty", async () => {
    const { text } = await framesOf(<Input id={TARGET_ID} placeholder="Enter your name" />);

    expect(text).toContain("Enter your name");
  });

  it("shows the value instead of the placeholder once there is one", async () => {
    const { text } = await framesOf(
      <Input id={TARGET_ID} value="typed" placeholder="Enter your name" />,
    );

    expect(text).toContain("typed");
    expect(text).not.toContain("Enter your name");
  });

  it("obscures a password value with bullets, never asterisks", async () => {
    const { text } = await framesOf(<Input id={TARGET_ID} value="supersecret" password />);

    expect(text).toContain("•".repeat("supersecret".length));
    expect(text).not.toContain("supersecret");
    expect(text).not.toContain("*");
  });

  it("shows the placeholder in password mode when the value is empty", async () => {
    const { text } = await framesOf(<Input id={TARGET_ID} placeholder="Password" password />);

    expect(text).toContain("Password");
    expect(text).not.toContain("•");
  });

  it("renders a visibly different frame when focused", async () => {
    const { blurred, focused } = await framesOf(
      <Input id={TARGET_ID} placeholder="Focused input" />,
    );

    // The focused frame carries the focus border and the block cursor; the
    // characters are unchanged, so the difference lives entirely in the styling.
    expect(focused).not.toBe(blurred);
    expect(stripAnsi(focused)).toBe(stripAnsi(blurred));
  });

  it("marks the widget invalid only once validation has actually run", async () => {
    const session = await runTest(numberInput("abc"));
    const target = session.app.getByCssId(TARGET_ID) as InputHandle;

    // Textual validates on value *changes*, so an Input constructed with an
    // initial value carries no verdict until asked. Pinning that, because it is
    // the reason the assertions below have to call validate() themselves.
    expect([...target.classes]).not.toContain("-invalid");

    target.validate();
    await session.app.whenIdle();

    expect([...target.classes]).toContain("-invalid");
    session.unmount();
  });

  it("renders a visibly different frame when a validator fails", async () => {
    // Same displayed value in both frames, so the only thing the comparison can
    // be sensitive to is the invalid styling — not a text difference.
    const valid = await framesOf(numberInput("123"));
    const invalid = await framesOf(numberInput("123"), { forceInvalid: true });

    expect(invalid.blurred).not.toBe(valid.blurred);
  });

  it("gives a focused-and-invalid Input its own border colour", async () => {
    const valid = await framesOf(numberInput("123"));
    const invalid = await framesOf(numberInput("123"), { forceInvalid: true });

    // Whole-frame comparison is too blunt here: focus also changes the
    // background and adds a cursor, so frames differ even when the border does
    // not. Textual's point is that neither state wins outright — a focused
    // invalid Input gets a third border colour — so assert on the border.
    expect(borderColorOf(invalid.focused)).not.toBe(borderColorOf(valid.focused));
    expect(borderColorOf(invalid.focused)).not.toBe(borderColorOf(invalid.blurred));
    expect(borderColorOf(invalid.blurred)).not.toBe(borderColorOf(valid.blurred));
  });

  it("scrolls the window so the cursor stays visible once the value overflows", async () => {
    // Distinguishable ends: a repeating filler would make `not.toContain`
    // meaningless, since the head would also appear inside the tail.
    const long = `HEAD${"x".repeat(112)}TAIL`; // 120 chars, wider than the 74-cell area
    const session = await runTest(<Input id={TARGET_ID} value={long} />);
    const target = session.app.getByCssId(TARGET_ID)!;

    session.app.focusWidget(target.nodeId);
    await session.app.whenIdle();
    const frame = stripAnsi(session.lastFrame() ?? "");

    // The cursor sits at the end of the value, so the window shows the tail and
    // has scrolled the head out of view.
    expect(frame).toContain("TAIL");
    expect(frame).not.toContain("HEAD");
    session.unmount();
  });
});
