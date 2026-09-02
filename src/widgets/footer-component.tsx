// [LAW:one-way-deps] Footer consumes the framework's derived binding view.
// It does not re-derive binding precedence or mutate framework internals.
// [LAW:single-enforcer] Every styled glyph leaves through renderContent, the
// one visual-to-Ink bridge. Passing colours to Ink's <Text> instead routes them
// through chalk, whose level is decided per-terminal — inside the visual-test
// xterm it resolves to 1, which silently quantises #ffa62b to ANSI yellow and
// #242f38 to black. The bridge emits truecolour itself, so the Footer's palette
// survives wherever every other widget's palette does.
// [LAW:dataflow-not-control-flow] The bar always renders. The chip count
// (zero or more) lives in the data, not in branching renders. An empty
// bindings list produces a bar with no chips — never an absent bar.

import React from "react";
import { Box, type TextProps } from "ink";
import { observer } from "mobx-react-lite";

import { Content, renderContent } from "../content/index.js";

import {
  WidgetScope,
  useBindings,
  useStyles,
  useWidget,
} from "../framework/context.js";
import {
  COMMAND_PALETTE_KEY,
  getKeyDisplay,
  type ActiveBinding,
} from "../framework/_app-runtime.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";

// Textual's own footer palette, cell-for-cell. Ground truth for every value
// here is visual-tests/snapshots/python/footer_with_bindings.json.
const FOOTER_BACKGROUND = "#242f38";
const FOOTER_FOREGROUND = "#e0e0e0";
const FOOTER_KEY_COLOR = "#ffa62b";
const FOOTER_SEPARATOR_COLOR = "#495259";
const FOOTER_PALETTE_SEPARATOR = "▏";

const DEFAULT_CSS = `
  Footer {
    width: 100%;
    height: 1;
    background: ${FOOTER_BACKGROUND};
    color: ${FOOTER_FOREGROUND};
  }
  FooterKey {
    height: 1;
  }
`;

// [LAW:one-source-of-truth] Every glyph in the bar sits on the bar's
// background. It is stated once here instead of at each call site, so no
// segment of the bar can end up painted on a different colour than its
// neighbours.
function footerGlyphs(text: string, style: Partial<TextProps>): React.JSX.Element {
  return renderContent(Content.fromText(text), { backgroundColor: FOOTER_BACKGROUND, ...style });
}

export interface FooterProps extends WidgetComponentProps {
  compact?: boolean;
  showCommandPalette?: boolean;
}

export interface FooterKeyProps {
  binding: ActiveBinding;
  compact?: boolean;
}

interface ChipSegments {
  before: string;
  key: string;
  betweenKeyAndDescription: string;
  description: string;
  after: string;
}

// [LAW:one-source-of-truth] getKeyDisplay owns the key -> display-form mapping
// (ctrl+r -> ^r, delete -> del). The chip reads it here, where the same segments
// feed both the rendered text and chipDisplayWidth, so the bar's measured width
// can never disagree with the glyphs it draws.
function buildChipSegments(binding: ActiveBinding, compact: boolean): ChipSegments {
  return {
    before: " ",
    key: getKeyDisplay(binding.key),
    betweenKeyAndDescription: " ",
    description: compact ? "" : (binding.description ?? ""),
    after: " ",
  };
}

function chipDisplayWidth(segments: ChipSegments): number {
  return (
    segments.before.length +
    segments.key.length +
    segments.betweenKeyAndDescription.length +
    segments.description.length +
    segments.after.length
  );
}

// The label's trailing space is the bar's final cell — Textual pads the palette
// chip on both sides, so the label spans through column 80.
const PALETTE_LABEL = " palette ";
const PALETTE_KEY = getKeyDisplay(COMMAND_PALETTE_KEY);

function paletteDisplayWidth(): number {
  return FOOTER_PALETTE_SEPARATOR.length + PALETTE_KEY.length + PALETTE_LABEL.length;
}

export const FooterKey = observer(function FooterKey({
  binding,
  compact = false,
}: FooterKeyProps): React.JSX.Element {
  const widget = useWidget({
    typeName: "FooterKey",
    classes: binding.enabled ? [] : ["-disabled"],
    typeToken: FooterKey,
    handlers: {
      onClick: () => {
        binding.run();
      },
    },
  });
  const segments = buildChipSegments(binding, compact);

  return (
    <WidgetScope widget={widget.handle}>
      <Box flexDirection="row">
        {footerGlyphs(
          `${segments.before}${segments.key}${segments.betweenKeyAndDescription}`,
          { color: FOOTER_KEY_COLOR, bold: true },
        )}
        {footerGlyphs(segments.description, { color: FOOTER_FOREGROUND })}
        {footerGlyphs(segments.after, {})}
      </Box>
    </WidgetScope>
  );
});

export const Footer = observer(function Footer({
  id,
  classes,
  borderTitle,
  borderSubtitle,
  compact = false,
  showCommandPalette = true,
}: FooterProps): React.JSX.Element {
  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes),
    typeName: "Footer",
    defaultCss: DEFAULT_CSS,
    typeToken: Footer,
    borderTitle,
    borderSubtitle,
  });
  // [LAW:single-enforcer] Style resolution stays the framework's job; we only
  // request the resolved values. The Footer never re-derives them.
  useStyles(widget.handle);
  // [LAW:single-enforcer] One reactive path: observer() tracks reads of the
  // canonical observable binding state via useBindings → getActiveBindings.
  const allBindings = useBindings(widget.handle);
  const bindings = allBindings.filter(
    (binding) => binding.description !== undefined && binding.description.length > 0,
  );

  const chipSegments = bindings.map((binding) => buildChipSegments(binding, compact));
  const chipsTotalWidth = chipSegments.reduce(
    (total, segments) => total + chipDisplayWidth(segments),
    0,
  );
  const reservedRightWidth = showCommandPalette ? paletteDisplayWidth() : 0;
  // [LAW:dataflow-not-control-flow] The fill-width is derived from the
  // standard 80-cell terminal geometry (matching FixtureScreen and Textual's
  // dock-bottom contract). Same code path runs whether bindings are present
  // or not; only the fill length varies.
  const totalBarWidth = 80;
  const fillWidth = Math.max(0, totalBarWidth - chipsTotalWidth - reservedRightWidth);

  // [LAW:dataflow-not-control-flow] The Footer always docks at the bottom of
  // its flex-column parent. `marginTop: auto` pushes it to the end whenever
  // there's leftover space; with no leftover space it has no effect — same
  // code path either way, the flex container's spare height varies the layout
  // outcome. This mirrors Textual's `dock: bottom` for the Footer widget.
  // Yoga supports auto margins at runtime; Ink's TS type for marginTop is
  // narrowed to `number` and does not advertise this. Cast through unknown.
  const dockBottomStyle = { marginTop: "auto" } as unknown as { marginTop: number };
  return (
    <Box {...dockBottomStyle}>
      <WidgetScope widget={widget.handle}>
        <Box flexDirection="row">
          {bindings.map((binding) => (
            <FooterKey
              key={`${binding.namespace.key}:${binding.key}:${binding.action}`}
              binding={binding}
              compact={compact}
            />
          ))}
          {footerGlyphs(" ".repeat(fillWidth), {})}
          {showCommandPalette ? (
            <>
              {footerGlyphs(FOOTER_PALETTE_SEPARATOR, { color: FOOTER_SEPARATOR_COLOR })}
              {footerGlyphs(PALETTE_KEY, { color: FOOTER_KEY_COLOR, bold: true })}
              {footerGlyphs(PALETTE_LABEL, { color: FOOTER_FOREGROUND })}
            </>
          ) : null}
        </Box>
      </WidgetScope>
    </Box>
  );
});
