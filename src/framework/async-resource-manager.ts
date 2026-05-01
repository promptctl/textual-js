// [LAW:single-enforcer] AsyncResourceManager is the sole owner of timer
// lifecycle (install/clear/pause/resume/reset, per-node and global), the
// app-level worker owner identity, worker construction/start, and
// foreign-thread marshaling. The framework orchestrator triggers cross-cutting
// effects (timer dispatch, worker bookkeeping, error reporting) through a
// narrow injected deps interface — the manager never reaches back into
// AppRuntime directly.
// [LAW:one-source-of-truth] The named timer registry, the app worker-owner
// record, and the captured app thread id live in exactly one place: this
// manager. Framework lifecycle hooks (shutdown, suspend, unmount) call the
// manager rather than holding parallel state.
// [LAW:one-way-deps] The manager depends only on a narrow
// AsyncResourceManagerDeps interface; it does NOT import AppRuntime.

import "./mobx-config.js";

import { threadId } from "node:worker_threads";
import { autoObservable } from "./auto-observable.js";

import type { Widget } from "./widget.js";
import { Timer } from "../events/events.js";
import { ManagedTimer, type TimerCallback, type TimerOptions } from "../services/timer.js";
import {
  Worker,
  WorkerCancelled,
  WorkerFailed,
  type WorkerCallable,
  type WorkerManager,
  type WorkerOptions,
  type WorkerOwner,
} from "../services/worker.js";
import { RuntimeError, getActiveMessagePump } from "../services/concurrency.js";
import type { Message } from "../events/message.js";

// [LAW:one-way-deps] Narrow capability interface the manager requires from its
// host (typically AppRuntime). The manager never imports the host class.
export interface AsyncResourceManagerDeps {
  workers: WorkerManager;
  isNodeMounted(node: Widget): boolean;
  dispatchTimer(node: Widget, message: Timer): void;
  postMessage(targetId: string, message: Message): boolean;
  reportUnhandledError(error: unknown): void;
  callLater(callback: () => void): void;
  isRunning(): boolean;
  // True when the supplied active message pump belongs to the host framework
  // instance (i.e. the framework itself or one of its widgets). Used by
  // callFromThread to detect calls originating from the app thread.
  isOwnPump(pump: unknown): boolean;
}

export class AsyncResourceManager {
  private readonly deps: AsyncResourceManagerDeps;
  private readonly timers = new Map<string, ManagedTimer>();
  private readonly appThreadId = threadId;
  private readonly appWorkerOwner: WorkerOwner = {
    nodeId: "__app__",
    typeName: "App",
  };

  constructor(deps: AsyncResourceManagerDeps) {
    this.deps = deps;
    autoObservable(
      this,
      {
        deps: false,
        timers: false,
        appThreadId: false,
        appWorkerOwner: false,
      },
      { autoBind: true },
    );
  }

  // ---- Timer API ----

  setTimer(node: Widget, name: string, delayMs: number, callback: TimerCallback): void {
    this.installTimer(node, name, delayMs, callback, false, {});
  }

  setInterval(
    node: Widget,
    name: string,
    intervalMs: number,
    callback: TimerCallback,
    options: TimerOptions = {},
  ): void {
    this.installTimer(node, name, intervalMs, callback, true, options);
  }

  clearTimer(node: Widget, name: string): void {
    const key = this.timerKey(node.nodeId, name);
    const timer = this.timers.get(key);

    timer?.cancel();
    this.timers.delete(key);
  }

  pauseTimer(node: Widget, name: string): void {
    this.timers.get(this.timerKey(node.nodeId, name))?.pause();
  }

  resumeTimer(node: Widget, name: string): void {
    this.timers.get(this.timerKey(node.nodeId, name))?.resume();
  }

  resetTimer(node: Widget, name: string): void {
    this.timers.get(this.timerKey(node.nodeId, name))?.reset();
  }

  clearNodeTimers(nodeId: string): void {
    for (const [key, timer] of this.timers.entries()) {
      if (key.startsWith(`${nodeId}:`)) {
        timer.cancel();
        this.timers.delete(key);
      }
    }
  }

  clearAllTimers(): void {
    for (const timer of this.timers.values()) {
      timer.cancel();
    }

    this.timers.clear();
  }

  pauseAllTimers(): void {
    for (const timer of this.timers.values()) {
      timer.pause();
    }
  }

  resumeAllTimers(): void {
    for (const timer of this.timers.values()) {
      timer.resume();
    }
  }

  // ---- Worker API ----

  runWorker<TResult>(
    node: Widget,
    work: WorkerCallable<TResult>,
    options: WorkerOptions = {},
  ): Worker<TResult> {
    const workerName = options.name ?? `${node.typeName.toLowerCase()}-worker`;
    const worker = new Worker(
      node,
      work,
      workerName,
      options.group ?? (options.exclusive === true ? workerName : undefined),
      options.description ?? options.name ?? `${node.typeName} worker`,
      options.exitOnError ?? true,
      options.thread ?? false,
      (targetId, message) => this.deps.postMessage(targetId, message),
      () => undefined,
    );
    const registeredWorker = this.deps.workers.addWorker(worker, false, options.exclusive ?? false);
    const shouldStart = options.start ?? true;

    this.startWorker(registeredWorker, shouldStart);

    return registeredWorker;
  }

  runAppWorker<TResult>(work: WorkerCallable<TResult>, options: WorkerOptions = {}): Worker<TResult> {
    const workerName = options.name ?? "app-worker";
    const worker = new Worker(
      this.appWorkerOwner,
      work,
      workerName,
      options.group ?? (options.exclusive === true ? workerName : undefined),
      options.description ?? options.name ?? "App worker",
      options.exitOnError ?? true,
      options.thread ?? false,
      (targetId, message) => this.deps.postMessage(targetId, message),
      () => undefined,
    );
    const registeredWorker = this.deps.workers.addWorker(worker, false, options.exclusive ?? false);
    const shouldStart = options.start ?? true;

    this.startWorker(registeredWorker, shouldStart);

    return registeredWorker;
  }

  // ---- Foreign-thread marshaling ----

  callFromThread<TResult, TArgs extends unknown[]>(
    callback: (...args: TArgs) => TResult,
    ...args: TArgs
  ): Promise<TResult> {
    if (!this.deps.isRunning()) {
      throw new RuntimeError("callFromThread requires a running app");
    }

    if (threadId === this.appThreadId) {
      // [LAW:single-enforcer] The app-thread identity check lives at the
      // callFromThread boundary, independent of message-pump context.
      throw new RuntimeError("callFromThread must be called from a foreign thread");
    }

    try {
      const activePump = getActiveMessagePump();

      if (this.deps.isOwnPump(activePump)) {
        throw new RuntimeError("callFromThread must be called from a foreign thread");
      }
    } catch (error) {
      if (error instanceof RuntimeError && error.message !== "No active message pump") {
        throw error;
      }
    }

    return new Promise<TResult>((resolve, reject) => {
      // [LAW:single-enforcer] Foreign-thread callbacks are marshaled through
      // callLater so app mutation still enters via the message queue boundary.
      this.deps.callLater(() => {
        try {
          resolve(callback(...args));
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  call_from_thread<TResult, TArgs extends unknown[]>(
    callback: (...args: TArgs) => TResult,
    ...args: TArgs
  ): Promise<TResult> {
    return this.callFromThread(callback, ...args);
  }

  // ---- Private helpers ----

  private startWorker<TResult>(worker: Worker<TResult>, shouldStart: boolean): void {
    if (!shouldStart) {
      return;
    }

    void worker.start().catch((error) => {
      if (!(error instanceof WorkerCancelled) && worker.exitOnError) {
        // [LAW:single-enforcer] exitOnError is enforced only at the worker
        // start boundary; worker.wait() remains result/error retrieval.
        this.deps.reportUnhandledError(
          new WorkerFailed((error as Error).message, { cause: error as Error }),
        );
      }
    });
  }

  private installTimer(
    node: Widget,
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
    // ownership and lifecycle stay canonical at the manager boundary.
    const timer = new ManagedTimer(
      name,
      delayMs,
      () => {
        if (this.deps.isNodeMounted(node)) {
          this.deps.dispatchTimer(node, new Timer(callback));
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
}
