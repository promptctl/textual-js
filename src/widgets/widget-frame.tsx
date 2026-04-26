import React from "react";
import { Box, type BoxProps } from "ink";

import { Content, renderContent } from "../content/index.js";
import type { Widget } from "../framework/widget.js";
import type { ResolvedStyles, BorderValue } from "../styles/index.js";
import { colorToInkValue } from "../styles/index.js";

function readNumericBoxValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function renderAlignedLabel(
  label: Content | null,
  align: "left" | "center" | "right",
  width: number | undefined,
  textProps: { color?: string },
  key: string,
): React.JSX.Element | null {
  if (label === null || label.plain.length === 0) {
    return null;
  }

  const availableWidth = width === undefined || width <= 0 ? label.cellLength : width;
  const truncated = label.truncate(Math.max(0, availableWidth), { overflow: "ellipsis" });
  const remaining = Math.max(0, availableWidth - truncated.cellLength);
  const leftPad = align === "right" ? remaining : align === "center" ? Math.floor(remaining / 2) : 0;
  const rightPad = remaining - leftPad;
  const content = Content.assemble(" ".repeat(leftPad), truncated, " ".repeat(rightPad));

  return (
    <Box>
      {renderContent(content, textProps, key, availableWidth)}
    </Box>
  );
}

export interface WidgetFrameProps {
  widget: Widget;
  styles: ResolvedStyles;
  children: React.ReactNode;
  boxProps?: Partial<BoxProps>;
}

export function WidgetFrame({
  widget,
  styles,
  children,
  boxProps = {},
}: WidgetFrameProps): React.JSX.Element {
  const outline = styles.getRule<BorderValue>("outline");
  const titleAlign = (styles.getRule("border-title-align") as "left" | "center" | "right" | undefined) ?? "center";
  const subtitleAlign = (styles.getRule("border-subtitle-align") as "left" | "center" | "right" | undefined) ?? "center";
  const width = readNumericBoxValue(styles.box.width) ?? (widget.screenRegion.width > 0 ? widget.screenRegion.width : undefined);
  const textProps = {
    color: typeof styles.box.borderColor === "string" ? styles.box.borderColor : undefined,
  };
  const inner = (
    <Box {...styles.box} {...boxProps}>
      {children}
    </Box>
  );

  return (
    <Box
      flexDirection="column"
      {...(outline === undefined || outline.style.length === 0
        ? {}
        : {
            borderStyle: outline.style as BoxProps["borderStyle"],
            borderColor: colorToInkValue(outline.color),
          })}
    >
      {renderAlignedLabel(widget.borderTitle, titleAlign, width, textProps, `frame:${widget.nodeId}:title`)}
      {inner}
      {renderAlignedLabel(widget.borderSubtitle, subtitleAlign, width, textProps, `frame:${widget.nodeId}:subtitle`)}
    </Box>
  );
}
