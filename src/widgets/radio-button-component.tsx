// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// [LAW:one-type-per-behavior] RadioButton shares ToggleButtonModel and
// ToggleChanged with Checkbox — only the visual presentation (● vs X glyph)
// and registered typeName differ.
// [LAW:single-enforcer] When a RadioButton lives inside a RadioSet, the
// enclosing set enforces mutual exclusion. Standalone RadioButtons toggle
// themselves like a Checkbox.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";

import { Content, renderContent, type ContentInput } from "../content/index.js";
import { WidgetScope, useStyles, useWidget, type UseWidgetResult } from "../framework/context.js";
import { colorToInkValue } from "../styles/index.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { ToggleButtonModel, ToggleChanged } from "./toggle.js";

export interface RadioButtonProps extends WidgetComponentProps {
  label?: ContentInput;
  value?: boolean;
  disabled?: boolean;
}

const DEFAULT_CSS = `
  RadioButton { height: 1; color: #e0e0e0; }
  RadioButton.-on { color: #4ebf71; }
  RadioButton:focus { background: #1e2c3a; }
`;

export const RadioButton = observer(function RadioButton({
  id,
  classes,
  borderTitle,
  borderSubtitle,
  label = "",
  value = false,
  disabled,
}: RadioButtonProps): React.JSX.Element {
  const [model] = React.useState(() => new ToggleButtonModel(label, value));
  const widgetRef = React.useRef<UseWidgetResult>(null) as React.MutableRefObject<UseWidgetResult | null>;

  // [LAW:one-source-of-truth] Props drive the model; the model is the
  // canonical state the renderer reads.
  React.useEffect(() => {
    runInAction(() => {
      model.value = value;
      model.label = label;
    });
  }, [model, value, label]);

  const toggle = React.useCallback(() => {
    const next = runInAction(() => model.toggle());
    widgetRef.current?.postMessage(new ToggleChanged(next));
  }, [model]);

  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes, model.value ? ["-on"] : []),
    typeName: "RadioButton",
    typeToken: RadioButton,
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
        message.stop();
        toggle();
      },
    },
  });

  widgetRef.current = widget;
  const styles = useStyles(widget.handle);
  const foreground = colorToInkValue(styles.getRule("color") as never) ?? "#e0e0e0";
  const indicator = model.value ? "●" : " ";
  const labelContent = Content.assemble(" ", model.label);

  return (
    <WidgetScope widget={widget.handle}>
      <Box flexDirection="row">
        {renderContent(
          Content.styled(`▐${indicator}▌`, foreground),
          {},
          `radio-button:${widget.nodeId}:button`,
        )}
        {renderContent(
          labelContent,
          { color: foreground },
          `radio-button:${widget.nodeId}:label`,
        )}
      </Box>
    </WidgetScope>
  );
});
