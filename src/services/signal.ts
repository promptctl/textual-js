import { makeAutoObservable, observable, runInAction } from "mobx";

import type { Widget } from "../framework/widget.js";

export class SignalError extends Error {}

export type SignalCallback<TValue> = (value: TValue) => void;

interface SignalSubscriber<TValue> {
  nodeId: string;
  nodeRef: WeakRef<Widget>;
  callbacks: Array<{
    id: number;
    callback: SignalCallback<TValue>;
    immediate: boolean;
  }>;
}

export class Signal<TValue> {
  private readonly subscribers = observable.map<string, SignalSubscriber<TValue>>();
  private nextSubscriptionId = 1;
  readonly description: string;

  constructor(owner: Widget, description: string);

  constructor(
    isOwnerMounted: () => boolean,
    isNodeMounted: (node: Widget) => boolean,
    scheduleCallback: (callback: () => void) => void,
    description?: string,
  );

  constructor(
    ownerOrIsOwnerMounted: Widget | (() => boolean),
    isNodeMountedOrDescription: ((node: Widget) => boolean) | string,
    scheduleCallback?: (callback: () => void) => void,
    description = "",
  ) {
    const owner = ownerOrIsOwnerMounted instanceof Object && "framework" in ownerOrIsOwnerMounted
      ? ownerOrIsOwnerMounted as Widget
      : null;

    this.isOwnerMounted = owner === null
      ? ownerOrIsOwnerMounted as () => boolean
      : () => owner.framework.isNodeMounted(owner);
    this.isNodeMounted = owner === null
      ? isNodeMountedOrDescription as (node: Widget) => boolean
      : (node: Widget) => owner.framework.isNodeMounted(node);
    this.scheduleCallback = owner === null
      ? scheduleCallback ?? ((callback) => callback())
      : (callback) => owner.framework.callLater(callback);
    this.description = owner === null ? description : isNodeMountedOrDescription as string;

    makeAutoObservable(
      this,
      {
        subscribers: false,
        isOwnerMounted: false,
        isNodeMounted: false,
        scheduleCallback: false,
        toString: false,
      } as never,
      { autoBind: true },
    );
  }

  private readonly isOwnerMounted: () => boolean;
  private readonly isNodeMounted: (node: Widget) => boolean;
  private readonly scheduleCallback: (callback: () => void) => void;

  subscribe(node: Widget, callback: SignalCallback<TValue>, immediate = false): () => void {
    if (!this.isNodeMounted(node)) {
      throw new SignalError(`Cannot subscribe unmounted widget "${node.nodeId}"`);
    }

    const existing = this.subscribers.get(node.nodeId) ?? {
      nodeId: node.nodeId,
      nodeRef: new WeakRef(node),
      callbacks: [],
    };
    const subscriptionId = this.nextSubscriptionId++;

    runInAction(() => {
      existing.callbacks.push({ id: subscriptionId, callback, immediate });
      this.subscribers.set(node.nodeId, existing);
    });

    return () => {
      const current = this.subscribers.get(node.nodeId);

      if (current === undefined) {
        return;
      }

      runInAction(() => {
        // [LAW:one-source-of-truth] The returned cleanup handle owns exactly
        // one subscription id; callback identity is not a second cleanup key.
        current.callbacks = current.callbacks.filter((entry) => entry.id !== subscriptionId);

        if (current.callbacks.length === 0) {
          this.subscribers.delete(node.nodeId);
        } else {
          this.subscribers.set(node.nodeId, current);
        }
      });
    };
  }

  unsubscribe(node: Widget): void {
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
      const node = subscriber.nodeRef.deref();

      if (node === undefined || !this.isNodeMounted(node)) {
        this.subscribers.delete(nodeId);
        continue;
      }

      for (const entry of subscriber.callbacks) {
        const invoke = (): void => {
          try {
            const currentNode = subscriber.nodeRef.deref();

            if (currentNode !== undefined && this.isNodeMounted(currentNode)) {
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
    return `Signal(${this.description}, subscribers=${this.subscribers.size})`;
  }
}
