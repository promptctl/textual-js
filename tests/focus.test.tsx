import { App } from "../src/index.js";
import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { TextualApp, WidgetHost, runTest } from "../src/index.js";

function FocusHarness(): React.JSX.Element {
  return (
    <>
      <WidgetHost typeName="Label" id="first" focusable>
        <Text>first</Text>
      </WidgetHost>
      <WidgetHost typeName="Label" id="middle" focusable>
        <Text>middle</Text>
      </WidgetHost>
      <WidgetHost typeName="Label" id="last" focusable>
        <Text>last</Text>
      </WidgetHost>
      <WidgetHost typeName="Label" id="inert">
        <Text>inert</Text>
      </WidgetHost>
    </>
  );
}

function DefaultRestoreScreen(): React.JSX.Element {
  return (
    <>
      <WidgetHost typeName="Label" id="default-first" focusable>
        <Text>default-first</Text>
      </WidgetHost>
      <WidgetHost typeName="Label" id="default-second" focusable>
        <Text>default-second</Text>
      </WidgetHost>
    </>
  );
}

function DialogRestoreScreen(): React.JSX.Element {
  return (
    <>
      <WidgetHost typeName="Label" id="dialog-first" focusable>
        <Text>dialog-first</Text>
      </WidgetHost>
      <WidgetHost typeName="Label" id="dialog-second" focusable>
        <Text>dialog-second</Text>
      </WidgetHost>
    </>
  );
}

async function settleFocus(app: App): Promise<void> {
  await app.whenIdle();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await app.whenIdle();
}

describe("focus manager", () => {
  it("tracks :focus pseudo-class and emits Focus/Blur on transitions", async () => {
    const app = new App();
    const framework = app.framework;
    const received: string[] = [];

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          Label:focus { color: red; }
          Label:blur { color: blue; }
        `}
      >
        <FocusHarness />
      </TextualApp>,
    );

    await app.whenIdle();

    const first = app.getByCssId("first")!;
    const middle = app.getByCssId("middle")!;

    const unsubscribe = app.subscribeToMessages((message) => {
      received.push(`${message.constructor.name}:${(message.sender as { nodeId?: string } | null)?.nodeId ?? "none"}`);
    });

    app.focusWidget(first.nodeId);
    await app.whenIdle();

    expect(first.isFocused).toBe(true);
    expect(first.hasPseudoClass("focus")).toBe(true);
    expect(first.hasPseudoClass("blur")).toBe(false);
    expect(middle.hasPseudoClass("blur")).toBe(true);

    app.focusWidget(middle.nodeId);
    await app.whenIdle();

    expect(first.isFocused).toBe(false);
    expect(first.hasPseudoClass("blur")).toBe(true);
    expect(middle.isFocused).toBe(true);
    expect(middle.hasPseudoClass("focus")).toBe(true);
    expect(received.filter((entry) => entry.startsWith("Blur:")).length).toBeGreaterThanOrEqual(1);
    expect(received.filter((entry) => entry.startsWith("Focus:")).length).toBeGreaterThanOrEqual(2);

    unsubscribe();
    instance.unmount();
    instance.cleanup();
  });

  it("cycles focus through the focus chain with focusNext and focusPrevious", async () => {
    const app = new App();
    const framework = app.framework;

    const instance = render(
      <TextualApp framework={framework}>
        <FocusHarness />
      </TextualApp>,
    );

    await app.whenIdle();

    const chainIds = app.getFocusChain().map((widget) => widget.id);
    expect(chainIds).toEqual(["first", "middle", "last"]);

    app.focusWidget(null);

    expect(app.focusNext()?.id).toBe("first");
    expect(app.focusNext()?.id).toBe("middle");
    expect(app.focusNext()?.id).toBe("last");
    expect(app.focusNext()?.id).toBe("first");
    expect(app.focusPrevious()?.id).toBe("last");

    instance.unmount();
    instance.cleanup();
  });

  it("supports selector-filtered focus navigation and clears focus when no candidate matches", async () => {
    const app = new App();
    const framework = app.framework;

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost typeName="Input" id="first-input" focusable>
          <Text>first input</Text>
        </WidgetHost>
        <WidgetHost typeName="Label" id="label" focusable>
          <Text>label</Text>
        </WidgetHost>
        <WidgetHost typeName="Input" id="second-input" focusable>
          <Text>second input</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.focusWidget(app.getByCssId("first-input")!.nodeId);

    expect(app.focusNext("Input")?.id).toBe("second-input");
    expect(app.focusNext("Input")?.id).toBe("first-input");
    expect(app.focusPrevious("Input")?.id).toBe("second-input");
    expect(app.focusNext(".missing")).toBeNull();
    expect(app.focusedNodeId).toBeNull();

    instance.unmount();
    instance.cleanup();
  });

  it("focuses the pointer target or nearest focusable ancestor on mouse down only", async () => {
    const session = await runTest(
      <>
        <WidgetHost typeName="FocusableParent" id="parent" focusable>
          <WidgetHost typeName="Leaf" id="child">
            <Text>child</Text>
          </WidgetHost>
        </WidgetHost>
        <WidgetHost typeName="FocusableLeaf" id="leaf" focusable>
          <Text>leaf</Text>
        </WidgetHost>
      </>,
    );

    const parent = session.app.getByCssId("parent")!;
    const child = session.app.getByCssId("child")!;
    const leaf = session.app.getByCssId("leaf")!;

    session.app.focusWidget(null);

    session.framework.dispatchPointerUp(leaf.screenRegion.x, leaf.screenRegion.y);
    await session.app.whenIdle();
    expect(session.app.focusedNodeId).toBeNull();

    session.framework.dispatchPointerDown(child.screenRegion.x, child.screenRegion.y);
    await session.app.whenIdle();
    expect(session.app.focusedNodeId).toBe(parent.nodeId);

    session.framework.dispatchPointerDown(leaf.screenRegion.x, leaf.screenRegion.y);
    await session.app.whenIdle();
    expect(session.app.focusedNodeId).toBe(leaf.nodeId);

    session.unmount();
  });

  it("routes Tab and Shift+Tab through the default app bindings", async () => {
    const session = await runTest(<FocusHarness />);

    await session.pilot.pause();
    session.app.focusWidget(session.app.getByCssId("first")!.nodeId);
    await session.pilot.pause();

    session.app.postKey("tab");
    await session.app.whenIdle();
    expect(session.app.focusedNodeId).toBe(session.app.getByCssId("middle")!.nodeId);

    session.app.postKey("tab", { shift: true });
    await session.app.whenIdle();
    expect(session.app.focusedNodeId).toBe(session.app.getByCssId("first")!.nodeId);

    session.unmount();
  });

  it("restores focus to the previous screen after pop and mode return", async () => {
    const app = new App();
    const framework = app.framework;
    app.addMode("secondary", () => <DialogRestoreScreen />);

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultRestoreScreen />
      </TextualApp>,
    );

    await settleFocus(app);

    app.focusWidget(app.getByCssId("default-second")!.nodeId);
    await settleFocus(app);

    app.pushScreen(<DialogRestoreScreen />, { autoFocus: "#dialog-first" });
    await settleFocus(app);

    app.focusWidget(app.getByCssId("dialog-second")!.nodeId);
    await settleFocus(app);

    app.popScreen();
    await settleFocus(app);

    expect(app.focusedNodeId).toBe(app.getByCssId("default-second")!.nodeId);

    app.switchMode("secondary");
    await settleFocus(app);

    app.focusWidget(app.getByCssId("dialog-second")!.nodeId);
    await settleFocus(app);

    app.switchMode("_default");
    await settleFocus(app);

    expect(app.focusedNodeId).toBe(app.getByCssId("default-second")!.nodeId);

    app.switchMode("secondary");
    await settleFocus(app);

    expect(app.focusedNodeId).toBe(app.getByCssId("dialog-second")!.nodeId);

    instance.unmount();
    instance.cleanup();
  });

  it("applies app and screen auto-focus selectors with screen precedence", async () => {
    const app = new App();
    const framework = app.framework;

    const instance = render(
      <TextualApp framework={framework} autoFocus="Label">
        <DefaultRestoreScreen />
      </TextualApp>,
    );

    await settleFocus(app);
    expect(app.focusedNodeId).toBe(app.getByCssId("default-first")!.nodeId);

    app.pushScreen(<DialogRestoreScreen />, { autoFocus: "#dialog-second" });
    await settleFocus(app);
    expect(app.focusedNodeId).toBe(app.getByCssId("dialog-second")!.nodeId);

    app.popScreen();
    await settleFocus(app);

    app.pushScreen(<DialogRestoreScreen />);
    await settleFocus(app);
    expect(app.focusedNodeId).toBe(app.getByCssId("dialog-first")!.nodeId);

    app.popScreen();
    await settleFocus(app);

    app.pushScreen(<DialogRestoreScreen />, { autoFocus: "" });
    await settleFocus(app);
    expect(app.focusedNodeId).toBeNull();

    instance.unmount();
    instance.cleanup();
  });
});
