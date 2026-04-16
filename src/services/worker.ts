import { AsyncLocalStorage } from "node:async_hooks";

import { makeAutoObservable, observable, runInAction } from "mobx";

import { Message, type MessageInit } from "../events/message.js";
import type { WidgetNode } from "../framework/widget-node.js";

export type WorkerState = "pending" | "running" | "success" | "error" | "cancelled";
export type WorkFunction<TResult> = (signal: AbortSignal, worker: Worker<unknown>) => Promise<TResult> | TResult;

export interface WorkerOptions {
  name?: string;
  group?: string;
  description?: string;
  start?: boolean;
  exitOnError?: boolean;
  exclusive?: boolean;
}

export class WorkerError extends Error {}
export class WorkerFailed extends WorkerError {}
export class WorkerCancelled extends WorkerError {}
export class DeadlockError extends WorkerError {}
export class NoActiveWorker extends WorkerError {}

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
    readonly node: WidgetNode,
    private readonly work: WorkFunction<TResult>,
    readonly name: string,
    readonly group: string | undefined,
    readonly description: string,
    readonly exitOnError: boolean,
    private readonly postMessage: (targetId: string, message: Message) => void,
    private readonly onSettled: (worker: Worker<TResult>) => void,
  ) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

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

    this.transition("running");
    this.execution = currentWorkerStorage.run(this as Worker<unknown>, async () => {
      try {
        const result = await this.work(this.controller.signal, this as Worker<unknown>);

        if (this.controller.signal.aborted) {
          throw new WorkerCancelled("Worker was cancelled");
        }

        runInAction(() => {
          this.result = result;
          this.transition("success");
        });
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
        throw resolvedError;
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

  update(completedSteps: number, totalSteps?: number | null): void {
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

  cancelAll(): void {
    for (const worker of this) {
      worker.cancel();
    }
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

  remove(worker: Worker<unknown>): void {
    const workerId = this.orderedIds.find((id) => this.workers.get(id) === worker);

    if (workerId === undefined) {
      return;
    }

    this.workers.delete(workerId);
    this.orderedIds.remove(workerId);
  }

  [Symbol.iterator](): Iterator<Worker<unknown>> {
    return this.orderedIds
      .map((id) => this.workers.get(id))
      .filter((worker): worker is Worker<unknown> => worker !== undefined)[Symbol.iterator]();
  }
}
