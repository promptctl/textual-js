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
import { colorToInkValue } from "../styles/index.js";
import { ButtonPressed, type ButtonVariant } from "./button.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { WidgetFrame } from "./widget-frame.js";

export interface ButtonProps extends WidgetComponentProps {
  label?: ContentInput;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}

const DEFAULT_CSS = `
  Button {
    background: #272727;
    color: #e0e0e0;
    min-width: 16;
    height: 3;
    text-align: center;
  }
  Button.-primary { background: #0178d4; color: #ddedf9; }
  Button.-success { background: #4ebf71; color: #0a180e; }
  Button.-warning { background: #fea62b; color: #211505; }
  Button.-error { background: #b93c5b; color: #f5e5e9; }
`;

interface ButtonPalette {
  background: string | undefined;
  foreground: string;
  top: string;
  bottom: string;
}

const DEFAULT_BUTTON_PALETTES: Record<ButtonVariant, ButtonPalette> = {
  default: { background: "#272727", foreground: "#e0e0e0", top: "#2d2d2d", bottom: "#0d0d0d" },
  primary: { background: "#0178d4", foreground: "#ddedf9", top: "#6db2ff", bottom: "#004295" },
  success: { background: "#4ebf71", foreground: "#0a180e", top: "#7ae998", bottom: "#008139" },
  warning: { background: "#fea62b", foreground: "#211505", top: "#ffcf56", bottom: "#b86b00" },
  error: { background: "#b93c5b", foreground: "#f5e5e9", top: "#e76580", bottom: "#780028" },
};

function parseHexColor(color: string): [number, number, number] | null {
  const match = color.toLowerCase().match(/^#([0-9a-f]{6})$/);

  if (match === null) {
    return null;
  }

  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

function toHexColor(red: number, green: number, blue: number): string {
  const channel = (value: number): string => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function mixColor(color: string, target: string, factor: number): string | undefined {
  const source = parseHexColor(color);
  const destination = parseHexColor(target);

  if (source === null || destination === null) {
    return undefined;
  }

  return toHexColor(
    source[0] + (destination[0] - source[0]) * factor,
    source[1] + (destination[1] - source[1]) * factor,
    source[2] + (destination[2] - source[2]) * factor,
  );
}

function normalizePaintColor(value: string | undefined): string | undefined {
  return value === undefined || value === "rgba(0,0,0,0)" ? undefined : value;
}

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

// [LAW:one-source-of-truth] All disabled-state dimming derives from this single
// factor and pivot color so label, edge rows, and background stay in sync.
const DISABLED_DIM_TARGET = "#121212";
const DISABLED_DIM_FACTOR = 0.5825;

function dimColor(color: string | undefined): string | undefined {
  return color === undefined ? undefined : mixColor(color, DISABLED_DIM_TARGET, DISABLED_DIM_FACTOR) ?? color;
}

function dimButtonLabel(content: Content, background: string | undefined): Content {
  const baseBackground = background ?? "#121212";

  return new Content(
    content.plain,
    content.spans.map((span) => ({
      ...span,
      // [LAW:single-enforcer] Disabled-state dimming for authored label colors
      // is applied once at the button label seam so CSS colors and explicit
      // content spans follow the same opacity rule.
      style: rewriteForegroundColor(span.style, (color) => mixColor(color, baseBackground, DISABLED_DIM_FACTOR)),
    })),
  );
}

function dimPalette(palette: ButtonPalette): ButtonPalette {
  return {
    background: dimColor(palette.background),
    foreground: dimColor(palette.foreground) ?? palette.foreground,
    top: dimColor(palette.top) ?? palette.top,
    bottom: dimColor(palette.bottom) ?? palette.bottom,
  };
}

function readButtonPalette(
  styles: ReturnType<typeof useStyles>,
  variant: ButtonVariant,
): ButtonPalette {
  const defaults = DEFAULT_BUTTON_PALETTES[variant];
  const hasBackgroundRule = styles.hasRule("background");
  const background = hasBackgroundRule
    ? normalizePaintColor(colorToInkValue(styles.getRule("background") as never))
    : defaults.background;
  const foreground = colorToInkValue(styles.getRule("color") as never) ?? defaults.foreground;
  const top = (styles.customProperties.get("--button-top") as string | undefined)
    ?? (background === defaults.background ? defaults.top : mixColor(background ?? "#272727", "#ffffff", 0.2))
    ?? defaults.top;
  const bottom = (styles.customProperties.get("--button-bottom") as string | undefined)
    ?? (background === defaults.background ? defaults.bottom : mixColor(background ?? "#272727", "#000000", 0.35))
    ?? defaults.bottom;

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
  // [LAW:dataflow-not-control-flow] The disabled-state palette is derived
  // unconditionally from the resolved palette; the data controls visual
  // dimming, not branching at every paint site.
  const basePalette = readButtonPalette(styles, variant);
  const palette = widget.handle.isDisabledEffective ? dimPalette(basePalette) : basePalette;
  const explicitWidth = readNumericBoxValue(styles.box.width);
  const minWidth = readNumericBoxValue(styles.box.minWidth) ?? 0;
  const height = readNumericBoxValue(styles.box.height) ?? 3;
  const textAlign = (styles.getRule("text-align") as "left" | "center" | "right" | undefined) ?? "center";
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
  const width = Math.max(explicitWidth ?? 0, minWidth, labelContent.cellLength);
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

  return (
    <WidgetScope widget={widget.handle}>
      <WidgetFrame widget={widget.handle} styles={styles} boxProps={{ flexDirection: "column" }}>
        {height > 1 ? renderButtonRow("▔".repeat(width), palette.top, palette.background, `button:${widget.nodeId}:top`) : null}
        {middleRow}
        {height > 1 ? renderButtonRow("▁".repeat(width), palette.bottom, palette.background, `button:${widget.nodeId}:bottom`) : null}
      </WidgetFrame>
    </WidgetScope>
  );
});
