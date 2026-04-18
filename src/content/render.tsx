import React from "react";
import { type TextProps } from "ink";

import { Content } from "./content.js";
import { renderVisual, renderVisualToAnsi, visualize } from "./visual.js";

export function renderContentToAnsi(content: Content, textProps: Partial<TextProps> = {}): string {
  return renderVisualToAnsi(visualize(content), textProps);
}

export function renderContent(
  content: Content,
  textProps: Partial<TextProps> = {},
  keyPrefix = "content",
): React.JSX.Element {
  return renderVisual(visualize(content), textProps, keyPrefix);
}
