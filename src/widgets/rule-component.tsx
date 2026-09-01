// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// [LAW:one-source-of-truth] Validation lives in RuleModel; this component reflects
// validated state into the Ink render.

import React from "react";
import { Box, Text } from "ink";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";

import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import { MeasuredSizeReader } from "../framework/measured-size.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { RuleModel, type RuleOrientation } from "./rule.js";

const HORIZONTAL_LINE_CHARS: Record<string, string> = {
  ascii: "-",
  blank: " ",
  dashed: "╍",
  double: "═",
  heavy: "━",
  hidden: " ",
  none: " ",
  solid: "─",
  thick: "█",
};

const VERTICAL_LINE_CHARS: Record<string, string> = {
  ascii: "|",
  blank: " ",
  dashed: "╏",
  double: "║",
  heavy: "┃",
  hidden: " ",
  none: " ",
  solid: "│",
  thick: "█",
};

const DEFAULT_RULE_COLOR = "#004578";

// [LAW:one-source-of-truth] Geometry is declared here, not hardcoded on the
// rendered Box, so the widget's measured outer box carries it and the seam
// reports the line itself rather than the line plus its surrounding gap.
const DEFAULT_CSS = `
  Rule { color: ${DEFAULT_RULE_COLOR}; }
  Rule.-horizontal { margin: 1 0; }
  Rule.-vertical { width: 1; margin: 0 2; }
`;

export interface RuleProps extends WidgetComponentProps {
  orientation?: RuleOrientation;
  lineStyle?: string;
}

export const Rule = observer(function Rule({
  id,
  classes,
  borderTitle,
  borderSubtitle,
  orientation = "horizontal",
  lineStyle = "solid",
}: RuleProps): React.JSX.Element {
  const [model] = React.useState(() => new RuleModel(orientation, lineStyle));

  // [LAW:one-source-of-truth] Props drive the model; the model is the canonical
  // (validated) state that the renderer reads.
  React.useEffect(() => {
    runInAction(() => {
      model.orientation = orientation;
      model.lineStyle = lineStyle;
    });
  }, [model, orientation, lineStyle]);

  const orientationClass = `-${model.orientation}`;
  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes, [orientationClass]),
    typeName: "Rule",
    typeToken: Rule,
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

  const color = styles.getColor("color");
  const isHorizontal = model.orientation === "horizontal";
  const character = isHorizontal
    ? HORIZONTAL_LINE_CHARS[model.lineStyle] ?? " "
    : VERTICAL_LINE_CHARS[model.lineStyle] ?? " ";
  // A Rule spans its container (`width: 100%` / `height: 100%`), so it has no
  // natural size to fall back on: before the layout places it there is simply no
  // line to draw, and the pass that measures it needs no glyphs from us.
  return (
    <WidgetScope widget={widget.handle}>
      <MeasuredSizeReader widget={widget.handle}>
        {({ width, height }) =>
          isHorizontal ? (
            <Box width="100%" height={1}>
              <Text color={color}>{character.repeat(width ?? 0)}</Text>
            </Box>
          ) : (
            <Box height="100%" flexDirection="column">
              {Array.from({ length: height ?? 0 }, (_, index) => (
                <Text key={index} color={color}>
                  {character}
                </Text>
              ))}
            </Box>
          )
        }
      </MeasuredSizeReader>
    </WidgetScope>
  );
});
