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
// the widget in its parent (margin, width) and belongs to the measured wrapper;
// the *inner* half paints it (padding, background, borders) and belongs to the
// box the widget renders. Splitting here rather than at each consumer is what
// keeps a property from reaching the DOM twice.
export function outerBoxGeometry(box: Partial<BoxProps>): Partial<BoxProps> {
  return {
    marginTop: box.marginTop,
    marginRight: box.marginRight,
    marginBottom: box.marginBottom,
    marginLeft: box.marginLeft,
    // Textual's default width is `1fr` — fill the container — which is already
    // Yoga's default, so only the two opt-outs need saying: a concrete width
    // sizes the box directly, and `auto` hugs content via cross-axis alignment.
    width: box.width === AUTO ? undefined : box.width,
    alignSelf: box.width === AUTO ? "flex-start" : undefined,
  };
}

export function innerBoxGeometry(box: Partial<BoxProps>): Partial<BoxProps> {
  const { marginTop, marginRight, marginBottom, marginLeft, width, ...inner } = box;

  return inner;
}
