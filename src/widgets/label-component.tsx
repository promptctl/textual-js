// [LAW:one-type-per-behavior] Textual's Label is a thin Static specialization —
// identical rendering, its own type name so CSS can target it. It is therefore
// a second identity for ContentWidget, never a second implementation.

import React from "react";

import {
  ContentWidget,
  type ContentProps,
  type ContentWidgetIdentity,
} from "./content-widget.js";

export type LabelProps = ContentProps;

const LABEL_IDENTITY: ContentWidgetIdentity = {
  typeName: "Label",
  typeToken: Label,
  // `class Label(Static)` in Textual, so `Static { … }` rules reach a Label too.
  baseTypeNames: ["Static"],
};

export function Label(props: LabelProps): React.JSX.Element {
  return <ContentWidget {...props} identity={LABEL_IDENTITY} />;
}
