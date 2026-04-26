import { Panel, RichText } from "rich-js";
import { describe, expect, it } from "vitest";

import { Content, measureVisual, visualize } from "../src/index.js";

describe("visual seam", () => {
  it("promotes markup strings to textual visuals", () => {
    const visual = visualize("[bold]Hello[/]");

    expect(visual.plainText).toBe("Hello");
    expect(measureVisual(visual).width).toBeGreaterThan(0);
  });

  it("promotes Content instances without flattening them to strings", () => {
    const content = Content.styled("Hello", "bold");
    const visual = visualize(content);

    expect(visual.plainText).toBe("Hello");
    expect(measureVisual(visual).height).toBe(1);
  });

  it("accepts RichText inputs", () => {
    const richText = new RichText("Hello", { end: "" });
    richText.stylize("italic", 0, 5);
    const visual = visualize(richText);

    expect(visual.plainText).toBe("Hello");
    expect(measureVisual(visual).width).toBe(5);
  });

  it("accepts rich-js renderables without flattening them to text", () => {
    const panel = new Panel("Hello", { title: "Greeting" });
    const visual = visualize(panel);
    const measurement = measureVisual(visual);

    expect(visual.plainText).toBeNull();
    expect(measurement.width).toBeGreaterThan(0);
    expect(measurement.height).toBeGreaterThan(1);
  });

  it("returns existing Visual values unchanged", () => {
    const visual = visualize(Content.styled("Hello", "bold"));

    expect(visualize(visual)).toBe(visual);
  });
});
