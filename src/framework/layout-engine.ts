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
  private layoutPass = 1;
  private syncedLayoutPass = 0;

  constructor(deps: LayoutEngineDeps) {
    this.deps = deps;
    autoObservable(
      this,
      {
        deps: false,
        afterRefreshCallbacks: false,
        layoutReaders: false,
        afterRefreshRequester: false,
        layoutPass: false,
        syncedLayoutPass: false,
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
    this.syncLayoutReadersForPass();
  }

  // [LAW:one-source-of-truth] Ink recomputes the whole Yoga tree on every
  // render, so one commit anywhere invalidates every widget's rectangle. This
  // is the single re-derivation of all of them; callers supply only the
  // trigger (a widget's own commit, or the app shell's display pass) and never
  // their own measurement.
  private syncLayoutReaders(): void {
    // [LAW:no-silent-failure] The pass is recorded as derived only once the
    // sweep has actually derived it. Recorded up front, a reader that threw
    // would leave every reader behind it un-measured while the pass guard
    // reported the work done — one loud failure, then permanent quiet
    // staleness. The captured number names the pass that was swept.
    const sweptPass = this.layoutPass;

    for (const reader of this.layoutReaders.values()) {
      reader();
    }

    this.syncedLayoutPass = sweptPass;
  }

  // [LAW:no-ambient-temporal-coupling] "the geometry may have moved" is owned
  // state, not a timing guess: `attachLayoutPassCounter` numbers Ink's Yoga
  // passes, and this runs the derivation once per pass however many widgets
  // commit in it. Every widget still asks on its own commit — the epoch is
  // what makes the M-th ask in one pass free instead of another O(N) walk.
  syncLayoutReadersForPass(): void {
    if (this.syncedLayoutPass === this.layoutPass) {
      return;
    }

    this.syncLayoutReaders();
  }

  // [LAW:single-enforcer] Ink computes layout exactly once per React commit
  // (`resetAfterCommit` -> `onComputeLayout`, ink/build/reconciler.js:68),
  // immediately before that commit's layout effects. Chaining that hook is
  // what makes the pass counter true rather than inferred; the wrapper defers
  // to Ink's own handler and restores it on detach.
  attachLayoutPassCounter(rootNode: { onComputeLayout?: () => void }): () => void {
    const inkComputeLayout = rootNode.onComputeLayout;

    rootNode.onComputeLayout = () => {
      inkComputeLayout?.();
      this.layoutPass += 1;
    };

    return () => {
      rootNode.onComputeLayout = inkComputeLayout;
    };
  }

  // [LAW:single-enforcer] A reader is current from the moment it exists. The
  // pass sync cannot supply that: layout effects run in tree order, so a
  // sibling registering after another widget already synced the pass would
  // otherwise sit at Region.EMPTY until some later commit happened to sweep
  // it up. Running it here is O(1) per widget and owned in one place, so no
  // caller has to remember it.
  registerLayoutReader(nodeId: string, reader: LayoutReader): () => void {
    this.layoutReaders.set(nodeId, reader);
    reader();

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

}
