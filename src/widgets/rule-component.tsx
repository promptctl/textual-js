// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// [LAW:one-source-of-truth] Validation lives in RuleModel; this component reflects
// validated state into the Ink render.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";

import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { RuleModel, type RuleOrientation } from "./rule.js";

type RuleEdge = "top" | "left";

// Every slot Ink can paint, empty; one gets the glyph. The rest stay blank
// because they are also switched off, and a glyph in an unpainted slot would be
// a second answer to "which way does this rule run".
const UNPAINTED_EDGES = {
  topLeft: "",
  top: "",
  topRight: "",
  right: "",
  bottomRight: "",
  bottom: "",
  bottomLeft: "",
  left: "",
} as const;

/**
 * Paint one border edge with `glyph` and leave the other three dark — the whole
 * fill mechanism. Ink tiles the edge glyph across the extent Yoga resolved for
 * the box (it reads `yogaNode.getComputedWidth()`; ink/build/render-border.js),
 * so the line comes from layout, after layout, and no glyph count is derived
 * here. A rule therefore cannot size itself from its own output.
 *
 * [LAW:one-source-of-truth] The slot the glyph occupies and the edge Ink is told
 * to paint are one fact, settled by one call — naming them apart is how a rule
 * ends up asking Ink to paint an edge it never filled in. The `false`s are
 * load-bearing: Ink shows an edge unless it is explicitly `false`
 * (`style.borderTop !== false`, ink/build/styles.js), so an omitted edge paints.
 */
function edgeFill(edge: RuleEdge, glyph: string) {
  return {
    borderStyle: { ...UNPAINTED_EDGES, [edge]: glyph },
    borderTop: edge === "top",
    borderBottom: false,
    borderLeft: edge === "left",
    borderRight: false,
  };
}

interface RuleAxis {
  readonly glyphs: Record<string, string>;
  readonly edge: RuleEdge;
  readonly width: number | string | undefined;
  readonly height: number | string | undefined;
}

// [LAW:dataflow-not-control-flow] Orientation picks a value, not a code path: an
// axis carries the glyph it draws for each line style, the edge Ink paints that
// glyph along, and the extent the line spans. One Box then serves both.
const RULE_AXES: Record<RuleOrientation, RuleAxis> = {
  horizontal: {
    edge: "top",
    width: "100%",
    height: 1,
    glyphs: { ascii: "-", blank: " ", dashed: "╍", double: "═", heavy: "━", hidden: " ", none: " ", solid: "─", thick: "█" },
  },
  vertical: {
    edge: "left",
    width: undefined,
    height: "100%",
    glyphs: { ascii: "|", blank: " ", dashed: "╏", double: "║", heavy: "┃", hidden: " ", none: " ", solid: "│", thick: "█" },
  },
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
  const axis = RULE_AXES[model.orientation];
  // [LAW:parse-dont-validate] No `?? " "` fallback: RuleModel already parsed the
  // line style, so every value that reaches here has a glyph in both tables and
  // the lookup cannot miss.
  const glyph = axis.glyphs[model.lineStyle];
  // The line has no measured width or height behind it. The Box declares its own
  // extent and Ink fills the chosen edge to whatever Yoga resolved that extent
  // to, so a rule is correct on the frame it is drawn rather than on the frame
  // after the one that measured it.
  return (
    <WidgetScope widget={widget.handle}>
      <Box width={axis.width} height={axis.height} borderColor={color} {...edgeFill(axis.edge, glyph)} />
    </WidgetScope>
  );
});
