// [LAW:one-source-of-truth] Match Textual's `Static` public widget name;
// model helpers use explicit internal names instead of competing exports.

import React from "react";

import {
  ContentWidget,
  type ContentProps,
  type ContentWidgetIdentity,
} from "./content-widget.js";

export type StaticProps = ContentProps;

const STATIC_IDENTITY: ContentWidgetIdentity = {
  typeName: "Static",
  typeToken: Static,
};

// Textual's base content widget: non-interactive text display. The rendering
// lives in ContentWidget, which Label registers under its own name.
export function Static(props: StaticProps): React.JSX.Element {
  return <ContentWidget {...props} identity={STATIC_IDENTITY} />;
}
