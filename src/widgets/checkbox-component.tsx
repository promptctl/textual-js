// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// [LAW:single-enforcer] Checkbox is the single source of ToggleChanged messages
// posted from a Checkbox; no other widget posts them.
// [LAW:one-type-per-behavior] Checkbox shares its model and message type with
// RadioButton via toggle.ts — only the visual presentation and registered
// typeName differ.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";

import { Content, renderContent, type ContentInput } from "../content/index.js";
import { WidgetScope, useStyles, useWidget, type UseWidgetResult } from "../framework/context.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { ToggleButtonModel, ToggleChanged } from "./toggle.js";

export interface CheckboxProps extends WidgetComponentProps {
  label?: ContentInput;
  value?: boolean;
  disabled?: boolean;
}

const DEFAULT_CSS = `
  Checkbox { height: 1; color: #e0e0e0; }
  Checkbox.-on { color: #4ebf71; }
  Checkbox:focus { background: #1e2c3a; }
`;

export const Checkbox = observer(function Checkbox({
  id,
  classes,
  borderTitle,
  borderSubtitle,
  label = "",
  value = false,
  disabled,
}: CheckboxProps): React.JSX.Element {
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
    typeName: "Checkbox",
    typeToken: Checkbox,
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
        // [LAW:single-enforcer] Checkbox consumes its own click; ancestor
        // on_click handlers are never triggered by activation.
        message.stop();
        toggle();
      },
    },
  });

  widgetRef.current = widget;
  const styles = useStyles(widget.handle);

  // [LAW:dataflow-not-control-flow] Gate on lifecycleReady so styles are
  // populated by the cascade before the typed accessor reads them.
  if (!widget.lifecycleReady) {
    return <WidgetScope widget={widget.handle}><></></WidgetScope>;
  }

  const foreground = styles.getColor("color");
  const indicator = model.value ? "X" : " ";
  const labelContent = Content.assemble(" ", model.label);

  return (
    <WidgetScope widget={widget.handle}>
      <Box flexDirection="row">
        {renderContent(
          Content.styled(`▐${indicator}▌`, foreground),
          {},
          `checkbox:${widget.nodeId}:button`,
        )}
        {renderContent(
          labelContent,
          { color: foreground },
          `checkbox:${widget.nodeId}:label`,
        )}
      </Box>
    </WidgetScope>
  );
});
