import React, { useLayoutEffect, useState, type PropsWithChildren } from "react";
import { Box, useInput } from "ink";
import { observer } from "mobx-react-lite";

import { TextualFramework } from "../framework/app-framework.js";
import { TextualProvider, useTextual } from "../framework/context.js";

export interface TextualAppProps extends PropsWithChildren {
  framework?: TextualFramework;
  onReady?: (framework: TextualFramework) => void;
}

const AppShell = observer(function AppShell({ children }: PropsWithChildren): React.JSX.Element {
  const framework = useTextual();

  useInput((input, key) => {
    framework.postKey(input, key);
  });

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
}: TextualAppProps): React.JSX.Element {
  const [ownedFramework] = useState(() => framework ?? new TextualFramework());

  useLayoutEffect(() => {
    onReady?.(ownedFramework);
  }, [onReady, ownedFramework]);

  return (
    <TextualProvider framework={ownedFramework}>
      <AppShell>{children}</AppShell>
    </TextualProvider>
  );
});
