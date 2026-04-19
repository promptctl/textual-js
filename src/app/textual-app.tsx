import React, { useLayoutEffect, useState, type PropsWithChildren } from "react";
import { Box, useInput, useStdout } from "ink";
import { observer } from "mobx-react-lite";
import { Padding } from "rich-js";

import { measureVisual, renderVisual, visualize } from "../content/index.js";
import { TextualFramework, type ActiveTooltip, type KeymapInput } from "../framework/app-framework.js";
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
  keymap?: KeymapInput;
  actions?: WidgetActions;
  autoFocus?: string | null;
  tooltipDelay?: number;
  showTooltips?: boolean;
}

function buildTooltipVisual(tooltip: ActiveTooltip) {
  // [LAW:single-enforcer] Tooltip chrome is injected at one render seam so
  // overlay padding/background survives both terminal paint and visual capture.
  return visualize(new Padding(tooltip.visual, [1, 2]));
}

function measureTooltip(tooltip: ActiveTooltip): { width: number; height: number } {
  const measurement = measureVisual(buildTooltipVisual(tooltip));
  return { width: measurement.width, height: measurement.height };
}

function clampTooltipPosition(
  framework: TextualFramework,
  tooltip: ActiveTooltip,
): { left: number; top: number } {
  const measurement = measureTooltip(tooltip);
  const maxLeft = Math.max(0, framework.terminalSize.width - measurement.width);
  const maxTop = Math.max(0, framework.terminalSize.height - measurement.height);

  return {
    left: Math.max(0, Math.min(maxLeft, tooltip.x)),
    top: Math.max(0, Math.min(maxTop, tooltip.y + 1)),
  };
}

const TooltipOverlay = observer(function TooltipOverlay(): React.JSX.Element | null {
  const framework = useTextual();
  const tooltip = framework.activeTooltip;

  if (tooltip === null || !tooltip.visible || !framework.showTooltips) {
    return null;
  }

  const position = clampTooltipPosition(framework, tooltip);
  const bubbleVisual = buildTooltipVisual(tooltip);

  // [LAW:single-enforcer] Tooltip visibility and content come from framework
  // state only; the view renders that canonical snapshot without re-deriving it.
  return (
    <Box
      position="absolute"
      marginLeft={position.left}
      marginTop={position.top}
    >
      {renderVisual(bubbleVisual, { backgroundColor: "#242f38" }, `tooltip:${tooltip.sourceNodeId}`)}
    </Box>
  );
});

const ToastOverlay = observer(function ToastOverlay(): React.JSX.Element | null {
  const framework = useTextual();
  const notifications = framework.showNotifications ? framework.notifications.list() : [];

  if (notifications.length === 0) {
    return null;
  }

  // [LAW:one-source-of-truth] Toast display renders directly from the app
  // notification collection; widgets never mount their own toast views.
  return (
    <Box
      position="absolute"
      flexDirection="column"
      marginLeft={Math.max(0, framework.terminalSize.width - 32)}
      marginTop={0}
      width={32}
    >
      {notifications.map((notification) => (
        <Box key={notification.identity}>
          {renderVisual(visualize(notification.message), {}, `toast:${notification.identity}`)}
        </Box>
      ))}
    </Box>
  );
});

const AppShell = observer(function AppShell({ children }: PropsWithChildren): React.JSX.Element {
  const framework = useTextual();
  const { stdout } = useStdout();
  const [, requestAfterRefresh] = useState(0);

  useInput((input, key) => {
    framework.postKey(input, key);
  });

  useLayoutEffect(() => {
    const syncTerminalSize = (): void => {
      framework.syncHostTerminalSize(new Size(stdout.columns ?? 80, stdout.rows ?? 24));
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
    <Box
      flexDirection="column"
      position="relative"
      width={framework.terminalSize.width}
      height={framework.terminalSize.height}
    >
      <Box flexDirection="column">{activeScreen ?? children}</Box>
      <ToastOverlay />
      <TooltipOverlay />
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
  keymap,
  actions,
  autoFocus,
  tooltipDelay,
  showTooltips,
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
    if (keymap !== undefined) {
      ownedFramework.setKeymap(keymap);
    }
  }, [keymap, ownedFramework]);

  useLayoutEffect(() => {
    ownedFramework.setAppActions(actions);
  }, [actions, ownedFramework]);

  useLayoutEffect(() => {
    ownedFramework.setAppAutoFocus(autoFocus);
  }, [autoFocus, ownedFramework]);

  useLayoutEffect(() => {
    ownedFramework.setTooltipDelay(tooltipDelay);
  }, [ownedFramework, tooltipDelay]);

  useLayoutEffect(() => {
    ownedFramework.setShowTooltips(showTooltips);
  }, [ownedFramework, showTooltips]);

  return (
    <TextualProvider framework={ownedFramework}>
      <AppShell>{children}</AppShell>
    </TextualProvider>
  );
});
