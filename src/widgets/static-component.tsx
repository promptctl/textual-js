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

export interface StaticProps extends WidgetComponentProps {
  content?: VisualInput;
}

// No DEFAULT_CSS needed — Ink's flexbox auto-sizes by default.

// [LAW:one-type-per-behavior] Static is the single React component for
// non-interactive text display. No separate Label component duplicates this.
// [LAW:one-source-of-truth] Match Textual's `Static` public widget name;
// model helpers use explicit internal names instead of competing exports.
export const Static = observer(function Static({
  id,
  classes,
  content,
  borderTitle,
  borderSubtitle,
}: StaticProps): React.JSX.Element {
  const visual = React.useMemo(() => visualize(content), [content]);

  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes),
    typeName: "Static",
    typeToken: Static,
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
                : renderVisual(visual, styles.text, `static:${widget.nodeId}`, renderWidth)}
            </WidgetFrame>
          );
        }}
      </MeasuredSizeReader>
    </WidgetScope>
  );
});
