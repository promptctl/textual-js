import React from "react";
import { Text } from "ink";
import { afterEach, describe, expect, it } from "vitest";

import { Message, TextualApp, TextualFramework, WidgetHost } from "../src/index.js";
import { render } from "ink-testing-library";

class Ping extends Message {}

class ReplaceablePing extends Message {
  override canReplace(message: Message): boolean {
    return message instanceof ReplaceablePing;
  }
}

describe("message dispatch", () => {
  afterEach(() => {
    render(<Text>cleanup</Text>).cleanup();
  });

  it("resolves widget handlers and bubbles through the registered tree", async () => {
    const framework = new TextualFramework();
    const received: string[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="Parent"
          handlers={{
            onPing: () => {
              received.push("parent");
            },
          }}
        >
          <WidgetHost
            typeName="Child"
            handlers={{
              onPing: () => {
                received.push("child");
              },
            }}
          >
            <Text>messages</Text>
          </WidgetHost>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    const child = framework.registry.list().find((entry) => entry.typeName === "Child");
    expect(child).toBeDefined();

    framework.postMessage(child!.nodeId, new Ping());
    expect(framework.messageQueueSize).toBe(1);

    await framework.whenIdle();

    expect(received).toEqual(["child", "parent"]);
    expect(framework.messageQueueSize).toBe(0);

    instance.unmount();
    instance.cleanup();
  });

  it("coalesces replaceable queued messages", async () => {
    const framework = new TextualFramework();
    const received: number[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="Widget"
          handlers={{
            onReplaceablePing: () => {
              received.push(received.length + 1);
            },
          }}
        >
          <Text>coalesce</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    const widget = framework.registry.list()[0];

    framework.postMessage(widget.nodeId, new ReplaceablePing());
    framework.postMessage(widget.nodeId, new ReplaceablePing());
    framework.postMessage(widget.nodeId, new ReplaceablePing());

    expect(framework.messageQueueSize).toBe(1);

    await framework.whenIdle();

    expect(received).toEqual([1]);

    instance.unmount();
    instance.cleanup();
  });
});
