import React, { useLayoutEffect, useState } from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";

import {
  App,
  DuplicateKeyHandlers,
  DuplicateIds,
  Key,
  Message,
  OnDecoratorError,
  Paste,
  SignalError,
  TextualApp,
  WidgetHost,
  Widget,
  WidgetScope,
  formatKey,
  getKeyDisplay,
  keyToCharacter,
  on,
  useWidget,
} from "../src/index.js";

class Ping extends Message {}

class SubPing extends Ping {}

class NamespacedPing extends Message {
  static override readonly namespace = "base_widget";
}

class PanePing extends Message {
  static override readonly ALLOW_SELECTOR_MATCH = new Set(["pane"]);

  constructor(readonly pane: Widget) {
    super();
  }
}

class ControlPing extends Message {
  static override readonly selectorAttribute = "control";

  constructor(readonly control: Widget) {
    super();
  }
}

function HandleHarness(props: {
  onReady: (widget: Widget) => void;
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
      app.batchUpdate(() => {
        depths.push(app.batchUpdateCount);
      });
      depths.push(app.batchUpdateCount);
    });

    expect(depths).toEqual([1, 2, 1]);
    expect(app.batchUpdateCount).toBe(0);
    expect(app.framework.batchUpdateCount).toBe(0);
  });

  it("suppresses prevented message types, including callNext callbacks scheduled inside the scope", async () => {
    const framework = new App().framework;
    let widget!: Widget;
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

  it("uses exact message types for scoped and long-lived suppression", async () => {
    const framework = new App().framework;
    let widget!: Widget;
    const received: string[] = [];

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
      expect(widget.postMessage(new Ping())).toBe(false);
      expect(widget.postMessage(new SubPing())).toBe(true);
    });

    const unsubscribe = framework.subscribeToMessages((message) => {
      if (message instanceof Ping) {
        received.push(message.constructor.name);
      }
    });

    await framework.whenIdle();
    expect(received).toEqual(["SubPing"]);

    widget.disableMessages(Ping);
    expect(widget.postMessage(new Ping())).toBe(false);
    expect(widget.postMessage(new SubPing())).toBe(true);
    await framework.whenIdle();
    expect(received).toEqual(["SubPing", "SubPing"]);

    widget.enableMessages(Ping);
    expect(widget.postMessage(new Ping())).toBe(true);
    await framework.whenIdle();
    expect(received).toEqual(["SubPing", "SubPing", "Ping"]);

    unsubscribe();
    instance.unmount();
    instance.cleanup();
  });

  it("dispatches key_<name> handlers directly and resolves aliases", async () => {
    const framework = new App().framework;
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
    const framework = new App().framework;

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

    const secondFramework = new App().framework;
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
    const framework = new App().framework;
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
    const framework = new App().framework;
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
    expect(() => on(Ping, "#save", () => undefined)).toThrow(OnDecoratorError);
    expect(() => on(PanePing, { missing: "#one" }, () => undefined)).toThrow(OnDecoratorError);
  });

  it("accepts valid @on attribute selector declarations", () => {
    const pane = new App().framework;
    const widget = new Widget({
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

  it("matches positional @on selectors against the declared selector attribute", async () => {
    const framework = new App().framework;
    const received: string[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost typeName="Leaf" id="save">
          <Text>leaf</Text>
        </WidgetHost>
        <WidgetHost
          typeName="Observer"
          handlers={{
            onControlPing: on(ControlPing, "#save", () => {
              received.push("matched");
            }),
          }}
        >
          <Text>observer</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    const leaf = framework.registry.getByCssId("save")!;
    const observer = framework.registry.list().find((entry) => entry.typeName === "Observer")!;

    framework.postMessage(observer.nodeId, new ControlPing(leaf));
    await framework.whenIdle();

    expect(received).toEqual(["matched"]);

    instance.unmount();
    instance.cleanup();
  });

  it("throws when selector-matched message attributes are not registered widgets", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="Observer"
          handlers={{
            onControlPing: on(ControlPing, "#save", () => undefined),
          }}
        >
          <Text>observer</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();
    const observer = framework.registry.list()[0]!;
    framework.postMessage(observer.nodeId, new ControlPing("not-widget" as unknown as Widget));

    await expect(framework.whenIdle()).rejects.toThrow(/not a widget/);

    instance.unmount();
    instance.cleanup();
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

  it("exposes Key.character as null for non-character keys", () => {
    expect(new Key("enter").character).toBeNull();
    expect(new Key("a", "a").character).toBe("a");
  });

  it("throws DuplicateIds for duplicate widget ids", async () => {
    const framework = new App().framework;
    const first = new Widget({
      framework,
      nodeId: "first",
      parentId: null,
      id: "dupe",
      classes: [],
      typeName: "First",
      handlersRef: { current: undefined },
      actionsRef: { current: undefined },
      bindingsRef: { current: [] },
      focusable: false,
      autoFocus: false,
      disabled: false,
      loading: false,
      tooltip: null,
    });
    const second = new Widget({
      framework,
      nodeId: "second",
      parentId: null,
      id: "dupe",
      classes: [],
      typeName: "Second",
      handlersRef: { current: undefined },
      actionsRef: { current: undefined },
      bindingsRef: { current: [] },
      focusable: false,
      autoFocus: false,
      disabled: false,
      loading: false,
      tooltip: null,
    });

    framework.registerWidget(first);

    expect(() => framework.registerWidget(second)).toThrow(DuplicateIds);
  });

  it("cleans up signal subscriptions when a widget unmounts", async () => {
    const framework = new App().framework;
    let publisher!: Widget;
    let subscriber!: Widget;
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

  it("returned signal cleanup removes only its own subscription", async () => {
    const framework = new App().framework;
    let publisher!: Widget;
    let subscriber!: Widget;

    const instance = render(
      <TextualApp framework={framework}>
        <HandleHarness
          id="publisher"
          onReady={(value) => {
            publisher = value;
          }}
        />
        <HandleHarness
          id="subscriber"
          onReady={(value) => {
            subscriber = value;
          }}
        />
      </TextualApp>,
    );

    await framework.whenIdle();

    const signal = publisher.createSignal<string>();
    const received: string[] = [];
    const callback = (value: string): void => {
      received.push(value);
    };
    const firstCleanup = signal.subscribe(subscriber, callback, true);
    signal.subscribe(subscriber, callback, true);

    firstCleanup();
    signal.publish("only-second");

    expect(received).toEqual(["only-second"]);

    instance.unmount();
    instance.cleanup();
  });

  it("rejects signal subscriptions from unmounted widgets", () => {
    const framework = new App().framework;
    const publisher = new Widget({
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
    const subscriber = new Widget({
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
