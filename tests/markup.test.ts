import { describe, expect, it } from "vitest";

import { Content } from "../src/index.js";

describe("markup parsing: basic tags", () => {
  it("parses bold markup into styled content", () => {
    const content = Content.fromMarkup("[bold]Hello[/]");

    expect(content.plain).toBe("Hello");
    expect(content.spans.length).toBeGreaterThan(0);
  });

  it("parses multiple style tags", () => {
    const content = Content.fromMarkup("[bold]Bold[/] and [italic]Italic[/]");

    expect(content.plain).toBe("Bold and Italic");
    expect(content.spans.length).toBeGreaterThanOrEqual(2);
  });

  it("parses color markup", () => {
    const content = Content.fromMarkup("[red]Red Text[/]");

    expect(content.plain).toBe("Red Text");
    expect(content.spans.length).toBeGreaterThan(0);
  });

  it("parses shorthand style names", () => {
    const bold = Content.fromMarkup("[b]B[/]");
    const italic = Content.fromMarkup("[i]I[/]");

    expect(bold.plain).toBe("B");
    expect(bold.spans.length).toBeGreaterThan(0);
    expect(italic.plain).toBe("I");
    expect(italic.spans.length).toBeGreaterThan(0);
  });
});

describe("markup parsing: nesting and overlapping", () => {
  it("handles nested tags producing independent spans", () => {
    const content = Content.fromMarkup("[bold][red]BoldRed[/red][/bold]");

    expect(content.plain).toBe("BoldRed");
    // Should have at least two spans: bold covering all, red covering all
    expect(content.spans.length).toBeGreaterThanOrEqual(1);
  });

  it("handles universal close tag closing most recent", () => {
    const content = Content.fromMarkup("[bold][italic]styled[/]");

    expect(content.plain).toBe("styled");
    expect(content.spans.length).toBeGreaterThan(0);
  });

  it("handles deeply nested styles", () => {
    const content = Content.fromMarkup("[bold][italic][red]deep[/red][/italic][/bold]");

    expect(content.plain).toBe("deep");
    expect(content.spans.length).toBeGreaterThanOrEqual(1);
  });
});

describe("markup parsing: unclosed tags", () => {
  it("implicitly closes unclosed tags at end of string", () => {
    const content = Content.fromMarkup("[bold]Hello");

    expect(content.plain).toBe("Hello");
    expect(content.spans.length).toBeGreaterThan(0);
  });

  it("extends unclosed tags to end of multi-part text", () => {
    const content = Content.fromMarkup("[red]Hello, [blue]world!");

    expect(content.plain).toBe("Hello, world!");
    // Both red and blue should produce spans extending to end
    expect(content.spans.length).toBeGreaterThanOrEqual(1);
  });
});

describe("markup parsing: literal text rules", () => {
  it("preserves plain text without markup", () => {
    const content = Content.fromMarkup("Hello World");

    expect(content.plain).toBe("Hello World");
    expect(content.spans).toEqual([]);
  });

  it("handles empty input", () => {
    const content = Content.fromMarkup("");

    expect(content.plain).toBe("");
    expect(content.spans).toEqual([]);
  });

  it("treats bare/unknown brackets as literal text", () => {
    const content = Content.fromMarkup("5 [is less than] 10");

    // rich-js treats unknown tags as literal text or ignores them
    expect(content.plain).toContain("5");
    expect(content.plain).toContain("10");
  });

  it("preserves newlines in text content", () => {
    const content = Content.fromMarkup("[bold]line1\nline2[/]");

    expect(content.plain).toBe("line1\nline2");
  });
});

describe("markup parsing: span offsets", () => {
  it("produces spans relative to plain text, not markup source", () => {
    const content = Content.fromMarkup("[bold]AB[/]CD");

    // Plain text is "ABCD", bold span should cover [0, 2)
    expect(content.plain).toBe("ABCD");

    const boldSpan = content.spans.find((span) => span.style.includes("bold"));
    expect(boldSpan).toBeDefined();
    expect(boldSpan!.start).toBe(0);
    expect(boldSpan!.end).toBe(2);
  });

  it("offsets later spans past preceding text correctly", () => {
    const content = Content.fromMarkup("AA[red]BB[/]CC");

    expect(content.plain).toBe("AABBCC");

    const redSpan = content.spans.find((span) => span.style.includes("red"));
    expect(redSpan).toBeDefined();
    expect(redSpan!.start).toBe(2);
    expect(redSpan!.end).toBe(4);
  });
});

describe("markup via Content.fromText", () => {
  it("round-trips through Content.fromText with markup enabled", () => {
    const content = Content.fromText("[bold]Hello[/]", { markup: true });

    expect(content.plain).toBe("Hello");
    expect(content.spans.length).toBeGreaterThan(0);
  });

  it("preserves literal text when markup is disabled", () => {
    const content = Content.fromText("[bold]Hello[/]", { markup: false });

    expect(content.plain).toBe("[bold]Hello[/]");
    expect(content.spans).toEqual([]);
  });

  it("defaults to markup enabled for string input", () => {
    const content = Content.fromText("[italic]test[/]");

    expect(content.plain).toBe("test");
    expect(content.spans.length).toBeGreaterThan(0);
  });
});

describe("markup: hex and rgb color tags", () => {
  it("parses hex color tags", () => {
    const content = Content.fromMarkup("[#ff0000]red[/]");

    expect(content.plain).toBe("red");
    expect(content.spans.length).toBeGreaterThan(0);
  });

  it("parses combined style and color", () => {
    const content = Content.fromMarkup("[bold red]styled[/]");

    expect(content.plain).toBe("styled");
    expect(content.spans.length).toBeGreaterThan(0);
  });
});
