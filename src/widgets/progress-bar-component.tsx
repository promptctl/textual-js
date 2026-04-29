// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// [LAW:one-source-of-truth] Validation lives in ProgressBarModel; this component
// reflects validated state into the Ink render.

import React from "react";
import { Box, Text } from "ink";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";

import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import { colorToInkValue } from "../styles/index.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { ProgressBarModel } from "./progress-bar.js";

const DEFAULT_BAR_COLOR = "#004578";
const DEFAULT_BAR_BACKGROUND = "#3d3d3d";
const FILLED_CHAR = "━";
const EMPTY_CHAR = "─";
const PULSE_GLYPHS = "──━━━━━──";

const DEFAULT_CSS = `
  ProgressBar { height: 1; }
`;

export interface ProgressBarProps extends WidgetComponentProps {
  total?: number | null;
  progress?: number;
  showBar?: boolean;
  showPercentage?: boolean;
  showEta?: boolean;
}

function formatPercentage(percentage: number | null): string {
  // [LAW:dataflow-not-control-flow] Branch selects which formatted string the
  // renderer consumes; both branches always run through the same render path.
  return percentage === null ? "--%" : `${Math.floor(percentage * 100)}%`;
}

function buildBarSegments(
  percentage: number | null,
  width: number,
): { filledWidth: number; pulse: string | null } {
  // Indeterminate progress is encoded by a pulse glyph string the renderer
  // overlays; determinate progress is encoded by an integer fill width.
  const pulse = percentage === null ? PULSE_GLYPHS : null;
  const filledWidth = percentage === null ? 0 : Math.round(percentage * width);
  return { filledWidth, pulse };
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
  const filledColor = colorToInkValue(styles.getRule("color") as never) ?? DEFAULT_BAR_COLOR;
  const railColor =
    colorToInkValue(styles.getRule("background") as never) ?? DEFAULT_BAR_BACKGROUND;

  const region = widget.handle.screenRegion;
  const totalWidth = Math.max(0, region.width);
  const percentageText = formatPercentage(model.percentage);
  const etaText = "--:--:--";
  const percentageWidth = showPercentage ? percentageText.length + 1 : 0;
  const etaWidth = showEta ? etaText.length + 1 : 0;
  const barWidth = showBar ? Math.max(8, totalWidth - percentageWidth - etaWidth) : 0;
  const { filledWidth, pulse } = buildBarSegments(model.percentage, barWidth);

  const filledChars =
    pulse === null
      ? FILLED_CHAR.repeat(filledWidth)
      : pulse.slice(0, Math.min(pulse.length, barWidth));
  const emptyChars =
    pulse === null
      ? EMPTY_CHAR.repeat(Math.max(0, barWidth - filledWidth))
      : EMPTY_CHAR.repeat(Math.max(0, barWidth - filledChars.length));

  return (
    <WidgetScope widget={widget.handle}>
      <Box width="100%" height={1} flexDirection="row">
        {showBar ? (
          <Box flexDirection="row">
            <Text color={filledColor}>{filledChars}</Text>
            <Text color={railColor}>{emptyChars}</Text>
          </Box>
        ) : null}
        {showPercentage ? (
          <Box marginLeft={1}>
            <Text>{percentageText}</Text>
          </Box>
        ) : null}
        {showEta ? (
          <Box marginLeft={1}>
            <Text>{etaText}</Text>
          </Box>
        ) : null}
      </Box>
    </WidgetScope>
  );
});
