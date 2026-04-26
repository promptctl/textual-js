import { describe, expect, it } from "vitest";

import { Content } from "../src/index.js";
import { ButtonModel as Button, ButtonPressed } from "../src/widgets/button.js";

describe("Button model", () => {
  it("constructs with default variant and empty label", () => {
    const button = new Button();

    expect(button.variant).toBe("default");
    expect(button.label.plain).toBe("");
  });

  it("constructs with all valid variants", () => {
    for (const variant of ["default", "primary", "success", "warning", "error"] as const) {
      const button = new Button("test", variant);
      expect(button.variant).toBe(variant);
    }
  });

  it("rejects invalid variant", () => {
    expect(() => new Button("test", "bogus" as never)).toThrow();
  });

  it("stores label as Content and supports markup", () => {
    const button = new Button("[bold]Save[/]");

    expect(button.label.plain).toBe("Save");
    expect(button.label.spans.length).toBeGreaterThan(0);
  });

  it("supports label reassignment with string or Content", () => {
    const button = new Button("old");

    button.label = "new";
    expect(button.label.plain).toBe("new");

    button.label = Content.styled("styled", "italic");
    expect(button.label.plain).toBe("styled");
  });

  it("creates ButtonPressed messages with proper defaults", () => {
    const pressed = new ButtonPressed();

    expect(pressed.bubble).toBe(true);
    expect(pressed.sender).toBeNull();
  });
});
