import { App } from "../src/index.js";
import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { Footer, WidgetHost, runTest } from "../src/index.js";

describe("footer active bindings", () => {
  it("renders focused widget bindings before app bindings", async () => {
    const session = await runTest(
      <>
        <WidgetHost
          typeName="Parent"
          bindings={[{ key: "f2", action: "parent_action", description: "Parent" }]}
          actions={{
            action_parent_action: () => undefined,
          }}
        >
          <WidgetHost
            typeName="Leaf"
            id="leaf"
            focusable
            autoFocus
            bindings={[{ key: "f1", action: "leaf_action", description: "Leaf" }]}
            actions={{
              action_leaf_action: () => undefined,
            }}
          >
            <Text>leaf</Text>
          </WidgetHost>
        </WidgetHost>
        <Footer />
      </>,
      {
        appProps: {
          bindings: [{ key: "f3", action: "app_action", description: "App" }],
          actions: {
            action_app_action: () => undefined,
          },
        },
      },
    );

    const frame = session.lastFrame() ?? "";
    expect(frame).toContain("f1 Leaf");
    expect(frame).toContain("f2 Parent");
    expect(frame).toContain("f3 App");
    expect(frame.indexOf("f1 Leaf")).toBeLessThan(frame.indexOf("f3 App"));

    session.unmount();
  });

  it("omits hidden bindings, keeps null-gated bindings disabled, and lets priority win display precedence", async () => {
    const session = await runTest(
      <>
        <WidgetHost
          typeName="Leaf"
          id="leaf"
          focusable
          autoFocus
          bindings={[
            { key: "f1", action: "save", description: "Save" },
            { key: "f2", action: "hidden", description: "Hidden", show: false },
            { key: "f3", action: "disabled", description: "Disabled" },
          ]}
          actions={{
            action_save: () => undefined,
            action_hidden: () => undefined,
            action_disabled: () => {
              throw new Error("disabled binding should not run");
            },
            checkAction: (action) => {
              if (action === "disabled") {
                return null;
              }

              return true;
            },
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
        <Footer />
      </>,
      {
        appProps: {
          bindings: [{ key: "f1", action: "app_quit", description: "Quit", priority: true }],
          actions: {
            action_app_quit: () => undefined,
          },
        },
      },
    );

    const frame = session.lastFrame() ?? "";
    const activeBindings = session.framework.getActiveBindings();

    expect(frame).toContain("f1 Quit");
    expect(frame).not.toContain("Hidden");
    expect(frame).toContain("f3 Disabled");
    expect(activeBindings.find((binding) => binding.key === "f3")?.enabled).toBe(false);
    expect(activeBindings.find((binding) => binding.key === "f1")?.description).toBe("Quit");

    session.unmount();
  });

  it("refreshes when focus changes and clicking a footer key runs its action repeatedly", async () => {
    const calls: string[] = [];
    const session = await runTest(
      <>
        <WidgetHost
          typeName="First"
          id="first"
          focusable
          autoFocus
          bindings={[{ key: "f1", action: "first_action", description: "First" }]}
          actions={{
            action_first_action: () => {
              calls.push("first");
            },
          }}
        >
          <Text>first</Text>
        </WidgetHost>
        <WidgetHost
          typeName="Second"
          id="second"
          focusable
          bindings={[{ key: "f2", action: "second_action", description: "Second" }]}
          actions={{
            action_second_action: () => {
              calls.push("second");
            },
          }}
        >
          <Text>second</Text>
        </WidgetHost>
        <Footer />
      </>,
      { appProps: { framework: new App().framework } },
    );

    expect(session.lastFrame()).toContain("f1 First");
    expect(session.lastFrame()).not.toContain("f2 Second");

    session.framework.focusWidget(session.framework.registry.getByCssId("second")!.nodeId);
    await session.pilot.pause();

    expect(session.lastFrame()).toContain("f2 Second");
    expect(session.lastFrame()).not.toContain("f1 First");

    await session.pilot.click("FooterKey");
    await session.pilot.click("FooterKey");
    expect(calls).toEqual(["second", "second"]);

    session.unmount();
  });

  it("renders compact mode without descriptions", async () => {
    const session = await runTest(
      <>
        <WidgetHost
          typeName="Leaf"
          id="leaf"
          focusable
          autoFocus
          bindings={[{ key: "f1", action: "leaf_action", description: "Leaf" }]}
          actions={{
            action_leaf_action: () => undefined,
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
        <Footer compact />
      </>,
    );

    expect(session.lastFrame()).toContain("f1");
    expect(session.lastFrame()).not.toContain("Leaf");

    session.unmount();
  });
});
