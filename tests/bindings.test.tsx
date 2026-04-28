import { App } from "../src/index.js";
import React, { useEffect } from "react";
import { Text } from "ink";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import {
  ActionError,
  BindingsMap,
  NoBinding,
  type BindingClash,
  type BindingNamespace,
  SkipAction,
  TextualApp,
  WidgetHost,
  makeBindings,
  parseAction,
  useTextual,
  useWidget,
} from "../src/index.js";

async function settleBindings(app: App): Promise<void> {
  await app.whenIdle();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await app.whenIdle();
}

function BindingSignalProbe({ onUpdate }: { onUpdate: () => void }): React.JSX.Element {
  const framework = useTextual();
  const { handle } = useWidget({ typeName: "BindingSignalProbe" });

  useEffect(() => {
    return framework.signals.bindings_updated_signal.subscribe(handle, onUpdate);
  }, [framework, handle, onUpdate]);

  return <Text>probe</Text>;
}

describe("action parsing", () => {
  it("parses bare names, namespaced names, and literal argument lists", () => {
    expect(parseAction("save")).toEqual({ namespace: "", actionName: "save", params: [] });
    expect(parseAction("app.quit")).toEqual({ namespace: "app", actionName: "quit", params: [] });
    expect(parseAction("foo.bar.baz(True, False, None)")).toEqual({
      namespace: "foo.bar",
      actionName: "baz",
      params: [true, false, null],
    });
    expect(parseAction("focus('input')")).toEqual({ namespace: "", actionName: "focus", params: ["input"] });
    expect(parseAction("delete(true)")).toEqual({ namespace: "", actionName: "delete", params: [true] });
    expect(parseAction("add(1, 2, 3)")).toEqual({ namespace: "", actionName: "add", params: [1, 2, 3] });
    expect(parseAction("dismiss('a,(b),c', null, undefined)")).toEqual({
      namespace: "",
      actionName: "dismiss",
      params: ["a,(b),c", null, undefined],
    });
    expect(parseAction("save([1, 2], ('x', 3.5))")).toEqual({
      namespace: "",
      actionName: "save",
      params: [[1, 2], ["x", 3.5]],
    });
  });

  it("rejects malformed action strings", () => {
    expect(() => parseAction("foo(")).toThrow(ActionError);
    expect(() => parseAction("foo(1")).toThrow(ActionError);
    expect(() => parseAction("foo(1,)")).toThrow(ActionError);
    expect(() => parseAction("foo(1 2)")).toThrow(ActionError);
    expect(() => parseAction("foo([1,])")).toThrow(ActionError);
    expect(() => parseAction("foo((1,))")).toThrow(ActionError);
    expect(() => parseAction("1bad.name")).toThrow(ActionError);
    expect(() => parseAction("bad-name.action")).toThrow(ActionError);
  });
});

describe("binding normalization", () => {
  it("expands comma-separated keys and trims whitespace", () => {
    const bindings = makeBindings([
      { key: "f1, question_mark", action: "help" },
    ]);

    expect(bindings.map((entry) => entry.key)).toEqual(["f1", "question_mark"]);
    expect(bindings.every((entry) => entry.action === "help")).toBe(true);
  });

  it("normalizes single-character keys to canonical names", () => {
    const bindings = makeBindings([{ key: "?", action: "help" }]);
    expect(bindings[0].key).toBe("question_mark");
    expect(makeBindings([{ key: "$", action: "pay" }])[0].key).toBe("dollar_sign");
  });

  it("accepts tuple shorthand and produces Binding entries", () => {
    const bindings = makeBindings([
      ["ctrl+s", "save"],
      ["ctrl+z", "undo", "Undo"],
    ]);

    expect(bindings[0]).toMatchObject({ key: "ctrl+s", action: "save" });
    expect(bindings[1]).toMatchObject({ key: "ctrl+z", action: "undo", description: "Undo" });
  });

  it("stores bindings in BindingsMap with merge and shown-key helpers", () => {
    const appMap = new BindingsMap([{ key: "?", action: "help", description: "Help" }]);
    const widgetMap = new BindingsMap();
    widgetMap.bind("ctrl+s", "save", "Save", { show: true });

    const merged = BindingsMap.merge([appMap, widgetMap]);

    expect(appMap.getBindingsForKey("question_mark")[0].action).toBe("help");
    expect(merged.getBindingsForKey("ctrl+s")[0].action).toBe("save");
    expect(merged.shownKeys.map((binding) => binding.action)).toEqual(["help", "save"]);
    expect(() => merged.getBindingsForKey("f12")).toThrow(NoBinding);
  });
});

describe("binding dispatch", () => {
  it("runs widget bindings before ancestor bindings before screen before app", async () => {
    const app = new App();
    const framework = app.framework;
    const order: string[] = [];

    const instance = render(
      <TextualApp
        framework={framework}
        bindings={[{ key: "ctrl+s", action: "save" }]}
        actions={{
          action_save: () => {
            order.push("app");
          },
        }}
      >
        <WidgetHost
          typeName="Container"
          bindings={[{ key: "ctrl+s", action: "save" }]}
          actions={{
            action_save: () => {
              order.push("ancestor");
            },
          }}
        >
          <WidgetHost
            typeName="Leaf"
            id="leaf"
            focusable
            autoFocus
            bindings={[{ key: "ctrl+s", action: "save" }]}
            actions={{
              action_save: () => {
                order.push("leaf");
              },
            }}
          >
            <Text>leaf</Text>
          </WidgetHost>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("s", { ctrl: true });
    await app.whenIdle();

    expect(order).toEqual(["leaf"]);

    // Remove the leaf's binding and try again — the ancestor binding must fire.
    const leafNode = framework.registry.getByCssId("leaf")!;
    leafNode.bindingsRef.current = [];

    app.postKey("s", { ctrl: true });
    await app.whenIdle();

    expect(order).toEqual(["leaf", "ancestor"]);

    instance.unmount();
    instance.cleanup();
  });

  it("fires the hard-coded ctrl+q priority binding before the key reaches widget handlers", async () => {
    const app = new App();
    const framework = app.framework;
    const order: string[] = [];

    const instance = render(
      <TextualApp
        framework={framework}
        actions={{
          action_quit: () => {
            order.push("app");
          },
        }}
      >
        <WidgetHost
          typeName="Leaf"
          focusable
          autoFocus
          handlers={{
            onKey: () => {
              order.push("leaf-key");
            },
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("q", { ctrl: true });
    await app.whenIdle();

    expect(order).toEqual(["app"]);

    instance.unmount();
    instance.cleanup();
  });

  it("respects checkAction gates: true enables, null disables, false hides", async () => {
    const app = new App();
    const framework = app.framework;
    let callCount = 0;

    const instance = render(
      <TextualApp
        framework={framework}
        bindings={[{ key: "f2", action: "app.gated" }]}
        actions={{
          action_gated: () => {
            callCount += 1;
          },
          checkAction: (name) => (name === "gated" ? false : true),
        }}
      >
        <WidgetHost typeName="Leaf" focusable autoFocus>
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("f2");
    await app.whenIdle();

    expect(callCount).toBe(0);
    expect(app.checkAction("app.gated")).toBe(false);

    instance.unmount();
    instance.cleanup();
  });

  it("routes binding dispatch through the action namespace", async () => {
    // [LAW:behavior-not-structure] Verify binding → action wiring by
    // observing the action handler runs, not by patching runAction. The
    // action name "save" only resolves to action_save when the dispatcher
    // routes through the action namespace; a parallel bypass path would
    // not match this contract.
    let saveCallCount = 0;
    const app = new App();
    const framework = app.framework;
    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="Leaf"
          focusable
          autoFocus
          bindings={[{ key: "f4", action: "save" }]}
          actions={{
            action_save: () => {
              saveCallCount += 1;
            },
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("f4");
    await app.whenIdle();

    expect(saveCallCount).toBe(1);

    instance.unmount();
    instance.cleanup();
  });

  it("consumes disabled bindings instead of bubbling past them", async () => {
    const app = new App();
    const framework = app.framework;
    const order: string[] = [];

    const instance = render(
      <TextualApp
        framework={framework}
        bindings={[{ key: "f2", action: "fallback" }]}
        actions={{
          action_fallback: () => {
            order.push("app");
          },
        }}
      >
        <WidgetHost
          typeName="Leaf"
          focusable
          autoFocus
          bindings={[{ key: "f2", action: "primary" }]}
          actions={{
            action_primary: () => {
              order.push("leaf");
            },
            checkAction: (name) => (name === "primary" ? null : true),
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("f2");
    await app.whenIdle();

    expect(order).toEqual([]);

    instance.unmount();
    instance.cleanup();
  });

  it("lets SkipAction fall through to the next binding in the chain", async () => {
    const app = new App();
    const framework = app.framework;
    const order: string[] = [];

    const instance = render(
      <TextualApp
        framework={framework}
        bindings={[{ key: "f3", action: "fallback" }]}
        actions={{
          action_fallback: () => {
            order.push("fallback");
          },
        }}
      >
        <WidgetHost
          typeName="Leaf"
          focusable
          autoFocus
          bindings={[{ key: "f3", action: "primary" }]}
          actions={{
            action_primary: () => {
              order.push("primary");
              throw new SkipAction();
            },
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("f3");
    await app.whenIdle();

    expect(order).toEqual(["primary", "fallback"]);

    instance.unmount();
    instance.cleanup();
  });

  it("lets SkipAction fall through after a keymap remap", async () => {
    const app = new App();
    const framework = app.framework;
    const order: string[] = [];

    app.setKeymap({ primary: "f6" });

    const instance = render(
      <TextualApp
        framework={framework}
        bindings={[{ key: "f6", action: "fallback" }]}
        actions={{
          action_fallback: () => {
            order.push("fallback");
          },
        }}
      >
        <WidgetHost
          typeName="Leaf"
          focusable
          autoFocus
          bindings={[{ key: "f3", action: "primary", id: "primary" }]}
          actions={{
            action_primary: () => {
              order.push("primary");
              throw new SkipAction();
            },
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("f6");
    await app.whenIdle();

    expect(order).toEqual(["primary", "fallback"]);

    instance.unmount();
    instance.cleanup();
  });

  it("replaces the full keymap, merges updates, and publishes bindings_updated_signal", async () => {
    const app = new App();
    const framework = app.framework;
    const onUpdate = vi.fn();
    const order: string[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <BindingSignalProbe onUpdate={onUpdate} />
        <WidgetHost
          typeName="Leaf"
          focusable
          autoFocus
          bindings={[
            { key: "f1", action: "alpha", id: "alpha" },
            { key: "f2", action: "beta", id: "beta" },
          ]}
          actions={{
            action_alpha: () => {
              order.push("alpha");
            },
            action_beta: () => {
              order.push("beta");
            },
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await settleBindings(app);
    onUpdate.mockClear();

    app.setKeymap({ alpha: "f5" });
    await settleBindings(app);
    app.updateKeymap({ beta: "f6" });
    await settleBindings(app);

    app.postKey("f1");
    app.postKey("f2");
    app.postKey("f5");
    app.postKey("f6");
    await app.whenIdle();

    expect(order).toEqual(["alpha", "beta"]);
    expect(onUpdate).toHaveBeenCalledTimes(2);

    instance.unmount();
    instance.cleanup();
  });

  it("applies pre-mount keymaps once the app starts", async () => {
    const app = new App();
    const framework = app.framework;
    const order: string[] = [];

    app.updateKeymap({ save: "f7" });

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="Leaf"
          focusable
          autoFocus
          bindings={[{ key: "ctrl+s", action: "save", id: "save" }]}
          actions={{
            action_save: () => {
              order.push("save");
            },
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("s", { ctrl: true });
    app.postKey("f7");
    await app.whenIdle();

    expect(order).toEqual(["save"]);

    instance.unmount();
    instance.cleanup();
  });

  it("ignores unknown keymap ids and deactivates the original binding key after remap", async () => {
    const app = new App();
    const framework = app.framework;
    const order: string[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="Leaf"
          focusable
          autoFocus
          bindings={[{ key: "ctrl+s", action: "save", id: "save" }]}
          actions={{
            action_save: () => {
              order.push("save");
            },
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.setKeymap({ save: "f8", unknown: "f9" });
    await app.whenIdle();

    app.postKey("s", { ctrl: true });
    app.postKey("f8");
    app.postKey("f9");
    await app.whenIdle();

    expect(order).toEqual(["save"]);

    instance.unmount();
    instance.cleanup();
  });

  it("remaps shared binding ids on both parent and child bindings", async () => {
    const app = new App();
    const framework = app.framework;
    const order: string[] = [];

    app.setKeymap({ save: "f8" });

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="Container"
          bindings={[{ key: "ctrl+s", action: "save", id: "save" }]}
          actions={{
            action_save: () => {
              order.push("ancestor");
            },
          }}
        >
          <WidgetHost
            typeName="Leaf"
            id="leaf"
            focusable
            autoFocus
            bindings={[{ key: "ctrl+s", action: "save", id: "save" }]}
            actions={{
              action_save: () => {
                order.push("leaf");
              },
            }}
          >
            <Text>leaf</Text>
          </WidgetHost>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("f8");
    await app.whenIdle();

    const leafNode = framework.registry.getByCssId("leaf")!;
    leafNode.bindingsRef.current = [];

    app.postKey("f8");
    await app.whenIdle();

    expect(order).toEqual(["leaf", "ancestor"]);

    instance.unmount();
    instance.cleanup();
  });

  it("remaps only the binding ids present in the keymap", async () => {
    const app = new App();
    const framework = app.framework;
    const order: string[] = [];

    app.setKeymap({ ancestor_save: "f9" });

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="Container"
          bindings={[{ key: "ctrl+s", action: "save", id: "ancestor_save" }]}
          actions={{
            action_save: () => {
              order.push("ancestor");
            },
          }}
        >
          <WidgetHost
            typeName="Leaf"
            id="leaf"
            focusable
            autoFocus
            bindings={[{ key: "ctrl+s", action: "save", id: "leaf_save" }]}
            actions={{
              action_save: () => {
                order.push("leaf");
              },
            }}
          >
            <Text>leaf</Text>
          </WidgetHost>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("s", { ctrl: true });
    await app.whenIdle();

    const leafNode = framework.registry.getByCssId("leaf")!;
    leafNode.bindingsRef.current = [];

    app.postKey("s", { ctrl: true });
    app.postKey("f9");
    await app.whenIdle();

    expect(order).toEqual(["leaf", "ancestor"]);

    instance.unmount();
    instance.cleanup();
  });

  it("reports per-namespace key clashes only once for the active chain", async () => {
    const app = new App();
    const framework = app.framework;
    const clashes: Array<{ clashes: BindingClash[]; namespace: BindingNamespace }> = [];
    const clashSpy = vi
      .spyOn(framework, "handleBindingsClash")
      .mockImplementation((nextClashes, namespace) => {
        clashes.push({ clashes: nextClashes, namespace });
      });

    const instance = render(
      <TextualApp
        framework={framework}
        bindings={[
          { key: "f1", action: "alpha", id: "alpha" },
          { key: "f2", action: "beta", id: "beta" },
        ]}
        actions={{
          action_alpha: () => undefined,
          action_beta: () => undefined,
        }}
      >
        <WidgetHost typeName="Leaf" focusable autoFocus>
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await settleBindings(app);

    app.setKeymap({ alpha: "f10", beta: "f10" });
    await settleBindings(app);
    app.postKey("f10");
    await app.whenIdle();

    expect(clashes).toHaveLength(1);
    expect(clashes[0]?.namespace.kind).toBe("app");
    expect(clashes[0]?.clashes[0]?.bindings.map((binding) => binding.action)).toEqual(["alpha", "beta"]);
    clashSpy.mockRestore();

    instance.unmount();
    instance.cleanup();
  });

  it("fires the hard-coded ctrl+c quit binding when nothing lower handles it", async () => {
    const app = new App();
    const framework = app.framework;
    const order: string[] = [];

    const instance = render(
      <TextualApp
        framework={framework}
        actions={{
          action_quit: () => {
            order.push("quit");
          },
        }}
      >
        <WidgetHost typeName="Leaf" focusable autoFocus>
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("c", { ctrl: true });
    await app.whenIdle();

    expect(order).toEqual(["quit"]);

    instance.unmount();
    instance.cleanup();
  });

  it("routes the hard-coded ctrl+p binding to action_command_palette", async () => {
    const app = new App();
    const framework = app.framework;
    const order: string[] = [];

    const instance = render(
      <TextualApp
        framework={framework}
        actions={{
          action_command_palette: () => {
            order.push("palette");
          },
        }}
      >
        <WidgetHost typeName="Leaf" focusable autoFocus>
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("p", { ctrl: true });
    await app.whenIdle();

    expect(order).toEqual(["palette"]);

    instance.unmount();
    instance.cleanup();
  });

  it("keeps the hard-coded ctrl+p binding as a safe no-op by default", async () => {
    const app = new App();
    const framework = app.framework;

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost typeName="Leaf" focusable autoFocus>
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    app.postKey("p", { ctrl: true });
    await app.whenIdle();

    expect(app.isRunning).toBe(true);

    instance.unmount();
    instance.cleanup();
  });

  it("resolves namespace.action targets independent of the caller", () => {
    const app = new App();
    const framework = app.framework;
    const log: string[] = [];

    framework.setAppBindings([]);
    framework.setAppActions({
      action_alpha: () => {
        log.push("app.alpha");
      },
    });

    app.pushScreen(
      <Text>screen</Text>,
      {
        actions: {
          action_beta: () => {
            log.push("screen.beta");
          },
        },
        name: "dialog",
      },
    );

    expect(app.runAction("app.alpha")).toBe(true);
    expect(app.runAction("screen.beta")).toBe(true);
    expect(log).toEqual(["app.alpha", "screen.beta"]);
  });
});
