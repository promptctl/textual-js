import { makeAutoObservable, observable } from "mobx";

import type { Message } from "../events/message.js";
import type { Widget } from "./widget.js";

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

export class NodeList implements Iterable<Widget> {
  private readonly items = observable.array<Widget>([]);

  constructor() {
    makeAutoObservable(
      this,
      {
        items: false,
      } as never,
      { autoBind: true },
    );
  }

  [Symbol.iterator](): Iterator<Widget> {
    return this.items[Symbol.iterator]();
  }

  get length(): number {
    return this.items.length;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  at(index: number): Widget | undefined {
    return this.items[index];
  }

  slice(start?: number, end?: number): Widget[] {
    return this.items.slice(start, end);
  }

  index(widget: Widget): number {
    const index = this.items.indexOf(widget);

    if (index === -1) {
      throw new Error("Node is not present in NodeList");
    }

    return index;
  }

  has(widget: Widget): boolean {
    return this.items.includes(widget);
  }

  toArray(): Widget[] {
    return [...this.items];
  }

  __length_hint__(): number {
    return this.items.length;
  }

  _append(widget: Widget): void {
    if (!this.items.includes(widget)) {
      this.items.push(widget);
    }
  }

  _insert(index: number, widget: Widget): void {
    const existingIndex = this.items.indexOf(widget);

    if (existingIndex !== -1) {
      this.items.splice(existingIndex, 1);
    }

    this.items.splice(Math.max(0, index), 0, widget);
  }

  _remove(widget: Widget): void {
    const index = this.items.indexOf(widget);

    if (index !== -1) {
      this.items.splice(index, 1);
    }
  }

  _clear(): void {
    this.items.clear();
  }
}

export class WidgetRegistry {
  private readonly entries = observable.map<string, Widget>();
  private readonly cssIds = observable.map<string, string>();
  private readonly order = observable.array<string>([]);
  private readonly childrenByParent = observable.map<string, NodeList>();
  private readonly rootChildren = new NodeList();
  version = 0;

  constructor() {
    makeAutoObservable(
      this,
      {
        entries: false,
        cssIds: false,
        order: false,
        childrenByParent: false,
        rootChildren: false,
      } as never,
      { autoBind: true },
    );
  }

  private childList(parentId: string | null): NodeList {
    if (parentId === null) {
      return this.rootChildren;
    }

    const existing = this.childrenByParent.get(parentId);

    if (existing !== undefined) {
      return existing;
    }

    const created = new NodeList();
    this.childrenByParent.set(parentId, created);
    return created;
  }

  // [LAW:one-source-of-truth] Widget is the canonical identity object for a
  // mounted widget. The registry only indexes those nodes; it doesn't mirror them.
  register(widget: Widget): void {
    const previous = this.entries.get(widget.nodeId);

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

    if (previous !== undefined && previous.parentId !== widget.parentId) {
      this.childList(previous.parentId)._remove(previous);
    }

    this.entries.set(widget.nodeId, widget);
    this.childList(widget.parentId)._append(widget);
    this.version += 1;
  }

  deregister(nodeId: string): void {
    const widget = this.entries.get(nodeId);

    if (widget?.id !== undefined) {
      this.cssIds.delete(widget.id);
    }

    this.entries.delete(nodeId);
    if (widget !== undefined) {
      this.childList(widget.parentId)._remove(widget);
    }

    const index = this.order.indexOf(nodeId);

    if (index >= 0) {
      this.order.splice(index, 1);
    }

    this.version += 1;
  }

  touch(): void {
    this.version += 1;
  }

  get(nodeId: string): Widget | undefined {
    return this.entries.get(nodeId);
  }

  getByCssId(cssId: string): Widget | undefined {
    const nodeId = this.cssIds.get(cssId);
    return nodeId === undefined ? undefined : this.entries.get(nodeId);
  }

  list(): Widget[] {
    return this.order
      .map((nodeId) => this.entries.get(nodeId))
      .filter((widget): widget is Widget => widget !== undefined);
  }

  getChildNodeList(parentId: string | null): NodeList {
    return this.childList(parentId);
  }

  getChildren(parentId: string | null): Widget[] {
    return this.childList(parentId).toArray();
  }

  getDescendants(nodeId: string): Widget[] {
    const descendants: Widget[] = [];
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

  getPreviousSibling(nodeId: string): Widget | undefined {
    const widget = this.entries.get(nodeId);

    if (widget === undefined) {
      return undefined;
    }

    const siblings = this.getChildren(widget.parentId);
    const index = siblings.findIndex((sibling) => sibling.nodeId === nodeId);

    return index <= 0 ? undefined : siblings[index - 1];
  }

  getPreviousSiblings(nodeId: string): Widget[] {
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

  getNextSiblings(nodeId: string): Widget[] {
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

  getDefaultTarget(preferredNodeId: string | null): Widget | undefined {
    const preferredEntry = preferredNodeId === null ? undefined : this.entries.get(preferredNodeId);

    if (preferredEntry !== undefined) {
      return preferredEntry;
    }

    return this.list().find((entry) => entry.focusable) ?? this.list()[0];
  }
}

export class DuplicateIds extends Error {}
