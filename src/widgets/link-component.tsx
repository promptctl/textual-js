// [LAW:one-type-per-behavior] Textual's Link is `class Link(Static,
// can_focus=True)` — the same content rendering as Static, plus focus, styling
// and an activation binding. It is therefore a third ContentWidget identity,
// never a third copy of the render body.

import React from "react";

import { Content, type ContentInput } from "../content/index.js";
import { useTextual } from "../framework/context.js";
import {
  ContentWidget,
  type ContentProps,
  type ContentWidgetIdentity,
} from "./content-widget.js";

export interface LinkProps extends Omit<ContentProps, "content"> {
  text?: ContentInput;
  url?: string;
}

// Colors are literal here for the same reason Button's are: they are the values
// Textual's default dark theme resolves its tokens to, captured so the rendered
// bytes match the Python baseline. `#ffc473` is `$text-accent`.
const DEFAULT_CSS = `
  Link {
    color: #ffc473;
    text-style: underline;
  }
  Link:hover { color: #ff8c42; }
  Link:focus { text-style: bold reverse; }
`;

const LINK_REGISTRATION = {
  typeName: "Link",
  typeToken: Link,
  // `class Link(Static, …)`, so `Static { … }` rules reach a Link too.
  baseTypeNames: ["Static"],
  focusable: true,
  defaultCss: DEFAULT_CSS,
  bindings: [{ key: "enter", action: "open_link", description: "Open link" }],
} satisfies ContentWidgetIdentity;

export function Link({ text, url, ...contentProps }: LinkProps): React.JSX.Element {
  const app = useTextual();

  // [LAW:one-source-of-truth] The link's text is parsed once, with markup off —
  // Textual's Link constructs its Static base with `markup=False`, so a bracket
  // in the text is a bracket. That single Content is both what renders and what
  // `url` falls back to, so the two can never disagree about the link's text.
  const content = React.useMemo(() => Content.fromText(text, { markup: false }), [text]);
  const target = url ?? content.plain;

  const identity = React.useMemo<ContentWidgetIdentity>(
    () => ({
      ...LINK_REGISTRATION,
      // [LAW:effects-at-boundaries] The widget names the intent; App owns the
      // OS effect of actually opening it.
      actions: { action_open_link: () => app.openUrl(target) },
      handlers: { onClick: () => app.openUrl(target) },
    }),
    [app, target],
  );

  return <ContentWidget {...contentProps} content={content} identity={identity} />;
}
