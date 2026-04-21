// [LAW:one-way-deps] Component consumes framework services.
// [LAW:single-enforcer] SwitchChanged is posted only from this component.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";

import { Content, renderContent } from "../content/index.js";
import { WidgetScope, useStyles, useWidget, type UseWidgetResult } from "../framework/context.js";
import { colorToInkValue } from "../styles/index.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { SwitchModel, SwitchChanged } from "./switch.js";
import { WidgetFrame } from "./widget-frame.js";

export interface SwitchProps extends WidgetComponentProps {
  value?: boolean;
  disabled?: boolean;
}

const DEFAULT_CSS = `
  Switch {
    width: 10;
    height: 3;
    background: #272727;
    color: #191919;
    --switch-accent: #242f38;
    --switch-knob: #e0e0e0;
    --switch-focus-fill: #000f18;
  }
  Switch.-on {
    background: #1e1e1e;
    color: #191919;
    --switch-accent: #4ebf71;
  }
  Switch:focus {
    --switch-border: #0178d4;
  }
`;

function readNumericBoxValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function renderSwitchRow(
  left: { text: string; color: string; backgroundColor: string | undefined; inverse?: boolean },
  middle: { text: string; color?: string; backgroundColor?: string },
  right: { text: string; color: string; backgroundColor: string | undefined; inverse?: boolean },
  key: string,
): React.JSX.Element {
  const segmentStyle = (segment: { color?: string; backgroundColor?: string; inverse?: boolean }): string =>
    [
      segment.color,
      segment.backgroundColor === undefined ? undefined : `on ${segment.backgroundColor}`,
      segment.inverse ? "reverse" : undefined,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <Box key={key}>
      {renderContent(Content.styled(left.text, segmentStyle(left)), {}, `${key}:left`)}
      {renderContent(Content.styled(middle.text, segmentStyle(middle)), {}, `${key}:middle`)}
      {renderContent(Content.styled(right.text, segmentStyle(right)), {}, `${key}:right`)}
    </Box>
  );
}

// [LAW:one-source-of-truth] Match Textual's `Switch` public widget name;
// model helpers use explicit internal names instead of competing exports.
export const Switch = observer(function Switch({
  id,
  classes,
  borderTitle,
  borderSubtitle,
  value = false,
  disabled,
}: SwitchProps): React.JSX.Element {
  const [model] = React.useState(() => new SwitchModel(value));
  const widgetRef = React.useRef<UseWidgetResult>(null) as React.MutableRefObject<UseWidgetResult | null>;

  // [LAW:one-source-of-truth] Prop drives model; model is the canonical state.
  React.useEffect(() => {
    runInAction(() => {
      model.value = value;
    });
  }, [model, value]);

  const toggle = React.useCallback(() => {
    const next = runInAction(() => model.toggle());
    widgetRef.current?.postMessage(new SwitchChanged(next));
  }, [model]);

  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes, model.value ? ["-on"] : []),
    typeName: "Switch",
    borderTitle,
    borderSubtitle,
    focusable: true,
    disabled,
    defaultCss: DEFAULT_CSS,
    bindings: [
      { key: "enter", action: "toggle", description: "Toggle" },
      { key: "space", action: "toggle" },
    ],
    actions: {
      action_toggle: toggle,
    },
    handlers: {
      onClick: (message) => {
        // [LAW:single-enforcer] Switch consumes click events per spec —
        // ancestor on_click handlers are never triggered.
        message.stop();
        toggle();
      },
    },
    typeToken: Switch,
  });

  widgetRef.current = widget;
  const styles = useStyles(widget.handle);
  const width = readNumericBoxValue(styles.box.width) ?? 10;
  const innerWidth = Math.max(4, width - 2);
  const background = colorToInkValue(styles.getRule("background") as never) ?? (model.value ? "#1e1e1e" : "#272727");
  const border =
    (styles.customProperties.get("--switch-border") as string | undefined)
    ?? colorToInkValue(styles.getRule("color") as never)
    ?? "#191919";
  const accent = (styles.customProperties.get("--switch-accent") as string | undefined) ?? (model.value ? "#a1a1a1" : "#2d2d2d");
  const knob = (styles.customProperties.get("--switch-knob") as string | undefined) ?? "#e0e0e0";
  const focusFill = (styles.customProperties.get("--switch-focus-fill") as string | undefined) ?? "#000f18";
  const quarter = Math.max(1, Math.floor(innerWidth / 4));
  const widths = [quarter, quarter, quarter, Math.max(1, innerWidth - quarter * 3)];
  const middleSegments = model.value
    ? [" ".repeat(widths[0]), " ".repeat(widths[1]), " ".repeat(widths[2]), " ".repeat(widths[3])]
    : [" ".repeat(widths[0]), " ".repeat(widths[1]), " ".repeat(widths[2]), " ".repeat(widths[3])];

  return (
    <WidgetScope widget={widget.handle}>
      <WidgetFrame widget={widget.handle} styles={styles} boxProps={{ flexDirection: "column" }}>
        {renderSwitchRow(
          { text: "▊", color: border, backgroundColor: undefined, inverse: true },
          { text: "▔".repeat(innerWidth), color: border, backgroundColor: background },
          { text: "▎", color: border, backgroundColor: undefined },
          `switch:${widget.nodeId}:top`,
        )}
        <Box key={`switch:${widget.nodeId}:middle`}>
          {renderContent(Content.styled("▊", `${border} reverse`), {}, `switch:${widget.nodeId}:middle:left`)}
          {renderContent(Content.styled(middleSegments[0], `on ${background}`), {}, `switch:${widget.nodeId}:middle:0`)}
          {renderContent(
            Content.styled(
              middleSegments[1],
              [
                model.value ? knob : accent,
                model.value ? `on ${focusFill}` : `on ${background}`,
                model.value ? undefined : "reverse",
              ]
                .filter(Boolean)
                .join(" "),
            ),
            {},
            `switch:${widget.nodeId}:middle:1`,
          )}
          {renderContent(
            Content.styled(
              middleSegments[2],
              [
                model.value ? accent : knob,
                model.value ? `on ${background}` : `on ${focusFill}`,
                model.value ? "reverse" : undefined,
              ]
                .filter(Boolean)
                .join(" "),
            ),
            {},
            `switch:${widget.nodeId}:middle:2`,
          )}
          {renderContent(Content.styled(middleSegments[3], `on ${background}`), {}, `switch:${widget.nodeId}:middle:3`)}
          {renderContent(Content.styled("▎", border), {}, `switch:${widget.nodeId}:middle:right`)}
        </Box>
        {renderSwitchRow(
          { text: "▊", color: border, backgroundColor: undefined, inverse: true },
          { text: "▁".repeat(innerWidth), color: border, backgroundColor: background },
          { text: "▎", color: border, backgroundColor: undefined },
          `switch:${widget.nodeId}:bottom`,
        )}
      </WidgetFrame>
    </WidgetScope>
  );
});
