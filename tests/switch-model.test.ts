import { describe, expect, it } from "vitest";

import { SwitchModel as Switch, SwitchChanged } from "../src/widgets/switch.js";

describe("Switch model", () => {
  it("defaults to false", () => {
    const sw = new Switch();
    expect(sw.value).toBe(false);
  });

  it("constructs with initial value", () => {
    const sw = new Switch(true);
    expect(sw.value).toBe(true);
  });

  it("toggles value", () => {
    const sw = new Switch(false);

    expect(sw.toggle()).toBe(true);
    expect(sw.value).toBe(true);

    expect(sw.toggle()).toBe(false);
    expect(sw.value).toBe(false);
  });

  it("supports direct value assignment", () => {
    const sw = new Switch();

    sw.value = true;
    expect(sw.value).toBe(true);

    sw.value = false;
    expect(sw.value).toBe(false);
  });

  it("creates SwitchChanged messages with value", () => {
    const changed = new SwitchChanged(true);

    expect(changed.value).toBe(true);
    expect(changed.bubble).toBe(true);
  });
});
