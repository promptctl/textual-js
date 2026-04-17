import { RichText } from "rich-js";
import { describe, expect, it } from "vitest";

import { Content } from "../src/index.js";

describe("Content", () => {
  it("stores plain text and spans as the canonical payload", () => {
    const content = new Content("hello", [{ start: 1, end: 4, style: "bold" }]);

    expect(content.plain).toBe("hello");
    expect(content.spans).toEqual([{ start: 1, end: 4, style: "bold" }]);
    expect(content.cellLength).toBe(5);
  });

  it("creates styled content and parses markup", () => {
    const styled = Content.styled("hello", "bold");
    const markup = Content.fromMarkup("[bold]Hi[/]");

    expect(styled.spans).toEqual([{ start: 0, end: 5, style: "bold" }]);
    expect(markup.plain).toBe("Hi");
    expect(markup.spans).toHaveLength(1);
  });

  it("preserves existing content and adapts rich text inputs", () => {
    const existing = new Content("hello");
    const richText = new RichText("hello", { end: "" });
    richText.stylize("italic", 0, 5);

    expect(Content.fromText(existing)).toBe(existing);
    expect(Content.fromRichText(richText).spans).toEqual([{ start: 0, end: 5, style: "italic" }]);
  });

  it("reads the first line, truncates, and assembles content", () => {
    const firstLine = Content.fromText("hello\nworld", { markup: false }).firstLine;
    const truncated = Content.fromText("hello", { markup: false }).truncate(4, { overflow: "ellipsis" });
    const assembled = Content.assemble(["hi", "bold"], " ", new Content("there"));

    expect(firstLine.plain).toBe("hello");
    expect(truncated.cellLength).toBe(4);
    expect(truncated.plain.endsWith("…")).toBe(true);
    expect(assembled.plain).toBe("hi there");
    expect(assembled.spans).toEqual([{ start: 0, end: 2, style: "bold" }]);
  });
});
