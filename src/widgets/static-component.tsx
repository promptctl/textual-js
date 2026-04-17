// [LAW:one-way-deps] Component consumes framework services (useWidget, useStyles).
// It does not modify framework internals.

import React from "react";
import { Box, Text } from "ink";
import { observer } from "mobx-react-lite";

import { Content, type ContentInput } from "../content/index.js";
import { WidgetScope, useStyles, useWidget } from "../framework/context.js";

export interface StaticWidgetProps {
  id?: string;
  classes?: string | string[];
  content?: ContentInput;
}

// No DEFAULT_CSS needed — Ink's flexbox auto-sizes by default.

// [LAW:one-type-per-behavior] StaticWidget is the single React component for
// non-interactive text display. No separate Label component duplicates this.
export const StaticWidget = observer(function StaticWidget({
  id,
  classes,
  content,
}: StaticWidgetProps): React.JSX.Element {
  const resolved = React.useMemo(() => Content.fromText(content), [content]);

  const widget = useWidget({
    id,
    classes,
    typeName: "Static",
  });

  const styles = useStyles(widget.handle);

  return (
    <WidgetScope widget={widget.handle}>
      <Box {...styles.box}>
        <Text {...styles.text}>{resolved.plain}</Text>
      </Box>
    </WidgetScope>
  );
});
