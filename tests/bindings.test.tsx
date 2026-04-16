import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";

import {
  ActionError,
  SkipAction,
  TextualApp,
  TextualFramework,
  WidgetHost,
  makeBindings,
  parseAction,
} from "../src/index.js";

describe("action parsing", () => {
  it("parses bare names, namespaced names, and literal argument lists", () => {
    expect(parseAction("save")).toEqual({ namespace: "", actionName: "save", params: [] });
    expect(parseAction("app.quit")).toEqual({ namespace: "app", actionName: "quit", params: [] });
    expect(parseAction("focus('input')")).toEqual({ namespace: "", actionName: "focus", params: ["input"] });
    expect(parseAction("delete(true)")).toEqual({ namespace: "", actionName: "delete", params: [true] });
    expect(parseAction("add(1, 2, 3)")).toEqual({ namespace: "", actionName: "add", params: [1, 2, 3] });
  });

  it("rejects malformed action strings", () => {
    expect(() => parseAction("foo(")).toThrow(ActionError);
    expect(() => parseAction("foo(1")).toThrow(ActionError);
    expect(() => parseAction("1bad.name")).toThrow(ActionError);
    expect(() => parseAction("bogus.name")).toThrow(ActionError);
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
  });

  it("accepts tuple shorthand and produces Binding entries", () => {
    const bindings = makeBindings([
      ["ctrl+s", "save"],
      ["ctrl+z", "undo", "Undo"],
    ]);

    expect(bindings[0]).toMatchObject({ key: "ctrl+s", action: "save" });
    expect(bindings[1]).toMatchObject({ key: "ctrl+z", action: "undo", description: "Undo" });
  });
});

describe("binding dispatch", () => {
  it("runs widget bindings before ancestor bindings before screen before app", async () => {
    const framework = new TextualFramework();
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

    await framework.whenIdle();

    framework.postKey("s", { ctrl: true });
    await framework.whenIdle();

    expect(order).toEqual(["leaf"]);

    // Remove the leaf's binding and try again — the ancestor binding must fire.
    const leafNode = framework.registry.getByCssId("leaf")!;
    leafNode.bindingsRef.current = [];

    framework.postKey("s", { ctrl: true });
    await framework.whenIdle();

    expect(order).toEqual(["leaf", "ancestor"]);

    instance.unmount();
    instance.cleanup();
  });

  it("fires priority bindings before the key reaches widget handlers", async () => {
    const framework = new TextualFramework();
    const order: string[] = [];

    const instance = render(
      <TextualApp
        framework={framework}
        bindings={[{ key: "ctrl+q", action: "quit_app", priority: true }]}
        actions={{
          action_quit_app: () => {
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

    await framework.whenIdle();

    framework.postKey("q", { ctrl: true });
    await framework.whenIdle();

    expect(order).toEqual(["app"]);

    instance.unmount();
    instance.cleanup();
  });

  it("respects checkAction gates: true enables, null disables, false hides", async () => {
    const framework = new TextualFramework();
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

    await framework.whenIdle();

    framework.postKey("f2");
    await framework.whenIdle();

    expect(callCount).toBe(0);
    expect(framework.checkAction("app.gated")).toBe(false);

    instance.unmount();
    instance.cleanup();
  });

  it("lets SkipAction fall through to the next binding in the chain", async () => {
    const framework = new TextualFramework();
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

    await framework.whenIdle();

    framework.postKey("f3");
    await framework.whenIdle();

    expect(order).toEqual(["primary", "fallback"]);

    instance.unmount();
    instance.cleanup();
  });

  it("resolves namespace.action targets independent of the caller", () => {
    const framework = new TextualFramework();
    const log: string[] = [];

    framework.setAppBindings([]);
    framework.setAppActions({
      action_alpha: () => {
        log.push("app.alpha");
      },
    });

    framework.pushScreen(
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

    expect(framework.runAction("app.alpha")).toBe(true);
    expect(framework.runAction("screen.beta")).toBe(true);
    expect(log).toEqual(["app.alpha", "screen.beta"]);
  });
});
