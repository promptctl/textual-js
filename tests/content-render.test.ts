import type { Props as InkTextProps } from "ink";
import { ANSI_COLOR_NAMES, Segment, Style } from "rich-js";
import { describe, expect, it } from "vitest";

import { Content } from "../src/content/content.js";
import { renderContentToAnsi } from "../src/content/render.js";
import { parseAnsiToStyledGrid } from "../visual-tests/styled-grid.ts";

function buildBaseStyle(textProps: Partial<InkTextProps>): Style {
  return new Style({
    color: typeof textProps.color === "string" && textProps.color.length > 0 ? textProps.color : undefined,
    bgcolor:
      typeof textProps.backgroundColor === "string" && textProps.backgroundColor.length > 0
        ? textProps.backgroundColor
        : undefined,
    bold: textProps.bold,
    dim: textProps.dimColor,
    italic: textProps.italic,
    underline: textProps.underline,
    strike: textProps.strikethrough,
    reverse: textProps.inverse,
  });
}

function renderExpectedAnsi(content: Content, textProps: Partial<InkTextProps> = {}): string {
  const baseStyle = buildBaseStyle(textProps);
  const segments = [...content.toRichText().render({ maxWidth: Math.max(1, content.cellLength) })];

  return [...Segment.applyStyle(segments, baseStyle)]
    .map((segment) => (segment.style === undefined ? segment.text : segment.style.render(segment.text)))
    .join("");
}

function expectSemanticAnsiMatch(content: Content, textProps: Partial<InkTextProps> = {}): void {
  expect(parseAnsiToStyledGrid(renderContentToAnsi(content, textProps))).toEqual(
    parseAnsiToStyledGrid(renderExpectedAnsi(content, textProps)),
  );
}

describe("renderContentToAnsi", () => {
  it("preserves the full rich-js named foreground color catalog", () => {
    const names = [...new Set(Object.keys(ANSI_COLOR_NAMES))].sort();

    for (const name of names) {
      const content = Content.styled(`fg:${name}`, name);
      expectSemanticAnsiMatch(content);
    }
  });

  it("preserves the full rich-js named background color catalog", () => {
    const names = [...new Set(Object.keys(ANSI_COLOR_NAMES))].sort();

    for (const name of names) {
      const content = Content.styled(`bg:${name}`, `on ${name}`);
      expectSemanticAnsiMatch(content);
    }
  });

  it("preserves truecolor, palette aliases, and composed text attributes", () => {
    const content = Content.assemble(
      ["rgb", "#112233 on rgb(10,20,30)"],
      " ",
      ["gray", "gray50"],
      " ",
      ["attrs", "bold italic underline strike reverse"],
    );

    expectSemanticAnsiMatch(content);
  });

  it("composes widget base style under content spans using rich-js semantics", () => {
    const content = Content.fromMarkup("base [bright_red]hit[/]\n[grey70]tail[/]");
    const textProps: Partial<InkTextProps> = {
      color: "#0000ff",
      backgroundColor: "#010203",
      bold: true,
      dimColor: true,
      italic: true,
      underline: true,
      strikethrough: true,
      inverse: true,
      wrap: "wrap",
    };

    expectSemanticAnsiMatch(content, textProps);
  });
});
