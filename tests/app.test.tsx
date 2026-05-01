import React, { useLayoutEffect, useState } from "react";
import { Text } from "ink";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import {
  App,
  Click,
  AppBlur,
  AppFocus,
  Color,
  Message,
  Region,
  SuspendNotSupported,
  WorkerCancelled,
  _get_environ_bool,
  _get_environ_int,
  _get_environ_port,
  runTest,
  TextualApp,
  type AppDriver,
  type AnsiTheme,
  WidgetHost,
  Widget,
  WidgetScope,
  useTextual,
  useWidget,
} from "../src/index.js";

class Ping extends Message {}

function AppDispatcher(props: { onReady: (app: App) => void }): null {
  const app = useTextual();

  useLayoutEffect(() => {
    props.onReady(app);
  }, [app, props]);

  return null;
}

function AppServiceHarness(props: { onReady: (app: App, widget: Widget) => void }): React.JSX.Element {
  const app = useTextual();
  const widget = useWidget({
    id: "app-service-harness",
    typeName: "AppServiceHarness",
  });

  useLayoutEffect(() => {
    props.onReady(app, widget.handle);
  }, [app, props, widget.handle]);

  return (
    <WidgetScope widget={widget.handle}>
      <Text>services</Text>
    </WidgetScope>
  );
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

async function settleApp(app: App): Promise<void> {
  await app.whenIdle();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await app.whenIdle();
}

function createDetachedWidget(app: App, options: Partial<ConstructorParameters<typeof Widget>[0]> = {}): Widget {
  return new Widget({
    app,
    nodeId: options.nodeId ?? `widget-${Math.random()}`,
    parentId: options.parentId ?? null,
    id: options.id,
    classes: options.classes ?? [],
    typeName: options.typeName ?? "DetachedWidget",
    handlersRef: options.handlersRef ?? { current: undefined },
    actionsRef: options.actionsRef ?? { current: undefined },
    bindingsRef: options.bindingsRef ?? { current: [] },
    focusable: options.focusable ?? false,
    autoFocus: options.autoFocus ?? false,
    disabled: options.disabled ?? false,
    loading: options.loading ?? false,
    tooltip: options.tooltip ?? null,
  });
}

describe("TextualApp and widget registry", () => {
  it("renders inside ink-testing-library and exposes framework services", async () => {
    const app = new App();

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost typeName="Label" id="greeting">
          <Text>Hello</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    expect(instance.lastFrame()).toContain("Hello");
    expect(app.isRunning).toBe(true);
    expect(app.registry.version).toBe(1);
    expect(app.getByCssId("greeting")?.typeName).toBe("Label");

    instance.unmount();
    instance.cleanup();
  });

  it("registers on mount and deregisters on unmount", async () => {
    const app = new App();

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost typeName="Widget">
          <Text>Mounted</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    expect(app.registry.list()).toHaveLength(1);
    expect(app.registry.version).toBe(1);

    instance.unmount();
    instance.cleanup();

    expect(app.registry.list()).toHaveLength(0);
    expect(app.registry.version).toBe(2);
    expect(app.isRunning).toBe(false);
  });

  it("accepts app-level css through the stage-0 startup surface", async () => {
    const app = new App();

    const instance = render(
      <TextualApp
        app={app}
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

    await app.whenIdle();

    expect(app.getByCssId("styled-label")?.resolvedStyles.getRule("color")).toEqual(Color.parse("red"));

    instance.unmount();
    instance.cleanup();
  });

  it("exposes an app-level dispatch surface through TextualApp context", async () => {
    const app = new App();
    let appContext!: App;
    const senders: unknown[] = [];

    const instance = render(
      <TextualApp app={app}>
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

    await app.whenIdle();

    appContext.dispatchMessage(new Ping());
    await app.whenIdle();

    expect(senders).toEqual([null]);

    instance.unmount();
    instance.cleanup();
  });

  it("clears focus on app blur and restores it on app focus", async () => {
    const app = new App();
    const events: string[] = [];

    const unsubscribe = app.subscribeToMessages((message) => {
      if (message instanceof AppBlur) {
        events.push("blur");
      } else if (message instanceof AppFocus) {
        events.push("focus");
      }
    });

    const instance = render(
      <TextualApp app={app} autoFocus="#focus-a">
        <BlurHarness />
      </TextualApp>,
    );

    await settleApp(app);
    expect(app.focusedNodeId).toBe(app.getByCssId("focus-a")!.nodeId);

    app.handleAppBlur();
    await settleApp(app);
    expect(app.focusedNodeId).toBeNull();

    app.handleAppFocus();
    await settleApp(app);
    expect(app.focusedNodeId).toBe(app.getByCssId("focus-a")!.nodeId);
    expect(events).toEqual(["blur", "focus"]);

    unsubscribe();
    instance.unmount();
    instance.cleanup();
  });

  it("leaves focus cleared when the blurred widget is removed before app focus returns", async () => {
    const app = new App();
    let setVisible!: (visible: boolean) => void;

    const instance = render(
      <TextualApp app={app} autoFocus="#focus-a">
        <BlurHarness
          onToggleReady={(callback) => {
            setVisible = callback;
          }}
        />
      </TextualApp>,
    );

    await settleApp(app);

    app.handleAppBlur();
    await settleApp(app);

    setVisible(false);
    await settleApp(app);

    app.handleAppFocus();
    await settleApp(app);

    expect(app.focusedNodeId).toBeNull();

    instance.unmount();
    instance.cleanup();
  });

  it("allows loading before mount and exposes the loading cover after registration", () => {
    const app = new App();
    const widget = createDetachedWidget(app, { id: "loading-before-mount" });

    expect(() => {
      widget.setLoading(true);
    }).not.toThrow();

    app.registerWidget(widget);

    expect(widget.loading).toBe(true);
    expect(widget.hasClass("-loading")).toBe(true);
    expect(widget._cover_widget).not.toBeNull();
  });

  it("disables scrollbar availability when loading is true", () => {
    const app = new App();
    const widget = createDetachedWidget(app, { id: "scroll-shell" });
    app.registerWidget(widget);

    widget.updateScreenRegion(new Region(0, 0, 8, 3));
    widget.setVirtualSize(20, 10);

    expect(widget.showVerticalScrollbar).toBe(true);
    expect(widget.showHorizontalScrollbar).toBe(true);
    expect(widget.allowVerticalScroll).toBe(true);
    expect(widget.allowHorizontalScroll).toBe(true);

    widget.setLoading(true);

    expect(widget.showVerticalScrollbar).toBe(true);
    expect(widget.showHorizontalScrollbar).toBe(true);
    expect(widget.allowVerticalScroll).toBe(false);
    expect(widget.allowHorizontalScroll).toBe(false);
  });

  it("does not render widget children until the mount lifecycle has completed", async () => {
    const app = new App();
    const events: string[] = [];
    let resolveMount!: () => void;
    const mountGate = new Promise<void>((resolve) => {
      resolveMount = resolve;
    });

    function DelayedMountHarness(): React.JSX.Element {
      return (
        <WidgetHost
          typeName="DelayedMountHarness"
          handlers={{
            onMount: async () => {
              events.push("mount:start");
              await mountGate;
              events.push("mount:end");
            },
          }}
        >
          <RenderProbe events={events} />
        </WidgetHost>
      );
    }

    function RenderProbe(props: { events: string[] }): React.JSX.Element {
      props.events.push("child:render");
      return <Text>ready</Text>;
    }

    const instance = render(
      <TextualApp app={app}>
        <DelayedMountHarness />
      </TextualApp>,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).toEqual(["mount:start"]);
    expect(instance.lastFrame()).not.toContain("ready");

    resolveMount();
    await settleApp(app);

    expect(events).toEqual(["mount:start", "mount:end", "child:render"]);
    expect(instance.lastFrame()).toContain("ready");

    instance.unmount();
    instance.cleanup();
  });

  it("shuts down without deadlocking during teardown with live workers, timers, and nested widgets", async () => {
    const app = new App();

    function TeardownHarness(): React.JSX.Element {
      return (
        <WidgetHost typeName="Outer" id="outer">
          <WidgetHost
            typeName="Inner"
            id="inner"
            handlers={{
              onMount: (message) => {
                const widget = message.sender as Widget;
                const signal = widget.createSignal<string>("teardown");
                signal.subscribe(widget, () => undefined, true);
                widget.setInterval("heartbeat", 60_000, () => undefined);
                widget.runWorker(async (abortSignal) => {
                  await new Promise<void>((_resolve, reject) => {
                    abortSignal.addEventListener("abort", () => {
                      reject(new WorkerCancelled("cancelled"));
                    });
                  });
                }, { name: "teardown-worker" });
              },
            }}
          >
            <Text>busy</Text>
          </WidgetHost>
        </WidgetHost>
      );
    }

    const instance = render(
      <TextualApp app={app}>
        <TeardownHarness />
      </TextualApp>,
    );

    await settleApp(app);

    app.shutdown();
    instance.unmount();
    instance.cleanup();

    await Promise.race([
      app.whenIdle(),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => {
          reject(new Error("shutdown deadlocked"));
        }, 100);
      }),
    ]);

    expect(app.isRunning).toBe(false);
  });

  it("preserves explicit focus changes made while the app is blurred", async () => {
    const app = new App();

    const instance = render(
      <TextualApp app={app} autoFocus="#focus-a">
        <BlurHarness />
      </TextualApp>,
    );

    await settleApp(app);

    app.handleAppBlur();
    await settleApp(app);

    app.focusWidget(app.getByCssId("focus-b")!.nodeId);
    await settleApp(app);

    app.handleAppFocus();
    await settleApp(app);

    expect(app.focusedNodeId).toBe(app.getByCssId("focus-b")!.nodeId);

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

      const first = session.app.getByCssId("first")!;
      const second = session.app.getByCssId("second")!;

      session.app.dispatchPointerDown(first.screenRegion.x, first.screenRegion.y);
      session.app.dispatchPointerUp(first.screenRegion.x, first.screenRegion.y);
      await session.app.whenIdle();

      session.app.dispatchPointerDown(first.screenRegion.x, first.screenRegion.y);
      session.app.dispatchPointerUp(first.screenRegion.x, first.screenRegion.y);
      await session.app.whenIdle();

      session.app.dispatchPointerDown(second.screenRegion.x, second.screenRegion.y);
      session.app.dispatchPointerUp(second.screenRegion.x, second.screenRegion.y);
      await session.app.whenIdle();

      vi.advanceTimersByTime(Math.ceil(App.CLICK_CHAIN_TIME_THRESHOLD * 1000) + 1);
      session.app.dispatchPointerDown(second.screenRegion.x, second.screenRegion.y);
      session.app.dispatchPointerUp(second.screenRegion.x, second.screenRegion.y);
      await session.app.whenIdle();

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

    const first = session.app.getByCssId("first")!;
    const second = session.app.getByCssId("second")!;

    session.app.dispatchPointerDown(first.screenRegion.x, first.screenRegion.y);
    session.app.dispatchPointerMove(second.screenRegion.x, second.screenRegion.y);
    session.app.dispatchPointerUp(first.screenRegion.x, first.screenRegion.y);
    await session.app.whenIdle();

    expect(received).toEqual([]);

    session.unmount();
  });

  it("selects ANSI themes from dark/light mode and publishes app theme changes", async () => {
    const app = new App();
    let widget!: Widget;
    const observedThemes: string[] = [];
    const customDark: AnsiTheme = { name: "custom-dark", colors: Array.from({ length: 16 }, () => "#111111") };
    const customLight: AnsiTheme = { name: "custom-light", colors: Array.from({ length: 16 }, () => "#eeeeee") };

    const instance = render(
      <TextualApp app={app}>
        <AppServiceHarness
          onReady={(_app, value) => {
            widget = value;
          }}
        />
      </TextualApp>,
    );

    await app.whenIdle();

    const unsubscribe = app.signals.theme_changed_signal.subscribe(widget, (theme) => {
      observedThemes.push(theme.name);
    });

    app.ansi_theme_dark = customDark;
    app.ansi_theme_light = customLight;

    expect(app.ansi_theme).toBe(customLight);

    app.setTheme("textual-dark");
    await app.whenIdle();
    expect(app.ansi_theme).toBe(customDark);

    app.ansi_theme_light = customLight;
    expect(app.ansi_theme).toBe(customDark);

    app.dark = false;
    await app.whenIdle();

    expect(app.theme).toBe("textual-light");
    expect(app.ansi_theme).toBe(customLight);
    expect(observedThemes).toEqual(["textual-dark", "textual-light"]);

    unsubscribe();
    instance.unmount();
    instance.cleanup();
  });

  it("suspends through driver support checks and publishes suspend/resume signals around the yielded block", async () => {
    const calls: string[] = [];
    const driver: AppDriver = {
      canSuspend: true,
      isHeadless: false,
      suspendApplicationMode: () => {
        calls.push("driver:suspend");
      },
      resumeApplicationMode: () => {
        calls.push("driver:resume");
      },
    };
    const app = new App({ driver });
    let widget!: Widget;

    const instance = render(
      <TextualApp app={app}>
        <AppServiceHarness
          onReady={(_app, value) => {
            widget = value;
          }}
        />
      </TextualApp>,
    );

    await app.whenIdle();

    const unsubscribeSuspend = app.signals.app_suspend_signal.subscribe(widget, () => {
      calls.push("signal:suspend");
    }, true);
    const unsubscribeResume = app.signals.app_resume_signal.subscribe(widget, () => {
      calls.push("signal:resume");
    }, true);

    await app.suspend(async () => {
      calls.push("body");
    });

    expect(calls).toEqual(["signal:suspend", "driver:suspend", "body", "driver:resume", "signal:resume"]);

    const unsupported = new App({
      driver: {
        canSuspend: true,
        isHeadless: true,
        suspendApplicationMode: () => undefined,
        resumeApplicationMode: () => undefined,
      },
    });

    await expect(unsupported.suspend(() => undefined)).rejects.toBeInstanceOf(SuspendNotSupported);

    unsubscribeSuspend();
    unsubscribeResume();
    instance.unmount();
    instance.cleanup();
  });

  it("opens searchCommands with command entries and handles empty command lists", async () => {
    const app = new App();
    const selected: string[] = [];

    const instance = render(
      <TextualApp app={app}>
        <Text>commands</Text>
      </TextualApp>,
    );

    await app.whenIdle();

    const palette = await app.searchCommands([
      ["Open File", () => {
        selected.push("open");
      }, "Open a file"],
      { name: "Close File", callback: () => {
        selected.push("close");
      } },
    ]);

    expect(app.activeScreen?.name).toBe("__command_palette__");
    expect(app.activeCommandPalette).toBe(palette);

    const results = await palette.search("open");
    expect(results[0]?.text).toBe("Open File");

    results[0]?.command();
    expect(selected).toEqual(["open"]);

    const emptyPalette = await app.searchCommands([]);
    expect(await emptyPalette.search("anything")).toEqual([]);

    instance.unmount();
    instance.cleanup();
  });

  it("parses TEXTUAL feature flags and environment helper values", () => {
    const empty = new App({ env: { TEXTUAL: "" } });
    const debug = new App({ env: { TEXTUAL: "devtools, debug" } });
    const debugWithoutDevtools = new App({ env: { TEXTUAL: "debug" } });

    expect(empty.features.size).toBe(0);
    expect(empty.devtools).toBeNull();
    expect(empty.debug).toBe(false);
    expect(debug.devtools).not.toBeNull();
    expect(debug.debug).toBe(true);
    expect(debugWithoutDevtools.debug).toBe(false);

    const env = {
      COUNT: "-5",
      ENABLED: "1",
      DISABLED: "true",
      PORT: "70000",
      GOOD_PORT: "1234",
    };

    expect(_get_environ_int("COUNT", 10, 0, env)).toBe(0);
    expect(_get_environ_bool("ENABLED", env)).toBe(true);
    expect(_get_environ_bool("DISABLED", env)).toBe(false);
    expect(_get_environ_port("PORT", 8000, env)).toBe(8000);
    expect(_get_environ_port("GOOD_PORT", 8000, env)).toBe(1234);
  });
});
