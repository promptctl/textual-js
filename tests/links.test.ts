import { describe, expect, it } from "vitest";

import { parseAction } from "../src/index.js";

describe("link action dispatch", () => {
  it("parses unnamespaced action from markup click target", () => {
    const parsed = parseAction("bell");

    expect(parsed.namespace).toBe("");
    expect(parsed.actionName).toBe("bell");
    expect(parsed.params).toEqual([]);
  });

  it("parses app-namespaced action", () => {
    const parsed = parseAction("app.quit");

    expect(parsed.namespace).toBe("app");
    expect(parsed.actionName).toBe("quit");
    expect(parsed.params).toEqual([]);
  });

  it("parses screen-namespaced action", () => {
    const parsed = parseAction("screen.dismiss");

    expect(parsed.namespace).toBe("screen");
    expect(parsed.actionName).toBe("dismiss");
    expect(parsed.params).toEqual([]);
  });

  it("parses action with string arguments", () => {
    const parsed = parseAction("open_link('https://example.com')");

    expect(parsed.actionName).toBe("open_link");
    expect(parsed.params).toEqual(["https://example.com"]);
  });

  it("parses action with multiple arguments", () => {
    const parsed = parseAction("navigate('home', true)");

    expect(parsed.actionName).toBe("navigate");
    expect(parsed.params).toEqual(["home", true]);
  });

  it("routes namespaced actions to correct targets", () => {
    // app.bell -> app's action_bell
    // screen.dismiss -> screen's action_dismiss
    // focus_input -> local widget's action_focus_input
    const cases = [
      { action: "app.bell", expectedNs: "app", expectedName: "bell" },
      { action: "screen.dismiss", expectedNs: "screen", expectedName: "dismiss" },
      { action: "focus_input", expectedNs: "", expectedName: "focus_input" },
    ];

    for (const { action, expectedNs, expectedName } of cases) {
      const parsed = parseAction(action);
      expect(parsed.namespace).toBe(expectedNs);
      expect(parsed.actionName).toBe(expectedName);
    }
  });
});
