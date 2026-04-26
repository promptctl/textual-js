import { Segment, Style } from "rich-js";

import { Content } from "../content/index.js";

export type BorderQuad = readonly [number, number, number, number];
export type BorderRowGlyphs = readonly [string, string, string];

export interface RenderBorderLabelOptions {
  hasLeftCorner?: boolean;
  hasRightCorner?: boolean;
  borderStyle?: Style;
}

const combineQuadsCache = new Map<string, BorderQuad>();

function normalizeBorderLabel(label: string | Content | null | undefined): Content {
  return Content.fromText(label).firstLine;
}

export function renderBorderRow(
  [leftCorner, edge, rightCorner]: BorderRowGlyphs,
  width: number,
  hasLeftCorner: boolean,
  hasRightCorner: boolean,
  style?: Style,
): Segment[] {
  const edgeWidth = Math.max(
    0,
    width - Number(hasLeftCorner) - Number(hasRightCorner),
  );

  return [
    hasLeftCorner ? new Segment(leftCorner, style) : undefined,
    edgeWidth > 0 ? new Segment(edge.repeat(edgeWidth), style) : undefined,
    hasRightCorner ? new Segment(rightCorner, style) : undefined,
  ].filter((segment): segment is Segment => segment !== undefined);
}

export function renderBorderLabel(
  label: string | Content | null | undefined,
  width: number,
  options: RenderBorderLabelOptions = {},
): Segment[] {
  const normalizedLabel = normalizeBorderLabel(label);
  const cornerWidth = Number(options.hasLeftCorner ?? false) + Number(options.hasRightCorner ?? false);

  if (normalizedLabel.plain.length === 0 || width < 5 + cornerWidth) {
    return [];
  }

  const availableLabelWidth = Math.max(0, width - cornerWidth - 2);
  const truncatedLabel = normalizedLabel.truncate(availableLabelWidth, {
    overflow: "ellipsis",
  });
  const paddedLabel = Content.assemble(" ", truncatedLabel, " ");

  // [LAW:dataflow-not-control-flow] Border label rendering always runs through
  // the same normalize -> truncate -> style pipeline. Empty output is data.
  return [...Segment.applyStyle(paddedLabel.toSegments(paddedLabel.cellLength), options.borderStyle)]
    .filter((segment) => segment.text !== "\n");
}

export function combineBorderQuads(left: BorderQuad, right: BorderQuad): BorderQuad {
  const cacheKey = `${left.join(",")}|${right.join(",")}`;
  const cached = combineQuadsCache.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const combined: BorderQuad = [
    left[0] === 0 ? right[0] : right[0] === 0 ? left[0] : Math.min(left[0], right[0]),
    left[1] === 0 ? right[1] : right[1] === 0 ? left[1] : Math.min(left[1], right[1]),
    left[2] === 0 ? right[2] : right[2] === 0 ? left[2] : Math.min(left[2], right[2]),
    left[3] === 0 ? right[3] : right[3] === 0 ? left[3] : Math.min(left[3], right[3]),
  ];

  combineQuadsCache.set(cacheKey, combined);
  return combined;
}
