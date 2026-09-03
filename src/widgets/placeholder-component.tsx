// [LAW:one-type-per-behavior] A Placeholder paints a coloured block with one of
// three captions in it. Registering the type, reading the measured box, and
// painting content inside the resolved frame is what ContentWidget already
// does; the variant, the label and the palette entry are values crossing its
// seams. So Placeholder is a second identity for ContentWidget, not a second
// render body.

import React from "react";

import { useTextual } from "../framework/context.js";
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

  // Consecutive placeholders in one app get consecutive colours, so the index
  // is claimed once when this instance first renders and never recomputed.
  const [colorIndex] = React.useState(() => nextPlaceholderColorIndex(app));

  // What a click accumulates is *steps around the cycle*, not the variant
  // itself. Storing the variant would make it a second source of truth
  // alongside the prop, and the two would disagree the moment the prop changed;
  // storing the offset leaves the variant derived from both. Zero clicks is
  // exactly the prop. [LAW:one-source-of-truth]
  const [cycleSteps, setCycleSteps] = React.useState(0);

  const activeVariant = cyclePlaceholderVariant(parsePlaceholderVariant(variant), cycleSteps);

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
      content={(size) =>
        placeholderContent(activeVariant, { label: placeholderLabel(label, id), size })
      }
    />
  );
}
