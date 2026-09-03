import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";

import { App, WidgetHost } from "../src/index.js";

class ReadyApp extends App<string> {
  protected override compose(): React.ReactNode {
    return (
      <WidgetHost typeName="Label" id="ready-label">
        <Text>ready</Text>
      </WidgetHost>
    );
  }
}

describe("App seam", () => {
  it("instantiates without arguments and coerces titles with JS string semantics", () => {
    const app = new App();

    // Textual's default title is the app class name, so a Header always has
    // something to paint. Only subTitle defaults to empty.
    expect(app.title).toBe("App");
    expect(new ReadyApp().title).toBe("ReadyApp");
    expect(app.subTitle).toBe("");

    app.title = null;
    app.subTitle = [1, 2, 3];

    expect(app.title).toBe("null");
    expect(app.subTitle).toBe("1,2,3");
  });

  it("runs through the canonical app seam and exposes Pilot after mount", async () => {
    const app = new ReadyApp();
    const session = await app.runTest({
      size: { width: 12, height: 3 },
    });

    expect(session.app).toBe(app);
    expect(session.app).toBe(app);
    expect(String(session.pilot)).toBe("<Pilot app=ReadyApp>");
    expect(session.lastFrame()).toContain("ready");
    expect(session.app.terminalSize.width).toBe(12);
    expect(session.app.terminalSize.height).toBe(3);

    await session.pilot.exit("done");

    expect(app.returnValue).toBe("done");
    expect(session.result).toBe("done");
    expect(app.isRunning).toBe(false);

    session.unmount();
  });

  it("terminates through app.exit", async () => {
    const app = new ReadyApp();
    const session = await app.runTest();

    expect(app.isRunning).toBe(true);
    expect(app.exit("stop")).toBe("stop");
    expect(app.returnValue).toBe("stop");
    expect(app.isRunning).toBe(false);

    session.unmount();
  });
});
