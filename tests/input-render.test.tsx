import React from "react";
import { describe, expect, it } from "vitest";
import stripAnsi from "strip-ansi";

import { Input, runTest } from "../src/index.js";
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
): Promise<{ blurred: string; focused: string; text: string }> {
  const session = await runTest(element);
  const blurred = session.lastFrame() ?? "";
  const target = session.app.getByCssId(TARGET_ID);

  if (target === undefined) {
    throw new Error(`test harness: no widget with id "${TARGET_ID}"`);
  }

  session.app.focusWidget(target.nodeId);
  await session.app.whenIdle();
  const focused = session.lastFrame() ?? "";
  session.unmount();

  return { blurred, focused, text: stripAnsi(blurred) };
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

  it("renders a visibly different frame when a validator fails", async () => {
    const valid = await framesOf(numberInput("123"));
    const invalid = await framesOf(numberInput("abc"));

    expect(invalid.blurred).not.toBe(valid.blurred);
  });

  it("keeps the invalid styling distinct from the focus styling when both apply", async () => {
    const valid = await framesOf(numberInput("123"));
    const invalid = await framesOf(numberInput("abc"));

    // Textual gives a focused-and-invalid Input its own border rather than
    // letting either state win outright.
    expect(invalid.focused).not.toBe(valid.focused);
    expect(invalid.focused).not.toBe(invalid.blurred);
  });
});
