import React, { useLayoutEffect, useState } from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";

import {
  App,
  DuplicateKeyHandlers,
  Message,
  OnDecoratorError,
  Paste,
  SignalError,
  TextualApp,
  TextualFramework,
  WidgetHost,
  WidgetNode,
  WidgetScope,
  formatKey,
  getKeyDisplay,
  keyToCharacter,
  on,
  useWidget,
} from "../src/index.js";

class Ping extends Message {}

class NamespacedPing extends Message {
  static override readonly namespace = "base_widget";
}

class PanePing extends Message {
  static override readonly ALLOW_SELECTOR_MATCH = new Set(["pane"]);

  constructor(readonly pane: WidgetNode) {
    super();
  }
}

function HandleHarness(props: {
  onReady: (widget: WidgetNode) => void;
  onRender?: () => void;
  id?: string;
}): React.JSX.Element {
  const widget = useWidget({
    id: props.id ?? "handle-harness",
    typeName: "HandleHarness",
  });

  props.onRender?.();

  useLayoutEffect(() => {
    props.onReady(widget.handle);
  }, [props, widget.handle]);

  return (
    <WidgetScope widget={widget.handle}>
      <Text>handle</Text>
    </WidgetScope>
  );
}

describe("Stage 1 runtime seams", () => {
  it("tracks nested batchUpdate depth on the app surface", () => {
    const app = new App();
    const depths: number[] = [];

    app.batchUpdate(() => {
      depths.push(app.batchUpdateCount);
      app.batch_update(() => {
        depths.push(app.batchUpdateCount);
      });
      depths.push(app.batchUpdateCount);
    });

    expect(depths).toEqual([1, 2, 1]);
    expect(app.batchUpdateCount).toBe(0);
    expect(app.framework.batchUpdateCount).toBe(0);
  });

  it("suppresses prevented message types, including callNext callbacks scheduled inside the scope", async () => {
    const framework = new TextualFramework();
    let widget!: WidgetNode;
    const received: string[] = [];
    const unsubscribe = framework.subscribeToMessages((message) => {
      if (message instanceof Ping) {
        received.push("ping");
      }
    });

    const instance = render(
      <TextualApp framework={framework}>
        <HandleHarness
          onReady={(value) => {
            widget = value;
          }}
        />
      </TextualApp>,
    );

    await framework.whenIdle();

    widget.prevent(Ping, () => {
      widget.postMessage(new Ping());
      framework.callNext(() => {
        widget.postMessage(new Ping());
      });
    });

    await framework.whenIdle();
    expect(received).toEqual([]);

    widget.postMessage(new Ping());
    await framework.whenIdle();
    expect(received).toEqual(["ping"]);

    unsubscribe();
    instance.unmount();
    instance.cleanup();
  });

  it("dispatches key_<name> handlers directly and resolves aliases", async () => {
    const framework = new TextualFramework();
    const received: string[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="Keyboard"
          focusable
          autoFocus
          handlers={{
            key_x: () => {
              received.push("x");
            },
            key_ctrl_i: () => {
              received.push("tab");
            },
          }}
        >
          <Text>keyboard</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    framework.postKey("x");
    framework.postKey("tab");
    await framework.whenIdle();

    expect(received).toEqual(["x", "tab"]);

    instance.unmount();
    instance.cleanup();
  });

  it("rejects duplicate direct key handlers across aliases and private/public methods", async () => {
    const framework = new TextualFramework();

    const aliasInstance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="AliasConflict"
          focusable
          autoFocus
          handlers={{
            key_tab: () => undefined,
            key_ctrl_i: () => undefined,
          }}
        >
          <Text>alias</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();
    framework.postKey("tab");
    await expect(framework.whenIdle()).rejects.toBeInstanceOf(DuplicateKeyHandlers);
    aliasInstance.unmount();
    aliasInstance.cleanup();

    const secondFramework = new TextualFramework();
    const privateInstance = render(
      <TextualApp framework={secondFramework}>
        <WidgetHost
          typeName="PrivateConflict"
          focusable
          autoFocus
          handlers={{
            key_x: () => undefined,
            _key_x: () => undefined,
          }}
        >
          <Text>private</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await secondFramework.whenIdle();
    secondFramework.postKey("x");
    await expect(secondFramework.whenIdle()).rejects.toBeInstanceOf(DuplicateKeyHandlers);
    privateInstance.unmount();
    privateInstance.cleanup();
  });

  it("routes Paste messages, including empty-string pastes", async () => {
    const framework = new TextualFramework();
    const received: string[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="PasteTarget"
          handlers={{
            onPaste: (message) => {
              received.push((message as Paste).text);
            },
          }}
        >
          <Text>paste</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();
    const widget = framework.registry.list()[0]!;

    framework.postMessage(widget.nodeId, new Paste(""));
    framework.postMessage(widget.nodeId, new Paste("hello"));
    await framework.whenIdle();

    expect(received).toEqual(["", "hello"]);

    instance.unmount();
    instance.cleanup();
  });

  it("supports namespaced message handler resolution", async () => {
    const framework = new TextualFramework();
    const received: string[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="Namespaced"
          handlers={{
            on_base_widget_namespaced_ping: () => {
              received.push("handled");
            },
          }}
        >
          <Text>namespaced</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();
    const widget = framework.registry.list()[0]!;
    framework.postMessage(widget.nodeId, new NamespacedPing());
    await framework.whenIdle();

    expect(received).toEqual(["handled"]);

    instance.unmount();
    instance.cleanup();
  });

  it("validates @on selectors and attribute selector declarations at decoration time", () => {
    expect(() => on(Ping, "@", () => undefined)).toThrow(OnDecoratorError);
    expect(() => on(PanePing, { missing: "#one" }, () => undefined)).toThrow(OnDecoratorError);
  });

  it("accepts valid @on attribute selector declarations", () => {
    const pane = new TextualFramework();
    const widget = new WidgetNode({
      framework: pane,
      nodeId: "pane",
      parentId: null,
      id: "one",
      classes: [],
      typeName: "Pane",
      handlersRef: { current: undefined },
      actionsRef: { current: undefined },
      bindingsRef: { current: [] },
      focusable: false,
      autoFocus: false,
      disabled: false,
      loading: false,
      tooltip: null,
    });

    expect(() => on(PanePing, { pane: "#one" }, () => void widget)).not.toThrow();
  });

  it("exposes key name formatting helpers", () => {
    expect(formatKey("minus")).toBe("-");
    expect(getKeyDisplay("p")).toBe("p");
    expect(getKeyDisplay("ctrl+p")).toBe("^p");
    expect(getKeyDisplay("right_square_bracket")).toBe("]");
    expect(getKeyDisplay("delete")).toBe("del");
    expect(keyToCharacter("space")).toBe(" ");
    expect(keyToCharacter("right_square_bracket")).toBe("]");
    expect(keyToCharacter("ctrl+space")).toBeNull();
    expect(keyToCharacter("unknown_key")).toBeNull();
  });

  it("cleans up signal subscriptions when a widget unmounts", async () => {
    const framework = new TextualFramework();
    let publisher!: WidgetNode;
    let subscriber!: WidgetNode;
    let setMounted!: (mounted: boolean) => void;

    function SignalHarness(): React.JSX.Element {
      const [mounted, updateMounted] = useState(true);

      useLayoutEffect(() => {
        setMounted = updateMounted;
      }, []);

      return (
        <>
          <HandleHarness
            id="publisher"
            onReady={(value) => {
              publisher = value;
            }}
          />
          {mounted ? (
            <HandleHarness
              id="subscriber"
              onReady={(value) => {
                subscriber = value;
              }}
            />
          ) : null}
        </>
      );
    }

    const instance = render(
      <TextualApp framework={framework}>
        <SignalHarness />
      </TextualApp>,
    );

    await framework.whenIdle();

    const signal = publisher.createSignal<string>();
    const received: string[] = [];
    signal.subscribe(subscriber, (value) => {
      received.push(value);
    }, true);

    signal.publish("first");
    expect(received).toEqual(["first"]);

    setMounted(false);
    await Promise.resolve();
    await framework.whenIdle();
    await Promise.resolve();

    signal.publish("second");
    expect(received).toEqual(["first"]);

    instance.unmount();
    instance.cleanup();
  });

  it("rejects signal subscriptions from unmounted widgets", () => {
    const framework = new TextualFramework();
    const publisher = new WidgetNode({
      framework,
      nodeId: "publisher",
      parentId: null,
      classes: [],
      typeName: "Publisher",
      handlersRef: { current: undefined },
      actionsRef: { current: undefined },
      bindingsRef: { current: [] },
      focusable: false,
      autoFocus: false,
      disabled: false,
      loading: false,
      tooltip: null,
    });
    const subscriber = new WidgetNode({
      framework,
      nodeId: "subscriber",
      parentId: null,
      classes: [],
      typeName: "Subscriber",
      handlersRef: { current: undefined },
      actionsRef: { current: undefined },
      bindingsRef: { current: [] },
      focusable: false,
      autoFocus: false,
      disabled: false,
      loading: false,
      tooltip: null,
    });

    framework.registerWidget(publisher);
    const signal = publisher.createSignal<string>();

    expect(() => signal.subscribe(subscriber, () => undefined)).toThrow(SignalError);
  });
});
