// [LAW:single-enforcer] LayoutEngine is the sole owner of the post-render
// callback queue, the layout-reader subscription map, and the after-refresh
// requester slot. The framework orchestrator delegates registration, flushing,
// and display-pass bookkeeping through a narrow injected deps interface — the
// engine never reaches back into AppRuntime directly.
// [LAW:one-source-of-truth] The afterRefreshCallbacks queue, layoutReaders
// registry, and the active afterRefreshRequester each live in exactly one
// place: this engine. Framework callers schedule via the engine's API rather
// than maintaining parallel queues. The public displayCount observable still
// lives on the framework; the engine writes to it via deps.
// [LAW:one-way-deps] The engine depends only on a narrow LayoutEngineDeps
// interface; it does NOT import AppRuntime.

import "./mobx-config.js";

import { autoObservable } from "./auto-observable.js";

export type AfterRefreshCallback = () => void;
export type LayoutReader = () => void;

// [LAW:one-way-deps] Narrow capability interface the engine requires from its
// host (typically AppRuntime). The engine never imports the host class.
export interface LayoutEngineDeps {
  // Schedule a callback on the framework's deferred-callback queue.
  callLater(callback: () => void): void;
  // Run a function with the host as the active message pump (so callbacks
  // executed via flushAfterRefreshCallbacks observe the same pump context the
  // framework establishes for its own deferred work).
  runWithHostPump(callback: () => void): void;
  // Bump the public displayCount observable on the framework.
  incrementDisplayCount(): void;
}

export class LayoutEngine {
  private readonly deps: LayoutEngineDeps;
  private readonly afterRefreshCallbacks: AfterRefreshCallback[] = [];
  private readonly layoutReaders = new Map<string, LayoutReader>();
  private afterRefreshRequester: (() => void) | null = null;

  constructor(deps: LayoutEngineDeps) {
    this.deps = deps;
    autoObservable(
      this,
      {
        deps: false,
        afterRefreshCallbacks: false,
        layoutReaders: false,
        afterRefreshRequester: false,
      },
      { autoBind: true },
    );
  }

  callAfterRefresh<TArgs extends unknown[]>(
    callback: (...args: TArgs) => void,
    ...args: TArgs
  ): void {
    this.afterRefreshCallbacks.push(() => {
      this.deps.runWithHostPump(() => {
        callback(...args);
      });
    });

    if (this.afterRefreshRequester === null) {
      this.deps.callLater(() => this.flushAfterRefreshCallbacks());
      return;
    }

    this.deps.callLater(() => {
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
    this.deps.incrementDisplayCount();
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

  private syncWidgetLayoutReaders(): void {
    // [LAW:one-source-of-truth] Ink layout measurement is centralized here so
    // stale sibling or ancestor geometry cannot become a second spatial truth.
    for (const reader of this.layoutReaders.values()) {
      reader();
    }
  }
}
