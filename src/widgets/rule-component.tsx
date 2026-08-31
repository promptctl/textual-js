// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// [LAW:one-source-of-truth] Validation lives in RuleModel; this component reflects
// validated state into the Ink render.

import React from "react";
import { Box, Text } from "ink";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";

import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
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

// [LAW:one-source-of-truth] Margins are declared here rather than hardcoded on
// the rendered Box, matching Textual's own `Rule.-horizontal { margin: 1 0 }` /
// `Rule.-vertical { margin: 0 2 }`. The cascade is the only place they appear,
// which is what lets the widget's outer box carry them and keeps screenRegion
// reporting the line itself rather than the line plus its surrounding gap.
const DEFAULT_CSS = `
  Rule { color: ${DEFAULT_RULE_COLOR}; }
  Rule.-horizontal { margin: 1 0; }
  Rule.-vertical { margin: 0 2; }
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
  const region = widget.handle.screenRegion;

  return (
    <WidgetScope widget={widget.handle}>
      {isHorizontal ? (
        <Box width="100%" height={1}>
          <Text color={color}>{character.repeat(Math.max(0, region.width))}</Text>
        </Box>
      ) : (
        <Box width={1} height="100%" flexDirection="column">
          {Array.from({ length: Math.max(0, region.height) }, (_, index) => (
            <Text key={index} color={color}>
              {character}
            </Text>
          ))}
        </Box>
      )}
    </WidgetScope>
  );
});
