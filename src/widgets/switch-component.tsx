// [LAW:one-way-deps] Component consumes framework services.
// [LAW:single-enforcer] SwitchChanged is posted only from this component.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";

import { Content, renderContent } from "../content/index.js";
import { WidgetScope, useStyles, useWidget, type UseWidgetResult } from "../framework/context.js";
import { dimColor, mixColor } from "../styles/index.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { SwitchModel, SwitchChanged } from "./switch.js";
import { WidgetFrame } from "./widget-frame.js";

export interface SwitchProps extends WidgetComponentProps {
  value?: boolean;
  disabled?: boolean;
}

// [LAW:one-source-of-truth] DEFAULT_CSS is the single source of truth for
// every style this widget reads. `--switch-border` is declared here in the
// base rule so the un-focused border color cascades cleanly; the previous
// `?? color ?? "#191919"` widget-side fallback is gone.
const DEFAULT_CSS = `
  Switch {
    width: 10;
    height: 3;
    background: #272727;
    color: #191919;
    --switch-accent: #242f38;
    --switch-knob: #e0e0e0;
    --switch-focus-fill: #000f18;
    --switch-border: #191919;
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

interface SwitchPalette {
  background: string;
  border: string;
  accent: string;
  knob: string;
  focusFill: string;
}

// Approximates Python Textual's two-layer disabled rendering: background
// colors dim heavily toward the screen background (mimicking `tint`), then
// foreground colors dim toward the dimmed background (mimicking
// `text-opacity`). Single-factor dimming can't match this — the visual
// gap between widget surface and inner segments depends on both layers.
// Pixel-perfect parity (focusFill, exact channel tuning) is a follow-up.
const SWITCH_BG_DIM_FACTOR = 0.76;
const SWITCH_FG_DIM_FACTOR = 0.3;

function dimSwitchPalette(palette: SwitchPalette): SwitchPalette {
  const dimmedBackground = dimColor(palette.background, SWITCH_BG_DIM_FACTOR);
  return {
    background: dimmedBackground,
    focusFill: dimColor(palette.focusFill, SWITCH_BG_DIM_FACTOR),
    border: mixColor(palette.border, dimmedBackground, SWITCH_FG_DIM_FACTOR),
    accent: mixColor(palette.accent, dimmedBackground, SWITCH_FG_DIM_FACTOR),
    knob: mixColor(palette.knob, dimmedBackground, SWITCH_FG_DIM_FACTOR),
  };
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

  // [LAW:dataflow-not-control-flow] The cascade resolves during widget
  // registration (in useLayoutEffect). On the very first render the widget
  // is not yet registered and `styles` is empty — the typed accessors below
  // would throw. Gate the render on `lifecycleReady` so we read styles only
  // when the framework guarantees the cascade has populated them. This
  // mirrors `WidgetHost`'s child-render gate.
  if (!widget.lifecycleReady) {
    return <WidgetScope widget={widget.handle}><></></WidgetScope>;
  }

  const width = readNumericBoxValue(styles.box.width) ?? 10;
  const innerWidth = Math.max(4, width - 2);
  // [LAW:no-defensive-null-guards] Every property below is guaranteed by
  // DEFAULT_CSS; the typed accessors throw if the cascade is broken instead
  // of silently substituting a hex literal.
  const basePalette: SwitchPalette = {
    background: styles.getColor("background"),
    border: styles.getCustomColor("--switch-border"),
    accent: styles.getCustomColor("--switch-accent"),
    knob: styles.getCustomColor("--switch-knob"),
    focusFill: styles.getCustomColor("--switch-focus-fill"),
  };
  // [LAW:dataflow-not-control-flow] The disabled-state palette is derived once
  // from the resolved palette; dimming is a data transform, not a per-paint
  // branch. Render code below sees a single uniform palette.
  const { background, border, accent, knob, focusFill } = widget.handle.isDisabledEffective
    ? dimSwitchPalette(basePalette)
    : basePalette;
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
