// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// [LAW:one-source-of-truth] Bucketing/scaling lives in renderSparklineGrid;
// the component reflects validated grid output into the Ink render.

import React from "react";
import { Box, Text } from "ink";
import { observer } from "mobx-react-lite";

import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import { normalizeColor } from "../styles/index.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import {
  renderSparklineGrid,
  summaryMax,
  summaryMin,
  type SparklineCell,
  type SummaryFunction,
} from "./sparkline.js";

// [LAW:one-source-of-truth] Defaults mirror Textual's dark-theme blend:
// min = base #121212 + ($primary #0178D4 at 30%) = (12, 48, 76);
// max = base #121212 + $primary = (1, 120, 212).
const DEFAULT_MIN_COLOR = "#0C304C";
const DEFAULT_MAX_COLOR = "#0178D4";

const DEFAULT_CSS = `
  Sparkline { height: 1; }
`;

export type SparklineSummaryName = "min" | "max";

export interface SparklineProps extends WidgetComponentProps {
  data: readonly number[];
  summaryFunction?: SparklineSummaryName | SummaryFunction;
  minColor?: string;
  maxColor?: string;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function readNumericBoxValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseHex(hex: string): RGB {
  const normalized = normalizeColor(hex);
  if (normalized && typeof normalized === "object" && "r" in normalized) {
    const triplet = normalized as { r: number; g: number; b: number };
    return { r: triplet.r, g: triplet.g, b: triplet.b };
  }
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (match) {
    const value = parseInt(match[1], 16);
    return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
  }
  return { r: 0, g: 0, b: 0 };
}

function blendRgb(a: RGB, b: RGB, ratio: number): string {
  // [LAW:one-source-of-truth] Linear RGB blend matches Python Textual's
  // blend_colors so per-cell colors render identically. Python's Color.from_rgb
  // truncates float channels via int(), so trunc — not round — is correct.
  const r = Math.trunc(a.r + (b.r - a.r) * ratio);
  const g = Math.trunc(a.g + (b.g - a.g) * ratio);
  const blue = Math.trunc(a.b + (b.b - a.b) * ratio);
  return `#${[r, g, blue].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function resolveSummary(fn?: SparklineSummaryName | SummaryFunction): SummaryFunction {
  if (typeof fn === "function") return fn;
  if (fn === "min") return summaryMin;
  return summaryMax;
}

export const Sparkline = observer(function Sparkline({
  id,
  classes,
  borderTitle,
  borderSubtitle,
  data,
  summaryFunction,
  minColor,
  maxColor,
}: SparklineProps): React.JSX.Element {
  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes, []),
    typeName: "Sparkline",
    typeToken: Sparkline,
    borderTitle,
    borderSubtitle,
    defaultCss: DEFAULT_CSS,
  });

  const styles = useStyles(widget.handle);
  const region = widget.handle.screenRegion;
  const cssWidth = readNumericBoxValue(styles.box.width);
  const cssHeight = readNumericBoxValue(styles.box.height);
  const width = Math.max(0, cssWidth ?? region.width);
  const height = Math.max(1, cssHeight ?? region.height ?? 1);
  const summary = resolveSummary(summaryFunction);

  const minHex = minColor ?? DEFAULT_MIN_COLOR;
  const maxHex = maxColor ?? DEFAULT_MAX_COLOR;
  const minRgb = parseHex(minHex);
  const maxRgb = parseHex(maxHex);

  const grid: SparklineCell[][] =
    width === 0 ? [] : renderSparklineGrid(data, { width, height, summary });

  // [LAW:no-defensive-null-guards] Sparkline's DEFAULT_CSS does not set a
  // background; tryColor expresses that the rule is genuinely optional and
  // user CSS may set it to a hex.
  const backgroundColor = styles.tryColor("background");

  return (
    <WidgetScope widget={widget.handle}>
      <Box
        flexDirection="column"
        width={width || undefined}
        height={height}
      >
        {grid.map((row, rowIndex) => (
          <Box key={rowIndex} flexDirection="row" width={width || undefined} height={1}>
            {row.map((cell, cellIndex) => {
              const color = cell.filled
                ? blendRgb(minRgb, maxRgb, Math.max(0, Math.min(1, cell.ratio)))
                : undefined;
              return (
                <Text
                  key={cellIndex}
                  color={color}
                  backgroundColor={backgroundColor ?? undefined}
                >
                  {cell.char}
                </Text>
              );
            })}
          </Box>
        ))}
      </Box>
    </WidgetScope>
  );
});
