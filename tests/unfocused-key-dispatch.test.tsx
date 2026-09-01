import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";

import { App, Input, Paste, Resize, TextualApp, WidgetHost } from "../src/index.js";

// A key pressed while nothing holds focus still belongs to the screen and then
// the app, exactly as it does in Python Textual. These tests pin the route
// itself: they assert where an unfocused key ends up, which is the one thing a
// settled-state assertion cannot see.

interface Harness {
  app: App;
  fired: string[];
  cleanup: () => void;
}

function mount(children: React.ReactNode): Harness {
  const app = new App();
  const fired: string[] = [];

  const instance = render(
    <TextualApp
      app={app}
      autoFocus={null}
      bindings={[{ key: "f5", action: "refresh" }]}
      actions={{
        action_refresh: () => {
          fired.push("f5");
        },
      }}
    >
      {children}
    </TextualApp>,
  );

  return {
    app,
    fired,
    cleanup: () => {
      instance.unmount();
      instance.cleanup();
    },
  };
}

describe("key dispatch with nothing focused", () => {
  it("routes tab to the app's focus_next binding so focus can start from the keyboard", async () => {
    const harness = mount(
      <WidgetHost typeName="Leaf" id="leaf" focusable>
        <Text>leaf</Text>
      </WidgetHost>,
    );

    await harness.app.whenIdle();
    expect(harness.app.focusedNodeId).toBeNull();

    harness.app.postKey("tab");
    await harness.app.whenIdle();

    const leaf = harness.app.findWidgets("Leaf")[0]!;
    expect(harness.app.focusedNodeId).toBe(leaf.nodeId);

    harness.cleanup();
  });

  it("gives an unfocused Input focus on tab instead of letting it swallow the key", async () => {
    const harness = mount(<Input id="target" placeholder="Focused input" />);

    await harness.app.whenIdle();
    expect(harness.app.focusedNodeId).toBeNull();

    harness.app.postKey("tab");
    await harness.app.whenIdle();

    const input = harness.app.findWidgets("Input")[0]!;
    expect(harness.app.focusedNodeId).toBe(input.nodeId);

    harness.cleanup();
  });

  it("runs an app-level binding on a non-tab key while nothing is focused", async () => {
    const harness = mount(
      <WidgetHost typeName="Leaf" id="leaf" focusable>
        <Text>leaf</Text>
      </WidgetHost>,
    );

    await harness.app.whenIdle();
    expect(harness.app.focusedNodeId).toBeNull();

    harness.app.postKey("f5");
    await harness.app.whenIdle();

    expect(harness.fired).toEqual(["f5"]);

    harness.cleanup();
  });

  it("reaches app-level bindings even when the app holds no focusable widget at all", async () => {
    const harness = mount(<Text>nothing focusable here</Text>);

    await harness.app.whenIdle();

    harness.app.postKey("f5");
    await harness.app.whenIdle();

    expect(harness.fired).toEqual(["f5"]);

    harness.cleanup();
  });

  // Only keys gain the screen/app route. Paste and Resize have no app-level
  // route to fall through to, so they keep reaching a widget when focus is
  // absent — the key route must not quietly take them with it.
  it("still delivers paste to a widget while nothing is focused", async () => {
    const pasted: string[] = [];
    const harness = mount(
      <WidgetHost
        typeName="Leaf"
        id="leaf"
        focusable
        handlers={{
          onPaste: (message) => {
            pasted.push((message as Paste).text);
          },
        }}
      >
        <Text>leaf</Text>
      </WidgetHost>,
    );

    await harness.app.whenIdle();
    expect(harness.app.focusedNodeId).toBeNull();

    harness.app.postPaste("hello");
    await harness.app.whenIdle();

    expect(pasted).toEqual(["hello"]);

    harness.cleanup();
  });

  it("still delivers resize to a widget while nothing is focused", async () => {
    const sizes: string[] = [];
    const harness = mount(
      <WidgetHost
        typeName="Leaf"
        id="leaf"
        focusable
        handlers={{
          onResize: (message) => {
            const resize = message as Resize;
            sizes.push(`${resize.width}x${resize.height}`);
          },
        }}
      >
        <Text>leaf</Text>
      </WidgetHost>,
    );

    await harness.app.whenIdle();
    expect(harness.app.focusedNodeId).toBeNull();

    harness.app.postResize(120, 40);
    await harness.app.whenIdle();

    expect(sizes).toEqual(["120x40"]);

    harness.cleanup();
  });

  it("does not deliver an unfocused key into an unfocused widget's key handler", async () => {
    const received: string[] = [];
    const harness = mount(
      <WidgetHost
        typeName="Leaf"
        id="leaf"
        focusable
        handlers={{
          onKey: () => {
            received.push("leaf");
          },
        }}
      >
        <Text>leaf</Text>
      </WidgetHost>,
    );

    await harness.app.whenIdle();

    harness.app.postKey("f5");
    await harness.app.whenIdle();

    expect(received).toEqual([]);
    expect(harness.fired).toEqual(["f5"]);

    harness.cleanup();
  });
});
