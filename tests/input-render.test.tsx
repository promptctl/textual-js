import React from "react";
import { describe, expect, it } from "vitest";
import stripAnsi from "strip-ansi";
import { Box } from "ink";

import { Input, SuggestFromList, runTest, type InputHandle } from "../src/index.js";
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

  it("applies the validator's verdict to typed input, not just to validate()", async () => {
    // The live path a user takes — handleInputKey -> postChanged ->
    // applyValidation("changed") -> syncValidationClasses. The validate()
    // accessor the other tests use bypasses all of it.
    const session = await runTest(numberInput(""));
    const target = session.app.getByCssId(TARGET_ID) as InputHandle;

    session.app.focusWidget(target.nodeId);
    await session.app.whenIdle();

    await session.pilot.type("abc");
    expect([...target.classes]).toContain("-invalid");
    expect(stripAnsi(session.lastFrame() ?? "")).toContain("abc");

    await session.pilot.press("backspace", "backspace", "backspace");
    await session.pilot.type("123");
    expect([...target.classes]).toContain("-valid");
    expect([...target.classes]).not.toContain("-invalid");

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

  it.each([1, 2, 3, 6])("never renders wider than the %i columns it was given", async (width) => {
    const session = await runTest(
      <Box width={width} flexDirection="column">
        <Input id={TARGET_ID} value="hello world" />
      </Box>,
    );
    const rows = stripAnsi(session.lastFrame() ?? "")
      .split("\n")
      .filter((row) => row.length > 0);

    // Locks the user-visible property: nothing spills past the allocated
    // columns at any width, including widths too narrow to hold the border.
    //
    // Deliberately NOT a test of the border/padding width budget in
    // input-component.tsx: Ink clips a Box's children to its width, so an
    // over-wide row is absorbed before it reaches the frame and reverting the
    // budget still passes here. The budget is a source-level invariant that
    // keeps the component from depending on that clip; it is not observable
    // from a rendered frame, and this test does not pretend to cover it.
    for (const row of rows) {
      expect(row.length).toBeLessThanOrEqual(width);
    }

    session.unmount();
  });

  it("grows the text area monotonically as the widget widens", async () => {
    const visible: number[] = [];

    for (const width of [3, 4, 5, 6, 7, 8, 9, 10]) {
      const session = await runTest(
        <Box width={width} flexDirection="column">
          <Input id={TARGET_ID} value="abcdefghij" />
        </Box>,
      );
      const target = session.app.getByCssId(TARGET_ID)!;

      // Anchor the window at the head, so what shows is the text area's size
      // rather than wherever the caret happens to have scrolled it.
      session.app.focusWidget(target.nodeId);
      await session.app.whenIdle();
      await session.pilot.press("home");

      const valueRow = stripAnsi(session.lastFrame() ?? "").split("\n")[1] ?? "";
      visible.push(valueRow.slice(1, -1).trim().length);
      session.unmount();
    }

    // Padding is budgeted as a total rather than capped per side. Capping per
    // side made the area oscillate (1, 0, 1, 0, 1, 2, 3) as the widget grew, so
    // a wider Input could show *less* text than a narrower one.
    for (let index = 1; index < visible.length; index += 1) {
      expect(visible[index]).toBeGreaterThanOrEqual(visible[index - 1]);
    }
    // And it does eventually show text, so "monotonic" isn't satisfied by zero.
    expect(visible.at(-1)).toBeGreaterThan(0);
  });

  it("holds the scroll window still when focus is lost", async () => {
    const long = `HEAD${"x".repeat(112)}TAIL`;
    const session = await runTest(<Input id={TARGET_ID} value={long} />);
    const target = session.app.getByCssId(TARGET_ID)!;

    session.app.focusWidget(target.nodeId);
    await session.app.whenIdle();
    const focused = stripAnsi(session.lastFrame() ?? "");

    session.app.focusWidget(null);
    await session.app.whenIdle();
    const blurred = stripAnsi(session.lastFrame() ?? "");

    // Blurring hides the cursor; it must not also snap the window back to the
    // head of the value. Where the window sits depends on the caret, which
    // focus does not move.
    expect(blurred).toContain("TAIL");
    expect(blurred).not.toContain("HEAD");
    expect(blurred).toBe(focused);
    session.unmount();
  });

  it("shows no suggestion suffix once the value is cleared", async () => {
    const session = await runTest(
      <Input id={TARGET_ID} placeholder="type here" suggester={new SuggestFromList(["hello"])} />,
    );
    const target = session.app.getByCssId(TARGET_ID)!;

    session.app.focusWidget(target.nodeId);
    await session.app.whenIdle();
    await session.pilot.type("h");
    expect(stripAnsi(session.lastFrame() ?? "")).toContain("hello");

    await session.pilot.press("backspace");
    await session.app.whenIdle();
    const cleared = stripAnsi(session.lastFrame() ?? "");

    // An empty value completes nothing, so the placeholder stands alone rather
    // than carrying the whole stale suggestion glued to its end.
    expect(cleared).toContain("type here");
    expect(cleared).not.toContain("hello");
    session.unmount();
  });

  it("never reveals a suggestion in a password field", async () => {
    const session = await runTest(
      <Input id={TARGET_ID} password suggester={new SuggestFromList(["hunter2secret"])} />,
    );
    const target = session.app.getByCssId(TARGET_ID)!;

    session.app.focusWidget(target.nodeId);
    await session.app.whenIdle();
    await session.pilot.type("hun");
    const frame = stripAnsi(session.lastFrame() ?? "");

    // Neither the completion nor its length may show: the suffix is suppressed
    // outright, so only the typed characters are represented.
    expect(frame).not.toContain("ter2secret");
    expect(frame).toContain("•••");
    expect(frame).not.toContain("••••");
    session.unmount();
  });

  it("honours a text-style rule from the cascade", async () => {
    const plain = await runTest(<Input id={TARGET_ID} value="styled" />);
    const plainFrame = plain.lastFrame() ?? "";
    plain.unmount();

    const bold = await runTest(<Input id={TARGET_ID} value="styled" />, {
      appProps: { css: `Input { text-style: bold; }` },
    });
    const boldFrame = bold.lastFrame() ?? "";
    bold.unmount();

    // text-style resolves into styles.text; the widget must not discard it.
    expect(boldFrame).not.toBe(plainFrame);
    expect(stripAnsi(boldFrame)).toBe(stripAnsi(plainFrame));
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
