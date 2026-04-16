import { AsyncLocalStorage } from "node:async_hooks";

interface Waiter {
  token: symbol;
  resolve: () => void;
}

const lockOwnerStorage = new AsyncLocalStorage<symbol>();

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

class RuntimeError extends Error {}
