/**
 * DOMNode — structural primitive for the widget tree.
 *
 * Provides parent/child linkage, CSS identity (id, classes, type name),
 * and the refresh/onRefresh seam for renderer integration.
 *
 * // [LAW:one-way-deps] DOMNode depends on MessagePump, NodeList, geometry.
 * // Widget depends on DOMNode. No back-edges.
 */

import { MessagePump } from "./events/message-pump.js";
import { NodeList } from "./node-list.js";

/** Subscription callback for refresh signals. */
type RefreshCallback = () => void;

export abstract class DOMNode extends MessagePump {
  private _id: string | undefined;
  private _cssClasses: Set<string> = new Set();
  private _children: NodeList = new NodeList();
  private _parentNode: DOMNode | null = null;
  private _refreshSubscribers: RefreshCallback[] = [];

  constructor(options?: { id?: string; classes?: string }) {
    super();
    if (options?.id !== undefined) {
      this._id = options.id;
    }
    if (options?.classes) {
      for (const cls of options.classes.split(/\s+/)) {
        if (cls) this._cssClasses.add(cls);
      }
    }
  }

  // --- Identity ---

  get id(): string | undefined {
    return this._id;
  }

  get cssClasses(): ReadonlySet<string> {
    return this._cssClasses;
  }

  /**
   * CSS type name for selector matching. Defaults to constructor name.
   * Widget subclasses use this for type selectors (e.g., `Button`, `Input`).
   */
  get cssTypeName(): string {
    return this.constructor.name;
  }

  /**
   * The full CSS path from root to this node, used for selector matching.
   */
  get cssPath(): DOMNode[] {
    const path: DOMNode[] = [];
    let current: DOMNode | null = this;
    while (current !== null) {
      path.unshift(current);
      current = current._parentNode;
    }
    return path;
  }

  // --- Tree ---

  get parent(): DOMNode | null {
    return this._parentNode;
  }

  get children(): NodeList {
    return this._children;
  }

  /**
   * Walk ancestors from parent to root.
   */
  *ancestors(): Iterable<DOMNode> {
    let current = this._parentNode;
    while (current !== null) {
      yield current;
      current = current._parentNode;
    }
  }

  /**
   * Walk the subtree depth-first.
   */
  *walkDepthFirst(): Iterable<DOMNode> {
    for (const child of this._children) {
      yield child;
      yield* child.walkDepthFirst();
    }
  }

  /**
   * Walk the subtree breadth-first.
   */
  *walkBreadthFirst(): Iterable<DOMNode> {
    const queue: DOMNode[] = [...this._children];
    while (queue.length > 0) {
      const node = queue.shift()!;
      yield node;
      for (const child of node._children) {
        queue.push(child);
      }
    }
  }

  // --- Class mutation ---

  addClass(...classNames: string[]): void {
    let changed = false;
    for (const cls of classNames) {
      if (!this._cssClasses.has(cls)) {
        this._cssClasses.add(cls);
        changed = true;
      }
    }
    if (changed) this.refresh({ repaint: true });
  }

  removeClass(...classNames: string[]): void {
    let changed = false;
    for (const cls of classNames) {
      if (this._cssClasses.delete(cls)) {
        changed = true;
      }
    }
    if (changed) this.refresh({ repaint: true });
  }

  toggleClass(className: string, force?: boolean): void {
    const has = this._cssClasses.has(className);
    const shouldHave = force ?? !has;
    if (shouldHave && !has) {
      this._cssClasses.add(className);
      this.refresh({ repaint: true });
    } else if (!shouldHave && has) {
      this._cssClasses.delete(className);
      this.refresh({ repaint: true });
    }
  }

  hasClass(className: string): boolean {
    return this._cssClasses.has(className);
  }

  // --- Child management ---

  /** @internal Mount a child node into this node's tree. */
  _mountChild(child: DOMNode): void {
    child._parentNode = this;
    child._setParent(this); // MessagePump parent for bubbling
    this._children._append(child);
  }

  /** @internal Remove a child node from this node's tree. */
  _unmountChild(child: DOMNode): void {
    this._children._remove(child);
    child._parentNode = null;
    child._setParent(null);
  }

  // --- Refresh seam (renderer integration) ---

  /**
   * Signal that this node needs visual update.
   * The renderer subscribes via onRefresh() to trigger re-renders.
   */
  refresh(options?: { repaint?: boolean; layout?: boolean }): void {
    for (const cb of this._refreshSubscribers) {
      cb();
    }
    // Layout changes propagate upward
    if (options?.layout && this._parentNode) {
      this._parentNode.refresh({ layout: true });
    }
  }

  /**
   * Subscribe to refresh signals. Returns an unsubscribe function.
   * This is the primary seam between textual-js and the renderer.
   */
  onRefresh(callback: RefreshCallback): () => void {
    this._refreshSubscribers.push(callback);
    return () => {
      const idx = this._refreshSubscribers.indexOf(callback);
      if (idx !== -1) this._refreshSubscribers.splice(idx, 1);
    };
  }
}
