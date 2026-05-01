import React from "react";
import { Text } from "ink";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

import { App, Input, Key, Paste, TextualApp, WidgetHost } from "../src/index.js";

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

  it("dispatches multi-character raw input as a single Paste message", async () => {
    const received: Array<{ type: "key" | "paste"; value: string }> = [];
    const app = new App();

    function PasteHarness(): React.JSX.Element {
      return (
        <WidgetHost
          typeName="PasteHarness"
          focusable
          autoFocus
          handlers={{
            onKey: (event) => {
              received.push({ type: "key", value: (event as Key).key });
            },
            onPaste: (event) => {
              received.push({ type: "paste", value: (event as Paste).text });
            },
          }}
        >
          <Text>paste</Text>
        </WidgetHost>
      );
    }

    const instance = render(
      <TextualApp app={app}>
        <PasteHarness />
      </TextualApp>,
    );
    await settle(app);

    await writeRawKey(instance, app, "hello world");

    expect(received).toEqual([{ type: "paste", value: "hello world" }]);

    instance.unmount();
  });

  it("strips bracketed-paste markers before dispatching Paste", async () => {
    const received: string[] = [];
    const app = new App();

    function PasteHarness(): React.JSX.Element {
      return (
        <WidgetHost
          typeName="PasteHarness"
          focusable
          autoFocus
          handlers={{
            onPaste: (event) => {
              received.push((event as Paste).text);
            },
          }}
        >
          <Text>paste</Text>
        </WidgetHost>
      );
    }

    const instance = render(
      <TextualApp app={app}>
        <PasteHarness />
      </TextualApp>,
    );
    await settle(app);

    await writeRawKey(instance, app, "\u001b[200~hello world\u001b[201~");

    expect(received).toEqual(["hello world"]);

    instance.unmount();
  });

  it("inserts pasted text into the focused Input widget", async () => {
    const app = new App();
    const instance = render(
      <TextualApp app={app}>
        <Input value="ab" />
      </TextualApp>,
    );
    await settle(app);

    app.focusNext("Input");
    await settle(app);

    await writeRawKey(instance, app, "\u001b[F");
    await writeRawKey(instance, app, "hello world");

    expect(instance.lastFrame()).toContain("abhello world");

    instance.unmount();
  });
});
