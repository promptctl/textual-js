import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";

import { TextualApp, TextualFramework, WidgetHost, runTest } from "../src/index.js";

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

async function settleFocus(framework: TextualFramework): Promise<void> {
  await framework.whenIdle();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await framework.whenIdle();
}

describe("focus manager", () => {
  it("tracks :focus pseudo-class and emits Focus/Blur on transitions", async () => {
    const framework = new TextualFramework();
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

    await framework.whenIdle();

    const first = framework.registry.getByCssId("first")!;
    const middle = framework.registry.getByCssId("middle")!;

    const unsubscribe = framework.subscribeToMessages((message) => {
      received.push(`${message.constructor.name}:${(message.sender as { nodeId?: string } | null)?.nodeId ?? "none"}`);
    });

    framework.focusWidget(first.nodeId);
    await framework.whenIdle();

    expect(first.isFocused).toBe(true);
    expect(first.hasPseudoClass("focus")).toBe(true);
    expect(first.hasPseudoClass("blur")).toBe(false);
    expect(middle.hasPseudoClass("blur")).toBe(true);

    framework.focusWidget(middle.nodeId);
    await framework.whenIdle();

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
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp framework={framework}>
        <FocusHarness />
      </TextualApp>,
    );

    await framework.whenIdle();

    const chainIds = framework.getFocusChain().map((widget) => widget.id);
    expect(chainIds).toEqual(["first", "middle", "last"]);

    framework.focusWidget(null);

    expect(framework.focusNext()?.id).toBe("first");
    expect(framework.focusNext()?.id).toBe("middle");
    expect(framework.focusNext()?.id).toBe("last");
    expect(framework.focusNext()?.id).toBe("first");
    expect(framework.focusPrevious()?.id).toBe("last");

    instance.unmount();
    instance.cleanup();
  });

  it("routes Tab and Shift+Tab through the default app bindings", async () => {
    const session = await runTest(<FocusHarness />);

    await session.pilot.pause();
    session.framework.focusWidget(session.framework.registry.getByCssId("first")!.nodeId);
    await session.pilot.pause();

    session.framework.postKey("tab");
    await session.framework.whenIdle();
    expect(session.framework.focusedNodeId).toBe(session.framework.registry.getByCssId("middle")!.nodeId);

    session.framework.postKey("tab", { shift: true });
    await session.framework.whenIdle();
    expect(session.framework.focusedNodeId).toBe(session.framework.registry.getByCssId("first")!.nodeId);

    session.unmount();
  });

  it("restores focus to the previous screen after pop and mode return", async () => {
    const framework = new TextualFramework();
    framework.addMode("secondary", () => <DialogRestoreScreen />);

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultRestoreScreen />
      </TextualApp>,
    );

    await settleFocus(framework);

    framework.focusWidget(framework.registry.getByCssId("default-second")!.nodeId);
    await settleFocus(framework);

    framework.pushScreen(<DialogRestoreScreen />, { autoFocus: "#dialog-first" });
    await settleFocus(framework);

    framework.focusWidget(framework.registry.getByCssId("dialog-second")!.nodeId);
    await settleFocus(framework);

    framework.popScreen();
    await settleFocus(framework);

    expect(framework.focusedNodeId).toBe(framework.registry.getByCssId("default-second")!.nodeId);

    framework.switchMode("secondary");
    await settleFocus(framework);

    framework.focusWidget(framework.registry.getByCssId("dialog-second")!.nodeId);
    await settleFocus(framework);

    framework.switchMode("_default");
    await settleFocus(framework);

    expect(framework.focusedNodeId).toBe(framework.registry.getByCssId("default-second")!.nodeId);

    framework.switchMode("secondary");
    await settleFocus(framework);

    expect(framework.focusedNodeId).toBe(framework.registry.getByCssId("dialog-second")!.nodeId);

    instance.unmount();
    instance.cleanup();
  });

  it("applies app and screen auto-focus selectors with screen precedence", async () => {
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp framework={framework} autoFocus="Label">
        <DefaultRestoreScreen />
      </TextualApp>,
    );

    await settleFocus(framework);
    expect(framework.focusedNodeId).toBe(framework.registry.getByCssId("default-first")!.nodeId);

    framework.pushScreen(<DialogRestoreScreen />, { autoFocus: "#dialog-second" });
    await settleFocus(framework);
    expect(framework.focusedNodeId).toBe(framework.registry.getByCssId("dialog-second")!.nodeId);

    framework.popScreen();
    await settleFocus(framework);

    framework.pushScreen(<DialogRestoreScreen />);
    await settleFocus(framework);
    expect(framework.focusedNodeId).toBe(framework.registry.getByCssId("dialog-first")!.nodeId);

    framework.popScreen();
    await settleFocus(framework);

    framework.pushScreen(<DialogRestoreScreen />, { autoFocus: "" });
    await settleFocus(framework);
    expect(framework.focusedNodeId).toBeNull();

    instance.unmount();
    instance.cleanup();
  });
});
