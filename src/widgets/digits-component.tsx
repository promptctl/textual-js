// [LAW:one-type-per-behavior] Digits shows a value in a tall font. Everything
// else about it — registering a widget type, reading its width from the
// measured-size seam, painting content inside the resolved frame — is what
// every Static-family widget already does, and what ContentWidget already is.
// The only thing that varies is the content, and content is a value crossing an
// existing seam. So Digits is a second identity for ContentWidget, never a
// second render body.

import React from "react";

import type { WidgetComponentProps } from "./component-pattern.js";
import { ContentWidget, type ContentWidgetIdentity } from "./content-widget.js";
import { digitsContent } from "./digits.js";

export interface DigitsProps extends WidgetComponentProps {
  value?: string | number;
}

// No `baseTypeNames`: upstream is `class Digits(Widget)`, not a Static
// subclass, so a `Static { … }` rule must stop short of a Digits even though it
// reaches a Label.
//
// No `defaultCss` either, and that is a deliberate gap rather than an omission.
// Upstream's default is `width: 1fr`, which this port's scalar layer resolves
// against a fraction basis of 1 — a one-cell-wide widget. Letting Ink size the
// box to the glyphs is the closest honest equivalent, and it is
// pixel-identical wherever the text is left-aligned, since the only thing
// `1fr` adds is trailing spaces carrying no ink.
const DIGITS_IDENTITY: ContentWidgetIdentity = {
  typeName: "Digits",
  typeToken: Digits,
};

export function Digits({ value = "", ...rest }: DigitsProps): React.JSX.Element {
  return <ContentWidget {...rest} identity={DIGITS_IDENTITY} content={digitsContent(value)} />;
}
