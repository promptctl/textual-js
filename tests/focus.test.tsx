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
});
