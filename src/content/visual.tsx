import React from "react";
import { Text, type BoxProps, type TextProps } from "ink";
import {
  RichText,
  Segment,
  isMeasurable,
  isRenderable,
  type Measurable,
  type RenderOptions,
  type Renderable,
  Style,
} from "rich-js";

import { Content, type ContentFromTextOptions } from "./content.js";

const VISUAL_MEASURE_WIDTH = 4096;

export interface VisualMeasurement {
  width: number;
  height: number;
  lines: Segment[][];
}

export interface Visual extends Renderable, Measurable {
  readonly plainText: string | null;
}

export type VisualInput = string | Content | RichText | Renderable | Visual | null | undefined;

export interface VisualizeOptions extends ContentFromTextOptions {}

abstract class VisualBase implements Visual {
  abstract readonly plainText: string | null;

  abstract render(options: RenderOptions): Iterable<Segment>;

  abstract measure(options: RenderOptions): { minimum: number; maximum: number };
}

class ContentVisual extends VisualBase {
  readonly plainText: string;

  constructor(readonly content: Content) {
    super();
    this.plainText = content.plain;
  }

  render(options: RenderOptions): Iterable<Segment> {
    return this.content.toRichText().render(options);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return this.content.toRichText().measure(options);
  }
}

class RenderableVisual extends VisualBase {
  readonly plainText = null;

  constructor(readonly renderable: Renderable) {
    super();
  }

  render(options: RenderOptions): Iterable<Segment> {
    return this.renderable.render(options);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    if (isMeasurable(this.renderable)) {
      return this.renderable.measure(options);
    }

    const renderedLines = Segment.splitLines(this.renderable.render(options));
    const [width] = Segment.getShape(renderedLines);
    return { minimum: width, maximum: width };
  }
}

function isVisual(value: unknown): value is VisualBase {
  return value instanceof VisualBase;
}

function resolveTextPropColor(value: TextProps["color"] | TextProps["backgroundColor"]): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return value;
}

function splitLayoutTextProps(textProps: Partial<TextProps>): {
  baseStyle: Style;
  layoutTextProps: Partial<TextProps>;
} {
  const {
    color,
    backgroundColor,
    bold,
    dimColor,
    italic,
    underline,
    strikethrough,
    inverse,
    ...layoutTextProps
  } = textProps;

  return {
    // [LAW:single-enforcer] Visual styling from widget props is translated into
    // one rich-js Style here so every visual-bearing surface composes style the
    // same way before it reaches Ink.
    baseStyle: new Style({
      color: resolveTextPropColor(color),
      bgcolor: resolveTextPropColor(backgroundColor),
      bold,
      dim: dimColor,
      italic,
      underline,
      strike: strikethrough,
      reverse: inverse,
    }),
    layoutTextProps,
  };
}

function renderSegmentAnsi(segment: Segment): string {
  return segment.style === undefined ? segment.text : segment.style.render(segment.text);
}

function splitSgrParameters(params: number[]): number[][] {
  const groups: number[][] = [];

  for (let index = 0; index < params.length; index += 1) {
    const code = params[index];

    if ((code === 38 || code === 48) && index + 1 < params.length) {
      const mode = params[index + 1];

      if (mode === 5 && index + 2 < params.length) {
        groups.push(params.slice(index, index + 3));
        index += 2;
        continue;
      }

      if (mode === 2 && index + 4 < params.length) {
        groups.push(params.slice(index, index + 5));
        index += 4;
        continue;
      }
    }

    groups.push([code]);
  }

  return groups;
}

function normalizeAnsiForInk(text: string): string {
  return text.replace(/\u001B\[([0-9;]*)m/g, (_sequence, paramsText: string) => {
    const params = (paramsText.length === 0 ? ["0"] : paramsText.split(";"))
      .map((value) => Number.parseInt(value, 10))
      .map((value) => (Number.isNaN(value) ? 0 : value));

    // [LAW:single-enforcer] ANSI normalization happens exactly once at the
    // visual render seam so every widget/toolip/palette display reaches Ink
    // through the same tokenizer-safe encoding.
    return splitSgrParameters(params)
      .map((group) => `\u001B[${group.join(";")}m`)
      .join("");
  });
}

function normalizeVisualWidth(visual: Visual, width?: number): number {
  if (width !== undefined) {
    return Math.max(1, width);
  }

  const measuredWidth = visual.measure({ maxWidth: VISUAL_MEASURE_WIDTH }).maximum;
  return Math.max(1, measuredWidth);
}

function readHorizontalSpacing(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function resolveVisualRenderWidth(
  containerWidth: number | undefined,
  boxProps: Partial<BoxProps> = {},
): number | undefined {
  if (containerWidth === undefined || containerWidth <= 0) {
    return undefined;
  }

  const borderWidth = boxProps.borderStyle === undefined ? 0 : 2;
  const horizontalSpacing =
    readHorizontalSpacing(boxProps.paddingLeft) +
    readHorizontalSpacing(boxProps.paddingRight) +
    borderWidth;

  // [LAW:single-enforcer] Container-to-content width translation happens at
  // one seam so every visual-bearing widget renders rich content against the
  // same measured inner width instead of ad hoc callsite arithmetic.
  return Math.max(1, containerWidth - horizontalSpacing);
}

export function visualize(value: VisualInput, options: VisualizeOptions = {}): Visual {
  if (isVisual(value)) {
    return value;
  }

  if (value instanceof Content) {
    return new ContentVisual(value);
  }

  if (value instanceof RichText) {
    return new ContentVisual(Content.fromRichText(value));
  }

  if (value === null || value === undefined) {
    return new ContentVisual(new Content(""));
  }

  if (typeof value === "string") {
    return new ContentVisual(Content.fromText(value, options));
  }

  if (isRenderable(value)) {
    return new RenderableVisual(value);
  }

  throw new TypeError(`Unable to visualize value of type ${typeof value}`);
}

export function measureVisual(visual: Visual, width?: number): VisualMeasurement {
  const renderWidth = normalizeVisualWidth(visual, width);
  const renderedLines = Segment.splitAndCropLines(visual.render({ maxWidth: renderWidth }), renderWidth, false);
  const [renderedWidth, renderedHeight] = Segment.getShape(renderedLines);

  return {
    width: renderedWidth,
    height: renderedHeight,
    lines: renderedLines,
  };
}

export function renderVisualToAnsi(
  visual: Visual,
  textProps: Partial<TextProps> = {},
  width?: number,
): string {
  const renderWidth = normalizeVisualWidth(visual, width);
  const { baseStyle } = splitLayoutTextProps(textProps);
  const segments = [...visual.render({ maxWidth: renderWidth })];
  return normalizeAnsiForInk(
    [...Segment.applyStyle(segments, baseStyle)].map(renderSegmentAnsi).join(""),
  );
}

export function renderVisual(
  visual: Visual,
  textProps: Partial<TextProps> = {},
  _keyPrefix = "visual",
  width?: number,
): React.JSX.Element {
  const { layoutTextProps } = splitLayoutTextProps(textProps);

  // [LAW:single-enforcer] Visual-to-Ink rendering lives at this boundary so
  // widgets, tooltips, and palette displays all share one render bridge.
  return <Text {...layoutTextProps}>{renderVisualToAnsi(visual, textProps, width)}</Text>;
}
