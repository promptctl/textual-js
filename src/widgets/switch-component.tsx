// [LAW:one-way-deps] Component consumes framework services.
// [LAW:single-enforcer] SwitchChanged is posted only from this component.

import React from "react";
import { Box, Text } from "ink";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";

import { WidgetScope, useStyles, useWidget, type UseWidgetResult } from "../framework/context.js";
import { Switch, SwitchChanged } from "./switch.js";

export interface SwitchWidgetProps {
  id?: string;
  classes?: string | string[];
  value?: boolean;
  disabled?: boolean;
}

const DEFAULT_CSS = `
  Switch {
    height: 1;
  }
  Switch:focus {
    border: round;
  }
`;

const SLIDER_ON = "━━━━━━━●";
const SLIDER_OFF = "●━━━━━━━";

export const SwitchWidget = observer(function SwitchWidget({
  id,
  classes,
  value = false,
  disabled,
}: SwitchWidgetProps): React.JSX.Element {
  const [model] = React.useState(() => new Switch(value));
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
    classes: [
      ...(Array.isArray(classes) ? classes : classes ? [classes] : []),
      ...(model.value ? ["-on"] : []),
    ],
    typeName: "Switch",
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
  });

  widgetRef.current = widget;
  const styles = useStyles(widget.handle);

  return (
    <WidgetScope widget={widget.handle}>
      <Box {...styles.box}>
        <Text {...styles.text}>{model.value ? SLIDER_ON : SLIDER_OFF}</Text>
      </Box>
    </WidgetScope>
  );
});
