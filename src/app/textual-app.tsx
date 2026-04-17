import React, { useLayoutEffect, useState, type PropsWithChildren } from "react";
import { Box, useInput, useStdout } from "ink";
import { observer } from "mobx-react-lite";

import { TextualFramework } from "../framework/app-framework.js";
import { TextualProvider, useTextual } from "../framework/context.js";
import { Size } from "../geometry/index.js";
import type { BindingDeclaration } from "../bindings/index.js";
import type { WidgetActions } from "../framework/widget-registry.js";

export interface TextualAppProps extends PropsWithChildren {
  framework?: TextualFramework;
  onReady?: (framework: TextualFramework) => void;
  css?: string;
  stylesheet?: string;
  theme?: string;
  bindings?: BindingDeclaration[];
  actions?: WidgetActions;
  autoFocus?: string | null;
}

const AppShell = observer(function AppShell({ children }: PropsWithChildren): React.JSX.Element {
  const framework = useTextual();
  const { stdout } = useStdout();
  const [, requestAfterRefresh] = useState(0);

  useInput((input, key) => {
    framework.postKey(input, key);
  });

  useLayoutEffect(() => {
    const syncTerminalSize = (): void => {
      framework.setTerminalSize(new Size(stdout.columns ?? 80, stdout.rows ?? 24));
    };

    syncTerminalSize();
    stdout.on("resize", syncTerminalSize);

    return () => {
      stdout.off("resize", syncTerminalSize);
    };
  }, [framework, stdout]);

  useLayoutEffect(() => {
    framework.startup();

    return () => {
      framework.shutdown();
    };
  }, [framework]);

  useLayoutEffect(() => {
    return framework.attachAfterRefreshRequester(() => {
      requestAfterRefresh((value) => value + 1);
    });
  }, [framework]);

  useLayoutEffect(() => {
    framework.recordDisplayPass();
    framework.flushAfterRefreshCallbacks();
  });

  const activeScreen = framework.activeScreenElement;

  return (
    <Box flexDirection="column">
      {activeScreen ?? children}
    </Box>
  );
});

export const TextualApp = observer(function TextualApp({
  children,
  framework,
  onReady,
  css,
  stylesheet,
  theme,
  bindings,
  actions,
  autoFocus,
}: TextualAppProps): React.JSX.Element {
  const [ownedFramework] = useState(() => framework ?? new TextualFramework());

  useLayoutEffect(() => {
    onReady?.(ownedFramework);
  }, [onReady, ownedFramework]);

  useLayoutEffect(() => {
    ownedFramework.setUserStylesheet(css ?? stylesheet ?? "");
  }, [css, ownedFramework, stylesheet]);

  useLayoutEffect(() => {
    ownedFramework.setTheme(theme ?? "default");
  }, [ownedFramework, theme]);

  useLayoutEffect(() => {
    ownedFramework.setAppBindings(bindings ?? []);
  }, [bindings, ownedFramework]);

  useLayoutEffect(() => {
    ownedFramework.setAppActions(actions);
  }, [actions, ownedFramework]);

  useLayoutEffect(() => {
    ownedFramework.setAppAutoFocus(autoFocus);
  }, [autoFocus, ownedFramework]);

  return (
    <TextualProvider framework={ownedFramework}>
      <AppShell>{children}</AppShell>
    </TextualProvider>
  );
});
