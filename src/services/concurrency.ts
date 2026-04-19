import { AsyncLocalStorage } from "node:async_hooks";

interface Waiter {
  token: symbol;
  resolve: () => void;
}

const lockOwnerStorage = new AsyncLocalStorage<symbol>();
const activeMessagePumpStorage = new AsyncLocalStorage<unknown>();

function currentTaskToken(): symbol {
  const token = lockOwnerStorage.getStore() ?? Symbol("rlock-task");
  lockOwnerStorage.enterWith(token);
  return token;
}

export class RLock {
  private owner: symbol | null = null;
  private depth = 0;
  private readonly waiters: Waiter[] = [];

  get isLocked(): boolean {
    return this.owner !== null;
  }

  async acquire(): Promise<void> {
    const token = currentTaskToken();

    if (this.owner === null || this.owner === token) {
      this.owner = token;
      this.depth += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.waiters.push({ token, resolve });
    });
  }

  async withLock<TResult>(callback: () => Promise<TResult> | TResult): Promise<TResult> {
    const token = lockOwnerStorage.getStore() ?? Symbol("rlock-task");

    return lockOwnerStorage.run(token, async () => {
      await this.acquire();

      try {
        return await callback();
      } finally {
        this.release();
      }
    });
  }

  async run<TResult>(callback: () => Promise<TResult> | TResult): Promise<TResult> {
    // [LAW:one-source-of-truth] withLock is the canonical scoped-acquire path;
    // run exists as a short alias without owning separate release behavior.
    return this.withLock(callback);
  }

  release(): void {
    if (this.owner === null || this.depth === 0) {
      throw new RuntimeError("RLock released too many times");
    }

    this.depth -= 1;

    if (this.depth > 0) {
      return;
    }

    this.owner = null;
    const nextWaiter = this.waiters.shift();

    if (nextWaiter !== undefined) {
      this.owner = nextWaiter.token;
      this.depth = 1;
      nextWaiter.resolve();
    }
  }
}

export function getActiveMessagePump<TMessagePump = unknown>(): TMessagePump {
  const pump = activeMessagePumpStorage.getStore();

  if (pump === undefined) {
    throw new RuntimeError("No active message pump");
  }

  return pump as TMessagePump;
}

export function runWithActiveMessagePump<TResult>(messagePump: unknown, callback: () => TResult): TResult {
  // [LAW:single-enforcer] Scheduler context is installed at the app scheduler
  // boundary; callbacks read this one AsyncLocalStorage source.
  return activeMessagePumpStorage.run(messagePump, callback);
}

export class RuntimeError extends Error {}
