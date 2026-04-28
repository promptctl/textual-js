import React, { useLayoutEffect, useState } from "react";
import { Box, Text } from "ink";
import { runInAction } from "mobx";
import { describe, expect, it } from "vitest";

import {
  Click,
  Key,
  OutOfBounds,
  Region,
  StylesheetError,
  Widget,
  WidgetHost,
  WidgetScope,
  WorkerFailed,
  camelToSnake,
  runTest,
  useTextual,
  useWidget,
  visualize,
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

  useLayoutEffect(() => {
    framework.notify(props.message);
  }, [framework, props.message]);

  return null;
}

function TooltipOnMount(props: { message: string }): null {
  const framework = useTextual();

  useLayoutEffect(() => {
    runInAction(() => {
      framework.activeTooltip = {
        sourceNodeId: "mount-tooltip",
        visual: visualize(props.message),
        x: 0,
        y: 0,
        visible: true,
      };
    });
  }, [framework, props.message]);

  return null;
}

function ScrollPointerItem(props: { onReady: (item: Widget) => void }): React.JSX.Element {
  const item = useWidget({
    id: "item",
    typeName: "Item",
  });

  useLayoutEffect(() => {
    props.onReady(item.handle);
  }, [props, item.handle]);

  return (
    <WidgetScope widget={item.handle}>
      <Box width={4} height={1}>
        <Text>item</Text>
      </Box>
    </WidgetScope>
  );
}

function FailingComposeApp(): React.JSX.Element {
  throw new Error("compose boom");
}

function FailingScreen(): React.JSX.Element {
  throw new Error("screen boom");
}

function PushBrokenScreenOnMount(): React.JSX.Element {
  const framework = useTextual();

  useLayoutEffect(() => {
    framework.pushScreen(<FailingScreen />, { name: "broken" });
  }, [framework]);

  return <Text>host</Text>;
}

function FailingActionApp(): React.JSX.Element {
  return (
    <WidgetHost
      typeName="ActionHarness"
      focusable
      autoFocus
      bindings={[{ key: "x", action: "explode" }]}
      actions={{
        action_explode: () => {
          throw new Error("action boom");
        },
      }}
    >
      <Text>action</Text>
    </WidgetHost>
  );
}

function WorkerFailureOnMount(): React.JSX.Element {
  const widget = useWidget({
    id: "worker-harness",
    typeName: "WorkerHarness",
  });

  useLayoutEffect(() => {
    widget.handle.runWorker(async () => {
      throw new Error("worker boom");
    });
  }, [widget.handle]);

  return (
    <WidgetScope widget={widget.handle}>
      <Text>worker</Text>
    </WidgetScope>
  );
}

function ResizeProbe(props: { onReady: (widget: Widget) => void }): React.JSX.Element {
  const widget = useWidget({
    id: "resize-probe",
    typeName: "ResizeProbe",
  });

  useLayoutEffect(() => {
    props.onReady(widget.handle);
  }, [props, widget.handle]);

  return (
    <WidgetScope widget={widget.handle}>
      <Box width="100%" height="100%">
        <Text>probe</Text>
      </Box>
    </WidgetScope>
  );
}

function ScrollPointerHarness(props: { onReady: (viewport: Widget, item: Widget) => void }): React.JSX.Element {
  const viewport = useWidget({
    id: "viewport",
    typeName: "Viewport",
  });
  const [item, setItem] = useState<Widget | null>(null);

  useLayoutEffect(() => {
    if (item !== null) {
      props.onReady(viewport.handle, item);
    }
  }, [item, props, viewport.handle]);

  return (
    <WidgetScope widget={viewport.handle}>
      <Box width={4} height={2}>
        <ScrollPointerItem onReady={setItem} />
      </Box>
    </WidgetScope>
  );
}

describe("testing harness", () => {
  it("exposes the app handle and presses multiple keys as discrete events", async () => {
    const session = await runTest(<CounterApp />);

    expect(session.app.framework).toBe(session.framework);
    expect(String(session.pilot)).toBe("<Pilot app=TextualFramework>");

    await session.pilot.press("x", "x");

    expect(session.lastFrame()).toContain("count:2");

    session.unmount();
  });

  it("accepts ASCII letters, digits, and punctuation as discrete key events", async () => {
    const received: Array<{ key: string; input: string }> = [];

    function KeyHarness(): React.JSX.Element {
      return (
        <WidgetHost
          typeName="KeyHarness"
          focusable
          autoFocus
          handlers={{
            onKey: (event) => {
              const keyEvent = event as Key;
              received.push({ key: keyEvent.key, input: keyEvent.input });
            },
          }}
        >
          <Text>keys</Text>
        </WidgetHost>
      );
    }

    const session = await runTest(<KeyHarness />);

    await session.pilot.press("A", "7", "?", "!");

    expect(received).toEqual([
      { key: "a", input: "A" },
      { key: "7", input: "7" },
      { key: "question_mark", input: "?" },
      { key: "!", input: "!" },
    ]);

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
    const widget = session.app.getByCssId("pointer-target")!;

    expect(await session.pilot.mouseDown("#pointer-target")).toBe(true);
    expect(await session.pilot.mouseUp(PilotTarget)).toBe(true);
    expect(await session.pilot.hover(widget)).toBe(true);
    expect(await session.pilot.click(widget)).toBe(true);
    expect(events).toEqual(["down", "up", "click", "move", "down", "up", "click"]);

    session.unmount();
  });

  it("keeps mount-time tooltips disabled unless the transient opt-in is enabled", async () => {
    const defaultSession = await runTest(<TooltipOnMount message="mount tooltip" />);

    expect(defaultSession.framework.showTooltips).toBe(false);
    expect(defaultSession.lastFrame()).not.toContain("mount tooltip");
    defaultSession.unmount();

    const enabledSession = await runTest(<TooltipOnMount message="mount tooltip" />, {
      transients: { tooltips: true },
    });

    expect(enabledSession.framework.showTooltips).toBe(true);
    enabledSession.unmount();
  });

  it("raises OutOfBounds for invalid coordinates", async () => {
    const session = await runTest(<PilotTarget />, {
      size: { width: 20, height: 1 },
    });

    await expect(session.pilot.click({ offset: { x: -1, y: 0 } })).rejects.toBeInstanceOf(OutOfBounds);
    await expect(session.pilot.click({ offset: { x: session.app.terminalSize.width, y: 0 } })).rejects.toBeInstanceOf(OutOfBounds);

    session.unmount();
  });

  it("raises OutOfBounds when selector targets are scrolled out of view", async () => {
    let viewport!: Widget;
    let item!: Widget;
    const session = await runTest(
      <ScrollPointerHarness
        onReady={(nextViewport, nextItem) => {
          viewport = nextViewport;
          item = nextItem;
        }}
      />,
      { size: { width: 8, height: 4 } },
    );

    viewport.updateScreenRegion(new Region(0, 0, 4, 2));
    viewport.setVirtualSize(4, 6);
    item.updateScreenRegion(new Region(0, 4, 4, 1));

    await expect(session.pilot.click("#item")).rejects.toBeInstanceOf(OutOfBounds);

    viewport.scrollTo(0, 3);
    item.updateScreenRegion(new Region(0, 4, 4, 1));
    expect(await session.pilot.click("#item")).toBe(true);

    session.unmount();
  });

  it("suppresses mount-time notifications by default", async () => {
    const session = await runTest(<NotificationOnMount message="mount note" />);

    expect(session.app.notifications.length).toBe(0);

    session.unmount();
  });

  it("allows mount-time notifications when transient notifications are enabled", async () => {
    const session = await runTest(<NotificationOnMount message="mount note" />, {
      transients: { notifications: true },
    });

    expect(session.app.notifications.list().map((entry) => entry.message)).toEqual(["mount note"]);

    session.unmount();
  });

  it("propagates compose, pushed-screen, action, worker, and stylesheet failures through the harness", async () => {
    await expect(runTest(<FailingComposeApp />)).rejects.toThrow("compose boom");
    await expect(runTest(<PushBrokenScreenOnMount />)).rejects.toThrow("screen boom");

    const actionSession = await runTest(<FailingActionApp />);
    await expect(actionSession.pilot.press("x")).rejects.toThrow("action boom");
    actionSession.unmount();

    await expect(runTest(<WorkerFailureOnMount />)).rejects.toBeInstanceOf(WorkerFailed);
    await expect(
      runTest(<Text>styles</Text>, {
        appProps: { stylesheet: "Widget { color: $missing; }" },
      }),
    ).rejects.toBeInstanceOf(StylesheetError);
  });

  it("treats the requested runTest size as the initial size authority and updates layout on resize", async () => {
    let widget!: Widget;
    const session = await runTest(
      <ResizeProbe
        onReady={(nextWidget) => {
          widget = nextWidget;
        }}
      />,
      { size: { width: 13, height: 4 } },
    );

    expect(session.app.terminalSize.width).toBe(13);
    expect(session.app.terminalSize.height).toBe(4);
    expect(widget.screenRegion.width).toBe(13);
    expect((session.lastFrame() ?? "").split("\n").length).toBeGreaterThanOrEqual(4);

    await session.pilot.resizeTerminal(17, 6);

    expect(session.app.terminalSize.width).toBe(17);
    expect(session.app.terminalSize.height).toBe(6);
    expect((session.lastFrame() ?? "").split("\n").length).toBeGreaterThanOrEqual(6);

    session.unmount();
  });

  it("uses second-based pause durations", async () => {
    const session = await runTest(<CounterApp />);
    const start = performance.now();

    await session.pilot.pause(0.02);

    expect(performance.now() - start).toBeGreaterThanOrEqual(18);
    session.unmount();
  });

  it("returns hit status consistently across all mouse helpers", async () => {
    function PointerHarness(): React.JSX.Element {
      return (
        <WidgetHost typeName="Parent" id="parent">
          <Box flexDirection="column">
            <WidgetHost typeName="Child" id="child">
              <Box width={6} height={1}>
                <Text>child!</Text>
              </Box>
            </WidgetHost>
            <Box width={6} height={1}>
              <Text>parent</Text>
            </Box>
          </Box>
        </WidgetHost>
      );
    }

    const session = await runTest(<PointerHarness />, {
      size: { width: 10, height: 4 },
    });
    const parent = session.app.getByCssId("parent")!;
    const child = session.app.getByCssId("child")!;
    const obscuringOffset = {
      x: child.screenRegion.x - parent.screenRegion.x,
      y: child.screenRegion.y - parent.screenRegion.y,
    };

    expect(await session.pilot.mouseDown({ widget: "#parent", offset: obscuringOffset })).toBe(false);
    expect(await session.pilot.mouseUp({ widget: "#parent", offset: obscuringOffset })).toBe(false);
    expect(await session.pilot.hover({ widget: "#parent", offset: obscuringOffset })).toBe(false);
    expect(await session.pilot.click({ widget: "#parent", offset: obscuringOffset })).toBe(false);
    expect(await session.pilot.mouseDown({ offset: { x: 0, y: 0 } })).toBe(true);
    expect(await session.pilot.mouseUp({ offset: { x: 0, y: 0 } })).toBe(true);
    expect(await session.pilot.hover({ offset: { x: 0, y: 0 } })).toBe(true);

    session.unmount();
  });

  it("exports camelToSnake for testing helpers", () => {
    expect(camelToSnake("FooBar")).toBe("foo_bar");
  });
});
