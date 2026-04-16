import { describe, expect, it } from "vitest";

import { normalizeColor } from "../src/index.js";

describe("color normalization", () => {
  it("normalizes named colors and hex colors", () => {
    expect(normalizeColor("red")).toBe("#ff0000");
    expect(normalizeColor("rebeccapurple")).toBe("#663399");
    expect(normalizeColor("#fab")).toBe("#ffaabb");
    expect(normalizeColor("#020304ff")).toBe("#020304ff");
  });

  it("normalizes rgb and rgba colors with clamping", () => {
    expect(normalizeColor("rgb(300, 20, 30)")).toBe("#ff141e");
    expect(normalizeColor("rgba(2, 3, 4, 2)")).toBe("rgba(2,3,4,1)");
  });

  it("normalizes hsl and hsla colors", () => {
    expect(normalizeColor("hsl(0, 100%, 50%)")).toBe("#ff0000");
    expect(normalizeColor("hsla(240, 100%, 50%, 0.25)")).toBe("rgba(0,0,255,0.25)");
  });
});
