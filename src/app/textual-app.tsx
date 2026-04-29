// [LAW:single-enforcer] TextualApp is a thin host-bridge component: it wires
// React/Ink's runtime (mount, keyboard, stdout resize, render tick) to the
// framework that App owns, and synchronizes App's configuration props into
// framework state. It is **not** the runtime authority — App is.
//
// What TextualApp does:
//   1. Identity capture — `useState(() => framework)` locks the framework
//      reference for this React subtree so a parent re-render with a
//      different prop doesn't swap runtimes mid-flight.
//   2. Host bridges — Ink → framework: keyboard (`useInput → postKey`),
//      stdout dimensions (`syncHostTerminalSize`), React mount/unmount
//      (`startup` / `shutdown`), refresh requester
//      (`attachAfterRefreshRequester`), per-render paint tick
//      (`recordDisplayPass` + `flushAfterRefreshCallbacks`).
//   3. Configuration sync — App's options arrive as props (passed by
//      `App.render()` from `App.appOptions`) and are pushed into the
//      framework via setters: stylesheet, css path, theme, bindings,
//      keymap, actions, command providers, system command resolver,
//      screens, modes, auto-focus, tooltip delay, show-tooltips.
//   4. Display rendering — overlays (`TooltipOverlay`, `ToastOverlay`)
//      and active-screen mounting (`framework.activeScreenElement ??
//      children`). All reads from framework state; no decisions made.
//
// What TextualApp does **not** do:
//   - It does not gate lifecycle. `startup`/`shutdown` are unconditional
//     reactions to React mount/unmount; they call the framework directly
//     because the framework is the implementation. `App.startup` /
//     `App.shutdown` provide the same entry for non-React callers.
//   - It does not decide active screen. The framework owns the screen
//     stack; TextualApp reads `activeScreenElement` and renders it (with
//     a `?? children` fallback for the standalone-component case).
//   - It does not create widget identity. Widgets register themselves via
//     `WidgetHost` through `framework.registry`.
//   - It does not branch on app state to alter behavior. Display branches
//     (tooltip visible? notifications empty?) only choose what to render
//     from canonical framework state — they never write back.
//
// `[LAW:one-source-of-truth]` App owns the configuration (`appOptions`),
// the framework owns runtime state, and TextualApp is the single
// React-side projection point that wires the two together. There is no
// alternate path from props to framework state and no second renderer.

import React, { useLayoutEffect, useState, type PropsWithChildren } from "react";
import { Box, useInput, useStdout, type Key as InkKey } from "ink";
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

// [LAW:one-source-of-truth] Map Ink's `Key` flags onto the framework's
// canonical key names. Special keys (tab, arrows, etc.) arrive from Ink with
// `input === ""` and the matching boolean set; the framework's
// `normalizeKeyName` only understands the canonical name.
const INK_FLAG_KEY_ORDER: Array<{ flag: keyof InkKey; name: string }> = [
  { flag: "tab", name: "tab" },
  { flag: "escape", name: "escape" },
  { flag: "return", name: "enter" },
  { flag: "backspace", name: "backspace" },
  { flag: "delete", name: "delete" },
  { flag: "upArrow", name: "up" },
  { flag: "downArrow", name: "down" },
  { flag: "leftArrow", name: "left" },
  { flag: "rightArrow", name: "right" },
  { flag: "pageUp", name: "pageup" },
  { flag: "pageDown", name: "pagedown" },
];

function resolveInkKeyName(input: string, key: InkKey): string {
  // [LAW:dataflow-not-control-flow] The flag table drives selection; the
  // function always walks the table and returns the first match (or input).
  const named = INK_FLAG_KEY_ORDER.find((entry) => key[entry.flag] === true);
  return named === undefined ? input : named.name;
}

const AppShell = observer(function AppShell({ children }: PropsWithChildren): React.JSX.Element {
  const framework = useTextual();
  const { stdout } = useStdout();
  const [, requestAfterRefresh] = useState(0);

  // [LAW:single-enforcer] Host → framework keyboard bridge. Ink's keypress
  // events enter the runtime at exactly this seam. Ink encodes special keys
  // (tab, escape, arrows, etc.) as boolean flags on the second arg with an
  // empty `input` string; the framework expects a canonical key name as the
  // first arg, so this seam translates Ink's flag-shaped key into the
  // framework's name-shaped key.
  useInput((input, key) => {
    framework.postKey(resolveInkKeyName(input, key), {
      ctrl: key.ctrl,
      shift: key.shift,
      meta: key.meta,
    });
  });

  // [LAW:single-enforcer] Host → framework terminal-size bridge. Stdout's
  // current dimensions and resize events enter the runtime at this seam.
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

  // [LAW:single-enforcer] React mount/unmount triggers framework
  // startup/shutdown. App.startup / App.shutdown are the manual-control
  // entry for the same operation; both paths land on framework's
  // implementation, so there is one runtime gate, not two.
  useLayoutEffect(() => {
    framework.startup();

    return () => {
      framework.shutdown();
    };
  }, [framework]);

  // [LAW:single-enforcer] React's setState is the runtime's after-refresh
  // trigger. Registered exactly once per framework instance.
  useLayoutEffect(() => {
    return framework.attachAfterRefreshRequester(() => {
      requestAfterRefresh((value) => value + 1);
    });
  }, [framework]);

  // [LAW:single-enforcer] Per-render paint tick. The framework's display
  // pass and queued after-refresh callbacks run unconditionally on every
  // React commit — variability lives in what the framework chooses to do
  // with that tick, not in whether the tick fires.
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
  // [LAW:one-source-of-truth] Framework reference is captured once for the
  // life of this React subtree. A parent re-render with a different
  // framework prop must not silently swap the runtime under our feet.
  const [ownedFramework] = useState(() => framework);

  useLayoutEffect(() => {
    onReady?.(ownedFramework);
  }, [onReady, ownedFramework]);

  // [LAW:one-source-of-truth] App.appOptions is the canonical configuration
  // source. The block of effects below pushes each option into framework
  // state. The framework's value is *derived* from App's options; consumers
  // should never write to framework state through any other path.
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
