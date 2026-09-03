// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// It does not modify framework internals.

import React from "react";
import { observer } from "mobx-react-lite";

import {
  renderVisual,
  resolveVisualRenderHeight,
  resolveVisualRenderWidth,
  visualize,
  type VisualInput,
} from "../content/index.js";
import { WidgetScope, useStyles, useWidget, type UseWidgetOptions } from "../framework/context.js";
import { MeasuredSizeReader, type MeasuredSize } from "../framework/measured-size.js";
import type { ResolvedStyles } from "../styles/index.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { WidgetFrame } from "./widget-frame.js";

// [LAW:dataflow-not-control-flow] Upstream's `render()` runs after layout, so a
// widget's content may legitimately depend on the box it was given —
// Placeholder's "size" variant renders that box and nothing else. Content stays
// one seam; what crosses it is either the value or the rule that produces it.
// A `Renderable` is an object carrying a `render` method, never a bare
// function, so `typeof` separates the two arms without ambiguity.
//
// The size handed across is the *content area* — padding and border already
// taken off — because that is the region the returned content is painted into,
// and it is what Textual's own `Widget.size` reports.
export type ContentSource = VisualInput | ((size: MeasuredSize) => VisualInput);

// The props every content-display widget accepts. `Static` and `Label` are
// aliases of this shape, not separate declarations of it.
export interface ContentProps extends WidgetComponentProps {
  content?: ContentSource;
}

// [LAW:one-type-per-behavior] Textual's `Label` and `Link` are both Static
// subclasses: same rendering, distinct types so CSS can target them, and in
// Link's case some added styling and keyboard behavior. Everything that varies
// between them crosses this one seam as a value, so the render body below
// stays a single copy rather than forking per subclass.
//
// The field types are borrowed from `UseWidgetOptions` so a widget fact has one
// definition; the per-instance options (id, classes, border titles) are absent
// because ContentWidget fills those from its own props.
export interface ContentWidgetIdentity
  extends Pick<
    UseWidgetOptions,
    "defaultCss" | "focusable" | "bindings" | "actions" | "handlers"
  > {
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

/**
 * The painted content, resolved against the box it will be painted into.
 *
 * A component rather than a few lines inside the render prop above, because the
 * resolved size is only known inside that prop and a memo needs a component to
 * live in. Without one, every re-render re-parses markup for every Static,
 * Label and Link on screen — `visualize` of a string is `Content.fromMarkup`,
 * not a cheap dispatch.
 */
const ContentBody = observer(function ContentBody({
  nodeId,
  styles,
  content,
  measured,
}: {
  nodeId: string;
  styles: ResolvedStyles;
  content: ContentSource | undefined;
  measured: MeasuredSize;
}): React.JSX.Element | null {
  // The content area on both axes: what gets painted, and what a size-reading
  // widget must be told. Handing over the raw measured region would have a
  // bordered widget build its content two columns too wide and then lose them
  // to the crop below.
  const width = resolveVisualRenderWidth(measured.width, styles.box);
  const height = resolveVisualRenderHeight(measured.height, styles.box);

  const visual = React.useMemo(
    () => visualize(typeof content === "function" ? content({ width, height }) : content),
    [content, width, height],
  );

  // Zero room means nothing to show — the same answer Rule, Input and Sparkline
  // give at zero. Painting into the one-column floor `renderVisual` needs would
  // wrap the content one glyph per row and grow the widget vertically out of a
  // box measured at zero. The height axis needs no such guard: it has no floor,
  // and a zero-row content renders as an empty Text that Ink gives no line to.
  return width === 0 ? null : renderVisual(visual, styles.text, `content:${nodeId}`, width);
});

export const ContentWidget = observer(function ContentWidget({
  identity,
  id,
  classes,
  content,
  borderTitle,
  borderSubtitle,
}: ContentWidgetProps): React.JSX.Element {
  const widget = useWidget({
    ...identity,
    id,
    classes: composeWidgetClasses(classes),
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
        {(measured) => (
          <WidgetFrame widget={widget.handle} styles={styles}>
            <ContentBody
              nodeId={widget.nodeId}
              styles={styles}
              content={content}
              measured={measured}
            />
          </WidgetFrame>
        )}
      </MeasuredSizeReader>
    </WidgetScope>
  );
});
