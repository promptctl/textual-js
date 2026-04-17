// [LAW:one-way-deps] Component consumes framework services. It owns only its
// message type (ButtonPressed) and its visual rendering.

import React from "react";
import { Box, Text } from "ink";
import { observer } from "mobx-react-lite";

import { Content, type ContentInput } from "../content/index.js";
import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import { ButtonPressed, type ButtonVariant } from "./button.js";

export interface ButtonWidgetProps {
  id?: string;
  classes?: string | string[];
  label?: ContentInput;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}

const DEFAULT_CSS = `
  Button {
    border: round;
    padding: 0 2;
  }
  Button:focus {
    border: bold;
  }
`;

// [LAW:single-enforcer] ButtonPressed is posted only from this component's
// action_press handler. No other widget posts it.
export const ButtonWidget = observer(function ButtonWidget({
  id,
  classes,
  label,
  variant = "default",
  disabled,
  loading,
}: ButtonWidgetProps): React.JSX.Element {
  const resolved = React.useMemo(() => Content.fromText(label), [label]);

  // [LAW:dataflow-not-control-flow] Variant maps to a CSS class; the cascade
  // decides the visual difference, not branching in the component.
  const variantClass = variant === "default" ? [] : [`-${variant}`];
  const allClasses = [
    ...(Array.isArray(classes) ? classes : classes ? [classes] : []),
    ...variantClass,
  ];

  const widget = useWidget({
    id,
    classes: allClasses,
    typeName: "Button",
    focusable: true,
    disabled,
    loading,
    defaultCss: DEFAULT_CSS,
    bindings: [
      { key: "enter", action: "press", description: "Press" },
      { key: "space", action: "press" },
    ],
    actions: {
      action_press: () => {
        widget.postMessage(new ButtonPressed());
      },
    },
    handlers: {
      onClick: () => {
        widget.postMessage(new ButtonPressed());
      },
    },
  });

  const styles = useStyles(widget.handle);

  return (
    <WidgetScope widget={widget.handle}>
      <Box {...styles.box}>
        <Text {...styles.text}>{resolved.plain}</Text>
      </Box>
    </WidgetScope>
  );
});
