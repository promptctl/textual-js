import React from "react";
import { Text } from "ink";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

import { App, Input, Key, TextualApp, WidgetHost } from "../src/index.js";

async function settle(app: App): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await app.whenIdle();
}

async function writeRawKey(instance: ReturnType<typeof render>, app: App, data: string): Promise<void> {
  instance.stdin.write(data);
  await settle(app);
}

describe("TextualApp raw key bridge", () => {
  it("routes raw terminal bytes for extended named keys to the focused widget", async () => {
    const received: string[] = [];
    const app = new App();

    function KeyHarness(): React.JSX.Element {
      return (
        <WidgetHost
          typeName="KeyHarness"
          focusable
          autoFocus
          handlers={{
            onKey: (event) => {
              received.push((event as Key).key);
            },
          }}
        >
          <Text>keys</Text>
        </WidgetHost>
      );
    }

    const instance = render(
      <TextualApp app={app}>
        <KeyHarness />
      </TextualApp>,
    );
    await settle(app);

    await writeRawKey(instance, app, "\u001b[H");
    await writeRawKey(instance, app, "\u001b[1~");
    await writeRawKey(instance, app, "\u001bOP");
    await writeRawKey(instance, app, "\u001b[2~");
    await writeRawKey(instance, app, "\u001b[E");
    await writeRawKey(instance, app, "\u001b[A");
    await writeRawKey(instance, app, "\t");

    expect(received).toEqual(["home", "home", "f1", "insert", "clear", "up", "tab"]);

    instance.unmount();
  });

  it("makes Input home and end bindings reachable from raw terminal bytes", async () => {
    const app = new App();
    const instance = render(
      <TextualApp app={app}>
        <Input value="abc" />
      </TextualApp>,
    );
    await settle(app);

    app.focusNext("Input");
    await settle(app);

    await writeRawKey(instance, app, "\u001b[H");
    await writeRawKey(instance, app, "X");
    await writeRawKey(instance, app, "\u001b[F");
    await writeRawKey(instance, app, "Y");

    expect(instance.lastFrame()).toContain("XabcY");

    instance.unmount();
  });
});
