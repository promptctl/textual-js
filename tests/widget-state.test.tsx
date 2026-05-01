import { App } from "../src/index.js";
import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import {
  Click,
  Key,
  MouseDown,
  Region,
  ScrollEvent,
  Size,
  TextualApp,
  Widget,
  WidgetHost,
  runTest,
} from "../src/index.js";

describe("widget disabled state", () => {
  it("marks :disabled on the widget and cascades to descendants", async () => {
    const app = new App();

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost typeName="Container" id="container" disabled>
          <WidgetHost typeName="Leaf" id="leaf">
            <Text>leaf</Text>
          </WidgetHost>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const container = app.getByCssId("container")!;
    const leaf = app.getByCssId("leaf")!;

    expect(container.hasPseudoClass("disabled")).toBe(true);
    expect(container.hasPseudoClass("enabled")).toBe(false);
    expect(leaf.hasPseudoClass("disabled")).toBe(true);
    expect(leaf.hasPseudoClass("enabled")).toBe(false);

    instance.unmount();
    instance.cleanup();
  });

  it("suppresses mouse and key input at disabled widgets but allows scroll", async () => {
    const app = new App();
    const received: string[] = [];

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost
          typeName="Leaf"
          id="leaf"
          focusable
          autoFocus
          disabled
          handlers={{
            onClick: () => {
              received.push("click");
            },
            onMouseDown: () => {
              received.push("mousedown");
            },
            onKey: () => {
              received.push("key");
            },
            onScrollEvent: () => {
              received.push("scroll");
            },
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const leaf = app.getByCssId("leaf")!;

    app.postMessage(leaf.nodeId, new Click(0, 0));
    app.postMessage(leaf.nodeId, new MouseDown(0, 0));
    app.postMessage(leaf.nodeId, new Key("a", "a"));
    app.postMessage(leaf.nodeId, new ScrollEvent(0, 0, 0, 1));

    await app.whenIdle();

    expect(received).toEqual(["scroll"]);

    instance.unmount();
    instance.cleanup();
  });

  it("clears focus when a focused descendant becomes disabled by an ancestor", async () => {
    const app = new App();
    let setDisabled!: (value: boolean) => void;

    function Harness(): React.JSX.Element {
      const [disabled, updateDisabled] = React.useState(false);
      setDisabled = updateDisabled;

      return (
        <WidgetHost typeName="Container" id="container" disabled={disabled}>
          <WidgetHost typeName="Leaf" id="leaf" focusable>
            <Text>leaf</Text>
          </WidgetHost>
        </WidgetHost>
      );
    }

    const instance = render(
      <TextualApp app={app}>
        <Harness />
      </TextualApp>,
    );

    await app.whenIdle();
    const leaf = app.getByCssId("leaf")!;
    app.focusWidget(leaf.nodeId);
    expect(app.focusedNodeId).toBe(leaf.nodeId);

    setDisabled(true);
    await Promise.resolve();
    await app.whenIdle();

    expect(app.focusedNodeId).toBeNull();

    instance.unmount();
    instance.cleanup();
  });

  it("consumes pointer hits on disabled widgets without falling through", async () => {
    const received: string[] = [];

    function DisabledPointerHarness(): React.JSX.Element {
      return (
        <WidgetHost
          typeName="Parent"
          id="parent"
          handlers={{
            onClick: () => {
              received.push("parent");
            },
          }}
        >
          <WidgetHost
            typeName="Child"
            id="child"
            disabled
            handlers={{
              onClick: () => {
                received.push("child");
              },
            }}
          >
            <Text>child</Text>
          </WidgetHost>
        </WidgetHost>
      );
    }

    const session = await runTest(<DisabledPointerHarness />);

    expect(await session.pilot.click("#child")).toBe(true);
    expect(received).toEqual([]);

    session.unmount();
  });
});

describe("widget loading state", () => {
  it("marks :loading on the widget and suppresses all user input", async () => {
    const app = new App();
    const received: string[] = [];

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost
          typeName="Leaf"
          id="leaf"
          focusable
          autoFocus
          loading
          handlers={{
            onClick: () => {
              received.push("click");
            },
            onKey: () => {
              received.push("key");
            },
            onScrollEvent: () => {
              received.push("scroll");
            },
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const leaf = app.getByCssId("leaf")!;

    expect(leaf.hasPseudoClass("loading")).toBe(true);

    app.postMessage(leaf.nodeId, new Click(0, 0));
    app.postMessage(leaf.nodeId, new Key("a", "a"));
    app.postMessage(leaf.nodeId, new ScrollEvent(0, 0, 0, 1));

    await app.whenIdle();

    expect(received).toEqual([]);

    instance.unmount();
    instance.cleanup();
  });

  it("consumes pointer hits on loading widgets without falling through", async () => {
    const received: string[] = [];

    function LoadingPointerHarness(): React.JSX.Element {
      return (
        <WidgetHost
          typeName="Parent"
          id="parent"
          handlers={{
            onClick: () => {
              received.push("parent");
            },
          }}
        >
          <WidgetHost
            typeName="Child"
            id="child"
            loading
            handlers={{
              onClick: () => {
                received.push("child");
              },
            }}
          >
            <Text>child</Text>
          </WidgetHost>
        </WidgetHost>
      );
    }

    const session = await runTest(<LoadingPointerHarness />);

    expect(await session.pilot.click("#child")).toBe(true);
    expect(received).toEqual([]);

    session.unmount();
  });
});

describe("focus chain gating", () => {
  it("excludes disabled and loading widgets from the focus chain", async () => {
    const app = new App();

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost typeName="Label" id="a" focusable>
          <Text>a</Text>
        </WidgetHost>
        <WidgetHost typeName="Label" id="b" focusable disabled>
          <Text>b</Text>
        </WidgetHost>
        <WidgetHost typeName="Label" id="c" focusable loading>
          <Text>c</Text>
        </WidgetHost>
        <WidgetHost typeName="Label" id="d" focusable>
          <Text>d</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const chainIds = app.getFocusChain().map((widget) => widget.id);
    expect(chainIds).toEqual(["a", "d"]);

    app.focusNext();
    expect(app.focusedNodeId).toBe(app.getByCssId("a")!.nodeId);

    app.focusNext();
    expect(app.focusedNodeId).toBe(app.getByCssId("d")!.nodeId);

    instance.unmount();
    instance.cleanup();
  });
});

function createTestWidget(
  app: App,
  options: Partial<ConstructorParameters<typeof Widget>[0]> = {},
): Widget {
  return new Widget({
    app,
    nodeId: options.nodeId ?? `widget-${Math.random()}`,
    parentId: options.parentId ?? null,
    id: options.id,
    classes: options.classes ?? [],
    typeName: options.typeName ?? "ScrollShell",
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

describe("widget scroll shell", () => {
  it("clamps scroll offsets and supports page/end helpers", () => {
    const app = new App();
    const widget = createTestWidget(app);

    widget.updateScreenRegion(new Region(0, 0, 8, 3));
    widget.setVirtualSize(new Size(20, 10));

    widget.scrollTo(100, 100);
    expect(widget.scrollOffsetX).toBe(12);
    expect(widget.scrollOffsetY).toBe(7);

    widget.scrollPageUp();
    expect(widget.scrollOffsetY).toBe(4);

    widget.scrollPageDown();
    expect(widget.scrollOffsetY).toBe(7);

    widget.scrollTo(-10, -10);
    expect(widget.scrollOffsetX).toBe(0);
    expect(widget.scrollOffsetY).toBe(0);

    widget.scrollEnd();
    expect(widget.scrollOffsetX).toBe(12);
    expect(widget.scrollOffsetY).toBe(7);
  });

  it("scrolls a target region into view with the minimum delta", () => {
    const app = new App();
    const widget = createTestWidget(app);

    widget.updateScreenRegion(new Region(0, 0, 8, 3));
    widget.setVirtualSize(20, 10);
    widget.scrollVisible(new Region(10, 4, 2, 1));

    expect(widget.scrollOffsetX).toBe(4);
    expect(widget.scrollOffsetY).toBe(2);
  });

  it("resolves widget-based visibility against the viewport seam", () => {
    const app = new App();
    const parent = createTestWidget(app, { nodeId: "parent", id: "parent" });
    const child = createTestWidget(app, { nodeId: "child", id: "child", parentId: "parent" });

    app.registerWidget(parent);
    app.registerWidget(child);
    parent.updateScreenRegion(new Region(10, 5, 8, 3));
    parent.setVirtualSize(20, 10);
    child.updateScreenRegion(new Region(18, 11, 2, 1));

    parent.scrollVisible(child);

    expect(parent.scrollOffsetX).toBe(2);
    expect(parent.scrollOffsetY).toBe(4);
  });
});
