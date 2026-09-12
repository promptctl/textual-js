// [LAW:one-type-per-behavior] Checkbox and RadioButton differ in a type name
// and one glyph. They were two components whose headers each said so; they are
// now two values handed to this one. Anything that reads "only the presentation
// differs" is describing configuration, not a second type.
// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// [LAW:single-enforcer] ToggleChanged is posted from here and nowhere else.

import React from "react";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";

import { Content, renderContent, type ContentInput } from "../content/index.js";
import { WidgetScope, useStyles, useWidget, type UseWidgetResult } from "../framework/context.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { ToggleButtonModel, ToggleChanged } from "./toggle.js";
import { WidgetFrame } from "./widget-frame.js";

export interface ToggleButtonProps extends WidgetComponentProps {
  label?: ContentInput;
  value?: boolean;
  disabled?: boolean;
}

// Upstream's `ToggleButton.BUTTON_LEFT` / `BUTTON_RIGHT`. They are half-blocks,
// and the styling below is sensitive to which half each one fills — see
// `sideStyle`.
const BUTTON_LEFT = "▐";
const BUTTON_RIGHT = "▌";

export const TOGGLE_COMPONENT_CLASSES = ["toggle--button", "toggle--label"];

// Upstream's `ToggleButton.DEFAULT_CSS`, with each theme token written as the
// hex it resolves to under textual-dark — the port's standing convention while
// widgets do not read theme tokens (textual-theme-variables-bz8). The token name
// is kept beside every literal so the eventual migration is a lookup, not an
// archaeology exercise.
//
// The type name is a parameter because the DEFAULT_CSS scoper rewrites any
// leading type selector that is not the registering widget's own: upstream
// writes `ToggleButton { … }` once and lets the MRO match it for both
// subclasses, while `scopeSelectors` here would turn that into
// `Checkbox ToggleButton { … }` and match nothing.
export function toggleButtonCss(typeName: string): string {
  return `
  ${typeName} {
    width: auto;
    padding: 0 1;
    border: tall #191919;
    background: #1e1e1e;
    color: #e0e0e0;
  }
  ${typeName} > .toggle--button {
    color: #000f18;
    background: #242f38;
  }
  ${typeName}.-on > .toggle--button {
    color: #8ad4a1;
    background: #242f38;
  }
  ${typeName}:focus {
    border: tall #0178d4;
  }
`;
}

export interface ToggleButtonKind {
  typeName: string;
  // Upstream's `BUTTON_INNER`. It is always painted — the widget's off state is
  // a colour (`$panel-darken-2` on `$panel`, deliberately low contrast), never a
  // blank. Substituting a space for it loses a glyph the baseline carries on
  // every row, checked or not.
  buttonInner: string;
  typeToken: Function;
}

export function useToggleButton(
  kind: ToggleButtonKind,
  { id, classes, borderTitle, borderSubtitle, label = "", value = false, disabled }: ToggleButtonProps,
): React.JSX.Element {
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
    typeName: kind.typeName,
    typeToken: kind.typeToken,
    borderTitle,
    borderSubtitle,
    focusable: true,
    disabled,
    defaultCss: toggleButtonCss(kind.typeName),
    componentClasses: TOGGLE_COMPONENT_CLASSES,
    bindings: [
      { key: "enter", action: "toggle", description: "Toggle" },
      { key: "space", action: "toggle" },
    ],
    actions: {
      action_toggle: toggle,
    },
    handlers: {
      onClick: (message) => {
        // [LAW:single-enforcer] The toggle consumes its own click; ancestor
        // on_click handlers are never triggered by activation.
        message.stop();
        toggle();
      },
    },
  });

  widgetRef.current = widget;
  const styles = useStyles(widget.handle);

  // [LAW:dataflow-not-control-flow] Gate on lifecycleReady so styles are
  // populated by the cascade before the typed accessors read them.
  if (!widget.lifecycleReady) {
    return <WidgetScope widget={widget.handle}><></></WidgetScope>;
  }

  const buttonStyles = styles.component("toggle--button");
  const labelStyles = styles.component("toggle--label");
  const background = styles.getColor("background");
  const buttonBackground = buttonStyles.getColor("background");

  // The side glyphs are not painted in the button's colours; they are painted
  // in the button's *background* over the widget's, which is what makes a half
  // block read as one whole `$panel` cell. Upstream builds the same style in
  // `ToggleButton._button` as `Style(foreground=button_style.background,
  // background=self.background_colors[1])`. Colouring them like the inner glyph
  // paints two dark slivers instead.
  const sideStyle = `${buttonBackground} on ${background}`;
  const innerStyle = `${buttonStyles.getColor("color")} on ${buttonBackground}`;
  const labelStyle = `${labelStyles.getColor("color")} on ${labelStyles.getColor("background")}`;
  const fillStyle = `on ${background}`;

  // Padding is painted here rather than reserved by Ink, and the Ink padding is
  // zeroed below so the two cannot both apply. Ink gives a Box no background, so
  // a padding cell it reserves is a hole in the widget's fill — the trap
  // CLAUDE.md names first. The cell count still comes from the cascade, so
  // `padding` remains a style rather than a literal in this file.
  const padding = (edge: "paddingLeft" | "paddingRight"): Content =>
    Content.styled(" ".repeat(typeof styles.box[edge] === "number" ? styles.box[edge] : 0), fillStyle);

  const content = Content.assemble(
    padding("paddingLeft"),
    Content.styled(BUTTON_LEFT, sideStyle),
    Content.styled(kind.buttonInner, innerStyle),
    Content.styled(BUTTON_RIGHT, sideStyle),
    // `stylizeBefore` so a label carrying its own markup keeps it; upstream pads
    // the label by one on each side inside the widget's padding.
    Content.assemble(" ", model.label, " ").stylizeBefore(labelStyle),
    padding("paddingRight"),
  );

  return (
    <WidgetScope widget={widget.handle}>
      <WidgetFrame
        widget={widget.handle}
        styles={styles}
        boxProps={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 }}
      >
        {renderContent(content, {}, `toggle:${widget.nodeId}`)}
      </WidgetFrame>
    </WidgetScope>
  );
}

export function makeToggleButton(
  kind: Omit<ToggleButtonKind, "typeToken">,
): React.FunctionComponent<ToggleButtonProps> {
  const component = observer(function ToggleButton(props: ToggleButtonProps): React.JSX.Element {
    return useToggleButton({ ...kind, typeToken: component }, props);
  });

  Object.defineProperty(component, "name", { value: kind.typeName });

  return component;
}
