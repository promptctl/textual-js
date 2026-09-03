// [LAW:one-way-deps] Pure content arithmetic. This module knows about Content
// and cells; it knows nothing about widgets, styles, React or Ink.

import { Content } from "./content.js";

export type HorizontalAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";

export interface ContentBox {
  readonly width: number;
  readonly height: number;
}

export interface ContentAlign {
  readonly horizontal: HorizontalAlign;
  readonly vertical: VerticalAlign;
}

/**
 * Textual's `content-align`, done the only way this port can do it: by painting
 * the cells.
 *
 * Ink gives `backgroundColor` to `Text` and not to `Box`, so a widget's
 * background exists exactly where it emits a glyph and nowhere else. A widget
 * Textual would show as a coloured block therefore cannot ask flexbox to place
 * a short label in a large box — the cells flexbox would leave empty are the
 * cells that would go unpainted. It has to emit the whole region and place the
 * label inside it, which is what this does.
 *
 * The block moves as one, the way Textual moves it: `center` centres the
 * widest line and every other line shifts with it, rather than each line
 * centring on its own. A block taller than the box is cropped from the bottom
 * whatever the vertical alignment says, because a paragraph that begins
 * mid-sentence is never the intended reading.
 */
export function alignContentInBox(
  content: Content,
  box: ContentBox,
  align: ContentAlign,
): Content {
  const lines = content.wrap(box.width);
  // Reduced rather than spread into `Math.max`: a long text wraps to more lines
  // than an argument list can hold.
  const blockWidth = lines.reduce((widest, line) => Math.max(widest, line.cellLength), 0);
  const leading = offsetWithin(box.width - blockWidth, align.horizontal);
  const top = offsetWithin(box.height - lines.length, align.vertical);

  const rows = Array.from({ length: box.height }, (_row, index) =>
    padRow(lines[index - top], leading, box.width),
  );

  return new Content("\n").join(rows);
}

/**
 * Inset `content` on every side before aligning it, the way Textual's
 * `padding` does.
 *
 * A symmetric inset is the same arithmetic twice: the block is aligned inside
 * the smaller box, and that smaller box is then centred in the full one.
 */
export function alignContentInPaddedBox(
  content: Content,
  box: ContentBox,
  inset: number,
  align: ContentAlign,
): Content {
  const inner = {
    width: Math.max(0, box.width - inset * 2),
    height: Math.max(0, box.height - inset * 2),
  };

  return alignContentInBox(alignContentInBox(content, inner, align), box, {
    horizontal: "center",
    vertical: "middle",
  });
}

// Negative slack means the block is larger than the box; it starts at the near
// edge and the overflow is cropped, so every alignment agrees there.
function offsetWithin(slack: number, align: HorizontalAlign | VerticalAlign): number {
  const available = Math.max(0, slack);

  return align === "center" || align === "middle"
    ? Math.floor(available / 2)
    : align === "right" || align === "bottom"
      ? available
      : 0;
}

// A row index outside the block is a blank row of the box's own width — still
// painted, because painting is the point.
function padRow(line: Content | undefined, leading: number, width: number): Content {
  const cropped = line === undefined ? new Content("") : line.truncate(width);
  const offset = Math.min(leading, Math.max(0, width - cropped.cellLength));

  return Content.blank(offset)
    .add(cropped)
    .add(Content.blank(width - offset - cropped.cellLength));
}
