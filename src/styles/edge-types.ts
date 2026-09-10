import type { BoxProps } from "ink";

import { StyleValueError } from "./scalar.js";

// Textual's border vocabulary — `BORDER_CHARS` and `BORDER_LOCATIONS` in
// textual/_border.py, verified against textual 8.2.3 — and the one place it is
// translated into the box Ink draws. The stylesheet accepts exactly the names
// this table holds, so a style that parses is a style that renders.

const VISIBLE_EDGE_TYPES = [
  "ascii",
  "blank",
  "block",
  "dashed",
  "double",
  "heavy",
  "hkey",
  "inner",
  "outer",
  "panel",
  "round",
  "solid",
  "tab",
  "tall",
  "thick",
  "vkey",
  "wide",
] as const;

export type VisibleEdgeType = (typeof VISIBLE_EDGE_TYPES)[number];

/** A parsed border style. `""` is no border at all. */
export type EdgeType = VisibleEdgeType | "";

// A reversed cell is painted with the border colour as its background, so its
// glyph is the part that shows a background colour through. Ink paints border
// glyphs in foreground only and can draw just the complement: for `▊` (left
// three quarters) that is a bar across the right quarter, and `▕` (right eighth)
// is the nearest block glyph that is a bar on the right edge.
const FOREGROUND_OF_REVERSED = { "▊": "▕" } as const;

// The role is the index into the four cell styles Textual's `get_box` builds:
// 0 inner, 1 outer, 2 and 3 the reversed pair. Only a glyph with a known
// complement can sit in a reversed role, so the table cannot name one Ink has no
// way to draw.
type Cell =
  | readonly [glyph: string, role: 0 | 1]
  | readonly [glyph: keyof typeof FOREGROUND_OF_REVERSED, role: 2 | 3];
type Row = readonly [left: Cell, middle: Cell, right: Cell];
type BorderBox = readonly [top: Row, middle: Row, bottom: Row];

const BORDER_BOXES: Record<VisibleEdgeType, BorderBox> = {
  ascii: [[["+", 0], ["-", 0], ["+", 0]], [["|", 0], [" ", 0], ["|", 0]], [["+", 0], ["-", 0], ["+", 0]]],
  blank: [[[" ", 0], [" ", 0], [" ", 0]], [[" ", 0], [" ", 0], [" ", 0]], [[" ", 0], [" ", 0], [" ", 0]]],
  block: [[["▄", 1], ["▄", 1], ["▄", 1]], [["█", 0], [" ", 0], ["█", 0]], [["▀", 1], ["▀", 1], ["▀", 1]]],
  dashed: [[["┏", 0], ["╍", 0], ["┓", 0]], [["╏", 0], [" ", 0], ["╏", 0]], [["┗", 0], ["╍", 0], ["┛", 0]]],
  double: [[["╔", 0], ["═", 0], ["╗", 0]], [["║", 0], [" ", 0], ["║", 0]], [["╚", 0], ["═", 0], ["╝", 0]]],
  heavy: [[["┏", 0], ["━", 0], ["┓", 0]], [["┃", 0], [" ", 0], ["┃", 0]], [["┗", 0], ["━", 0], ["┛", 0]]],
  hkey: [[["▔", 0], ["▔", 0], ["▔", 0]], [[" ", 0], [" ", 0], [" ", 0]], [["▁", 0], ["▁", 0], ["▁", 0]]],
  inner: [[["▗", 1], ["▄", 1], ["▖", 1]], [["▐", 1], [" ", 1], ["▌", 1]], [["▝", 1], ["▀", 1], ["▘", 1]]],
  outer: [[["▛", 0], ["▀", 0], ["▜", 0]], [["▌", 0], [" ", 0], ["▐", 0]], [["▙", 0], ["▄", 0], ["▟", 0]]],
  panel: [[["▊", 2], ["█", 0], ["▎", 1]], [["▊", 2], [" ", 0], ["▎", 1]], [["▊", 2], ["▁", 0], ["▎", 1]]],
  round: [[["╭", 0], ["─", 0], ["╮", 0]], [["│", 0], [" ", 0], ["│", 0]], [["╰", 0], ["─", 0], ["╯", 0]]],
  solid: [[["┌", 0], ["─", 0], ["┐", 0]], [["│", 0], [" ", 0], ["│", 0]], [["└", 0], ["─", 0], ["┘", 0]]],
  tab: [[["▁", 1], ["▁", 1], ["▁", 1]], [["▎", 0], [" ", 1], ["▊", 3]], [["▔", 1], ["▔", 1], ["▔", 1]]],
  tall: [[["▊", 2], ["▔", 0], ["▎", 1]], [["▊", 2], [" ", 0], ["▎", 1]], [["▊", 2], ["▁", 0], ["▎", 1]]],
  thick: [[["█", 0], ["▀", 0], ["█", 0]], [["█", 0], [" ", 0], ["█", 0]], [["█", 0], ["▄", 0], ["█", 0]]],
  vkey: [[["▏", 0], [" ", 0], ["▕", 0]], [["▏", 0], [" ", 0], ["▕", 0]], [["▏", 0], [" ", 0], ["▕", 0]]],
  wide: [[["▁", 1], ["▁", 1], ["▁", 1]], [["▎", 0], [" ", 1], ["▊", 3]], [["▔", 1], ["▔", 1], ["▔", 1]]],
};

// [LAW:one-source-of-truth] Textual's `_edge_type_normalization_table`: `none`
// and `hidden` both become "" when parsed, so nothing downstream asks which
// spelling it was.
const EDGE_TYPE_BY_NAME: ReadonlyMap<string, EdgeType> = new Map<string, EdgeType>([
  ...VISIBLE_EDGE_TYPES.map((name) => [name, name] as const),
  ["none", ""],
  ["hidden", ""],
]);

/** Every border style name a stylesheet accepts, spelled as Textual spells it. */
export const BORDER_STYLE_NAMES: readonly string[] = [...EDGE_TYPE_BY_NAME.keys()];

// [LAW:parse-dont-validate] The only way from a CSS token to an EdgeType.
export function parseEdgeType(name: string): EdgeType {
  const edgeType = EDGE_TYPE_BY_NAME.get(name);

  if (edgeType === undefined) {
    throw new StyleValueError(
      `Invalid border style "${name}"; expected one of ${BORDER_STYLE_NAMES.join(", ")}`,
    );
  }

  return edgeType;
}

type InkBoxStyle = Exclude<NonNullable<BoxProps["borderStyle"]>, string>;

function inkGlyph(cell: Cell): string {
  return cell[1] === 2 || cell[1] === 3 ? FOREGROUND_OF_REVERSED[cell[0]] : cell[0];
}

/**
 * The box Ink draws for an edge type: always a glyph object, never one of Ink's
 * own style names, whose vocabulary is not Textual's. `""` is no Ink border, so
 * Ink reserves no cells for it — the zero spacing Textual gives it too.
 */
export function inkBorderStyle(edgeType: EdgeType): InkBoxStyle | undefined {
  if (edgeType === "") {
    return undefined;
  }

  const [[topLeft, top, topRight], [left, , right], [bottomLeft, bottom, bottomRight]] =
    BORDER_BOXES[edgeType];

  return {
    topLeft: inkGlyph(topLeft),
    top: inkGlyph(top),
    topRight: inkGlyph(topRight),
    left: inkGlyph(left),
    right: inkGlyph(right),
    bottomLeft: inkGlyph(bottomLeft),
    bottom: inkGlyph(bottom),
    bottomRight: inkGlyph(bottomRight),
  };
}
