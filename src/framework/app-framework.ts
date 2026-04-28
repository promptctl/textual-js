import "./mobx-config.js";

import React from "react";
import { existsSync, readFileSync, watch, type FSWatcher } from "node:fs";
import { threadId } from "node:worker_threads";
import { makeAutoObservable, runInAction } from "mobx";

import {
  AppBlur,
  AppFocus,
  Blur,
  Callback,
  Click,
  CloseMessages,
  Compose,
  DescendantBlur,
  DescendantFocus,
  Focus,
  Idle,
  Key,
  ModeChanged,
  Mount,
  MouseDown,
  MouseMove,
  MouseScrollDown,
  MouseScrollLeft,
  MouseScrollRight,
  MouseScrollUp,
  MouseUp,
  Notify,
  Paste,
  Ready,
  Resize,
  ScreenResume,
  ScreenSuspend,
  ScrollEvent,
  Timer,
  Unmount,
} from "../events/events.js";
import { Message, messageHandlerNames, type MessageConstructor } from "../events/message.js";
import {
  SkipAction,
  makeBindings,
  parseAction,
  type Binding,
  type BindingDeclaration,
} from "../bindings/index.js";
import { measureVisual, visualize, type Visual, type VisualInput } from "../content/index.js";
import { Size } from "../geometry/index.js";
import {
  Notification,
  Notifications,
  type NotificationContent,
  type NotificationSeverity,
  type NotificationInit,
} from "../services/notifications.js";
import { Signal } from "../services/signal.js";
import { ThemeManager, type ActiveTheme, type AnsiTheme, type ThemeDefinition } from "../services/theme.js";
import { ManagedTimer, type TimerCallback, type TimerOptions } from "../services/timer.js";
import {
  Worker,
  WorkerCancelled,
  WorkerFailed,
  WorkerManager,
  getCurrentWorker,
  type WorkerCallable,
  type WorkerOwner,
  type WorkerOptions,
} from "../services/worker.js";
import { RuntimeError, getActiveMessagePump, runWithActiveMessagePump } from "../services/concurrency.js";
import {
  parseTextualFeatures,
  type EnvironmentMap,
  type TextualFeatureState,
} from "../services/environment.js";
import {
  CommandPalette,
  CommandPaletteScreen,
  SimpleCommandProvider,
  SystemCommandsProvider,
  type CommandPaletteOptions,
  type Provider,
  type ProviderConstructor,
  type ProviderContext,
} from "../commands/index.js";
import {
  matchesSelector as selectorMatchesWidget,
  parseSelectorList,
  resolveStylesForWidget,
  type ParsedSelector,
  type ParsedStylesheet,
  parseTcss,
} from "../styles/index.js";
import { Widget } from "./widget.js";
import {
  discoverOnHandlers,
  getSelectorAttribute,
  resolveNamedHandler,
  type OnHandlerRegistration,
} from "./on.js";
import {
  WidgetRegistry,
  type WidgetActionCallback,
  type WidgetActions,
  type WidgetCheckAction,
  type WidgetHandlers,
  type WidgetMessageHandler,
} from "./widget-registry.js";
import {
  ScreenStackService,
  DEFAULT_MODE,
  normalizePushArgs,
  type ScreenStackDeps,
} from "./screen-stack-service.js";
import {
  MessagePump,
  type MessagePumpDeps,
  type MessageSubscriber,
  type PreventionSnapshot,
  type QueuedMessage,
  type DeferredCallback,
} from "./message-pump.js";

export interface RegisterWidgetOptions {
  nodeId: string;
  parentId: string | null;
  id?: string;
  classes: string[];
  typeName: string;
  handlersRef: { current: WidgetHandlers | undefined };
  actionsRef?: { current: WidgetActions | undefined };
  bindingsRef?: { current: Binding[] };
  focusable?: boolean;
  autoFocus?: boolean;
  defaultCss?: string;
  disabled?: boolean;
  loading?: boolean;
}

export interface RegisterWidgetTypeOptions {
  defaultCss?: string;
  scopedCss?: string;
  baseTypeNames?: string[];
  bindings?: Binding[];
  inheritCss?: boolean;
  inheritBindings?: boolean;
  componentClasses?: string[];
  inheritComponentClasses?: boolean;
  borderTitle?: string | null;
  borderSubtitle?: string | null;
  typeToken?: Function;
}

interface WidgetTypeState {
  typeName: string;
  defaultCss?: string;
  scopedCss?: string;
  baseTypeNames: string[];
  bindings: Binding[];
  inheritCss: boolean;
  inheritBindings: boolean;
  componentClasses: string[];
  inheritComponentClasses: boolean;
  borderTitle: string | null;
  borderSubtitle: string | null;
  typeToken?: Function;
  defaultStylesheet?: ParsedStylesheet;
  scopedStylesheet?: ParsedStylesheet;
}

export interface WidgetTypeMetadata {
  typeName: string;
  typeHierarchy: string[];
  defaultStylesheets: ParsedStylesheet[];
  bindings: Binding[];
  componentClasses: string[];
  borderTitle: string | null;
  borderSubtitle: string | null;
}

interface ScreenStylesheetState {
  css: string | null;
  cssPath: string[];
  scopedCss: boolean;
  scopeTypeName?: string;
  stylesheets: ParsedStylesheet[];
}

interface PendingPointerClick {
  targetId: string | null;
  canceled: boolean;
  downTime: number;
}

interface ClickChainState {
  targetId: string | null;
  chain: number;
  time: number;
}

export type KeymapInput = ReadonlyMap<string, string> | Record<string, string>;

export type ScreenDescriptor =
  | React.ReactElement
  | React.ComponentType<Record<string, unknown>>
  | string;

export interface ScreenOptions {
  name?: string;
  bindings?: BindingDeclaration[];
  actions?: WidgetActions;
  autoFocus?: string | null;
  css?: string;
  cssPath?: string | readonly string[];
  scopedCss?: boolean;
}

export interface Screen {
  id: string;
  name: string | null;
  element: React.ReactElement | null;
  bindings: Binding[];
  actions: WidgetActions | undefined;
  autoFocus: string | null;
  css: string | null;
  cssPath: string[];
  scopedCss: boolean;
  stylesheets: ParsedStylesheet[];
  implicit: boolean;
  savedFocusNodeId: string | null;
  commandProviders: ReadonlySet<ProviderConstructor>;
  // [LAW:one-source-of-truth] Structural focus address remains the canonical
  // restore token. savedFocusNodeId is a derived public snapshot for API users.
  lastFocusedAddress: FocusAddress | null;
  waiters: Array<(result: unknown) => void>;
  callback?: (result: unknown) => void;
}

export interface BindingNamespace {
  kind: "app" | "screen" | "widget";
  key: string;
  name: string | null;
  nodeId: string | null;
}

export interface BindingClash {
  key: string;
  bindings: Binding[];
}

export type { MessageSubscriber, PreventionSnapshot, DeferredCallback, QueuedMessage };
type AfterRefreshCallback = () => void;
type LayoutReader = () => void;

export interface AppSignals {
  theme_changed_signal: Signal<ActiveTheme>;
  app_suspend_signal: Signal<void>;
  app_resume_signal: Signal<void>;
  mode_change_signal: Signal<string>;
  screen_change_signal: Signal<Screen | null>;
  bindings_updated_signal: Signal<void>;
}

export interface PointerLocation {
  x: number;
  y: number;
}

export type PointerShape = "default" | "pointer" | "text" | "crosshair" | "move" | "not-allowed" | string;

export interface ActiveTooltip {
  sourceNodeId: string;
  visual: Visual;
  x: number;
  y: number;
  visible: boolean;
}

export interface ActiveBinding {
  key: string;
  action: string;
  description?: string;
  enabled: boolean;
  priority: boolean;
  namespace: BindingNamespace;
  run: () => boolean;
}

export type AnimationLevel = "full" | "basic" | "none";

export interface AppDriver {
  canSuspend: boolean;
  isHeadless: boolean;
  suspendApplicationMode: () => Promise<void> | void;
  resumeApplicationMode: () => Promise<void> | void;
}

export interface TextualFrameworkOptions {
  driver?: AppDriver;
  env?: EnvironmentMap;
  cssPath?: string | readonly string[];
}

export type SimpleCommand =
  | readonly [name: string, callback: () => void, helpText?: string]
  | {
      name: string;
      callback: () => void;
      helpText?: string;
    };

export interface NotifyOptions extends Pick<NotificationInit, "severity" | "timeout" | "title" | "markup"> {}

export interface SystemCommand {
  name: VisualInput;
  text?: string;
  helpText?: string;
  callback: () => void;
  discover: boolean;
}

export type SystemCommandResolver = (screen: Screen | null) => Iterable<SystemCommand>;

export class ScreenStackError extends Error {}

export class UnknownModeError extends Error {}

export class InvalidModeError extends Error {}

export class ActiveModeError extends Error {}

export class StylesheetError extends Error {}

export class DuplicateKeyHandlers extends Error {}

export class SuspendNotSupported extends Error {}

class HeadlessDriver implements AppDriver {
  readonly canSuspend = false;
  readonly isHeadless = true;

  suspendApplicationMode(): void {
    return undefined;
  }

  resumeApplicationMode(): void {
    return undefined;
  }
}

function normalizeCssSource(source: string | undefined): string | undefined {
  const normalizedSource = source?.trim();
  return normalizedSource === undefined || normalizedSource.length === 0 ? undefined : normalizedSource;
}

function normalizeCssPathSource(path: string | readonly string[] | undefined): string[] {
  if (path === undefined) {
    return [];
  }

  return typeof path === "string" ? [path] : [...path];
}

function normalizeNotifyOptions(
  severityOrOptions: NotificationSeverity | NotifyOptions,
  timeout: number,
  title: NotificationContent,
  markup: boolean,
): NotificationInit {
  if (typeof severityOrOptions === "object") {
    return {
      severity: severityOrOptions.severity,
      timeout: severityOrOptions.timeout,
      title: severityOrOptions.title,
      markup: severityOrOptions.markup,
    };
  }

  return { severity: severityOrOptions, timeout, title, markup };
}

function parseStylesheetOrThrow(
  source: string,
  options: { origin: "default" | "user"; scopeTypeName?: string; scopeMode?: "self" | "descendant" },
): ParsedStylesheet {
  try {
    return parseTcss(source, options);
  } catch (error) {
    throw new StylesheetError((error as Error).message, { cause: error as Error });
  }
}

function getMessageTypeDistance(message: Message, messageType: MessageConstructor): number | null {
  let currentConstructor: object | null = message.constructor;
  let distance = 0;

  while (currentConstructor !== null) {
    if (currentConstructor === messageType) {
      return distance;
    }

    currentConstructor = Object.getPrototypeOf(currentConstructor);
    distance += 1;
  }

  return null;
}

const SPECIAL_KEY_NAMES = new Map<string, string>([
  [" ", "space"],
  ["?", "question_mark"],
  ["$", "dollar_sign"],
  [",", "comma"],
  [".", "period"],
  ["~", "tilde"],
  ["_", "underscore"],
  ["-", "minus"],
  ["+", "plus"],
  ["=", "equals"],
  ["[", "left_square_bracket"],
  ["]", "right_square_bracket"],
  ["{", "left_curly_bracket"],
  ["}", "right_curly_bracket"],
  ["(", "left_parenthesis"],
  [")", "right_parenthesis"],
  ["/", "slash"],
  ["\\", "backslash"],
]);
const REVERSE_SPECIAL_KEY_NAMES = new Map<string, string>(
  Array.from(SPECIAL_KEY_NAMES.entries()).map(([character, name]) => [name, character]),
);

export function normalizeKeyName(key: string): { key: string; character: string | null } {
  const trimmedKey = key.trim();

  if (trimmedKey.includes("+")) {
    return { key: trimmedKey.toLowerCase(), character: null };
  }

  if (trimmedKey.length === 1) {
    return {
      key: SPECIAL_KEY_NAMES.get(trimmedKey) ?? trimmedKey.toLowerCase(),
      character: trimmedKey,
    };
  }

  return {
    key: trimmedKey.toLowerCase(),
    character: null,
  };
}

const KEY_NAME_ALIASES = new Map<string, string[]>([
  ["tab", ["tab", "ctrl_i"]],
  ["ctrl+i", ["ctrl_i", "tab"]],
  ["enter", ["enter", "return"]],
  ["escape", ["escape", "esc"]],
]);

const DISPLAY_KEY_NAMES = new Map<string, string>([
  ["delete", "del"],
]);

export function keyToCharacter(key: string): string | null {
  if (key.includes("+")) {
    return null;
  }

  return REVERSE_SPECIAL_KEY_NAMES.get(key) ?? (key.length === 1 ? key : null);
}

export function formatKey(key: string): string {
  return keyToCharacter(key) ?? key;
}

export function getKeyDisplay(key: string): string {
  const lowerKey = key.toLowerCase();
  const ctrlMatch = lowerKey.match(/^ctrl\+(.+)$/);

  if (ctrlMatch !== null) {
    const character = keyToCharacter(ctrlMatch[1] ?? "");
    return character === null ? lowerKey : `^${character}`;
  }

  return DISPLAY_KEY_NAMES.get(lowerKey) ?? formatKey(lowerKey);
}

function keyNameAliases(key: string): string[] {
  const normalizedKey = key.toLowerCase();
  const aliases = KEY_NAME_ALIASES.get(normalizedKey);

  if (aliases !== undefined) {
    return aliases;
  }

  return [normalizedKey.replace(/\+/g, "_")];
}

const APP_NAVIGATION_BINDINGS: BindingDeclaration[] = [
  { key: "tab", action: "app.focus_next" },
  { key: "shift+tab", action: "app.focus_previous" },
  { key: "ctrl+q", action: "app.quit", priority: true },
  { key: "ctrl+c", action: "app.quit" },
  { key: "ctrl+p", action: "app.command_palette" },
];

interface FocusAddress {
  path: number[];
  widgetId: string | null;
  typeName: string;
}

export class TextualFramework {
  static readonly CLICK_CHAIN_TIME_THRESHOLD = 0.5;

  readonly registry = new WidgetRegistry();
  readonly workers = new WorkerManager();
  readonly notifications = new Notifications();
  readonly themeManager = new ThemeManager();
  readonly driver: AppDriver;
  readonly features: TextualFeatureState["features"];
  readonly devtools: TextualFeatureState["devtools"];
  readonly debug: boolean;
  focusedNodeId: string | null = null;
  isRunning = false;
  exitResult: unknown = undefined;
  theme = "default";
  displayCount = 0;
  terminalSize = new Size(80, 24);
  private controlledTerminalSize: Size | null = null;
  captureUnhandledErrors = false;
  animationLevel: AnimationLevel = "full";
  // [LAW:single-enforcer] All screen-stack/mode/installed-screen state is owned
  // by ScreenStackService. Framework getters/setters below are thin delegators.
  readonly screenStack: ScreenStackService;
  // [LAW:single-enforcer] All message-queue/dispatch/prevention state is owned
  // by MessagePump. Framework methods below are thin delegators.
  readonly pump: MessagePump;
  private userStylesheets: ParsedStylesheet[] = [];
  private cssPath: string[] = [];
  private readonly widgetTypes = new Map<string, WidgetTypeState>();
  private readonly widgetTypeMetadata = new Map<string, WidgetTypeMetadata>();
  private readonly widgetTypeTokens = new Map<Function, string>();
  private readonly cssWatchers = new Map<string, FSWatcher>();
  private readonly screenStyleCache = new Map<unknown, ScreenStylesheetState>();
  private readonly timers = new Map<string, ManagedTimer>();
  private readonly afterRefreshCallbacks: AfterRefreshCallback[] = [];
  private readonly layoutReaders = new Map<string, LayoutReader>();
  private afterRefreshRequester: (() => void) | null = null;
  private appBindings: Binding[] = [];
  private appActions: WidgetActions | undefined = undefined;
  private appCommandProviders: ReadonlySet<ProviderConstructor> | null = null;
  private systemCommandResolver: SystemCommandResolver = () => [];
  private keymap = new Map<string, string[]>();
  private appAutoFocus: string | null = null;
  hoveredNodeId: string | null = null;
  showNotifications = true;
  showTooltips = true;
  tooltipDelay = 500;
  activeTooltip: ActiveTooltip | null = null;
  private isAppBlurred = false;
  private blurredFocusAddress: FocusAddress | null = null;
  private focusChangedWhileBlurred = false;
  private lastActionDispatchResult: ActionDispatchResult = "unhandled";
  private readonly bindingClashSignatures = new Map<string, string>();
  private lastPointerLocation: PointerLocation | null = null;
  pointerShape: PointerShape = "default";
  private focusTrapNodeId: string | null = null;
  private pendingPointerClick: PendingPointerClick | null = null;
  private lastClickChain: ClickChainState | null = null;
  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingError: unknown = null;
  private readonly signalRegistry = new Set<Signal<unknown>>();
  private readonly appThreadId = threadId;
  private readonly appWorkerOwner: WorkerOwner = {
    nodeId: "__app__",
    typeName: "App",
  };
  private isClosing = false;
  private readyMessagePosted = false;
  batchUpdateCount = 0;
  private pendingStyleRecalc = false;
  activeCommandPalette: CommandPalette | null = null;
  private publicApp: unknown = null;
  readonly signals: AppSignals;

  constructor(options: TextualFrameworkOptions = {}) {
    const featureState = parseTextualFeatures(options.env?.TEXTUAL ?? process.env.TEXTUAL ?? "");

    this.driver = options.driver ?? new HeadlessDriver();
    this.features = featureState.features;
    this.devtools = featureState.devtools;
    this.debug = featureState.debug;
    this.signals = {
      theme_changed_signal: this.createFrameworkSignal<ActiveTheme>(),
      app_suspend_signal: this.createFrameworkSignal<void>(),
      app_resume_signal: this.createFrameworkSignal<void>(),
      mode_change_signal: this.createFrameworkSignal<string>(),
      screen_change_signal: this.createFrameworkSignal<Screen | null>(),
      bindings_updated_signal: this.createFrameworkSignal<void>(),
    };

    // [LAW:single-enforcer] ScreenStackService is constructed with a narrow
    // deps interface — the framework supplies only the cross-cutting hooks the
    // service needs (style resolution, command-provider extraction). The
    // service does NOT receive a back-reference to the framework.
    const screenStackDeps: ScreenStackDeps = {
      readScreenStylesheetState: (element, options) => this.readScreenStylesheetState(element, options),
      readCommandProvidersFromElement: (element) => readCommandProvidersFromElement(element),
    };
    this.screenStack = new ScreenStackService(screenStackDeps);

    // [LAW:single-enforcer] MessagePump is constructed with a narrow deps
    // interface — the framework supplies only the cross-cutting hooks the
    // pump needs (handler resolution, key bindings, default-target resolution).
    // The pump does NOT receive a back-reference to the framework.
    const pumpDeps: MessagePumpDeps = {
      getWidget: (id) => this.registry.get(id),
      listWidgets: () => this.registry.list(),
      isRunning: () => this.isRunning,
      isClosing: () => this.isClosing,
      isInBatch: () => this.batchUpdateCount > 0,
      reportUnhandledError: (error) => this.reportUnhandledError(error),
      resolveHandlers: (handlers, message) => this.resolveHandlers(handlers, message),
      dispatchKeyHandler: (handlers, message) => this.dispatchKeyHandler(handlers, message),
      resolveBindingsForNode: (node) => this.resolveBindingsForNode(node),
      dispatchScreenKeyBindings: (key) => this.dispatchScreenKeyBindings(key),
      dispatchBindingActionForNode: (node, action) =>
        this.dispatchBindingAction(action, { actions: node.actions }),
      dispatchPriorityBindings: (key) => this.dispatchPriorityBindings(key),
      resolveDefaultDispatchTarget: () => this.resolveDefaultDispatchTarget(),
      clearPendingError: () => {
        runInAction(() => {
          this.pendingError = null;
        });
      },
      throwPendingError: () => this.throwPendingError(),
      normalizeAndComposeKey: (input, meta) => {
        const normalized = normalizeKeyName(input);
        return {
          fullKey: composeKeyWithModifiers(normalized.key, meta),
          character: normalized.character,
        };
      },
    };
    this.pump = new MessagePump(pumpDeps);

    this.appBindings = makeBindings(APP_NAVIGATION_BINDINGS);
    this.cssPath = typeof options.cssPath === "string" ? [options.cssPath] : [...(options.cssPath ?? [])];
    this.appActions = {
      action_focus_next: () => {
        this.focusNext();
      },
      action_focus_previous: () => {
        this.focusPrevious();
      },
      action_quit: () => {
        this.exit();
      },
      action_command_palette: () => {
        void this.openCommandPalette();
      },
    };

    makeAutoObservable(
      this,
      {
        widgetTypes: false,
        widgetTypeMetadata: false,
        widgetTypeTokens: false,
        cssWatchers: false,
        screenStyleCache: false,
        timers: false,
        afterRefreshCallbacks: false,
        layoutReaders: false,
        afterRefreshRequester: false,
        signals: false,
        signalRegistry: false,
        appWorkerOwner: false,
        driver: false,
        features: false,
        devtools: false,
        activeCommandPalette: false,
        workers: false,
        notifications: false,
        themeManager: false,
        screenStack: false,
        pump: false,
        appBindings: false,
        appActions: false,
        appCommandProviders: false,
        systemCommandResolver: false,
        keymap: false,
        tooltipTimer: false,
        lastActionDispatchResult: false,
        bindingClashSignatures: false,
        handleBindingsClash: false,
        focusTrapNodeId: false,
        publicApp: false,
      } as never,
      { autoBind: true },
    );
  }

  setAppBindings(declarations: Iterable<BindingDeclaration>): void {
    // [LAW:one-source-of-truth] App bindings are merged with navigation defaults
    // at one point; callers never assemble their own binding list.
    this.appBindings = makeBindings([...APP_NAVIGATION_BINDINGS, ...declarations]);
    this.notifyBindingsUpdated();
  }

  setKeymap(next: KeymapInput): void {
    // [LAW:one-source-of-truth] Runtime key remaps are canonicalized into one
    // internal keymap store; dispatch and footer consumers derive from it.
    this.keymap = normalizeKeymap(next);
    this.notifyBindingsUpdated();
  }

  updateKeymap(patch: KeymapInput): void {
    const next = new Map(this.keymap);

    for (const [bindingId, keys] of normalizeKeymap(patch).entries()) {
      next.set(bindingId, keys);
    }

    this.keymap = next;
    this.notifyBindingsUpdated();
  }

  setAppActions(actions: WidgetActions | undefined): void {
    const navigation: WidgetActions = {
      action_focus_next: () => {
        this.focusNext();
      },
      action_focus_previous: () => {
        this.focusPrevious();
      },
      action_quit: () => {
        this.exit();
      },
      action_command_palette: () => {
        void this.openCommandPalette();
      },
    };
    this.appActions = { ...navigation, ...(actions ?? {}) };
  }

  setAppAutoFocus(selector: string | null | undefined): void {
    this.appAutoFocus = selector ?? null;

    if (this.isRunning && !this.isAppBlurred && this.focusedNodeId === null) {
      this.scheduleActiveScreenFocusResolution(true);
    }
  }

  setAnimationLevel(level: AnimationLevel): void {
    // [LAW:single-enforcer] Animation policy is owned by the framework so
    // scroll-capable widgets derive behavior from one runtime setting.
    this.animationLevel = level;
  }

  setTooltipDelay(delayMs: number | null | undefined): void {
    this.tooltipDelay = delayMs ?? 500;
  }

  setShowTooltips(enabled: boolean | null | undefined): void {
    this.showTooltips = enabled ?? true;

    if (!this.showTooltips) {
      this.hideTooltip();
      return;
    }

    this.refreshTooltipFromHover();
  }

  setShowNotifications(enabled: boolean | null | undefined): void {
    this.showNotifications = enabled ?? true;
  }

  setPointerShape(shape: PointerShape): void {
    this.pointerShape = shape;
  }

  setControlledTerminalSize(size: Size | null): void {
    this.controlledTerminalSize = size;

    if (size !== null) {
      this.setTerminalSize(size);
    }
  }

  syncHostTerminalSize(size: Size): void {
    this.setTerminalSize(this.controlledTerminalSize ?? size);
  }

  setCaptureUnhandledErrors(enabled: boolean): void {
    this.captureUnhandledErrors = enabled;
  }

  reportUnhandledError(error: unknown): void {
    if (!this.captureUnhandledErrors) {
      return;
    }

    if (this.pendingError === null) {
      runInAction(() => {
        this.pendingError = error;
      });
    }
  }

  throwPendingError(): void {
    if (this.pendingError !== null) {
      const error = this.pendingError;
      runInAction(() => {
        this.pendingError = null;
      });
      throw error;
    }
  }

  handleBindingsClash(_clashes: BindingClash[], _namespace: BindingNamespace): void {
    // Default no-op; apps may override to surface clashes.
  }

  preventMessages<T>(
    targetId: string | null,
    messageTypes: MessageConstructor[],
    callback: () => T,
  ): T {
    return this.pump.preventMessages(targetId, messageTypes, callback);
  }

  batchUpdate<T>(callback: () => T): T {
    runInAction(() => {
      this.batchUpdateCount += 1;
    });

    try {
      return runInAction(() => callback());
    } finally {
      runInAction(() => {
        this.batchUpdateCount = Math.max(0, this.batchUpdateCount - 1);
      });

      if (this.batchUpdateCount === 0) {
        // [LAW:single-enforcer] Batched style and queue flushes resume only
        // from the outermost batch boundary instead of each nested caller.
        if (this.pendingStyleRecalc) {
          this.pendingStyleRecalc = false;
          this.recalculateStyles();
        }

        this.pump.onBatchExit();
      }
    }
  }

  disableMessages(targetId: string | null, messageTypes: MessageConstructor[]): void {
    this.pump.disableMessages(targetId, messageTypes);
  }

  enableMessages(targetId: string | null, messageTypes: MessageConstructor[]): void {
    this.pump.enableMessages(targetId, messageTypes);
  }

  startup(): void {
    if (this.isRunning) {
      return;
    }

    this.isClosing = false;
    this.pump.reopenAppQueue();
    this.isRunning = true;
    this.signals.app_resume_signal.publish(undefined);

    for (const widget of this.registry.list()) {
      this.pump.enqueueLifecycleMessages(widget);
    }

    if (this.focusedNodeId === null) {
      this.scheduleActiveScreenFocusResolution(true);
    }

    if (!this.readyMessagePosted) {
      this.readyMessagePosted = true;
      this.pump.emitBroadcast(new Ready());
    }
  }

  shutdown(): void {
    this.isClosing = true;
    this.pump.closeAllMessageQueues(false);
    this.batchUpdateCount = 0;
    this.pendingStyleRecalc = false;
    this.pump.resetBatchPending();
    this.pump.discardQueuedCallbacks();
    this.focusedNodeId = null;
    this.hoveredNodeId = null;
    this.workers.cancelAll();
    this.clearAllTimers();
    this.clearTooltipTimer();
    this.activeTooltip = null;
    this.lastPointerLocation = null;
    this.pendingPointerClick = null;
    this.lastClickChain = null;
    for (const watcher of this.cssWatchers.values()) {
      watcher.close();
    }
    this.cssWatchers.clear();
    this.isAppBlurred = false;
    this.blurredFocusAddress = null;
    this.focusChangedWhileBlurred = false;
    this.isRunning = false;
    this.pump.emitCloseMessages();
    this.signals.app_suspend_signal.publish(undefined);
  }

  exit(result?: unknown): unknown {
    this.exitResult = result;
    this.shutdown();
    return result;
  }

  private invalidateWidgetTypeMetadata(): void {
    this.widgetTypeMetadata.clear();
  }

  private buildWidgetTypeMetadata(typeName: string, visiting = new Set<string>()): WidgetTypeMetadata {
    const existing = this.widgetTypeMetadata.get(typeName);

    if (existing !== undefined) {
      return existing;
    }

    if (visiting.has(typeName)) {
      throw new Error(`Circular widget type inheritance for "${typeName}"`);
    }

    visiting.add(typeName);
    const state = this.widgetTypes.get(typeName) ?? {
      typeName,
      baseTypeNames: [],
      bindings: [],
      inheritCss: true,
      inheritBindings: true,
      componentClasses: [],
      inheritComponentClasses: true,
      borderTitle: null,
      borderSubtitle: null,
    };
    const inheritedToken = state.typeToken === undefined ? undefined : Object.getPrototypeOf(state.typeToken);
    const inferredBaseTypeName =
      typeof inheritedToken?.name === "string" && inheritedToken.name.length > 0 && inheritedToken.name !== "Function"
        ? this.widgetTypeTokens.get(inheritedToken) ?? inheritedToken.name
        : undefined;
    const baseTypeNames = [
      ...new Set([...state.baseTypeNames, ...(inferredBaseTypeName === undefined ? [] : [inferredBaseTypeName])]),
    ];
    const baseMetadata = baseTypeNames.map((baseTypeName) => this.buildWidgetTypeMetadata(baseTypeName, visiting));
    const inheritedCss = state.inheritCss ? baseMetadata.flatMap((metadata) => metadata.defaultStylesheets) : [];
    const inheritedBindings = state.inheritBindings ? baseMetadata.flatMap((metadata) => metadata.bindings) : [];
    const inheritedComponentClasses = state.inheritComponentClasses
      ? baseMetadata.flatMap((metadata) => metadata.componentClasses)
      : [];
    const typeHierarchy = [
      ...new Set([
        ...baseMetadata.flatMap((metadata) => metadata.typeHierarchy),
        ...(state.typeToken?.name === undefined || state.typeToken.name.length === 0 ? [] : [state.typeToken.name]),
        typeName,
      ]),
    ];
    const metadata: WidgetTypeMetadata = {
      typeName,
      typeHierarchy,
      defaultStylesheets: [
        ...inheritedCss,
        ...(state.defaultStylesheet === undefined ? [] : [state.defaultStylesheet]),
        ...(state.scopedStylesheet === undefined ? [] : [state.scopedStylesheet]),
      ],
      bindings: [...inheritedBindings, ...state.bindings],
      componentClasses: [...new Set([...inheritedComponentClasses, ...state.componentClasses])],
      borderTitle: state.borderTitle ?? baseMetadata.at(-1)?.borderTitle ?? null,
      borderSubtitle: state.borderSubtitle ?? baseMetadata.at(-1)?.borderSubtitle ?? null,
    };

    visiting.delete(typeName);
    this.widgetTypeMetadata.set(typeName, metadata);
    return metadata;
  }

  getWidgetTypeMetadata(typeName: string): WidgetTypeMetadata {
    return this.buildWidgetTypeMetadata(typeName);
  }

  widgetMatchesType(typeName: string, expectedTypeName: string): boolean {
    return this.getWidgetTypeMetadata(typeName).typeHierarchy.includes(expectedTypeName);
  }

  resolveWidgetTypeName(typeConstraint: string | Function): string {
    if (typeof typeConstraint === "string") {
      return typeConstraint;
    }

    const registered = this.widgetTypeTokens.get(typeConstraint);

    return registered ?? typeConstraint.name;
  }

  registerWidgetType(typeName: string, defaultCss?: string): void;
  registerWidgetType(typeName: string, options?: RegisterWidgetTypeOptions): void;
  registerWidgetType(typeName: string, options: string | RegisterWidgetTypeOptions = {}): void {
    const normalizedOptions = typeof options === "string" ? { defaultCss: options } : options;
    const typeSource = normalizedOptions.typeToken as Partial<{
      DEFAULT_CSS: string;
      SCOPED_CSS: string;
      COMPONENT_CLASSES: readonly string[];
      BORDER_TITLE: string | null;
      BORDER_SUBTITLE: string | null;
      inheritCss: boolean;
      inheritBindings: boolean;
      inheritComponentClasses: boolean;
      BINDINGS: Iterable<BindingDeclaration>;
    }> | undefined;
    const normalizedDefaultCss = normalizeCssSource(normalizedOptions.defaultCss ?? typeSource?.DEFAULT_CSS);
    const normalizedScopedCss = normalizeCssSource(normalizedOptions.scopedCss ?? typeSource?.SCOPED_CSS);
    const existing = this.widgetTypes.get(typeName);
    const normalizedBindings = [
      ...makeBindings(typeSource?.BINDINGS ?? []),
      ...(normalizedOptions.bindings ?? []),
    ];
    const inheritedToken = normalizedOptions.typeToken === undefined ? undefined : Object.getPrototypeOf(normalizedOptions.typeToken);
    const inferredBaseTypeName =
      typeof inheritedToken?.name === "string" && inheritedToken.name.length > 0 && inheritedToken.name !== "Function"
        ? this.widgetTypeTokens.get(inheritedToken) ?? inheritedToken.name
        : undefined;
    const normalizedBaseTypeNames = [
      ...new Set([...(normalizedOptions.baseTypeNames ?? []), ...(inferredBaseTypeName === undefined ? [] : [inferredBaseTypeName])]),
    ];

    if (existing === undefined) {
      this.widgetTypes.set(typeName, {
        typeName,
        defaultCss: normalizedDefaultCss,
        scopedCss: normalizedScopedCss,
        baseTypeNames: normalizedBaseTypeNames,
        bindings: normalizedBindings,
        inheritCss: normalizedOptions.inheritCss ?? typeSource?.inheritCss ?? true,
        inheritBindings: normalizedOptions.inheritBindings ?? typeSource?.inheritBindings ?? true,
        componentClasses: [...(normalizedOptions.componentClasses ?? typeSource?.COMPONENT_CLASSES ?? [])],
        inheritComponentClasses: normalizedOptions.inheritComponentClasses ?? typeSource?.inheritComponentClasses ?? true,
        borderTitle: normalizedOptions.borderTitle ?? typeSource?.BORDER_TITLE ?? null,
        borderSubtitle: normalizedOptions.borderSubtitle ?? typeSource?.BORDER_SUBTITLE ?? null,
        typeToken: normalizedOptions.typeToken,
        defaultStylesheet:
          normalizedDefaultCss === undefined
            ? undefined
            : parseStylesheetOrThrow(normalizedDefaultCss, {
                origin: "default",
                scopeTypeName: typeName,
              }),
        scopedStylesheet:
          normalizedScopedCss === undefined
            ? undefined
            : parseStylesheetOrThrow(normalizedScopedCss, {
                origin: "default",
              }),
      });
      if (normalizedOptions.typeToken !== undefined) {
        this.widgetTypeTokens.set(normalizedOptions.typeToken, typeName);
      }
      this.invalidateWidgetTypeMetadata();

      return;
    }

    const sameRegistration =
      (normalizedDefaultCss === undefined || existing.defaultCss === normalizedDefaultCss) &&
      (normalizedScopedCss === undefined || existing.scopedCss === normalizedScopedCss) &&
      existing.inheritCss === (normalizedOptions.inheritCss ?? typeSource?.inheritCss ?? true) &&
      existing.inheritBindings === (normalizedOptions.inheritBindings ?? typeSource?.inheritBindings ?? true) &&
      existing.inheritComponentClasses === (normalizedOptions.inheritComponentClasses ?? typeSource?.inheritComponentClasses ?? true) &&
      JSON.stringify(existing.baseTypeNames) === JSON.stringify(normalizedBaseTypeNames) &&
      JSON.stringify(existing.bindings) === JSON.stringify(normalizedBindings) &&
      JSON.stringify(existing.componentClasses) === JSON.stringify(normalizedOptions.componentClasses ?? typeSource?.COMPONENT_CLASSES ?? []) &&
      existing.borderTitle === (normalizedOptions.borderTitle ?? typeSource?.BORDER_TITLE ?? null) &&
      existing.borderSubtitle === (normalizedOptions.borderSubtitle ?? typeSource?.BORDER_SUBTITLE ?? null);

    if (sameRegistration) {
      if (normalizedOptions.typeToken !== undefined) {
        this.widgetTypeTokens.set(normalizedOptions.typeToken, typeName);
      }
      return;
    }

    if (
      (normalizedDefaultCss !== undefined && existing.defaultCss !== undefined && existing.defaultCss !== normalizedDefaultCss) ||
      (normalizedScopedCss !== undefined && existing.scopedCss !== undefined && existing.scopedCss !== normalizedScopedCss)
    ) {
      // [LAW:one-source-of-truth] Widget type metadata is canonical per type.
      // Conflicting registrations fail instead of letting mount order decide.
      throw new Error(`Widget type "${typeName}" registered with conflicting DEFAULT_CSS`);
    }

    existing.defaultCss = existing.defaultCss ?? normalizedDefaultCss;
    existing.scopedCss = existing.scopedCss ?? normalizedScopedCss;
    existing.defaultStylesheet =
      existing.defaultStylesheet ??
      (normalizedDefaultCss === undefined
        ? undefined
        : parseStylesheetOrThrow(normalizedDefaultCss, {
            origin: "default",
            scopeTypeName: typeName,
          }));
    existing.scopedStylesheet =
      existing.scopedStylesheet ??
      (normalizedScopedCss === undefined
        ? undefined
        : parseStylesheetOrThrow(normalizedScopedCss, {
            origin: "default",
          }));
    existing.baseTypeNames = normalizedBaseTypeNames;
    existing.bindings = normalizedBindings;
    existing.inheritCss = normalizedOptions.inheritCss ?? typeSource?.inheritCss ?? true;
    existing.inheritBindings = normalizedOptions.inheritBindings ?? typeSource?.inheritBindings ?? true;
    existing.componentClasses = [...(normalizedOptions.componentClasses ?? typeSource?.COMPONENT_CLASSES ?? [])];
    existing.inheritComponentClasses = normalizedOptions.inheritComponentClasses ?? typeSource?.inheritComponentClasses ?? true;
    existing.borderTitle = normalizedOptions.borderTitle ?? typeSource?.BORDER_TITLE ?? existing.borderTitle;
    existing.borderSubtitle = normalizedOptions.borderSubtitle ?? typeSource?.BORDER_SUBTITLE ?? existing.borderSubtitle;
    existing.typeToken = normalizedOptions.typeToken ?? existing.typeToken;
    if (existing.typeToken !== undefined) {
      this.widgetTypeTokens.set(existing.typeToken, typeName);
    }
    this.invalidateWidgetTypeMetadata();

    if (this.isRunning) {
      this.recalculateStyles();
    }
  }

  registerWidget(widget: Widget): void {
    this.pump.reopenWidgetQueue(widget.nodeId);
    this.registry.register(widget);

    if (widget.autoFocus) {
      this.focusWidget(widget.nodeId);
    }

    this.recalculateStyles();

    if (this.isRunning) {
      // [LAW:single-enforcer] When running, the Mount dispatch (line ~3380)
      // is the single point that marks the widget ready — after onMount
      // handlers complete. Marking ready synchronously here would let
      // children render before mount lifecycle finishes.
      this.pump.enqueueLifecycleMessages(widget);
    } else {
      // Not yet running: startup() will enqueue Mount for every
      // already-registered widget, and Mount dispatch will mark them
      // ready. Until then the widget is registered but not ready.
    }
  }

  notifyWillUnmount(widget: Widget): void {
    this.pump.markWidgetUnmounting(widget.nodeId);
    this.workers.cancelNode(widget.nodeId);
    this.clearNodeTimers(widget.nodeId);
    this.handleWidgetWillUnmount(widget);
    this.pump.closeMessageQueue(widget.nodeId);

    void this.pump.dispatchUnmountImmediate(widget, new Unmount({ bubble: false }));
  }

  unregisterWidget(nodeId: string): void {
    const hadFocus = this.focusedNodeId === nodeId;

    if (this.hoveredNodeId === nodeId) {
      this.hoveredNodeId = null;
    }

    if (this.focusTrapNodeId === nodeId) {
      this.focusTrapNodeId = null;
    }

    this.registry.deregister(nodeId);
    // [LAW:single-enforcer] Unmount-driven signal cleanup runs here so every
    // widget removal prunes subscriptions through the same lifecycle seam.
    for (const signal of this.signalRegistry) {
      signal.pruneNode(nodeId);
    }
    this.pump.markWidgetClosed(nodeId);
    this.recalculateStyles();

    if (hadFocus) {
      // [LAW:single-enforcer] Focus recovery after removal enters through the
      // framework focus boundary rather than direct widget mutation.
      this.applyFocusChange(this.getFocusChain()[0]?.nodeId ?? null, { markBlurOverride: true });
    }
  }

  focusWidget(nodeId: string | null): void {
    this.applyFocusChange(nodeId, { markBlurOverride: true });
  }

  clearFocusWithin(container: Widget): void {
    const focused = this.focusedNodeId === null ? undefined : this.registry.get(this.focusedNodeId);

    if (focused === undefined) {
      return;
    }

    let current: Widget | undefined = focused;

    while (current !== undefined) {
      if (current.nodeId === container.nodeId) {
        this.focusWidget(null);
        return;
      }

      current = current.parent;
    }
  }

  trapFocus(widget: Widget, enabled = true): void {
    if (enabled && this.focusedNodeId !== null && this.isNodeWithin(this.registry.get(this.focusedNodeId), widget)) {
      this.focusTrapNodeId = widget.nodeId;
      this.notifyBindingsUpdated();
      return;
    }

    if (!enabled && this.focusTrapNodeId === widget.nodeId) {
      this.focusTrapNodeId = null;
      this.notifyBindingsUpdated();
    }
  }

  getFocusChain(): Widget[] {
    const trap = this.focusTrapNodeId === null ? undefined : this.registry.get(this.focusTrapNodeId);

    return this.registry.list().filter((widget) => {
      const insideTrap = trap === undefined || this.isNodeWithin(widget, trap);
      const ancestorsAllowFocus = this.ancestorsAllowFocus(widget);
      return insideTrap && ancestorsAllowFocus && widget.allowFocus();
    });
  }

  focusNext(selector?: string | Function): Widget | null {
    return this.moveFocus(1, selector);
  }

  focusPrevious(selector?: string | Function): Widget | null {
    return this.moveFocus(-1, selector);
  }

  private moveFocus(direction: 1 | -1, selector?: string | Function): Widget | null {
    const chain = this.filterFocusChain(selector);

    if (chain.length === 0) {
      this.focusWidget(null);
      return null;
    }

    const currentIndex = this.focusedNodeId === null ? -1 : chain.findIndex((widget) => widget.nodeId === this.focusedNodeId);
    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : chain.length - 1
        : (currentIndex + direction + chain.length) % chain.length;
    const next = chain[nextIndex];

    this.focusWidget(next.nodeId);
    return next;
  }

  setTerminalSize(size: Size): void {
    if (this.terminalSize.equals(size)) {
      return;
    }

    this.terminalSize = size;
    this.recalculateStyles();
  }

  setUserStylesheet(source: string): void {
    this.userStylesheets = source.trim().length === 0 ? [] : [parseStylesheetOrThrow(source, { origin: "user" })];
    this.recalculateStyles();
  }

  setCssPath(path: string | readonly string[]): void {
    this.cssPath = typeof path === "string" ? [path] : [...path];
    this.refreshCssWatchers();
    this._on_css_change();
  }

  private getWatchedCssPaths(): string[] {
    const screenPaths = [...this.screenStack.iterAllStacks()].flatMap((stack) => stack.flatMap((entry) => entry.cssPath));
    return [...new Set([...this.cssPath, ...screenPaths])];
  }

  private parseScreenStylesheetState(state: Omit<ScreenStylesheetState, "stylesheets">): ScreenStylesheetState {
    const stylesheets = [
      ...(state.css === null
        ? []
        : [
            parseStylesheetOrThrow(state.css, {
              origin: "user",
              scopeTypeName: state.scopedCss ? state.scopeTypeName : undefined,
              scopeMode: "descendant",
            }),
          ]),
      ...state.cssPath
        .filter((path) => existsSync(path))
        .map((path) =>
          parseStylesheetOrThrow(readFileSync(path, "utf8"), {
            origin: "user",
            scopeTypeName: state.scopedCss ? state.scopeTypeName : undefined,
            scopeMode: "descendant",
          }),
        ),
    ];

    return {
      ...state,
      stylesheets,
    };
  }

  private readScreenStylesheetState(
    element: React.ReactElement,
    options: ScreenOptions,
  ): ScreenStylesheetState {
    const screenType = element.type as {
      CSS?: string;
      CSS_PATH?: string | readonly string[];
      SCOPED_CSS?: boolean;
      name?: string;
    };
    const css = normalizeCssSource(options.css ?? screenType.CSS) ?? null;
    const cssPath = normalizeCssPathSource(options.cssPath ?? screenType.CSS_PATH);
    const scopedCss = options.scopedCss ?? screenType.SCOPED_CSS ?? true;
    const scopeTypeName =
      scopedCss && typeof screenType.name === "string" && screenType.name.length > 0 ? screenType.name : undefined;
    const cacheKey = element.type;
    const cached = this.screenStyleCache.get(cacheKey);

    if (
      cached !== undefined &&
      cached.css === css &&
      cached.scopedCss === scopedCss &&
      JSON.stringify(cached.cssPath) === JSON.stringify(cssPath) &&
      cached.scopeTypeName === scopeTypeName
    ) {
      return cached;
    }

    const parsed = this.parseScreenStylesheetState({
      css,
      cssPath,
      scopedCss,
      scopeTypeName,
    });
    this.screenStyleCache.set(cacheKey, parsed);
    return parsed;
  }

  private refreshScreenStylesheets(): void {
    for (const [cacheKey, cached] of this.screenStyleCache.entries()) {
      try {
        this.screenStyleCache.set(cacheKey, this.parseScreenStylesheetState(cached));
      } catch {
        continue;
      }
    }

    for (const stack of this.screenStack.iterAllStacks()) {
      for (const entry of stack) {
        if (entry.implicit || entry.element === null) {
          continue;
        }

        const cached = this.screenStyleCache.get(entry.element.type);

        if (cached !== undefined) {
          entry.css = cached.css;
          entry.cssPath = cached.cssPath;
          entry.scopedCss = cached.scopedCss;
          entry.stylesheets = cached.stylesheets;
        }
      }
    }
  }

  private refreshCssWatchers(): void {
    const watchedPaths = new Set(this.debug ? this.getWatchedCssPaths() : []);

    for (const [path, watcher] of this.cssWatchers.entries()) {
      if (!watchedPaths.has(path)) {
        watcher.close();
        this.cssWatchers.delete(path);
      }
    }

    for (const path of watchedPaths) {
      if (this.cssWatchers.has(path)) {
        continue;
      }

      try {
        const watcher = watch(path, () => {
          this._on_css_change();
        });
        this.cssWatchers.set(path, watcher);
      } catch {
        continue;
      }
    }
  }

  _on_css_change(): void {
    let stylesheets: ParsedStylesheet[];

    try {
      stylesheets = this.cssPath.filter((path) => existsSync(path)).map((path) => {
        return parseStylesheetOrThrow(readFileSync(path, "utf8"), { origin: "user" });
      });
    } catch {
      return;
    }

    // [LAW:one-source-of-truth] CSS_PATH files are parsed into the same
    // userStylesheets list consumed by cascade resolution and hot reload.
    this.userStylesheets = stylesheets;
    this.refreshScreenStylesheets();
    this.refreshCssWatchers();
    this.recalculateStyles();
  }

  _onCssChange(): void {
    this._on_css_change();
  }

  registerTheme(theme: ThemeDefinition): ActiveTheme {
    return this.themeManager.register(theme);
  }

  setTheme(name: string): ActiveTheme {
    const nextTheme = this.themeManager.setActiveTheme(name);
    this.theme = name;
    this.recalculateStyles();
    this.signals.theme_changed_signal.publish(nextTheme);
    return nextTheme;
  }

  get activeTheme(): ActiveTheme {
    return this.themeManager.activeTheme;
  }

  get dark(): boolean {
    return this.themeManager.dark;
  }

  set dark(value: boolean) {
    this.setDarkMode(value);
  }

  setDarkMode(value: boolean): ActiveTheme {
    const nextTheme = this.themeManager.setDarkMode(value);
    this.theme = nextTheme.name;
    this.recalculateStyles();
    this.signals.theme_changed_signal.publish(nextTheme);
    return nextTheme;
  }

  get ansiTheme(): AnsiTheme {
    return this.themeManager.ansiTheme;
  }

  get ansi_theme(): AnsiTheme {
    return this.ansiTheme;
  }

  get ansiThemeDark(): AnsiTheme {
    return this.themeManager.ansiThemeDark;
  }

  set ansiThemeDark(theme: AnsiTheme) {
    this.themeManager.setAnsiTheme(true, theme);
  }

  get ansi_theme_dark(): AnsiTheme {
    return this.ansiThemeDark;
  }

  set ansi_theme_dark(theme: AnsiTheme) {
    this.ansiThemeDark = theme;
  }

  get ansiThemeLight(): AnsiTheme {
    return this.themeManager.ansiThemeLight;
  }

  set ansiThemeLight(theme: AnsiTheme) {
    this.themeManager.setAnsiTheme(false, theme);
  }

  get ansi_theme_light(): AnsiTheme {
    return this.ansiThemeLight;
  }

  set ansi_theme_light(theme: AnsiTheme) {
    this.ansiThemeLight = theme;
  }

  async suspend<TResult>(callback: () => Promise<TResult> | TResult): Promise<TResult> {
    if (!this.driver.canSuspend || this.driver.isHeadless) {
      throw new SuspendNotSupported("Suspend is not supported by this driver");
    }

    // [LAW:single-enforcer] App suspend owns signal publishing, timer pausing,
    // and driver mode changes; drivers only enter/exit terminal application mode.
    this.signals.app_suspend_signal.publish(undefined);
    this.pauseAllTimers();
    await this.driver.suspendApplicationMode();

    try {
      return await callback();
    } finally {
      await this.driver.resumeApplicationMode();
      this.resumeAllTimers();
      this.signals.app_resume_signal.publish(undefined);
      this.recalculateStyles();
    }
  }

  setAppCommandProviders(providers: Iterable<ProviderConstructor> | null | undefined): void {
    // [LAW:one-source-of-truth] App COMMANDS are normalized into one provider
    // set here; palette launches derive from it instead of re-reading props.
    this.appCommandProviders = providers === undefined ? null : new Set(providers);
  }

  setSystemCommandResolver(resolver: SystemCommandResolver | undefined): void {
    this.systemCommandResolver = resolver ?? (() => []);
  }

  setPublicApp(app: unknown): void {
    // [LAW:one-source-of-truth] The public App wrapper is registered once on
    // the framework so provider contexts derive from the running app object.
    this.publicApp = app;
  }

  getSystemCommands(screen: Screen | null): SystemCommand[] {
    return Array.from(this.systemCommandResolver(screen));
  }

  private createCommandProviders(baseScreen: Screen | null): Provider[] {
    const appProviders = this.appCommandProviders ?? new Set<ProviderConstructor>([SystemCommandsProvider]);
    const screenProviders = baseScreen?.commandProviders ?? new Set<ProviderConstructor>();

    // [LAW:one-source-of-truth] Provider composition is resolved once per
    // palette launch from app replacement providers plus active screen additions.
    return Array.from(new Set<ProviderConstructor>([...appProviders, ...screenProviders]))
      .map((ProviderClass) => new ProviderClass());
  }

  private getFocusedWidget(): Widget | null {
    return this.focusedNodeId === null ? null : this.registry.get(this.focusedNodeId) ?? null;
  }

  async searchCommands(commands: readonly SimpleCommand[]): Promise<CommandPalette> {
    const provider = new SimpleCommandProvider(commands);
    const palette = new CommandPalette([provider], this.createProviderContext(this.activeScreen, this.getFocusedWidget()));

    await palette.startup();
    await palette.open();
    this.activeCommandPalette = palette;
    this.pushScreen(React.createElement(CommandPaletteScreen, { palette }), { name: CommandPalette.SCREEN_NAME });
    this.postAppMessage(new CommandPalette.Opened());
    return palette;
  }

  async openCommandPalette(options: CommandPaletteOptions = {}): Promise<CommandPalette> {
    const baseScreen = this.activeScreen;
    const focused = this.getFocusedWidget();
    const providers = this.createCommandProviders(baseScreen);
    const palette = new CommandPalette(providers, this.createProviderContext(baseScreen, focused), options);

    await palette.startup();
    await palette.open();
    this.activeCommandPalette = palette;
    this.pushScreen(React.createElement(CommandPaletteScreen, { palette }), { name: CommandPalette.SCREEN_NAME });
    this.postAppMessage(new CommandPalette.Opened());
    return palette;
  }

  async closeActiveCommandPalette(
    optionSelected: boolean,
    command?: () => void,
  ): Promise<void> {
    const palette = this.activeCommandPalette;

    if (palette !== null) {
      await palette.shutdown();
    }

    if (CommandPalette.isOpen(this)) {
      this.popScreen(optionSelected);
    }

    this.activeCommandPalette = null;
    this.postAppMessage(new CommandPalette.Closed(optionSelected));
    command?.();
  }

  private createProviderContext(baseScreen: Screen | null, focused: Widget | null): ProviderContext {
    // [LAW:one-source-of-truth] Providers always observe the public App; the
    // framework is reachable via app.framework. publicApp is set in App's
    // constructor so this must be present by the time a palette opens.
    if (this.publicApp === null) {
      throw new Error("Command palette requires a public App; framework-only harnesses cannot open a palette");
    }

    return {
      app: this.publicApp as ProviderContext["app"],
      screen: baseScreen,
      focused,
    };
  }

  postAppMessage(message: Message): void {
    this.pump.postAppMessage(message);
  }

  getActiveStylesheetsFor(typeName: string): ParsedStylesheet[] {
    const cachedScreenStylesheets = [...this.screenStyleCache.values()].flatMap((state) => state.stylesheets);
    return [
      ...this.getWidgetTypeMetadata(typeName).defaultStylesheets,
      ...this.userStylesheets,
      ...cachedScreenStylesheets,
      ...(this.activeScreen?.stylesheets ?? []),
    ];
  }

  parseSelectors(selectorText: string): ParsedSelector[] {
    return parseSelectorList(selectorText);
  }

  matchesSelector(widget: Widget, selector: ParsedSelector): boolean {
    return selectorMatchesWidget(this, widget, selector);
  }

  refreshStyles(changed: boolean): void {
    this.registry.touch();

    if (changed) {
      if (this.batchUpdateCount > 0) {
        this.pendingStyleRecalc = true;
      } else {
        this.recalculateStyles();
      }
    }
  }

  recalculateStyles(): void {
    const visit = (
      widget: Widget,
      inheritedCustomProperties: Record<string, string>,
      inheritedTextStyle: unknown,
    ): void => {
      const resolvedStyles = resolveStylesForWidget(this, widget, inheritedCustomProperties, inheritedTextStyle);
      widget.resolvedStyles.update(resolvedStyles);

      for (const child of this.registry.getChildren(widget.nodeId)) {
        visit(child, resolvedStyles.customProperties, resolvedStyles.rules["text-style"]);
      }
    };

    // [LAW:dataflow-not-control-flow] Every style recalculation walks the same
    // tree in the same order. Variability lives in selector matches and values.
    for (const rootWidget of this.registry.getChildren(null)) {
      visit(rootWidget, this.getGlobalStyleVariables(), undefined);
    }

    this.syncPointerStateAfterLayout();
  }

  get messageQueueSize(): number {
    return this.pump.messageQueueSize;
  }

  getMessageQueueSize(targetId: string | null): number {
    return this.pump.getMessageQueueSize(targetId);
  }

  postMessage(targetId: string, message: Message): boolean {
    return this.pump.postMessage(targetId, message);
  }

  dispatchMessage(message: Message): void {
    this.pump.dispatchMessage(message);
  }

  postToFocused(message: Message): void {
    this.pump.postToFocused(message);
  }

  postKey(input: string, meta: { ctrl?: boolean; shift?: boolean; meta?: boolean; paste?: boolean } = {}): void {
    this.pump.postKey(input, meta);
  }

  postClick(x: number, y: number, chain = 1): void {
    this.postToFocused(new Click(x, y, chain));
  }

  dispatchPointerClick(screenX: number, screenY: number, chain = 1): void {
    // [LAW:single-enforcer] Pointer clicks are synthesized from the same
    // down/up path that owns click-chain state instead of a second direct path.
    for (let index = 0; index < Math.max(1, Math.trunc(chain)); index += 1) {
      this.dispatchPointerDown(screenX, screenY);
      this.dispatchPointerUp(screenX, screenY);
    }
  }

  postMouseDown(x: number, y: number): void {
    this.postToFocused(new MouseDown(x, y));
  }

  dispatchPointerDown(screenX: number, screenY: number): void {
    const resolved = this.resolvePointerTarget(screenX, screenY);
    const dispatchTarget = this.resolvePointerDispatchTarget(resolved.targetNode);
    const dispatched = this.postResolvedPointerMessage(dispatchTarget, resolved, (x, y) => new MouseDown(x, y));
    const focusTarget = this.resolvePointerFocusTarget(resolved.targetNode);

    if (focusTarget !== undefined) {
      this.focusWidget(focusTarget.nodeId);
    }

    // [LAW:one-source-of-truth] The active press target and down timestamp live
    // in one framework-owned record so MouseUp and MouseMove derive click state
    // from the same canonical snapshot.
    this.pendingPointerClick =
      dispatched === undefined
        ? null
        : {
            targetId: dispatched.nodeId,
            canceled: false,
            downTime: Date.now(),
          };
  }

  postMouseUp(x: number, y: number): void {
    this.postToFocused(new MouseUp(x, y));
  }

  dispatchPointerUp(screenX: number, screenY: number): void {
    const resolved = this.resolvePointerTarget(screenX, screenY);
    const dispatchTarget = this.resolvePointerDispatchTarget(resolved.targetNode);
    const pendingClick = this.pendingPointerClick;

    this.postResolvedPointerMessage(dispatchTarget, resolved, (x, y) => new MouseUp(x, y));
    this.pendingPointerClick = null;

    if (
      dispatchTarget !== undefined &&
      pendingClick !== null &&
      !pendingClick.canceled &&
      pendingClick.targetId === dispatchTarget.nodeId
    ) {
      const clickChain = this.resolveClickChain(dispatchTarget.nodeId, pendingClick.downTime);
      this.postResolvedPointerMessage(dispatchTarget, resolved, (x, y) => new Click(x, y, clickChain));
    }
  }

  postMouseMove(x: number, y: number): void {
    this.postToFocused(new MouseMove(x, y));
  }

  dispatchPointerMove(screenX: number, screenY: number): void {
    const pointer = { x: screenX, y: screenY };
    const resolved = this.resolvePointerTarget(screenX, screenY);
    const dispatchTarget = this.resolvePointerDispatchTarget(resolved.targetNode);

    this.lastPointerLocation = pointer;
    this.updateHoveredNode(resolved.targetNode, pointer);
    this.markPendingPointerClick(dispatchTarget);
    this.postResolvedPointerMessage(dispatchTarget, resolved, (x, y) => new MouseMove(x, y));
  }

  postResize(width: number, height: number): void {
    this.setTerminalSize(new Size(width, height));
    this.postToFocused(new Resize(width, height));
  }

  async whenIdle(): Promise<void> {
    return this.pump.whenIdle();
  }

  subscribeToMessages(subscriber: MessageSubscriber): () => void {
    return this.pump.subscribeToMessages(subscriber);
  }

  findWidgets(selectorText: string): Widget[] {
    const trimmedSelector = selectorText.trim();

    if (trimmedSelector.startsWith("#") && !trimmedSelector.includes(" ")) {
      const match = this.registry.getByCssId(trimmedSelector.slice(1));
      return match === undefined ? [] : [match];
    }

    const selectors = parseSelectorList(trimmedSelector);

    return this.registry.list().filter((widget) => selectors.some((selector) => this.matchesSelector(widget, selector)));
  }

  hitTest(screenX: number, screenY: number): Widget | undefined {
    const widgets = this.registry.list();
    const candidates = widgets.filter(
      (widget) =>
        widget.isInteractive &&
        !widget.visibleScreenRegion.isEmpty &&
        widget.visibleScreenRegion.contains(screenX, screenY),
    );

    return candidates
      .sort((left, right) => {
        const depthDifference = widgetDepth(left) - widgetDepth(right);

        if (depthDifference !== 0) {
          return depthDifference;
        }

        return widgets.indexOf(left) - widgets.indexOf(right);
      })
      .at(-1);
  }

  isNodeMounted(widget: Widget): boolean {
    return this.registry.get(widget.nodeId) === widget;
  }

  createSignal<TValue>(owner: Widget, description = ""): Signal<TValue> {
    const signal = new Signal<TValue>(
      () => this.isNodeMounted(owner),
      (node) => this.isNodeMounted(node),
      (callback) => this.callLater(callback),
      description,
    );
    this.signalRegistry.add(signal as Signal<unknown>);
    return signal;
  }

  runWorker<TResult>(
    node: Widget,
    work: WorkerCallable<TResult>,
    options: WorkerOptions = {},
  ): Worker<TResult> {
    const workerName = options.name ?? `${node.typeName.toLowerCase()}-worker`;
    const worker = new Worker(
      node,
      work,
      workerName,
      options.group ?? (options.exclusive === true ? workerName : undefined),
      options.description ?? options.name ?? `${node.typeName} worker`,
      options.exitOnError ?? true,
      options.thread ?? false,
      (targetId, message) => this.postMessage(targetId, message),
      () => undefined,
    );
    const registeredWorker = this.workers.addWorker(worker, false, options.exclusive ?? false);
    const shouldStart = options.start ?? true;

    this.startWorker(registeredWorker, shouldStart);

    return registeredWorker;
  }

  runAppWorker<TResult>(work: WorkerCallable<TResult>, options: WorkerOptions = {}): Worker<TResult> {
    const workerName = options.name ?? "app-worker";
    const worker = new Worker(
      this.appWorkerOwner,
      work,
      workerName,
      options.group ?? (options.exclusive === true ? workerName : undefined),
      options.description ?? options.name ?? "App worker",
      options.exitOnError ?? true,
      options.thread ?? false,
      (targetId, message) => this.postMessage(targetId, message),
      () => undefined,
    );
    const registeredWorker = this.workers.addWorker(worker, false, options.exclusive ?? false);
    const shouldStart = options.start ?? true;

    this.startWorker(registeredWorker, shouldStart);

    return registeredWorker;
  }


  private startWorker<TResult>(worker: Worker<TResult>, shouldStart: boolean): void {
    if (!shouldStart) {
      return;
    }

    void worker.start().catch((error) => {
      if (!(error instanceof WorkerCancelled) && worker.exitOnError) {
        // [LAW:single-enforcer] exitOnError is enforced only at the framework
        // worker-start boundary; worker.wait() remains result/error retrieval.
        this.reportUnhandledError(new WorkerFailed((error as Error).message, { cause: error as Error }));
      }
    });
  }

  setTimer(node: Widget, name: string, delayMs: number, callback: TimerCallback): void {
    this.installTimer(node, name, delayMs, callback, false, {});
  }

  setInterval(node: Widget, name: string, intervalMs: number, callback: TimerCallback, options: TimerOptions = {}): void {
    this.installTimer(node, name, intervalMs, callback, true, options);
  }

  clearTimer(node: Widget, name: string): void {
    const key = this.timerKey(node.nodeId, name);
    const timer = this.timers.get(key);

    timer?.cancel();
    this.timers.delete(key);
  }

  pauseTimer(node: Widget, name: string): void {
    this.timers.get(this.timerKey(node.nodeId, name))?.pause();
  }

  resumeTimer(node: Widget, name: string): void {
    this.timers.get(this.timerKey(node.nodeId, name))?.resume();
  }

  resetTimer(node: Widget, name: string): void {
    this.timers.get(this.timerKey(node.nodeId, name))?.reset();
  }

  notify(
    message: NotificationContent,
    severityOrOptions: NotificationSeverity | NotifyOptions = "information",
    timeout = Notification.timeout,
    title: NotificationContent = "",
    markup = true,
  ): Notification {
    const options = normalizeNotifyOptions(severityOrOptions, timeout, title, markup);
    const notification = new Notification(message, options);

    // [LAW:single-enforcer] Notification recording is gated at this boundary so
    // mount effects, widget helpers, and app calls all share the same transient policy.
    const storedNotification = this.showNotifications ? this.notifications.add(notification) : notification;
    this.postAppMessage(new Notify(notification));
    return storedNotification;
  }

  dismissNotification(identity: string): void {
    const notification = this.notifications.list().find((entry) => entry.identity === identity);

    if (notification !== undefined) {
      this.notifications.delete(notification);
    }
  }

  clearNotifications(): void {
    this.notifications.clear();
  }

  _unnotify(notification: Notification): void {
    // [LAW:one-source-of-truth] Object-based notification removal delegates to
    // the collection identity rule used by dismissNotification and expiry.
    this.notifications.delete(notification);
  }

  callLater<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.pump.callLater(callback, ...args);
  }

  callNext<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.pump.callNext(callback, ...args);
  }

  callAfterRefresh<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.afterRefreshCallbacks.push(() => {
      runWithActiveMessagePump(this, () => {
        callback(...args);
      });
    });

    if (this.afterRefreshRequester === null) {
      this.callLater(() => this.flushAfterRefreshCallbacks());
      return;
    }

    this.callLater(() => {
      this.afterRefreshRequester?.();
    });
  }

  callFromThread<TResult, TArgs extends unknown[]>(callback: (...args: TArgs) => TResult, ...args: TArgs): Promise<TResult> {
    if (!this.isRunning) {
      throw new RuntimeError("callFromThread requires a running app");
    }

    if (threadId === this.appThreadId) {
      // [LAW:single-enforcer] The app-thread identity check lives at the
      // callFromThread boundary, independent of message-pump context.
      throw new RuntimeError("callFromThread must be called from a foreign thread");
    }

    try {
      const activePump = getActiveMessagePump();

      if (activePump === this || (activePump instanceof Widget && activePump.framework === this)) {
        throw new RuntimeError("callFromThread must be called from a foreign thread");
      }
    } catch (error) {
      if (error instanceof RuntimeError && error.message !== "No active message pump") {
        throw error;
      }
    }

    return new Promise<TResult>((resolve, reject) => {
      // [LAW:single-enforcer] Foreign-thread callbacks are marshaled through
      // callLater so app mutation still enters via the message queue boundary.
      this.callLater(() => {
        try {
          resolve(callback(...args));
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  call_from_thread<TResult, TArgs extends unknown[]>(callback: (...args: TArgs) => TResult, ...args: TArgs): Promise<TResult> {
    return this.callFromThread(callback, ...args);
  }

  handleAppBlur(): void {
    if (this.isAppBlurred) {
      return;
    }

    const focused = this.focusedNodeId === null ? undefined : this.registry.get(this.focusedNodeId);
    this.blurredFocusAddress = focused === undefined ? null : this.captureFocusAddress(focused);
    this.isAppBlurred = true;
    this.focusChangedWhileBlurred = false;
    this.hideTooltip();
    this.pump.emitBroadcast(new AppBlur());
    this.applyFocusChange(null, { markBlurOverride: false });
  }

  handleAppFocus(): void {
    this.pump.emitBroadcast(new AppFocus());

    if (!this.isAppBlurred) {
      return;
    }

    const shouldRestore = !this.focusChangedWhileBlurred;
    const blurredAddress = this.blurredFocusAddress;

    this.isAppBlurred = false;
    this.blurredFocusAddress = null;
    this.focusChangedWhileBlurred = false;

    if (!shouldRestore) {
      return;
    }

    const target = blurredAddress === null ? null : this.resolveExactFocusTarget(blurredAddress);
    this.applyFocusChange(target?.nodeId ?? null, { markBlurOverride: false });
  }

  attachAfterRefreshRequester(requester: () => void): () => void {
    this.afterRefreshRequester = requester;

    return () => {
      if (this.afterRefreshRequester === requester) {
        this.afterRefreshRequester = null;
      }
    };
  }

  recordDisplayPass(): void {
    this.displayCount += 1;
    this.syncWidgetLayoutReaders();
  }

  registerLayoutReader(nodeId: string, reader: LayoutReader): () => void {
    this.layoutReaders.set(nodeId, reader);

    return () => {
      if (this.layoutReaders.get(nodeId) === reader) {
        this.layoutReaders.delete(nodeId);
      }
    };
  }

  flushAfterRefreshCallbacks(): void {
    const callbacks = this.afterRefreshCallbacks.splice(0);

    for (const callback of callbacks) {
      callback();
    }
  }

  handleWidgetTooltipChange(widget: Widget): void {
    if (this.hoveredNodeId !== widget.nodeId) {
      return;
    }

    this.refreshTooltipFromHover();
  }

  private resolvePointerTarget(
    screenX: number,
    screenY: number,
  ): { x: number; y: number; targetNode?: Widget } {
    const targetNode = this.hitTest(screenX, screenY);

    if (targetNode === undefined) {
      return { x: screenX, y: screenY };
    }

    return {
      x: screenX - targetNode.effectiveScreenRegion.x,
      y: screenY - targetNode.effectiveScreenRegion.y,
      targetNode,
    };
  }

  private resolvePointerDispatchTarget(targetNode: Widget | undefined): Widget | undefined {
    return targetNode ?? this.resolveActiveScreenRootTarget() ?? this.resolveDefaultDispatchTarget();
  }

  private resolveActiveScreenRootTarget(): Widget | undefined {
    return this.registry.getChildren(null).find((widget) => widget.isInteractive);
  }

  private resolvePointerFocusTarget(targetNode: Widget | undefined): Widget | undefined {
    // [LAW:single-enforcer] Disabled/loading pointer focus gating shares the
    // framework pointer boundary with event suppression instead of widget code.
    if (targetNode?.isDisabledEffective || targetNode?.isLoadingEffective) {
      return undefined;
    }

    let current = targetNode;

    while (current !== undefined) {
      if (this.ancestorsAllowFocus(current) && current.allowFocus()) {
        return current;
      }

      current = current.parent;
    }

    return undefined;
  }

  private postResolvedPointerMessage(
    dispatchTarget: Widget | undefined,
    resolved: { x: number; y: number; targetNode?: Widget },
    createMessage: (x: number, y: number) => Message,
  ): Widget | undefined {
    if (dispatchTarget === undefined) {
      return undefined;
    }

    const coordinates = resolved.targetNode === undefined ? { x: resolved.x, y: resolved.y } : resolved;
    return this.postMessage(dispatchTarget.nodeId, createMessage(coordinates.x, coordinates.y))
      ? dispatchTarget
      : undefined;
  }

  private markPendingPointerClick(dispatchTarget: Widget | undefined): void {
    const pendingClick = this.pendingPointerClick;

    if (
      pendingClick !== null &&
      !pendingClick.canceled &&
      pendingClick.targetId !== (dispatchTarget?.nodeId ?? null)
    ) {
      pendingClick.canceled = true;
    }
  }

  private resolveClickChain(targetId: string, mouseDownTime: number): number {
    const thresholdMs = TextualFramework.CLICK_CHAIN_TIME_THRESHOLD * 1000;
    const previousClick = this.lastClickChain;
    const chain =
      previousClick !== null &&
      previousClick.targetId === targetId &&
      mouseDownTime - previousClick.time <= thresholdMs
        ? previousClick.chain + 1
        : 1;

    // [LAW:single-enforcer] Multi-click timing and same-target matching are
    // derived at the pointer forwarding boundary so widgets read one canonical
    // chain value from Click instead of re-implementing double-click logic.
    this.lastClickChain = {
      targetId,
      chain,
      time: Date.now(),
    };
    return chain;
  }

  private updateHoveredNode(targetNode: Widget | undefined, pointer: PointerLocation): void {
    const nextHoveredNodeId = targetNode?.nodeId ?? null;
    const hoveredChanged = this.hoveredNodeId !== nextHoveredNodeId;

    this.lastPointerLocation = pointer;
    // [LAW:one-source-of-truth] The hovered widget's resolved pointer rule is
    // the canonical cursor-shape source; the app-level pointerShape derives from it.
    this.pointerShape = targetNode?.resolvedStyles.getRule<PointerShape>("pointer") ?? "default";

    if (hoveredChanged) {
      this.hoveredNodeId = nextHoveredNodeId;
      this.recalculateStyles();
      this.hideTooltip();
      this.refreshTooltipFromHover();
      return;
    }

    if (this.activeTooltip?.sourceNodeId === nextHoveredNodeId) {
      this.activeTooltip = {
        ...this.activeTooltip,
        x: pointer.x,
        y: pointer.y,
      };
      return;
    }

    this.refreshTooltipFromHover();
  }

  private refreshTooltipFromHover(): void {
    this.clearTooltipTimer();

    if (!this.showTooltips) {
      return;
    }

    if (this.hoveredNodeId === null || this.lastPointerLocation === null) {
      return;
    }

    const hoveredWidget = this.registry.get(this.hoveredNodeId);
    const visual = hoveredWidget === undefined ? null : this.normalizeTooltipContent(hoveredWidget.tooltip);

    if (hoveredWidget === undefined || visual === null) {
      return;
    }

    const pointer = this.lastPointerLocation;
    this.tooltipTimer = setTimeout(() => {
      const currentHovered = this.hoveredNodeId === null ? undefined : this.registry.get(this.hoveredNodeId);

      if (currentHovered?.nodeId !== hoveredWidget.nodeId) {
        return;
      }

      const currentVisual = this.normalizeTooltipContent(currentHovered.tooltip);

      if (currentVisual === null) {
        return;
      }

      runInAction(() => {
        this.activeTooltip = {
          sourceNodeId: hoveredWidget.nodeId,
          visual: currentVisual,
          x: pointer.x,
          y: pointer.y,
          visible: true,
        };
        this.tooltipTimer = null;
      });
    }, this.tooltipDelay);
  }

  private normalizeTooltipContent(value: VisualInput | null): Visual | null {
    if (value === null) {
      return null;
    }

    const visual = visualize(value);
    const measurement = measureVisual(visual);
    return measurement.width === 0 && measurement.height === 0 ? null : visual;
  }

  private hideTooltip(): void {
    this.clearTooltipTimer();

    if (this.activeTooltip !== null) {
      this.activeTooltip = null;
    }
  }

  private clearTooltipTimer(): void {
    if (this.tooltipTimer !== null) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
  }

  private syncPointerStateAfterLayout(): void {
    if (this.lastPointerLocation === null) {
      this.hideTooltip();
      return;
    }

    const hit = this.hitTest(this.lastPointerLocation.x, this.lastPointerLocation.y);
    const nextHoveredNodeId = hit?.nodeId ?? null;

    if (this.hoveredNodeId !== nextHoveredNodeId) {
      this.hoveredNodeId = nextHoveredNodeId;
      this.hideTooltip();
      this.recalculateStyles();
      return;
    }

    if (this.activeTooltip !== null) {
      const source = this.registry.get(this.activeTooltip.sourceNodeId);

      if (source === undefined || !source.isInteractive || hit?.nodeId !== source.nodeId) {
        this.hideTooltip();
      }
    }
  }

  private handleWidgetWillUnmount(widget: Widget): void {
    if (this.hoveredNodeId === widget.nodeId) {
      this.hoveredNodeId = null;
      this.hideTooltip();
    }

    if (this.activeTooltip?.sourceNodeId === widget.nodeId) {
      this.hideTooltip();
    }
  }

  private clearPointerState(): void {
    const hoveredChanged = this.hoveredNodeId !== null;

    this.hoveredNodeId = null;
    this.lastPointerLocation = null;
    this.hideTooltip();

    if (hoveredChanged) {
      this.recalculateStyles();
    }
  }

  // ---- Screen stack and modes -------------------------------------------
  // [LAW:single-enforcer] All screen-stack state lives in this.screenStack.
  // The methods below are thin orchestrators: they sequence the cross-cutting
  // effects (pointer clear, suspend/resume, css watcher refresh, signals,
  // broadcasts, binding updates) around state mutations performed by the
  // service.

  get activeMode(): string {
    return this.screenStack.activeMode;
  }

  get screenStackVersion(): number {
    return this.screenStack.screenStackVersion;
  }

  installScreen(name: string, factory: () => React.ReactElement): void {
    this.screenStack.installScreen(name, factory);
  }

  uninstallScreen(name: string): void {
    this.screenStack.uninstallScreen(name);
  }

  isScreenInstalled(name: string): boolean {
    return this.screenStack.isScreenInstalled(name);
  }

  getScreen(name: string): React.ReactElement;
  getScreen<TComponent extends React.ComponentType<Record<string, unknown>>>(
    name: string,
    expectedType: TComponent,
  ): React.ReactElement;
  getScreen(
    name: string,
    expectedType?: React.ComponentType<Record<string, unknown>>,
  ): React.ReactElement {
    return expectedType === undefined
      ? this.screenStack.getScreen(name)
      : this.screenStack.getScreen(name, expectedType);
  }

  addMode(name: string, factory: () => React.ReactElement): void {
    this.screenStack.addMode(name, factory);
  }

  removeMode(name: string): void {
    this.screenStack.removeMode(name);
  }

  switchMode(name: string): void {
    if (name === this.screenStack.activeMode) {
      return;
    }

    this.screenStack.ensureKnownMode(name);

    this.clearPointerState();
    this.suspendCurrentScreen();

    if (name !== DEFAULT_MODE && this.screenStack.modeStackLength(name) === 0) {
      const factory = this.screenStack.modeFactory(name);

      if (factory !== undefined) {
        // [LAW:one-source-of-truth] The mode's factory is the sole producer of
        // its base screen; the mode name is not doubled up as the screen name.
        const entry = this.makeScreenEntry(factory(), {});
        this.screenStack.setModeStack(name, [entry]);
      }
    }

    this.screenStack.setActiveMode(name);
    this.refreshCssWatchers();
    this.signals.mode_change_signal.publish(name);
    this.pump.emitBroadcast(new ModeChanged(name));

    this.resumeActiveScreen();
    this.signals.screen_change_signal.publish(this.activeScreen);
    this.notifyBindingsUpdated();
  }

  get activeScreen(): Screen | null {
    return this.screenStack.activeScreen;
  }

  get activeScreenElement(): React.ReactElement | null {
    return this.screenStack.activeScreenElement;
  }

  get screenStackDepth(): number {
    return this.screenStack.screenStackDepth;
  }

  getScreenStack(mode?: string): Screen[] {
    return this.screenStack.getScreenStack(mode);
  }

  getActiveBindings(): ActiveBinding[] {
    const chain = this.buildBindingChain();
    const activeBindings: ActiveBinding[] = [];
    const claimedKeys = new Set<string>();
    const widgetLayers = chain.filter((entry) => entry.namespace.kind === "widget").slice().reverse();
    const screenLayers = chain.filter((entry) => entry.namespace.kind === "screen");
    const appLayers = chain.filter((entry) => entry.namespace.kind === "app");

    // [LAW:single-enforcer] Binding display is derived once here so widgets
    // like Footer consume the same precedence, keymap, and checkAction rules
    // that execution uses instead of rebuilding them independently.
    this.collectActiveBindings(activeBindings, claimedKeys, chain, true);
    this.collectActiveBindings(activeBindings, claimedKeys, [...widgetLayers, ...screenLayers, ...appLayers], false);

    return activeBindings;
  }

  pushScreen(descriptor: ScreenDescriptor, callbackOrOptions?: ((result: unknown) => void) | ScreenOptions, extraOptions?: ScreenOptions): Screen {
    const { callback, options } = normalizePushArgs(callbackOrOptions, extraOptions);
    const element = this.screenStack.resolveScreenElement(descriptor);
    const entry = this.makeScreenEntry(element, { ...options, callback });

    this.clearPointerState();
    this.suspendCurrentScreen();

    this.screenStack.pushEntry(entry);
    this.refreshCssWatchers();

    this.resumeActiveScreen();
    this.signals.screen_change_signal.publish(entry);
    this.notifyBindingsUpdated();

    return entry;
  }

  pushScreenWait(descriptor: ScreenDescriptor, options: ScreenOptions = {}): Promise<unknown> {
    getCurrentWorker();

    return new Promise((resolve) => {
      const entry = this.pushScreen(descriptor, options);
      entry.waiters.push(resolve);
    });
  }

  popScreen(result?: unknown): Screen | null {
    this.clearPointerState();
    this.suspendCurrentScreen();

    const popped = this.screenStack.popEntry();
    this.refreshCssWatchers();

    this.screenStack.resolveScreenResult(popped, result);

    this.resumeActiveScreen();
    this.signals.screen_change_signal.publish(this.activeScreen);
    this.notifyBindingsUpdated();

    return popped;
  }

  dismissScreen(result?: unknown): Screen | null {
    return this.popScreen(result);
  }

  switchScreen(descriptor: ScreenDescriptor, options: ScreenOptions = {}): Screen {
    if (this.screenStack.activeStackIsEmpty()) {
      return this.pushScreen(descriptor, options);
    }

    const element = this.screenStack.resolveScreenElement(descriptor);
    const current = this.screenStack.topOfActiveStack();

    if (current !== undefined && current.element === element) {
      return current;
    }

    this.clearPointerState();
    this.suspendCurrentScreen();

    const entry = this.makeScreenEntry(element, options);
    this.screenStack.clearScreenWaiters(current);
    this.screenStack.replaceTop(entry);
    this.refreshCssWatchers();

    this.resumeActiveScreen();
    this.signals.screen_change_signal.publish(entry);
    this.notifyBindingsUpdated();

    return entry;
  }

  // [LAW:single-enforcer] Screen-entry construction is delegated to the
  // service so dismiss-action wiring and screen factory rules live in one
  // place. The framework only supplies the dismiss callback that translates a
  // screen-local action back into the framework's pop pipeline.
  private makeScreenEntry(
    element: React.ReactElement,
    options: ScreenOptions & { callback?: (result: unknown) => void },
  ): Screen {
    return this.screenStack.createScreen(element, options, (result) => {
      this.dismissScreen(result);
    });
  }

  runAction(action: string, defaultTarget?: ActionTargetDescriptor): boolean {
    const parsed = parseAction(action);
    const target = this.resolveActionTarget(parsed.namespace, defaultTarget);

    if (target === null) {
      this.lastActionDispatchResult = "unhandled";
      return false;
    }

    const actions = target.actions;
    const checkAction: WidgetCheckAction | undefined =
      typeof actions?.checkAction === "function" ? (actions.checkAction as WidgetCheckAction) : undefined;
    const gate = checkAction === undefined ? true : checkAction(parsed.actionName, parsed.params);

    if (gate === false || gate === null) {
      this.lastActionDispatchResult = "consumed";
      return false;
    }

    const candidate =
      pickActionCallback(actions, `_action_${parsed.actionName}`) ??
      pickActionCallback(actions, `action_${parsed.actionName}`);

    if (candidate === undefined) {
      this.lastActionDispatchResult = "unhandled";
      return false;
    }

    try {
      candidate(...parsed.params);
      this.lastActionDispatchResult = "handled";
      return true;
    } catch (error) {
      if (error instanceof SkipAction) {
        this.lastActionDispatchResult = "unhandled";
        return false;
      }

      throw error;
    }
  }

  checkAction(action: string, defaultTarget?: ActionTargetDescriptor): boolean | null {
    const parsed = parseAction(action);
    const target = this.resolveActionTarget(parsed.namespace, defaultTarget);

    if (target === null) {
      return false;
    }

    const actions = target.actions;
    const checkAction: WidgetCheckAction | undefined =
      typeof actions?.checkAction === "function" ? (actions.checkAction as WidgetCheckAction) : undefined;

    return checkAction === undefined ? true : checkAction(parsed.actionName, parsed.params);
  }

  private suspendCurrentScreen(): void {
    const screen = this.activeScreen;

    if (screen === null) {
      return;
    }

    this.saveScreenFocusSnapshot(screen);
    this.pump.emitBroadcast(new ScreenSuspend(screen.name));
  }

  private resumeActiveScreen(): void {
    const screen = this.activeScreen;

    if (screen === null) {
      return;
    }

    this.pump.emitBroadcast(new ScreenResume(screen.name));
    this.scheduleActiveScreenFocusResolution(true);
  }

  // ---- Action dispatch --------------------------------------------------

  private resolveActionTarget(
    namespace: string,
    defaultTarget?: ActionTargetDescriptor,
  ): { actions: WidgetActions | undefined } | null {
    // [LAW:dataflow-not-control-flow] Named action namespaces dispatch via a
    // table keyed on namespace string. Adding a namespace registers a
    // resolver here; resolveActionTarget does not branch on namespace name.
    const namedNamespaces: Record<string, () => { actions: WidgetActions | undefined } | null> = {
      app: () => ({ actions: this.appActions }),
      screen: () => {
        const screen = this.activeScreen;
        return screen === null ? null : { actions: screen.actions };
      },
      focused: () => {
        const focused = this.focusedWidget();
        return focused === undefined ? null : { actions: focused.actions };
      },
    };

    if (namespace !== "") {
      return namedNamespaces[namespace]?.() ?? null;
    }

    // Unnamespaced action: defaultTarget → focused widget → app, in order.
    const focused = this.focusedWidget();
    return (
      (defaultTarget === undefined ? undefined : { actions: defaultTarget.actions }) ??
      (focused === undefined ? undefined : { actions: focused.actions }) ??
      { actions: this.appActions }
    );
  }

  private focusedWidget(): Widget | undefined {
    return this.focusedNodeId === null ? undefined : this.registry.get(this.focusedNodeId);
  }

  private dispatchBindingAction(action: string, defaultTarget?: ActionTargetDescriptor): boolean {
    // [LAW:single-enforcer] runAction is the single action-dispatch boundary;
    // binding handling derives consumed-vs-unhandled from its canonical result.
    void this.runAction(action, defaultTarget);
    return this.lastActionDispatchResult !== "unhandled";
  }

  // ---- Binding dispatch -------------------------------------------------

  private resolveBindingsForApp(): Binding[] {
    return this.rewriteBindings(this.appBindings, createAppBindingNamespace());
  }

  private resolveBindingsForScreen(screen: Screen): Binding[] {
    return this.rewriteBindings(screen.bindings, createScreenBindingNamespace(screen));
  }

  private resolveBindingsForNode(node: Widget): Binding[] {
    return this.rewriteBindings(node.bindings, createWidgetBindingNamespace(node));
  }

  private rewriteBindings(bindings: Binding[], namespace: BindingNamespace): Binding[] {
    const rewritten: Binding[] = [];
    const remappedIds = new Set<string>();

    // [LAW:single-enforcer] Keymap application lives in one rewrite path so app,
    // screen, and widget bindings cannot drift in remap semantics.
    for (const binding of bindings) {
      const bindingId = binding.id;
      const mappedKeys = bindingId === undefined ? undefined : this.keymap.get(bindingId);

      if (bindingId === undefined || mappedKeys === undefined) {
        rewritten.push(binding);
        continue;
      }

      if (remappedIds.has(bindingId)) {
        continue;
      }

      remappedIds.add(bindingId);

      for (const key of mappedKeys) {
        rewritten.push({ ...binding, key });
      }
    }

    this.reportBindingClashes(namespace, rewritten);
    return rewritten;
  }

  private reportBindingClashes(namespace: BindingNamespace, bindings: Binding[]): void {
    const bindingsByKey = new Map<string, Binding[]>();

    for (const binding of bindings) {
      const bucket = bindingsByKey.get(binding.key) ?? [];
      bucket.push(binding);
      bindingsByKey.set(binding.key, bucket);
    }

    const clashes = Array.from(bindingsByKey.entries())
      .filter(([, entries]) => entries.length > 1)
      .map(([key, entries]) => ({ key, bindings: entries.slice() }));
    const signature = clashes
      .map((entry) => `${entry.key}:${entry.bindings.map((binding) => binding.id ?? binding.action).join("|")}`)
      .join(";");
    const previous = this.bindingClashSignatures.get(namespace.key);

    if (signature.length === 0) {
      this.bindingClashSignatures.delete(namespace.key);
      return;
    }

    if (previous === signature) {
      return;
    }

    this.bindingClashSignatures.set(namespace.key, signature);
    this.handleBindingsClash(clashes, namespace);
  }

  notifyBindingsUpdated(): void {
    this.syncActiveBindingClashes();
    this.signals.bindings_updated_signal.publish(undefined);
  }

  private syncActiveBindingClashes(): void {
    const activeNamespaces = new Set(this.buildBindingChain().map((entry) => entry.namespace.key));

    for (const namespaceKey of this.bindingClashSignatures.keys()) {
      if (!activeNamespaces.has(namespaceKey)) {
        this.bindingClashSignatures.delete(namespaceKey);
      }
    }
  }

  private dispatchPriorityBindings(key: string): boolean {
    const chain = this.buildBindingChain();

    // [LAW:dataflow-not-control-flow] Walk the chain top-down (app → screen → focused).
    // Data (priority flag) decides whether each binding fires, not conditional skips.
    for (const level of chain) {
      for (const binding of level.bindings) {
        if (binding.priority === true && binding.key === key) {
          if (this.dispatchBindingAction(binding.action, { actions: level.actions })) {
            return true;
          }
        }
      }
    }

    return false;
  }

  dispatchNodeKeyBindings(node: Widget, key: string): boolean {
    return this.pump.dispatchNodeKeyBindings(node, key);
  }

  private dispatchScreenKeyBindings(key: string): boolean {
    const screen = this.activeScreen;

    if (screen !== null) {
      for (const binding of this.resolveBindingsForScreen(screen)) {
        if (binding.priority !== true && binding.key === key) {
          if (this.dispatchBindingAction(binding.action, { actions: screen.actions })) {
            return true;
          }
        }
      }
    }

    for (const binding of this.resolveBindingsForApp()) {
      if (binding.priority !== true && binding.key === key) {
        if (this.dispatchBindingAction(binding.action, { actions: this.appActions })) {
          return true;
        }
      }
    }

    return false;
  }

  private collectActiveBindings(
    target: ActiveBinding[],
    claimedKeys: Set<string>,
    layers: BindingChainEntry[],
    priority: boolean,
  ): void {
    for (const layer of layers) {
      for (const binding of layer.bindings) {
        if ((binding.priority === true) !== priority) {
          continue;
        }

        if (binding.show === false || claimedKeys.has(binding.key)) {
          continue;
        }

        const gate = this.checkAction(binding.action, { actions: layer.actions });

        if (gate === false) {
          continue;
        }

        claimedKeys.add(binding.key);
        target.push(this.createActiveBinding({
          binding,
          namespace: layer.namespace,
          actions: layer.actions,
        }, gate !== null));
      }
    }
  }

  private createActiveBinding(seed: ActiveBindingSeed, enabled: boolean): ActiveBinding {
    return {
      key: seed.binding.key,
      action: seed.binding.action,
      description: seed.binding.description,
      enabled,
      priority: seed.binding.priority === true,
      namespace: seed.namespace,
      run: () => this.runAction(seed.binding.action, { actions: seed.actions }),
    };
  }

  private buildBindingChain(): BindingChainEntry[] {
    const chain: BindingChainEntry[] = [];

    // App layer first so priority bindings are evaluated top-down.
    chain.push({
      namespace: createAppBindingNamespace(),
      bindings: this.resolveBindingsForApp(),
      actions: this.appActions,
    });

    const screen = this.activeScreen;

    if (screen !== null) {
      chain.push({
        namespace: createScreenBindingNamespace(screen),
        bindings: this.resolveBindingsForScreen(screen),
        actions: screen.actions,
      });
    }

    const focused = this.focusedNodeId === null ? undefined : this.registry.get(this.focusedNodeId);

    if (focused !== undefined) {
      const ancestry: Widget[] = [];
      let current: Widget | undefined = focused;

      while (current !== undefined) {
        ancestry.unshift(current);
        current = current.parent;
      }

      for (const node of ancestry) {
        chain.push({
          namespace: createWidgetBindingNamespace(node),
          bindings: this.resolveBindingsForNode(node),
          actions: node.actions,
        });
      }
    }

    return chain;
  }

  private resolveDefaultDispatchTarget(): Widget | undefined {
    const interactiveWidgets = this.registry.list().filter((entry) => entry.isInteractive);

    // [LAW:one-source-of-truth] Focus/default dispatch target resolution lives
    // in one helper so input routing and app-level dispatch share the same target choice.
    return (
      interactiveWidgets.find((entry) => entry.nodeId === this.focusedNodeId) ??
      interactiveWidgets.find((entry) => entry.focusable) ??
      interactiveWidgets[0]
    );
  }

  private resolveHandlers(
    handlers: WidgetHandlers | undefined,
    message: Message,
  ): Array<NonNullable<WidgetHandlers[keyof WidgetHandlers]>> {
    if (handlers === undefined) {
      return [];
    }

    const registeredHandlers = discoverOnHandlers(handlers);
    const registeredIdentities = new Set(registeredHandlers.map((candidate) => candidate.identity));
    const matchingHandlers = registeredHandlers.flatMap((candidate) => {
      const invocationCount = this.countMatchingOnRegistrations(candidate.registrations, message);
      return Array.from({ length: invocationCount }, () => candidate.callable);
    });
    const seenConventionIdentities = new Set<WidgetMessageHandler>();

    const conventionHandlers = messageHandlerNames(message)
      .map((name) => resolveNamedHandler(handlers, name))
      .filter((candidate): candidate is NonNullable<ReturnType<typeof resolveNamedHandler>> => candidate !== null)
      .filter((candidate) => !registeredIdentities.has(candidate.identity))
      .filter((candidate) => {
        if (seenConventionIdentities.has(candidate.identity)) {
          return false;
        }

        seenConventionIdentities.add(candidate.identity);
        return true;
      })
      .map((candidate) => candidate.callable);

    return [...matchingHandlers, ...conventionHandlers];
  }

  private async dispatchKeyHandler(handlers: WidgetHandlers | undefined, message: Key): Promise<boolean> {
    if (handlers === undefined || message.key.length === 0) {
      return false;
    }

    const matches = this.resolveKeyHandlers(handlers, message.key);

    if (matches.length > 1) {
      throw new DuplicateKeyHandlers(`Duplicate key handlers for "${message.key}"`);
    }

    const handler = matches[0];

    if (handler === undefined) {
      return false;
    }

    // [LAW:single-enforcer] Direct key-handler dispatch resolves aliases and
    // conflict detection in one place so widgets don't re-implement it.
    const result = await runWithActiveMessagePump(message.sender ?? this, () => handler.callable(message));
    return result !== false;
  }

  private resolveKeyHandlers(
    handlers: WidgetHandlers,
    key: string,
  ): Array<{ identity: WidgetMessageHandler; callable: WidgetMessageHandler }> {
    const matches: Array<{ identity: WidgetMessageHandler; callable: WidgetMessageHandler }> = [];
    const seenIdentities = new Set<WidgetMessageHandler>();
    const aliases = keyNameAliases(key);

    for (const alias of aliases) {
      for (const name of [`key_${alias}`, `_key_${alias}`]) {
        const candidate = resolveNamedHandler(handlers, name);

        if (candidate === null) {
          continue;
        }

        if (seenIdentities.has(candidate.identity)) {
          continue;
        }

        seenIdentities.add(candidate.identity);
        matches.push({
          identity: candidate.identity,
          callable: candidate.callable,
        });
      }
    }

    return matches;
  }

  private countMatchingOnRegistrations(registrations: readonly OnHandlerRegistration[], message: Message): number {
    const matchingRegistrations = registrations
      .map((registration) => ({
        registration,
        distance: getMessageTypeDistance(message, registration.messageType),
      }))
      .filter(
        (candidate): candidate is { registration: OnHandlerRegistration; distance: number } =>
          candidate.distance !== null && this.matchesOnRegistration(message, candidate.registration),
      )
      .sort((left, right) => left.registration.order - right.registration.order);

    if (matchingRegistrations.length === 0) {
      return 0;
    }

    const seenGroups = new Set<string>();

    return matchingRegistrations.reduce((count, candidate) => {
      const signature = this.getOnRegistrationGroupSignature(candidate.registration);

      if (seenGroups.has(signature)) {
        return count;
      }

      const bestDistance = matchingRegistrations
        .filter((entry) => this.getOnRegistrationGroupSignature(entry.registration) === signature)
        .reduce((currentBest, entry) => Math.min(currentBest, entry.distance), Number.POSITIVE_INFINITY);

      if (candidate.distance !== bestDistance) {
        return count;
      }

      seenGroups.add(signature);
      return count + 1;
    }, 0);
  }

  private matchesOnRegistration(message: Message, registration: OnHandlerRegistration): boolean {
    const selectorMatches = registration.selector === null
      ? true
      : this.matchesSelectorGroup(this.getDefaultOnSelectorTarget(message), registration.selector);
    const attributeMatches = Array.from(registration.attributeSelectors.entries()).every(([attribute, selectors]) =>
      this.matchesSelectorGroup(this.getOnAttributeTarget(message, attribute), selectors),
    );
    return selectorMatches && attributeMatches;
  }

  private matchesSelectorGroup(target: Widget | null, selectors: readonly ParsedSelector[]): boolean {
    return target !== null && selectors.some((selector) => this.matchesSelector(target, selector));
  }

  private getDefaultOnSelectorTarget(message: Message): Widget | null {
    const selectorAttribute = getSelectorAttribute(message.constructor as MessageConstructor);

    if (selectorAttribute === null) {
      return null;
    }

    // [LAW:one-source-of-truth] Positional on() matching reads the one
    // declared selector attribute instead of guessing between sender/control.
    const messageAttributes = message as Message & Record<string, unknown>;
    return this.resolveOnSelectorTarget(messageAttributes[selectorAttribute], selectorAttribute);
  }

  private getOnAttributeTarget(message: Message, attribute: string): Widget | null {
    const messageAttributes = message as Message & Record<string, unknown>;
    return this.resolveOnSelectorTarget(messageAttributes[attribute], attribute);
  }

  private resolveOnSelectorTarget(value: unknown, attribute: string): Widget | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (!(value instanceof Widget)) {
      throw new Error(`Message selector attribute "${attribute}" is not a widget`);
    }

    if (this.registry.get(value.nodeId) !== value) {
      throw new Error(`Message selector attribute "${attribute}" is not a registered widget`);
    }

    return value;
  }

  private getOnRegistrationGroupSignature(registration: OnHandlerRegistration): string {
    const selectorSignature = registration.selector?.map((selector) => selector.raw).join(",") ?? "";
    const attributeSignature = Array.from(registration.attributeSelectors.entries())
      .map(([attribute, selectors]) => `${attribute}:${selectors.map((selector) => selector.raw).join(",")}`)
      .join("|");
    return `${selectorSignature}::${attributeSignature}`;
  }

  private createFrameworkSignal<TValue>(): Signal<TValue> {
    const signal = new Signal<TValue>(
      () => this.isRunning,
      (node) => this.isNodeMounted(node),
      (callback) => this.callLater(callback),
      "framework",
    );
    this.signalRegistry.add(signal as Signal<unknown>);
    return signal;
  }

  private applyFocusChange(nodeId: string | null, options: { markBlurOverride: boolean }): void {
    if (this.focusedNodeId === nodeId) {
      return;
    }

    const previousId = this.focusedNodeId;

    if (this.isAppBlurred && options.markBlurOverride) {
      this.focusChangedWhileBlurred = true;
    }

    this.focusedNodeId = nodeId;
    this.recalculateStyles();

    // [LAW:single-enforcer] Focus transitions are emitted from one method so
    // restore, user focus changes, and blur-driven clears share one path.
    const previousNode = previousId === null ? undefined : this.registry.get(previousId);

    const nextNode = nodeId === null ? undefined : this.registry.get(nodeId);
    this.pump.enqueueFocusBlur(previousNode, nextNode);

    this.notifyBindingsUpdated();
  }

  private saveScreenFocusSnapshot(screen: Screen): void {
    const focused = this.focusedNodeId === null ? undefined : this.registry.get(this.focusedNodeId);
    screen.savedFocusNodeId = focused?.nodeId ?? null;
    screen.lastFocusedAddress = focused === undefined ? null : this.captureFocusAddress(focused);
  }

  private captureFocusAddress(widget: Widget): FocusAddress {
    const segments: number[] = [];
    let current: Widget | undefined = widget;

    // [LAW:one-source-of-truth] Focus restore captures one structural address
    // derived from registry order. No alternate identity path participates.
    while (current !== undefined) {
      const siblings = this.registry.getChildren(current.parentId);
      const index = siblings.findIndex((entry) => entry.nodeId === current!.nodeId);
      segments.unshift(Math.max(0, index));
      current = current.parent;
    }

    return {
      path: segments,
      widgetId: widget.id ?? null,
      typeName: widget.typeName,
    };
  }

  private scheduleActiveScreenFocusResolution(allowAutoFocus: boolean): void {
    this.callAfterRefresh(() => {
      if (this.isAppBlurred) {
        return;
      }

      if (this.focusedNodeId !== null) {
        return;
      }

      const target = this.resolveFocusTarget(this.activeScreen?.lastFocusedAddress ?? null, allowAutoFocus);
      this.applyFocusChange(target?.nodeId ?? null, { markBlurOverride: false });
    });
  }

  private resolveFocusTarget(address: FocusAddress | null, allowAutoFocus: boolean): Widget | null {
    const chain = this.getFocusChain();

    if (chain.length === 0) {
      return null;
    }

    if (address !== null) {
      return this.findNearestFocusCandidate(chain, address);
    }

    if (!allowAutoFocus) {
      return null;
    }

    return this.resolveAutoFocusTarget(chain);
  }

  private filterFocusChain(selector?: string | Function): Widget[] {
    const chain = this.getFocusChain();

    if (selector === undefined) {
      return chain;
    }

    if (typeof selector === "function") {
      const typeName = this.resolveWidgetTypeName(selector);
      return chain.filter((widget) => widget.matchesType(typeName));
    }

    const selectors = this.parseSelectors(selector);
    return chain.filter((widget) => selectors.some((candidate) => this.matchesSelector(widget, candidate)));
  }

  private ancestorsAllowFocus(widget: Widget): boolean {
    let current = widget.parent;

    while (current !== undefined) {
      if (!current.allowFocusChildren()) {
        return false;
      }

      current = current.parent;
    }

    return true;
  }

  private isNodeWithin(widget: Widget | undefined, ancestor: Widget): boolean {
    let current = widget;

    while (current !== undefined) {
      if (current.nodeId === ancestor.nodeId) {
        return true;
      }

      current = current.parent;
    }

    return false;
  }

  private resolveAutoFocusTarget(chain: Widget[]): Widget | null {
    const selector = this.getEffectiveAutoFocusSelector();

    if (selector === null || selector === "") {
      return null;
    }

    if (selector === "*") {
      return chain[0] ?? null;
    }

    const selectors = this.parseSelectors(selector);
    return chain.find((widget) => selectors.some((candidate) => this.matchesSelector(widget, candidate))) ?? null;
  }

  private resolveExactFocusTarget(address: FocusAddress): Widget | null {
    const chain = this.getFocusChain();

    for (const widget of chain) {
      if (focusAddressesEqual(address, this.captureFocusAddress(widget))) {
        return widget;
      }
    }

    return null;
  }

  private getEffectiveAutoFocusSelector(): string | null {
    const screen = this.activeScreen;

    if (screen?.autoFocus === "") {
      return "";
    }

    if (screen?.autoFocus !== null && screen?.autoFocus !== undefined) {
      return screen.autoFocus;
    }

    return this.appAutoFocus;
  }

  private findNearestFocusCandidate(chain: Widget[], address: FocusAddress): Widget | null {
    let best: Widget | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const widget of chain) {
      const distance = focusAddressDistance(address, this.captureFocusAddress(widget));

      if (distance < bestDistance) {
        best = widget;
        bestDistance = distance;
      }
    }

    return best;
  }

  private installTimer(
    node: Widget,
    name: string,
    delayMs: number,
    callback: TimerCallback,
    repeating: boolean,
    options: TimerOptions,
  ): void {
    const key = this.timerKey(node.nodeId, name);
    const existing = this.timers.get(key);
    existing?.cancel();

    // [LAW:single-enforcer] Named timer replacement happens only here so timer
    // ownership and lifecycle stay canonical at the framework boundary.
    const timer = new ManagedTimer(
      name,
      delayMs,
      () => {
        if (this.isNodeMounted(node)) {
          void this.pump.dispatchToWidgetImmediate(node, new Timer(callback));
        }
      },
      repeating,
      {
        skip: options.skip ?? true,
        repeat: options.repeat ?? 0,
      },
    );

    this.timers.set(key, timer);
    timer.start();
  }

  private timerKey(nodeId: string, name: string): string {
    return `${nodeId}:${name}`;
  }

  private clearNodeTimers(nodeId: string): void {
    for (const [key, timer] of this.timers.entries()) {
      if (key.startsWith(`${nodeId}:`)) {
        timer.cancel();
        this.timers.delete(key);
      }
    }
  }

  private clearAllTimers(): void {
    for (const timer of this.timers.values()) {
      timer.cancel();
    }

    this.timers.clear();
  }

  private syncWidgetLayoutReaders(): void {
    // [LAW:one-source-of-truth] Ink layout measurement is centralized here so
    // stale sibling or ancestor geometry cannot become a second spatial truth.
    for (const reader of this.layoutReaders.values()) {
      reader();
    }
  }

  private pauseAllTimers(): void {
    for (const timer of this.timers.values()) {
      timer.pause();
    }
  }

  private resumeAllTimers(): void {
    for (const timer of this.timers.values()) {
      timer.resume();
    }
  }

  private getGlobalStyleVariables(): Record<string, string> {
    return this.themeManager.getCssVariables();
  }
}

interface BindingChainEntry {
  namespace: BindingNamespace;
  bindings: Binding[];
  actions: WidgetActions | undefined;
}

interface ActiveBindingSeed {
  binding: Binding;
  namespace: BindingNamespace;
  actions: WidgetActions | undefined;
}

export interface ActionTargetDescriptor {
  actions: WidgetActions | undefined;
}

type ActionDispatchResult = "handled" | "consumed" | "unhandled";

function readCommandProvidersFromElement(element: React.ReactElement): ReadonlySet<ProviderConstructor> {
  const typeWithCommands = element.type as { COMMANDS?: Iterable<ProviderConstructor> };
  return new Set(typeWithCommands.COMMANDS ?? []);
}

function pickActionCallback(actions: WidgetActions | undefined, key: string): WidgetActionCallback | undefined {
  if (actions === undefined) {
    return undefined;
  }

  const candidate = actions[key];
  return typeof candidate === "function" ? (candidate as WidgetActionCallback) : undefined;
}

function createAppBindingNamespace(): BindingNamespace {
  return {
    kind: "app",
    key: "app",
    name: "app",
    nodeId: null,
  };
}

function createScreenBindingNamespace(screen: Screen): BindingNamespace {
  return {
    kind: "screen",
    key: `screen:${screen.id}`,
    name: screen.name,
    nodeId: null,
  };
}

function createWidgetBindingNamespace(widget: Widget): BindingNamespace {
  return {
    kind: "widget",
    key: `widget:${widget.nodeId}`,
    name: widget.id ?? widget.typeName,
    nodeId: widget.nodeId,
  };
}

function normalizeKeymap(input: KeymapInput): Map<string, string[]> {
  const entries = input instanceof Map ? input.entries() : Object.entries(input);
  const normalized = new Map<string, string[]>();

  for (const [bindingId, keyList] of entries) {
    normalized.set(bindingId, normalizeKeyList(keyList));
  }

  return normalized;
}

function normalizeKeyList(source: string): string[] {
  return source
    .split(",")
    .map((key) => normalizeKeyName(key).key)
    .filter((key) => key.length > 0);
}

// [LAW:single-enforcer] Modifier composition happens in one place so binding keys
// produced by Pilot, Ink's useInput, and test helpers all collapse to one grammar.
function composeKeyWithModifiers(
  baseKey: string,
  meta: { ctrl?: boolean; shift?: boolean; meta?: boolean; paste?: boolean },
): string {
  // If the base already carries modifiers (e.g., "shift+tab"), trust it verbatim.
  if (baseKey.includes("+")) {
    return baseKey.toLowerCase();
  }

  const modifiers: string[] = [];

  if (meta.ctrl) {
    modifiers.push("ctrl");
  }

  if (meta.meta) {
    modifiers.push("meta");
  }

  if (meta.shift) {
    modifiers.push("shift");
  }

  return modifiers.length === 0 ? baseKey : `${modifiers.join("+")}+${baseKey}`;
}

function focusAddressDistance(left: FocusAddress, right: FocusAddress): number {
  let shared = 0;
  const shortestLength = Math.min(left.path.length, right.path.length);

  while (shared < shortestLength && left.path[shared] === right.path[shared]) {
    shared += 1;
  }

  const siblingDistance =
    shared < left.path.length && shared < right.path.length ? Math.abs(left.path[shared] - right.path[shared]) : 0;

  return siblingDistance + (left.path.length - shared) + (right.path.length - shared);
}

function focusAddressesEqual(left: FocusAddress, right: FocusAddress): boolean {
  return (
    left.widgetId === right.widgetId &&
    left.typeName === right.typeName &&
    left.path.length === right.path.length &&
    left.path.every((segment, index) => segment === right.path[index])
  );
}

function widgetDepth(widget: Widget): number {
  let depth = 0;
  let current = widget.parent;

  while (current !== undefined) {
    depth += 1;
    current = current.parent;
  }

  return depth;
}

// Re-export select types imported solely for type context.
export type { Binding, BindingDeclaration };
