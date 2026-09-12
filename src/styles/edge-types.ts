import type { BoxProps } from "ink";

import { Content } from "../content/content.js";
import { renderContentToAnsi } from "../content/render.js";
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

// The role is the index into the four cell styles Textual's `get_box` builds.
// Each is the edge colour over a ground: 0 over the widget's own background, 1
// over what lies beneath the widget, and 2 and 3 those two reversed, so the edge
// colour fills the cell and the glyph is cut out of it in the ground's colour.
type Role = 0 | 1 | 2 | 3;
type Cell = readonly [glyph: string, role: Role];
type Row = readonly [left: Cell, middle: Cell, right: Cell];
type BorderBox = readonly [top: Row, middle: Row, bottom: Row];

const BORDER_BOXES: Record<EdgeType, BorderBox> = {
  "": [[[" ", 0], [" ", 0], [" ", 0]], [[" ", 0], [" ", 0], [" ", 0]], [[" ", 0], [" ", 0], [" ", 0]]],
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

/**
 * One side of a border, ready to draw: its style, and its colour as Ink spells
 * it. `undefined` is a colour that carries nothing to paint — a `transparent`
 * edge — and leaves the cell in the terminal's own foreground.
 */
export interface Edge {
  readonly style: EdgeType;
  readonly color: string | undefined;
}

export interface Edges {
  readonly top: Edge;
  readonly right: Edge;
  readonly bottom: Edge;
  readonly left: Edge;
}

/**
 * The two backgrounds a border cell is painted over — Textual's `inner` (the
 * widget's own) and `outer` (what lies beneath the widget). `undefined` paints no
 * background, so the terminal's shows through.
 */
export interface EdgeGrounds {
  readonly inner: string | undefined;
  readonly outer: string | undefined;
}

const ROLE_PAINT: Record<Role, { readonly ground: keyof EdgeGrounds; readonly inverse: boolean }> = {
  0: { ground: "inner", inverse: false },
  1: { ground: "outer", inverse: false },
  2: { ground: "outer", inverse: true },
  3: { ground: "inner", inverse: true },
};

// [LAW:single-enforcer] A border cell reaches Ink already rendered by the bridge
// that paints every widget's text, never through Ink's `borderColor`. Ink colours
// a border through chalk, which settles at 16 colours inside the visual-test
// xterm and quantises truecolor, and it gives a border no background at all. A
// pre-rendered glyph carries both, and Ink still tiles it along the edge.
function paintCell(box: BorderBox, row: 0 | 1 | 2, column: 0 | 1 | 2, edge: Edge, grounds: EdgeGrounds): string {
  const [glyph, role] = box[row][column];
  const { ground, inverse } = ROLE_PAINT[role];

  return renderContentToAnsi(new Content(glyph), { color: edge.color, backgroundColor: grounds[ground], inverse }, 1);
}

export type EdgeBoxProps = Required<
  Pick<BoxProps, "borderStyle" | "borderTop" | "borderRight" | "borderBottom" | "borderLeft">
>;

/**
 * The Ink border that draws `edges` as Textual's `render_line` does.
 *
 * Every Ink slot takes its cell from the edge Textual draws it from: the whole
 * top row, corners included, from the top edge; the sides from the left and
 * right edges' middle row; the bottom row from the bottom edge. Ink draws a
 * corner only beside a shown side — Textual's `has_left` and `has_right` — and
 * reserves a cell only on a shown side, so an edge with no style takes no space.
 */
export function edgeBoxProps(edges: Edges, grounds: EdgeGrounds): EdgeBoxProps {
  const top = BORDER_BOXES[edges.top.style];
  const bottom = BORDER_BOXES[edges.bottom.style];

  return {
    borderStyle: {
      topLeft: paintCell(top, 0, 0, edges.top, grounds),
      top: paintCell(top, 0, 1, edges.top, grounds),
      topRight: paintCell(top, 0, 2, edges.top, grounds),
      left: paintCell(BORDER_BOXES[edges.left.style], 1, 0, edges.left, grounds),
      right: paintCell(BORDER_BOXES[edges.right.style], 1, 2, edges.right, grounds),
      bottomLeft: paintCell(bottom, 2, 0, edges.bottom, grounds),
      bottom: paintCell(bottom, 2, 1, edges.bottom, grounds),
      bottomRight: paintCell(bottom, 2, 2, edges.bottom, grounds),
    },
    borderTop: edges.top.style !== "",
    borderRight: edges.right.style !== "",
    borderBottom: edges.bottom.style !== "",
    borderLeft: edges.left.style !== "",
  };
}
