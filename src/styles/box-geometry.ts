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
// non-overlapping halves with one owner each: the *outer* half positions and
// sizes the widget inside its parent (margin, width policy) and belongs to the
// measured wrapper; the *inner* half paints the widget (padding, background,
// borders, explicit sizes) and belongs to the box the widget renders. Splitting
// here rather than at each consumer is what keeps margin from being applied
// twice once the wrapper starts carrying it.
export function outerBoxGeometry(box: Partial<BoxProps>): Partial<BoxProps> {
  return {
    marginTop: box.marginTop,
    marginRight: box.marginRight,
    marginBottom: box.marginBottom,
    marginLeft: box.marginLeft,
    // Textual's default widget width is `1fr` — fill the container — which is
    // already Yoga's default cross-axis behaviour, so only the opt-out needs
    // saying. `width: auto` hugs content, and combined with the default
    // `flexGrow: 0` that hugs on both axes regardless of the parent's direction.
    alignSelf: box.width === AUTO ? "flex-start" : undefined,
  };
}

export function innerBoxGeometry(box: Partial<BoxProps>): Partial<BoxProps> {
  const { marginTop, marginRight, marginBottom, marginLeft, width, ...inner } = box;

  return width === AUTO ? inner : { ...inner, width };
}
