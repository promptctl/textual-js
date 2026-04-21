// [LAW:one-way-deps] Footer consumes the framework's derived binding view.
// It does not re-derive binding precedence or mutate framework internals.

import React from "react";
import { Box, Text } from "ink";
import { observer } from "mobx-react-lite";

import { WidgetScope, useBindings, useStyles, useWidget } from "../framework/context.js";
import type { ActiveBinding } from "../framework/app-framework.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { WidgetFrame } from "./widget-frame.js";

const DEFAULT_CSS = `
  FooterKey {
    padding-right: 1;
  }
`;

export interface FooterProps extends WidgetComponentProps {
  compact?: boolean;
}

export interface FooterKeyProps {
  binding: ActiveBinding;
  compact?: boolean;
}

function FooterKeyLabel({
  binding,
  compact = false,
}: {
  binding: ActiveBinding;
  compact?: boolean;
}): React.JSX.Element {
  const keyWidget = useWidget({
    typeName: "FooterKeyPart",
    classes: "footer-key--key",
  });
  const descriptionWidget = useWidget({
    typeName: "FooterKeyPart",
    classes: "footer-key--description",
  });
  const keyStyles = useStyles(keyWidget.handle);
  const descriptionStyles = useStyles(descriptionWidget.handle);

  return (
    <>
      <WidgetScope widget={keyWidget.handle}>
        <Box {...keyStyles.box}>
          <Text {...keyStyles.text}>{binding.key}</Text>
        </Box>
      </WidgetScope>
      {compact || binding.description === undefined || binding.description.length === 0 ? null : (
        <WidgetScope widget={descriptionWidget.handle}>
          <Box {...descriptionStyles.box} marginLeft={1}>
            <Text {...descriptionStyles.text}>{binding.description}</Text>
          </Box>
        </WidgetScope>
      )}
    </>
  );
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
  const styles = useStyles(widget.handle);

  return (
    <WidgetScope widget={widget.handle}>
      <WidgetFrame widget={widget.handle} styles={styles}>
        <FooterKeyLabel binding={binding} compact={compact} />
      </WidgetFrame>
    </WidgetScope>
  );
});

export const Footer = observer(function Footer({
  id,
  classes,
  borderTitle,
  borderSubtitle,
  compact = false,
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
  const styles = useStyles(widget.handle);
  const bindings = useBindings(widget.handle).filter(
    (binding) => binding.description !== undefined && binding.description.length > 0,
  );

  return (
    <WidgetScope widget={widget.handle}>
      <WidgetFrame widget={widget.handle} styles={styles} boxProps={{ flexDirection: "row" }}>
        {bindings.map((binding) => (
          <FooterKey key={`${binding.namespace.key}:${binding.key}:${binding.action}`} binding={binding} compact={compact} />
        ))}
      </WidgetFrame>
    </WidgetScope>
  );
});
