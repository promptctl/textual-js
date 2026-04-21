import { makeAutoObservable, observable } from "mobx";

import type { Message } from "../events/message.js";
import type { WidgetNode } from "./widget-node.js";

export type WidgetMessageHandler<TMessage extends Message = Message> = (message: TMessage) => unknown | Promise<unknown>;

export type WidgetHandlers = Record<string, WidgetMessageHandler | undefined>;

export type WidgetActionCallback = (...args: unknown[]) => unknown;

export type WidgetCheckAction = (actionName: string, params: unknown[]) => boolean | null;

export interface WidgetActions {
  [name: string]: WidgetActionCallback | WidgetCheckAction | undefined;
  checkAction?: WidgetCheckAction;
}

export interface WidgetIdentity {
  id?: string;
  classes: string[];
  typeName: string;
}

export class WidgetRegistry {
  private readonly entries = observable.map<string, WidgetNode>();
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

  // [LAW:one-source-of-truth] WidgetNode is the canonical identity object for a
  // mounted widget. The registry only indexes those nodes; it doesn't mirror them.
  register(widget: WidgetNode): void {
    if (widget.id !== undefined) {
      const existingNodeId = this.cssIds.get(widget.id);

      // [LAW:single-enforcer] Duplicate CSS ids are rejected only here so every
      // registration path shares one invariant boundary.
      if (existingNodeId !== undefined && existingNodeId !== widget.nodeId) {
        throw new DuplicateIds(`Duplicate widget id "${widget.id}"`);
      }

      this.cssIds.set(widget.id, widget.nodeId);
    }

    if (!this.entries.has(widget.nodeId)) {
      this.order.push(widget.nodeId);
    }

    this.entries.set(widget.nodeId, widget);
    this.version += 1;
  }

  deregister(nodeId: string): void {
    const widget = this.entries.get(nodeId);

    if (widget?.id !== undefined) {
      this.cssIds.delete(widget.id);
    }

    this.entries.delete(nodeId);

    const index = this.order.indexOf(nodeId);

    if (index >= 0) {
      this.order.splice(index, 1);
    }

    this.version += 1;
  }

  touch(): void {
    this.version += 1;
  }

  get(nodeId: string): WidgetNode | undefined {
    return this.entries.get(nodeId);
  }

  getByCssId(cssId: string): WidgetNode | undefined {
    const nodeId = this.cssIds.get(cssId);
    return nodeId === undefined ? undefined : this.entries.get(nodeId);
  }

  list(): WidgetNode[] {
    return this.order
      .map((nodeId) => this.entries.get(nodeId))
      .filter((widget): widget is WidgetNode => widget !== undefined);
  }

  getChildren(parentId: string | null): WidgetNode[] {
    return this.list().filter((widget) => widget.parentId === parentId);
  }

  getDescendants(nodeId: string): WidgetNode[] {
    const descendants: WidgetNode[] = [];
    const visit = (parentId: string): void => {
      for (const child of this.getChildren(parentId)) {
        descendants.push(child);
        visit(child.nodeId);
      }
    };

    // [LAW:one-source-of-truth] Query order is derived directly from registry
    // parent links in DOM/depth order; no separate query tree is maintained.
    visit(nodeId);

    return descendants;
  }

  getPreviousSibling(nodeId: string): WidgetNode | undefined {
    const widget = this.entries.get(nodeId);

    if (widget === undefined) {
      return undefined;
    }

    const siblings = this.getChildren(widget.parentId);
    const index = siblings.findIndex((sibling) => sibling.nodeId === nodeId);

    return index <= 0 ? undefined : siblings[index - 1];
  }

  getPreviousSiblings(nodeId: string): WidgetNode[] {
    const widget = this.entries.get(nodeId);

    if (widget === undefined) {
      return [];
    }

    const siblings = this.getChildren(widget.parentId);
    const index = siblings.findIndex((sibling) => sibling.nodeId === nodeId);

    return index <= 0 ? [] : siblings.slice(0, index).reverse();
  }

  getSiblingIndex(nodeId: string): number {
    const widget = this.entries.get(nodeId);
    const siblings = widget === undefined ? [] : this.getChildren(widget.parentId);

    return siblings.findIndex((sibling) => sibling.nodeId === nodeId);
  }

  getNextSiblings(nodeId: string): WidgetNode[] {
    const widget = this.entries.get(nodeId);

    if (widget === undefined) {
      return [];
    }

    const siblings = this.getChildren(widget.parentId);
    const index = siblings.findIndex((sibling) => sibling.nodeId === nodeId);

    return index === -1 ? [] : siblings.slice(index + 1);
  }

  hasChildren(nodeId: string): boolean {
    return this.getChildren(nodeId).length > 0;
  }

  getDefaultTarget(preferredNodeId: string | null): WidgetNode | undefined {
    const preferredEntry = preferredNodeId === null ? undefined : this.entries.get(preferredNodeId);

    if (preferredEntry !== undefined) {
      return preferredEntry;
    }

    return this.list().find((entry) => entry.focusable) ?? this.list()[0];
  }
}

export class DuplicateIds extends Error {}
