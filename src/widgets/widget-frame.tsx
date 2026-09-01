import React from "react";
import { Box, type BoxProps } from "ink";

import { Content, renderContent } from "../content/index.js";
import type { Widget } from "../framework/widget.js";
import type { ResolvedStyles, BorderValue } from "../styles/index.js";
import { colorToInkValue } from "../styles/index.js";
import { innerBoxGeometry } from "../styles/box-geometry.js";
import { MeasuredSizeReader } from "../framework/measured-size.js";

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

  const availableWidth = width ?? label.cellLength;
  const truncated = label.truncate(availableWidth, { overflow: "ellipsis" });
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
  // [LAW:no-defensive-null-guards] Border-title-align is genuinely optional —
  // most widgets don't declare it. tryEnum returns undefined when absent;
  // "center" is the documented default, kept at the consumer as the
  // single rendering decision.
  const alignChoices = ["left", "center", "right"] as const;
  const titleAlign = styles.tryEnum("border-title-align", alignChoices) ?? "center";
  const subtitleAlign = styles.tryEnum("border-subtitle-align", alignChoices) ?? "center";
  const textProps = {
    color: typeof styles.box.borderColor === "string" ? styles.box.borderColor : undefined,
  };
  // [LAW:one-source-of-truth] Margin and width policy belong to the widget's
  // outer box (WidgetScope), which is the node the layout measures.
  // Applying them here too would double every margin.
  const inner = (
    <Box {...innerBoxGeometry(styles.box)} {...boxProps}>
      {children}
    </Box>
  );

  // [LAW:one-source-of-truth] The label width is the widget's measured width and
  // nothing else. It used to prefer `styles.box.width` over the measurement, but
  // since the whole width axis moved onto the measured outer box those are two
  // maps of one territory — and the measurement is the truer one, because it is
  // what Yoga actually resolved after `min-width` and friends had their say.
  return (
    <MeasuredSizeReader widget={widget}>
      {({ width }) => (
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
      )}
    </MeasuredSizeReader>
  );
}
