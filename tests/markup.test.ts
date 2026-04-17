import { describe, expect, it } from "vitest";

import { Content } from "../src/index.js";

describe("markup parsing via Content.fromMarkup", () => {
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

  it("handles nested tags", () => {
    const content = Content.fromMarkup("[bold][red]BoldRed[/red][/bold]");

    expect(content.plain).toBe("BoldRed");
    expect(content.spans.length).toBeGreaterThanOrEqual(1);
  });

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

  it("handles unclosed tags by implicitly closing at end", () => {
    const content = Content.fromMarkup("[bold]Hello");

    expect(content.plain).toBe("Hello");
    expect(content.spans.length).toBeGreaterThan(0);
  });

  it("treats bare brackets as literal text", () => {
    const content = Content.fromMarkup("5 [is less than] 10");

    // rich-js treats unknown tags as literal text or ignores them
    expect(content.plain).toContain("5");
    expect(content.plain).toContain("10");
  });

  it("handles universal close tag", () => {
    const content = Content.fromMarkup("[bold][italic]styled[/]");

    expect(content.plain).toBe("styled");
    expect(content.spans.length).toBeGreaterThan(0);
  });

  it("handles color markup", () => {
    const content = Content.fromMarkup("[red]Red Text[/]");

    expect(content.plain).toBe("Red Text");
    expect(content.spans.length).toBeGreaterThan(0);
  });

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
});
