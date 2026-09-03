// [LAW:one-way-deps] Header consumes the framework's resolved title view. It
// does not re-derive screen-over-app precedence or mutate framework internals.
// [LAW:single-enforcer] Every styled glyph leaves through renderContent, the
// one visual-to-Ink bridge — the same reason the Footer does. Passing colours
// to Ink's <Text> instead routes them through chalk, whose level is decided
// per-terminal; inside the visual-test xterm it resolves to 1, which would
// quantise this bar's #242f38 to black.
// [LAW:dataflow-not-control-flow] The bar always renders all three regions at
// full width. A missing subtitle shortens a string; it never removes a region,
// and an unmeasured Header paints nothing rather than paints a different shape.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";

import { Content, renderContent } from "../content/index.js";
import { WidgetScope, useResolvedTitle, useStyles, useWidget } from "../framework/context.js";
import { MeasuredSizeReader } from "../framework/measured-size.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";

// Textual's own header palette and geometry, cell-for-cell. Ground truth for
// every value here is visual-tests/snapshots/python/header_default.ansi and
// header_with_subtitle.ansi, whose 80-cell rows partition as 8 | 62 | 10.
const HEADER_BACKGROUND = "#242f38";
const HEADER_FOREGROUND = "#e0e0e0";
// The subtitle run in header_with_subtitle.ansi is `38;2;160;163;166`. It is a
// literal rather than a computed dim of the foreground because Textual's
// Color.blend truncates where this repo's mixColor rounds: the same factor
// yields #a0a4a7 here and #a0a3a6 there, and two channels off by one is a
// pixel diff Gate 4 sees. Deriving it would also mean picking a blend factor
// no source states — see textual-theme-variables-bz8 for why $token colours do
// not currently resolve to Textual's values either.
const HEADER_SUBTITLE_COLOR = "#a0a3a6";
const HEADER_ICON = "⭘";
// HeaderIcon is `width: 8; padding: 0 1` in Textual, so the glyph sits at
// column 1 and the region runs to column 7.
const HEADER_ICON_WIDTH = 8;
// HeaderClockSpace reserves the right end whether or not a clock is shown.
// Textual paints it blank at `width: 10`, which is what both baselines hold.
const HEADER_CLOCK_WIDTH = 10;
const TITLE_SEPARATOR = " — ";

const DEFAULT_CSS = `
  Header {
    width: 100%;
    height: 1;
    background: ${HEADER_BACKGROUND};
    color: ${HEADER_FOREGROUND};
  }
  HeaderIcon {
    width: ${HEADER_ICON_WIDTH};
    height: 1;
  }
  HeaderTitle {
    height: 1;
  }
  HeaderClockSpace {
    width: ${HEADER_CLOCK_WIDTH};
    height: 1;
  }
`;

// [LAW:one-source-of-truth] Every glyph in the bar sits on the bar's
// background, stated once here instead of at each call site, so no segment of
// the bar can end up painted on a different colour than its neighbours.
function headerGlyphs(content: Content, keyPrefix: string): React.JSX.Element {
  return renderContent(content, {
    color: HEADER_FOREGROUND,
    backgroundColor: HEADER_BACKGROUND,
  }, keyPrefix);
}

/**
 * Pad `content` out to exactly `width` cells with it centred, truncating with
 * an ellipsis when it cannot fit.
 *
 * [LAW:types-are-the-program] The returned Content is always exactly `width`
 * cells, so the caller has no "did it fit?" case to handle and the three
 * regions always sum to the bar. An odd remainder goes to the trailing side,
 * as in Rich's `Align(center)`.
 */
function centerInto(content: Content, width: number): Content {
  const fitted = content.truncate(width, { overflow: "ellipsis" });
  const slack = width - fitted.cellLength;
  const leading = Math.floor(slack / 2);

  return Content.blank(leading).add(fitted).add(Content.blank(slack - leading));
}

export interface HeaderProps extends WidgetComponentProps {}

/**
 * The title and sub-title, as one Static-derived child.
 *
 * Deliberately not exported. It is registered, so CSS and `query("HeaderTitle")`
 * reach it exactly as the spec requires, but it takes content its parent has
 * already centred against a width its parent measured — a shape no other caller
 * can supply correctly. Publishing it would publish a part moulded to one joint.
 *
 * The spec makes this queryable as `HeaderTitle` and states it is a Static, so
 * `Static { … }` rules must reach it the way Python inheritance makes them.
 */
const HeaderTitle = observer(function HeaderTitle({
  content,
  width,
}: {
  content: Content;
  width: number;
}): React.JSX.Element {
  const widget = useWidget({
    typeName: "HeaderTitle",
    baseTypeNames: ["Static"],
    typeToken: HeaderTitle,
  });

  return (
    <WidgetScope widget={widget.handle}>
      <Box>{headerGlyphs(centerInto(content, width), "header-title")}</Box>
    </WidgetScope>
  );
});

const HeaderIcon = observer(function HeaderIcon(): React.JSX.Element {
  const widget = useWidget({ typeName: "HeaderIcon", typeToken: HeaderIcon });

  return (
    <WidgetScope widget={widget.handle}>
      <Box>
        {headerGlyphs(
          // `padding: 0 1` around a left-aligned glyph: one pad cell, the
          // glyph, then the rest of the region — 1 + 1 + 6 = 8.
          Content.blank(1)
            .add(Content.fromText(HEADER_ICON, { markup: false }))
            .add(Content.blank(HEADER_ICON_WIDTH - 2)),
          "header-icon",
        )}
      </Box>
    </WidgetScope>
  );
});

/**
 * The blank right-hand region Textual reserves for the optional clock.
 *
 * It renders even with no clock because the baselines show it: the title is
 * centred in what is left after this region, not in the whole bar, so dropping
 * it would shift the title five cells right.
 */
const HeaderClockSpace = observer(function HeaderClockSpace(): React.JSX.Element {
  const widget = useWidget({ typeName: "HeaderClockSpace", typeToken: HeaderClockSpace });

  return (
    <WidgetScope widget={widget.handle}>
      <Box>{headerGlyphs(Content.blank(HEADER_CLOCK_WIDTH), "header-clock")}</Box>
    </WidgetScope>
  );
});

export const Header = observer(function Header({
  id,
  classes,
  borderTitle,
  borderSubtitle,
}: HeaderProps): React.JSX.Element {
  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes),
    typeName: "Header",
    defaultCss: DEFAULT_CSS,
    typeToken: Header,
    borderTitle,
    borderSubtitle,
  });
  // [LAW:single-enforcer] Style resolution stays the framework's job; we only
  // request the resolved values. The Header never re-derives them.
  useStyles(widget.handle);
  const { title, subTitle } = useResolvedTitle();

  // [LAW:dataflow-not-control-flow] An absent sub-title shortens a string
  // rather than selecting a different render: the separator run is always
  // appended, and it is empty when there is nothing to separate.
  const titleContent = React.useMemo(() => {
    const suffix = subTitle === "" ? "" : `${TITLE_SEPARATOR}${subTitle}`;

    return Content.fromText(title, { markup: false }).add(
      Content.styled(suffix, HEADER_SUBTITLE_COLOR),
    );
  }, [title, subTitle]);

  return (
    <WidgetScope widget={widget.handle}>
      <MeasuredSizeReader widget={widget.handle}>
        {({ width }) =>
          // Nothing is painted until the bar has been measured. `undefined` is
          // "not placed yet", and guessing a width here would centre the title
          // against a number the layout never agreed to — the one frame of
          // blankness costs nothing, an off-centre title persists.
          width === undefined ? (
            <Box />
          ) : (
            <Box flexDirection="row">
              <HeaderIcon />
              <HeaderTitle
                content={titleContent}
                width={Math.max(0, width - HEADER_ICON_WIDTH - HEADER_CLOCK_WIDTH)}
              />
              <HeaderClockSpace />
            </Box>
          )
        }
      </MeasuredSizeReader>
    </WidgetScope>
  );
});
