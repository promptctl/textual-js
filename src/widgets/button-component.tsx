// [LAW:one-way-deps] Component consumes framework services. It owns only its
// message type (ButtonPressed) and its visual rendering.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";

import {
  Content,
  renderContent,
  type ContentInput,
} from "../content/index.js";
import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import { MeasuredSizeReader } from "../framework/measured-size.js";
import {
  DISABLED_DIM_FACTOR,
  DISABLED_DIM_TARGET,
  dimColor,
  isHexColor,
  mixColor,
} from "../styles/index.js";
import { ButtonPressed, type ButtonVariant } from "./button.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { WidgetFrame } from "./widget-frame.js";

export interface ButtonProps extends WidgetComponentProps {
  label?: ContentInput;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}

// Textual's Button is width:auto — it hugs its label rather than filling its
// container, which is what keeps a 16-cell button from hit-testing across the
// full screen width.
//
// `-full-width` is the opt-out, and it exists because a composing widget has no
// other way to ask for one. Upstream spells it `Welcome #close { width: 100% }`
// in Welcome's own DEFAULT_CSS; here a widget's cascade is built from its own
// type's default stylesheets plus the screen's user CSS
// (resolveStylesForWidget in styles/stylesheet.ts), so a parent's rule never
// reaches a child of another type. The class is offered the same way `-primary`
// offers a palette: Button publishes a policy, the parent opts in, and nothing
// in Button knows who did. Remove it when the cascade grows the descendant
// reach — ticket textual-style-cascade-apr.
const DEFAULT_CSS = `
  Button {
    background: #272727;
    color: #e0e0e0;
    width: auto;
    min-width: 16;
    height: 3;
    text-align: center;
  }
  Button.-primary { background: #0178d4; color: #ddedf9; }
  Button.-success { background: #4ebf71; color: #0a180e; }
  Button.-warning { background: #fea62b; color: #211505; }
  Button.-error { background: #b93c5b; color: #f5e5e9; }
  Button.-full-width { width: 100%; }
`;

interface ButtonPalette {
  background: string | undefined;
  foreground: string;
  top: string;
  bottom: string;
}

// [LAW:one-source-of-truth] DEFAULT_BUTTON_PALETTES.background is always a
// hex string per variant (a `string`, not `string | undefined`). Narrowing
// this type lets call sites that need a definite color use
// `defaults.background` directly instead of `?? "#hex"` re-stating the
// default value at the consumer.
interface ButtonPaletteDefaults {
  background: string;
  foreground: string;
  top: string;
  bottom: string;
}

const DEFAULT_BUTTON_PALETTES: Record<ButtonVariant, ButtonPaletteDefaults> = {
  default: { background: "#272727", foreground: "#e0e0e0", top: "#2d2d2d", bottom: "#0d0d0d" },
  primary: { background: "#0178d4", foreground: "#ddedf9", top: "#6db2ff", bottom: "#004295" },
  success: { background: "#4ebf71", foreground: "#0a180e", top: "#7ae998", bottom: "#008139" },
  warning: { background: "#fea62b", foreground: "#211505", top: "#ffcf56", bottom: "#b86b00" },
  error: { background: "#b93c5b", foreground: "#f5e5e9", top: "#e76580", bottom: "#780028" },
};

function readNumericBoxValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stripForegroundColor(style: string): string {
  return style
    .replace(/(^|\s)(#[0-9a-fA-F]{3,8}|rgb\([^)]*\)|rgba\([^)]*\)|hsl\([^)]*\)|hsla\([^)]*\))(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rewriteForegroundColor(style: string, transform: (color: string) => string | undefined): string {
  const match = style.match(/(^|\s)(#[0-9a-fA-F]{3,8}|rgb\([^)]*\)|rgba\([^)]*\)|hsl\([^)]*\)|hsla\([^)]*\))(?=\s|$)/);

  if (match === null) {
    return style;
  }

  const nextColor = transform(match[2]);

  if (nextColor === undefined) {
    return stripForegroundColor(style);
  }

  return `${style.slice(0, match.index)}${match[1]}${nextColor}${style.slice((match.index ?? 0) + match[0].length)}`.trim();
}

function normalizeButtonLabel(content: Content, preserveForeground: boolean): Content {
  return new Content(
    content.plain,
    content.spans.map((span) => ({
      ...span,
      style: preserveForeground ? span.style : stripForegroundColor(span.style),
    })),
  );
}

function decorateButtonLabel(content: Content, styles: string[]): Content {
  return styles.reduce((current, style) => current.stylize(style), content);
}

function dimButtonLabel(content: Content, background: string | undefined): Content {
  // When the button surface is transparent, dim the authored label toward
  // the screen background pivot used elsewhere for disabled dimming.
  // [LAW:one-source-of-truth] Pivot is shared from disabled-dim.ts; do not
  // re-state the literal here.
  const baseBackground = background ?? DISABLED_DIM_TARGET;

  return new Content(
    content.plain,
    content.spans.map((span) => ({
      ...span,
      // [LAW:single-enforcer] Disabled-state dimming for authored label colors
      // is applied once at the button label seam so CSS colors and explicit
      // content spans follow the same opacity rule.
      // Span styles can carry rgb()/hsl()/named colors — content text is a
      // trust boundary. Dim when the color is hex; strip otherwise.
      style: rewriteForegroundColor(span.style, (color) =>
        isHexColor(color) ? mixColor(color, baseBackground, DISABLED_DIM_FACTOR) : undefined,
      ),
    })),
  );
}

function dimPalette(palette: ButtonPalette): ButtonPalette {
  return {
    background: dimColor(palette.background),
    foreground: dimColor(palette.foreground),
    top: dimColor(palette.top),
    bottom: dimColor(palette.bottom),
  };
}

function readButtonPalette(
  styles: ReturnType<typeof useStyles>,
  variant: ButtonVariant,
): ButtonPalette {
  const defaults = DEFAULT_BUTTON_PALETTES[variant];
  // [LAW:no-defensive-null-guards] DEFAULT_CSS guarantees `color`; getColor
  // fails loud if the cascade doesn't deliver, instead of silently falling
  // back to a hex literal duplicated from CSS.
  const foreground = styles.getColor("color");
  // background has three semantics that the consumer must distinguish:
  //   - rule absent: render with the variant's default background
  //   - rule = transparent (rgba(0,0,0,0)): render with no background fill
  //   - rule = hex: render with that hex
  // tryColor collapses absent and transparent into `undefined`; hasRule
  // disambiguates them so `background: transparent` is honored.
  const tryBackground = styles.tryColor("background");
  const background = tryBackground !== undefined
    ? tryBackground
    : styles.hasRule("background")
      ? undefined
      : defaults.background;
  // --button-top / --button-bottom are intentionally optional; when not set,
  // derive from the variant default (matching background) or mix from a
  // user-overridden background. The derivation lives at the consumer because
  // it depends on whether background equals the variant default — the
  // cascade can't express that comparison.
  const top = styles.tryCustomColor("--button-top")
    ?? (background === defaults.background ? defaults.top : mixColor(background ?? defaults.background, "#ffffff", 0.2));
  const bottom = styles.tryCustomColor("--button-bottom")
    ?? (background === defaults.background ? defaults.bottom : mixColor(background ?? defaults.background, "#000000", 0.35));

  return { background, foreground, top, bottom };
}

function renderButtonRow(
  text: string,
  color: string | undefined,
  backgroundColor: string | undefined,
  key: string,
): React.JSX.Element {
  const style = [color, backgroundColor === undefined ? undefined : `on ${backgroundColor}`].filter(Boolean).join(" ");
  return (
    <Box key={key}>{renderContent(Content.styled(text, style), {}, key)}</Box>
  );
}

// [LAW:single-enforcer] ButtonPressed is posted only from this component's
// action_press handler. No other widget posts it.
// [LAW:one-source-of-truth] Match Textual's `Button` public widget name;
// model helpers use explicit internal names instead of competing exports.
export const Button = observer(function Button({
  id,
  classes,
  borderTitle,
  borderSubtitle,
  label,
  variant = "default",
  disabled,
  loading,
}: ButtonProps): React.JSX.Element {
  const resolved = React.useMemo(() => Content.fromText(label), [label]);

  // [LAW:dataflow-not-control-flow] Variant maps to a CSS class; the cascade
  // decides the visual difference, not branching in the component.
  const variantClass = variant === "default" ? [] : [`-${variant}`];
  const allClasses = composeWidgetClasses(classes, variantClass);

  const widget = useWidget({
    id,
    classes: allClasses,
    typeName: "Button",
    borderTitle,
    borderSubtitle,
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
    typeToken: Button,
  });

  const styles = useStyles(widget.handle);

  // [LAW:dataflow-not-control-flow] On the very first render the widget is
  // not yet registered and `styles` is empty — the typed accessors below
  // would throw. Gate the render on `lifecycleReady` so we read styles only
  // when the framework guarantees the cascade has populated them. This
  // mirrors `WidgetHost`'s child-render gate.
  if (!widget.lifecycleReady) {
    return <WidgetScope widget={widget.handle}><></></WidgetScope>;
  }

  // [LAW:dataflow-not-control-flow] The disabled-state palette is derived
  // unconditionally from the resolved palette; the data controls visual
  // dimming, not branching at every paint site.
  const basePalette = readButtonPalette(styles, variant);
  const palette = widget.handle.isDisabledEffective ? dimPalette(basePalette) : basePalette;
  const explicitWidth = readNumericBoxValue(styles.box.width);
  const minWidth = readNumericBoxValue(styles.box.minWidth) ?? 0;
  const height = readNumericBoxValue(styles.box.height) ?? 3;
  const textAlign = styles.getEnum("text-align", ["left", "center", "right"] as const);
  const contentWidth = (explicitWidth ?? minWidth) || (resolved.firstLine.cellLength + 2);
  const normalizedLabel = normalizeButtonLabel(
    resolved.firstLine.truncate(Math.max(0, contentWidth - 2), { overflow: "crop" }),
    true,
  );
  const labelCore = widget.handle.isDisabledEffective ? dimButtonLabel(normalizedLabel, basePalette.background) : normalizedLabel;
  const emphasizeLabel = height > 1;
  const labelStyles = [
    emphasizeLabel ? "bold" : undefined,
    emphasizeLabel && widget.handle.isFocused ? "reverse" : undefined,
  ].filter((style): style is string => style !== undefined);
  const labelContent = decorateButtonLabel(
    Content.assemble(" ", labelCore, " "),
    labelStyles,
  );
  // How wide to paint. The two answers below are not rivals — the width policy
  // in the CSS says which one is the map and which is the territory.
  //
  // `width: auto` means *the content decides*, so the content is the source and
  // the measurement is downstream of it. Reading the measurement there is
  // circular, and not harmlessly: this widget renders an empty WidgetScope
  // until `lifecycleReady`, and an empty scope has no resolved `alignSelf` to
  // hug with, so Yoga stretches it to the container. A button that believed
  // that first measurement painted 80 cells, which then kept the box at 80
  // forever — the auto-width fixpoint landing on the wrong point.
  //
  // Any other width means *the box decides*, and then the measurement is the
  // only honest answer, because the box's width need not be a number the
  // component can read: `%` scalars reach Ink as the string "100%"
  // (makeScalarSpec in styles/stylesheet.ts parses but does not normalize), so
  // `readNumericBoxValue` returns undefined and the old code silently painted
  // the 16-cell min-width inside an 80-cell box. Same conclusion WidgetFrame
  // reached for its border labels. [LAW:one-source-of-truth]
  const contentDecidesWidth = styles.box.width === undefined || styles.box.width === "auto";
  const hugWidth = Math.max(explicitWidth ?? 0, minWidth, labelContent.cellLength);
  const renderRows = (width: number): React.JSX.Element[] => {
  const middleRowText = (() => {
    const line = Array.from({ length: width }, () => " ");
    const labelOffset =
      textAlign === "left"
        ? 1
        : textAlign === "right"
          ? Math.max(0, width - labelContent.plain.length)
          : Math.max(0, Math.floor((width - labelContent.plain.length) / 2));

    for (let index = 0; index < labelContent.plain.length; index += 1) {
      if (labelOffset + index >= width) {
        break;
      }

      line[labelOffset + index] = labelContent.plain[index] ?? " ";
    }

    return { text: line.join(""), offset: labelOffset };
  })();
  const middleRowKey = `button:${widget.nodeId}:middle`;
  const middleRow = (
    <Box key={middleRowKey}>
      {renderContent(
        Content.styled(
          middleRowText.text.slice(0, middleRowText.offset),
          [palette.background === undefined ? palette.foreground : undefined, palette.background === undefined ? undefined : `on ${palette.background}`]
            .filter(Boolean)
            .join(" "),
        ),
        {},
        `${middleRowKey}:prefix`,
      )}
      {renderContent(
        labelContent,
        {
          color: palette.foreground,
          backgroundColor: palette.background,
        },
        middleRowKey,
      )}
      {renderContent(
        Content.styled(
          middleRowText.text.slice(middleRowText.offset + labelContent.plain.length),
          [palette.background === undefined ? palette.foreground : undefined, palette.background === undefined ? undefined : `on ${palette.background}`]
            .filter(Boolean)
            .join(" "),
        ),
        {},
        `${middleRowKey}:suffix`,
      )}
    </Box>
  );

    // [LAW:dataflow-not-control-flow] A one-row button drops the shadow rows by
    // emitting an empty list, not by a different render path.
    return [
      ...(height > 1 ? [renderButtonRow("▔".repeat(width), palette.top, palette.background, `button:${widget.nodeId}:top`)] : []),
      middleRow,
      ...(height > 1 ? [renderButtonRow("▁".repeat(width), palette.bottom, palette.background, `button:${widget.nodeId}:bottom`)] : []),
    ];
  };

  return (
    <WidgetScope widget={widget.handle}>
      <WidgetFrame widget={widget.handle} styles={styles} boxProps={{ flexDirection: "column" }}>
        <MeasuredSizeReader widget={widget.handle}>
          {(measured) => (
            <>{renderRows(contentDecidesWidth ? hugWidth : measured.width ?? hugWidth)}</>
          )}
        </MeasuredSizeReader>
      </WidgetFrame>
    </WidgetScope>
  );
});
