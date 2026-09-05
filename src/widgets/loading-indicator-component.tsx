// [LAW:one-type-per-behavior] A LoadingIndicator paints one caption centred in
// its whole region. Registering the type, reading the measured box and painting
// content inside the resolved frame is what ContentWidget already does, and the
// caption is a value crossing its seam. So LoadingIndicator is another identity
// for ContentWidget, not another render body.

import React from "react";

import { alignContentInBox, Content, type ContentAlign } from "../content/index.js";
import type { MeasuredSize } from "../framework/measured-size.js";
import type { WidgetComponentProps } from "./component-pattern.js";
import { ContentWidget, type ContentWidgetIdentity } from "./content-widget.js";

// Upstream's `render()` has two arms: five dots pulsing along a gradient, and —
// when `app.animation_level == "none"` — the literal text `Loading...`. This
// port has no animation system, so the still arm is the only frame it can
// produce, and it is produced unconditionally rather than behind a check on
// `animationLevel`. That is deliberate twice over. `animationLevel` defaults to
// `"full"` here and nothing reads TEXTUAL_ANIMATIONS into it, so a check would
// select the arm this port cannot render. And an unconditional still frame is
// what makes "the same frame on every capture" a property of the widget rather
// than of the environment it was captured in. [LAW:no-ambient-temporal-coupling]
//
// ProgressBar's indeterminate bar is the same call already shipped
// (progress-bar-component.tsx:33) — collapse the animation to the frame Textual
// itself settles on with animations off.
//
// `new Content` rather than `Content.fromText`, which parses markup: upstream
// builds this with Rich's `Text` constructor, which does not.
const CAPTION = new Content("Loading...");

// Upstream declares `content-align: center middle`, and it does not survive as
// CSS here for the reason `alignContentInBox` exists: Ink gives
// `backgroundColor` to `Text` and not to `Box`, so a widget's cells are painted
// exactly where it emits a glyph. The Python baseline emits all 240 cells of
// its 80x3 region in the indicator's colour, blank padding included, so the
// widget has to paint the whole region and place the caption inside it. Asking
// flexbox to centre a ten-column label would leave the other 230 cells
// unpainted.
const CENTRED: ContentAlign = { horizontal: "center", vertical: "middle" };

// Upstream's own rule, declaration for declaration, with two notes.
//
// `color` is upstream's `$primary` written as the hex it resolves to under the
// default dark theme, because `$token` colours do not currently resolve to
// Textual's values — see textual-theme-variables-bz8.
//
// `width: 100%` is upstream's `width: 100%`, and is not spelled `1fr` because
// this port resolves a fraction against a basis of 1 and would size the
// indicator to a single column.
//
// `text-style: not reverse` undoes a `reverse` inherited from an enclosing
// widget, and is carried rather than dropped because this port's `text-style`
// parses the `not` prefix (stylesheet.ts:1122). No fixture in the suite reaches
// the indicator through a reversed ancestor, so nothing here would catch its
// absence — which is the reason to take upstream's word for it rather than
// this suite's silence.
const DEFAULT_CSS = `
  LoadingIndicator {
    width: 100%;
    height: 100%;
    min-height: 1;
    color: #0178d4;
    text-style: not reverse;
  }
`;

export type LoadingIndicatorProps = WidgetComponentProps;

// Before the first measurement there is no region to paint, so the caption goes
// out at its natural size and the widget is placed around it — the same "size
// yourself" pass every measured widget takes.
function loadingIndicatorContent({ width, height }: MeasuredSize): Content {
  return width === undefined || height === undefined
    ? CAPTION
    : alignContentInBox(CAPTION, { width, height }, CENTRED);
}

const LOADING_INDICATOR_IDENTITY: ContentWidgetIdentity = {
  typeName: "LoadingIndicator",
  typeToken: LoadingIndicator,
  defaultCss: DEFAULT_CSS,
};

export function LoadingIndicator(props: LoadingIndicatorProps): React.JSX.Element {
  return (
    <ContentWidget
      {...props}
      identity={LOADING_INDICATOR_IDENTITY}
      content={loadingIndicatorContent}
    />
  );
}
