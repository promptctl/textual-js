// [LAW:one-way-deps] Component consumes framework services (useWidget,
// useStyles) and composes two public widgets. It owns no message type: upstream
// Welcome posts nothing of its own — the OK button posts `Button.Pressed`, and
// re-posting it under a second name would be a second source of truth for one
// event.
//
// Unlike every other widget shipped in this stage, Welcome is not a
// ContentWidget identity. Upstream is
// `Welcome(Static)` composing `Container(Static(Markdown(WELCOME_MD)))` plus a
// `Button`, and `welcome_default.txt` shows exactly that: a markdown-rendered
// body over a full-width docked button. A widget that composes children is not
// a widget that paints one Content, so it gets a render body.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";

import { Content } from "../content/index.js";
import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import { dockBottomBoxProps } from "../styles/box-geometry.js";
import { Button } from "./button-component.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import type { ContentSource } from "./content-widget.js";
import { Static } from "./static-component.js";
import { WidgetFrame } from "./widget-frame.js";

/**
 * Upstream's `WELCOME_MD`, verbatim.
 *
 * It is markdown *source*, and this port has no Markdown widget yet — every
 * `markdown_*` fixture is stage-10 work. So the body below paints this string
 * as plain text and the rendered-markdown rows of `welcome_default` are a known
 * diff, recorded in `visual-tests/fixture-todos.json`. Copying the string is
 * how the body stays honest about that: the alternative is transcribing the
 * *wrapped, heading-styled* rows out of the baseline, which would make the
 * fixture agree with Textual without this port being able to render markdown at
 * all.
 */
export const WELCOME_MARKDOWN = `# Welcome!

Textual is a TUI, or *Text User Interface*, framework for Python inspired by modern web development. **We hope you enjoy using Textual!**

## Dune quote

> "I must not fear.
Fear is the mind-killer.
Fear is the little-death that brings total obliteration.
I will face my fear.
I will permit it to pass over me and through me.
And when it has gone past, I will turn the inner eye to see its path.
Where the fear has gone there will be nothing. Only I will remain."
`;

// `new Content`, not `Content.fromText`: this is prose that happens to be
// markdown, not this port's markup dialect, so a `[…]` in it is seven visible
// characters and never a tag. Built once at module scope so the default body
// is a stable reference and the content memo downstream can hit.
const WELCOME_BODY = new Content(WELCOME_MARKDOWN);

// Upstream's rules, adapted at the points where this renderer differs — each
// adaptation noted, because an unexplained divergence from the oracle is
// indistinguishable from a mistake.
//
//   1. `background: $surface` / `color: $foreground` are literals. Theme
//      variables do not yet resolve to Textual's values in this port
//      (textual-theme-variables-bz8); `#1e1e1e` and `#e0e0e0` are the values
//      welcome_default.ansi actually holds.
//   2. Upstream's `Welcome Container { padding: 1 }`, `Welcome #text
//      { margin: 0 1 }` and `Welcome #close { dock: bottom; width: 100% }` are
//      absent, and deliberately: a widget's cascade here is built from its own
//      type's default stylesheets plus the screen's user CSS
//      (resolveStylesForWidget in styles/stylesheet.ts), so a descendant rule
//      written here would silently style nothing. Writing it anyway would be a
//      map of a territory that does not exist. The three facts it carries —
//      body inset, dock, full width — cross into the children through the
//      render body instead. Ticket textual-style-cascade-apr.
const DEFAULT_CSS = `
  Welcome {
    width: 100%;
    height: 100%;
    background: #1e1e1e;
    color: #e0e0e0;
  }
`;

// Upstream's Container padding (1) plus `#text`'s own margin (0 1). One inset,
// because the Container it came from has no counterpart here.
const BODY_INSET = { marginTop: 1, marginBottom: 1, marginLeft: 2, marginRight: 2 };

export interface WelcomeProps extends WidgetComponentProps {
  /**
   * The body. Defaults to upstream's welcome copy.
   *
   * Present so Welcome is usable as the placeholder upstream documents it to be
   * — "this widget can be used as a form of placeholder within a Textual
   * application" is a claim about arbitrary content, and a body nailed to one
   * string cannot honour it. [LAW:composability]
   */
  content?: ContentSource;
  /** The dismiss button's label. Upstream's is `OK`. */
  buttonLabel?: string;
}

export const Welcome = observer(function Welcome({
  id,
  classes,
  borderTitle,
  borderSubtitle,
  content = WELCOME_BODY,
  buttonLabel = "OK",
}: WelcomeProps): React.JSX.Element {
  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes),
    typeName: "Welcome",
    typeToken: Welcome,
    borderTitle,
    borderSubtitle,
    defaultCss: DEFAULT_CSS,
  });

  const styles = useStyles(widget.handle);

  return (
    <WidgetScope widget={widget.handle}>
      <WidgetFrame widget={widget.handle} styles={styles} boxProps={{ flexDirection: "column" }}>
        <Box {...BODY_INSET}>
          <Static id="text" content={content} />
        </Box>
        <Box {...dockBottomBoxProps()}>
          <Button id="close" classes="-full-width" label={buttonLabel} variant="success" />
        </Box>
      </WidgetFrame>
    </WidgetScope>
  );
});
