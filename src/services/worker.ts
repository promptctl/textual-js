import { AsyncLocalStorage } from "node:async_hooks";

import { makeAutoObservable, observable, runInAction } from "mobx";

import { Message, type MessageInit } from "../events/message.js";

export type WorkerState = "pending" | "running" | "success" | "error" | "cancelled";
export type WorkFunction<TResult> = (signal: AbortSignal, worker: Worker<unknown>) => Promise<TResult> | TResult;
export type WorkerCallable<TResult> = WorkFunction<TResult> | PromiseLike<TResult>;

export interface WorkerOwner {
  nodeId: string;
  typeName: string;
}

export interface WorkerOptions {
  name?: string;
  group?: string;
  description?: string;
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
    readonly description: string,
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

    makeAutoObservable(this, {}, { autoBind: true });
  }

  readonly thread: boolean;
  private readonly postMessage: (targetId: string, message: Message) => void;
  private readonly onSettled: (worker: Worker<TResult>) => void;

  get isCancelled(): boolean {
    return this.state === "cancelled";
  }

  get isRunning(): boolean {
    return this.state === "running";
  }

  get isFinished(): boolean {
    return this.state === "success" || this.state === "error" || this.state === "cancelled";
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
    const candidate =
      typeof this.work === "function"
        ? this.work(this.controller.signal, this as Worker<unknown>)
        : this.work;

    if (isPromiseLike(candidate)) {
      return await candidate;
    }

    if (!this.thread) {
      throw new WorkerDeclarationError("Synchronous worker functions require thread: true");
    }

    return candidate;
  }
}

export class WorkerManager implements Iterable<Worker<unknown>> {
  private readonly workers = observable.map<string, Worker<unknown>>();
  private readonly orderedIds = observable.array<string>([]);
  private nextId = 1;

  constructor() {
    makeAutoObservable(
      this,
      {
        workers: false,
        orderedIds: false,
        toString: false,
      } as never,
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
  run_worker?: <TResult>(work: WorkerCallable<TResult>, options?: WorkerOptions) => Worker<TResult>;
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
    const runner = this.runWorker ?? this.run_worker;

    if (typeof runner !== "function") {
      throw new WorkerDeclarationError("Decorated work methods require a runWorker-capable host");
    }

    const workerOptions: WorkerOptions = {
      ...options,
      name: options.name ?? methodName,
      group: options.group ?? methodName,
      thread,
    };

    // [LAW:single-enforcer] Decorated workers funnel through runWorker so
    // exclusivity, cancellation, and manager membership use the same boundary.
    return runner.call(this, () => original.apply(this, args), workerOptions);
  };
}

function isPromiseLike<TResult>(value: unknown): value is PromiseLike<TResult> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}
