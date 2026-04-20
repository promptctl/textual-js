import React from "react";

import type { BindingDeclaration } from "../bindings/index.js";
import {
  TextualFramework,
  type KeymapInput,
  type SimpleCommand,
  type SystemCommand,
} from "../framework/app-framework.js";
import type { WidgetActions } from "../framework/widget-registry.js";
import { CommandPalette, type ProviderConstructor } from "../commands/index.js";
import { Notification, type NotificationSeverity } from "../services/notifications.js";
import type { AnsiTheme } from "../services/theme.js";
import { Worker, type WorkerCallable, type WorkerOptions } from "../services/worker.js";
import { runTestRoot, type RunTestOptions, type TestSession } from "../testing/run-test.js";
import { TextualApp } from "./textual-app.js";

export interface AppOptions {
  framework?: TextualFramework;
  title?: unknown;
  subTitle?: unknown;
  sub_title?: unknown;
  css?: string;
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

export interface AppRunTestOptions extends Pick<RunTestOptions, "messageHook" | "size" | "transients"> {}

export interface AppTestSession<Result> extends Omit<TestSession, "app" | "result"> {
  app: App<Result>;
  readonly result: Result | undefined;
}

interface StoredAppOptions {
  css?: string;
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

export class App<Result = unknown> {
  readonly framework: TextualFramework;
  private readonly appOptions: StoredAppOptions;
  private appTitle = "";
  private appSubTitle = "";

  constructor(options: AppOptions = {}) {
    this.framework = options.framework ?? new TextualFramework();
    this.appOptions = {
      css: options.css,
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
    this.subTitle = options.subTitle ?? options.sub_title ?? "";
  }

  protected compose(): React.ReactNode {
    return null;
  }

  getSystemCommands(_screen: unknown): Iterable<SystemCommand> {
    return [];
  }

  render(): React.ReactElement {
    return (
      <TextualApp
        framework={this.framework}
        css={this.appOptions.css}
        stylesheet={this.appOptions.stylesheet}
        theme={this.appOptions.theme}
        bindings={this.appOptions.bindings}
        keymap={this.appOptions.keymap}
        actions={this.appOptions.actions}
        commandProviders={this.resolveCommandProviders()}
        getSystemCommands={(screen) => this.getSystemCommands(screen)}
        autoFocus={this.appOptions.autoFocus}
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

  get sub_title(): string {
    return this.subTitle;
  }

  set sub_title(value: unknown) {
    // [LAW:one-source-of-truth] camelCase storage is the canonical JS state;
    // the snake_case surface is a derived Stage 0 alias, not a second store.
    this.subTitle = value;
  }

  get returnValue(): Result | undefined {
    return this.framework.exitResult as Result | undefined;
  }

  get return_value(): Result | undefined {
    // [LAW:one-source-of-truth] returnValue remains the canonical JS surface;
    // the Stage 0 snake_case alias derives from it so the values cannot drift.
    return this.returnValue;
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

  batch_update<T>(callback: () => T): T {
    return this.batchUpdate(callback);
  }

  runWorker<TResult>(work: WorkerCallable<TResult>, options: WorkerOptions = {}): Worker<TResult> {
    return this.framework.runAppWorker(work, options);
  }

  run_worker<TResult>(work: WorkerCallable<TResult>, options: WorkerOptions = {}): Worker<TResult> {
    return this.runWorker(work, options);
  }

  notify(message: string, severity?: NotificationSeverity, timeout?: number, title?: string): Notification {
    return this.framework.notify(message, severity, timeout, title);
  }

  clearNotifications(): void {
    this.framework.clearNotifications();
  }

  clear_notifications(): void {
    this.clearNotifications();
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

  get ansi_theme(): AnsiTheme {
    return this.ansiTheme;
  }

  get ansiThemeDark(): AnsiTheme {
    return this.framework.ansiThemeDark;
  }

  set ansiThemeDark(theme: AnsiTheme) {
    this.framework.ansiThemeDark = theme;
  }

  get ansi_theme_dark(): AnsiTheme {
    return this.ansiThemeDark;
  }

  set ansi_theme_dark(theme: AnsiTheme) {
    this.ansiThemeDark = theme;
  }

  get ansiThemeLight(): AnsiTheme {
    return this.framework.ansiThemeLight;
  }

  set ansiThemeLight(theme: AnsiTheme) {
    this.framework.ansiThemeLight = theme;
  }

  get ansi_theme_light(): AnsiTheme {
    return this.ansiThemeLight;
  }

  set ansi_theme_light(theme: AnsiTheme) {
    this.ansiThemeLight = theme;
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

  suspend<TResult>(callback: () => Promise<TResult> | TResult): Promise<TResult> {
    return this.framework.suspend(callback);
  }

  searchCommands(commands: readonly SimpleCommand[]): Promise<CommandPalette> {
    return this.framework.searchCommands(commands);
  }

  search_commands(commands: readonly SimpleCommand[]): Promise<CommandPalette> {
    return this.searchCommands(commands);
  }

  private resolveCommandProviders(): Iterable<ProviderConstructor> | null | undefined {
    const constructorProviders = (this.constructor as { COMMANDS?: Iterable<ProviderConstructor> }).COMMANDS;
    // [LAW:one-source-of-truth] App-level COMMANDS replacement is resolved
    // once here so TextualApp and the framework consume one provider set.
    return this.appOptions.commandProviders ?? constructorProviders;
  }

  async runTest(options: AppRunTestOptions = {}): Promise<AppTestSession<Result>> {
    const app = this;
    const session = await runTestRoot(this.render(), this.framework, options);

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

  async run_test(options: AppRunTestOptions = {}): Promise<AppTestSession<Result>> {
    // [LAW:one-source-of-truth] runTest is the canonical JS harness entrypoint.
    // run_test is the Stage 0 alias so both surfaces share one implementation.
    return this.runTest(options);
  }
}
