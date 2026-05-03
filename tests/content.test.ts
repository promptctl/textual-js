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

    expect(content.firstLine.plain).toBe("hello");
  });

  it("returns full content when no newline exists", () => {
    const content = new Content("single line");

    expect(content.firstLine.plain).toBe("single line");
  });

  it("clips spans to first line boundary", () => {
    const content = new Content("ab\ncd", [{ start: 0, end: 4, style: "bold" }]);

    expect(content.firstLine.plain).toBe("ab");
    expect(content.firstLine.spans).toEqual([{ start: 0, end: 2, style: "bold" }]);
  });
});

describe("Content truthiness and equality", () => {
  it("empty content is isEmpty", () => {
    expect(new Content("").isEmpty).toBe(true);
    expect(new Content("foo").isEmpty).toBe(false);
  });

  it("equals string values", () => {
    expect(new Content("foo").equals("foo")).toBe(true);
    expect(new Content("foo").equals("bar")).toBe(false);
  });

  it("equals other Content instances", () => {
    expect(new Content("foo").equals(new Content("foo"))).toBe(true);
    expect(new Content("foo").equals(new Content("bar"))).toBe(false);
  });

  it("compares by plain text for ordering", () => {
    const a = new Content("apple");
    const b = new Content("banana");

    expect(a.compareTo(b)).toBeLessThan(0);
    expect(b.compareTo(a)).toBeGreaterThan(0);
    expect(a.compareTo(a)).toBe(0);
  });
});

describe("Content stylize", () => {
  it("applies style to full text when no positions given", () => {
    const content = new Content("hello");
    const styled = content.stylize("bold");

    expect(styled.spans).toEqual([{ start: 0, end: 5, style: "bold" }]);
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

describe("Content stylizeBefore", () => {
  it("inserts span before existing spans", () => {
    const content = Content.styled("hello", "red");
    const before = content.stylizeBefore("bold", 0, 3);

    expect(before.spans).toEqual([
      { start: 0, end: 3, style: "bold" },
      { start: 0, end: 5, style: "red" },
    ]);
  });

  it("returns same content when start >= end", () => {
    const content = new Content("hello");
    const same = content.stylizeBefore("bold", 3, 3);

    expect(same).toBe(content);
  });

  it("applies to full text when no positions given", () => {
    const content = new Content("hello");
    const before = content.stylizeBefore("bold");

    expect(before.spans).toEqual([{ start: 0, end: 5, style: "bold" }]);
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

describe("Content indexing and slicing", () => {
  it("charAt returns single-character Content", () => {
    const content = new Content("hello");

    expect(content.charAt(0).plain).toBe("h");
    expect(content.charAt(0).spans).toEqual([]);
  });

  it("charAt supports negative indexing", () => {
    expect(new Content("hello").charAt(-1).plain).toBe("o");
  });

  it("charAt clips spans to the character", () => {
    const char = Content.styled("hello", "bold").charAt(1);

    expect(char.plain).toBe("e");
    expect(char.spans).toEqual([{ start: 0, end: 1, style: "bold" }]);
  });

  it("slice extracts a range", () => {
    expect(new Content("hello world").slice(0, 5).plain).toBe("hello");
  });

  it("slice clips spans to the range", () => {
    const sliced = new Content("hello world", [{ start: 3, end: 8, style: "bold" }]).slice(2, 7);

    expect(sliced.plain).toBe("llo w");
    expect(sliced.spans).toEqual([{ start: 1, end: 5, style: "bold" }]);
  });

  it("slice returns empty when start >= end", () => {
    expect(new Content("hello").slice(5, 3).plain).toBe("");
  });

  it("slice defaults end to full length", () => {
    expect(new Content("hello").slice(2).plain).toBe("llo");
  });
});

describe("Content concatenation", () => {
  it("concatenates two Content instances", () => {
    const result = Content.styled("foo", "red").add(Content.styled("bar", "blue"));

    expect(result.plain).toBe("foobar");
    expect(result.spans).toEqual([
      { start: 0, end: 3, style: "red" },
      { start: 3, end: 6, style: "blue" },
    ]);
  });

  it("concatenates Content with string", () => {
    const result = Content.styled("foo", "red").add("bar");

    expect(result.plain).toBe("foobar");
    expect(result.spans).toEqual([{ start: 0, end: 3, style: "red" }]);
  });

  it("preserves all spans from both sides through chain", () => {
    const result = Content.styled("foo", "red").add(new Content(" ")).add(Content.styled("bar", "blue"));

    expect(result.plain).toBe("foo bar");
    expect(result.spans).toEqual([
      { start: 0, end: 3, style: "red" },
      { start: 4, end: 7, style: "blue" },
    ]);
  });
});

describe("Content join", () => {
  it("joins pieces with separator", () => {
    expect(new Content(", ").join(["a", "b", "c"]).plain).toBe("a, b, c");
  });

  it("joins Content pieces preserving spans", () => {
    const result = new Content(" ").join([
      Content.styled("foo", "red"),
      Content.styled("bar", "blue"),
    ]);

    expect(result.plain).toBe("foo bar");
    expect(result.spans).toEqual([
      { start: 0, end: 3, style: "red" },
      { start: 4, end: 7, style: "blue" },
    ]);
  });

  it("returns empty for empty list", () => {
    expect(new Content(", ").join([]).plain).toBe("");
  });

  it("returns single item for single-element list", () => {
    expect(new Content(", ").join(["only"]).plain).toBe("only");
  });
});

describe("Content truncate", () => {
  it("truncates with ellipsis", () => {
    const truncated = Content.fromText("hello", { markup: false }).truncate(4, { overflow: "ellipsis" });

    expect(truncated.cellLength).toBe(4);
    expect(truncated.plain.endsWith("…")).toBe(true);
  });

  it("does not truncate when content fits", () => {
    expect(Content.fromText("hi", { markup: false }).truncate(10).plain).toBe("hi");
  });

  it("crops without ellipsis", () => {
    const cropped = Content.fromText("hello world", { markup: false }).truncate(5, { overflow: "crop" });

    expect(cropped.cellLength).toBeLessThanOrEqual(5);
  });
});

describe("Content wrap", () => {
  it("wraps text at word boundaries", () => {
    const lines = new Content("hello world foo bar").wrap(11);

    expect(lines.length).toBe(2);
    expect(lines[0]!.plain).toBe("hello world");
    expect(lines[1]!.plain).toBe("foo bar");
  });

  it("returns single-element list for short text", () => {
    const lines = new Content("hi").wrap(80);

    expect(lines).toHaveLength(1);
    expect(lines[0]!.plain).toBe("hi");
  });

  it("returns empty-content list for empty input", () => {
    const lines = new Content("").wrap(10);

    expect(lines).toHaveLength(1);
    expect(lines[0]!.plain).toBe("");
  });
});

describe("Content fold", () => {
  it("hard-wraps at exact cell positions", () => {
    const lines = new Content("abcdefghij").fold(5);

    expect(lines).toHaveLength(2);
    expect(lines[0]!.plain).toBe("abcde");
    expect(lines[1]!.plain).toBe("fghij");
  });

  it("returns single-element list for short text", () => {
    const lines = new Content("hi").fold(80);

    expect(lines).toHaveLength(1);
    expect(lines[0]!.plain).toBe("hi");
  });

  it("returns empty-content list for empty input", () => {
    const lines = new Content("").fold(10);

    expect(lines).toHaveLength(1);
    expect(lines[0]!.plain).toBe("");
  });

  it("handles multi-line content", () => {
    const lines = new Content("abc\ndefgh").fold(3);

    expect(lines.map((l) => l.plain)).toEqual(["abc", "def", "gh"]);
  });

  it("preserves blank lines", () => {
    const lines = new Content("abc\n\ndefgh").fold(3);

    expect(lines.map((l) => l.plain)).toEqual(["abc", "", "def", "gh"]);
  });
});

describe("Content expandTabs", () => {
  it("replaces tabs with spaces aligned to tab stops", () => {
    expect(new Content("a\tb").expandTabs(8).plain).toBe("a       b");
  });

  it("returns unchanged content when no tabs", () => {
    expect(new Content("no tabs").expandTabs(4).plain).toBe("no tabs");
  });

  it("handles tab at column 0", () => {
    expect(new Content("\thello").expandTabs(4).plain).toBe("    hello");
  });
});

describe("Content simplify", () => {
  it("merges adjacent spans with same style", () => {
    const content = new Content("hello world", [
      { start: 0, end: 5, style: "bold" },
      { start: 5, end: 11, style: "bold" },
    ]);
    const simplified = content.simplify();

    expect(simplified.spans).toEqual([{ start: 0, end: 11, style: "bold" }]);
  });

  it("does not merge spans with different styles", () => {
    const content = new Content("hello world", [
      { start: 0, end: 5, style: "bold" },
      { start: 5, end: 11, style: "italic" },
    ]);
    const simplified = content.simplify();

    expect(simplified.spans).toHaveLength(2);
  });

  it("returns same content for single span", () => {
    const content = Content.styled("hello", "bold");

    expect(content.simplify()).toBe(content);
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
    expect(Content.blank(0).plain).toBe("");
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
    const roundTripped = Content.fromRichText(original.toRichText());

    expect(roundTripped.plain).toBe("hello");
    expect(roundTripped.spans.length).toBeGreaterThanOrEqual(1);
  });

  it("produces segments from content", () => {
    const segments = Content.styled("hello", "bold").toSegments();

    expect(segments.length).toBeGreaterThan(0);
    expect(segments.map((s) => s.text).join("")).toBe("hello");
  });
});
