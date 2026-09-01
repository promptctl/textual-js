// [LAW:single-enforcer] TextualApp is a thin host-bridge component: it wires
// React/Ink's runtime (mount, keyboard, stdout resize, render tick) to the
// App that owns the runtime, and synchronizes App's configuration props into
// service state. It is **not** the runtime authority — App is.
//
// Configuration writes (setUserStylesheet, setKeymap, setTheme, etc.) route
// through the `app` prop when supplied. Tests still construct
// <TextualApp framework={framework}> without an App; that legacy path uses
// `frameworkAsSink(framework)` so the same setter sequence reaches the
// framework directly. Both paths land on the same underlying services.
//
// AppShell and the overlays (TooltipOverlay, ToastOverlay) currently read
// runtime observables off the framework via the React context. That access
// is legacy: it preserves the bare-framework rendering path tests rely on
// until 7w9.10 deletes the framework class. App's getters delegate to the
// same observables, so the read values are identical regardless of which
// reference is used.
//
// What TextualApp does:
//   1. Identity capture — `useState(() => framework)` locks the framework
//      reference for this React subtree so a parent re-render with a
//      different prop doesn't swap runtimes mid-flight.
//   2. Host bridges — Ink → framework: keyboard (`useStdin → postKey`),
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

import { Buffer } from "node:buffer";
import React, { useEffect, useLayoutEffect, useRef, useState, type PropsWithChildren } from "react";
import { Box, useStdin, useStdout, type DOMElement } from "ink";
import { observer } from "mobx-react-lite";
import { Padding } from "rich-js";

import { measureVisual, renderVisual, visualize } from "../content/index.js";
import {
  type ActiveTooltip,
  type KeymapInput,
  type ScreenDescriptor,
  type SystemCommandResolver,
} from "../framework/_app-runtime.js";
import { TextualProvider, useTextual } from "../framework/context.js";
import { Size } from "../geometry/index.js";
import type { BindingDeclaration } from "../bindings/index.js";
import type { WidgetActions } from "../framework/widget-registry.js";
import type { ProviderConstructor } from "../commands/index.js";
import type { Notification } from "../services/notifications.js";
import { Color } from "../styles/color.js";
import type { App } from "./app.js";

export interface TextualAppProps extends PropsWithChildren {
  // [LAW:one-source-of-truth] App is the runtime authority; the host adapter
  // routes every runtime read/write through it.
  app: App;
  onReady?: (app: App) => void;
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
  app: App,
  tooltip: ActiveTooltip,
): { left: number; top: number } {
  const measurement = measureTooltip(tooltip);
  const maxLeft = Math.max(0, app.terminalSize.width - measurement.width);
  const maxTop = Math.max(0, app.terminalSize.height - measurement.height);

  return {
    left: Math.max(0, Math.min(maxLeft, tooltip.x)),
    top: Math.max(0, Math.min(maxTop, tooltip.y + 1)),
  };
}

const TooltipOverlay = observer(function TooltipOverlay(): React.JSX.Element | null {
  const app = useTextual();
  const tooltip = app.activeTooltip;

  if (tooltip === null || !tooltip.visible || !app.showTooltips) {
    return null;
  }

  const position = clampTooltipPosition(app, tooltip);
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
  const app = useTextual();
  const notifications = app.showNotifications ? app.notifications.list() : [];

  if (notifications.length === 0) {
    return null;
  }

  // [LAW:one-source-of-truth] Toast display renders directly from the app
  // notification collection; widgets never mount their own toast views.
  return (
    <Box
      position="absolute"
      flexDirection="column"
      marginLeft={Math.max(0, app.terminalSize.width - 32)}
      marginTop={0}
      width={32}
    >
      {notifications.map((notification) => (
        <Box
          key={notification.identity}
          flexDirection="column"
          borderStyle="round"
          borderColor={getToastSeverityColor(app, notification).css}
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

function getToastSeverityColor(app: App, notification: Notification): Color {
  const severityColors = {
    "-information": app.activeTheme.primary,
    "-warning": app.activeTheme.warning,
    "-error": app.activeTheme.error,
  };

  // [LAW:single-enforcer] Toast severity styling is selected from the
  // notification severity class once; the renderer consumes that class mapping.
  return severityColors[notification.severityClass as keyof typeof severityColors] ?? app.activeTheme.primary;
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

type ParsedTerminalKey = {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  option: boolean;
  sequence: string;
  raw: string | undefined;
  code?: string;
};

type HostKey = {
  input: string;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
};

const META_KEY_CODE = /^(?:\x1b)([a-zA-Z0-9])$/;
const FUNCTION_KEY_CODE = /^(?:\x1b+)(O|N|\[|\[\[)(?:(\d+)(?:;(\d+))?([~^$])|(?:1;)?(\d+)?([a-zA-Z]))/;

// [LAW:one-source-of-truth] Terminal escape-sequence names are canonicalized
// here before the framework's binding and Key-message grammar sees them.
const TERMINAL_CODE_TO_KEY_NAME = new Map<string, string>([
  ["OP", "f1"],
  ["OQ", "f2"],
  ["OR", "f3"],
  ["OS", "f4"],
  ["[11~", "f1"],
  ["[12~", "f2"],
  ["[13~", "f3"],
  ["[14~", "f4"],
  ["[[A", "f1"],
  ["[[B", "f2"],
  ["[[C", "f3"],
  ["[[D", "f4"],
  ["[[E", "f5"],
  ["[15~", "f5"],
  ["[17~", "f6"],
  ["[18~", "f7"],
  ["[19~", "f8"],
  ["[20~", "f9"],
  ["[21~", "f10"],
  ["[23~", "f11"],
  ["[24~", "f12"],
  ["[A", "up"],
  ["[B", "down"],
  ["[C", "right"],
  ["[D", "left"],
  ["[E", "clear"],
  ["[F", "end"],
  ["[H", "home"],
  ["OA", "up"],
  ["OB", "down"],
  ["OC", "right"],
  ["OD", "left"],
  ["OE", "clear"],
  ["OF", "end"],
  ["OH", "home"],
  ["[1~", "home"],
  ["[2~", "insert"],
  ["[3~", "delete"],
  ["[4~", "end"],
  ["[5~", "pageup"],
  ["[6~", "pagedown"],
  ["[[5~", "pageup"],
  ["[[6~", "pagedown"],
  ["[7~", "home"],
  ["[8~", "end"],
  ["[a", "up"],
  ["[b", "down"],
  ["[c", "right"],
  ["[d", "left"],
  ["[e", "clear"],
  ["[2$", "insert"],
  ["[3$", "delete"],
  ["[5$", "pageup"],
  ["[6$", "pagedown"],
  ["[7$", "home"],
  ["[8$", "end"],
  ["Oa", "up"],
  ["Ob", "down"],
  ["Oc", "right"],
  ["Od", "left"],
  ["Oe", "clear"],
  ["[2^", "insert"],
  ["[3^", "delete"],
  ["[5^", "pageup"],
  ["[6^", "pagedown"],
  ["[7^", "home"],
  ["[8^", "end"],
  ["[Z", "tab"],
]);

const SHIFT_KEY_CODES = new Set(["[a", "[b", "[c", "[d", "[e", "[2$", "[3$", "[5$", "[6$", "[7$", "[8$", "[Z"]);
const CTRL_KEY_CODES = new Set(["Oa", "Ob", "Oc", "Od", "Oe", "[2^", "[3^", "[5^", "[6^", "[7^", "[8^"]);
const NON_CHARACTER_KEY_NAMES = new Set([...TERMINAL_CODE_TO_KEY_NAME.values(), "backspace", "return", "enter", "tab", "escape", "delete"]);
const CANONICAL_HOST_KEY_NAMES = new Map<string, string>([
  ["return", "enter"],
  ["enter", "enter"],
]);

function parseTerminalKeypress(rawInput: Buffer | string = ""): ParsedTerminalKey {
  const source = normalizeRawKeypressInput(rawInput);
  let parts: RegExpExecArray | null;
  const key: ParsedTerminalKey = {
    name: "",
    ctrl: false,
    meta: false,
    shift: false,
    option: false,
    sequence: source,
    raw: source,
  };

  key.sequence = key.sequence || source || key.name;

  if (source === "\r") {
    key.raw = undefined;
    key.name = "return";
  } else if (source === "\n") {
    key.name = "enter";
  } else if (source === "\t") {
    key.name = "tab";
  } else if (source === "\b" || source === "\x1b\b") {
    key.name = "backspace";
    key.meta = source.charAt(0) === "\x1b";
  } else if (source === "\x7f" || source === "\x1b\x7f") {
    key.name = "delete";
    key.meta = source.charAt(0) === "\x1b";
  } else if (source === "\x1b" || source === "\x1b\x1b") {
    key.name = "escape";
    key.meta = source.length === 2;
  } else if (source === " " || source === "\x1b ") {
    key.name = "space";
    key.meta = source.length === 2;
  } else if (source.length === 1 && source <= "\x1a") {
    key.name = String.fromCharCode(source.charCodeAt(0) + "a".charCodeAt(0) - 1);
    key.ctrl = true;
  } else if (source.length === 1 && source >= "0" && source <= "9") {
    key.name = "number";
  } else if (source.length === 1 && source >= "a" && source <= "z") {
    key.name = source;
  } else if (source.length === 1 && source >= "A" && source <= "Z") {
    key.name = source.toLowerCase();
    key.shift = true;
  } else if ((parts = META_KEY_CODE.exec(source)) !== null) {
    key.name = parts[1]!.toLowerCase();
    key.meta = true;
    key.shift = /^[A-Z]$/.test(parts[1]!);
  } else if ((parts = FUNCTION_KEY_CODE.exec(source)) !== null) {
    const segments = [...source];
    const code = [parts[1], parts[2], parts[4], parts[6]].filter(Boolean).join("");
    const modifier = Number(parts[3] ?? parts[5] ?? 1) - 1;

    key.option = segments[0] === "\x1b" && segments[1] === "\x1b";
    key.ctrl = Boolean(modifier & 4);
    key.meta = Boolean(modifier & 10);
    key.shift = Boolean(modifier & 1);
    key.code = code;
    key.name = TERMINAL_CODE_TO_KEY_NAME.get(code) ?? "";
    key.shift = SHIFT_KEY_CODES.has(code) || key.shift;
    key.ctrl = CTRL_KEY_CODES.has(code) || key.ctrl;
  }

  return key;
}

function normalizeRawKeypressInput(rawInput: Buffer | string): string {
  if (Buffer.isBuffer(rawInput)) {
    const bytes = Buffer.from(rawInput);

    if (bytes[0] !== undefined && bytes[0] > 127 && bytes[1] === undefined) {
      bytes[0] -= 128;
      return `\x1b${String(bytes)}`;
    }

    return String(bytes);
  }

  return String(rawInput);
}

function resolveHostKey(rawInput: Buffer | string): HostKey {
  const keypress = parseTerminalKeypress(rawInput);
  const canonicalName = CANONICAL_HOST_KEY_NAMES.get(keypress.name) ?? keypress.name;
  const namedInput = canonicalName === "space" ? keypress.sequence : canonicalName;
  const baseInput = keypress.ctrl ? keypress.name : keypress.sequence;
  const input = NON_CHARACTER_KEY_NAMES.has(keypress.name) ? namedInput : stripLeadingMetaEscape(baseInput);

  return {
    input,
    ctrl: keypress.ctrl,
    shift: keypress.shift || isShiftedSingleCharacter(input),
    meta: keypress.meta || keypress.option,
  };
}

const BRACKETED_PASTE_START = "\x1b[200~";
const BRACKETED_PASTE_END = "\x1b[201~";

// [LAW:single-enforcer] Paste detection lives at one boundary: an Ink input
// event that is multi-character with no recognized escape sequence is paste,
// and bracketed-paste markers are stripped so the same path handles both
// terminals that enable bracketed-paste mode and those that do not.
function extractPasteText(rawInput: Buffer | string, parsedName: string): string | null {
  const source = normalizeRawKeypressInput(rawInput);

  if (source.startsWith(BRACKETED_PASTE_START)) {
    const end = source.endsWith(BRACKETED_PASTE_END) ? source.length - BRACKETED_PASTE_END.length : source.length;
    return source.slice(BRACKETED_PASTE_START.length, end);
  }

  if (source.length > 1 && parsedName === "") {
    return source;
  }

  return null;
}

function stripLeadingMetaEscape(input: string): string {
  return input.startsWith("\x1b") ? input.slice(1) : input;
}

function isShiftedSingleCharacter(input: string): boolean {
  return input.length === 1 && /[A-Z]/.test(input);
}

function shouldDispatchHostKey(key: HostKey, exitOnCtrlC: boolean): boolean {
  return !(key.input === "c" && key.ctrl && exitOnCtrlC);
}

// [LAW:parse-dont-validate] Returns the Ink root, or fails where the breakage
// is: a layout effect runs after React attaches refs, so a null here is a
// broken assumption about the commit phase, not a state to render around.
function inkRootOf(node: DOMElement | null): DOMElement {
  if (node === null) {
    throw new Error("AppShell's layout ref was not attached before its layout effect ran");
  }

  let current = node;

  while (current.parentNode !== undefined) {
    current = current.parentNode;
  }

  return current;
}

const AppShell = observer(function AppShell({ children }: PropsWithChildren): React.JSX.Element {
  const app = useTextual();
  const rootRef = useRef<DOMElement>(null);
  const { setRawMode, internal_eventEmitter, internal_exitOnCtrlC } = useStdin();
  const { stdout } = useStdout();
  const [, requestAfterRefresh] = useState(0);

  // [LAW:single-enforcer] Host → app keyboard bridge.
  useEffect(() => {
    setRawMode(true);

    return () => {
      setRawMode(false);
    };
  }, [setRawMode]);

  useEffect(() => {
    const handleData = (data: Buffer | string): void => {
      // [LAW:dataflow-not-control-flow] One pipeline: parse the raw input once,
      // then dispatch as Paste when the parser yields no key name for a
      // multi-character batch, otherwise dispatch as Key. Both paths run
      // unconditionally — only the value of `pasteText` selects which message
      // type the focused widget receives.
      const parsed = parseTerminalKeypress(data);
      const pasteText = extractPasteText(data, parsed.name);

      if (pasteText !== null) {
        app.postPaste(pasteText);
        return;
      }

      const key = resolveHostKey(data);

      if (shouldDispatchHostKey(key, internal_exitOnCtrlC)) {
        app.postKey(key.input, {
          ctrl: key.ctrl,
          shift: key.shift,
          meta: key.meta,
        });
      }
    };

    internal_eventEmitter.on("input", handleData);

    return () => {
      internal_eventEmitter.removeListener("input", handleData);
    };
  }, [app, internal_eventEmitter, internal_exitOnCtrlC]);

  // [LAW:single-enforcer] Host → app terminal-size bridge.
  useLayoutEffect(() => {
    const syncTerminalSize = (): void => {
      app.syncHostTerminalSize(new Size(stdout.columns ?? 80, stdout.rows ?? 24));
    };

    syncTerminalSize();
    stdout.on("resize", syncTerminalSize);

    return () => {
      stdout.off("resize", syncTerminalSize);
    };
  }, [app, stdout]);

  // [LAW:single-enforcer] React mount/unmount triggers app startup/shutdown.
  useLayoutEffect(() => {
    app.startup();

    return () => {
      app.shutdown();
    };
  }, [app]);

  useLayoutEffect(() => {
    return app.attachAfterRefreshRequester(() => {
      requestAfterRefresh((value) => value + 1);
    });
  }, [app]);

  // [LAW:one-source-of-truth] Ink's Yoga pass is what makes widget geometry
  // stale, so it is what numbers the passes. Chaining `onComputeLayout` on the
  // Ink root is the app-level wiring for that; widgets consume the number and
  // never install their own hook.
  useLayoutEffect(() => {
    return app.attachLayoutPassCounter(inkRootOf(rootRef.current));
  }, [app]);

  useLayoutEffect(() => {
    app.recordDisplayPass();
    app.flushAfterRefreshCallbacks();
  });

  const activeScreen = app.activeScreenElement;

  return (
    <Box
      ref={rootRef}
      flexDirection="column"
      position="relative"
      width={app.terminalSize.width}
      height={app.terminalSize.height}
    >
      <Box flexDirection="column">{activeScreen ?? children}</Box>
      <ToastOverlay />
      <TooltipOverlay />
    </Box>
  );
});

export const TextualApp = observer(function TextualApp({
  app,
  children,
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
  // [LAW:one-source-of-truth] App reference captured once for the life of
  // this React subtree.
  const [ownedApp] = useState(() => app);

  useLayoutEffect(() => {
    onReady?.(ownedApp);
  }, [onReady, ownedApp]);

  useLayoutEffect(() => {
    ownedApp.setUserStylesheet(css ?? stylesheet ?? "");
  }, [css, ownedApp, stylesheet]);

  useLayoutEffect(() => {
    if (cssPath !== undefined) {
      ownedApp.setCssPath(cssPath);
    }
  }, [cssPath, ownedApp]);

  useLayoutEffect(() => {
    ownedApp.setTheme(theme ?? "default");
  }, [ownedApp, theme]);

  useLayoutEffect(() => {
    ownedApp.setAppBindings(bindings ?? []);
  }, [bindings, ownedApp]);

  useLayoutEffect(() => {
    if (keymap !== undefined) {
      ownedApp.setKeymap(keymap);
    }
  }, [keymap, ownedApp]);

  useLayoutEffect(() => {
    ownedApp.setAppActions(actions);
  }, [actions, ownedApp]);

  useLayoutEffect(() => {
    ownedApp.setAppCommandProviders(commandProviders);
  }, [commandProviders, ownedApp]);

  useLayoutEffect(() => {
    ownedApp.setSystemCommandResolver(getSystemCommands);
  }, [getSystemCommands, ownedApp]);

  useLayoutEffect(() => {
    for (const [name, screen] of Object.entries(screens ?? {})) {
      if (!ownedApp.isScreenInstalled(name)) {
        ownedApp.installScreenFactory(name, normalizeScreenFactory(screen, ownedApp));
      }
    }
  }, [ownedApp, screens]);

  useLayoutEffect(() => {
    for (const [name, screen] of Object.entries(modes ?? {})) {
      ownedApp.addMode(name, normalizeScreenFactory(screen, ownedApp));
    }
  }, [modes, ownedApp]);

  useLayoutEffect(() => {
    ownedApp.setAppAutoFocus(autoFocus);
  }, [autoFocus, ownedApp]);

  useLayoutEffect(() => {
    ownedApp.setTooltipDelay(tooltipDelay);
  }, [ownedApp, tooltipDelay]);

  useLayoutEffect(() => {
    ownedApp.setShowTooltips(showTooltips);
  }, [ownedApp, showTooltips]);

  return (
    <TextualProvider app={ownedApp}>
      <AppShell>{children}</AppShell>
    </TextualProvider>
  );
});

function normalizeScreenFactory(
  screen: ScreenDescriptor | (() => React.ReactElement) | string,
  app: App,
): () => React.ReactElement {
  if (typeof screen === "string") {
    return () => app.getScreen(screen);
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
