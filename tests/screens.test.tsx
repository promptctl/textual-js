import { App } from "../src/index.js";
import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TextualFramework } from "../src/framework/app-framework.js";

import {
  ActiveModeError,
  Color,
  InvalidModeError,
  NoActiveWorker,
  ScreenResume,
  ScreenStackError,
  ScreenSuspend,
  TextualApp,
  UnknownModeError,
  Widget,
  WidgetHost,
  Worker,
} from "../src/index.js";

function DefaultScreen(): React.JSX.Element {
  return (
    <WidgetHost typeName="DefaultScreen" id="default-root">
      <Text>default</Text>
    </WidgetHost>
  );
}

function DialogScreen(): React.JSX.Element {
  return (
    <WidgetHost typeName="DialogScreen" id="dialog-root">
      <Text>dialog</Text>
    </WidgetHost>
  );
}

function ScreenWithCss(): React.JSX.Element {
  return (
    <WidgetHost typeName="ScreenWithCss" id="screen-css-root">
      <WidgetHost typeName="Label" id="screen-css-target">
        <Text>screen css</Text>
      </WidgetHost>
    </WidgetHost>
  );
}

(ScreenWithCss as typeof ScreenWithCss & { CSS?: string }).CSS = `
  #screen-css-target {
    background: red;
  }
`;

let nextDetachedNodeId = 1;

function createDetachedNode(framework: TextualFramework, typeName = "DetachedNode"): Widget {
  const node = new Widget({
    framework,
    nodeId: `detached-node-${nextDetachedNodeId++}`,
    parentId: null,
    classes: [],
    typeName,
    handlersRef: { current: undefined },
    actionsRef: { current: undefined },
    bindingsRef: { current: [] },
    focusable: false,
    autoFocus: false,
    disabled: false,
    loading: false,
  });

  framework.registerWidget(node);
  return node;
}

function createDetachedWorker<TResult>(
  framework: TextualFramework,
  work: () => Promise<TResult> | TResult,
): Worker<TResult> {
  const node = new Widget({
    framework,
    nodeId: `detached-worker-${nextDetachedNodeId++}`,
    parentId: null,
    classes: [],
    typeName: "DetachedWorker",
    handlersRef: { current: undefined },
    actionsRef: { current: undefined },
    bindingsRef: { current: [] },
    focusable: false,
    autoFocus: false,
    disabled: false,
    loading: false,
  });

  return new Worker(
    node,
    async () => work(),
    "detached-worker",
    undefined,
    "detached worker",
    false,
    (targetId, message) => {
      framework.postMessage(targetId, message);
    },
    () => {},
  );
}

async function settleScreen(framework: TextualFramework): Promise<void> {
  await framework.whenIdle();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await framework.whenIdle();
}

describe("screen stack", () => {
  it("exposes the implicit default screen as the initial stack surface", () => {
    const framework = new App().framework;

    expect(framework.getScreenStack().map((screen) => screen.id)).toEqual(["_default"]);
    expect(framework.activeScreen?.id).toBe("_default");
    expect(framework.activeScreenElement).toBeNull();
  });

  it("installs named screens, reuses cached elements, and enforces expected types", () => {
    const framework = new App().framework;

    framework.installScreen("dialog", () => <DialogScreen />);

    expect(framework.isScreenInstalled("dialog")).toBe(true);

    const installed = framework.getScreen("dialog");
    expect(installed.type).toBe(DialogScreen);
    expect(framework.getScreen("dialog")).toBe(installed);
    expect(framework.getScreen("dialog", DialogScreen)).toBe(installed);
    expect(() => framework.getScreen("dialog", DefaultScreen)).toThrow(TypeError);

    framework.uninstallScreen("dialog");
    expect(framework.isScreenInstalled("dialog")).toBe(false);
  });

  it("renders pushed screens instead of the default children and emits suspend/resume messages", async () => {
    const framework = new App().framework;
    const events: string[] = [];

    const unsubscribe = framework.subscribeToMessages((message) => {
      if (message instanceof ScreenResume) {
        events.push(`resume:${message.screenName ?? "default"}`);
      } else if (message instanceof ScreenSuspend) {
        events.push(`suspend:${message.screenName ?? "default"}`);
      }
    });

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    expect(instance.lastFrame()).toContain("default");

    framework.pushScreen(<DialogScreen />, { name: "dialog" });
    await settleScreen(framework);

    expect(instance.lastFrame()).toContain("dialog");
    expect(instance.lastFrame()).not.toContain("default");
    expect(events).toContain("resume:dialog");

    framework.popScreen();
    await settleScreen(framework);

    expect(instance.lastFrame()).toContain("default");
    expect(events.filter((entry) => entry === "suspend:dialog")).toHaveLength(1);

    unsubscribe();
    instance.unmount();
    instance.cleanup();
  });

  it("refuses to pop the last screen", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    expect(() => framework.popScreen()).toThrow(ScreenStackError);

    instance.unmount();
    instance.cleanup();
  });

  it("delivers push results to the supplied callback when popped", async () => {
    const framework = new App().framework;
    const results: unknown[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    framework.pushScreen(<DialogScreen />, (result) => {
      results.push(result);
    });

    framework.popScreen("confirmed");
    await framework.whenIdle();

    expect(results).toEqual(["confirmed"]);

    instance.unmount();
    instance.cleanup();
  });

  it("stores the covered screen's savedFocusNodeId snapshot when another screen is pushed", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp framework={framework}>
        <>
          <WidgetHost typeName="Label" id="default-first" focusable>
            <Text>first</Text>
          </WidgetHost>
          <WidgetHost typeName="Label" id="default-second" focusable>
            <Text>second</Text>
          </WidgetHost>
        </>
      </TextualApp>,
    );

    await settleScreen(framework);

    const defaultSecond = framework.registry.getByCssId("default-second")!;
    framework.focusWidget(defaultSecond.nodeId);
    await settleScreen(framework);

    const covered = framework.activeScreen!;
    framework.pushScreen(<DialogScreen />, { name: "dialog" });
    await settleScreen(framework);

    expect(covered.savedFocusNodeId).toBe(defaultSecond.nodeId);

    instance.unmount();
    instance.cleanup();
  });

  it("reuses the same installed screen element across repeated pushes by name", async () => {
    const framework = new App().framework;
    framework.installScreen("dialog", () => <DialogScreen />);

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    const first = framework.pushScreen("dialog", { name: "dialog" });
    await settleScreen(framework);
    framework.popScreen();
    await settleScreen(framework);

    const second = framework.pushScreen("dialog", { name: "dialog" });
    await settleScreen(framework);

    expect(first.element).toBe(second.element);

    instance.unmount();
    instance.cleanup();
  });

  it("supports pushScreenWait inside a worker and rejects it outside one", async () => {
    const framework = new App().framework;
    framework.installScreen("dialog", () => <DialogScreen />);

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    expect(() => framework.pushScreenWait("dialog")).toThrow(NoActiveWorker);

    const worker = createDetachedWorker(framework, async () => framework.pushScreenWait("dialog"));
    const waiting = worker.start();
    await settleScreen(framework);

    framework.dismissScreen("done");
    await settleScreen(framework);

    await expect(waiting).resolves.toBe("done");

    instance.unmount();
    instance.cleanup();
  });

  it("loads static screen CSS and CSS_PATH with precedence over app CSS", async () => {
    const framework = new App().framework;
    const tempDir = mkdtempSync(join(tmpdir(), "textual-js-screen-css-"));
    const cssPath = join(tempDir, "screen.tcss");
    writeFileSync(cssPath, "#screen-css-target { color: white; }");
    (ScreenWithCss as typeof ScreenWithCss & { CSS_PATH?: string | readonly string[] }).CSS_PATH = cssPath;

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          #screen-css-target {
            background: green;
            color: blue;
          }
        `}
      >
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();
    framework.pushScreen(<ScreenWithCss />, { name: "css-screen" });
    await settleScreen(framework);

    const target = framework.registry.getByCssId("screen-css-target")!;
    expect(target.resolvedStyles.getRule("background")).toEqual(Color.parse("red"));
    expect(target.resolvedStyles.getRule("color")).toEqual(Color.parse("white"));

    framework.popScreen();
    await settleScreen(framework);

    expect(
      framework.getActiveStylesheetsFor("Label").some((stylesheet) => stylesheet.source.includes("#screen-css-target")),
    ).toBe(true);

    instance.unmount();
    instance.cleanup();
  });

  it("runs built-in dismiss actions and resolves callbacks and waiters exactly once", async () => {
    const framework = new App().framework;
    framework.installScreen("dialog", () => <DialogScreen />);
    const callbackResults: unknown[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    framework.pushScreen("dialog", (result) => {
      callbackResults.push(result);
    });
    await settleScreen(framework);

    expect(framework.runAction("screen.dismiss(true)")).toBe(true);
    await settleScreen(framework);

    expect(callbackResults).toEqual([true]);

    const worker = createDetachedWorker(framework, async () => framework.pushScreenWait("dialog"));
    const waiting = worker.start();
    await settleScreen(framework);

    expect(framework.runAction("screen.dismiss('again')")).toBe(true);
    await settleScreen(framework);

    await expect(waiting).resolves.toBe("again");

    instance.unmount();
    instance.cleanup();
  });

  it("switchScreen replaces the top of the stack without changing depth", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    framework.pushScreen(<DialogScreen />, { name: "one" });
    await framework.whenIdle();

    expect(framework.screenStackDepth).toBe(1);

    framework.switchScreen(<DialogScreen />, { name: "two" });
    await settleScreen(framework);

    expect(framework.screenStackDepth).toBe(1);
    expect(framework.activeScreen?.name).toBe("two");

    instance.unmount();
    instance.cleanup();
  });
});

describe("screen modes", () => {
  it("maintains independent screen stacks per mode", async () => {
    const framework = new App().framework;
    framework.addMode("secondary", () => <DialogScreen />);

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    framework.pushScreen(<DialogScreen />, { name: "default-dialog" });
    await settleScreen(framework);

    expect(framework.screenStackDepth).toBe(1);
    expect(framework.activeScreen?.name).toBe("default-dialog");

    framework.switchMode("secondary");
    await settleScreen(framework);

    expect(framework.activeMode).toBe("secondary");
    expect(framework.screenStackDepth).toBe(1);
    expect(framework.activeScreen?.name).toBeNull();

    framework.switchMode("_default");
    await settleScreen(framework);

    expect(framework.activeMode).toBe("_default");
    expect(framework.activeScreen?.name).toBe("default-dialog");

    instance.unmount();
    instance.cleanup();
  });

  it("publishes mode names and active screen entries through app-level signals", async () => {
    const framework = new App().framework;
    framework.addMode("secondary", () => <DialogScreen />);
    const subscriber = createDetachedNode(framework, "SignalSubscriber");
    const modes: string[] = [];
    const screens: Array<TextualFramework["activeScreen"]> = [];

    framework.startup();
    const unsubscribeMode = framework.signals.mode_change_signal.subscribe(subscriber, (mode) => {
      modes.push(mode);
    });
    const unsubscribeScreen = framework.signals.screen_change_signal.subscribe(subscriber, (screen) => {
      screens.push(screen);
    });

    framework.pushScreen(<DialogScreen />, { name: "dialog" });
    framework.switchMode("secondary");
    await framework.whenIdle();

    expect(modes).toEqual(["secondary"]);
    expect(screens.map((screen) => screen?.name ?? null)).toEqual(["dialog", null]);
    expect(screens[0]).toEqual(expect.objectContaining({ name: "dialog" }));

    unsubscribeMode();
    unsubscribeScreen();
    framework.shutdown();
  });

  it("rejects unknown modes, duplicate modes, and removal of the active mode", () => {
    const framework = new App().framework;

    expect(() => framework.switchMode("ghost")).toThrow(UnknownModeError);

    framework.addMode("alpha", () => <DialogScreen />);
    expect(() => framework.addMode("alpha", () => <DialogScreen />)).toThrow(InvalidModeError);

    framework.switchMode("alpha");
    expect(() => framework.removeMode("alpha")).toThrow(ActiveModeError);

    framework.switchMode("_default");
    framework.removeMode("alpha");
    expect(() => framework.switchMode("alpha")).toThrow(UnknownModeError);
  });
});
