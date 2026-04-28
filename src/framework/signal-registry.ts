// [LAW:single-enforcer] SignalRegistry is the sole owner of the framework
// signal composite (the six named app/theme/mode/screen/bindings signals)
// and the per-widget Signal lifecycle (creation + node prune on unmount).
// Framework methods are thin delegators that read through this service.
// [LAW:one-source-of-truth] AppSignals + the internal Signal registry live in
// exactly one place: this service.
// [LAW:one-way-deps] The service depends only on a narrow injected deps
// interface; it does NOT import TextualFramework.

import "./mobx-config.js";

import { makeAutoObservable } from "mobx";

import { Signal } from "../services/signal.js";
import type { ActiveTheme } from "../services/theme.js";
import type { Widget } from "./widget.js";
import type { Screen } from "./app-framework.js";

export interface AppSignals {
  theme_changed_signal: Signal<ActiveTheme>;
  app_suspend_signal: Signal<void>;
  app_resume_signal: Signal<void>;
  mode_change_signal: Signal<string>;
  screen_change_signal: Signal<Screen | null>;
  bindings_updated_signal: Signal<void>;
}

// [LAW:one-way-deps] Narrow capability interface the registry requires from
// its host (typically TextualFramework). The registry never imports the host
// class — only this shape.
export interface SignalRegistryDeps {
  isRunning(): boolean;
  isNodeMounted(node: Widget): boolean;
  callLater(callback: () => void): void;
}

export class SignalRegistry {
  readonly signals: AppSignals;
  private readonly registry = new Set<Signal<unknown>>();
  private readonly deps: SignalRegistryDeps;

  constructor(deps: SignalRegistryDeps) {
    this.deps = deps;
    this.signals = {
      theme_changed_signal: this.createFrameworkSignal<ActiveTheme>(),
      app_suspend_signal: this.createFrameworkSignal<void>(),
      app_resume_signal: this.createFrameworkSignal<void>(),
      mode_change_signal: this.createFrameworkSignal<string>(),
      screen_change_signal: this.createFrameworkSignal<Screen | null>(),
      bindings_updated_signal: this.createFrameworkSignal<void>(),
    };

    makeAutoObservable(
      this,
      {
        registry: false,
        deps: false,
        signals: false,
      } as never,
      { autoBind: true },
    );
  }

  createSignal<TValue>(owner: Widget, description = ""): Signal<TValue> {
    const signal = new Signal<TValue>(
      () => this.deps.isNodeMounted(owner),
      (node) => this.deps.isNodeMounted(node),
      (callback) => this.deps.callLater(callback),
      description,
    );
    this.registry.add(signal as Signal<unknown>);
    return signal;
  }

  // [LAW:single-enforcer] Unmount-driven signal cleanup runs through one
  // entry point so every widget removal prunes subscriptions identically,
  // regardless of which signal they came from.
  pruneNode(nodeId: string): void {
    for (const signal of this.registry) {
      signal.pruneNode(nodeId);
    }
  }

  private createFrameworkSignal<TValue>(): Signal<TValue> {
    const signal = new Signal<TValue>(
      () => this.deps.isRunning(),
      (node) => this.deps.isNodeMounted(node),
      (callback) => this.deps.callLater(callback),
      "framework",
    );
    this.registry.add(signal as Signal<unknown>);
    return signal;
  }
}
