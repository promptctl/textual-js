// [LAW:one-type-per-behavior] Pretty shows a value's repr, highlighted and
// broken to the width it was given. Registering the type, reading the measured
// box and painting content inside the resolved frame is what ContentWidget
// already does, and the repr is a value crossing its seam. So Pretty is a
// fifth identity for ContentWidget — after Label, Link, Placeholder and
// LoadingIndicator — and not a fifth render body.

import React from "react";

import type { Content } from "../content/index.js";
import type { MeasuredSize } from "../framework/measured-size.js";
import type { WidgetComponentProps } from "./component-pattern.js";
import { ContentWidget, type ContentWidgetIdentity } from "./content-widget.js";
import { prettyContent } from "./pretty.js";

export interface PrettyProps extends WidgetComponentProps {
  // Required, and typed `unknown` rather than made optional: every JavaScript
  // value has a repr, including `undefined`, so there is no such thing as a
  // Pretty with nothing to show. A default would make "nothing was passed" and
  // "undefined was passed" the same widget.
  object: unknown;
}

// Upstream declares only `height: auto`, which is what Ink's flexbox does
// unprompted, so it is left out rather than restated — the same call Digits
// made. `width` is written down for the opposite reason: upstream declares
// none at all. `Pretty.DEFAULT_CSS` is `height: auto` alone and
// `Widget.DEFAULT_CSS` sets no width, so `styles.width` is `None` — which
// `Widget._get_box_model` special-cases to fill the available space, and does
// so unconditionally, where a real fraction is downgraded to `auto` in a
// non-greedy context. There is no such special case here, so the fill has to
// be stated, and `100%` states it: a percentage fills unconditionally too,
// while `1fr` would resolve against `scalarToInkValue`'s fraction basis of 1
// and give a one-column Pretty.
//
// Digits is the neighbour to not read this off. Its `width: 1fr` is real and
// declared in `Digits.DEFAULT_CSS`; it is that widget's own rule, not a
// Widget-wide default to inherit.
//
// Width matters more for this widget than for most, because it is also the
// width the repr is laid out against. Taking it from the parent rather than
// from the content is what keeps that from being circular.
const DEFAULT_CSS = `
  Pretty {
    width: 100%;
  }
`;

const PRETTY_IDENTITY: ContentWidgetIdentity = {
  typeName: "Pretty",
  typeToken: Pretty,
  defaultCss: DEFAULT_CSS,
};

export function Pretty({ object, ...rest }: PrettyProps): React.JSX.Element {
  // Memoised on the value, not rebuilt per render: ContentBody keys its own
  // memo on the content function's identity, so a fresh closure each render
  // would re-traverse and re-highlight the whole object on every unrelated
  // repaint.
  //
  // Before the first measurement there is no width to lay out against, and an
  // unconstrained width is the honest answer for a pass whose question is "how
  // wide would you like to be" — every entry fits, so the repr goes out on one
  // line at its natural size. The measured pass then breaks it to the real
  // region, which is where `height: auto` earns its keep.
  const content = React.useMemo(
    () =>
      ({ width }: MeasuredSize): Content =>
        prettyContent(object, width ?? Number.POSITIVE_INFINITY),
    [object],
  );

  return <ContentWidget {...rest} identity={PRETTY_IDENTITY} content={content} />;
}
