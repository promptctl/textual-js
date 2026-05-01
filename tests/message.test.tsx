import { App } from "../src/index.js";
import React from "react";
import { Text } from "ink";
import { afterEach, describe, expect, it } from "vitest";

import { Idle, Message, MouseMove, on, Resize, TextualApp, WidgetHost } from "../src/index.js";
import { render } from "ink-testing-library";

class Ping extends Message {}
class ChildPing extends Ping {}
class NestedPing extends Message {}
class ControlPing extends Message {
  static override readonly selectorAttribute = "control";

  constructor(readonly control: unknown) {
    super();
  }
}

class ReplaceablePing extends Message {
  override canReplace(message: Message): boolean {
    return message instanceof ReplaceablePing;
  }
}

class SilentPing extends Message {
  static override readonly noDispatch = true;
}

class DecoratedBaseHandlers {
  constructor(protected readonly received: string[]) {}

  @on(Ping)
  handlePing(): void {
    this.received.push("base");
  }
}

class DecoratedDerivedHandlers extends DecoratedBaseHandlers {
  @on(Ping)
  override handlePing(): void {
    this.received.push("derived");
  }
}

describe("message dispatch", () => {
  afterEach(() => {
    render(<Text>cleanup</Text>).cleanup();
  });

  it("resolves widget handlers and bubbles through the registered tree", async () => {
    const app = new App();
    const received: string[] = [];

    const instance = render(
      <TextualApp app={app}>
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

    await app.whenIdle();

    const child = app.registry.list().find((entry) => entry.typeName === "Child");
    expect(child).toBeDefined();

    app.postMessage(child!.nodeId, new Ping());
    expect(app.messageQueueSize).toBe(1);

    await app.whenIdle();

    expect(received).toEqual(["child", "parent"]);
    expect(app.messageQueueSize).toBe(0);

    instance.unmount();
    instance.cleanup();
  });

  it("coalesces replaceable queued messages", async () => {
    const app = new App();
    const received: number[] = [];

    const instance = render(
      <TextualApp app={app}>
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

    await app.whenIdle();

    const widget = app.registry.list()[0];

    app.postMessage(widget.nodeId, new ReplaceablePing());
    app.postMessage(widget.nodeId, new ReplaceablePing());
    app.postMessage(widget.nodeId, new ReplaceablePing());

    expect(app.messageQueueSize).toBe(1);

    await app.whenIdle();

    expect(received).toEqual([1]);

    instance.unmount();
    instance.cleanup();
  });

  it("coalesces built-in queue messages to their latest value", async () => {
    const app = new App();
    const received: string[] = [];

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost
          typeName="Widget"
          handlers={{
            onResize: (message) => {
              received.push(`resize:${message.width}x${message.height}`);
            },
            onMouseMove: (message) => {
              received.push(`move:${message.x},${message.y}`);
            },
            onIdle: () => {
              received.push("idle");
            },
          }}
        >
          <Text>built-in-coalesce</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const widget = app.registry.list()[0];
    received.length = 0;

    app.postMessage(widget.nodeId, new Resize(10, 5));
    app.postMessage(widget.nodeId, new Resize(30, 8));
    app.postMessage(widget.nodeId, new MouseMove(1, 1));
    app.postMessage(widget.nodeId, new MouseMove(4, 7));
    app.postMessage(widget.nodeId, new Idle());
    app.postMessage(widget.nodeId, new Idle());

    expect(app.messageQueueSize).toBe(3);

    await app.whenIdle();

    expect(received).toEqual(["resize:30x8", "move:4,7", "idle", "idle"]);

    instance.unmount();
    instance.cleanup();
  });

  it("dispatches compose, mount, and unmount lifecycle messages", async () => {
    const app = new App();
    const received: string[] = [];

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost
          typeName="LifecycleWidget"
          handlers={{
            onCompose: () => {
              received.push("compose");
            },
            onMount: () => {
              received.push("mount");
            },
            onUnmount: () => {
              received.push("unmount");
            },
          }}
        >
          <Text>lifecycle</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    expect(received.slice(0, 2)).toEqual(["compose", "mount"]);

    instance.unmount();
    instance.cleanup();
    await Promise.resolve();

    expect(received).toContain("unmount");
  });

  it("runs an idle pass after startup drains the initial lifecycle queue", async () => {
    const app = new App();
    const received: string[] = [];

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost
          typeName="IdleWidget"
          handlers={{
            onMount: () => {
              received.push("mount");
            },
            onIdle: () => {
              received.push("idle");
            },
          }}
        >
          <Text>idle-startup</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    expect(received.slice(0, 2)).toEqual(["mount", "idle"]);

    instance.unmount();
    instance.cleanup();
  });

  it("tracks sender and message metadata", async () => {
    const app = new App();
    const senders: unknown[] = [];

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost
          typeName="MetadataWidget"
          handlers={{
            onPing: (message) => {
              senders.push(message.sender);
            },
          }}
        >
          <Text>metadata</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const widget = app.registry.list()[0];
    const ping = new Ping();

    expect(typeof ping.time).toBe("number");
    expect(ping.noDispatch).toBe(false);

    app.postMessage(widget.nodeId, ping);
    await app.whenIdle();

    expect(senders).toEqual([widget]);

    instance.unmount();
    instance.cleanup();
  });

  it("publishes messages to subscribers even when noDispatch short-circuits handlers", async () => {
    const app = new App();
    const received: string[] = [];
    const observed: string[] = [];
    const unsubscribe = app.subscribeToMessages((message) => {
      observed.push(message.constructor.name);
    });

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost
          typeName="SilentWidget"
          handlers={{
            onSilentPing: () => {
              received.push("handler");
            },
          }}
        >
          <Text>silent</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const widget = app.registry.list()[0];
    app.postMessage(widget.nodeId, new SilentPing());
    await app.whenIdle();

    expect(received).toEqual([]);
    expect(observed).toContain("SilentPing");

    unsubscribe();
    instance.unmount();
    instance.cleanup();
  });

  it("stops remaining local handlers after preventDefault while still bubbling", async () => {
    const app = new App();
    const received: string[] = [];

    const instance = render(
      <TextualApp app={app}>
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
              onPing: (message) => {
                received.push("child:first");
                message.preventDefault();
              },
              on_ping: () => {
                received.push("child:second");
              },
            }}
          >
            <Text>prevent-default</Text>
          </WidgetHost>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const child = app.registry.list().find((entry) => entry.typeName === "Child");
    expect(child).toBeDefined();

    app.postMessage(child!.nodeId, new Ping());
    await app.whenIdle();

    expect(received).toEqual(["child:first", "parent"]);

    instance.unmount();
    instance.cleanup();
  });

  it("runs selector-filtered on handlers before convention handlers and avoids double-dispatch", async () => {
    const app = new App();
    const received: string[] = [];

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost
          typeName="Parent"
          handlers={{
            onControlPing: on(ControlPing, "#save", () => {
              received.push("decorated");
            }),
            on_control_ping: () => {
              received.push("convention");
            },
          }}
        >
          <WidgetHost typeName="Child" id="save">
            <Text>selector-match</Text>
          </WidgetHost>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const child = app.getByCssId("save");
    expect(child).toBeDefined();

    app.postMessage(child!.nodeId, new ControlPing(child));
    await app.whenIdle();

    expect(received).toEqual(["decorated", "convention"]);

    instance.unmount();
    instance.cleanup();
  });

  it("deduplicates overlapping on registrations for inherited message types", async () => {
    const app = new App();
    const received: string[] = [];
    const handler = on(Ping, on(ChildPing, () => {
      received.push("handled");
    }));

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost
          typeName="Widget"
          handlers={{
            handleChildPing: handler,
          }}
        >
          <Text>dedupe</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const widget = app.registry.list()[0];
    app.postMessage(widget.nodeId, new ChildPing());
    await app.whenIdle();

    expect(received).toEqual(["handled"]);

    instance.unmount();
    instance.cleanup();
  });

  it("runs derived and base decorated prototype handlers in order", async () => {
    const app = new App();
    const received: string[] = [];

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost
          typeName="Widget"
          handlers={new DecoratedDerivedHandlers(received)}
        >
          <Text>decorators</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const widget = app.registry.list()[0];
    app.postMessage(widget.nodeId, new Ping());
    await app.whenIdle();

    expect(received).toEqual(["derived", "base"]);

    instance.unmount();
    instance.cleanup();
  });

  it("drains reentrant postMessage calls in queue order without recursive dispatch", async () => {
    const app = new App();
    const received: string[] = [];

    const instance = render(
      <TextualApp app={app}>
        <WidgetHost
          typeName="Parent"
          handlers={{
            onPing: () => {
              received.push("parent:ping");
            },
            onNestedPing: () => {
              received.push("parent:nested");
            },
          }}
        >
          <WidgetHost
            typeName="Child"
            handlers={{
              onPing: () => {
                received.push("child:ping");
                const child = app.registry.list().find((entry) => entry.typeName === "Child");

                if (child !== undefined) {
                  app.postMessage(child.nodeId, new NestedPing());
                }
              },
              onNestedPing: () => {
                received.push("child:nested");
              },
            }}
          >
            <Text>reentrant</Text>
          </WidgetHost>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const child = app.registry.list().find((entry) => entry.typeName === "Child")!;
    app.postMessage(child.nodeId, new Ping());
    await app.whenIdle();

    expect(received).toEqual([
      "child:ping",
      "parent:ping",
      "child:nested",
      "parent:nested",
    ]);

    instance.unmount();
    instance.cleanup();
  });
});
