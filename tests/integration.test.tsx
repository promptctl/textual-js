import React, { useState } from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { Key, WidgetHost, runTest } from "../src/index.js";

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
    const session = runTest(<CounterApp />);

    await session.pilot.pause();
    expect(session.lastFrame()).toContain("count:0");

    session.pilot.press("x");
    await session.pilot.pause();

    expect(session.lastFrame()).toContain("count:1");

    session.cleanup();
  });
});
