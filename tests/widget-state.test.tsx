import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";

import {
  Click,
  Key,
  MouseDown,
  ScrollEvent,
  TextualApp,
  TextualFramework,
  WidgetHost,
} from "../src/index.js";

describe("widget disabled state", () => {
  it("marks :disabled on the widget and cascades to descendants", async () => {
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost typeName="Container" id="container" disabled>
          <WidgetHost typeName="Leaf" id="leaf">
            <Text>leaf</Text>
          </WidgetHost>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    const container = framework.registry.getByCssId("container")!;
    const leaf = framework.registry.getByCssId("leaf")!;

    expect(container.hasPseudoClass("disabled")).toBe(true);
    expect(container.hasPseudoClass("enabled")).toBe(false);
    expect(leaf.hasPseudoClass("disabled")).toBe(true);
    expect(leaf.hasPseudoClass("enabled")).toBe(false);

    instance.unmount();
    instance.cleanup();
  });

  it("suppresses mouse and key input at disabled widgets but allows scroll", async () => {
    const framework = new TextualFramework();
    const received: string[] = [];

    const instance = render(
      <TextualApp framework={framework}>
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

    await framework.whenIdle();

    const leaf = framework.registry.getByCssId("leaf")!;

    framework.postMessage(leaf.nodeId, new Click(0, 0));
    framework.postMessage(leaf.nodeId, new MouseDown(0, 0));
    framework.postMessage(leaf.nodeId, new Key("a", "a"));
    framework.postMessage(leaf.nodeId, new ScrollEvent(0, 0, 0, 1));

    await framework.whenIdle();

    expect(received).toEqual(["scroll"]);

    instance.unmount();
    instance.cleanup();
  });
});

describe("widget loading state", () => {
  it("marks :loading on the widget and suppresses all user input", async () => {
    const framework = new TextualFramework();
    const received: string[] = [];

    const instance = render(
      <TextualApp framework={framework}>
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

    await framework.whenIdle();

    const leaf = framework.registry.getByCssId("leaf")!;

    expect(leaf.hasPseudoClass("loading")).toBe(true);

    framework.postMessage(leaf.nodeId, new Click(0, 0));
    framework.postMessage(leaf.nodeId, new Key("a", "a"));
    framework.postMessage(leaf.nodeId, new ScrollEvent(0, 0, 0, 1));

    await framework.whenIdle();

    expect(received).toEqual([]);

    instance.unmount();
    instance.cleanup();
  });
});

describe("focus chain gating", () => {
  it("excludes disabled and loading widgets from the focus chain", async () => {
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp framework={framework}>
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

    await framework.whenIdle();

    const chainIds = framework.getFocusChain().map((widget) => widget.id);
    expect(chainIds).toEqual(["a", "d"]);

    framework.focusNext();
    expect(framework.focusedNodeId).toBe(framework.registry.getByCssId("a")!.nodeId);

    framework.focusNext();
    expect(framework.focusedNodeId).toBe(framework.registry.getByCssId("d")!.nodeId);

    instance.unmount();
    instance.cleanup();
  });
});
