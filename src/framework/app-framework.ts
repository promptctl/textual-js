import React from "react";
import { makeAutoObservable } from "mobx";

import {
  Blur,
  Callback,
  Click,
  Compose,
  Focus,
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
import { Message, messageHandlerNames } from "../events/message.js";
import {
  SkipAction,
  makeBindings,
  parseAction,
  type Binding,
  type BindingDeclaration,
} from "../bindings/index.js";
import { Size } from "../geometry/index.js";
import { Notification, Notifications, type NotificationSeverity } from "../services/notifications.js";
import { Signal } from "../services/signal.js";
import { ThemeManager, type ActiveTheme, type ThemeDefinition } from "../services/theme.js";
import { ManagedTimer, type TimerCallback, type TimerOptions } from "../services/timer.js";
import { Worker, WorkerManager, type WorkFunction, type WorkerOptions } from "../services/worker.js";
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
  WidgetRegistry,
  type WidgetActionCallback,
  type WidgetActions,
  type WidgetCheckAction,
  type WidgetHandlers,
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
  callback?: (result: unknown) => void;
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

export class ScreenStackError extends Error {}

export class UnknownModeError extends Error {}

export class InvalidModeError extends Error {}

export class ActiveModeError extends Error {}

function normalizeCssSource(source: string | undefined): string | undefined {
  const normalizedSource = source?.trim();
  return normalizedSource === undefined || normalizedSource.length === 0 ? undefined : normalizedSource;
}

const SPECIAL_KEY_NAMES = new Map<string, string>([
  [" ", "space"],
  ["?", "question_mark"],
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
];

let nextScreenId = 1;

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
  private readonly installedScreens = new Map<string, () => React.ReactElement>();
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
      } as never,
      { autoBind: true },
    );
  }

  setAppBindings(declarations: Iterable<BindingDeclaration>): void {
    // [LAW:one-source-of-truth] App bindings are merged with navigation defaults
    // at one point; callers never assemble their own binding list.
    this.appBindings = makeBindings([...APP_NAVIGATION_BINDINGS, ...declarations]);
    this.signals.bindings_updated_signal.publish(undefined);
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
    };
    this.appActions = { ...navigation, ...(actions ?? {}) };
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
  }

  shutdown(): void {
    this.queue.length = 0;
    this.focusedNodeId = null;
    this.workers.cancelAll();
    this.clearAllTimers();
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

    this.registry.deregister(nodeId);
    this.recalculateStyles();
  }

  focusWidget(nodeId: string | null): void {
    if (this.focusedNodeId === nodeId) {
      return;
    }

    const previousId = this.focusedNodeId;
    this.focusedNodeId = nodeId;
    this.recalculateStyles();

    // [LAW:single-enforcer] Focus transitions are the sole source of Focus/Blur
    // messages; each call dispatches both sides in the same pass.
    const previousNode = previousId === null ? undefined : this.registry.get(previousId);

    if (previousNode !== undefined) {
      this.enqueueDirectMessage(previousNode, new Blur({ bubble: false }));
    }

    const nextNode = nodeId === null ? undefined : this.registry.get(nodeId);

    if (nextNode !== undefined) {
      this.enqueueDirectMessage(nextNode, new Focus({ bubble: false }));
    }

    this.signals.bindings_updated_signal.publish(undefined);
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

  postToFocused(message: Message): void {
    const interactiveWidgets = this.registry.list().filter((entry) => entry.isInteractive);
    const target =
      interactiveWidgets.find((entry) => entry.nodeId === this.focusedNodeId) ??
      interactiveWidgets.find((entry) => entry.focusable) ??
      interactiveWidgets[0];

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

  postMouseDown(x: number, y: number): void {
    this.postToFocused(new MouseDown(x, y));
  }

  postMouseUp(x: number, y: number): void {
    this.postToFocused(new MouseUp(x, y));
  }

  postMouseMove(x: number, y: number): void {
    this.postToFocused(new MouseMove(x, y));
  }

  postResize(width: number, height: number): void {
    this.setTerminalSize(new Size(width, height));
    this.postToFocused(new Resize(width, height));
  }

  async whenIdle(): Promise<void> {
    await this.drainPromise;
    await Promise.resolve();
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
    return this.notifications.add(new Notification(message, { severity, timeout, title }));
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

  // ---- Screen stack and modes -------------------------------------------

  installScreen(name: string, factory: () => React.ReactElement): void {
    if (this.installedScreens.has(name)) {
      throw new Error(`Screen "${name}" is already installed`);
    }

    this.installedScreens.set(name, factory);
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

    this.suspendCurrentScreen();

    const stack = this.modeStacks.get(this.activeMode) ?? [];
    stack.push(entry);
    this.modeStacks.set(this.activeMode, stack);
    this.screenStackVersion += 1;

    this.resumeActiveScreen();
    this.signals.screen_change_signal.publish(entry.name);
    this.signals.bindings_updated_signal.publish(undefined);

    return entry;
  }

  popScreen(result?: unknown): ScreenEntry | null {
    const stack = this.modeStacks.get(this.activeMode) ?? [];

    if (stack.length <= 1) {
      throw new ScreenStackError(`Cannot pop the last screen`);
    }

    this.suspendCurrentScreen();

    const popped = stack.pop()!;
    this.modeStacks.set(this.activeMode, stack);
    this.screenStackVersion += 1;

    popped.callback?.(result);

    this.resumeActiveScreen();
    this.signals.screen_change_signal.publish(this.activeScreen?.name ?? null);
    this.signals.bindings_updated_signal.publish(undefined);

    return popped;
  }

  switchScreen(descriptor: ScreenDescriptor, options: ScreenOptions = {}): ScreenEntry {
    const stack = this.modeStacks.get(this.activeMode) ?? [];

    if (stack.length === 0) {
      return this.pushScreen(descriptor, options);
    }

    this.suspendCurrentScreen();

    const element = this.resolveScreenElement(descriptor, options.name);
    const entry = this.createScreenEntry(element, options);
    stack[stack.length - 1] = entry;
    this.modeStacks.set(this.activeMode, stack);
    this.screenStackVersion += 1;

    this.resumeActiveScreen();
    this.signals.screen_change_signal.publish(entry.name);
    this.signals.bindings_updated_signal.publish(undefined);

    return entry;
  }

  runAction(action: string, defaultTarget?: ActionTargetDescriptor): boolean {
    const parsed = parseAction(action);
    const target = this.resolveActionTarget(parsed.namespace, defaultTarget);

    if (target === null) {
      return false;
    }

    const actions = target.actions;
    const checkAction: WidgetCheckAction | undefined =
      typeof actions?.checkAction === "function" ? (actions.checkAction as WidgetCheckAction) : undefined;
    const gate = checkAction === undefined ? true : checkAction(parsed.actionName, parsed.params);

    if (gate === false || gate === null) {
      return false;
    }

    const candidate =
      pickActionCallback(actions, `_action_${parsed.actionName}`) ??
      pickActionCallback(actions, `action_${parsed.actionName}`);

    if (candidate === undefined) {
      return false;
    }

    try {
      candidate(...parsed.params);
      return true;
    } catch (error) {
      if (error instanceof SkipAction) {
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
      const factory = this.installedScreens.get(descriptor);

      if (factory === undefined) {
        throw new Error(`Screen "${descriptor}" is not installed`);
      }

      return factory();
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
    return {
      id: `screen-${nextScreenId++}`,
      name: options.name ?? null,
      element,
      bindings,
      actions: options.actions,
      autoFocus: options.autoFocus ?? null,
      implicit: false,
      callback: options.callback,
    };
  }

  private suspendCurrentScreen(): void {
    const screen = this.activeScreen;

    if (screen === null) {
      return;
    }

    this.emitBroadcast(new ScreenSuspend(screen.name));
  }

  private resumeActiveScreen(): void {
    const screen = this.activeScreen;

    if (screen === null) {
      return;
    }

    this.emitBroadcast(new ScreenResume(screen.name));
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

  // ---- Binding dispatch -------------------------------------------------

  private dispatchPriorityBindings(key: string): boolean {
    const chain = this.buildBindingChain();

    // [LAW:dataflow-not-control-flow] Walk the chain top-down (app → screen → focused).
    // Data (priority flag) decides whether each binding fires, not conditional skips.
    for (const level of chain) {
      for (const binding of level.bindings) {
        if (binding.priority === true && binding.key === key) {
          if (this.runAction(binding.action, { actions: level.actions })) {
            return true;
          }
        }
      }
    }

    return false;
  }

  dispatchNodeKeyBindings(node: WidgetNode, key: string): boolean {
    for (const binding of node.bindings) {
      if (binding.priority !== true && binding.key === key) {
        if (this.runAction(binding.action, { actions: node.actions })) {
          return true;
        }
      }
    }

    return false;
  }

  private dispatchScreenKeyBindings(key: string): boolean {
    const screen = this.activeScreen;

    if (screen !== null) {
      for (const binding of screen.bindings) {
        if (binding.priority !== true && binding.key === key) {
          if (this.runAction(binding.action, { actions: screen.actions })) {
            return true;
          }
        }
      }
    }

    for (const binding of this.appBindings) {
      if (binding.priority !== true && binding.key === key) {
        if (this.runAction(binding.action, { actions: this.appActions })) {
          return true;
        }
      }
    }

    return false;
  }

  private buildBindingChain(): BindingChainEntry[] {
    const chain: BindingChainEntry[] = [];

    // App layer first so priority bindings are evaluated top-down.
    chain.push({ bindings: this.appBindings, actions: this.appActions });

    const screen = this.activeScreen;

    if (screen !== null) {
      chain.push({ bindings: screen.bindings, actions: screen.actions });
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
        chain.push({ bindings: node.bindings, actions: node.actions });
      }
    }

    return chain;
  }

  private scheduleDrain(): void {
    if (this.drainPromise !== null) {
      return;
    }

    this.drainPromise = Promise.resolve()
      .then(async () => this.drainQueue())
      .finally(() => {
        this.drainPromise = null;
      });
  }

  private async drainQueue(): Promise<void> {
    // [LAW:dataflow-not-control-flow] Every queued message flows through the same
    // dispatch pipeline; bubbling decisions live on message data, not skipped steps.
    while (this.queue.length > 0) {
      const nextMessage = this.queue.shift();

      if (nextMessage !== undefined) {
        await this.dispatchQueuedMessage(nextMessage);
      }
    }
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

    const matchingHandlers = messageHandlerNames(message)
      .map((name) => handlers[name])
      .filter((handler): handler is NonNullable<WidgetHandlers[keyof WidgetHandlers]> => handler !== undefined);

    return Array.from(new Set(matchingHandlers));
  }

  private enqueueLifecycleMessages(widget: WidgetNode): void {
    this.enqueueDirectMessage(widget, new Compose({ bubble: false }));
    this.enqueueDirectMessage(widget, new Mount({ bubble: false }));
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
  bindings: Binding[];
  actions: WidgetActions | undefined;
}

interface ActionTargetDescriptor {
  actions: WidgetActions | undefined;
}

function createImplicitEntry(): ScreenEntry {
  return {
    id: `screen-implicit-${nextScreenId++}`,
    name: null,
    element: null,
    bindings: [],
    actions: undefined,
    autoFocus: null,
    implicit: true,
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

// Re-export select types imported solely for type context.
export type { Binding, BindingDeclaration };
