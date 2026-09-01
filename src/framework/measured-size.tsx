// [LAW:single-enforcer] The one place a rendering widget learns how big it is.
// Every width-aware widget used to read `widget.screenRegion` for itself, which
// silently made each one responsible for three things: being an `observer` so
// the value keeps arriving, rendering sanely before the first measurement, and
// not letting its own output drive its own width. Six widgets carried those
// obligations and four of them answered the middle one differently. Routing the
// read through this module means a new width-aware widget cannot forget them,
// because it never touches the observable.

import React from "react";
import { observer } from "mobx-react-lite";

import type { Widget } from "./widget.js";

/**
 * The rectangle Ink placed a widget in, expressed the way the widget's own
 * renderer needs it.
 *
 * Each axis is `undefined` until the layout has measured the widget, and that
 * is deliberately not `0`. The two mean opposite things to a renderer: `0` says
 * "you were measured and you have no room", while `undefined` says "nothing has
 * measured you yet — size yourself." Handing `0` for the second case is how an
 * auto-sized widget dies: it renders into a zero budget, Yoga measures the zero
 * it just drew, and it never grows out of it.
 */
export interface MeasuredSize {
  readonly width: number | undefined;
  readonly height: number | undefined;
}

export interface MeasuredSizeReaderProps {
  widget: Widget;
  children: (size: MeasuredSize) => React.JSX.Element;
}

export const MeasuredSizeReader = observer(function MeasuredSizeReader({
  widget,
  children,
}: MeasuredSizeReaderProps): React.JSX.Element {
  const region = widget.screenRegion;

  return children(
    widget.isPlaced ? { width: region.width, height: region.height } : { width: undefined, height: undefined },
  );
});
