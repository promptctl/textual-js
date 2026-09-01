// [LAW:one-way-deps] Pure interpretation of already-resolved styles. This
// module reads Ink box props and returns Ink box props; it knows nothing about
// widgets, React, or the framework.

import type { BoxProps } from "ink";

// Ink spells Textual's `width: auto` as the string "auto" (see Unit.AUTO in
// ./scalar.ts). It is a sizing *policy* rather than a size, so it is expressed
// on the widget's outer box as a flex alignment and never handed to Ink as a
// width — Ink reads a string width as a percentage.
const AUTO = "auto";

// [LAW:one-source-of-truth] A widget's resolved box splits into exactly two
// non-overlapping halves with one owner each: the *outer* half places and sizes
// the widget in its parent (margin, and the whole width axis) and belongs to the
// measured wrapper; the *inner* half paints it (padding, background, borders)
// and belongs to the box the widget renders. Splitting here rather than at each
// consumer is what keeps a property from reaching the DOM twice.
//
// An axis moves as a unit. A width bound left on the inner box while the width
// itself sits outer is a floor Yoga applies to a box whose parent never agreed
// to it: `width: 5` with `min-width: 16` measured a 5-cell region around 16
// painted cells, putting hit-testing back where this split found it. The height
// axis is inner for the same reason — `height` is still an inner property, so
// its bounds stay beside it until tickets .3/.4 move the axis as a whole.
//
// `alignSelf` appears in both halves and is not a duplicate: the outer half
// sets its own as the width-auto hug, while the cascade's (from
// `content-align-vertical`) stays inner, because aligning a widget's content
// is the job of the box that paints it.
export function outerBoxGeometry(box: Partial<BoxProps>): Partial<BoxProps> {
  return {
    marginTop: box.marginTop,
    marginRight: box.marginRight,
    marginBottom: box.marginBottom,
    marginLeft: box.marginLeft,
    // `display: none` has to sit on the same box as the margin it cancels:
    // left on the painted box, it empties the widget while the outer box goes
    // on reserving margin for it, so a hidden widget leaves blank rows.
    // Defaulted rather than passed through because Ink keys off the property
    // being *present* and reads any non-"flex" value, `undefined` included, as
    // "none" (ink/build/styles.js: `style.display === 'flex' ? FLEX : NONE`).
    display: box.display ?? "flex",
    // Textual's default width is `1fr` — fill the container — which is already
    // Yoga's default, so only the two opt-outs need saying: a concrete width
    // sizes the box directly, and `auto` hugs content via cross-axis alignment.
    width: box.width === AUTO ? undefined : box.width,
    minWidth: box.minWidth,
    alignSelf: box.width === AUTO ? "flex-start" : undefined,
  };
}

export function innerBoxGeometry(box: Partial<BoxProps>): Partial<BoxProps> {
  const { marginTop, marginRight, marginBottom, marginLeft, width, minWidth, display, ...inner } = box;

  return inner;
}
