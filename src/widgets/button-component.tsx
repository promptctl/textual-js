// [LAW:one-way-deps] Component consumes framework services. It owns only its
// message type (ButtonPressed) and its visual rendering.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";

import {
  Content,
  renderContent,
  resolveVisualRenderWidth,
  type ContentInput,
} from "../content/index.js";
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
    background: var(--surface);
    color: var(--foreground);
    min-width: 16;
    height: 3;
    padding: 0 2;
    text-align: center;
  }
  Button.-primary { background: var(--primary); }
  Button.-success { background: var(--success); }
  Button.-warning { background: var(--warning); }
  Button.-error { background: var(--error); }
  Button:focus {
    border: bold;
    background: var(--accent);
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
  const renderWidth = resolveVisualRenderWidth(widget.handle.screenRegion.width, styles.box);

  return (
    <WidgetScope widget={widget.handle}>
      <Box {...styles.box} alignItems="center" justifyContent="center">
        {renderContent(resolved, styles.text, `button:${widget.nodeId}`, renderWidth)}
      </Box>
    </WidgetScope>
  );
});
