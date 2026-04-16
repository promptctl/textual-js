import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";

import { normalizeColor, TextualApp, TextualFramework, WidgetHost } from "../src/index.js";

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
});
