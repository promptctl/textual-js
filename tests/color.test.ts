import { describe, expect, it } from "vitest";

import { ColorRgba } from "rich-js";

import { Color, ColorParseError, Gradient, lab_to_rgb, labToRgb, normalizeColor, rgb_to_lab, rgbToLab } from "../src/index.js";

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

  it("normalizes the full Stage 2 color input forms at one parser boundary", () => {
    const existing = new Color(1, 2, 3, 0.5);

    expect(Color.parse(existing)).toBe(existing);
    expect(Color.parse("#fab0").css).toBe("rgba(255,170,187,0)");
    expect(Color.parse("#020304ff").hex).toBe("#020304");
    expect(Color.parse("hsl(-90, 50%, 50%)").hex6).toBe("#8040BF");
    expect(Color.parse("hsla(-45, 50%, 50%, 0.2)").css).toBe("rgba(191,64,159,0.2)");
    expect(Color.parse("ansi_red").css).toBe("ansi_red");
    expect(Color.parse("red 50%").css).toBe("rgba(255,0,0,0.5)");
    expect(Color.automatic(0.705).css).toBe("auto 70.5%");
  });

  it("exposes color derivation, compositing, and color-space round trips", () => {
    const source = new Color(32, 64, 128, 0.75);
    const hslRoundTrip = Color.fromHsl(source.hsl.h, source.hsl.s, source.hsl.l);
    const hsvRoundTrip = Color.fromHsv(source.hsv.h, source.hsv.s, source.hsv.v);
    const labRoundTrip = labToRgb(rgbToLab(source));

    expect(hslRoundTrip.rgb).toEqual(source.rgb);
    expect(hsvRoundTrip.rgb).toEqual(source.rgb);
    expect(labRoundTrip.rgb[0]).toBeCloseTo(source.rgb[0], 0);
    expect(labRoundTrip.rgb[1]).toBeCloseTo(source.rgb[1], 0);
    expect(labRoundTrip.rgb[2]).toBeCloseTo(source.rgb[2], 0);
    expect(source.monochrome.alpha).toBe(0.75);
    expect(source.inverse.rgb).toEqual([223, 191, 127]);
    expect(source.withAlpha(2).alpha).toBe(1);
    expect(source.with_alpha(0.25).alpha).toBe(0.25);
    expect(source.multiplyAlpha(0.5).alpha).toBe(0.375);
    expect(source.multiply_alpha(0.5).alpha).toBe(0.375);
    expect(Color.from_hsl(source.hsl.h, source.hsl.s, source.hsl.l).rgb).toEqual(source.rgb);
    expect(Color.from_hsv(source.hsv.h, source.hsv.s, source.hsv.v).rgb).toEqual(source.rgb);
    expect(lab_to_rgb(rgb_to_lab(source)).rgb[0]).toBeCloseTo(source.rgb[0], 0);
    expect(new Color(10, 20, 30).tint(new Color(110, 120, 130, 0.5)).rgb).toEqual([60, 70, 80]);
    expect(new Color(10, 20, 30).add(new Color(110, 120, 130, 0.5)).rgb).toEqual([60, 70, 80]);
    expect(new Color(10, 20, 30).lighten(1).rgb).toEqual([255, 255, 255]);
    expect(new Color(10, 20, 30).darken(1).rgb).toEqual([0, 0, 0]);
    expect(new Color(10, 20, 30).get_contrast_text().hex6).toBe("#FFFFFF");
    expect(new Color(250, 250, 250).getContrastText().hex6).toBe("#000000");
    expect(new Color(0, 0, 0, 0).is_transparent).toBe(true);
  });

  it("bridges rich-js colors without creating a second color model", () => {
    const source = new ColorRgba(10, 20, 30);
    const color = Color.from_rich_color(source);

    expect(color.rgb).toEqual([10, 20, 30]);
    expect(color.rich_color.rgb).toBe("rgb(10,20,30)");
  });

  it("samples validated gradients", () => {
    const gradient = new Gradient([0, "black"], [0.5, "red"], [1, "white"]);

    expect(gradient.getColor(-1).hex6).toBe("#000000");
    expect(gradient.get_color(0.5).hex6).toBe("#FF0000");
    expect(gradient.getColor(2).hex6).toBe("#FFFFFF");
    expect(Gradient.from_colors("black", "white").getColor(1).hex6).toBe("#FFFFFF");
    // 0x7F, not 0x80: Textual's Color.blend truncates each channel with
    // `int()`, so black halfway to white is 127. Verified against
    // textual 8.2.3 — `Gradient.from_colors("black", "white").get_color(0.5)`
    // is `#7F7F7F` there too.
    expect(new Gradient([0, "black"], [1, "white"], { quality: 3 }).getColor(0.5).hex6).toBe("#7F7F7F");
    expect(() => new Gradient([0.2, "red"], [1, "blue"])).toThrow(/start/);
    expect(() => Gradient.fromColors("red")).toThrow(/at least two/);
  });

  it("raises explicit parse errors for invalid color input", () => {
    expect(() => Color.parse("ansi_dark_cyan")).toThrow(ColorParseError);
    expect(() => Color.parse("#12")).toThrow(ColorParseError);
    expect(() => normalizeColor("not-a-color")).toThrow(ColorParseError);
    expect(() => Color.parse("chartruse")).toThrow(/chartreuse/);
  });
});
