// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// [LAW:one-source-of-truth] Validation lives in ProgressBarModel; the bar's
// shape lives in renderBar; this component only joins them to the cascade.
// [LAW:single-enforcer] Every glyph leaves through renderContent, the one
// visual-to-Ink bridge. Colours passed to Ink's <Text> instead go through
// chalk, whose depth is decided per-terminal — inside the visual-test xterm it
// resolves to 1 and quantises #0178d4 to ANSI blue. The bridge emits truecolour
// itself, so the bar's palette survives wherever every other widget's does.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";

import { Content, renderContent } from "../content/index.js";
import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { renderBar } from "./bar-renderable.js";
import { ProgressBarModel } from "./progress-bar.js";

// Textual sizes the bar itself, not the ProgressBar: `Bar { width: 32 }` inside
// a `ProgressBar { width: auto }`. The bar is therefore a fixed 32 cells and the
// widget hugs it plus its labels — deriving the bar from the available width is
// what made a 37-cell widget paint across all 80 columns.
const BAR_WIDTH = 32;

// Textual's `PercentageStatus { width: 5 }` and `ETAStatus { width: 9 }`, both
// `content-align-horizontal: right`. The widths are what make every baseline
// exactly 37 columns wide at `show_eta=False`; padding here is that alignment.
const PERCENTAGE_WIDTH = 5;
const ETA_WIDTH = 9;

// An indeterminate bar has no progress to point at, so Textual animates a pulse
// across it — and collapses that animation to a fully highlighted bar wherever
// animations are off (`Bar.render_indeterminate`, the `animation_level == "none"`
// branch). textual-js has no animation system, so the still frame is the only
// frame it can be, and it is the one the visual harness compares against:
// render-fixture-xvfb.sh runs Python under TEXTUAL_ANIMATIONS=none.
const INDETERMINATE_RANGE: readonly [number, number] = [0, BAR_WIDTH];

// [LAW:one-source-of-truth] Textual styles the bar through the component
// classes `bar--bar`, `bar--complete` and `bar--indeterminate`; the cascade is
// the only place these defaults appear, and the state classes the component
// already composes are what select between them. `color` stays the widget's
// text colour — the percentage and ETA readouts — exactly as it is in Textual,
// where those are Labels inheriting the screen's foreground.
//
// Each hex is what Textual's `get_component_rich_style` *resolves* to, not what
// the theme declares: the indeterminate bar's `$error` is declared #ba3c5b and
// arrives as #b93c5b. One unit of red, and it paints the whole bar wrong.
const DEFAULT_CSS = `
  ProgressBar {
    width: auto;
    height: 1;
    --bar-color: #0178d4;
    --bar-rail-color: #1e1e1e;
  }
  ProgressBar.-complete {
    --bar-color: #4ebf71;
  }
  ProgressBar.-indeterminate {
    --bar-color: #b93c5b;
  }
`;

export interface ProgressBarProps extends WidgetComponentProps {
  total?: number | null;
  progress?: number;
  showBar?: boolean;
  showPercentage?: boolean;
  showEta?: boolean;
}

// markup: false — these are formatted readouts, not markup source. Nothing in
// "50%" or "--:--:--" is tag syntax today, but routing widget-generated display
// text through the markup parser is how a description reading "Save [Ctrl+S]"
// loses its brackets, and the readouts have no reason to be the exception.
function field(text: string, width: number): Content {
  return Content.fromText(text.padStart(width), { markup: false });
}

function formatPercentage(percentage: number | null): string {
  return percentage === null ? "--%" : `${Math.floor(percentage * 100)}%`;
}

// Textual truncates the bar's percentage onto the half-cell lattice before the
// bar ever sees it (`Bar._validate_percentage`, whose `int()` floors), so a
// progress change too small to move a glyph cannot move one. 53% lands on
// 33/64, not 34/64 -- rounding here would paint half a cell too many.
function highlightRange(percentage: number | null): readonly [number, number] {
  return percentage === null
    ? INDETERMINATE_RANGE
    : [0, Math.trunc(percentage * BAR_WIDTH * 2) / 2];
}

export const ProgressBar = observer(function ProgressBar({
  id,
  classes,
  borderTitle,
  borderSubtitle,
  total = null,
  progress = 0,
  showBar = true,
  showPercentage = true,
  showEta = true,
}: ProgressBarProps): React.JSX.Element {
  const [model] = React.useState(() => new ProgressBarModel(total, progress));

  // [LAW:one-source-of-truth] Props drive the model; the model is the
  // canonical (validated) state that the renderer reads.
  React.useEffect(() => {
    runInAction(() => {
      model.total = total;
      model.progress = progress;
    });
  }, [model, total, progress]);

  const stateClasses: string[] = [];
  if (model.percentage === null) {
    stateClasses.push("-indeterminate");
  } else if (model.percentage === 1) {
    stateClasses.push("-complete");
  }

  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes, stateClasses),
    typeName: "ProgressBar",
    typeToken: ProgressBar,
    borderTitle,
    borderSubtitle,
    defaultCss: DEFAULT_CSS,
  });

  const styles = useStyles(widget.handle);

  // [LAW:dataflow-not-control-flow] Gate on lifecycleReady so styles are
  // populated by the cascade before the typed accessor reads them.
  if (!widget.lifecycleReady) {
    return <WidgetScope widget={widget.handle}><></></WidgetScope>;
  }

  // The whole widget is one row of text, so it is one Content and one trip
  // across the bridge. The bar's runs carry their own colours and rich-js lays
  // the cascade's text style underneath them, which leaves the percentage and
  // ETA readouts styled by `color` and the bar untouched by it.
  const row = Content.assemble(
    showBar
      ? renderBar(
          BAR_WIDTH,
          highlightRange(model.percentage),
          styles.getCustomColor("--bar-color"),
          styles.getCustomColor("--bar-rail-color"),
        )
      : new Content(""),
    showPercentage ? field(formatPercentage(model.percentage), PERCENTAGE_WIDTH) : new Content(""),
    showEta ? field("--:--:--", ETA_WIDTH) : new Content(""),
  );

  return (
    <WidgetScope widget={widget.handle}>
      <Box height={1}>{renderContent(row, styles.text, `progress:${widget.nodeId}`)}</Box>
    </WidgetScope>
  );
});
