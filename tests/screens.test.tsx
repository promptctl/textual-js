import { App } from "../src/index.js";
import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

function createDetachedNode(framework: App["framework"], typeName = "DetachedNode"): Widget {
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
  framework: App["framework"],
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

async function settleScreen(app: App): Promise<void> {
  await app.whenIdle();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await app.whenIdle();
}

describe("screen stack", () => {
  it("exposes the implicit default screen as the initial stack surface", () => {
    const app = new App();
    const framework = app.framework;

    expect(app.getScreenStack().map((screen) => screen.id)).toEqual(["_default"]);
    expect(app.screen?.id).toBe("_default");
    expect(framework.activeScreenElement).toBeNull();
  });

  it("installs named screens, reuses cached elements, and enforces expected types", () => {
    const app = new App();
    const framework = app.framework;

    framework.installScreen("dialog", () => <DialogScreen />);

    expect(app.isScreenInstalled("dialog")).toBe(true);

    const installed = app.getScreen("dialog");
    expect(installed.type).toBe(DialogScreen);
    expect(app.getScreen("dialog")).toBe(installed);
    expect(app.getScreen("dialog", DialogScreen)).toBe(installed);
    expect(() => app.getScreen("dialog", DefaultScreen)).toThrow(TypeError);

    app.uninstallScreen("dialog");
    expect(app.isScreenInstalled("dialog")).toBe(false);
  });

  it("renders pushed screens instead of the default children and emits suspend/resume messages", async () => {
    const app = new App();
    const framework = app.framework;
    const events: string[] = [];

    const unsubscribe = app.subscribeToMessages((message) => {
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

    await app.whenIdle();

    expect(instance.lastFrame()).toContain("default");

    app.pushScreen(<DialogScreen />, { name: "dialog" });
    await settleScreen(app);

    expect(instance.lastFrame()).toContain("dialog");
    expect(instance.lastFrame()).not.toContain("default");
    expect(events).toContain("resume:dialog");

    app.popScreen();
    await settleScreen(app);

    expect(instance.lastFrame()).toContain("default");
    expect(events.filter((entry) => entry === "suspend:dialog")).toHaveLength(1);

    unsubscribe();
    instance.unmount();
    instance.cleanup();
  });

  it("refuses to pop the last screen", async () => {
    const app = new App();
    const framework = app.framework;

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await app.whenIdle();

    expect(() => app.popScreen()).toThrow(ScreenStackError);

    instance.unmount();
    instance.cleanup();
  });

  it("delivers push results to the supplied callback when popped", async () => {
    const app = new App();
    const framework = app.framework;
    const results: unknown[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await app.whenIdle();

    app.pushScreen(<DialogScreen />, (result) => {
      results.push(result);
    });

    app.popScreen("confirmed");
    await app.whenIdle();

    expect(results).toEqual(["confirmed"]);

    instance.unmount();
    instance.cleanup();
  });

  it("stores the covered screen's savedFocusNodeId snapshot when another screen is pushed", async () => {
    const app = new App();
    const framework = app.framework;

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

    await settleScreen(app);

    const defaultSecond = framework.registry.getByCssId("default-second")!;
    framework.focusWidget(defaultSecond.nodeId);
    await settleScreen(app);

    const covered = app.screen!;
    app.pushScreen(<DialogScreen />, { name: "dialog" });
    await settleScreen(app);

    expect(covered.savedFocusNodeId).toBe(defaultSecond.nodeId);

    instance.unmount();
    instance.cleanup();
  });

  it("reuses the same installed screen element across repeated pushes by name", async () => {
    const app = new App();
    const framework = app.framework;
    framework.installScreen("dialog", () => <DialogScreen />);

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await app.whenIdle();

    const first = app.pushScreen("dialog", { name: "dialog" });
    await settleScreen(app);
    app.popScreen();
    await settleScreen(app);

    const second = app.pushScreen("dialog", { name: "dialog" });
    await settleScreen(app);

    expect(first.element).toBe(second.element);

    instance.unmount();
    instance.cleanup();
  });

  it("supports pushScreenWait inside a worker and rejects it outside one", async () => {
    const app = new App();
    const framework = app.framework;
    framework.installScreen("dialog", () => <DialogScreen />);

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await app.whenIdle();

    expect(() => app.pushScreenWait("dialog")).toThrow(NoActiveWorker);

    const worker = createDetachedWorker(framework, async () => app.pushScreenWait("dialog"));
    const waiting = worker.start();
    await settleScreen(app);

    framework.dismissScreen("done");
    await settleScreen(app);

    await expect(waiting).resolves.toBe("done");

    instance.unmount();
    instance.cleanup();
  });

  it("loads static screen CSS and CSS_PATH with precedence over app CSS", async () => {
    const app = new App();
    const framework = app.framework;
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

    await app.whenIdle();
    app.pushScreen(<ScreenWithCss />, { name: "css-screen" });
    await settleScreen(app);

    const target = framework.registry.getByCssId("screen-css-target")!;
    expect(target.resolvedStyles.getRule("background")).toEqual(Color.parse("red"));
    expect(target.resolvedStyles.getRule("color")).toEqual(Color.parse("white"));

    app.popScreen();
    await settleScreen(app);

    expect(
      framework.getActiveStylesheetsFor("Label").some((stylesheet) => stylesheet.source.includes("#screen-css-target")),
    ).toBe(true);

    instance.unmount();
    instance.cleanup();
  });

  it("runs built-in dismiss actions and resolves callbacks and waiters exactly once", async () => {
    const app = new App();
    const framework = app.framework;
    framework.installScreen("dialog", () => <DialogScreen />);
    const callbackResults: unknown[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await app.whenIdle();

    app.pushScreen("dialog", (result) => {
      callbackResults.push(result);
    });
    await settleScreen(app);

    expect(app.runAction("screen.dismiss(true)")).toBe(true);
    await settleScreen(app);

    expect(callbackResults).toEqual([true]);

    const worker = createDetachedWorker(framework, async () => app.pushScreenWait("dialog"));
    const waiting = worker.start();
    await settleScreen(app);

    expect(app.runAction("screen.dismiss('again')")).toBe(true);
    await settleScreen(app);

    await expect(waiting).resolves.toBe("again");

    instance.unmount();
    instance.cleanup();
  });

  it("switchScreen replaces the top of the stack without changing depth", async () => {
    const app = new App();
    const framework = app.framework;

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await app.whenIdle();

    app.pushScreen(<DialogScreen />, { name: "one" });
    await app.whenIdle();

    expect(app.screenStackDepth).toBe(1);

    app.switchScreen(<DialogScreen />, { name: "two" });
    await settleScreen(app);

    expect(app.screenStackDepth).toBe(1);
    expect(app.screen?.name).toBe("two");

    instance.unmount();
    instance.cleanup();
  });
});

describe("screen modes", () => {
  it("maintains independent screen stacks per mode", async () => {
    const app = new App();
    const framework = app.framework;
    app.addMode("secondary", () => <DialogScreen />);

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await app.whenIdle();

    app.pushScreen(<DialogScreen />, { name: "default-dialog" });
    await settleScreen(app);

    expect(app.screenStackDepth).toBe(1);
    expect(app.screen?.name).toBe("default-dialog");

    app.switchMode("secondary");
    await settleScreen(app);

    expect(app.activeMode).toBe("secondary");
    expect(app.screenStackDepth).toBe(1);
    expect(app.screen?.name).toBeNull();

    app.switchMode("_default");
    await settleScreen(app);

    expect(app.activeMode).toBe("_default");
    expect(app.screen?.name).toBe("default-dialog");

    instance.unmount();
    instance.cleanup();
  });

  it("publishes mode names and active screen entries through app-level signals", async () => {
    const app = new App();
    const framework = app.framework;
    app.addMode("secondary", () => <DialogScreen />);
    const subscriber = createDetachedNode(framework, "SignalSubscriber");
    const modes: string[] = [];
    const screens: Array<App["framework"]["activeScreen"]> = [];

    framework.startup();
    const unsubscribeMode = app.signals.mode_change_signal.subscribe(subscriber, (mode) => {
      modes.push(mode);
    });
    const unsubscribeScreen = app.signals.screen_change_signal.subscribe(subscriber, (screen) => {
      screens.push(screen);
    });

    app.pushScreen(<DialogScreen />, { name: "dialog" });
    app.switchMode("secondary");
    await app.whenIdle();

    expect(modes).toEqual(["secondary"]);
    expect(screens.map((screen) => screen?.name ?? null)).toEqual(["dialog", null]);
    expect(screens[0]).toEqual(expect.objectContaining({ name: "dialog" }));

    unsubscribeMode();
    unsubscribeScreen();
    framework.shutdown();
  });

  it("rejects unknown modes, duplicate modes, and removal of the active mode", () => {
    const app = new App();
    const framework = app.framework;

    expect(() => app.switchMode("ghost")).toThrow(UnknownModeError);

    app.addMode("alpha", () => <DialogScreen />);
    expect(() => app.addMode("alpha", () => <DialogScreen />)).toThrow(InvalidModeError);

    app.switchMode("alpha");
    expect(() => app.removeMode("alpha")).toThrow(ActiveModeError);

    app.switchMode("_default");
    app.removeMode("alpha");
    expect(() => app.switchMode("alpha")).toThrow(UnknownModeError);
  });
});
