import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

import {
  App,
  UnsupportedUrlScheme,
  parseOpenableUrl,
  runUrlOpenCommand,
  spawnUrlOpener,
  urlOpenCommand,
} from "../src/index.js";

// The spawn itself is the untestable half; the platform decision and the
// scheme checkpoint are split out precisely so they can be asserted without
// launching a browser.
describe("parseOpenableUrl", () => {
  it("accepts the web schemes a link is for", () => {
    for (const raw of ["https://example.com/", "http://example.com/", "mailto:a@example.com"]) {
      expect(parseOpenableUrl(raw).href).toBe(raw);
    }
  });

  // `open`/`explorer.exe`/`xdg-open` launch whatever their argument resolves to,
  // so a link must not be able to name a local file or an executable on a share.
  it("refuses targets that are not web addresses", () => {
    for (const raw of [
      "",
      "file:///etc/passwd",
      String.raw`\\attacker\share\evil.exe`,
      String.raw`C:\Windows\System32\calc.exe`,
      "/etc/passwd",
      "javascript:alert(1)",
    ]) {
      expect(() => parseOpenableUrl(raw)).toThrow(UnsupportedUrlScheme);
    }
  });
});

describe("urlOpenCommand", () => {
  it("opens with `open` on macOS", () => {
    expect(urlOpenCommand("darwin", parseOpenableUrl("https://example.com/"))).toEqual({
      command: "open",
      args: ["https://example.com/"],
      exitCodeReportsFailure: true,
    });
  });

  it("opens through explorer.exe on Windows, never through a shell", () => {
    expect(urlOpenCommand("win32", parseOpenableUrl("https://example.com/"))).toEqual({
      command: "explorer.exe",
      args: ["https://example.com/"],
      // explorer.exe exits 1 even on success.
      exitCodeReportsFailure: false,
    });
  });

  it("falls back to xdg-open on every other platform", () => {
    for (const platform of ["linux", "freebsd", "sunos"]) {
      expect(urlOpenCommand(platform, parseOpenableUrl("https://example.com/"))).toEqual({
        command: "xdg-open",
        args: ["https://example.com/"],
        exitCodeReportsFailure: true,
      });
    }
  });

  // Routing a URL through `cmd /c start` lets cmd.exe re-parse `&` as a command
  // separator. No platform may put the URL anywhere but its own argument.
  it("keeps shell metacharacters inside a single argument on every platform", () => {
    const hostile = parseOpenableUrl("https://example.com/?a=1&calc.exe|whoami^&x");

    for (const platform of ["darwin", "win32", "linux"]) {
      const { command, args } = urlOpenCommand(platform, hostile);

      expect(command).not.toContain("cmd");
      expect(args).toEqual([hostile.href]);
    }
  });
});

// Real child processes, chosen by the test rather than by process.platform —
// driving spawnUrlOpener directly here would open a browser on this machine.
// Node rather than `true`/`false`, which native Windows does not have: the
// win32 exit-code rule is the main thing these tests pin, so the fixture must
// run there.
function exitingWith(code: number): { command: string; args: string[] } {
  return { command: process.execPath, args: ["-e", `process.exit(${code})`] };
}

describe("runUrlOpenCommand", () => {
  it("resolves when the launcher exits cleanly", async () => {
    await expect(
      runUrlOpenCommand({ ...exitingWith(0), exitCodeReportsFailure: true }),
    ).resolves.toBeUndefined();
  });

  // The xdg-open-with-no-$DISPLAY case: the launcher starts, then gives up.
  it("rejects on a non-zero exit when the platform's exit code means something", async () => {
    await expect(
      runUrlOpenCommand({ ...exitingWith(1), exitCodeReportsFailure: true }),
    ).rejects.toThrow("exited with code 1");
  });

  // explorer.exe exits 1 on success, so the same exit must be read as fine.
  it("resolves on a non-zero exit when the platform's exit code means nothing", async () => {
    await expect(
      runUrlOpenCommand({ ...exitingWith(1), exitCodeReportsFailure: false }),
    ).resolves.toBeUndefined();
  });

  // $BROWSER set to a text browser, or a mailto: handler that is a CLI mail
  // client: the launcher runs until the user quits it. That is a launch that
  // worked, so it must not leave the caller waiting for an outcome forever.
  it("resolves once a launcher outlives the failure window", async () => {
    // The child must outlive this test, not merely the window — a child that
    // exits during the test would settle the promise by its own exit event and
    // prove nothing about the window. It is detached and unref'd, so it holds
    // nothing open and reaps itself.
    await expect(
      runUrlOpenCommand(
        {
          command: process.execPath,
          args: ["-e", "setTimeout(() => {}, 15000)"],
          exitCodeReportsFailure: true,
        },
        50,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects when the launcher binary is missing", async () => {
    await expect(
      runUrlOpenCommand({
        command: "textual-js-no-such-launcher",
        args: [],
        exitCodeReportsFailure: true,
      }),
    ).rejects.toThrow(/ENOENT/);
  });
});

describe("spawnUrlOpener", () => {
  it("rejects a refused target without spawning anything", async () => {
    await expect(spawnUrlOpener("file:///etc/passwd")).rejects.toThrow(UnsupportedUrlScheme);
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

  // UrlOpener permits a synchronous opener, and synchronous functions throw.
  // Invoking one as an argument to Promise.resolve would unwind before any
  // catch was attached, crashing the app through the Link action handler.
  it("reports a synchronously thrown failure the same way as a rejection", async () => {
    const app = new App({
      openUrl: () => {
        throw new Error("no browser configured");
      },
    });

    app.setShowNotifications(true);
    expect(() => app.openUrl("https://example.com")).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));

    const notification = app.notifications.list()[0];
    expect(notification).toBeDefined();
    expect(notification!.severityClass).toBe("-error");
    expect(String(notification!.message)).toContain("no browser configured");
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

  // Same "two writers, mount wins" hazard as the AppOptions case below, reached
  // through the public setter: a mount must not overwrite what a host already set.
  it("keeps an opener set before App.render()", async () => {
    const opened: string[] = [];
    const app = new App();

    app.setUrlOpener((url) => opened.push(url));
    const instance = render(app.render());

    await app.whenIdle();
    app.openUrl("https://example.com");
    await new Promise((resolve) => setImmediate(resolve));

    expect(opened).toEqual(["https://example.com"]);

    instance.unmount();
  });

  // The combination that survived three rounds of this bug: options supplied
  // *and* overridden before render, where the mount had a defined value to
  // reassert over the override.
  it("keeps a pre-render override that replaces an AppOptions opener", async () => {
    const opened: string[] = [];
    const app = new App({ openUrl: () => opened.push("from-options") });

    app.setUrlOpener(() => opened.push("from-setter"));
    const instance = render(app.render());

    await app.whenIdle();
    app.openUrl("https://example.com");
    await new Promise((resolve) => setImmediate(resolve));

    expect(opened).toEqual(["from-setter"]);

    instance.unmount();
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
