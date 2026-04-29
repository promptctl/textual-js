// [LAW:one-way-deps] Footer consumes the framework's derived binding view.
// It does not re-derive binding precedence or mutate framework internals.
// [LAW:dataflow-not-control-flow] The bar always renders. The chip count
// (zero or more) lives in the data, not in branching renders. An empty
// bindings list produces a bar with no chips — never an absent bar.

import React from "react";
import { Box, Text } from "ink";
import { observer } from "mobx-react-lite";

import {
  WidgetScope,
  useStyles,
  useTextual,
  useWidget,
} from "../framework/context.js";
import type { ActiveBinding } from "../framework/app-framework.js";
import type { Widget } from "../framework/widget.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";

const FOOTER_BACKGROUND = "#212B32";
const FOOTER_FOREGROUND = "#e0e0e0";
const FOOTER_KEY_COLOR = "#fea62b";
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

function buildChipSegments(binding: ActiveBinding, compact: boolean): ChipSegments {
  const showDescription =
    !compact && binding.description !== undefined && binding.description.length > 0;
  return {
    before: " ",
    key: binding.key,
    betweenKeyAndDescription: " ",
    description: showDescription ? (binding.description ?? "") : "",
    after: showDescription ? " " : " ",
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

const PALETTE_LABEL = " palette";
const PALETTE_KEY = "^p";

function paletteDisplayWidth(): number {
  return FOOTER_PALETTE_SEPARATOR.length + PALETTE_KEY.length + PALETTE_LABEL.length;
}

// [LAW:single-enforcer] One subscription path that reliably picks up
// post-mount binding declarations. The shared `useBindings` hook subscribes
// inside a `useLayoutEffect` that runs *before* the parent's
// `setAppBindings` layout effect has fired its signal, so the initial
// publish is missed. This local hook closes that race by re-reading inside
// `useEffect` (which runs after every layout effect in the tree, including
// the parent's setAppBindings) and by re-fetching whenever the bindings
// signal fires post-mount.
function useFooterBindings(widget: Widget): ActiveBinding[] {
  const framework = useTextual();
  const [bindings, setBindings] = React.useState<ActiveBinding[]>(() =>
    framework.getActiveBindings(),
  );

  React.useEffect(() => {
    setBindings(framework.getActiveBindings());
    return framework.signals.bindings_updated_signal.subscribe(widget, () => {
      setBindings(framework.getActiveBindings());
    });
  }, [framework, widget]);

  return bindings;
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
        <Text backgroundColor={FOOTER_BACKGROUND}>{segments.before}</Text>
        <Text color={FOOTER_KEY_COLOR} backgroundColor={FOOTER_BACKGROUND} bold>
          {segments.key}
        </Text>
        <Text backgroundColor={FOOTER_BACKGROUND}>{segments.betweenKeyAndDescription}</Text>
        <Text color={FOOTER_FOREGROUND} backgroundColor={FOOTER_BACKGROUND}>
          {segments.description}
        </Text>
        <Text backgroundColor={FOOTER_BACKGROUND}>{segments.after}</Text>
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
  const allBindings = useFooterBindings(widget.handle);
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

  return (
    <WidgetScope widget={widget.handle}>
      <Box flexDirection="row">
        {bindings.map((binding) => (
          <FooterKey
            key={`${binding.namespace.key}:${binding.key}:${binding.action}`}
            binding={binding}
            compact={compact}
          />
        ))}
        <Text backgroundColor={FOOTER_BACKGROUND}>{" ".repeat(fillWidth)}</Text>
        {showCommandPalette ? (
          <>
            <Text color={FOOTER_FOREGROUND} backgroundColor={FOOTER_BACKGROUND}>
              {FOOTER_PALETTE_SEPARATOR}
            </Text>
            <Text color={FOOTER_KEY_COLOR} backgroundColor={FOOTER_BACKGROUND} bold>
              {PALETTE_KEY}
            </Text>
            <Text color={FOOTER_FOREGROUND} backgroundColor={FOOTER_BACKGROUND}>
              {PALETTE_LABEL}
            </Text>
          </>
        ) : null}
      </Box>
    </WidgetScope>
  );
});
