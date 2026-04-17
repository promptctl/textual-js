import React, { useState } from "react";
import { Box, Text } from "ink";
import { describe, expect, it } from "vitest";

import {
  Click,
  Key,
  OutOfBounds,
  WidgetHost,
  camelToSnake,
  runTest,
  useTextual,
} from "../src/index.js";

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

function PilotTarget(): React.JSX.Element {
  return (
    <WidgetHost typeName="PilotTarget" id="pointer-target">
      <Box width={8} height={1}>
        <Text>target</Text>
      </Box>
    </WidgetHost>
  );
}

PilotTarget.displayName = "PilotTarget";

function NotificationOnMount(props: { message: string }): null {
  const framework = useTextual();

  React.useLayoutEffect(() => {
    framework.notify(props.message);
  }, [framework, props.message]);

  return null;
}

describe("testing harness", () => {
  it("exposes the app handle and presses multiple keys as discrete events", async () => {
    const session = await runTest(<CounterApp />);

    expect(session.app).toBe(session.framework);
    expect(String(session.pilot)).toBe("<Pilot app=TextualFramework>");

    await session.pilot.press("x", "x");

    expect(session.lastFrame()).toContain("count:2");

    session.unmount();
  });

  it("repeats the full click sequence when times is provided", async () => {
    const events: string[] = [];
    const chains: number[] = [];

    function ClickHarness(): React.JSX.Element {
      return (
        <WidgetHost
          typeName="Button"
          id="button"
          handlers={{
            onMouseDown: () => {
              events.push("down");
            },
            onMouseUp: () => {
              events.push("up");
            },
            onClick: () => {
              events.push("click");
            },
            on_click: (event) => {
              chains.push((event as Click).chain);
            },
          }}
        >
          <Box width={6} height={1}>
            <Text>press</Text>
          </Box>
        </WidgetHost>
      );
    }

    const session = await runTest(<ClickHarness />);

    expect(await session.pilot.click({ widget: "#button", times: 2 })).toBe(true);
    expect(events).toEqual(["down", "up", "click", "down", "up", "click"]);
    expect(chains).toEqual([1, 2]);

    session.unmount();
  });

  it("tracks click-chain counts for triple clicks", async () => {
    const chains: number[] = [];

    function ClickHarness(): React.JSX.Element {
      return (
        <WidgetHost
          typeName="Button"
          id="button"
          handlers={{
            onClick: (event) => {
              chains.push((event as Click).chain);
            },
          }}
        >
          <Box width={6} height={1}>
            <Text>press</Text>
          </Box>
        </WidgetHost>
      );
    }

    const session = await runTest(<ClickHarness />);

    expect(await session.pilot.tripleClick("#button")).toBe(true);
    expect(chains).toEqual([1, 2, 3]);

    session.unmount();
  });

  it("supports selector, class, and widget-instance pointer targeting", async () => {
    const events: string[] = [];

    function PointerHarness(): React.JSX.Element {
      return (
        <WidgetHost
          typeName="Shell"
          handlers={{
            onMouseDown: () => {
              events.push("down");
            },
            onMouseUp: () => {
              events.push("up");
            },
            onMouseMove: () => {
              events.push("move");
            },
            onClick: () => {
              events.push("click");
            },
          }}
        >
          <PilotTarget />
        </WidgetHost>
      );
    }

    const session = await runTest(<PointerHarness />);
    const widget = session.framework.registry.getByCssId("pointer-target")!;

    expect(await session.pilot.mouseDown("#pointer-target")).toBe(true);
    expect(await session.pilot.mouseUp(PilotTarget)).toBe(true);
    expect(await session.pilot.hover(widget)).toBe(true);
    expect(await session.pilot.click(widget)).toBe(true);
    expect(events).toEqual(["down", "up", "move", "down", "up", "click"]);

    session.unmount();
  });

  it("raises OutOfBounds for invalid coordinates", async () => {
    const session = await runTest(<PilotTarget />, {
      size: { width: 20, height: 1 },
    });

    await expect(session.pilot.click({ offset: { x: -1, y: 0 } })).rejects.toBeInstanceOf(OutOfBounds);
    await expect(session.pilot.click({ offset: { x: session.framework.terminalSize.width, y: 0 } })).rejects.toBeInstanceOf(OutOfBounds);

    session.unmount();
  });

  it("suppresses mount-time notifications by default", async () => {
    const session = await runTest(<NotificationOnMount message="mount note" />);

    expect(session.framework.notifications.length).toBe(0);

    session.unmount();
  });

  it("allows mount-time notifications when transient notifications are enabled", async () => {
    const session = await runTest(<NotificationOnMount message="mount note" />, {
      transients: { notifications: true },
    });

    expect(session.framework.notifications.list().map((entry) => entry.message)).toEqual(["mount note"]);

    session.unmount();
  });

  it("exports camelToSnake for testing helpers", () => {
    expect(camelToSnake("FooBar")).toBe("foo_bar");
  });
});
