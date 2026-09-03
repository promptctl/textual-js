import React from "react";

import type { BindingDeclaration } from "../bindings/index.js";
import {
  AppRuntime,
  type ActionTargetDescriptor,
  type ActiveBinding,
  type ActiveTooltip,
  type AnimationLevel,
  type AppDriver,
  type AppSignals,
  type KeymapInput,
  type MessageSubscriber,
  type PointerShape,
  type ScreenDescriptor,
  type Screen,
  type ScreenOptions,
  type SimpleCommand,
  type SystemCommand,
  type NotifyOptions,
  type BindingClash,
  type BindingNamespace,
  type RegisterWidgetTypeOptions,
  type WidgetTypeMetadata,
} from "../framework/_app-runtime.js";
import { DEFAULT_MODE, normalizePushArgs } from "../framework/screen-stack-service.js";
import { ModeChanged, Paste, ScreenResume, ScreenSuspend } from "../events/events.js";
import type { EnvironmentMap } from "../services/environment.js";
import type { WidgetActions, WidgetRegistry } from "../framework/widget-registry.js";
import type { Widget } from "../framework/widget.js";
import { CommandPalette, type CommandPaletteOptions, type ProviderConstructor } from "../commands/index.js";
import type { Message, MessageConstructor } from "../events/message.js";
import { Size } from "../geometry/index.js";
import { Notification, Notifications, type NotificationContent, type NotificationSeverity } from "../services/notifications.js";
import { ThemeManager, type ActiveTheme, type AnsiTheme, type ThemeDefinition } from "../services/theme.js";
import { spawnUrlOpener, type UrlOpener } from "../services/url-opener.js";
import { Worker, WorkerManager, getCurrentWorker, type WorkerCallable, type WorkerOptions } from "../services/worker.js";
import type { Signal } from "../services/signal.js";
import type { TimerCallback, TimerOptions } from "../services/timer.js";
import { NoMatches } from "../framework/dom-query.js";
import { runTestRoot, type RunTestOptions, type TestSession } from "../testing/run-test.js";
import { matchesSelector, parseSelectorList } from "../styles/index.js";
import { TextualApp } from "./textual-app.js";
import type { SignalRegistry } from "../framework/signal-registry.js";
import type { BindingDispatcher } from "../framework/binding-dispatcher.js";
import type { CommandService } from "../framework/command-service.js";
import type { ThemeBroker } from "../framework/theme-broker.js";
import type { NotificationService } from "../framework/notification-service.js";
import type { AppLifecycleOrchestrator } from "../framework/app-lifecycle.js";
import type { StyleEngine } from "../framework/style-engine.js";
import type { FocusEngine } from "../framework/focus-engine.js";
import type { PointerEngine } from "../framework/pointer-engine.js";
import type { AsyncResourceManager } from "../framework/async-resource-manager.js";
import type { LayoutEngine } from "../framework/layout-engine.js";
import type { TooltipService } from "../framework/tooltip-service.js";
import type { MessagePump } from "../framework/message-pump.js";
import type { ScreenStackService } from "../framework/screen-stack-service.js";
import type { WidgetTypeRegistry } from "../framework/widget-type-registry.js";

export interface AppOptions {
  title?: unknown;
  subTitle?: unknown;
  css?: string;
  cssPath?: string | readonly string[];
  stylesheet?: string;
  theme?: string;
  bindings?: BindingDeclaration[];
  keymap?: KeymapInput;
  actions?: WidgetActions;
  commandProviders?: Iterable<ProviderConstructor> | null;
  autoFocus?: string | null;
  tooltipDelay?: number;
  showTooltips?: boolean;
  // [LAW:one-source-of-truth] env and driver are runtime-construction inputs
  // that App forwards to its owned framework. They are not separately stored
  // on App; the framework is the authority for their effects.
  env?: EnvironmentMap;
  driver?: AppDriver;
  openUrl?: UrlOpener;
}

export interface AppRunTestOptions extends Pick<RunTestOptions, "messageHook" | "size" | "transients"> {}

export interface AppTestSession<Result> extends Omit<TestSession, "app" | "result"> {
  app: App<Result>;
  readonly result: Result | undefined;
}

interface StoredAppOptions {
  css?: string;
  cssPath?: string | readonly string[];
  stylesheet?: string;
  theme?: string;
  bindings?: BindingDeclaration[];
  keymap?: KeymapInput;
  actions?: WidgetActions;
  commandProviders?: Iterable<ProviderConstructor> | null;
  autoFocus?: string | null;
  tooltipDelay?: number;
  showTooltips?: boolean;
  openUrl?: UrlOpener;
}

// [LAW:one-source-of-truth] App is the runtime root. Every runtime concept —
// lifecycle, widget tree, screen stack, focus, pointer routing, message
// dispatch, async resources, styles, notifications, themes — is composed by
// App from internal services. The internal `_framework` collaborator wires
// them up and is held privately for the few non-service-owned observables
// (focusedNodeId, activeTooltip, pointerShape) and back-compat surfaces;
// consumers must not bypass App by reading `app.framework.*` from new code.
// [LAW:single-enforcer] App is the single boundary for lifecycle, dispatch,
// focus, async ownership, and notification/theme settings. Cross-cutting
// invariants are enforced at App's methods, not duplicated at consumer
// callsites.
export class App<Result = unknown> {
  // [LAW:one-source-of-truth] App constructs and owns its framework; callers
  // cannot inject a foreign framework. The framework's services are captured
  // as private fields below; app.tsx reaches into services directly rather
  // than routing through the framework facade. The `_framework` reference
  // remains for the small number of observables not yet owned by a service
  // and for back-compat exposure via the `framework` getter (used by tests
  // and the host adapter until 7w9.10 deletes the framework class).
  private readonly _runtime: AppRuntime;

  // [LAW:single-enforcer] Service composition: App holds direct references
  // to each internal service so all runtime calls are App → service rather
  // than App → framework → service.
  private readonly signalRegistry: SignalRegistry;
  private readonly bindingDispatcher: BindingDispatcher;
  private readonly commandService: CommandService;
  private readonly themeBroker: ThemeBroker;
  private readonly notificationService: NotificationService;
  private readonly lifecycle: AppLifecycleOrchestrator;
  private readonly styleEngine: StyleEngine;
  private readonly focusEngine: FocusEngine;
  private readonly pointerEngine: PointerEngine;
  private readonly asyncResources: AsyncResourceManager;
  private readonly layoutEngine: LayoutEngine;
  private readonly tooltipService: TooltipService;
  private readonly messagePump: MessagePump;
  private readonly screenStack: ScreenStackService;
  private readonly widgetTypeRegistry: WidgetTypeRegistry;
  private readonly _registry: WidgetRegistry;
  readonly workers: WorkerManager;

  // [LAW:one-source-of-truth] Click-chain time threshold is a public runtime
  // tunable. App re-exports the framework's value so consumers reference
  // App.CLICK_CHAIN_TIME_THRESHOLD without reaching into the private collaborator.
  static readonly CLICK_CHAIN_TIME_THRESHOLD = AppRuntime.CLICK_CHAIN_TIME_THRESHOLD;
  private readonly appOptions: StoredAppOptions;
  private appTitle = "";
  private appSubTitle = "";
  // [LAW:single-enforcer] One URL-opening capability for the whole app. Widgets
  // that offer a link (Link, Markdown) name the intent; only this performs it.
  private urlOpener: UrlOpener = spawnUrlOpener;

  constructor(options: AppOptions = {}) {
    const framework = new AppRuntime({
      env: options.env,
      driver: options.driver,
      cssPath: options.cssPath,
    });
    framework.setPublicApp(this);

    this._runtime = framework;
    this.signalRegistry = framework.signalRegistry;
    this.bindingDispatcher = framework.bindingDispatcher;
    this.commandService = framework.commandService;
    this.themeBroker = framework.themeBroker;
    this.notificationService = framework.notificationService;
    this.lifecycle = framework.lifecycle;
    this.styleEngine = framework.styleEngine;
    this.focusEngine = framework.focusEngine;
    this.pointerEngine = framework.pointerEngine;
    this.asyncResources = framework.asyncResources;
    this.layoutEngine = framework.layoutEngine;
    this.tooltipService = framework.tooltipService;
    this.messagePump = framework.pump;
    this.screenStack = framework.screenStack;
    this.widgetTypeRegistry = framework.widgetTypeRegistry;
    this._registry = framework.registry;
    this.workers = framework.workers;

    this.appOptions = {
      css: options.css,
      cssPath: options.cssPath,
      stylesheet: options.stylesheet,
      theme: options.theme,
      bindings: options.bindings,
      keymap: options.keymap,
      actions: options.actions,
      commandProviders: options.commandProviders,
      autoFocus: options.autoFocus,
      tooltipDelay: options.tooltipDelay,
      showTooltips: options.showTooltips,
      openUrl: options.openUrl,
    };
    this.setUrlOpener(options.openUrl);
    this.title = options.title ?? "";
    this.subTitle = options.subTitle ?? "";
  }

  protected compose(): React.ReactNode {
    return null;
  }

  getSystemCommands(_screen: unknown): Iterable<SystemCommand> {
    return [];
  }

  get screenStackVersion(): number {
    return this.screenStack.screenStackVersion;
  }

  get screen(): Screen | null {
    return this.screenStack.activeScreen;
  }

  getDefaultScreen(): Screen | null {
    return this.screenStack.getScreenStack()[0] ?? null;
  }

  getScreenStack(): Screen[] {
    return this.screenStack.getScreenStack();
  }

  // [LAW:one-source-of-truth] Single entry; accepts either (name, factory)
  // — the framework-style/host call shape — or (screen, name) for Python
  // Textual parity. The first-string-argument heuristic disambiguates.
  installScreen(
    screenOrName: ScreenDescriptor | (() => React.ReactElement) | string,
    nameOrFactory: string | (() => React.ReactElement),
  ): void {
    if (typeof screenOrName === "string" && typeof nameOrFactory === "function") {
      this.screenStack.installScreen(screenOrName, nameOrFactory);
      return;
    }

    if (typeof nameOrFactory !== "string") {
      throw new TypeError("installScreen requires a screen name");
    }

    this.screenStack.installScreen(nameOrFactory, normalizeScreenFactory(screenOrName));
  }

  // [LAW:locality-or-seam] Host-shaped install entry: takes (name, factory)
  // to match the framework signature consumers like TextualApp use to
  // populate the SCREENS map. App's public installScreen accepts (screen,
  // name) for Python-Textual API parity.
  installScreenFactory(name: string, factory: () => React.ReactElement): void {
    this.screenStack.installScreen(name, factory);
  }

  uninstallScreen(name: string): void {
    this.screenStack.uninstallScreen(name);
  }

  getScreen(name: string, expectedType?: React.ComponentType<Record<string, unknown>>): React.ReactElement {
    return expectedType === undefined ? this.screenStack.getScreen(name) : this.screenStack.getScreen(name, expectedType);
  }

  getChildById(id: string) {
    const child = this.registry.getChildren(null).find((widget) => widget.id === id);

    if (child === undefined) {
      throw new NoMatches(`No child with id "${id}"`);
    }

    return child;
  }

  getWidgetById(id: string) {
    const widget = this.findWidgets(`#${id}`)[0];

    if (widget === undefined) {
      throw new NoMatches(`No widget with id "${id}"`);
    }

    return widget;
  }

  pushScreen(
    descriptor: ScreenDescriptor,
    callbackOrOptions?: ((result: unknown) => void) | (ScreenOptions & { wait_for_dismiss?: boolean }),
    extraOptions?: ScreenOptions,
  ): Screen | Promise<unknown> {
    if (typeof callbackOrOptions !== "function" && callbackOrOptions?.wait_for_dismiss === true) {
      const { wait_for_dismiss, ...options } = callbackOrOptions;
      void wait_for_dismiss;
      return this.pushScreenWait(descriptor, options);
    }

    const { callback, options } = normalizePushArgs(callbackOrOptions as ((result: unknown) => void) | ScreenOptions | undefined, extraOptions);
    const element = this.screenStack.resolveScreenElement(descriptor);
    const entry = this.makeScreenEntry(element, { ...options, callback });

    this.clearPointerState();
    this.suspendCurrentScreen();

    this.screenStack.pushEntry(entry);
    this.styleEngine.refreshCssWatchers();

    this.resumeActiveScreen();
    this.signalRegistry.signals.screen_change_signal.publish(entry);
    this.bindingDispatcher.notifyBindingsUpdated();

    return entry;
  }

  pushScreenWait(descriptor: ScreenDescriptor, options: ScreenOptions = {}): Promise<unknown> {
    // [LAW:single-enforcer] pushScreenWait is only meaningful inside a worker;
    // assert the caller's context before queueing the screen so the failure
    // surfaces at the call site, not after a screen mount has already occurred.
    getCurrentWorker();

    return new Promise((resolve) => {
      const entry = this.pushScreen(descriptor, options) as Screen;
      entry.waiters.push(resolve);
    });
  }

  dismissScreen(result?: unknown): Screen | null {
    return this.popScreen(result);
  }

  popScreen(result?: unknown): Screen | null {
    this.clearPointerState();
    this.suspendCurrentScreen();

    const popped = this.screenStack.popEntry();
    this.styleEngine.refreshCssWatchers();

    this.screenStack.resolveScreenResult(popped, result);

    this.resumeActiveScreen();
    this.signalRegistry.signals.screen_change_signal.publish(this.screenStack.activeScreen);
    this.bindingDispatcher.notifyBindingsUpdated();

    return popped;
  }

  switchScreen(descriptor: ScreenDescriptor, options: ScreenOptions = {}): Screen {
    if (this.screenStack.activeStackIsEmpty()) {
      return this.pushScreen(descriptor, options) as Screen;
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
    this.signalRegistry.signals.screen_change_signal.publish(entry);
    this.bindingDispatcher.notifyBindingsUpdated();

    return entry;
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
    this.signalRegistry.signals.mode_change_signal.publish(name);
    this.messagePump.emitBroadcast(new ModeChanged(name));

    this.resumeActiveScreen();
    this.signalRegistry.signals.screen_change_signal.publish(this.screenStack.activeScreen);
    this.bindingDispatcher.notifyBindingsUpdated();
  }

  addMode(name: string, factory: () => React.ReactElement): void {
    this.screenStack.addMode(name, factory);
  }

  removeMode(name: string): void {
    this.screenStack.removeMode(name);
  }

  // [LAW:single-enforcer] Screen-entry construction goes through the
  // ScreenStackService factory so the dismiss action is wired with App's
  // popScreen — a single point of authority for screen lifecycle.
  private makeScreenEntry(
    element: React.ReactElement,
    options: ScreenOptions & { callback?: (result: unknown) => void },
  ): Screen {
    return this.screenStack.createScreen(element, options, (result) => {
      this.popScreen(result);
    });
  }

  private clearPointerState(): void {
    this.pointerEngine.clearPointerState();
    this.tooltipService.hideTooltip();
  }

  private suspendCurrentScreen(): void {
    const screen = this.screenStack.activeScreen;

    if (screen === null) {
      return;
    }

    this.focusEngine.saveScreenFocusSnapshot(screen);
    this.messagePump.emitBroadcast(new ScreenSuspend(screen.name));
  }

  private resumeActiveScreen(): void {
    const screen = this.screenStack.activeScreen;

    if (screen === null) {
      return;
    }

    this.messagePump.emitBroadcast(new ScreenResume(screen.name));
    this.focusEngine.scheduleActiveScreenFocusResolution(true);
  }

  render(): React.ReactElement {
    return (
      <TextualApp
        app={this}
        css={this.appOptions.css}
        cssPath={this.appOptions.cssPath}
        stylesheet={this.appOptions.stylesheet}
        theme={this.appOptions.theme}
        bindings={this.appOptions.bindings}
        keymap={this.appOptions.keymap}
        actions={this.appOptions.actions}
        commandProviders={this.resolveCommandProviders()}
        getSystemCommands={(screen) => this.getSystemCommands(screen)}
        screens={this.resolveScreens()}
        modes={this.resolveModes()}
        autoFocus={this.appOptions.autoFocus ?? this.resolveAutoFocus()}
        tooltipDelay={this.appOptions.tooltipDelay}
        showTooltips={this.appOptions.showTooltips}
        openUrl={this.appOptions.openUrl}
      >
        {this.compose()}
      </TextualApp>
    );
  }

  get title(): string {
    return this.appTitle;
  }

  set title(value: unknown) {
    this.appTitle = String(value);
  }

  get subTitle(): string {
    return this.appSubTitle;
  }

  set subTitle(value: unknown) {
    this.appSubTitle = String(value);
  }

  get returnValue(): Result | undefined {
    return this.lifecycle.exitResult as Result | undefined;
  }

  exit(result?: Result): Result | undefined {
    return this.lifecycle.exit(result) as Result | undefined;
  }

  get batchUpdateCount(): number {
    return this.lifecycle.batchUpdateCount;
  }

  batchUpdate<T>(callback: () => T): T {
    return this.lifecycle.batchUpdate(callback);
  }

  runWorker<TResult>(work: WorkerCallable<TResult>, options: WorkerOptions = {}): Worker<TResult> {
    return this.asyncResources.runAppWorker(work, options);
  }

  notify(
    message: NotificationContent,
    severityOrOptions?: NotificationSeverity | NotifyOptions,
    timeout?: number,
    title?: NotificationContent,
    markup?: boolean,
  ): Notification {
    return this.notificationService.notify(message, severityOrOptions, timeout, title, markup);
  }

  clearNotifications(): void {
    this.notificationService.clearNotifications();
  }

  // Replaces the platform opener — the seam a host (or a test) uses to observe
  // or redirect link activation instead of launching a real browser.
  //
  // [LAW:one-source-of-truth] Absent means "no opinion", not "reset to the
  // default": TextualApp syncs this prop on every mount, and treating a missing
  // prop as a reset would silently discard an opener a host set before render.
  // `setUrlOpener(spawnUrlOpener)` is how you deliberately go back.
  setUrlOpener(opener: UrlOpener | null | undefined): void {
    this.urlOpener = opener ?? this.urlOpener;
  }

  openUrl(url: string): void {
    // [LAW:no-silent-failure] The person who asked for the browser is told when
    // it did not open. Reporting it beats an uncaught exception: a missing
    // opener should not tear down a running TUI over one hyperlink.
    // The call goes *inside* the chain: `UrlOpener` permits a synchronous
    // opener, and a synchronous opener throws. Invoking it as an argument to
    // `Promise.resolve` would unwind before any catch was attached.
    void Promise.resolve().then(() => this.urlOpener(url)).catch((error: unknown) => {
      // markup:false — the message embeds an externally-sourced URL, and
      // brackets are ordinary in one (an IPv6 literal host, a query key).
      this.notify(`Could not open ${url}: ${String(error)}`, {
        severity: "error",
        markup: false,
      });
    });
  }

  _unnotify(notification: Notification): void {
    this.notificationService.unnotify(notification);
  }

  get theme(): string {
    return this.themeBroker.theme;
  }

  set theme(name: string) {
    this.themeBroker.setTheme(name);
  }

  setTheme(name: string): ActiveTheme {
    return this.themeBroker.setTheme(name);
  }

  get dark(): boolean {
    return this.themeBroker.dark;
  }

  set dark(value: boolean) {
    this.themeBroker.setDarkMode(value);
  }

  get ansiTheme(): AnsiTheme {
    return this.themeBroker.ansiTheme;
  }

  get ansiThemeDark(): AnsiTheme {
    return this.themeBroker.ansiThemeDark;
  }

  set ansiThemeDark(theme: AnsiTheme) {
    this.themeBroker.setAnsiThemeDark(theme);
  }

  get ansiThemeLight(): AnsiTheme {
    return this.themeBroker.ansiThemeLight;
  }

  set ansiThemeLight(theme: AnsiTheme) {
    this.themeBroker.setAnsiThemeLight(theme);
  }

  get app_suspend_signal() {
    return this.signalRegistry.signals.app_suspend_signal;
  }

  get app_resume_signal() {
    return this.signalRegistry.signals.app_resume_signal;
  }

  get theme_changed_signal() {
    return this.signalRegistry.signals.theme_changed_signal;
  }

  get mode_change_signal() {
    return this.signalRegistry.signals.mode_change_signal;
  }

  get screen_change_signal() {
    return this.signalRegistry.signals.screen_change_signal;
  }

  get features() {
    return this._runtime.features;
  }

  get devtools() {
    return this._runtime.devtools;
  }

  get debug(): boolean {
    return this._runtime.debug;
  }

  suspend<TResult>(callback: () => Promise<TResult> | TResult): Promise<TResult> {
    return this.lifecycle.suspend(callback);
  }

  searchCommands(commands: readonly SimpleCommand[]): Promise<CommandPalette> {
    return this.commandService.searchCommands(commands);
  }

  // [LAW:single-enforcer] App is the boundary for lifecycle: startup,
  // shutdown, isRunning, idle observation, and refresh accounting.
  startup(): void {
    this.lifecycle.startup();
  }

  shutdown(): void {
    this.lifecycle.shutdown();
  }

  get isRunning(): boolean {
    return this.lifecycle.isRunning;
  }

  whenIdle(): Promise<void> {
    return this.messagePump.whenIdle();
  }

  get displayCount(): number {
    return this.lifecycle.displayCount;
  }

  // [LAW:single-enforcer] App owns selector-based widget queries. Two
  // shapes share one entry: a literal `#id` short-circuits to the registry
  // index; everything else parses and matches against the registered
  // widget list using the registry as the structural-match host.
  findWidgets(selectorText: string): Widget[] {
    const trimmedSelector = selectorText.trim();

    if (trimmedSelector.startsWith("#") && !trimmedSelector.includes(" ")) {
      const match = this.registry.getByCssId(trimmedSelector.slice(1));
      return match === undefined ? [] : [match];
    }

    const selectors = parseSelectorList(trimmedSelector);

    return this.registry.list().filter((widget) =>
      selectors.some((selector) => matchesSelector(this.registry, widget, selector)),
    );
  }

  getByCssId(cssId: string): Widget | undefined {
    return this.registry.getByCssId(cssId);
  }

  isScreenInstalled(name: string): boolean {
    return this.screenStack.isScreenInstalled(name);
  }

  get screenStackDepth(): number {
    return this.screenStack.screenStackDepth;
  }

  get activeMode(): string {
    return this.screenStack.activeMode;
  }

  get terminalSize(): Size {
    return this.lifecycle.terminalSize;
  }

  // [LAW:single-enforcer] App is the boundary for focus routing. Focus
  // chain construction, navigation, and current-focus inspection all enter
  // through App so keyboard, pointer, and tests share one answer.
  // [LAW:one-source-of-truth] focusedNodeId is read off the framework
  // observable for now; phase-7w9 follow-up will lift it into FocusEngine.
  get focusedNodeId(): string | null {
    return this._runtime.focusedNodeId;
  }

  focusWidget(nodeId: string | null): void {
    this.focusEngine.focusWidget(nodeId);
  }

  focusNext(selector?: string | Function): Widget | null {
    return this.focusEngine.focusNext(selector);
  }

  focusPrevious(selector?: string | Function): Widget | null {
    return this.focusEngine.focusPrevious(selector);
  }

  getFocusChain(): Widget[] {
    return this.focusEngine.getFocusChain();
  }

  // [LAW:one-source-of-truth] pointerShape lives on the framework observable;
  // phase-7w9 follow-up will lift it into PointerEngine.
  get pointerShape(): PointerShape {
    return this._runtime.pointerShape;
  }

  // [LAW:one-source-of-truth] activeTooltip lives on the framework observable;
  // phase-7w9 follow-up will lift it into TooltipService.
  get activeTooltip(): ActiveTooltip | null {
    return this._runtime.activeTooltip;
  }

  set activeTooltip(value: ActiveTooltip | null) {
    this._runtime.activeTooltip = value;
  }

  get tooltipDelay(): number {
    return this.themeBroker.tooltipDelay;
  }

  set tooltipDelay(delayMs: number | null | undefined) {
    this.themeBroker.setTooltipDelay(delayMs);
  }

  setTooltipDelay(delayMs: number | null | undefined): void {
    this.themeBroker.setTooltipDelay(delayMs);
  }

  // [LAW:single-enforcer] App is the boundary for message and key dispatch.
  // postMessage / postKey / runAction all flow through App so subscribers,
  // bindings, and instrumentation observe one ordered transcript.
  get messageQueueSize(): number {
    return this.messagePump.messageQueueSize;
  }

  postMessage(targetId: string, message: Message): boolean {
    return this.messagePump.postMessage(targetId, message);
  }

  postKey(input: string, meta: { ctrl?: boolean; shift?: boolean; meta?: boolean; paste?: boolean } = {}): void {
    this.messagePump.postKey(input, meta);
  }

  // [LAW:single-enforcer] Paste arrives from the Ink bridge as one batch and is
  // delivered to the focused widget as a single Paste message — bindings and
  // character-insertion paths never see the multi-character sequence.
  postPaste(text: string): void {
    this.messagePump.postToFocused(new Paste(text));
  }

  subscribeToMessages(subscriber: MessageSubscriber): () => void {
    return this.messagePump.subscribeToMessages(subscriber);
  }

  runAction(action: string, defaultTarget?: ActionTargetDescriptor): boolean {
    return this.bindingDispatcher.runAction(action, defaultTarget);
  }

  checkAction(action: string, defaultTarget?: ActionTargetDescriptor): boolean | null {
    return this.bindingDispatcher.checkAction(action, defaultTarget);
  }

  setKeymap(next: KeymapInput): void {
    this.bindingDispatcher.setKeymap(next);
  }

  updateKeymap(patch: KeymapInput): void {
    this.bindingDispatcher.updateKeymap(patch);
  }

  setAppBindings(declarations: Iterable<BindingDeclaration>): void {
    this.bindingDispatcher.setAppBindings(declarations);
  }

  setAppActions(actions: WidgetActions | undefined): void {
    this.bindingDispatcher.setAppActions(actions);
  }

  setAppCommandProviders(providers: Iterable<ProviderConstructor> | null | undefined): void {
    this.commandService.setAppCommandProviders(providers);
  }

  setSystemCommandResolver(resolver: ((screen: Screen | null) => Iterable<SystemCommand>) | undefined): void {
    this.commandService.setSystemCommandResolver(resolver);
  }

  setAppAutoFocus(selector: string | null | undefined): void {
    this.themeBroker.setAppAutoFocus(selector);
  }

  setShowTooltips(enabled: boolean | null | undefined): void {
    this.themeBroker.setShowTooltips(enabled);
  }

  setShowNotifications(enabled: boolean | null | undefined): void {
    this.notificationService.setShowNotifications(enabled);
  }

  setUserStylesheet(source: string): void {
    this.styleEngine.setUserStylesheet(source);
  }

  setCssPath(path: string | readonly string[]): void {
    this.styleEngine.setCssPath(path);
  }

  syncHostTerminalSize(size: Size): void {
    this.lifecycle.syncHostTerminalSize(size);
  }

  attachAfterRefreshRequester(requester: () => void): () => void {
    return this.lifecycle.attachAfterRefreshRequester(requester);
  }

  recordDisplayPass(): void {
    this.lifecycle.recordDisplayPass();
  }

  flushAfterRefreshCallbacks(): void {
    this.lifecycle.flushAfterRefreshCallbacks();
  }

  get showTooltips(): boolean {
    return this.themeBroker.showTooltips;
  }

  get showNotifications(): boolean {
    return this.notificationService.showNotifications;
  }

  get activeScreen(): Screen | null {
    return this.screenStack.activeScreen;
  }

  get activeCommandPalette(): CommandPalette | null {
    return this.commandService.activeCommandPalette;
  }

  get activeScreenElement(): React.ReactElement | null {
    return this.screenStack.activeScreenElement;
  }

  getActiveBindings(): ActiveBinding[] {
    return this.bindingDispatcher.getActiveBindings();
  }

  openCommandPalette(options: CommandPaletteOptions = {}): Promise<CommandPalette> {
    return this.commandService.openCommandPalette(options);
  }

  closeActiveCommandPalette(optionSelected: boolean, command?: () => void): Promise<void> {
    return this.commandService.closeActiveCommandPalette(optionSelected, command);
  }

  postAppMessage(message: Message): void {
    this.messagePump.postAppMessage(message);
  }

  // [LAW:single-enforcer] App is the boundary for async resource ownership.
  // Deferred and threaded callbacks enter through App so timer scope, idle
  // accounting, and shutdown draining share one authority.
  callLater<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.messagePump.callLater(callback, ...args);
  }

  callNext<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.messagePump.callNext(callback, ...args);
  }

  callAfterRefresh<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.layoutEngine.callAfterRefresh(callback, ...args);
  }

  callFromThread<TResult, TArgs extends unknown[]>(
    callback: (...args: TArgs) => TResult,
    ...args: TArgs
  ): Promise<TResult> {
    return this.asyncResources.callFromThread(callback, ...args);
  }

  get notifications(): Notifications {
    return this.notificationService.notifications;
  }

  get themeManager(): ThemeManager {
    return this.themeBroker.themeManager;
  }

  get signals(): AppSignals {
    return this.signalRegistry.signals;
  }

  get activeTheme(): ActiveTheme {
    return this.themeBroker.activeTheme;
  }

  registerTheme(theme: ThemeDefinition): ActiveTheme {
    return this.themeBroker.registerTheme(theme);
  }

  get animationLevel(): AnimationLevel {
    return this.themeBroker.animationLevel;
  }

  set animationLevel(level: AnimationLevel) {
    this.themeBroker.setAnimationLevel(level);
  }

  // ---- Internal runtime surface (consumed by Widget, DOMQuery, tests) -----
  // [LAW:single-enforcer] Each method below is a single-line delegator to the
  // internal service that owns the operation. App is the only way for runtime
  // collaborators (widgets, DOMQuery, the test pilot) to reach into services;
  // they never import services directly.

  get registry(): WidgetRegistry {
    return this._registry;
  }

  get hoveredNodeId(): string | null {
    return this.pointerEngine.hoveredNodeId;
  }

  isNodeMounted(widget: Widget): boolean {
    return this._registry.get(widget.nodeId) === widget;
  }

  refreshStyles(changed: boolean): void {
    this._registry.touch();
    this.styleEngine.refreshStyles(changed);
  }

  recalculateStyles(): void {
    this._runtime.recalculateStyles();
  }

  registerWidget(widget: Widget): void {
    this._runtime.registerWidget(widget);
  }

  notifyWillUnmount(widget: Widget): void {
    this._runtime.notifyWillUnmount(widget);
  }

  unregisterWidget(nodeId: string): void {
    this._runtime.unregisterWidget(nodeId);
  }

  resolveWidgetTypeName(typeConstraint: string | Function): string {
    return this.widgetTypeRegistry.resolveWidgetTypeName(typeConstraint);
  }

  widgetMatchesType(typeName: string, expectedTypeName: string): boolean {
    return this.widgetTypeRegistry.widgetMatchesType(typeName, expectedTypeName);
  }

  registerWidgetType(typeName: string, options?: RegisterWidgetTypeOptions): void {
    this.widgetTypeRegistry.registerWidgetType(typeName, options ?? {});
  }

  getWidgetTypeMetadata(typeName: string): WidgetTypeMetadata {
    return this.widgetTypeRegistry.getWidgetTypeMetadata(typeName);
  }

  parseSelectors(selectorText: string) {
    return this._runtime.parseSelectors(selectorText);
  }

  matchesSelector(widget: Widget, selector: unknown): boolean {
    return this._runtime.matchesSelector(widget, selector as never);
  }

  clearFocusWithin(container: Widget): void {
    this.focusEngine.clearFocusWithin(container);
  }

  trapFocus(widget: Widget, enabled = true): void {
    this.focusEngine.trapFocus(widget, enabled);
  }

  handleWidgetTooltipChange(widget: Widget): void {
    this.tooltipService.handleWidgetTooltipChange(widget);
  }

  registerLayoutReader(nodeId: string, reader: () => void): () => void {
    return this.layoutEngine.registerLayoutReader(nodeId, reader);
  }

  syncLayoutReadersForPass(): void {
    this.layoutEngine.syncLayoutReadersForPass();
  }

  attachLayoutPassCounter(rootNode: { onComputeLayout?: () => void }): () => void {
    return this.layoutEngine.attachLayoutPassCounter(rootNode);
  }

  preventMessages<T>(targetId: string | null, messageTypes: MessageConstructor[], callback: () => T): T {
    return this.messagePump.preventMessages(targetId, messageTypes, callback);
  }

  disableMessages(targetId: string | null, messageTypes: MessageConstructor[]): void {
    this.messagePump.disableMessages(targetId, messageTypes);
  }

  enableMessages(targetId: string | null, messageTypes: MessageConstructor[]): void {
    this.messagePump.enableMessages(targetId, messageTypes);
  }

  getMessageQueueSize(targetId: string | null): number {
    return this.messagePump.getMessageQueueSize(targetId);
  }

  runNodeWorker<TResult>(
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

  setInterval(
    node: Widget,
    name: string,
    intervalMs: number,
    callback: TimerCallback,
    options: TimerOptions = {},
  ): void {
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

  createSignal<TValue>(owner: Widget, description = ""): Signal<TValue> {
    return this.signalRegistry.createSignal<TValue>(owner, description);
  }

  dismissNotification(identity: string): void {
    this.notificationService.dismissNotification(identity);
  }

  dispatchPointerDown(screenX: number, screenY: number): void {
    this.pointerEngine.dispatchPointerDown(screenX, screenY);
  }

  dispatchPointerUp(screenX: number, screenY: number): void {
    this.pointerEngine.dispatchPointerUp(screenX, screenY);
  }

  dispatchPointerMove(screenX: number, screenY: number): void {
    this.pointerEngine.dispatchPointerMove(screenX, screenY);
  }

  hitTest(screenX: number, screenY: number): Widget | undefined {
    return this.pointerEngine.hitTest(screenX, screenY);
  }

  postResize(width: number, height: number): void {
    this.lifecycle.postResize(width, height);
  }

  reportUnhandledError(error: unknown): void {
    this.lifecycle.reportUnhandledError(error);
  }

  throwPendingError(): void {
    this.lifecycle.throwPendingError();
  }

  setCaptureUnhandledErrors(enabled: boolean): void {
    this.lifecycle.setCaptureUnhandledErrors(enabled);
  }

  setControlledTerminalSize(size: Size | null): void {
    this.lifecycle.setControlledTerminalSize(size);
  }

  getSystemCommandsForScreen(screen: Screen | null): SystemCommand[] {
    return this.commandService.getSystemCommands(screen);
  }

  handleBindingsClash(_clashes: BindingClash[], _namespace: BindingNamespace): void {
    // Default no-op; apps may override (or tests may spy) to surface clashes.
  }

  handleAppBlur(): void {
    this.lifecycle.handleAppBlur();
  }

  handleAppFocus(): void {
    this.lifecycle.handleAppFocus();
  }

  dispatchMessage(message: Message): void {
    this.messagePump.dispatchMessage(message);
  }

  setTerminalSize(size: Size): void {
    this.lifecycle.setTerminalSize(size);
  }

  getActiveStylesheetsFor(typeName: string) {
    return this._runtime.getActiveStylesheetsFor(typeName);
  }

  // Snake-case theme aliases for Python-Textual API parity (mirrors framework's
  // existing snake_case getters).
  get ansi_theme() {
    return this.themeBroker.ansiTheme;
  }
  get ansi_theme_dark() {
    return this.themeBroker.ansiThemeDark;
  }
  set ansi_theme_dark(theme) {
    this.themeBroker.setAnsiThemeDark(theme);
  }
  get ansi_theme_light() {
    return this.themeBroker.ansiThemeLight;
  }
  set ansi_theme_light(theme) {
    this.themeBroker.setAnsiThemeLight(theme);
  }

  private resolveCommandProviders(): Iterable<ProviderConstructor> | null | undefined {
    const constructorProviders = (this.constructor as { COMMANDS?: Iterable<ProviderConstructor> }).COMMANDS;
    // [LAW:one-source-of-truth] App-level COMMANDS replacement is resolved
    // once here so TextualApp and the framework consume one provider set.
    return this.appOptions.commandProviders ?? constructorProviders;
  }

  private resolveScreens(): Record<string, ScreenDescriptor | (() => React.ReactElement)> {
    return {
      ...((this.constructor as { SCREENS?: Record<string, ScreenDescriptor | (() => React.ReactElement)> }).SCREENS ?? {}),
    };
  }

  private resolveModes(): Record<string, ScreenDescriptor | (() => React.ReactElement) | string> {
    return {
      ...((this.constructor as { MODES?: Record<string, ScreenDescriptor | (() => React.ReactElement) | string> }).MODES ?? {}),
    };
  }

  private resolveAutoFocus(): string | null | undefined {
    return (this.constructor as { AUTO_FOCUS?: string | null }).AUTO_FOCUS;
  }

  async runTest(options: AppRunTestOptions = {}): Promise<AppTestSession<Result>> {
    const app = this;
    const session = await runTestRoot(this.render(), this, options);

    return {
      pilot: session.pilot,
      cleanup: session.cleanup,
      unmount: session.unmount,
      lastFrame: session.lastFrame,
      instance: session.instance,
      app,
      get result() {
        return app.returnValue;
      },
    };
  }
}

function normalizeScreenFactory(screen: ScreenDescriptor | (() => React.ReactElement)): () => React.ReactElement {
  if (React.isValidElement(screen)) {
    return () => screen;
  }

  if (typeof screen === "function") {
    return () => React.createElement(screen as React.ComponentType<Record<string, unknown>>);
  }

  throw new TypeError("install_screen requires a screen element or component");
}
