import { describe, expect, it } from "vitest";

import { urlOpenCommand } from "../src/index.js";

// The spawn itself is the untestable half; the platform decision is split out
// precisely so it can be asserted without launching a browser.
describe("urlOpenCommand", () => {
  it("opens with `open` on macOS", () => {
    expect(urlOpenCommand("darwin", "https://example.com")).toEqual({
      command: "open",
      args: ["https://example.com"],
    });
  });

  it("opens through cmd's start builtin on Windows, with an empty window title", () => {
    expect(urlOpenCommand("win32", "https://example.com")).toEqual({
      command: "cmd",
      args: ["/c", "start", "", "https://example.com"],
    });
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
