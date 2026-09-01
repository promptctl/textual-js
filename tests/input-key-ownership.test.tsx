import React from "react";
import { describe, expect, it } from "vitest";
import stripAnsi from "strip-ansi";
import { Box } from "ink";

import { Input, runTest, type TestSession } from "../src/index.js";

// [LAW:behavior-not-structure] A focused Input owns the keys that edit its
// text and nothing else. These assert where a key ends up — inserted, or
// bubbled on to the screen and app — which is the contract Python Textual
// defines. Nothing here reaches into the component's key table.

const APP_PROPS = {
  autoFocus: "#first",
  // `ctrl+r` and not `ctrl+c`: the app already binds ctrl+c to app.quit
  // (src/framework/_app-runtime.ts), which would answer the chord before this
  // binding could show that the chord got past the Input at all.
  bindings: [{ key: "f5", action: "refresh" }, { key: "ctrl+r", action: "refresh" }],
} as const;

interface Harness {
  session: TestSession;
  fired: string[];
}

async function twoInputs(): Promise<Harness> {
  const fired: string[] = [];
  const session = await runTest(
    (
      <Box flexDirection="column">
        <Input id="first" />
        <Input id="second" />
      </Box>
    ),
    {
      appProps: {
        ...APP_PROPS,
        actions: {
          action_refresh: () => {
            fired.push("app-binding");
          },
        },
      },
    },
  );

  return { session, fired };
}

describe("key ownership of a focused Input", () => {
  it("hands tab on to app.focus_next instead of swallowing it", async () => {
    const { session } = await twoInputs();
    const first = session.app.getByCssId("first")!;
    const second = session.app.getByCssId("second")!;

    expect(session.app.focusedNodeId).toBe(first.nodeId);

    await session.pilot.press("tab");

    expect(session.app.focusedNodeId).toBe(second.nodeId);

    session.unmount();
  });

  it("runs an app-level binding on a key it does not own", async () => {
    const { session, fired } = await twoInputs();

    await session.pilot.press("f5");

    expect(fired).toEqual(["app-binding"]);
    expect(stripAnsi(session.lastFrame() ?? "")).not.toContain("f5");

    session.unmount();
  });

  it("does not type the letter of a ctrl chord, and lets the chord through", async () => {
    const { session, fired } = await twoInputs();

    session.app.postKey("r", { ctrl: true });
    await session.app.whenIdle();

    expect(stripAnsi(session.lastFrame() ?? "")).not.toContain("r");
    expect(fired).toEqual(["app-binding"]);

    session.unmount();
  });

  it("types a space rather than handing the space bar to a binding", async () => {
    const { session, fired } = await twoInputs();

    await session.pilot.type("a b");

    expect(stripAnsi(session.lastFrame() ?? "")).toContain("a b");
    expect(fired).toEqual([]);

    session.unmount();
  });

  it("still consumes the text and editing keys it owns", async () => {
    const { session, fired } = await twoInputs();

    await session.pilot.type("hi");
    await session.pilot.press("backspace");

    const frame = stripAnsi(session.lastFrame() ?? "");

    expect(frame).toContain("h");
    expect(frame).not.toContain("hi");
    // Typing must not leak upward into app bindings.
    expect(fired).toEqual([]);
    expect(session.app.focusedNodeId).toBe(session.app.getByCssId("first")!.nodeId);

    session.unmount();
  });
});
