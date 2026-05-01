import { AsyncLocalStorage } from "node:async_hooks";
import { Worker as NodeWorker } from "node:worker_threads";

import { observable, runInAction } from "mobx";
import { autoObservable } from "../framework/auto-observable.js";

import type { Content } from "../content/index.js";
import { Message, type MessageInit } from "../events/message.js";

export type WorkerState = "pending" | "running" | "success" | "error" | "cancelled";
export type WorkFunction<TResult> = (signal: AbortSignal, worker: Worker<unknown>) => Promise<TResult> | TResult;
type ThreadInvocation = "work-function" | "decorated-method";

interface ThreadWorkSpec<TResult> {
  readonly __textualThreadWork: true;
  readonly source: string;
  readonly args: readonly unknown[];
  readonly invocation: ThreadInvocation;
  readonly resultType?: TResult;
}

export type WorkerCallable<TResult> = WorkFunction<TResult> | PromiseLike<TResult> | ThreadWorkSpec<TResult>;
export type WorkerDescription = string | Content;

export interface WorkerOwner {
  nodeId: string;
  typeName: string;
}

export interface WorkerOptions {
  name?: string;
  group?: string;
  description?: WorkerDescription;
  start?: boolean;
  exitOnError?: boolean;
  exclusive?: boolean;
  thread?: boolean;
}

export class WorkerError extends Error {}
export class WorkerFailed extends WorkerError {}
export class WorkerCancelled extends WorkerError {}
export class DeadlockError extends WorkerError {}
export class NoActiveWorker extends WorkerError {}
export class WorkerDeclarationError extends WorkerError {}

export class WorkerStateChanged extends Message {
  constructor(
    readonly worker: Worker<unknown>,
    readonly state: WorkerState,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }
}

const currentWorkerStorage = new AsyncLocalStorage<Worker<unknown>>();

export function getCurrentWorker(): Worker<unknown> {
  const worker = currentWorkerStorage.getStore();

  if (worker === undefined) {
    throw new NoActiveWorker("No worker is currently running");
  }

  return worker;
}

export function get_current_worker(): Worker<unknown> {
  // [LAW:one-source-of-truth] getCurrentWorker owns active-worker lookup; the
  // compatibility alias cannot acquire worker context through another path.
  return getCurrentWorker();
}

export class Worker<TResult> {
  readonly controller = new AbortController();
  readonly createdAt = Date.now();
  state: WorkerState = "pending";
  result: TResult | undefined = undefined;
  error: Error | undefined = undefined;
  completedSteps = 0;
  totalSteps: number | null = null;
  private execution: Promise<TResult> | null = null;

  constructor(
    readonly node: WorkerOwner,
    private readonly work: WorkerCallable<TResult>,
    readonly name: string,
    readonly group: string | undefined,
    readonly description: WorkerDescription,
    readonly exitOnError: boolean,
    threadOrPostMessage: boolean | ((targetId: string, message: Message) => void),
    postMessageOrOnSettled: ((targetId: string, message: Message) => void) | ((worker: Worker<TResult>) => void),
    onSettled?: (worker: Worker<TResult>) => void,
  ) {
    if (typeof threadOrPostMessage === "boolean") {
      this.thread = threadOrPostMessage;
      this.postMessage = postMessageOrOnSettled as (targetId: string, message: Message) => void;
      this.onSettled = onSettled ?? (() => undefined);
    } else {
      this.thread = false;
      this.postMessage = threadOrPostMessage;
      this.onSettled = postMessageOrOnSettled as (worker: Worker<TResult>) => void;
    }

    autoObservable(
      this,
      {
        work: false,
        postMessage: false,
        onSettled: false,
        execution: false,
      },
      { autoBind: true },
    );
  }

  readonly thread: boolean;
  private readonly postMessage: (targetId: string, message: Message) => void;
  private readonly onSettled: (worker: Worker<TResult>) => void;

  get isCancelled(): boolean {
    return this.state === "cancelled";
  }

  get is_cancelled(): boolean {
    return this.isCancelled;
  }

  get isRunning(): boolean {
    return this.state === "running";
  }

  get is_running(): boolean {
    return this.isRunning;
  }

  get isFinished(): boolean {
    return this.state === "success" || this.state === "error" || this.state === "cancelled";
  }

  get is_finished(): boolean {
    return this.isFinished;
  }

  get completed_steps(): number {
    return this.completedSteps;
  }

  set completed_steps(value: number) {
    this.completedSteps = value;
  }

  get total_steps(): number | null {
    return this.totalSteps;
  }

  set total_steps(value: number | null) {
    this.totalSteps = value;
  }

  get progress(): number {
    if (this.totalSteps === null || this.totalSteps <= 0) {
      return this.completedSteps > 0 ? 100 : 0;
    }

    return Math.max(0, Math.min(100, (this.completedSteps / this.totalSteps) * 100));
  }

  start(): Promise<TResult> {
    if (this.execution !== null) {
      return this.execution;
    }

    if (this.state === "cancelled") {
      return Promise.reject(this.error ?? new WorkerCancelled("Worker was cancelled"));
    }

    this.transition("running");
    let resolveExecution!: (result: TResult) => void;
    let rejectExecution!: (error: unknown) => void;
    this.execution = new Promise<TResult>((resolve, reject) => {
      resolveExecution = resolve;
      rejectExecution = reject;
    });

    // [LAW:one-source-of-truth] The execution promise is installed before
    // work starts so wait(), double-start, and self-deadlock checks read one
    // canonical lifecycle handle even during the first synchronous frame.
    void currentWorkerStorage.run(this as Worker<unknown>, async () => {
      try {
        const result = await this.executeWork();

        if (this.controller.signal.aborted) {
          throw new WorkerCancelled("Worker was cancelled");
        }

        runInAction(() => {
          this.result = result;
          this.transition("success");
        });
        resolveExecution(result);
        return result;
      } catch (error) {
        const resolvedError =
          error instanceof WorkerCancelled
            ? error
            : error instanceof Error && error.name === "AbortError"
              ? new WorkerCancelled("Worker was cancelled")
              : error instanceof Error
                ? error
                : new Error(String(error));

        runInAction(() => {
          this.error = resolvedError;
          this.transition(resolvedError instanceof WorkerCancelled ? "cancelled" : "error");
        });
        rejectExecution(resolvedError);
      } finally {
        this.onSettled(this);
      }
    });

    return this.execution;
  }

  cancel(): void {
    this.controller.abort();

    if (this.state === "pending") {
      runInAction(() => {
        this.error = new WorkerCancelled("Worker was cancelled");
        this.transition("cancelled");
      });
      this.onSettled(this);
    }
  }

  async wait(): Promise<TResult> {
    if (this.execution === null) {
      throw new WorkerError("Worker has not been started");
    }

    if (currentWorkerStorage.getStore() === this) {
      throw new DeadlockError("Worker cannot wait on itself");
    }

    try {
      return await this.execution;
    } catch (error) {
      if (error instanceof WorkerCancelled) {
        throw error;
      }

      throw new WorkerFailed((error as Error).message, { cause: error as Error });
    }
  }

  update(completedSteps: number | { completedSteps?: number; totalSteps?: number | null }, totalSteps?: number | null): void {
    if (typeof completedSteps === "object") {
      this.completedSteps = Math.max(0, completedSteps.completedSteps ?? this.completedSteps);
      this.totalSteps = completedSteps.totalSteps ?? this.totalSteps;
      return;
    }

    this.completedSteps = Math.max(0, completedSteps);
    this.totalSteps = totalSteps ?? this.totalSteps;
  }

  advance(steps = 1): void {
    this.completedSteps += steps;
  }

  private transition(nextState: WorkerState): void {
    if (this.state === nextState) {
      return;
    }

    this.state = nextState;
    this.postMessage(this.node.nodeId, new WorkerStateChanged(this as Worker<unknown>, nextState));
  }

  private async executeWork(): Promise<TResult> {
    if (this.thread) {
      return await this.executeThreadWork();
    }

    const candidate =
      typeof this.work === "function"
        ? this.work(this.controller.signal, this as Worker<unknown>)
        : this.work;

    if (isPromiseLike(candidate)) {
      return await candidate;
    }

    throw new WorkerDeclarationError("Synchronous worker functions require thread: true");
  }

  private async executeThreadWork(): Promise<TResult> {
    const spec = getThreadWorkSpec(this.work);

    // [LAW:single-enforcer] thread:true execution enters the worker-thread
    // runner before callable invocation, so blocking sync work cannot run on
    // the app thread and async-thread work uses the same boundary.
    return await runThreadWork<TResult>(spec, this.controller.signal, (message) => {
      runInAction(() => {
        if (message.type === "update") {
          this.update(message.completedSteps, message.totalSteps);
        } else {
          this.advance(message.steps);
        }
      });
    });
  }
}

export class WorkerManager implements Iterable<Worker<unknown>> {
  private readonly workers = observable.map<string, Worker<unknown>>();
  private readonly orderedIds = observable.array<string>([]);
  private nextId = 1;

  constructor() {
    autoObservable(
      this,
      {
        workers: false,
        orderedIds: false,
        toString: false,
      },
      { autoBind: true },
    );
  }

  get length(): number {
    return this.orderedIds.length;
  }

  addWorker<TResult>(worker: Worker<TResult>, start = true, exclusive = false): Worker<TResult> {
    if (exclusive && worker.group !== undefined) {
      this.cancelGroup(worker.node.nodeId, worker.group);
    }

    const workerId = `worker-${this.nextId++}`;
    this.workers.set(workerId, worker as Worker<unknown>);
    this.orderedIds.push(workerId);

    if (start) {
      void worker.start();
    }

    return worker;
  }

  get size(): number {
    return this.length;
  }

  cancelAll(): void {
    for (const worker of this) {
      worker.cancel();
    }
  }

  startAll(): void {
    for (const worker of this) {
      if (worker.state === "pending") {
        void worker.start();
      }
    }
  }

  start_all(): void {
    // [LAW:one-source-of-truth] startAll is the canonical JS surface; this
    // snake_case alias delegates so worker startup semantics cannot drift.
    this.startAll();
  }

  cancelGroup(nodeId: string, group: string): void {
    for (const worker of this) {
      if (worker.node.nodeId === nodeId && worker.group === group && !worker.isFinished) {
        worker.cancel();
      }
    }
  }

  cancelNode(nodeId: string): void {
    for (const worker of this) {
      if (worker.node.nodeId === nodeId && !worker.isFinished) {
        worker.cancel();
      }
    }
  }

  async waitForComplete(workers?: Iterable<Worker<unknown>>): Promise<void> {
    const trackedWorkers = Array.from(workers ?? this);

    await Promise.allSettled(
      trackedWorkers.map(async (worker) => {
        try {
          await worker.wait();
        } catch {
          return undefined;
        }
      }),
    );

    for (const worker of trackedWorkers) {
      this.remove(worker);
    }
  }

  async wait_for_complete(workers?: Iterable<Worker<unknown>>): Promise<void> {
    // [LAW:one-source-of-truth] waitForComplete owns draining/removal semantics;
    // the compatibility alias keeps one worker-manager completion boundary.
    return this.waitForComplete(workers);
  }

  remove(worker: Worker<unknown>): void {
    const workerId = this.orderedIds.find((id) => this.workers.get(id) === worker);

    if (workerId === undefined) {
      return;
    }

    this.workers.delete(workerId);
    this.orderedIds.remove(workerId);
  }

  has(worker: Worker<unknown>): boolean {
    return this.orderedIds.some((id) => this.workers.get(id) === worker);
  }

  [Symbol.iterator](): Iterator<Worker<unknown>> {
    return this.orderedIds
      .map((id) => this.workers.get(id))
      .filter((worker): worker is Worker<unknown> => worker !== undefined)[Symbol.iterator]();
  }

  reversed(): IterableIterator<Worker<unknown>> {
    return this.orderedIds
      .slice()
      .reverse()
      .map((id) => this.workers.get(id))
      .filter((worker): worker is Worker<unknown> => worker !== undefined)[Symbol.iterator]();
  }

  toString(): string {
    return `WorkerManager(${this.length} workers)`;
  }
}

export interface WorkDecoratorOptions extends Omit<WorkerOptions, "start"> {}

interface WorkerHost {
  runWorker?: <TResult>(work: WorkerCallable<TResult>, options?: WorkerOptions) => Worker<TResult>;
}

type WorkMethod = (...args: unknown[]) => unknown;

export function work(target: object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<WorkMethod>): void;
export function work(options?: WorkDecoratorOptions): MethodDecorator;
export function work(
  targetOrOptions?: object | WorkDecoratorOptions,
  propertyKey?: string | symbol,
  descriptor?: TypedPropertyDescriptor<WorkMethod>,
): MethodDecorator | void {
  const isDirectDecorator = propertyKey !== undefined && descriptor !== undefined;

  if (isDirectDecorator) {
    installWorkDecorator({}, propertyKey, descriptor);
    return;
  }

  const options = (targetOrOptions ?? {}) as WorkDecoratorOptions;
  return (_target, decoratedPropertyKey, decoratedDescriptor) => {
    installWorkDecorator(options, decoratedPropertyKey, decoratedDescriptor as unknown as TypedPropertyDescriptor<WorkMethod>);
  };
}

function installWorkDecorator(
  options: WorkDecoratorOptions,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<WorkMethod>,
): void {
  const original = descriptor.value;

  if (original === undefined) {
    throw new WorkerDeclarationError("The work decorator can only be applied to methods");
  }

  const thread = options.thread ?? false;
  const isAsyncMethod = original.constructor.name === "AsyncFunction";

  if (!thread && !isAsyncMethod) {
    throw new WorkerDeclarationError("Synchronous work methods require thread: true");
  }

  const methodName = String(propertyKey);

  descriptor.value = function runDecoratedWorker(this: WorkerHost, ...args: unknown[]): Worker<unknown> {
    const runner = this.runWorker;

    if (typeof runner !== "function") {
      throw new WorkerDeclarationError("Decorated work methods require a runWorker-capable host");
    }

    const workerOptions: WorkerOptions = {
      ...options,
      name: options.name ?? methodName,
      group: options.group ?? methodName,
      thread,
    };

    const callable = thread
      ? createThreadWorkSpec(original, args, "decorated-method")
      : () => original.apply(this, args);

    // [LAW:single-enforcer] Decorated workers funnel through runWorker so
    // exclusivity, cancellation, and manager membership use the same boundary.
    return runner.call(this, callable, workerOptions);
  };
}

function createThreadWorkSpec<TResult>(
  callable: (...args: unknown[]) => TResult,
  args: readonly unknown[],
  invocation: ThreadInvocation,
): ThreadWorkSpec<TResult> {
  return {
    __textualThreadWork: true,
    source: normalizeFunctionSource(callable),
    args: [...args],
    invocation,
  };
}

function isThreadWorkSpec<TResult>(value: WorkerCallable<TResult>): value is ThreadWorkSpec<TResult> {
  return typeof value === "object" && value !== null && "__textualThreadWork" in value;
}

function getThreadWorkSpec<TResult>(work: WorkerCallable<TResult>): ThreadWorkSpec<TResult> {
  if (isThreadWorkSpec(work)) {
    return work;
  }

  if (typeof work !== "function") {
    throw new WorkerDeclarationError("Thread workers require a callable function");
  }

  return createThreadWorkSpec<TResult>(work as (...args: unknown[]) => TResult, [], "work-function");
}

function normalizeFunctionSource(callable: Function): string {
  const source = callable.toString();
  const trimmed = source.trim();

  if (trimmed.includes("[native code]")) {
    throw new WorkerDeclarationError("Thread workers cannot execute native functions");
  }

  if (/^(?:async\s+)?function\b/.test(trimmed) || trimmed.includes("=>")) {
    return trimmed;
  }

  if (/^async\s+[\w$]+\s*\(/.test(trimmed)) {
    return `async function ${trimmed.slice("async ".length)}`;
  }

  return `function ${trimmed}`;
}

type ThreadProgressMessage =
  | { type: "update"; completedSteps: number; totalSteps: number | null | undefined }
  | { type: "advance"; steps: number };

type ThreadWorkerMessage<TResult> =
  | { type: "success"; result: TResult }
  | { type: "error"; name: string; message: string; stack?: string }
  | ThreadProgressMessage;

const THREAD_WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");

const controller = new AbortController();

parentPort.on("message", (message) => {
  if (message && message.type === "abort") {
    controller.abort();
  }
});

const post = (message) => {
  parentPort.postMessage(message);
};

const workerProxy = {
  controller,
  get isCancelled() {
    return controller.signal.aborted;
  },
  get is_cancelled() {
    return controller.signal.aborted;
  },
  get isRunning() {
    return !controller.signal.aborted;
  },
  get is_running() {
    return !controller.signal.aborted;
  },
  get isFinished() {
    return false;
  },
  get is_finished() {
    return false;
  },
  completedSteps: 0,
  completed_steps: 0,
  totalSteps: null,
  total_steps: null,
  update(completedSteps, totalSteps) {
    if (typeof completedSteps === "object" && completedSteps !== null) {
      this.completedSteps = Math.max(0, completedSteps.completedSteps ?? this.completedSteps);
      this.completed_steps = this.completedSteps;
      this.totalSteps = completedSteps.totalSteps ?? this.totalSteps;
      this.total_steps = this.totalSteps;
      post({ type: "update", completedSteps: this.completedSteps, totalSteps: this.totalSteps });
      return;
    }

    this.completedSteps = Math.max(0, completedSteps);
    this.completed_steps = this.completedSteps;
    this.totalSteps = totalSteps ?? this.totalSteps;
    this.total_steps = this.totalSteps;
    post({ type: "update", completedSteps: this.completedSteps, totalSteps: this.totalSteps });
  },
  advance(steps = 1) {
    this.completedSteps += steps;
    this.completed_steps = this.completedSteps;
    post({ type: "advance", steps });
  },
};

(async () => {
  try {
    const callable = eval("(" + workerData.source + ")");
    const result = workerData.invocation === "decorated-method"
      ? callable(...workerData.args)
      : callable(controller.signal, workerProxy);
    const awaited = result && typeof result.then === "function" ? await result : result;

    if (controller.signal.aborted) {
      const error = new Error("Worker was cancelled");
      error.name = "AbortError";
      throw error;
    }

    post({ type: "success", result: awaited });
  } catch (error) {
    post({
      type: "error",
      name: error && error.name ? error.name : "Error",
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : undefined,
    });
  }
})();
`;

function runThreadWork<TResult>(
  spec: ThreadWorkSpec<TResult>,
  signal: AbortSignal,
  onProgress: (message: ThreadProgressMessage) => void,
): Promise<TResult> {
  return new Promise<TResult>((resolve, reject) => {
    const worker = new NodeWorker(THREAD_WORKER_SOURCE, {
      eval: true,
      workerData: {
        source: spec.source,
        args: spec.args,
        invocation: spec.invocation,
      },
    });
    let settled = false;

    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      signal.removeEventListener("abort", abortThread);
      void worker.terminate();
      callback();
    };

    const abortThread = (): void => {
      worker.postMessage({ type: "abort" });
      settle(() => {
        reject(new WorkerCancelled("Worker was cancelled"));
      });
    };

    signal.addEventListener("abort", abortThread, { once: true });

    worker.on("message", (message: ThreadWorkerMessage<TResult>) => {
      if (message.type === "update" || message.type === "advance") {
        onProgress(message);
        return;
      }

      if (message.type === "success") {
        settle(() => {
          resolve(message.result);
        });
        return;
      }

      const error = message.name === "AbortError" || message.name === "WorkerCancelled"
        ? new WorkerCancelled("Worker was cancelled")
        : new Error(message.message);
      error.name = message.name;
      error.stack = message.stack ?? error.stack;
      settle(() => {
        reject(error);
      });
    });

    worker.on("error", (error) => {
      settle(() => {
        reject(error);
      });
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        settle(() => {
          reject(new Error(`Worker thread exited with code ${code}`));
        });
      }
    });

    if (signal.aborted) {
      abortThread();
    }
  });
}

function isPromiseLike<TResult>(value: unknown): value is PromiseLike<TResult> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}
