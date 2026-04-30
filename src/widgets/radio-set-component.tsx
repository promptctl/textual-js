// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// [LAW:single-enforcer] RadioSet is the single enforcer of mutual exclusion
// among its rows. Rows inside a RadioSet are not separate focusable widgets —
// the set is the only tab stop, and the model owns the pressed state.
// [LAW:one-source-of-truth] RadioSetModel holds the canonical pressed index;
// the rendered indicators are derived from it.
// [LAW:dataflow-not-control-flow] Buttons arrive as data (string[] or specs).
// The same render pass runs for every set; pressed state lives in values, not
// in branching renders.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";

import { Content, renderContent } from "../content/index.js";
import { WidgetScope, useStyles, useWidget, type UseWidgetResult } from "../framework/context.js";
import type { ContentInput } from "../content/index.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { ToggleButtonModel } from "./toggle.js";
import { RadioSetChanged, RadioSetModel } from "./radio-set.js";

export interface RadioSetButtonSpec {
  label: ContentInput;
  value?: boolean;
}

export interface RadioSetProps extends WidgetComponentProps {
  buttons: ReadonlyArray<string | RadioSetButtonSpec>;
  disabled?: boolean;
}

const DEFAULT_CSS = `
  RadioSet {
    height: auto;
    width: auto;
    color: #e0e0e0;
    background: #1c1c1c;
  }
  RadioSet:focus {
    background: #1e2c3a;
  }
`;

const SELECTED_INDICATOR_COLOR = "#4ebf71";

function specToToggleButton(spec: string | RadioSetButtonSpec): ToggleButtonModel {
  // [LAW:one-source-of-truth] Strings and structured specs collapse to the
  // single ToggleButtonModel representation.
  return typeof spec === "string"
    ? new ToggleButtonModel(spec, false)
    : new ToggleButtonModel(spec.label, spec.value ?? false);
}

export const RadioSet = observer(function RadioSet({
  id,
  classes,
  borderTitle,
  borderSubtitle,
  buttons,
  disabled,
}: RadioSetProps): React.JSX.Element {
  const buttonsKey = React.useMemo(
    () => buttons.map((spec) => (typeof spec === "string" ? `s:${spec}` : `o:${spec.label}:${spec.value ? 1 : 0}`)).join("|"),
    [buttons],
  );

  const [model] = React.useState(() => new RadioSetModel(buttons.map(specToToggleButton)));
  const widgetRef = React.useRef<UseWidgetResult>(null) as React.MutableRefObject<UseWidgetResult | null>;
  const previousKey = React.useRef(buttonsKey);

  React.useEffect(() => {
    // [LAW:one-source-of-truth] When the buttons prop reshapes the set, rebuild
    // the model from the canonical input. We could rebuild the model on every
    // render, but doing it once per shape change keeps render cheap.
    if (previousKey.current === buttonsKey) {
      return;
    }
    previousKey.current = buttonsKey;
    runInAction(() => {
      const desired = buttons.map(specToToggleButton);
      const desiredPressedIndex = desired.findIndex((button) => button.value);
      for (let index = 0; index < model.length; index += 1) {
        const target = desired[index];
        if (target === undefined) {
          break;
        }
        const current = model.getButton(index);
        current.label = target.label.plain;
        current.value = false;
      }
      if (desiredPressedIndex >= 0) {
        model.press(desiredPressedIndex);
      }
    });
  }, [buttonsKey, buttons, model]);

  const press = React.useCallback(
    (index: number) => {
      const changed = runInAction(() => model.press(index));
      if (changed) {
        widgetRef.current?.postMessage(
          new RadioSetChanged(model.pressedIndex, model.getButton(model.pressedIndex)),
        );
      }
    },
    [model],
  );

  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes),
    typeName: "RadioSet",
    typeToken: RadioSet,
    borderTitle,
    borderSubtitle,
    focusable: true,
    disabled,
    defaultCss: DEFAULT_CSS,
    bindings: [
      { key: "up", action: "previous", description: "Previous option" },
      { key: "down", action: "next", description: "Next option" },
      { key: "enter", action: "activate", description: "Activate" },
      { key: "space", action: "activate" },
    ],
    actions: {
      action_previous: () => {
        const target = model.pressedIndex <= 0 ? model.length - 1 : model.pressedIndex - 1;
        press(target);
      },
      action_next: () => {
        const target = model.pressedIndex < 0 || model.pressedIndex >= model.length - 1 ? 0 : model.pressedIndex + 1;
        press(target);
      },
      action_activate: () => {
        if (model.pressedIndex >= 0) {
          press(model.pressedIndex);
        }
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

  const rows: React.JSX.Element[] = [];
  for (let index = 0; index < model.length; index += 1) {
    const button = model.getButton(index);
    const indicator = button.value ? "●" : " ";
    // [LAW:dataflow-not-control-flow] Selected color is derived from the
    // model value, not from a separate code path. The same renderContent
    // call runs for every row; the value propagated changes the styling.
    const rowColor = button.value ? SELECTED_INDICATOR_COLOR : foreground;
    const labelContent = Content.assemble(" ", button.label);
    rows.push(
      <Box key={`radio-set:${widget.nodeId}:row:${index}`} flexDirection="row">
        {renderContent(
          Content.styled(`▐${indicator}▌`, rowColor),
          {},
          `radio-set:${widget.nodeId}:button:${index}`,
        )}
        {renderContent(
          labelContent,
          { color: rowColor },
          `radio-set:${widget.nodeId}:label:${index}`,
        )}
      </Box>,
    );
  }

  return (
    <WidgetScope widget={widget.handle}>
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={foreground}
      >
        {rows}
      </Box>
    </WidgetScope>
  );
});
