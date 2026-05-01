// [LAW:single-enforcer] ScreenStackService is the sole owner of screen-stack
// state (mode stacks, mode factories, installed screens, the active mode name,
// and the reactive mutation marker). Cross-cutting effects (focus snapshots,
// message broadcast, css watcher refresh, signals) are invoked by the framework
// orchestrator after the service mutates state — the service never reaches back
// into the framework directly.
// [LAW:one-source-of-truth] modeStacks/installedScreens/activeMode live in
// exactly one place: this service. Framework getters and tests read through it.
// [LAW:one-way-deps] The service depends only on a narrow injected deps
// interface; it does NOT import TextualFramework.

import "./mobx-config.js";

import React from "react";
import { autoObservable } from "./auto-observable.js";

import { makeBindings, type BindingDeclaration } from "../bindings/index.js";
import type { ParsedStylesheet } from "../styles/index.js";
import type { ProviderConstructor } from "../commands/index.js";
import type {
  Screen,
  ScreenDescriptor,
  ScreenOptions,
} from "./app-framework.js";
import {
  ActiveModeError,
  InvalidModeError,
  ScreenStackError,
  UnknownModeError,
} from "./app-framework.js";
import type { WidgetActions } from "./widget-registry.js";

export const DEFAULT_MODE = "_default";

export interface ScreenFactoryRecord {
  factory: () => React.ReactElement;
  cachedElement: React.ReactElement | null;
}

export interface ScreenStylesheetSnapshot {
  css: string | null;
  cssPath: string[];
  scopedCss: boolean;
  stylesheets: ParsedStylesheet[];
}

// [LAW:one-way-deps] Narrow capability interface the service requires from its
// host (typically TextualFramework). The service never imports the host class.
export interface ScreenStackDeps {
  readScreenStylesheetState(
    element: React.ReactElement,
    options: ScreenOptions,
  ): ScreenStylesheetSnapshot;
  readCommandProvidersFromElement(element: React.ReactElement): ReadonlySet<ProviderConstructor>;
}

let nextScreenId = 1;

export function createImplicitEntry(): Screen {
  return {
    id: "_default",
    name: null,
    element: null,
    bindings: [],
    actions: undefined,
    autoFocus: null,
    css: null,
    cssPath: [],
    scopedCss: true,
    stylesheets: [],
    implicit: true,
    savedFocusNodeId: null,
    commandProviders: new Set(),
    lastFocusedAddress: null,
    waiters: [],
  };
}

export function normalizePushArgs(
  callbackOrOptions?: ((result: unknown) => void) | ScreenOptions,
  extraOptions?: ScreenOptions,
): { callback?: (result: unknown) => void; options: ScreenOptions } {
  if (typeof callbackOrOptions === "function") {
    return { callback: callbackOrOptions, options: extraOptions ?? {} };
  }

  return { callback: undefined, options: callbackOrOptions ?? {} };
}

export class ScreenStackService {
  // [LAW:one-source-of-truth] These fields are the single backing store for
  // all screen-stack state in the application.
  activeMode: string = DEFAULT_MODE;
  screenStackVersion = 0;
  private readonly modeStacks: Map<string, Screen[]> = new Map();
  private readonly modeFactories: Map<string, () => React.ReactElement> = new Map();
  private readonly installedScreens: Map<string, ScreenFactoryRecord> = new Map();
  private readonly deps: ScreenStackDeps;

  constructor(deps: ScreenStackDeps) {
    this.deps = deps;
    // [LAW:one-source-of-truth] The default mode always carries an implicit
    // base entry; popScreen's "last screen" invariant reads from stack length,
    // which means that phantom is the single anchor preventing an empty
    // default stack.
    this.modeStacks.set(DEFAULT_MODE, [createImplicitEntry()]);

    autoObservable(
      this,
      {
        // Maps are observed by mutation marker (screenStackVersion) only.
        modeStacks: false,
        modeFactories: false,
        installedScreens: false,
        deps: false,
      },
      { autoBind: true },
    );
  }

  // ---- Installed-screen registry ----

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

  // ---- Mode lifecycle ----

  hasMode(name: string): boolean {
    return name === DEFAULT_MODE || this.modeFactories.has(name);
  }

  modeFactory(name: string): (() => React.ReactElement) | undefined {
    return this.modeFactories.get(name);
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

  ensureKnownMode(name: string): void {
    if (name !== DEFAULT_MODE && !this.modeFactories.has(name)) {
      throw new UnknownModeError(`Unknown mode "${name}"`);
    }
  }

  setActiveMode(name: string): void {
    this.activeMode = name;
    this.screenStackVersion += 1;
  }

  modeStackLength(name: string): number {
    return this.modeStacks.get(name)?.length ?? 0;
  }

  setModeStack(name: string, stack: Screen[]): void {
    this.modeStacks.set(name, stack);
    this.screenStackVersion += 1;
  }

  // ---- Stack reads ----

  get activeScreen(): Screen | null {
    // [LAW:dataflow-not-control-flow] Reading screenStackVersion hooks MobX
    // into mutations of plain-Map-backed stacks so observers re-render.
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

  getScreenStack(mode?: string): Screen[] {
    void this.screenStackVersion;
    return (this.modeStacks.get(mode ?? this.activeMode) ?? []).slice();
  }

  // ---- Stack mutation primitives (orchestration lives in the host) ----

  pushEntry(entry: Screen): void {
    const stack = this.modeStacks.get(this.activeMode) ?? [];
    stack.push(entry);
    this.modeStacks.set(this.activeMode, stack);
    this.screenStackVersion += 1;
  }

  popEntry(): Screen {
    const stack = this.modeStacks.get(this.activeMode) ?? [];

    if (stack.length <= 1) {
      throw new ScreenStackError(`Cannot pop the last screen`);
    }

    const popped = stack.pop()!;
    this.modeStacks.set(this.activeMode, stack);
    this.screenStackVersion += 1;
    return popped;
  }

  replaceTop(entry: Screen): { previous: Screen | undefined } {
    const stack = this.modeStacks.get(this.activeMode) ?? [];
    const previous = stack[stack.length - 1];
    stack[stack.length - 1] = entry;
    this.modeStacks.set(this.activeMode, stack);
    this.screenStackVersion += 1;
    return { previous };
  }

  topOfActiveStack(): Screen | undefined {
    const stack = this.modeStacks.get(this.activeMode) ?? [];
    return stack[stack.length - 1];
  }

  activeStackIsEmpty(): boolean {
    const stack = this.modeStacks.get(this.activeMode) ?? [];
    return stack.length === 0;
  }

  // ---- Screen factories ----

  resolveScreenElement(descriptor: ScreenDescriptor): React.ReactElement {
    if (typeof descriptor === "string") {
      return this.getScreen(descriptor);
    }

    if (typeof descriptor === "function") {
      const Component = descriptor as React.ComponentType<Record<string, unknown>>;
      return React.createElement(Component);
    }

    return descriptor;
  }

  createScreen(
    element: React.ReactElement,
    options: ScreenOptions & { callback?: (result: unknown) => void },
    onDismiss: (result: unknown) => void,
  ): Screen {
    const screenType = element.type as { AUTO_FOCUS?: string | null; BINDINGS?: Iterable<BindingDeclaration> };
    const bindings = makeBindings([...(screenType.BINDINGS ?? []), ...(options.bindings ?? [])]);
    const screenStyles = this.deps.readScreenStylesheetState(element, options);
    const staticAutoFocus = screenType.AUTO_FOCUS;
    const entry: Screen = {
      id: `screen-${nextScreenId++}`,
      name: options.name ?? null,
      element,
      bindings,
      actions: undefined,
      autoFocus: options.autoFocus ?? staticAutoFocus ?? null,
      css: screenStyles.css,
      cssPath: screenStyles.cssPath,
      scopedCss: screenStyles.scopedCss,
      stylesheets: screenStyles.stylesheets,
      implicit: false,
      savedFocusNodeId: null,
      commandProviders: this.deps.readCommandProvidersFromElement(element),
      lastFocusedAddress: null,
      waiters: [],
      callback: options.callback,
    };

    entry.actions = this.mergeScreenActions(entry, options.actions, onDismiss);
    return entry;
  }

  private mergeScreenActions(
    entry: Screen,
    actions: WidgetActions | undefined,
    onDismiss: (result: unknown) => void,
  ): WidgetActions {
    const builtins: WidgetActions = {
      action_dismiss: (result?: unknown) => {
        void entry;
        onDismiss(result);
      },
      _action_dismiss: (result?: unknown) => {
        void entry;
        onDismiss(result);
      },
    };

    return {
      ...builtins,
      ...(actions ?? {}),
    };
  }

  // ---- Waiters / result resolution ----

  resolveScreenResult(screen: Screen, result: unknown): void {
    const callback = screen.callback;
    const waiters = screen.waiters.splice(0);

    screen.callback = undefined;
    callback?.(result);

    for (const waiter of waiters) {
      waiter(result);
    }
  }

  clearScreenWaiters(screen: Screen | undefined): void {
    if (screen === undefined) {
      return;
    }

    screen.callback = undefined;
    screen.waiters.splice(0);
  }

  // ---- Iteration helpers (used by host CSS/path collection) ----

  iterAllStacks(): IterableIterator<Screen[]> {
    return this.modeStacks.values();
  }
}
