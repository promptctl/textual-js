import { RichText } from "rich-js";
import { describe, expect, it } from "vitest";

import { Content } from "../src/index.js";

describe("Content construction", () => {
  it("stores plain text and spans as the canonical payload", () => {
    const content = new Content("hello", [{ start: 1, end: 4, style: "bold" }]);

    expect(content.plain).toBe("hello");
    expect(content.spans).toEqual([{ start: 1, end: 4, style: "bold" }]);
    expect(content.cellLength).toBe(5);
  });

  it("produces blank content from empty string", () => {
    const blank = new Content("");

    expect(blank.plain).toBe("");
    expect(blank.spans).toEqual([]);
    expect(blank.cellLength).toBe(0);
  });

  it("produces unstyled content from plain string", () => {
    const content = new Content("foo");

    expect(content.plain).toBe("foo");
    expect(content.spans).toEqual([]);
  });

  it("creates styled content with a single full-text span", () => {
    const styled = Content.styled("Hello", "red");

    expect(styled.plain).toBe("Hello");
    expect(styled.spans).toEqual([{ start: 0, end: 5, style: "red" }]);
  });

  it("creates empty styled content without spans", () => {
    const empty = Content.styled("", "bold");

    expect(empty.plain).toBe("");
    expect(empty.spans).toEqual([]);
  });

  it("parses markup into content with spans", () => {
    const markup = Content.fromMarkup("[bold]Hi[/]");

    expect(markup.plain).toBe("Hi");
    expect(markup.spans).toHaveLength(1);
  });

  it("strips carriage returns on construction", () => {
    const content = new Content("foo\r\nbar");

    expect(content.plain).toBe("foo\nbar");
  });

  it("clamps and filters invalid spans", () => {
    const content = new Content("abc", [
      { start: -1, end: 10, style: "bold" },
      { start: 5, end: 6, style: "red" },
      { start: 2, end: 2, style: "italic" },
    ]);

    // Only the first span survives: clamped to [0, 3], second is out of range, third is empty
    expect(content.spans).toEqual([{ start: 0, end: 3, style: "bold" }]);
  });
});

describe("Content.fromText", () => {
  it("preserves existing Content instances", () => {
    const existing = new Content("hello");

    expect(Content.fromText(existing)).toBe(existing);
  });

  it("adapts RichText inputs", () => {
    const richText = new RichText("hello", { end: "" });
    richText.stylize("italic", 0, 5);

    expect(Content.fromRichText(richText).spans).toEqual([{ start: 0, end: 5, style: "italic" }]);
  });

  it("handles null and undefined as empty content", () => {
    expect(Content.fromText(null).plain).toBe("");
    expect(Content.fromText(undefined).plain).toBe("");
  });

  it("parses markup by default", () => {
    const content = Content.fromText("[bold]Hello[/]");

    expect(content.plain).toBe("Hello");
    expect(content.spans.length).toBeGreaterThan(0);
  });

  it("treats tags as literal text when markup is disabled", () => {
    const content = Content.fromText("[bold]Hello[/]", { markup: false });

    expect(content.plain).toBe("[bold]Hello[/]");
    expect(content.spans).toEqual([]);
  });
});

describe("Content properties", () => {
  it("returns first line only, clipping spans", () => {
    const content = Content.fromText("hello\nworld", { markup: false });
    const firstLine = content.firstLine;

    expect(firstLine.plain).toBe("hello");
  });

  it("returns full content when no newline exists", () => {
    const content = new Content("single line");

    expect(content.firstLine.plain).toBe("single line");
  });

  it("clips spans to first line boundary", () => {
    const content = new Content("ab\ncd", [{ start: 0, end: 4, style: "bold" }]);
    const firstLine = content.firstLine;

    expect(firstLine.plain).toBe("ab");
    expect(firstLine.spans).toEqual([{ start: 0, end: 2, style: "bold" }]);
  });
});

describe("Content stylize", () => {
  it("applies style to full text when no positions given", () => {
    const content = new Content("hello");
    const styled = content.stylize("bold");

    expect(styled.spans).toEqual([{ start: 0, end: 5, style: "bold" }]);
    // Original is unchanged
    expect(content.spans).toEqual([]);
  });

  it("applies style to a sub-range", () => {
    const content = new Content("hello world");
    const styled = content.stylize("red", 6, 11);

    expect(styled.spans).toEqual([{ start: 6, end: 11, style: "red" }]);
  });

  it("returns same content when start >= end", () => {
    const content = new Content("hello");
    const same = content.stylize("bold", 3, 3);

    expect(same).toBe(content);
  });

  it("appends new span after existing spans", () => {
    const content = Content.styled("hello", "red");
    const restyled = content.stylize("bold", 0, 3);

    expect(restyled.spans).toEqual([
      { start: 0, end: 5, style: "red" },
      { start: 0, end: 3, style: "bold" },
    ]);
  });
});

describe("Content addSpans", () => {
  it("appends additional spans to existing ones", () => {
    const content = Content.styled("hello", "red");
    const extended = content.addSpans([{ start: 2, end: 4, style: "italic" }]);

    expect(extended.spans).toHaveLength(2);
    expect(extended.spans[1]).toEqual({ start: 2, end: 4, style: "italic" });
  });
});

describe("Content truncate", () => {
  it("truncates with ellipsis", () => {
    const content = Content.fromText("hello", { markup: false });
    const truncated = content.truncate(4, { overflow: "ellipsis" });

    expect(truncated.cellLength).toBe(4);
    expect(truncated.plain.endsWith("…")).toBe(true);
  });

  it("does not truncate when content fits", () => {
    const content = Content.fromText("hi", { markup: false });
    const truncated = content.truncate(10);

    expect(truncated.plain).toBe("hi");
  });

  it("crops without ellipsis", () => {
    const content = Content.fromText("hello world", { markup: false });
    const cropped = content.truncate(5, { overflow: "crop" });

    expect(cropped.cellLength).toBeLessThanOrEqual(5);
  });
});

describe("Content blank and assemble", () => {
  it("creates blank content of given width", () => {
    const blank = Content.blank(5);

    expect(blank.plain).toBe("     ");
    expect(blank.cellLength).toBe(5);
    expect(blank.spans).toEqual([]);
  });

  it("creates styled blank content", () => {
    const blank = Content.blank(3, "dim");

    expect(blank.plain).toBe("   ");
    expect(blank.spans).toEqual([{ start: 0, end: 3, style: "dim" }]);
  });

  it("handles zero width", () => {
    const blank = Content.blank(0);

    expect(blank.plain).toBe("");
  });

  it("assembles multiple parts with correct span offsets", () => {
    const assembled = Content.assemble(["hi", "bold"], " ", new Content("there"));

    expect(assembled.plain).toBe("hi there");
    expect(assembled.spans).toEqual([{ start: 0, end: 2, style: "bold" }]);
  });

  it("assembles styled Content parts preserving offsets", () => {
    const assembled = Content.assemble(
      Content.styled("A", "red"),
      Content.styled("B", "blue"),
    );

    expect(assembled.plain).toBe("AB");
    expect(assembled.spans).toEqual([
      { start: 0, end: 1, style: "red" },
      { start: 1, end: 2, style: "blue" },
    ]);
  });
});

describe("Content toSegments and toRichText", () => {
  it("converts to RichText and back without loss", () => {
    const original = Content.styled("hello", "bold");
    const richText = original.toRichText();
    const roundTripped = Content.fromRichText(richText);

    expect(roundTripped.plain).toBe("hello");
    expect(roundTripped.spans.length).toBeGreaterThanOrEqual(1);
  });

  it("produces segments from content", () => {
    const content = Content.styled("hello", "bold");
    const segments = content.toSegments();

    expect(segments.length).toBeGreaterThan(0);
    expect(segments.map((s) => s.text).join("")).toBe("hello");
  });
});
