import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

import { App, urlOpenCommand } from "../src/index.js";

// The spawn itself is the untestable half; the platform decision is split out
// precisely so it can be asserted without launching a browser.
describe("urlOpenCommand", () => {
  it("opens with `open` on macOS", () => {
    expect(urlOpenCommand("darwin", "https://example.com")).toEqual({
      command: "open",
      args: ["https://example.com"],
    });
  });

  it("opens through explorer.exe on Windows, never through a shell", () => {
    expect(urlOpenCommand("win32", "https://example.com")).toEqual({
      command: "explorer.exe",
      args: ["https://example.com"],
    });
  });

  // Routing a URL through `cmd /c start` lets cmd.exe re-parse `&` as a command
  // separator. No platform may put the URL anywhere but its own argument.
  it("keeps shell metacharacters inside a single argument on every platform", () => {
    const hostile = "https://example.com/?a=1&calc.exe|whoami^&x";

    for (const platform of ["darwin", "win32", "linux"]) {
      const { command, args } = urlOpenCommand(platform, hostile);

      expect(command).not.toContain("cmd");
      expect(args).toEqual([hostile]);
    }
  });

  it("falls back to xdg-open on every other platform", () => {
    for (const platform of ["linux", "freebsd", "sunos"]) {
      expect(urlOpenCommand(platform, "https://example.com")).toEqual({
        command: "xdg-open",
        args: ["https://example.com"],
      });
    }
  });

  it("never lets one call's url leak into the next", () => {
    urlOpenCommand("darwin", "https://first.example");

    expect(urlOpenCommand("darwin", "https://second.example").args).toEqual([
      "https://second.example",
    ]);
  });
});

describe("App.openUrl", () => {
  it("reports a failed open to the user instead of crashing the app", async () => {
    const app = new App({
      openUrl: () => Promise.reject(new Error("spawn xdg-open ENOENT")),
    });

    app.setShowNotifications(true);
    app.openUrl("https://example.com");
    await new Promise((resolve) => setImmediate(resolve));

    const notification = app.notifications.list()[0];
    expect(notification).toBeDefined();
    expect(notification!.severityClass).toBe("-error");
    expect(String(notification!.message)).toContain("https://example.com");
  });

  it("stays quiet when the opener succeeds", async () => {
    const opened: string[] = [];
    const app = new App({ openUrl: (url) => opened.push(url) });

    app.setShowNotifications(true);
    app.openUrl("https://example.com");
    await new Promise((resolve) => setImmediate(resolve));

    expect(opened).toEqual(["https://example.com"]);
    expect(app.notifications.length).toBe(0);
  });

  // A host configuring the opener through `new App(options)` must survive the
  // mount: TextualApp writes the opener on every mount, so an AppOptions value
  // that never reached render() would be silently reset to the platform opener.
  it("keeps an AppOptions opener across App.render()", async () => {
    const opened: string[] = [];
    const app = new App({ openUrl: (url) => opened.push(url) });
    const instance = render(app.render());

    await app.whenIdle();
    app.openUrl("https://example.com");
    await new Promise((resolve) => setImmediate(resolve));

    expect(opened).toEqual(["https://example.com"]);

    instance.unmount();
  });
});
