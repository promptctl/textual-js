// [LAW:single-enforcer] AppLifecycleOrchestrator is the sole owner of the
// app-lifecycle phase flags (isRunning / isClosing / readyMessagePosted), the
// exit result, the batch-update depth, the unhandled-error capture state, the
// host-controlled and host-reported terminal sizes, and the displayCount
// observable. Every lifecycle entry point (startup / shutdown / exit / suspend
// / batchUpdate / handleAppBlur / handleAppFocus / postResize) routes through
// this service so cross-cutting effects (queue lifecycle, focus reset, style
// recalc, signal publish, driver suspend/resume, host after-refresh requester)
// fire from exactly one place.
// [LAW:one-source-of-truth] The phase flags + exit result + terminal-size
// state + displayCount + pendingError live here exactly once. The framework
// retains public getters/setters that delegate so existing callers (App, host
// renderer, tests) continue to work unchanged until 7w9.10 deletes the
// framework class.
// [LAW:one-way-deps] The orchestrator depends only on the narrow
// AppLifecycleDeps interface; it does NOT import TextualFramework. The deps
// surface is intentionally wide because lifecycle composes most other
// services — but every callback is a single capability-shaped action, not a
// generic back-reference.

import "./mobx-config.js";

import { runInAction } from "mobx";

import { autoObservable } from "./auto-observable.js";

import { AppBlur, AppFocus, Ready, Resize } from "../events/events.js";
import type { Message } from "../events/message.js";
import { Size } from "../geometry/index.js";
import type { Widget } from "./widget.js";
import type { FocusAddress } from "./focus-engine.js";
import type { AppDriver } from "./app-framework.js";

export class SuspendNotSupported extends Error {}

// [LAW:one-way-deps] Narrow capability interface the orchestrator requires
// from its host (typically TextualFramework). The orchestrator never imports
// the host class — only this shape. Each entry is a single capability-shaped
// action; the orchestrator never stores a back-reference to a service.
export interface AppLifecycleDeps {
  // ---- Driver (terminal application mode) ----
  getDriver(): AppDriver;

  // ---- Message pump ----
  reopenAppQueue(): void;
  closeAllMessageQueues(prune: boolean): void;
  resetBatchPending(): void;
  discardQueuedCallbacks(): void;
  emitCloseMessages(): void;
  emitBroadcast(message: Message): void;
  postToFocused(message: Message): void;
  enqueueLifecycleMessages(widget: Widget): void;
  onBatchExit(): void;

  // ---- Widget registry ----
  listWidgets(): Widget[];

  // ---- Focus / pointer ----
  getFocusedNodeId(): string | null;
  setFocusedNodeId(nodeId: string | null): void;
  scheduleActiveScreenFocusResolution(forceRefresh: boolean): void;
  resetFocusBlurState(): void;
  isAppBlurred(): boolean;
  beginAppBlur(): void;
  endAppBlur(): { shouldRestore: boolean; address: FocusAddress | null };
  resolveExactFocusTarget(address: FocusAddress): Widget | null;
  applyFocusChange(nodeId: string | null, options: { markBlurOverride: boolean }): void;
  resetPointer(): void;

  // ---- Style engine ----
  flushPendingRecalc(): void;
  resetPendingRecalc(): void;
  closeAllWatchers(): void;
  recalculateStyles(): void;

  // ---- Async resources / workers / timers ----
  cancelAllWorkers(): void;
  clearAllTimers(): void;
  pauseAllTimers(): void;
  resumeAllTimers(): void;

  // ---- Tooltip ----
  clearTooltipTimer(): void;
  clearActiveTooltip(): void;
  hideTooltip(): void;

  // ---- Signals ----
  publishAppResume(): void;
  publishAppSuspend(): void;

  // ---- Layout engine (host after-refresh requester + display pass) ----
  layoutAttachAfterRefreshRequester(requester: () => void): () => void;
  layoutFlushAfterRefreshCallbacks(): void;
  layoutRecordDisplayPass(): void;
}

export class AppLifecycleOrchestrator {
  // [LAW:one-source-of-truth] Phase flags and exit/error/batch state live in
  // this single object. All other code reads them through framework getters
  // that delegate here.
  isRunning = false;
  exitResult: unknown = undefined;
  batchUpdateCount = 0;
  captureUnhandledErrors = false;
  displayCount = 0;
  terminalSize = new Size(80, 24);
  private isClosing = false;
  private readyMessagePosted = false;
  private pendingError: unknown = null;
  private controlledTerminalSize: Size | null = null;
  private readonly deps: AppLifecycleDeps;

  constructor(deps: AppLifecycleDeps) {
    this.deps = deps;
    autoObservable(
      this,
      {
        deps: false,
      },
      { autoBind: true },
    );
  }

  // ---- Phase probes ----

  getIsClosing(): boolean {
    return this.isClosing;
  }

  // ---- Startup / shutdown / exit ----

  startup(): void {
    if (this.isRunning) {
      return;
    }

    this.isClosing = false;
    this.deps.reopenAppQueue();
    this.isRunning = true;
    this.deps.publishAppResume();

    for (const widget of this.deps.listWidgets()) {
      this.deps.enqueueLifecycleMessages(widget);
    }

    if (this.deps.getFocusedNodeId() === null) {
      this.deps.scheduleActiveScreenFocusResolution(true);
    }

    if (!this.readyMessagePosted) {
      this.readyMessagePosted = true;
      this.deps.emitBroadcast(new Ready());
    }
  }

  shutdown(): void {
    this.isClosing = true;
    this.deps.closeAllMessageQueues(false);
    this.batchUpdateCount = 0;
    this.deps.resetPendingRecalc();
    this.deps.resetBatchPending();
    this.deps.discardQueuedCallbacks();
    this.deps.setFocusedNodeId(null);
    this.deps.resetPointer();
    this.deps.cancelAllWorkers();
    this.deps.clearAllTimers();
    this.deps.clearTooltipTimer();
    this.deps.clearActiveTooltip();
    this.deps.closeAllWatchers();
    this.deps.resetFocusBlurState();
    this.isRunning = false;
    this.deps.emitCloseMessages();
    this.deps.publishAppSuspend();
  }

  exit(result?: unknown): unknown {
    this.exitResult = result;
    this.shutdown();
    return result;
  }

  async suspend<TResult>(callback: () => Promise<TResult> | TResult): Promise<TResult> {
    const driver = this.deps.getDriver();

    if (!driver.canSuspend || driver.isHeadless) {
      throw new SuspendNotSupported("Suspend is not supported by this driver");
    }

    // [LAW:single-enforcer] App suspend owns signal publishing, timer pausing,
    // and driver mode changes; drivers only enter/exit terminal application mode.
    this.deps.publishAppSuspend();
    this.deps.pauseAllTimers();
    await driver.suspendApplicationMode();

    try {
      return await callback();
    } finally {
      await driver.resumeApplicationMode();
      this.deps.resumeAllTimers();
      this.deps.publishAppResume();
      this.deps.recalculateStyles();
    }
  }

  // ---- Batch updates ----

  batchUpdate<T>(callback: () => T): T {
    runInAction(() => {
      this.batchUpdateCount += 1;
    });

    try {
      return runInAction(() => callback());
    } finally {
      runInAction(() => {
        this.batchUpdateCount = Math.max(0, this.batchUpdateCount - 1);
      });

      if (this.batchUpdateCount === 0) {
        // [LAW:single-enforcer] Batched style and queue flushes resume only
        // from the outermost batch boundary instead of each nested caller.
        this.deps.flushPendingRecalc();
        this.deps.onBatchExit();
      }
    }
  }

  // ---- App focus / blur ----

  handleAppBlur(): void {
    if (this.deps.isAppBlurred()) {
      return;
    }

    this.deps.beginAppBlur();
    this.deps.hideTooltip();
    this.deps.emitBroadcast(new AppBlur());
    this.deps.applyFocusChange(null, { markBlurOverride: false });
  }

  handleAppFocus(): void {
    this.deps.emitBroadcast(new AppFocus());

    if (!this.deps.isAppBlurred()) {
      return;
    }

    const { shouldRestore, address } = this.deps.endAppBlur();

    if (!shouldRestore) {
      return;
    }

    const target = address === null ? null : this.deps.resolveExactFocusTarget(address);
    this.deps.applyFocusChange(target?.nodeId ?? null, { markBlurOverride: false });
  }

  // ---- Unhandled error capture ----

  setCaptureUnhandledErrors(enabled: boolean): void {
    this.captureUnhandledErrors = enabled;
  }

  reportUnhandledError(error: unknown): void {
    if (!this.captureUnhandledErrors) {
      return;
    }

    if (this.pendingError === null) {
      runInAction(() => {
        this.pendingError = error;
      });
    }
  }

  throwPendingError(): void {
    if (this.pendingError !== null) {
      const error = this.pendingError;
      runInAction(() => {
        this.pendingError = null;
      });
      throw error;
    }
  }

  clearPendingError(): void {
    runInAction(() => {
      this.pendingError = null;
    });
  }

  // ---- Terminal size ----

  setTerminalSize(size: Size): void {
    if (this.terminalSize.equals(size)) {
      return;
    }

    this.terminalSize = size;
    this.deps.recalculateStyles();
  }

  setControlledTerminalSize(size: Size | null): void {
    this.controlledTerminalSize = size;

    if (size !== null) {
      this.setTerminalSize(size);
    }
  }

  syncHostTerminalSize(size: Size): void {
    this.setTerminalSize(this.controlledTerminalSize ?? size);
  }

  postResize(width: number, height: number): void {
    this.setTerminalSize(new Size(width, height));
    this.deps.postToFocused(new Resize(width, height));
  }

  // ---- Host after-refresh requester / display pass ----

  attachAfterRefreshRequester(requester: () => void): () => void {
    return this.deps.layoutAttachAfterRefreshRequester(requester);
  }

  flushAfterRefreshCallbacks(): void {
    this.deps.layoutFlushAfterRefreshCallbacks();
  }

  recordDisplayPass(): void {
    this.deps.layoutRecordDisplayPass();
  }

  // ---- displayCount writer (called by LayoutEngine deps) ----

  incrementDisplayCount(): void {
    this.displayCount += 1;
  }
}
