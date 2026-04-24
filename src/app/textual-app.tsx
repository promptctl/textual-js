import React, { useLayoutEffect, useState, type PropsWithChildren } from "react";
import { Box, useInput, useStdout } from "ink";
import { observer } from "mobx-react-lite";
import { Padding } from "rich-js";

import { measureVisual, renderVisual, visualize } from "../content/index.js";
import {
  TextualFramework,
  type ActiveTooltip,
  type KeymapInput,
  type ScreenDescriptor,
  type SystemCommandResolver,
} from "../framework/app-framework.js";
import { TextualProvider, useTextual } from "../framework/context.js";
import { Size } from "../geometry/index.js";
import type { BindingDeclaration } from "../bindings/index.js";
import type { WidgetActions } from "../framework/widget-registry.js";
import type { ProviderConstructor } from "../commands/index.js";
import type { Notification } from "../services/notifications.js";
import { Color } from "../styles/color.js";

export interface TextualAppProps extends PropsWithChildren {
  framework: TextualFramework;
  onReady?: (framework: TextualFramework) => void;
  css?: string;
  stylesheet?: string;
  cssPath?: string | readonly string[];
  theme?: string;
  bindings?: BindingDeclaration[];
  keymap?: KeymapInput;
  actions?: WidgetActions;
  commandProviders?: Iterable<ProviderConstructor> | null;
  getSystemCommands?: SystemCommandResolver;
  screens?: Record<string, ScreenDescriptor | (() => React.ReactElement)>;
  modes?: Record<string, ScreenDescriptor | (() => React.ReactElement) | string>;
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
        <Box
          key={notification.identity}
          flexDirection="column"
          borderStyle="round"
          borderColor={getToastSeverityColor(framework, notification).css}
          paddingX={1}
          marginBottom={1}
        >
          {renderToastTitle(notification)}
          {renderVisual(
            visualize(notification.message, { markup: notification.markup }),
            {},
            `toast:${notification.identity}:${notification.severityClass}:message`,
          )}
        </Box>
      ))}
    </Box>
  );
});

function getToastSeverityColor(framework: TextualFramework, notification: Notification): Color {
  const severityColors = {
    "-information": framework.activeTheme.primary,
    "-warning": framework.activeTheme.warning,
    "-error": framework.activeTheme.error,
  };

  // [LAW:single-enforcer] Toast severity styling is selected from the
  // notification severity class once; the renderer consumes that class mapping.
  return severityColors[notification.severityClass as keyof typeof severityColors] ?? framework.activeTheme.primary;
}

function renderToastTitle(notification: Notification): React.JSX.Element | null {
  if (notification.title === "") {
    return null;
  }

  return renderVisual(
    visualize(notification.title, { markup: notification.markup }),
    { bold: true },
    `toast:${notification.identity}:${notification.severityClass}:title`,
  );
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
  cssPath,
  theme,
  bindings,
  keymap,
  actions,
  commandProviders,
  getSystemCommands,
  screens,
  modes,
  autoFocus,
  tooltipDelay,
  showTooltips,
}: TextualAppProps): React.JSX.Element {
  const [ownedFramework] = useState(() => framework);

  useLayoutEffect(() => {
    onReady?.(ownedFramework);
  }, [onReady, ownedFramework]);

  useLayoutEffect(() => {
    ownedFramework.setUserStylesheet(css ?? stylesheet ?? "");
  }, [css, ownedFramework, stylesheet]);

  useLayoutEffect(() => {
    if (cssPath !== undefined) {
      ownedFramework.setCssPath(cssPath);
    }
  }, [cssPath, ownedFramework]);

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
    ownedFramework.setAppCommandProviders(commandProviders);
  }, [commandProviders, ownedFramework]);

  useLayoutEffect(() => {
    ownedFramework.setSystemCommandResolver(getSystemCommands);
  }, [getSystemCommands, ownedFramework]);

  useLayoutEffect(() => {
    for (const [name, screen] of Object.entries(screens ?? {})) {
      if (!ownedFramework.isScreenInstalled(name)) {
        ownedFramework.installScreen(name, normalizeScreenFactory(screen, ownedFramework));
      }
    }
  }, [ownedFramework, screens]);

  useLayoutEffect(() => {
    for (const [name, screen] of Object.entries(modes ?? {})) {
      ownedFramework.addMode(name, normalizeScreenFactory(screen, ownedFramework));
    }
  }, [modes, ownedFramework]);

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

function normalizeScreenFactory(
  screen: ScreenDescriptor | (() => React.ReactElement) | string,
  framework: TextualFramework,
): () => React.ReactElement {
  if (typeof screen === "string") {
    return () => framework.getScreen(screen);
  }

  if (React.isValidElement(screen)) {
    throw new ValueError("SCREENS and MODES must contain screen classes or callables, not instances");
  }

  if (typeof screen !== "function") {
    throw new ValueError("SCREENS and MODES must contain screen classes, callables, or names");
  }

  return () => React.createElement(screen as React.ComponentType<Record<string, unknown>>);
}

export class ValueError extends Error {}
