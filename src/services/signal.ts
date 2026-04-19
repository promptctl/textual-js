import { makeAutoObservable, observable, runInAction } from "mobx";

import type { WidgetNode } from "../framework/widget-node.js";

export class SignalError extends Error {}

export type SignalCallback<TValue> = (value: TValue) => void;

interface SignalSubscriber<TValue> {
  node: WidgetNode;
  callbacks: Array<{
    callback: SignalCallback<TValue>;
    immediate: boolean;
  }>;
}

export class Signal<TValue> {
  private readonly subscribers = observable.map<string, SignalSubscriber<TValue>>();

  constructor(
    private readonly isOwnerMounted: () => boolean,
    private readonly isNodeMounted: (node: WidgetNode) => boolean,
    private readonly scheduleCallback: (callback: () => void) => void,
  ) {
    makeAutoObservable(
      this,
      {
        subscribers: false,
        toString: false,
      } as never,
      { autoBind: true },
    );
  }

  subscribe(node: WidgetNode, callback: SignalCallback<TValue>, immediate = false): () => void {
    if (!this.isNodeMounted(node)) {
      throw new SignalError(`Cannot subscribe unmounted widget "${node.nodeId}"`);
    }

    const existing = this.subscribers.get(node.nodeId) ?? { node, callbacks: [] };
    runInAction(() => {
      existing.callbacks.push({ callback, immediate });
      this.subscribers.set(node.nodeId, existing);
    });

    return () => {
      const current = this.subscribers.get(node.nodeId);

      if (current === undefined) {
        return;
      }

      runInAction(() => {
        current.callbacks = current.callbacks.filter((entry) => entry.callback !== callback);

        if (current.callbacks.length === 0) {
          this.subscribers.delete(node.nodeId);
        } else {
          this.subscribers.set(node.nodeId, current);
        }
      });
    };
  }

  unsubscribe(node: WidgetNode): void {
    this.subscribers.delete(node.nodeId);
  }

  pruneNode(nodeId: string): void {
    this.subscribers.delete(nodeId);
  }

  publish(value: TValue): void {
    if (!this.isOwnerMounted()) {
      return;
    }

    for (const [nodeId, subscriber] of this.subscribers.entries()) {
      if (!this.isNodeMounted(subscriber.node)) {
        this.subscribers.delete(nodeId);
        continue;
      }

      for (const entry of subscriber.callbacks) {
        const invoke = (): void => {
          try {
            if (this.isNodeMounted(subscriber.node)) {
              entry.callback(value);
            }
          } catch (error) {
            console.error(error);
          }
        };

        if (entry.immediate) {
          invoke();
        } else {
          this.scheduleCallback(invoke);
        }
      }
    }
  }

  toString(): string {
    return `Signal(subscribers=${this.subscribers.size})`;
  }
}
