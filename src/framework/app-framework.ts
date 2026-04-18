import React from "react";
import { makeAutoObservable, runInAction } from "mobx";

import {
  AppBlur,
  AppFocus,
  Blur,
  Callback,
  Click,
  Compose,
  Focus,
  Idle,
  Key,
  ModeChanged,
  Mount,
  MouseDown,
  MouseMove,
  MouseUp,
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
import { measureVisual, visualize, type Visual, type VisualInput } from "../content/index.js";
import { Size } from "../geometry/index.js";
import { Notification, Notifications, type NotificationSeverity } from "../services/notifications.js";
import { Signal } from "../services/signal.js";
import { ThemeManager, type ActiveTheme, type ThemeDefinition } from "../services/theme.js";
import { ManagedTimer, type TimerCallback, type TimerOptions } from "../services/timer.js";
import { Worker, WorkerManager, getCurrentWorker, type WorkFunction, type WorkerOptions } from "../services/worker.js";
import {
  matchesSelector as selectorMatchesWidget,
  parseSelectorList,
  resolveStylesForWidget,
  type ParsedSelector,
  type ParsedStylesheet,
  parseTcss,
} from "../styles/index.js";
import { WidgetNode } from "./widget-node.js";
import {
  discoverOnHandlers,
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

interface QueuedMessage {
  targetId: string | null;
  targetNode?: WidgetNode;
  message: Message;
}

interface WidgetTypeState {
  defaultCss?: string;
  defaultStylesheet?: ParsedStylesheet;
}

interface ScreenFactoryRecord {
  factory: () => React.ReactElement;
  cachedElement: React.ReactElement | null;
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
}

export interface ScreenEntry {
  id: string;
  name: string | null;
  element: React.ReactElement | null;
  bindings: Binding[];
  actions: WidgetActions | undefined;
  autoFocus: string | null;
  implicit: boolean;
  savedFocusNodeId: string | null;
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

type MessageSubscriber = (message: Message) => void;
type AfterRefreshCallback = () => void;

export interface AppSignals {
  theme_changed_signal: Signal<ActiveTheme>;
  app_suspend_signal: Signal<void>;
  app_resume_signal: Signal<void>;
  mode_change_signal: Signal<string>;
  screen_change_signal: Signal<string | null>;
  bindings_updated_signal: Signal<void>;
}

export interface PointerLocation {
  x: number;
  y: number;
}

export interface ActiveTooltip {
  sourceNodeId: string;
  visual: Visual;
  x: number;
  y: number;
  visible: boolean;
}

export class ScreenStackError extends Error {}

export class UnknownModeError extends Error {}

export class InvalidModeError extends Error {}

export class ActiveModeError extends Error {}

function normalizeCssSource(source: string | undefined): string | undefined {
  const normalizedSource = source?.trim();
  return normalizedSource === undefined || normalizedSource.length === 0 ? undefined : normalizedSource;
}

function coerceWidgetNode(value: unknown): WidgetNode | null {
  return value instanceof WidgetNode ? value : null;
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

const DEFAULT_MODE = "_default";
const APP_NAVIGATION_BINDINGS: BindingDeclaration[] = [
  { key: "tab", action: "app.focus_next" },
  { key: "shift+tab", action: "app.focus_previous" },
  { key: "ctrl+q", action: "app.quit", priority: true },
  { key: "ctrl+c", action: "app.quit" },
  { key: "ctrl+p", action: "app.command_palette" },
];

let nextScreenId = 1;
interface FocusAddress {
  path: number[];
  widgetId: string | null;
  typeName: string;
}

export class TextualFramework {
  readonly registry = new WidgetRegistry();
  readonly workers = new WorkerManager();
  readonly notifications = new Notifications();
  readonly themeManager = new ThemeManager();
  focusedNodeId: string | null = null;
  isRunning = false;
  exitResult: unknown = undefined;
  theme = "default";
  displayCount = 0;
  terminalSize = new Size(80, 24);
  activeMode = DEFAULT_MODE;
  private readonly modeStacks = new Map<string, ScreenEntry[]>();
  private readonly modeFactories = new Map<string, () => React.ReactElement>();
  private readonly installedScreens = new Map<string, ScreenFactoryRecord>();
  private readonly queue: QueuedMessage[] = [];
  private drainPromise: Promise<void> | null = null;
  private userStylesheets: ParsedStylesheet[] = [];
  private readonly widgetTypes = new Map<string, WidgetTypeState>();
  private readonly messageSubscribers = new Set<MessageSubscriber>();
  private readonly timers = new Map<string, ManagedTimer>();
  private readonly afterRefreshCallbacks: AfterRefreshCallback[] = [];
  private afterRefreshRequester: (() => void) | null = null;
  private appBindings: Binding[] = [];
  private appActions: WidgetActions | undefined = undefined;
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
  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  readonly signals: AppSignals;
  screenStackVersion = 0;

  constructor() {
    this.signals = {
      theme_changed_signal: this.createFrameworkSignal<ActiveTheme>(),
      app_suspend_signal: this.createFrameworkSignal<void>(),
      app_resume_signal: this.createFrameworkSignal<void>(),
      mode_change_signal: this.createFrameworkSignal<string>(),
      screen_change_signal: this.createFrameworkSignal<string | null>(),
      bindings_updated_signal: this.createFrameworkSignal<void>(),
    };

    // [LAW:one-source-of-truth] The default mode always carries an implicit base
    // entry; popScreen's "last screen" invariant reads from stack length, which
    // means that phantom is the single anchor preventing an empty default stack.
    this.modeStacks.set(DEFAULT_MODE, [createImplicitEntry()]);
    this.appBindings = makeBindings(APP_NAVIGATION_BINDINGS);
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
    };

    makeAutoObservable(
      this,
      {
        queue: false,
        drainPromise: false,
        widgetTypes: false,
        messageSubscribers: false,
        timers: false,
        afterRefreshCallbacks: false,
        afterRefreshRequester: false,
        signals: false,
        workers: false,
        notifications: false,
        themeManager: false,
        modeStacks: false,
        modeFactories: false,
        installedScreens: false,
        appBindings: false,
        appActions: false,
        keymap: false,
        tooltipTimer: false,
        lastActionDispatchResult: false,
        bindingClashSignatures: false,
        handleBindingsClash: false,
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
        return undefined;
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

  handleBindingsClash(_clashes: BindingClash[], _namespace: BindingNamespace): void {
    // Default no-op; apps may override to surface clashes.
  }

  startup(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.signals.app_resume_signal.publish(undefined);

    for (const widget of this.registry.list()) {
      this.enqueueLifecycleMessages(widget);
    }

    if (this.focusedNodeId === null) {
      this.scheduleActiveScreenFocusResolution(true);
    }
  }

  shutdown(): void {
    this.queue.length = 0;
    this.focusedNodeId = null;
    this.hoveredNodeId = null;
    this.workers.cancelAll();
    this.clearAllTimers();
    this.clearTooltipTimer();
    this.activeTooltip = null;
    this.lastPointerLocation = null;
    this.isAppBlurred = false;
    this.blurredFocusAddress = null;
    this.focusChangedWhileBlurred = false;
    this.isRunning = false;
    this.signals.app_suspend_signal.publish(undefined);
  }

  exit(result?: unknown): unknown {
    this.exitResult = result;
    this.shutdown();
    return result;
  }

  registerWidgetType(typeName: string, defaultCss?: string): void {
    const normalizedDefaultCss = normalizeCssSource(defaultCss);
    const existing = this.widgetTypes.get(typeName);

    if (existing === undefined) {
      this.widgetTypes.set(typeName, {
        defaultCss: normalizedDefaultCss,
        defaultStylesheet:
          normalizedDefaultCss === undefined
            ? undefined
            : parseTcss(normalizedDefaultCss, {
                origin: "default",
                scopeTypeName: typeName,
              }),
      });

      return;
    }

    if (normalizedDefaultCss === undefined || existing.defaultCss === normalizedDefaultCss) {
      return;
    }

    if (existing.defaultCss !== undefined) {
      // [LAW:one-source-of-truth] DEFAULT_CSS is canonical per widget type.
      // Conflicting declarations must fail instead of silently picking one mount.
      throw new Error(`Widget type "${typeName}" registered with conflicting DEFAULT_CSS`);
    }

    existing.defaultCss = normalizedDefaultCss;
    existing.defaultStylesheet = parseTcss(normalizedDefaultCss, {
      origin: "default",
      scopeTypeName: typeName,
    });

    if (this.isRunning) {
      this.recalculateStyles();
    }
  }

  registerWidget(widget: WidgetNode): void {
    this.registry.register(widget);

    if (widget.autoFocus) {
      this.focusWidget(widget.nodeId);
    }

    this.recalculateStyles();

    if (this.isRunning) {
      this.enqueueLifecycleMessages(widget);
    }
  }

  notifyWillUnmount(widget: WidgetNode): void {
    this.workers.cancelNode(widget.nodeId);
    this.clearNodeTimers(widget.nodeId);
    this.handleWidgetWillUnmount(widget);

    void this.dispatchQueuedMessage({
      targetId: null,
      targetNode: widget,
      message: this.withSender(new Unmount({ bubble: false }), widget),
    });
  }

  unregisterWidget(nodeId: string): void {
    if (this.focusedNodeId === nodeId) {
      this.focusedNodeId = null;
    }

    if (this.hoveredNodeId === nodeId) {
      this.hoveredNodeId = null;
    }

    this.registry.deregister(nodeId);
    this.recalculateStyles();
  }

  focusWidget(nodeId: string | null): void {
    this.applyFocusChange(nodeId, { markBlurOverride: true });
  }

  getFocusChain(): WidgetNode[] {
    return this.registry.list().filter((widget) => {
      if (!widget.focusable) {
        return false;
      }

      if (widget.isDisabledEffective || widget.isLoadingEffective) {
        return false;
      }

      return widget.isInteractive;
    });
  }

  focusNext(): WidgetNode | null {
    return this.moveFocus(1);
  }

  focusPrevious(): WidgetNode | null {
    return this.moveFocus(-1);
  }

  private moveFocus(direction: 1 | -1): WidgetNode | null {
    const chain = this.getFocusChain();

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
    this.userStylesheets = source.trim().length === 0 ? [] : [parseTcss(source, { origin: "user" })];
    this.recalculateStyles();
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

  getActiveStylesheetsFor(typeName: string): ParsedStylesheet[] {
    const defaultStylesheet = this.widgetTypes.get(typeName)?.defaultStylesheet;
    const stylesheets = [defaultStylesheet, ...this.userStylesheets].filter(
      (stylesheet): stylesheet is ParsedStylesheet => stylesheet !== undefined,
    );

    return stylesheets;
  }

  parseSelectors(selectorText: string): ParsedSelector[] {
    return parseSelectorList(selectorText);
  }

  matchesSelector(widget: WidgetNode, selector: ParsedSelector): boolean {
    return selectorMatchesWidget(this, widget, selector);
  }

  refreshStyles(changed: boolean): void {
    this.registry.touch();

    if (changed) {
      this.recalculateStyles();
    }
  }

  recalculateStyles(): void {
    const visit = (widget: WidgetNode, inheritedCustomProperties: Record<string, string>): void => {
      const resolvedStyles = resolveStylesForWidget(this, widget, inheritedCustomProperties);
      widget.resolvedStyles.update(resolvedStyles);

      for (const child of this.registry.getChildren(widget.nodeId)) {
        visit(child, resolvedStyles.customProperties);
      }
    };

    // [LAW:dataflow-not-control-flow] Every style recalculation walks the same
    // tree in the same order. Variability lives in selector matches and values.
    for (const rootWidget of this.registry.getChildren(null)) {
      visit(rootWidget, this.getGlobalStyleVariables());
    }

    this.syncPointerStateAfterLayout();
  }

  get messageQueueSize(): number {
    return this.queue.length;
  }

  postMessage(targetId: string, message: Message): void {
    const replacementIndex = this.queue.findIndex(
      (queued) =>
        queued.targetId === targetId &&
        queued.targetNode === undefined &&
        queued.message.constructor === message.constructor &&
        message.canReplace(queued.message),
    );

    if (replacementIndex >= 0) {
      this.queue.splice(replacementIndex, 1, {
        targetId,
        message: this.withSender(message, this.registry.get(targetId)),
      });
    } else {
      this.queue.push({ targetId, message: this.withSender(message, this.registry.get(targetId)) });
    }

    this.scheduleDrain();
  }

  dispatchMessage(message: Message): void {
    const target = this.resolveDefaultDispatchTarget();

    if (target === undefined) {
      return;
    }

    // [LAW:single-enforcer] App-level dispatch chooses its target here so root
    // callers and test harnesses share one targeting rule without forging sender state.
    this.queue.push({ targetId: target.nodeId, message });
    this.scheduleDrain();
  }

  postToFocused(message: Message): void {
    const target = this.resolveDefaultDispatchTarget();

    if (target !== undefined) {
      this.postMessage(target.nodeId, message);
    }
  }

  postKey(input: string, meta: { ctrl?: boolean; shift?: boolean; meta?: boolean; paste?: boolean } = {}): void {
    const normalized = normalizeKeyName(input);
    const fullKey = composeKeyWithModifiers(normalized.key, meta);

    // [LAW:dataflow-not-control-flow] Every key event flows through the same
    // two-phase pipeline: priority scan from app downwards, then bubble with
    // non-priority bindings interleaved. The data (priority flag, node chain)
    // selects which handlers run, not an if-ladder.
    if (this.dispatchPriorityBindings(fullKey)) {
      return;
    }

    this.postToFocused(new Key(fullKey, normalized.character ?? "", meta));
  }

  postClick(x: number, y: number, chain = 1): void {
    this.postToFocused(new Click(x, y, chain));
  }

  dispatchPointerClick(screenX: number, screenY: number, chain = 1): void {
    const resolved = this.resolvePointerTarget(screenX, screenY);

    if (resolved.targetNode !== undefined) {
      this.postMessage(resolved.targetNode.nodeId, new Click(resolved.x, resolved.y, chain));
      return;
    }

    this.postClick(screenX, screenY, chain);
  }

  postMouseDown(x: number, y: number): void {
    this.postToFocused(new MouseDown(x, y));
  }

  dispatchPointerDown(screenX: number, screenY: number): void {
    const resolved = this.resolvePointerTarget(screenX, screenY);

    if (resolved.targetNode !== undefined) {
      this.postMessage(resolved.targetNode.nodeId, new MouseDown(resolved.x, resolved.y));
      return;
    }

    this.postMouseDown(screenX, screenY);
  }

  postMouseUp(x: number, y: number): void {
    this.postToFocused(new MouseUp(x, y));
  }

  dispatchPointerUp(screenX: number, screenY: number): void {
    const resolved = this.resolvePointerTarget(screenX, screenY);

    if (resolved.targetNode !== undefined) {
      this.postMessage(resolved.targetNode.nodeId, new MouseUp(resolved.x, resolved.y));
      return;
    }

    this.postMouseUp(screenX, screenY);
  }

  postMouseMove(x: number, y: number): void {
    this.postToFocused(new MouseMove(x, y));
  }

  dispatchPointerMove(screenX: number, screenY: number): void {
    const pointer = { x: screenX, y: screenY };
    const resolved = this.resolvePointerTarget(screenX, screenY);

    this.lastPointerLocation = pointer;
    this.updateHoveredNode(resolved.targetNode, pointer);

    if (resolved.targetNode !== undefined) {
      this.postMessage(resolved.targetNode.nodeId, new MouseMove(resolved.x, resolved.y));
      return;
    }

    this.postMouseMove(screenX, screenY);
  }

  postResize(width: number, height: number): void {
    this.setTerminalSize(new Size(width, height));
    this.postToFocused(new Resize(width, height));
  }

  async whenIdle(): Promise<void> {
    do {
      const pendingDrain = this.drainPromise;

      if (pendingDrain !== null) {
        await pendingDrain;
      }

      await Promise.resolve();

      // [LAW:single-enforcer] Queue idleness is observed from this boundary so
      // tests and framework callers share one definition of "fully drained."
      if (this.queue.length === 0 && this.drainPromise === null) {
        return;
      }
    } while (true);
  }

  subscribeToMessages(subscriber: MessageSubscriber): () => void {
    this.messageSubscribers.add(subscriber);

    return () => {
      this.messageSubscribers.delete(subscriber);
    };
  }

  findWidgets(selectorText: string): WidgetNode[] {
    const trimmedSelector = selectorText.trim();

    if (trimmedSelector.startsWith("#") && !trimmedSelector.includes(" ")) {
      const match = this.registry.getByCssId(trimmedSelector.slice(1));
      return match === undefined ? [] : [match];
    }

    const selectors = parseSelectorList(trimmedSelector);

    return this.registry.list().filter((widget) => selectors.some((selector) => this.matchesSelector(widget, selector)));
  }

  hitTest(screenX: number, screenY: number): WidgetNode | undefined {
    const widgets = this.registry.list();
    const candidates = widgets.filter(
      (widget) =>
        widget.isInteractive &&
        !widget.screenRegion.isEmpty &&
        widget.screenRegion.contains(screenX, screenY),
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

  isNodeMounted(widget: WidgetNode): boolean {
    return this.registry.get(widget.nodeId) === widget;
  }

  createSignal<TValue>(owner: WidgetNode): Signal<TValue> {
    return new Signal<TValue>(() => this.isNodeMounted(owner), (node) => this.isNodeMounted(node), (callback) => this.callLater(callback));
  }

  runWorker<TResult>(
    node: WidgetNode,
    work: WorkFunction<TResult>,
    options: WorkerOptions = {},
  ): Worker<TResult> {
    const worker = new Worker(
      node,
      work,
      options.name ?? `${node.typeName.toLowerCase()}-worker`,
      options.group,
      options.description ?? options.name ?? `${node.typeName} worker`,
      options.exitOnError ?? false,
      (targetId, message) => this.postMessage(targetId, message),
      (settledWorker) => {
        this.workers.remove(settledWorker as Worker<unknown>);
      },
    );

    return this.workers.addWorker(worker, options.start ?? true, options.exclusive ?? false);
  }

  setTimer(node: WidgetNode, name: string, delayMs: number, callback: TimerCallback): void {
    this.installTimer(node, name, delayMs, callback, false, {});
  }

  setInterval(node: WidgetNode, name: string, intervalMs: number, callback: TimerCallback, options: TimerOptions = {}): void {
    this.installTimer(node, name, intervalMs, callback, true, options);
  }

  clearTimer(node: WidgetNode, name: string): void {
    const key = this.timerKey(node.nodeId, name);
    const timer = this.timers.get(key);

    timer?.cancel();
    this.timers.delete(key);
  }

  pauseTimer(node: WidgetNode, name: string): void {
    this.timers.get(this.timerKey(node.nodeId, name))?.pause();
  }

  resumeTimer(node: WidgetNode, name: string): void {
    this.timers.get(this.timerKey(node.nodeId, name))?.resume();
  }

  resetTimer(node: WidgetNode, name: string): void {
    this.timers.get(this.timerKey(node.nodeId, name))?.reset();
  }

  notify(message: string, severity: NotificationSeverity = "information", timeout = Notification.timeout, title = ""): Notification {
    const notification = new Notification(message, { severity, timeout, title });

    // [LAW:single-enforcer] Notification recording is gated at this boundary so
    // mount effects, widget helpers, and app calls all share the same transient policy.
    return this.showNotifications ? this.notifications.add(notification) : notification;
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

  callLater<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    // [LAW:one-source-of-truth] Deferred later-callbacks enter through the
    // message queue so shutdown, observability, and ordering all share one path.
    this.emitBroadcast(new Callback(() => {
      callback(...args);
    }));
  }

  callNext<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    queueMicrotask(() => {
      callback(...args);
    });
  }

  callAfterRefresh<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.afterRefreshCallbacks.push(() => {
      callback(...args);
    });

    if (this.afterRefreshRequester === null) {
      this.callLater(() => this.flushAfterRefreshCallbacks());
      return;
    }

    this.callLater(() => {
      this.afterRefreshRequester?.();
    });
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
    this.emitBroadcast(new AppBlur());
    this.applyFocusChange(null, { markBlurOverride: false });
  }

  handleAppFocus(): void {
    this.emitBroadcast(new AppFocus());

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
  }

  flushAfterRefreshCallbacks(): void {
    const callbacks = this.afterRefreshCallbacks.splice(0);

    for (const callback of callbacks) {
      callback();
    }
  }

  handleWidgetTooltipChange(widget: WidgetNode): void {
    if (this.hoveredNodeId !== widget.nodeId) {
      return;
    }

    this.refreshTooltipFromHover();
  }

  private resolvePointerTarget(
    screenX: number,
    screenY: number,
  ): { x: number; y: number; targetNode?: WidgetNode } {
    const targetNode = this.hitTest(screenX, screenY);

    if (targetNode === undefined) {
      return { x: screenX, y: screenY };
    }

    return {
      x: screenX - targetNode.screenRegion.x,
      y: screenY - targetNode.screenRegion.y,
      targetNode,
    };
  }

  private updateHoveredNode(targetNode: WidgetNode | undefined, pointer: PointerLocation): void {
    const nextHoveredNodeId = targetNode?.nodeId ?? null;
    const hoveredChanged = this.hoveredNodeId !== nextHoveredNodeId;

    this.lastPointerLocation = pointer;

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

  private handleWidgetWillUnmount(widget: WidgetNode): void {
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

  installScreen(name: string, factory: () => React.ReactElement): void {
    if (this.installedScreens.has(name)) {
      throw new Error(`Screen "${name}" is already installed`);
    }

    this.installedScreens.set(name, { factory, cachedElement: null });
  }

  uninstallScreen(name: string): void {
    for (const stack of this.modeStacks.values()) {
      if (stack.some((entry) => entry.name === name)) {
        throw new ScreenStackError(`Cannot uninstall screen "${name}" while it is on a stack`);
      }
    }

    this.installedScreens.delete(name);
  }

  isScreenInstalled(name: string): boolean {
    return this.installedScreens.has(name);
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
    const record = this.installedScreens.get(name);

    if (record === undefined) {
      throw new Error(`Screen "${name}" is not installed`);
    }

    const element = record.cachedElement ?? record.factory();
    record.cachedElement = element;

    if (expectedType !== undefined && element.type !== expectedType) {
      throw new TypeError(`Installed screen "${name}" does not match the expected type`);
    }

    return element;
  }

  addMode(name: string, factory: () => React.ReactElement): void {
    if (name === DEFAULT_MODE) {
      throw new InvalidModeError(`Mode name "${DEFAULT_MODE}" is reserved`);
    }

    if (this.modeFactories.has(name) || this.modeStacks.has(name)) {
      throw new InvalidModeError(`Mode "${name}" is already registered`);
    }

    this.modeFactories.set(name, factory);
    this.modeStacks.set(name, []);
  }

  removeMode(name: string): void {
    if (name === DEFAULT_MODE) {
      throw new InvalidModeError(`Cannot remove default mode`);
    }

    if (name === this.activeMode) {
      throw new ActiveModeError(`Cannot remove the active mode "${name}"`);
    }

    this.modeFactories.delete(name);
    this.modeStacks.delete(name);
  }

  switchMode(name: string): void {
    if (name === this.activeMode) {
      return;
    }

    if (name !== DEFAULT_MODE && !this.modeFactories.has(name)) {
      throw new UnknownModeError(`Unknown mode "${name}"`);
    }

    this.clearPointerState();
    this.suspendCurrentScreen();

    if (name !== DEFAULT_MODE && (this.modeStacks.get(name)?.length ?? 0) === 0) {
      const factory = this.modeFactories.get(name);

      if (factory !== undefined) {
        // [LAW:one-source-of-truth] The mode's factory is the sole producer of
        // its base screen; the mode name is not doubled up as the screen name.
        const entry = this.createScreenEntry(factory(), {});
        this.modeStacks.set(name, [entry]);
      }
    }

    this.activeMode = name;
    this.screenStackVersion += 1;
    this.signals.mode_change_signal.publish(name);
    this.emitBroadcast(new ModeChanged(name));

    this.resumeActiveScreen();
    this.signals.screen_change_signal.publish(this.activeScreen?.name ?? null);
    this.notifyBindingsUpdated();
  }

  get activeScreen(): ScreenEntry | null {
    // [LAW:dataflow-not-control-flow] Reading screenStackVersion hooks MobX into
    // mutations of a plain-Map-backed stack, so observer()s re-render on changes.
    void this.screenStackVersion;
    const stack = this.modeStacks.get(this.activeMode) ?? [];
    return stack.length === 0 ? null : stack[stack.length - 1];
  }

  get activeScreenElement(): React.ReactElement | null {
    const screen = this.activeScreen;

    if (screen === null || screen.implicit) {
      return null;
    }

    return screen.element;
  }

  get screenStackDepth(): number {
    void this.screenStackVersion;
    const stack = this.modeStacks.get(this.activeMode) ?? [];
    return stack.filter((entry) => !entry.implicit).length;
  }

  getScreenStack(mode?: string): ScreenEntry[] {
    void this.screenStackVersion;
    return (this.modeStacks.get(mode ?? this.activeMode) ?? []).slice();
  }

  pushScreen(descriptor: ScreenDescriptor, callbackOrOptions?: ((result: unknown) => void) | ScreenOptions, extraOptions?: ScreenOptions): ScreenEntry {
    const { callback, options } = normalizePushArgs(callbackOrOptions, extraOptions);
    const element = this.resolveScreenElement(descriptor, options.name);
    const entry = this.createScreenEntry(element, { ...options, callback });

    this.clearPointerState();
    this.suspendCurrentScreen();

    const stack = this.modeStacks.get(this.activeMode) ?? [];
    stack.push(entry);
    this.modeStacks.set(this.activeMode, stack);
    this.screenStackVersion += 1;

    this.resumeActiveScreen();
    this.signals.screen_change_signal.publish(entry.name);
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

  popScreen(result?: unknown): ScreenEntry | null {
    const stack = this.modeStacks.get(this.activeMode) ?? [];

    if (stack.length <= 1) {
      throw new ScreenStackError(`Cannot pop the last screen`);
    }

    this.clearPointerState();
    this.suspendCurrentScreen();

    const popped = stack.pop()!;
    this.modeStacks.set(this.activeMode, stack);
    this.screenStackVersion += 1;

    this.resolveScreenResult(popped, result);

    this.resumeActiveScreen();
    this.signals.screen_change_signal.publish(this.activeScreen?.name ?? null);
    this.notifyBindingsUpdated();

    return popped;
  }

  dismissScreen(result?: unknown): ScreenEntry | null {
    return this.popScreen(result);
  }

  switchScreen(descriptor: ScreenDescriptor, options: ScreenOptions = {}): ScreenEntry {
    const stack = this.modeStacks.get(this.activeMode) ?? [];

    if (stack.length === 0) {
      return this.pushScreen(descriptor, options);
    }

    const element = this.resolveScreenElement(descriptor, options.name);
    const current = stack[stack.length - 1];

    if (current !== undefined && current.element === element) {
      return current;
    }

    this.clearPointerState();
    this.suspendCurrentScreen();

    const entry = this.createScreenEntry(element, options);
    this.clearScreenWaiters(current);
    stack[stack.length - 1] = entry;
    this.modeStacks.set(this.activeMode, stack);
    this.screenStackVersion += 1;

    this.resumeActiveScreen();
    this.signals.screen_change_signal.publish(entry.name);
    this.notifyBindingsUpdated();

    return entry;
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

  private resolveScreenElement(descriptor: ScreenDescriptor, name?: string): React.ReactElement {
    if (typeof descriptor === "string") {
      return this.getScreen(descriptor);
    }

    if (typeof descriptor === "function") {
      const Component = descriptor as React.ComponentType<Record<string, unknown>>;
      return React.createElement(Component);
    }

    void name;
    return descriptor;
  }

  private createScreenEntry(
    element: React.ReactElement,
    options: ScreenOptions & { callback?: (result: unknown) => void },
  ): ScreenEntry {
    const bindings = makeBindings(options.bindings ?? []);
    const entry: ScreenEntry = {
      id: `screen-${nextScreenId++}`,
      name: options.name ?? null,
      element,
      bindings,
      actions: undefined,
      autoFocus: options.autoFocus ?? null,
      implicit: false,
      savedFocusNodeId: null,
      lastFocusedAddress: null,
      waiters: [],
      callback: options.callback,
    };

    entry.actions = this.mergeScreenActions(entry, options.actions);
    return entry;
  }

  private mergeScreenActions(entry: ScreenEntry, actions: WidgetActions | undefined): WidgetActions {
    const builtins: WidgetActions = {
      action_dismiss: (result?: unknown) => {
        void entry;
        this.dismissScreen(result);
      },
      _action_dismiss: (result?: unknown) => {
        void entry;
        this.dismissScreen(result);
      },
    };

    return {
      ...builtins,
      ...(actions ?? {}),
    };
  }

  private suspendCurrentScreen(): void {
    const screen = this.activeScreen;

    if (screen === null) {
      return;
    }

    this.saveScreenFocusSnapshot(screen);
    this.emitBroadcast(new ScreenSuspend(screen.name));
  }

  private resumeActiveScreen(): void {
    const screen = this.activeScreen;

    if (screen === null) {
      return;
    }

    this.emitBroadcast(new ScreenResume(screen.name));
    this.scheduleActiveScreenFocusResolution(true);
  }

  private emitBroadcast(message: Message): void {
    this.queue.push({ targetId: null, message });
    this.scheduleDrain();
  }

  // ---- Action dispatch --------------------------------------------------

  private resolveActionTarget(
    namespace: string,
    defaultTarget?: ActionTargetDescriptor,
  ): { actions: WidgetActions | undefined } | null {
    if (namespace === "app") {
      return { actions: this.appActions };
    }

    if (namespace === "screen") {
      const screen = this.activeScreen;
      return screen === null ? null : { actions: screen.actions };
    }

    if (namespace === "focused") {
      const focused = this.focusedNodeId === null ? undefined : this.registry.get(this.focusedNodeId);
      return focused === undefined ? null : { actions: focused.actions };
    }

    // Unnamespaced action: use the default target, else the focused widget, else app.
    if (defaultTarget !== undefined) {
      return { actions: defaultTarget.actions };
    }

    const focused = this.focusedNodeId === null ? undefined : this.registry.get(this.focusedNodeId);

    if (focused !== undefined) {
      return { actions: focused.actions };
    }

    return { actions: this.appActions };
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

  private resolveBindingsForScreen(screen: ScreenEntry): Binding[] {
    return this.rewriteBindings(screen.bindings, createScreenBindingNamespace(screen));
  }

  private resolveBindingsForNode(node: WidgetNode): Binding[] {
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

  private notifyBindingsUpdated(): void {
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

  dispatchNodeKeyBindings(node: WidgetNode, key: string): boolean {
    for (const binding of this.resolveBindingsForNode(node)) {
      if (binding.priority !== true && binding.key === key) {
        if (this.dispatchBindingAction(binding.action, { actions: node.actions })) {
          return true;
        }
      }
    }

    return false;
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
      const ancestry: WidgetNode[] = [];
      let current: WidgetNode | undefined = focused;

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

  private resolveDefaultDispatchTarget(): WidgetNode | undefined {
    const interactiveWidgets = this.registry.list().filter((entry) => entry.isInteractive);

    // [LAW:one-source-of-truth] Focus/default dispatch target resolution lives
    // in one helper so input routing and app-level dispatch share the same target choice.
    return (
      interactiveWidgets.find((entry) => entry.nodeId === this.focusedNodeId) ??
      interactiveWidgets.find((entry) => entry.focusable) ??
      interactiveWidgets[0]
    );
  }

  private scheduleDrain(): void {
    if (this.drainPromise !== null) {
      return;
    }

    this.drainPromise = Promise.resolve()
      .then(async () => this.drainQueue())
      .finally(() => {
        this.drainPromise = null;

        if (this.queue.length > 0) {
          this.scheduleDrain();
        }
      });
  }

  private async drainQueue(): Promise<void> {
    // [LAW:dataflow-not-control-flow] Every queued message flows through the same
    // dispatch pipeline; bubbling decisions live on message data, not skipped steps.
    do {
      while (this.queue.length > 0) {
        const nextMessage = this.queue.shift();

        if (nextMessage !== undefined) {
          await this.dispatchQueuedMessage(nextMessage);
        }
      }

      await this.dispatchIdlePass();
    } while (this.queue.length > 0);
  }

  private async dispatchQueuedMessage({ targetId, targetNode, message }: QueuedMessage): Promise<void> {
    try {
      if (message.noDispatch) {
        return;
      }

      if (message instanceof Callback) {
        // [LAW:single-enforcer] Callback execution is attached to queued
        // message dispatch so deferred work follows the same lifecycle boundary.
        message.invoke();
        return;
      }

      let currentNode = targetId === null ? targetNode : this.registry.get(targetId);

      if (currentNode === undefined) {
        currentNode = targetNode;
      }

      while (currentNode !== undefined) {
        // [LAW:single-enforcer] Disabled/loading gating runs here and only here
        // so event suppression stays consistent across every dispatch path.
        if (shouldSuppressAtNode(currentNode, message)) {
          return;
        }

        const handlers = currentNode.handlersRef.current;
        const matchingHandlers = this.resolveHandlers(handlers, message);

        for (const handler of matchingHandlers) {
          await handler(message);

          // [LAW:single-enforcer] preventDefault semantics are enforced in the
          // dispatcher so every handler path shares the same local short-circuit.
          if (message.isDefaultPrevented) {
            break;
          }
        }

        if (message instanceof Key && !message.isPropagationStopped) {
          if (this.dispatchNodeKeyBindings(currentNode, message.key)) {
            message.stop();
          }
        }

        if (!message.bubble || message.isPropagationStopped) {
          return;
        }

        currentNode = currentNode.parentId === null ? undefined : this.registry.get(currentNode.parentId);
      }

      if (message instanceof Key && !message.isPropagationStopped) {
        if (this.dispatchScreenKeyBindings(message.key)) {
          message.stop();
        }
      }
    } finally {
      // [LAW:one-source-of-truth] Message observation is published from one
      // boundary so tests and tooling share the same dispatch transcript.
      for (const subscriber of this.messageSubscribers) {
        subscriber(message);
      }
    }
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

  private matchesSelectorGroup(target: WidgetNode | null, selectors: readonly ParsedSelector[]): boolean {
    return target !== null && selectors.some((selector) => this.matchesSelector(target, selector));
  }

  private getDefaultOnSelectorTarget(message: Message): WidgetNode | null {
    const messageWithControl = message as Message & { control?: unknown };
    return coerceWidgetNode(messageWithControl.control) ?? coerceWidgetNode(message.sender);
  }

  private getOnAttributeTarget(message: Message, attribute: string): WidgetNode | null {
    const messageAttributes = message as Message & Record<string, unknown>;
    return coerceWidgetNode(messageAttributes[attribute]);
  }

  private getOnRegistrationGroupSignature(registration: OnHandlerRegistration): string {
    const selectorSignature = registration.selector?.map((selector) => selector.raw).join(",") ?? "";
    const attributeSignature = Array.from(registration.attributeSelectors.entries())
      .map(([attribute, selectors]) => `${attribute}:${selectors.map((selector) => selector.raw).join(",")}`)
      .join("|");
    return `${selectorSignature}::${attributeSignature}`;
  }

  private enqueueLifecycleMessages(widget: WidgetNode): void {
    this.enqueueDirectMessage(widget, new Compose({ bubble: false }));
    this.enqueueDirectMessage(widget, new Mount({ bubble: false }));
  }

  private async dispatchIdlePass(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // [LAW:single-enforcer] Idle delivery runs from the dispatcher boundary so
    // startup, user input, and deferred work all observe the same idle cadence.
    for (const widget of this.registry.list()) {
      await this.dispatchQueuedMessage({
        targetId: null,
        targetNode: widget,
        message: this.withSender(new Idle({ bubble: false }), widget),
      });
    }
  }

  private enqueueDirectMessage(targetNode: WidgetNode, message: Message): void {
    this.queue.push({
      targetId: null,
      targetNode,
      message: this.withSender(message, targetNode),
    });
    this.scheduleDrain();
  }

  private withSender(message: Message, sender: WidgetNode | undefined): Message {
    return message.setSender(message.sender ?? sender ?? null);
  }

  private createFrameworkSignal<TValue>(): Signal<TValue> {
    return new Signal<TValue>(() => this.isRunning, (node) => this.isNodeMounted(node), (callback) => this.callLater(callback));
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

    if (previousNode !== undefined) {
      this.enqueueDirectMessage(previousNode, new Blur({ bubble: false }));
    }

    const nextNode = nodeId === null ? undefined : this.registry.get(nodeId);

    if (nextNode !== undefined) {
      this.enqueueDirectMessage(nextNode, new Focus({ bubble: false }));
    }

    this.notifyBindingsUpdated();
  }

  private saveScreenFocusSnapshot(screen: ScreenEntry): void {
    const focused = this.focusedNodeId === null ? undefined : this.registry.get(this.focusedNodeId);
    screen.savedFocusNodeId = focused?.nodeId ?? null;
    screen.lastFocusedAddress = focused === undefined ? null : this.captureFocusAddress(focused);
  }

  private captureFocusAddress(widget: WidgetNode): FocusAddress {
    const segments: number[] = [];
    let current: WidgetNode | undefined = widget;

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

      const target = this.resolveFocusTarget(this.activeScreen?.lastFocusedAddress ?? null, allowAutoFocus);
      this.applyFocusChange(target?.nodeId ?? null, { markBlurOverride: false });
    });
  }

  private resolveFocusTarget(address: FocusAddress | null, allowAutoFocus: boolean): WidgetNode | null {
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

  private resolveAutoFocusTarget(chain: WidgetNode[]): WidgetNode | null {
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

  private resolveExactFocusTarget(address: FocusAddress): WidgetNode | null {
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

  private findNearestFocusCandidate(chain: WidgetNode[], address: FocusAddress): WidgetNode | null {
    let best: WidgetNode | null = null;
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

  private resolveScreenResult(screen: ScreenEntry, result: unknown): void {
    const callback = screen.callback;
    const waiters = screen.waiters.splice(0);

    screen.callback = undefined;
    callback?.(result);

    for (const waiter of waiters) {
      waiter(result);
    }
  }

  private clearScreenWaiters(screen: ScreenEntry | undefined): void {
    if (screen === undefined) {
      return;
    }

    screen.callback = undefined;
    screen.waiters.splice(0);
  }

  private installTimer(
    node: WidgetNode,
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
          callback();
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

  private getGlobalStyleVariables(): Record<string, string> {
    return this.themeManager.getCssVariables();
  }
}

interface BindingChainEntry {
  namespace: BindingNamespace;
  bindings: Binding[];
  actions: WidgetActions | undefined;
}

interface ActionTargetDescriptor {
  actions: WidgetActions | undefined;
}

type ActionDispatchResult = "handled" | "consumed" | "unhandled";

function createImplicitEntry(): ScreenEntry {
  return {
    id: `screen-implicit-${nextScreenId++}`,
    name: null,
    element: null,
    bindings: [],
    actions: undefined,
    autoFocus: null,
    implicit: true,
    savedFocusNodeId: null,
    lastFocusedAddress: null,
    waiters: [],
  };
}

function normalizePushArgs(
  callbackOrOptions?: ((result: unknown) => void) | ScreenOptions,
  extraOptions?: ScreenOptions,
): { callback?: (result: unknown) => void; options: ScreenOptions } {
  if (typeof callbackOrOptions === "function") {
    return { callback: callbackOrOptions, options: extraOptions ?? {} };
  }

  return { callback: undefined, options: callbackOrOptions ?? {} };
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

function createScreenBindingNamespace(screen: ScreenEntry): BindingNamespace {
  return {
    kind: "screen",
    key: `screen:${screen.id}`,
    name: screen.name,
    nodeId: null,
  };
}

function createWidgetBindingNamespace(widget: WidgetNode): BindingNamespace {
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

function shouldSuppressAtNode(node: WidgetNode, message: Message): boolean {
  if (node.isLoadingEffective) {
    return isUserInputMessage(message);
  }

  if (node.isDisabledEffective) {
    return isUserInputMessage(message) && !(message instanceof ScrollEvent);
  }

  return false;
}

function isUserInputMessage(message: Message): boolean {
  if (message instanceof Key) return true;
  if (message instanceof Click) return true;
  if (message instanceof MouseDown) return true;
  if (message instanceof MouseUp) return true;
  if (message instanceof MouseMove) return true;
  if (message instanceof ScrollEvent) return true;
  return false;
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

function widgetDepth(widget: WidgetNode): number {
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
