import React from "react";

import type { BindingDeclaration } from "../bindings/index.js";
import { TextualFramework, type KeymapInput } from "../framework/app-framework.js";
import type { WidgetActions } from "../framework/widget-registry.js";
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
