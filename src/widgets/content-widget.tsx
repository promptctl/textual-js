// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// It does not modify framework internals.

import React from "react";
import { observer } from "mobx-react-lite";

import {
  renderVisual,
  resolveVisualRenderWidth,
  visualize,
  type VisualInput,
} from "../content/index.js";
import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import { MeasuredSizeReader } from "../framework/measured-size.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { WidgetFrame } from "./widget-frame.js";

// The props every content-display widget accepts. `Static` and `Label` are
// aliases of this shape, not separate declarations of it.
export interface ContentProps extends WidgetComponentProps {
  content?: VisualInput;
}

// [LAW:one-type-per-behavior] Textual's Label is `class Label(Static)`: same
// rendering, a distinct type so CSS can target it. The only thing that varies
// is the identity a widget registers under, so that variability crosses this
// one seam as a value instead of forking the render body into two copies.
export interface ContentWidgetIdentity {
  typeName: string;
  typeToken: Function;
  // Type names this widget also matches, so a base type's CSS cascades onto it
  // the way Python inheritance makes `Static { … }` reach a Label.
  baseTypeNames?: string[];
}

export interface ContentWidgetProps extends ContentProps {
  identity: ContentWidgetIdentity;
}

// No DEFAULT_CSS needed — Ink's flexbox auto-sizes by default.

export const ContentWidget = observer(function ContentWidget({
  identity,
  id,
  classes,
  content,
  borderTitle,
  borderSubtitle,
}: ContentWidgetProps): React.JSX.Element {
  const visual = React.useMemo(() => visualize(content), [content]);

  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes),
    typeName: identity.typeName,
    typeToken: identity.typeToken,
    baseTypeNames: identity.baseTypeNames,
    borderTitle,
    borderSubtitle,
  });

  const styles = useStyles(widget.handle);

  // The unmeasured pass renders unconstrained rather than at zero: content wrapped
  // to zero columns measures zero, and a widget sized from its own content would
  // then have nothing left to grow back from.
  return (
    <WidgetScope widget={widget.handle}>
      <MeasuredSizeReader widget={widget.handle}>
        {({ width }) => {
          const renderWidth = resolveVisualRenderWidth(width, styles.box);

          return (
            <WidgetFrame widget={widget.handle} styles={styles}>
              {/* Zero room means nothing to show — the same answer Rule, Input
                  and Sparkline give at zero. Painting into the one-column floor
                  `renderVisual` needs would wrap the content one glyph per row
                  and grow the widget vertically out of a box measured at zero. */}
              {renderWidth === 0
                ? null
                : renderVisual(visual, styles.text, `content:${widget.nodeId}`, renderWidth)}
            </WidgetFrame>
          );
        }}
      </MeasuredSizeReader>
    </WidgetScope>
  );
});
