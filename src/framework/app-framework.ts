import "./mobx-config.js";

import React from "react";
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
import { type Visual, type VisualInput } from "../content/index.js";
import { Size } from "../geometry/index.js";
import {
  Notification,
  Notifications,
  type NotificationContent,
  type NotificationSeverity,
} from "../services/notifications.js";
import { Signal } from "../services/signal.js";
import { ThemeManager, type ActiveTheme, type AnsiTheme, type ThemeDefinition } from "../services/theme.js";
import { type TimerCallback, type TimerOptions } from "../services/timer.js";
import {
  Worker,
  WorkerManager,
  getCurrentWorker,
  type WorkerCallable,
  type WorkerOptions,
} from "../services/worker.js";
import { runWithActiveMessagePump } from "../services/concurrency.js";
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
import {
  StyleEngine,
  type StyleEngineDeps,
} from "./style-engine.js";
import {
  FocusEngine,
  type FocusAddress,
  type FocusEngineDeps,
} from "./focus-engine.js";
import {
  PointerEngine,
  type PointerEngineDeps,
  type PointerLocation as PointerEnginePointerLocation,
} from "./pointer-engine.js";
import {
  AsyncResourceManager,
  type AsyncResourceManagerDeps,
} from "./async-resource-manager.js";
import {
  LayoutEngine,
  type LayoutEngineDeps,
} from "./layout-engine.js";
import {
  TooltipService,
  type TooltipServiceDeps,
} from "./tooltip-service.js";
import {
  WidgetTypeRegistry,
  type WidgetTypeRegistryDeps,
} from "./widget-type-registry.js";
import {
  SignalRegistry,
  type AppSignals,
  type SignalRegistryDeps,
} from "./signal-registry.js";
import {
  BindingDispatcher,
  type BindingDispatcherDeps,
} from "./binding-dispatcher.js";
import {
  NotificationService,
  type NotificationServiceDeps,
  type NotifyOptions,
} from "./notification-service.js";

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

export interface WidgetTypeMetadata {
  typeName: string;
  typeHierarchy: string[];
  defaultStylesheets: ParsedStylesheet[];
  bindings: Binding[];
  componentClasses: string[];
  borderTitle: string | null;
  borderSubtitle: string | null;
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

// AppSignals composite is owned by SignalRegistry (extracted in 7w9.3) and
// re-exported here so existing callers that import from app-framework keep
// working unchanged until the framework barrel is removed in 7w9.10.
export type { AppSignals };

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

// NotifyOptions is owned by NotificationService (extracted in 7w9.5) and
// re-exported here so existing type-only consumers keep working until the
// framework barrel is removed in 7w9.10.
export type { NotifyOptions };

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

export class TextualFramework {
  static readonly CLICK_CHAIN_TIME_THRESHOLD = 0.5;

  readonly registry = new WidgetRegistry();
  readonly workers = new WorkerManager();
  // [LAW:single-enforcer] Notifications collection + showNotifications gate
  // live in `notificationService` (extracted in 7w9.5). The framework holds
  // only the service handle; the `notifications` getter exists so existing
  // framework.notifications consumers (TextualApp host, tests) work unchanged.
  readonly notificationService: NotificationService;
  get notifications(): Notifications {
    return this.notificationService.notifications;
  }
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
  // [LAW:single-enforcer] All stylesheet ingestion, screen-stylesheet caching,
  // CSS watching, and pending-recalc deferral state is owned by StyleEngine.
  // Framework methods below are thin delegators.
  readonly styleEngine: StyleEngine;
  // [LAW:single-enforcer] All focus-chain construction, focus traps, blur-state
  // bookkeeping, and structural-address restore live in FocusEngine. Framework
  // methods below are thin delegators; focusedNodeId remains here as the public
  // observable but is mutated only through the engine's deps callbacks.
  readonly focusEngine: FocusEngine;
  // [LAW:single-enforcer] Widget-type state lives in `widgetTypeRegistry`
  // (extracted in 7w9.2). The framework holds only the service handle.
  readonly widgetTypeRegistry: WidgetTypeRegistry;
  // [LAW:single-enforcer] All timer registry, app worker-owner, and
  // foreign-thread marshaling state lives in AsyncResourceManager. Framework
  // methods below are thin delegators.
  readonly asyncResources: AsyncResourceManager;
  // [LAW:single-enforcer] All post-render callback queue, layout-reader
  // subscription, and after-refresh requester state lives in LayoutEngine.
  // displayCount remains the public observable here, written via deps.
  readonly layoutEngine: LayoutEngine;
  // [LAW:single-enforcer] Tooltip reveal-pipeline timer and active-tooltip
  // mutation live in TooltipService. activeTooltip / showTooltips / tooltipDelay
  // remain public observables here, with the service writing activeTooltip via
  // deps.
  readonly tooltipService: TooltipService;
  // [LAW:single-enforcer] App-binding / keymap / action-dispatch state lives
  // in `bindingDispatcher` (extracted in 7w9.4). The framework holds only the
  // service handle.
  readonly bindingDispatcher: BindingDispatcher;
  private appCommandProviders: ReadonlySet<ProviderConstructor> | null = null;
  private systemCommandResolver: SystemCommandResolver = () => [];
  private appAutoFocus: string | null = null;
  // [LAW:single-enforcer] showNotifications is owned by notificationService.
  // Surface a getter here so existing framework.showNotifications consumers
  // (TextualApp host) keep working unchanged.
  get showNotifications(): boolean {
    return this.notificationService.showNotifications;
  }
  showTooltips = true;
  tooltipDelay = 500;
  activeTooltip: ActiveTooltip | null = null;
  pointerShape: PointerShape = "default";
  pointerEngine!: PointerEngine;
  private pendingError: unknown = null;
  // [LAW:single-enforcer] Signal state lives in `signalRegistry` (extracted
  // in 7w9.3). The framework holds only the service handle.
  readonly signalRegistry: SignalRegistry;
  private isClosing = false;
  private readyMessagePosted = false;
  batchUpdateCount = 0;
  activeCommandPalette: CommandPalette | null = null;
  private publicApp: unknown = null;
  // [LAW:single-enforcer] `signals` is a re-exposed view of signalRegistry's
  // composite so existing consumers (framework.signals.X.publish/subscribe)
  // and audit-§4.2's App.signals namespace continue to work unchanged.
  get signals(): AppSignals {
    return this.signalRegistry.signals;
  }

  constructor(options: TextualFrameworkOptions = {}) {
    const featureState = parseTextualFeatures(options.env?.TEXTUAL ?? process.env.TEXTUAL ?? "");

    this.driver = options.driver ?? new HeadlessDriver();
    this.features = featureState.features;
    this.devtools = featureState.devtools;
    this.debug = featureState.debug;

    // [LAW:single-enforcer] SignalRegistry receives only the cross-cutting
    // hooks it needs (run-state probe + node-mounted probe + callLater
    // scheduler). It does NOT receive a back-reference to the framework.
    const signalRegistryDeps: SignalRegistryDeps = {
      isRunning: () => this.isRunning,
      isNodeMounted: (node) => this.isNodeMounted(node),
      callLater: (callback) => this.callLater(callback),
    };
    this.signalRegistry = new SignalRegistry(signalRegistryDeps);

    // [LAW:single-enforcer] StyleEngine is constructed with a narrow deps
    // interface — the framework supplies only the cross-cutting hooks the
    // engine needs (batch state, debug flag, screen iteration, recalc trigger).
    // The engine does NOT receive a back-reference to the framework.
    const styleEngineDeps: StyleEngineDeps = {
      isInBatch: () => this.batchUpdateCount > 0,
      isDebug: () => this.debug,
      iterScreens: () => this.screenStack.iterAllStacks(),
      recalculateStyles: () => this.recalculateStyles(),
    };
    const initialCssPath =
      typeof options.cssPath === "string" ? [options.cssPath] : [...(options.cssPath ?? [])];
    this.styleEngine = new StyleEngine(styleEngineDeps, initialCssPath);

    // [LAW:single-enforcer] ScreenStackService is constructed with a narrow
    // deps interface — the framework supplies only the cross-cutting hooks the
    // service needs (style resolution, command-provider extraction). The
    // service does NOT receive a back-reference to the framework.
    const screenStackDeps: ScreenStackDeps = {
      readScreenStylesheetState: (element, options) => this.styleEngine.readScreenStylesheetState(element, options),
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
      resolveBindingsForNode: (node) => this.bindingDispatcher.resolveBindingsForNode(node),
      dispatchScreenKeyBindings: (key) => this.bindingDispatcher.dispatchScreenKeyBindings(key),
      dispatchBindingActionForNode: (node, action) =>
        this.bindingDispatcher.dispatchBindingActionForNode(node, action),
      dispatchPriorityBindings: (key) => this.bindingDispatcher.dispatchPriorityBindings(key),
      resolveDefaultDispatchTarget: () => this.bindingDispatcher.resolveDefaultDispatchTarget(),
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

    // [LAW:single-enforcer] FocusEngine receives only the cross-cutting hooks
    // it needs (focused-node accessor, registry reads, recalc/binding/blur
    // notifications, after-refresh scheduler, selector helpers). It does NOT
    // receive a back-reference to the framework.
    const focusEngineDeps: FocusEngineDeps = {
      getFocusedNodeId: () => this.focusedNodeId,
      setFocusedNodeId: (id) => {
        this.focusedNodeId = id;
      },
      getActiveScreen: () => this.activeScreen,
      getAppAutoFocus: () => this.appAutoFocus,
      isRunning: () => this.isRunning,
      listWidgets: () => this.registry.list(),
      getWidget: (id) => this.registry.get(id),
      getChildren: (parentId) => this.registry.getChildren(parentId),
      recalculateStyles: () => this.recalculateStyles(),
      notifyBindingsUpdated: () => this.notifyBindingsUpdated(),
      enqueueFocusBlur: (prev, next) => this.pump.enqueueFocusBlur(prev, next),
      callAfterRefresh: (callback) => this.callAfterRefresh(callback),
      parseSelectors: (text) => this.parseSelectors(text),
      matchesSelector: (widget, selector) => this.matchesSelector(widget, selector as ParsedSelector),
      resolveWidgetTypeName: (typeConstraint) => this.resolveWidgetTypeName(typeConstraint),
    };
    this.focusEngine = new FocusEngine(focusEngineDeps);

    // [LAW:single-enforcer] PointerEngine receives only the cross-cutting hooks
    // it needs (registry reads, dispatch fallbacks, ancestor focus check, post,
    // focus, recalc, pointer-shape setter, hover side-effect callbacks). It
    // does NOT receive a back-reference to the framework.
    const pointerEngineDeps: PointerEngineDeps = {
      listWidgets: () => this.registry.list(),
      getWidget: (id) => this.registry.get(id),
      getRootChildren: () => this.registry.getChildren(null),
      resolveDefaultDispatchTarget: () => this.bindingDispatcher.resolveDefaultDispatchTarget(),
      ancestorsAllowFocus: (widget) => this.focusEngine.ancestorsAllowFocus(widget),
      postMessage: (id, message) => this.postMessage(id, message),
      focusWidget: (id) => this.focusWidget(id),
      recalculateStyles: () => this.recalculateStyles(),
      setPointerShape: (shape) => {
        this.pointerShape = shape as PointerShape;
      },
      onHoverChanged: () => {
        this.hideTooltip();
        this.refreshTooltipFromHover();
      },
      onPointerMovedSameHover: (pointer) => {
        if (this.activeTooltip?.sourceNodeId === this.hoveredNodeId && this.hoveredNodeId !== null) {
          this.activeTooltip = {
            ...this.activeTooltip,
            x: pointer.x,
            y: pointer.y,
          };
          return;
        }
        this.refreshTooltipFromHover();
      },
      clickChainTimeThreshold: TextualFramework.CLICK_CHAIN_TIME_THRESHOLD,
    };
    this.pointerEngine = new PointerEngine(pointerEngineDeps);

    // [LAW:single-enforcer] AsyncResourceManager receives only the cross-cutting
    // hooks it needs (worker manager handle, mounted check, timer dispatch,
    // post/callLater/error reporting, run-state, own-pump check). It does NOT
    // receive a back-reference to the framework.
    const asyncResourceDeps: AsyncResourceManagerDeps = {
      workers: this.workers,
      isNodeMounted: (node) => this.isNodeMounted(node),
      dispatchTimer: (node, message) => {
        void this.pump.dispatchToWidgetImmediate(node, message);
      },
      postMessage: (id, message) => this.postMessage(id, message),
      reportUnhandledError: (error) => this.reportUnhandledError(error),
      callLater: (callback) => this.callLater(callback),
      isRunning: () => this.isRunning,
      isOwnPump: (pump) => pump === this || (pump instanceof Widget && pump.framework === this),
    };
    this.asyncResources = new AsyncResourceManager(asyncResourceDeps);

    // [LAW:single-enforcer] LayoutEngine receives only the cross-cutting hooks
    // it needs (callLater, host-pump runner, displayCount writer). It does
    // NOT receive a back-reference to the framework.
    const layoutEngineDeps: LayoutEngineDeps = {
      callLater: (callback) => this.callLater(callback),
      runWithHostPump: (callback) => {
        runWithActiveMessagePump(this, callback);
      },
      incrementDisplayCount: () => {
        this.displayCount += 1;
      },
    };
    this.layoutEngine = new LayoutEngine(layoutEngineDeps);

    // [LAW:single-enforcer] TooltipService receives only the cross-cutting hooks
    // it needs (active-tooltip view-model accessor/writer, hover/pointer/widget
    // reads, tooltip config getters). It does NOT receive a back-reference to
    // the framework.
    const tooltipServiceDeps: TooltipServiceDeps = {
      setActiveTooltip: (tooltip) => {
        this.activeTooltip = tooltip;
      },
      getActiveTooltip: () => this.activeTooltip,
      getHoveredNodeId: () => this.hoveredNodeId,
      getLastPointerLocation: () => this.lastPointerLocation,
      getWidget: (id) => this.registry.get(id),
      getShowTooltips: () => this.showTooltips,
      getTooltipDelay: () => this.tooltipDelay,
    };
    this.tooltipService = new TooltipService(tooltipServiceDeps);

    // [LAW:single-enforcer] WidgetTypeRegistry receives only the cross-cutting
    // hooks it needs (run-state probe + style-recalc trigger for the existing-
    // type-update path). It does NOT receive a back-reference to the framework.
    const widgetTypeRegistryDeps: WidgetTypeRegistryDeps = {
      isRunning: () => this.isRunning,
      recalculateStyles: () => this.recalculateStyles(),
    };
    this.widgetTypeRegistry = new WidgetTypeRegistry(widgetTypeRegistryDeps);

    // [LAW:single-enforcer] BindingDispatcher receives only the cross-cutting
    // hooks it needs (navigation default actions, focused-node + active-screen
    // resolution, bindings_updated publish, app-overridable clash report). It
    // does NOT receive a back-reference to the framework.
    const bindingDispatcherDeps: BindingDispatcherDeps = {
      focusNext: () => {
        this.focusNext();
      },
      focusPrevious: () => {
        this.focusPrevious();
      },
      exit: () => {
        this.exit();
      },
      openCommandPalette: () => {
        void this.openCommandPalette();
      },
      getFocusedNodeId: () => this.focusedNodeId,
      getWidget: (id) => this.registry.get(id),
      listWidgets: () => this.registry.list(),
      getActiveScreen: () => this.activeScreen,
      publishBindingsUpdated: () => {
        this.signals.bindings_updated_signal.publish(undefined);
      },
      reportBindingsClash: (clashes, namespace) => {
        this.handleBindingsClash(clashes, namespace);
      },
    };
    this.bindingDispatcher = new BindingDispatcher(bindingDispatcherDeps, APP_NAVIGATION_BINDINGS);

    // [LAW:single-enforcer] NotificationService receives only the cross-cutting
    // hook it needs (postAppMessage for the Notify event). It does NOT receive
    // a back-reference to the framework.
    const notificationServiceDeps: NotificationServiceDeps = {
      postAppMessage: (message) => this.postAppMessage(message),
    };
    this.notificationService = new NotificationService(notificationServiceDeps);

    makeAutoObservable(
      this,
      {
        widgetTypeRegistry: false,
        bindingDispatcher: false,
        notificationService: false,
        layoutEngine: false,
        tooltipService: false,
        signalRegistry: false,
        asyncResources: false,
        driver: false,
        features: false,
        devtools: false,
        activeCommandPalette: false,
        workers: false,
        themeManager: false,
        screenStack: false,
        pump: false,
        styleEngine: false,
        appCommandProviders: false,
        systemCommandResolver: false,
        handleBindingsClash: false,
        focusEngine: false,
        pointerEngine: false,
        publicApp: false,
      } as never,
      { autoBind: true },
    );
  }

  // [LAW:single-enforcer] App-binding / keymap / action-dispatch entry points
  // delegate to BindingDispatcher (extracted in 7w9.4). Framework retains the
  // public method surface only to keep existing consumers stable until 7w9.10
  // deletes the framework class.
  setAppBindings(declarations: Iterable<BindingDeclaration>): void {
    this.bindingDispatcher.setAppBindings(declarations);
  }

  setKeymap(next: KeymapInput): void {
    this.bindingDispatcher.setKeymap(next);
  }

  updateKeymap(patch: KeymapInput): void {
    this.bindingDispatcher.updateKeymap(patch);
  }

  setAppActions(actions: WidgetActions | undefined): void {
    this.bindingDispatcher.setAppActions(actions);
  }

  setAppAutoFocus(selector: string | null | undefined): void {
    this.appAutoFocus = selector ?? null;

    if (this.isRunning && !this.focusEngine.isAppBlurred && this.focusedNodeId === null) {
      this.focusEngine.scheduleActiveScreenFocusResolution(true);
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
    this.notificationService.setShowNotifications(enabled);
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
        this.styleEngine.flushPendingRecalc();
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
      this.focusEngine.scheduleActiveScreenFocusResolution(true);
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
    this.styleEngine.resetPendingRecalc();
    this.pump.resetBatchPending();
    this.pump.discardQueuedCallbacks();
    this.focusedNodeId = null;
    this.pointerEngine.reset();
    this.workers.cancelAll();
    this.asyncResources.clearAllTimers();
    this.clearTooltipTimer();
    this.activeTooltip = null;
    this.styleEngine.closeAllWatchers();
    this.focusEngine.resetBlurState();
    this.isRunning = false;
    this.pump.emitCloseMessages();
    this.signals.app_suspend_signal.publish(undefined);
  }

  exit(result?: unknown): unknown {
    this.exitResult = result;
    this.shutdown();
    return result;
  }

  // [LAW:single-enforcer] All widget-type lookup/registration delegates to the
  // dedicated WidgetTypeRegistry service (extracted in 7w9.2). Framework
  // retains these methods only to keep the existing public API stable until
  // 7w9.10 deletes the framework class.
  getWidgetTypeMetadata(typeName: string): WidgetTypeMetadata {
    return this.widgetTypeRegistry.getWidgetTypeMetadata(typeName);
  }

  widgetMatchesType(typeName: string, expectedTypeName: string): boolean {
    return this.widgetTypeRegistry.widgetMatchesType(typeName, expectedTypeName);
  }

  resolveWidgetTypeName(typeConstraint: string | Function): string {
    return this.widgetTypeRegistry.resolveWidgetTypeName(typeConstraint);
  }

  registerWidgetType(typeName: string, defaultCss?: string): void;
  registerWidgetType(typeName: string, options?: RegisterWidgetTypeOptions): void;
  registerWidgetType(typeName: string, options: string | RegisterWidgetTypeOptions = {}): void {
    this.widgetTypeRegistry.registerWidgetType(typeName, options as RegisterWidgetTypeOptions);
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
    this.asyncResources.clearNodeTimers(widget.nodeId);
    this.handleWidgetWillUnmount(widget);
    this.pump.closeMessageQueue(widget.nodeId);

    void this.pump.dispatchUnmountImmediate(widget, new Unmount({ bubble: false }));
  }

  unregisterWidget(nodeId: string): void {
    const hadFocus = this.focusedNodeId === nodeId;

    this.pointerEngine.forgetWidgetHover(nodeId);

    this.focusEngine.releaseTrapIfNode(nodeId);

    this.registry.deregister(nodeId);
    // [LAW:single-enforcer] Unmount-driven signal cleanup flows through the
    // SignalRegistry so every widget removal prunes subscriptions through
    // exactly one entry point.
    this.signalRegistry.pruneNode(nodeId);
    this.pump.markWidgetClosed(nodeId);
    this.recalculateStyles();

    if (hadFocus) {
      // [LAW:single-enforcer] Focus recovery after removal enters through the
      // framework focus boundary rather than direct widget mutation.
      this.focusEngine.applyFocusChange(this.getFocusChain()[0]?.nodeId ?? null, { markBlurOverride: true });
    }
  }

  // [LAW:single-enforcer] All focus-API methods delegate to FocusEngine which
  // owns chain construction, traps, and blur bookkeeping.
  focusWidget(nodeId: string | null): void {
    this.focusEngine.focusWidget(nodeId);
  }

  clearFocusWithin(container: Widget): void {
    this.focusEngine.clearFocusWithin(container);
  }

  trapFocus(widget: Widget, enabled = true): void {
    this.focusEngine.trapFocus(widget, enabled);
  }

  getFocusChain(): Widget[] {
    return this.focusEngine.getFocusChain();
  }

  focusNext(selector?: string | Function): Widget | null {
    return this.focusEngine.focusNext(selector);
  }

  focusPrevious(selector?: string | Function): Widget | null {
    return this.focusEngine.focusPrevious(selector);
  }

  setTerminalSize(size: Size): void {
    if (this.terminalSize.equals(size)) {
      return;
    }

    this.terminalSize = size;
    this.recalculateStyles();
  }

  setUserStylesheet(source: string): void {
    this.styleEngine.setUserStylesheet(source);
  }

  setCssPath(path: string | readonly string[]): void {
    this.styleEngine.setCssPath(path);
  }

  _on_css_change(): void {
    this.styleEngine.onCssChange();
  }

  _onCssChange(): void {
    this.styleEngine.onCssChange();
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
    this.asyncResources.pauseAllTimers();
    await this.driver.suspendApplicationMode();

    try {
      return await callback();
    } finally {
      await this.driver.resumeApplicationMode();
      this.asyncResources.resumeAllTimers();
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
    return this.styleEngine.getActiveStylesheetsFor(
      this.getWidgetTypeMetadata(typeName).defaultStylesheets,
      this.activeScreen?.stylesheets ?? [],
    );
  }

  parseSelectors(selectorText: string): ParsedSelector[] {
    return parseSelectorList(selectorText);
  }

  matchesSelector(widget: Widget, selector: ParsedSelector): boolean {
    return selectorMatchesWidget(this, widget, selector);
  }

  // [LAW:locality-or-seam] Thin delegators so TextualFramework structurally
  // satisfies SelectorMatchHost (defined in src/styles/selectors.ts). The
  // styles modules depend on a narrow capability shape — never on this class.
  getPreviousSibling(nodeId: string): Widget | undefined {
    return this.registry.getPreviousSibling(nodeId);
  }

  getPreviousSiblings(nodeId: string): Widget[] {
    return this.registry.getPreviousSiblings(nodeId);
  }

  refreshStyles(changed: boolean): void {
    this.registry.touch();
    this.styleEngine.refreshStyles(changed);
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
    this.pointerEngine.dispatchPointerClick(screenX, screenY, chain);
  }

  postMouseDown(x: number, y: number): void {
    this.postToFocused(new MouseDown(x, y));
  }

  dispatchPointerDown(screenX: number, screenY: number): void {
    this.pointerEngine.dispatchPointerDown(screenX, screenY);
  }

  postMouseUp(x: number, y: number): void {
    this.postToFocused(new MouseUp(x, y));
  }

  dispatchPointerUp(screenX: number, screenY: number): void {
    this.pointerEngine.dispatchPointerUp(screenX, screenY);
  }

  postMouseMove(x: number, y: number): void {
    this.postToFocused(new MouseMove(x, y));
  }

  dispatchPointerMove(screenX: number, screenY: number): void {
    this.pointerEngine.dispatchPointerMove(screenX, screenY);
  }

  get hoveredNodeId(): string | null {
    return this.pointerEngine.hoveredNodeId;
  }

  private get lastPointerLocation(): PointerEnginePointerLocation | null {
    return this.pointerEngine.lastPointerLocation;
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
    return this.pointerEngine.hitTest(screenX, screenY);
  }

  isNodeMounted(widget: Widget): boolean {
    return this.registry.get(widget.nodeId) === widget;
  }

  // [LAW:single-enforcer] Per-widget Signal construction delegates to the
  // SignalRegistry service (extracted in 7w9.3).
  createSignal<TValue>(owner: Widget, description = ""): Signal<TValue> {
    return this.signalRegistry.createSignal<TValue>(owner, description);
  }

  runWorker<TResult>(
    node: Widget,
    work: WorkerCallable<TResult>,
    options: WorkerOptions = {},
  ): Worker<TResult> {
    return this.asyncResources.runWorker(node, work, options);
  }

  runAppWorker<TResult>(work: WorkerCallable<TResult>, options: WorkerOptions = {}): Worker<TResult> {
    return this.asyncResources.runAppWorker(work, options);
  }

  setTimer(node: Widget, name: string, delayMs: number, callback: TimerCallback): void {
    this.asyncResources.setTimer(node, name, delayMs, callback);
  }

  setInterval(node: Widget, name: string, intervalMs: number, callback: TimerCallback, options: TimerOptions = {}): void {
    this.asyncResources.setInterval(node, name, intervalMs, callback, options);
  }

  clearTimer(node: Widget, name: string): void {
    this.asyncResources.clearTimer(node, name);
  }

  pauseTimer(node: Widget, name: string): void {
    this.asyncResources.pauseTimer(node, name);
  }

  resumeTimer(node: Widget, name: string): void {
    this.asyncResources.resumeTimer(node, name);
  }

  resetTimer(node: Widget, name: string): void {
    this.asyncResources.resetTimer(node, name);
  }

  // [LAW:single-enforcer] Notification entry points delegate to
  // NotificationService (extracted in 7w9.5). Framework retains the public
  // method surface as thin delegators until 7w9.10 deletes the framework
  // class.
  notify(
    message: NotificationContent,
    severityOrOptions: NotificationSeverity | NotifyOptions = "information",
    timeout = Notification.timeout,
    title: NotificationContent = "",
    markup = true,
  ): Notification {
    return this.notificationService.notify(message, severityOrOptions, timeout, title, markup);
  }

  dismissNotification(identity: string): void {
    this.notificationService.dismissNotification(identity);
  }

  clearNotifications(): void {
    this.notificationService.clearNotifications();
  }

  _unnotify(notification: Notification): void {
    this.notificationService.unnotify(notification);
  }

  callLater<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.pump.callLater(callback, ...args);
  }

  callNext<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.pump.callNext(callback, ...args);
  }

  callAfterRefresh<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.layoutEngine.callAfterRefresh(callback, ...args);
  }

  callFromThread<TResult, TArgs extends unknown[]>(callback: (...args: TArgs) => TResult, ...args: TArgs): Promise<TResult> {
    return this.asyncResources.callFromThread(callback, ...args);
  }

  call_from_thread<TResult, TArgs extends unknown[]>(callback: (...args: TArgs) => TResult, ...args: TArgs): Promise<TResult> {
    return this.asyncResources.call_from_thread(callback, ...args);
  }

  handleAppBlur(): void {
    if (this.focusEngine.isAppBlurred) {
      return;
    }

    this.focusEngine.beginAppBlur();
    this.hideTooltip();
    this.pump.emitBroadcast(new AppBlur());
    this.focusEngine.applyFocusChange(null, { markBlurOverride: false });
  }

  handleAppFocus(): void {
    this.pump.emitBroadcast(new AppFocus());

    if (!this.focusEngine.isAppBlurred) {
      return;
    }

    const { shouldRestore, address } = this.focusEngine.endAppBlur();

    if (!shouldRestore) {
      return;
    }

    const target = address === null ? null : this.focusEngine.resolveExactFocusTarget(address);
    this.focusEngine.applyFocusChange(target?.nodeId ?? null, { markBlurOverride: false });
  }

  attachAfterRefreshRequester(requester: () => void): () => void {
    return this.layoutEngine.attachAfterRefreshRequester(requester);
  }

  recordDisplayPass(): void {
    this.layoutEngine.recordDisplayPass();
  }

  registerLayoutReader(nodeId: string, reader: () => void): () => void {
    return this.layoutEngine.registerLayoutReader(nodeId, reader);
  }

  flushAfterRefreshCallbacks(): void {
    this.layoutEngine.flushAfterRefreshCallbacks();
  }

  handleWidgetTooltipChange(widget: Widget): void {
    this.tooltipService.handleWidgetTooltipChange(widget);
  }

  private refreshTooltipFromHover(): void {
    this.tooltipService.refreshTooltipFromHover();
  }

  private hideTooltip(): void {
    this.tooltipService.hideTooltip();
  }

  private clearTooltipTimer(): void {
    this.tooltipService.clearTooltipTimer();
  }

  private syncPointerStateAfterLayout(): void {
    const result = this.pointerEngine.recomputeHoverFromLastPointer();

    if (!result.hadPointer) {
      this.hideTooltip();
      return;
    }

    if (result.hoveredChanged) {
      this.hideTooltip();
      this.recalculateStyles();
      return;
    }

    if (this.activeTooltip !== null) {
      const source = this.registry.get(this.activeTooltip.sourceNodeId);

      if (source === undefined || !source.isInteractive || result.hit?.nodeId !== source.nodeId) {
        this.hideTooltip();
      }
    }
  }

  private handleWidgetWillUnmount(widget: Widget): void {
    if (this.pointerEngine.forgetWidgetHover(widget.nodeId)) {
      this.hideTooltip();
    }

    if (this.activeTooltip?.sourceNodeId === widget.nodeId) {
      this.hideTooltip();
    }
  }

  private clearPointerState(): void {
    this.pointerEngine.clearPointerState();
    this.hideTooltip();
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
    this.styleEngine.refreshCssWatchers();
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
    return this.bindingDispatcher.getActiveBindings();
  }

  pushScreen(descriptor: ScreenDescriptor, callbackOrOptions?: ((result: unknown) => void) | ScreenOptions, extraOptions?: ScreenOptions): Screen {
    const { callback, options } = normalizePushArgs(callbackOrOptions, extraOptions);
    const element = this.screenStack.resolveScreenElement(descriptor);
    const entry = this.makeScreenEntry(element, { ...options, callback });

    this.clearPointerState();
    this.suspendCurrentScreen();

    this.screenStack.pushEntry(entry);
    this.styleEngine.refreshCssWatchers();

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
    this.styleEngine.refreshCssWatchers();

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
    this.styleEngine.refreshCssWatchers();

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
    return this.bindingDispatcher.runAction(action, defaultTarget);
  }

  checkAction(action: string, defaultTarget?: ActionTargetDescriptor): boolean | null {
    return this.bindingDispatcher.checkAction(action, defaultTarget);
  }

  private suspendCurrentScreen(): void {
    const screen = this.activeScreen;

    if (screen === null) {
      return;
    }

    this.focusEngine.saveScreenFocusSnapshot(screen);
    this.pump.emitBroadcast(new ScreenSuspend(screen.name));
  }

  private resumeActiveScreen(): void {
    const screen = this.activeScreen;

    if (screen === null) {
      return;
    }

    this.pump.emitBroadcast(new ScreenResume(screen.name));
    this.focusEngine.scheduleActiveScreenFocusResolution(true);
  }

  // [LAW:single-enforcer] Binding/action dispatch lives in BindingDispatcher
  // (extracted in 7w9.4). Framework retains the public methods only as thin
  // delegators until 7w9.10 deletes the framework class.
  notifyBindingsUpdated(): void {
    this.bindingDispatcher.notifyBindingsUpdated();
  }

  dispatchNodeKeyBindings(node: Widget, key: string): boolean {
    return this.pump.dispatchNodeKeyBindings(node, key);
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

  private getGlobalStyleVariables(): Record<string, string> {
    return this.themeManager.getCssVariables();
  }
}

export interface ActionTargetDescriptor {
  actions: WidgetActions | undefined;
}

function readCommandProvidersFromElement(element: React.ReactElement): ReadonlySet<ProviderConstructor> {
  const typeWithCommands = element.type as { COMMANDS?: Iterable<ProviderConstructor> };
  return new Set(typeWithCommands.COMMANDS ?? []);
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

// Re-export select types imported solely for type context.
export type { Binding, BindingDeclaration };
