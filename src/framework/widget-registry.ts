import { makeAutoObservable, observable } from "mobx";

import type { Message } from "../events/message.js";

export type WidgetMessageHandler<TMessage extends Message = Message> = (message: TMessage) => void | Promise<void>;

export type WidgetHandlers = Record<string, WidgetMessageHandler | undefined>;

export interface WidgetIdentity {
  id?: string;
  classes: string[];
  typeName: string;
}

export interface WidgetRegistration extends WidgetIdentity {
  nodeId: string;
  parentId: string | null;
  handlersRef: { current: WidgetHandlers | undefined };
  focusable: boolean;
  autoFocus: boolean;
}

export class WidgetRegistry {
  private readonly entries = observable.map<string, WidgetRegistration>();
  private readonly cssIds = observable.map<string, string>();
  private readonly order = observable.array<string>([]);
  version = 0;

  constructor() {
    makeAutoObservable(
      this,
      {
        entries: false,
        cssIds: false,
        order: false,
      } as never,
      { autoBind: true },
    );
  }

  // [LAW:one-source-of-truth] React owns the tree structure; the registry is the
  // canonical index for "what widgets exist" and where message bubbling can go.
  register(entry: WidgetRegistration): void {
    if (entry.id !== undefined) {
      const existingNodeId = this.cssIds.get(entry.id);

      // [LAW:single-enforcer] Duplicate CSS ids are rejected only here so all
      // widget registration paths share one invariant boundary.
      if (existingNodeId !== undefined && existingNodeId !== entry.nodeId) {
        throw new Error(`Duplicate widget id "${entry.id}"`);
      }

      this.cssIds.set(entry.id, entry.nodeId);
    }

    if (!this.entries.has(entry.nodeId)) {
      this.order.push(entry.nodeId);
    }

    this.entries.set(entry.nodeId, entry);
    this.version += 1;
  }

  deregister(nodeId: string): void {
    const entry = this.entries.get(nodeId);

    if (entry?.id !== undefined) {
      this.cssIds.delete(entry.id);
    }

    this.entries.delete(nodeId);

    const index = this.order.indexOf(nodeId);

    if (index >= 0) {
      this.order.splice(index, 1);
    }

    this.version += 1;
  }

  get(nodeId: string): WidgetRegistration | undefined {
    return this.entries.get(nodeId);
  }

  getByCssId(cssId: string): WidgetRegistration | undefined {
    const nodeId = this.cssIds.get(cssId);
    return nodeId === undefined ? undefined : this.entries.get(nodeId);
  }

  list(): WidgetRegistration[] {
    return this.order
      .map((nodeId) => this.entries.get(nodeId))
      .filter((entry): entry is WidgetRegistration => entry !== undefined);
  }

  getDefaultTarget(preferredNodeId: string | null): WidgetRegistration | undefined {
    const preferredEntry = preferredNodeId === null ? undefined : this.entries.get(preferredNodeId);

    if (preferredEntry !== undefined) {
      return preferredEntry;
    }

    return this.list().find((entry) => entry.focusable) ?? this.list()[0];
  }
}
