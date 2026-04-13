/**
 * NodeList — ordered child container for DOMNode with update tracking.
 *
 * // [LAW:one-source-of-truth] _updates is the sole version counter for
 * // child-tree mutation. Query caches and derived views key off this.
 */

import type { DOMNode } from "./dom-node.js";

export class NodeList {
  private _nodes: DOMNode[] = [];
  private _ids: Map<string, DOMNode> = new Map();
  private _set: Set<DOMNode> = new Set();
  private _updates = 0;

  get updates(): number {
    return this._updates;
  }

  get length(): number {
    return this._nodes.length;
  }

  [Symbol.iterator](): IterableIterator<DOMNode> {
    return this._nodes[Symbol.iterator]();
  }

  at(index: number): DOMNode | undefined {
    return this._nodes[index];
  }

  has(node: DOMNode): boolean {
    return this._set.has(node);
  }

  getById(id: string): DOMNode | undefined {
    return this._ids.get(id);
  }

  toArray(): ReadonlyArray<DOMNode> {
    return this._nodes;
  }

  /** @internal */
  _append(node: DOMNode): void {
    if (this._set.has(node)) return;
    if (node.id !== undefined && this._ids.has(node.id)) {
      throw new Error(`Duplicate id: "${node.id}"`);
    }
    this._nodes.push(node);
    this._set.add(node);
    if (node.id !== undefined) {
      this._ids.set(node.id, node);
    }
    this._updated(node);
  }

  /** @internal */
  _insert(index: number, node: DOMNode): void {
    if (this._set.has(node)) return;
    if (node.id !== undefined && this._ids.has(node.id)) {
      throw new Error(`Duplicate id: "${node.id}"`);
    }
    this._nodes.splice(index, 0, node);
    this._set.add(node);
    if (node.id !== undefined) {
      this._ids.set(node.id, node);
    }
    this._updated(node);
  }

  /** @internal */
  _remove(node: DOMNode): void {
    if (!this._set.has(node)) return;
    const idx = this._nodes.indexOf(node);
    if (idx !== -1) {
      this._nodes.splice(idx, 1);
    }
    this._set.delete(node);
    if (node.id !== undefined) {
      this._ids.delete(node.id);
    }
    this._updated(node);
  }

  /** @internal */
  _clear(): void {
    this._nodes.length = 0;
    this._set.clear();
    this._ids.clear();
    this._updates++;
  }

  private _updated(node: DOMNode): void {
    this._updates++;
    // Walk up the tree to bump ancestor update counters
    let current = node.parent;
    while (current !== null) {
      current.children._updates++;
      current = current.parent;
    }
  }
}
