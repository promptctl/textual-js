// [LAW:one-type-per-behavior] A Placeholder paints a coloured block with one of
// three captions in it. Registering the type, reading the measured box, and
// painting content inside the resolved frame is what ContentWidget already
// does; the variant, the label and the palette entry are values crossing its
// seams. So Placeholder is a second identity for ContentWidget, not a second
// render body.

import React from "react";

import { useTextual } from "../framework/context.js";
import type { MeasuredSize } from "../framework/measured-size.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { ContentWidget, type ContentWidgetIdentity } from "./content-widget.js";
import {
  cyclePlaceholderVariant,
  nextPlaceholderColorIndex,
  parsePlaceholderVariant,
  placeholderColorClass,
  placeholderContent,
  placeholderLabel,
  placeholderPaletteCss,
} from "./placeholder.js";

// Upstream's DEFAULT_CSS is `content-align: center middle; overflow: hidden;
// color: $text`, plus `padding: 1` on the text variant. None of those four
// survive as CSS here, and the reason is one fact about the renderer: Ink gives
// `backgroundColor` to `Text` and not to `Box`, so a widget's background exists
// only where it emits a glyph. Alignment and padding that leave cells empty
// leave them *unpainted*, which is precisely what a placeholder must not do.
// So this widget paints its whole region as content and positions the caption
// inside it — `alignContentInPaddedBox` — and overflow cropping falls out of
// emitting exactly as many rows as the box has. The palette supplies `color`,
// because `$text` is theme-wide here and cannot vary per placeholder.
//
// What is left is the width, and `width: 100%` is not upstream's either:
// upstream relies on a Widget's default `1fr`, which this port resolves against
// a fraction basis of 1 and would size a placeholder to a single column.
const DEFAULT_CSS = `
  Placeholder {
    width: 100%;
  }
${placeholderPaletteCss()}
`;

export interface PlaceholderProps extends WidgetComponentProps {
  label?: string;
  variant?: string;
}

export function Placeholder({
  label,
  variant = "default",
  id,
  classes,
  ...rest
}: PlaceholderProps): React.JSX.Element {
  const app = useTextual();

  // [LAW:parse-dont-validate] The checkpoint runs before anything that assumes
  // it passed. Claiming a colour first would spend an index from the app's
  // shared sequence on a placeholder that then throws — leaving every later
  // placeholder one colour off, and nothing to unwind it, since the claim is a
  // raw side effect React knows nothing about.
  const baseVariant = parsePlaceholderVariant(variant);

  // Consecutive placeholders in one app get consecutive colours, so this
  // instance claims one index and keeps it.
  //
  // [LAW:effects-at-boundaries] Claiming advances a counter the whole app
  // shares, which is a side effect, and React reserves the right to invoke a
  // render more than once — StrictMode does it deliberately. So the claim is
  // made idempotent rather than merely made early: the ref survives a repeated
  // invocation and the second one reuses the index instead of burning another.
  // An effect would be the other way to satisfy the rule and is worse here — it
  // would paint the first frame with no palette class at all, which for a
  // widget that exists to be a coloured block is a visible flash.
  const claimedIndex = React.useRef<number | undefined>(undefined);
  claimedIndex.current ??= nextPlaceholderColorIndex(app);
  const colorIndex = claimedIndex.current;

  // What a click accumulates is *steps around the cycle*, not the variant
  // itself. Storing the variant would make it a second source of truth
  // alongside the prop, and the two would disagree the moment the prop changed;
  // storing the offset leaves the variant derived from both. Zero clicks is
  // exactly the prop. [LAW:one-source-of-truth]
  const [cycleSteps, setCycleSteps] = React.useState(0);

  const activeVariant = cyclePlaceholderVariant(baseVariant, cycleSteps);

  // Held stable across renders so the content memo downstream can hit: a fresh
  // closure every render would re-wrap the lorem, grapheme by grapheme, for
  // every unrelated re-render.
  const content = React.useCallback(
    (size: MeasuredSize) =>
      placeholderContent(activeVariant, { label: placeholderLabel(label, id), size }),
    [activeVariant, label, id],
  );

  const identity: ContentWidgetIdentity = {
    typeName: "Placeholder",
    typeToken: Placeholder,
    defaultCss: DEFAULT_CSS,
    handlers: {
      onClick: () => {
        setCycleSteps((steps) => steps + 1);
      },
    },
  };

  return (
    <ContentWidget
      {...rest}
      id={id}
      classes={composeWidgetClasses(
        classes,
        `-${activeVariant}`,
        placeholderColorClass(colorIndex),
      )}
      identity={identity}
      content={content}
    />
  );
}
