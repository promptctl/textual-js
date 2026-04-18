import React, { useLayoutEffect, useState } from "react";
import { Text } from "ink";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";

import {
  Click,
  AppBlur,
  AppFocus,
  Message,
  normalizeColor,
  runTest,
  TextualApp,
  TextualFramework,
  WidgetHost,
  useTextual,
} from "../src/index.js";

class Ping extends Message {}

function AppDispatcher(props: { onReady: (framework: TextualFramework) => void }): null {
  const framework = useTextual();

  useLayoutEffect(() => {
    props.onReady(framework);
  }, [framework, props]);

  return null;
}

function BlurHarness(props: { onToggleReady?: (setVisible: (visible: boolean) => void) => void }): React.JSX.Element {
  const [showFirst, setShowFirst] = useState(true);

  useLayoutEffect(() => {
    props.onToggleReady?.((visible) => {
      setShowFirst(visible);
    });
  }, [props]);

  return (
    <>
      {showFirst ? (
        <WidgetHost typeName="Label" id="focus-a" focusable>
          <Text>a</Text>
        </WidgetHost>
      ) : null}
      <WidgetHost typeName="Label" id="focus-b" focusable>
        <Text>b</Text>
      </WidgetHost>
    </>
  );
}

async function settleApp(framework: TextualFramework): Promise<void> {
  await framework.whenIdle();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await framework.whenIdle();
}

describe("TextualApp and widget registry", () => {
  it("renders inside ink-testing-library and exposes framework services", async () => {
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost typeName="Label" id="greeting">
          <Text>Hello</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    expect(instance.lastFrame()).toContain("Hello");
    expect(framework.isRunning).toBe(true);
    expect(framework.registry.version).toBe(1);
    expect(framework.registry.getByCssId("greeting")?.typeName).toBe("Label");

    instance.unmount();
    instance.cleanup();
  });

  it("registers on mount and deregisters on unmount", async () => {
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost typeName="Widget">
          <Text>Mounted</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    expect(framework.registry.list()).toHaveLength(1);
    expect(framework.registry.version).toBe(1);

    instance.unmount();
    instance.cleanup();

    expect(framework.registry.list()).toHaveLength(0);
    expect(framework.registry.version).toBe(2);
    expect(framework.isRunning).toBe(false);
  });

  it("accepts app-level css through the stage-0 startup surface", async () => {
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp
        framework={framework}
        css={`
          Label {
            color: red;
          }
        `}
      >
        <WidgetHost typeName="Label" id="styled-label">
          <Text>Hello</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    expect(framework.registry.getByCssId("styled-label")?.resolvedStyles.getRule("color")).toBe(normalizeColor("red"));

    instance.unmount();
    instance.cleanup();
  });

  it("exposes an app-level dispatch surface through TextualApp context", async () => {
    const framework = new TextualFramework();
    let appContext!: TextualFramework;
    const senders: unknown[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <AppDispatcher
          onReady={(value) => {
            appContext = value;
          }}
        />
        <WidgetHost
          typeName="Leaf"
          id="leaf"
          focusable
          autoFocus
          handlers={{
            onPing: (message) => {
              senders.push(message.sender);
            },
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    appContext.dispatchMessage(new Ping());
    await framework.whenIdle();

    expect(senders).toEqual([null]);

    instance.unmount();
    instance.cleanup();
  });

  it("clears focus on app blur and restores it on app focus", async () => {
    const framework = new TextualFramework();
    const events: string[] = [];

    const unsubscribe = framework.subscribeToMessages((message) => {
      if (message instanceof AppBlur) {
        events.push("blur");
      } else if (message instanceof AppFocus) {
        events.push("focus");
      }
    });

    const instance = render(
      <TextualApp framework={framework} autoFocus="#focus-a">
        <BlurHarness />
      </TextualApp>,
    );

    await settleApp(framework);
    expect(framework.focusedNodeId).toBe(framework.registry.getByCssId("focus-a")!.nodeId);

    framework.handleAppBlur();
    await settleApp(framework);
    expect(framework.focusedNodeId).toBeNull();

    framework.handleAppFocus();
    await settleApp(framework);
    expect(framework.focusedNodeId).toBe(framework.registry.getByCssId("focus-a")!.nodeId);
    expect(events).toEqual(["blur", "focus"]);

    unsubscribe();
    instance.unmount();
    instance.cleanup();
  });

  it("leaves focus cleared when the blurred widget is removed before app focus returns", async () => {
    const framework = new TextualFramework();
    let setVisible!: (visible: boolean) => void;

    const instance = render(
      <TextualApp framework={framework} autoFocus="#focus-a">
        <BlurHarness
          onToggleReady={(callback) => {
            setVisible = callback;
          }}
        />
      </TextualApp>,
    );

    await settleApp(framework);

    framework.handleAppBlur();
    await settleApp(framework);

    setVisible(false);
    await settleApp(framework);

    framework.handleAppFocus();
    await settleApp(framework);

    expect(framework.focusedNodeId).toBeNull();

    instance.unmount();
    instance.cleanup();
  });

  it("preserves explicit focus changes made while the app is blurred", async () => {
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp framework={framework} autoFocus="#focus-a">
        <BlurHarness />
      </TextualApp>,
    );

    await settleApp(framework);

    framework.handleAppBlur();
    await settleApp(framework);

    framework.focusWidget(framework.registry.getByCssId("focus-b")!.nodeId);
    await settleApp(framework);

    framework.handleAppFocus();
    await settleApp(framework);

    expect(framework.focusedNodeId).toBe(framework.registry.getByCssId("focus-b")!.nodeId);

    instance.unmount();
    instance.cleanup();
  });

  it("derives click chains from the framework mouse down/up path", async () => {
    vi.useFakeTimers();

    try {
      const received: string[] = [];
      const session = await runTest(
        <>
          <WidgetHost
            typeName="ClickTarget"
            id="first"
            handlers={{
              onClick: (message) => {
                received.push(`first:${(message as Click).chain}`);
              },
            }}
          >
            <Text>first</Text>
          </WidgetHost>
          <WidgetHost
            typeName="ClickTarget"
            id="second"
            handlers={{
              onClick: (message) => {
                received.push(`second:${(message as Click).chain}`);
              },
            }}
          >
            <Text>second</Text>
          </WidgetHost>
        </>,
      );

      const first = session.framework.registry.getByCssId("first")!;
      const second = session.framework.registry.getByCssId("second")!;

      session.framework.dispatchPointerDown(first.screenRegion.x, first.screenRegion.y);
      session.framework.dispatchPointerUp(first.screenRegion.x, first.screenRegion.y);
      await session.framework.whenIdle();

      session.framework.dispatchPointerDown(first.screenRegion.x, first.screenRegion.y);
      session.framework.dispatchPointerUp(first.screenRegion.x, first.screenRegion.y);
      await session.framework.whenIdle();

      session.framework.dispatchPointerDown(second.screenRegion.x, second.screenRegion.y);
      session.framework.dispatchPointerUp(second.screenRegion.x, second.screenRegion.y);
      await session.framework.whenIdle();

      vi.advanceTimersByTime(Math.ceil(TextualFramework.CLICK_CHAIN_TIME_THRESHOLD * 1000) + 1);
      session.framework.dispatchPointerDown(second.screenRegion.x, second.screenRegion.y);
      session.framework.dispatchPointerUp(second.screenRegion.x, second.screenRegion.y);
      await session.framework.whenIdle();

      expect(received).toEqual(["first:1", "first:2", "second:1", "second:1"]);

      session.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels click synthesis after the pointer leaves the pressed widget", async () => {
    const received: string[] = [];
    const session = await runTest(
      <>
        <WidgetHost
          typeName="ClickTarget"
          id="first"
          handlers={{
            onClick: () => {
              received.push("first");
            },
          }}
        >
          <Text>first</Text>
        </WidgetHost>
        <WidgetHost typeName="ClickTarget" id="second">
          <Text>second</Text>
        </WidgetHost>
      </>,
    );

    const first = session.framework.registry.getByCssId("first")!;
    const second = session.framework.registry.getByCssId("second")!;

    session.framework.dispatchPointerDown(first.screenRegion.x, first.screenRegion.y);
    session.framework.dispatchPointerMove(second.screenRegion.x, second.screenRegion.y);
    session.framework.dispatchPointerUp(first.screenRegion.x, first.screenRegion.y);
    await session.framework.whenIdle();

    expect(received).toEqual([]);

    session.unmount();
  });
});
