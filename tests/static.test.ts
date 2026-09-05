import { Panel } from "rich-js";
import { describe, expect, it } from "vitest";

import { Content } from "../src/index.js";
import { StaticModel as Static } from "../src/widgets/static.js";

describe("Static widget", () => {
  it("constructs with empty content by default", () => {
    const widget = new Static();

    expect(widget.content).toBe("");
    expect(widget.visual.plainText).toBe("");
  });

  it("constructs with a string and keeps content and visual in sync", () => {
    const widget = new Static("Hello");

    expect(widget.content).toBe("Hello");
    expect(widget.visual.plainText).toBe("Hello");
  });

  it("updates content and visual together", () => {
    const widget = new Static();

    widget.update("Hello");
    expect(widget.content).toBe("Hello");
    expect(widget.visual.plainText).toBe("Hello");

    widget.update("[bold]Styled[/]");
    expect(widget.content).toBe("[bold]Styled[/]");
    expect(widget.visual.plainText).toBe("Styled");
  });

  it("accepts Content input directly", () => {
    const content = Content.styled("rich", "bold");
    const widget = new Static(content);

    expect(widget.content).toBe(content);
    expect(widget.visual.plainText).toBe("rich");
  });

  it("preserves renderable content as the source value", () => {
    const panel = new Panel("rich");
    const widget = new Static(panel);

    expect(widget.content).toBe(panel);
    expect(widget.visual.plainText).toBeNull();
  });
});

