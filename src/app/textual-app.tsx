import React, { useLayoutEffect, useState, type PropsWithChildren } from "react";
import { Box, useInput, useStdout } from "ink";
import { observer } from "mobx-react-lite";

import { TextualFramework } from "../framework/app-framework.js";
import { TextualProvider, useTextual } from "../framework/context.js";
import { Size } from "../geometry/index.js";

export interface TextualAppProps extends PropsWithChildren {
  framework?: TextualFramework;
  onReady?: (framework: TextualFramework) => void;
  stylesheet?: string;
}

const AppShell = observer(function AppShell({ children }: PropsWithChildren): React.JSX.Element {
  const framework = useTextual();
  const { stdout } = useStdout();

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

  return <Box flexDirection="column">{children}</Box>;
});

export const TextualApp = observer(function TextualApp({
  children,
  framework,
  onReady,
  stylesheet,
}: TextualAppProps): React.JSX.Element {
  const [ownedFramework] = useState(() => framework ?? new TextualFramework());

  useLayoutEffect(() => {
    onReady?.(ownedFramework);
  }, [onReady, ownedFramework]);

  useLayoutEffect(() => {
    ownedFramework.setUserStylesheet(stylesheet ?? "");
  }, [ownedFramework, stylesheet]);

  return (
    <TextualProvider framework={ownedFramework}>
      <AppShell>{children}</AppShell>
    </TextualProvider>
  );
});
