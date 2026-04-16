import React, { useState } from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { camelToSnake, Key, WidgetHost, runTest } from "../src/index.js";

function CounterApp(): React.JSX.Element {
  const [count, setCount] = useState(0);

  return (
    <WidgetHost
      typeName="Counter"
      focusable
      autoFocus
      handlers={{
        onKey: (event) => {
          const keyEvent = event as Key;

          if (keyEvent.key === "x") {
            setCount((value) => value + 1);
          }
        },
      }}
    >
      <Text>count:{count}</Text>
    </WidgetHost>
  );
}

describe("runTest and Pilot", () => {
  it("renders an app and routes key input through the pilot", async () => {
    const session = await runTest(<CounterApp />);

    await session.pilot.pause();
    expect(session.lastFrame()).toContain("count:0");

    await session.pilot.press("x");

    expect(session.lastFrame()).toContain("count:1");

    session.unmount();
  });

  it("supports deterministic terminal sizing and async exit", async () => {
    const session = await runTest(<CounterApp />, {
      size: { width: 100, height: 40 },
    });

    expect(session.framework.terminalSize.width).toBe(100);
    expect(session.framework.terminalSize.height).toBe(40);

    await session.pilot.exit("done");

    expect(session.result).toBe("done");
    expect(session.framework.isRunning).toBe(false);

    session.unmount();
  });

  it("observes dispatched messages through the test hook and normalizes keys", async () => {
    const observed: string[] = [];
    const session = await runTest(<CounterApp />, {
      messageHook: (message) => {
        observed.push(message.constructor.name);
      },
    });

    await session.pilot.press("?");

    expect(observed).toContain("Compose");
    expect(observed).toContain("Mount");
    expect(observed).toContain("Key");

    session.unmount();
  });

  it("exports camelToSnake for test helpers", () => {
    expect(camelToSnake("FooBar")).toBe("foo_bar");
  });
});
