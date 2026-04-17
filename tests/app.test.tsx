import React, { useLayoutEffect } from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";

import { Message, normalizeColor, TextualApp, TextualFramework, WidgetHost, useTextual } from "../src/index.js";

class Ping extends Message {}

function AppDispatcher(props: { onReady: (framework: TextualFramework) => void }): null {
  const framework = useTextual();

  useLayoutEffect(() => {
    props.onReady(framework);
  }, [framework, props]);

  return null;
}

describe("TextualApp and widget registry", () => {
  it("renders inside ink-testing-library and exposes framework services", async () => {
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost typeName="Label" id="greeting">
          <Text>Hello</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    expect(instance.lastFrame()).toContain("Hello");
    expect(framework.isRunning).toBe(true);
    expect(framework.registry.version).toBe(1);
    expect(framework.registry.getByCssId("greeting")?.typeName).toBe("Label");

    instance.unmount();
    instance.cleanup();
  });

  it("registers on mount and deregisters on unmount", async () => {
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost typeName="Widget">
          <Text>Mounted</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    expect(framework.registry.list()).toHaveLength(1);
    expect(framework.registry.version).toBe(1);

    instance.unmount();
    instance.cleanup();

    expect(framework.registry.list()).toHaveLength(0);
    expect(framework.registry.version).toBe(2);
    expect(framework.isRunning).toBe(false);
  });

  it("accepts app-level css through the stage-0 startup surface", async () => {
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp
        framework={framework}
        css={`
          Label {
            color: red;
          }
        `}
      >
        <WidgetHost typeName="Label" id="styled-label">
          <Text>Hello</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    expect(framework.registry.getByCssId("styled-label")?.resolvedStyles.getRule("color")).toBe(normalizeColor("red"));

    instance.unmount();
    instance.cleanup();
  });

  it("exposes an app-level dispatch surface through TextualApp context", async () => {
    const framework = new TextualFramework();
    let appContext!: TextualFramework;
    const senders: unknown[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <AppDispatcher
          onReady={(value) => {
            appContext = value;
          }}
        />
        <WidgetHost
          typeName="Leaf"
          id="leaf"
          focusable
          autoFocus
          handlers={{
            onPing: (message) => {
              senders.push(message.sender);
            },
          }}
        >
          <Text>leaf</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    appContext.dispatchMessage(new Ping());
    await framework.whenIdle();

    expect(senders).toEqual([null]);

    instance.unmount();
    instance.cleanup();
  });
});
