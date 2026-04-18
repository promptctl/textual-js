import React from "react";
import { Text, type TextProps } from "ink";
import { type Color, type Segment, type Style } from "rich-js";

import { Content } from "./content.js";

function colorToInk(color: Color | undefined): string | undefined {
  if (color === undefined) {
    return undefined;
  }

  if (color.triplet !== undefined) {
    const { red, green, blue } = color.triplet;
    return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
  }

  return color.name;
}

function styleToTextProps(style: Style | null | undefined): Partial<TextProps> {
  if (style === null || style === undefined) {
    return {};
  }

  return {
    color: colorToInk(style.color),
    backgroundColor: colorToInk(style.bgcolor),
    bold: style.bold,
    dimColor: style.dim,
    italic: style.italic,
    underline: style.underline,
    strikethrough: style.strike,
    inverse: style.reverse,
  };
}

function renderSegmentNodes(segments: Segment[], keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let nodeIndex = 0;

  for (const segment of segments) {
    const parts = segment.text.split("\n");

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];

      if (part.length > 0) {
        nodes.push(
          <Text key={`${keyPrefix}:${nodeIndex}`} {...styleToTextProps(segment.style)}>
            {part}
          </Text>,
        );
        nodeIndex += 1;
      }

      if (index < parts.length - 1) {
        nodes.push("\n");
      }
    }
  }

  return nodes;
}

function normalizeRenderedSegments(content: Content): Segment[] {
  const segments = [...content.toRichText().render({ maxWidth: Math.max(1, content.cellLength) })];

  if (!content.plain.endsWith("\n") && segments.at(-1)?.text === "\n") {
    segments.pop();
  }

  return segments;
}

export function renderContent(content: Content, textProps: Partial<TextProps> = {}, keyPrefix = "content"): React.JSX.Element {
  const segments = normalizeRenderedSegments(content);

  // [LAW:single-enforcer] Content-to-Ink rendering lives here so widget and
  // overlay surfaces share one styled-text bridge.
  return <Text {...textProps}>{renderSegmentNodes(segments, keyPrefix)}</Text>;
}
