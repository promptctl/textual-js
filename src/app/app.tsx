import React from "react";

import type { BindingDeclaration } from "../bindings/index.js";
import {
  TextualFramework,
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
} from "../framework/app-framework.js";
import type { EnvironmentMap } from "../services/environment.js";
import type { WidgetActions } from "../framework/widget-registry.js";
import type { Widget } from "../framework/widget.js";
import { CommandPalette, type CommandPaletteOptions, type ProviderConstructor } from "../commands/index.js";
import type { Message } from "../events/message.js";
import { Size } from "../geometry/index.js";
import { Notification, Notifications, type NotificationContent, type NotificationSeverity } from "../services/notifications.js";
import { ThemeManager, type ActiveTheme, type AnsiTheme, type ThemeDefinition } from "../services/theme.js";
import { Worker, WorkerManager, type WorkerCallable, type WorkerOptions } from "../services/worker.js";
import { NoMatches } from "../framework/dom-query.js";
import { runTestRoot, type RunTestOptions, type TestSession } from "../testing/run-test.js";
import { TextualApp } from "./textual-app.js";

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
}

// [LAW:one-source-of-truth] App is the runtime root. Every runtime concept —
// lifecycle, widget tree, screen stack, focus, pointer routing, message
// dispatch, async resources, styles, notifications, themes — is reached
// through App. The internal framework field is a private collaborator owned
// by App; consumers must not bypass App by reading `app.framework.*`.
// [LAW:single-enforcer] App is the single boundary for lifecycle, dispatch,
// focus, async ownership, and notification/theme settings. Cross-cutting
// invariants are enforced at App's methods, not duplicated at consumer
// callsites.
export class App<Result = unknown> {
  // [LAW:one-source-of-truth] App constructs and owns its framework; callers
  // cannot inject a foreign framework. This collapses the former dual
  // construction path where either App or TextualFramework could root the tree.
  readonly framework: TextualFramework;

  // [LAW:one-source-of-truth] Click-chain time threshold is a public runtime
  // tunable. App re-exports the framework's value so consumers reference
  // App.CLICK_CHAIN_TIME_THRESHOLD without reaching into the private collaborator.
  static readonly CLICK_CHAIN_TIME_THRESHOLD = TextualFramework.CLICK_CHAIN_TIME_THRESHOLD;
  private readonly appOptions: StoredAppOptions;
  private appTitle = "";
  private appSubTitle = "";

  constructor(options: AppOptions = {}) {
    this.framework = new TextualFramework({
      env: options.env,
      driver: options.driver,
      cssPath: options.cssPath,
    });
    this.framework.setPublicApp(this);
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
    };
    this.title = options.title ?? "";
    this.subTitle = options.subTitle ?? "";
  }

  protected compose(): React.ReactNode {
    return null;
  }

  getSystemCommands(_screen: unknown): Iterable<SystemCommand> {
    return [];
  }

  get screenStack(): Screen[] {
    return this.framework.getScreenStack();
  }

  get screen(): Screen | null {
    return this.framework.activeScreen;
  }

  getDefaultScreen(): Screen | null {
    return this.framework.getScreenStack()[0] ?? null;
  }

  installScreen(screen: ScreenDescriptor | (() => React.ReactElement), name: string): void {
    this.framework.installScreen(name, normalizeScreenFactory(screen));
  }

  uninstallScreen(name: string): void {
    this.framework.uninstallScreen(name);
  }

  getScreen(name: string, expectedType?: React.ComponentType<Record<string, unknown>>): React.ReactElement {
    return expectedType === undefined ? this.framework.getScreen(name) : this.framework.getScreen(name, expectedType);
  }

  getChildById(id: string) {
    const child = this.framework.registry.getChildren(null).find((widget) => widget.id === id);

    if (child === undefined) {
      throw new NoMatches(`No child with id "${id}"`);
    }

    return child;
  }

  getWidgetById(id: string) {
    const widget = this.framework.findWidgets(`#${id}`)[0];

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
      return this.framework.pushScreenWait(descriptor, options);
    }

    return this.framework.pushScreen(descriptor, callbackOrOptions as ((result: unknown) => void) | ScreenOptions | undefined, extraOptions);
  }

  pushScreenWait(descriptor: ScreenDescriptor, options: ScreenOptions = {}): Promise<unknown> {
    return this.framework.pushScreenWait(descriptor, options);
  }

  popScreen(result?: unknown): Screen | null {
    return this.framework.popScreen(result);
  }

  switchScreen(descriptor: ScreenDescriptor, options: ScreenOptions = {}): Screen {
    return this.framework.switchScreen(descriptor, options);
  }

  switchMode(name: string): void {
    this.framework.switchMode(name);
  }

  addMode(name: string, factory: () => React.ReactElement): void {
    this.framework.addMode(name, factory);
  }

  removeMode(name: string): void {
    this.framework.removeMode(name);
  }

  render(): React.ReactElement {
    return (
      <TextualApp
        framework={this.framework}
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
    return this.framework.exitResult as Result | undefined;
  }

  exit(result?: Result): Result | undefined {
    return this.framework.exit(result) as Result | undefined;
  }

  get batchUpdateCount(): number {
    return this.framework.batchUpdateCount;
  }

  batchUpdate<T>(callback: () => T): T {
    return this.framework.batchUpdate(callback);
  }

  runWorker<TResult>(work: WorkerCallable<TResult>, options: WorkerOptions = {}): Worker<TResult> {
    return this.framework.runAppWorker(work, options);
  }

  get workers(): WorkerManager {
    return this.framework.workers;
  }

  notify(
    message: NotificationContent,
    severityOrOptions?: NotificationSeverity | NotifyOptions,
    timeout?: number,
    title?: NotificationContent,
    markup?: boolean,
  ): Notification {
    return this.framework.notify(message, severityOrOptions, timeout, title, markup);
  }

  clearNotifications(): void {
    this.framework.clearNotifications();
  }

  _unnotify(notification: Notification): void {
    this.framework._unnotify(notification);
  }

  get theme(): string {
    return this.framework.theme;
  }

  set theme(name: string) {
    this.framework.setTheme(name);
  }

  get dark(): boolean {
    return this.framework.dark;
  }

  set dark(value: boolean) {
    this.framework.setDarkMode(value);
  }

  get ansiTheme(): AnsiTheme {
    return this.framework.ansiTheme;
  }

  get ansiThemeDark(): AnsiTheme {
    return this.framework.ansiThemeDark;
  }

  set ansiThemeDark(theme: AnsiTheme) {
    this.framework.ansiThemeDark = theme;
  }

  get ansiThemeLight(): AnsiTheme {
    return this.framework.ansiThemeLight;
  }

  set ansiThemeLight(theme: AnsiTheme) {
    this.framework.ansiThemeLight = theme;
  }

  get app_suspend_signal() {
    return this.framework.signals.app_suspend_signal;
  }

  get app_resume_signal() {
    return this.framework.signals.app_resume_signal;
  }

  get theme_changed_signal() {
    return this.framework.signals.theme_changed_signal;
  }

  get mode_change_signal() {
    return this.framework.signals.mode_change_signal;
  }

  get screen_change_signal() {
    return this.framework.signals.screen_change_signal;
  }

  get features() {
    return this.framework.features;
  }

  get devtools() {
    return this.framework.devtools;
  }

  get debug(): boolean {
    return this.framework.debug;
  }

  suspend<TResult>(callback: () => Promise<TResult> | TResult): Promise<TResult> {
    return this.framework.suspend(callback);
  }

  searchCommands(commands: readonly SimpleCommand[]): Promise<CommandPalette> {
    return this.framework.searchCommands(commands);
  }

  // [LAW:single-enforcer] App is the boundary for lifecycle: startup,
  // shutdown, isRunning, idle observation, and refresh accounting.
  startup(): void {
    this.framework.startup();
  }

  shutdown(): void {
    this.framework.shutdown();
  }

  get isRunning(): boolean {
    return this.framework.isRunning;
  }

  whenIdle(): Promise<void> {
    return this.framework.whenIdle();
  }

  get displayCount(): number {
    return this.framework.displayCount;
  }

  findWidgets(selector: string): Widget[] {
    return this.framework.findWidgets(selector);
  }

  getByCssId(cssId: string): Widget | undefined {
    return this.framework.registry.getByCssId(cssId);
  }

  isScreenInstalled(name: string): boolean {
    return this.framework.isScreenInstalled(name);
  }

  get screenStackDepth(): number {
    return this.framework.screenStackDepth;
  }

  get activeMode(): string {
    return this.framework.activeMode;
  }

  get terminalSize(): Size {
    return this.framework.terminalSize;
  }

  // [LAW:single-enforcer] App is the boundary for focus routing. Focus
  // chain construction, navigation, and current-focus inspection all enter
  // through App so keyboard, pointer, and tests share one answer.
  get focusedNodeId(): string | null {
    return this.framework.focusedNodeId;
  }

  focusWidget(nodeId: string | null): void {
    this.framework.focusWidget(nodeId);
  }

  focusNext(selector?: string | Function): Widget | null {
    return this.framework.focusNext(selector);
  }

  focusPrevious(selector?: string | Function): Widget | null {
    return this.framework.focusPrevious(selector);
  }

  getFocusChain(): Widget[] {
    return this.framework.getFocusChain();
  }

  get pointerShape(): PointerShape {
    return this.framework.pointerShape;
  }

  get activeTooltip(): ActiveTooltip | null {
    return this.framework.activeTooltip;
  }

  get tooltipDelay(): number {
    return this.framework.tooltipDelay;
  }

  set tooltipDelay(delayMs: number | null | undefined) {
    this.framework.setTooltipDelay(delayMs);
  }

  // [LAW:single-enforcer] App is the boundary for message and key dispatch.
  // postMessage / postKey / runAction all flow through App so subscribers,
  // bindings, and instrumentation observe one ordered transcript.
  get messageQueueSize(): number {
    return this.framework.messageQueueSize;
  }

  postMessage(targetId: string, message: Message): boolean {
    return this.framework.postMessage(targetId, message);
  }

  postKey(input: string, meta: { ctrl?: boolean; shift?: boolean; meta?: boolean; paste?: boolean } = {}): void {
    this.framework.postKey(input, meta);
  }

  subscribeToMessages(subscriber: MessageSubscriber): () => void {
    return this.framework.subscribeToMessages(subscriber);
  }

  runAction(action: string, defaultTarget?: ActionTargetDescriptor): boolean {
    return this.framework.runAction(action, defaultTarget);
  }

  checkAction(action: string, defaultTarget?: ActionTargetDescriptor): boolean | null {
    return this.framework.checkAction(action, defaultTarget);
  }

  setKeymap(next: KeymapInput): void {
    this.framework.setKeymap(next);
  }

  updateKeymap(patch: KeymapInput): void {
    this.framework.updateKeymap(patch);
  }

  getActiveBindings(): ActiveBinding[] {
    return this.framework.getActiveBindings();
  }

  openCommandPalette(options: CommandPaletteOptions = {}): Promise<CommandPalette> {
    return this.framework.openCommandPalette(options);
  }

  // [LAW:single-enforcer] App is the boundary for async resource ownership.
  // Deferred and threaded callbacks enter through App so timer scope, idle
  // accounting, and shutdown draining share one authority.
  callLater<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.framework.callLater(callback, ...args);
  }

  callNext<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.framework.callNext(callback, ...args);
  }

  callAfterRefresh<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    this.framework.callAfterRefresh(callback, ...args);
  }

  callFromThread<TResult, TArgs extends unknown[]>(
    callback: (...args: TArgs) => TResult,
    ...args: TArgs
  ): Promise<TResult> {
    return this.framework.callFromThread(callback, ...args);
  }

  get notifications(): Notifications {
    return this.framework.notifications;
  }

  get themeManager(): ThemeManager {
    return this.framework.themeManager;
  }

  get signals(): AppSignals {
    return this.framework.signals;
  }

  get activeTheme(): ActiveTheme {
    return this.framework.activeTheme;
  }

  registerTheme(theme: ThemeDefinition): ActiveTheme {
    return this.framework.registerTheme(theme);
  }

  get animationLevel(): AnimationLevel {
    return this.framework.animationLevel;
  }

  set animationLevel(level: AnimationLevel) {
    this.framework.setAnimationLevel(level);
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
      framework: session.framework,
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
