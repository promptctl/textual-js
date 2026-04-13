/**
 * Screen — the compose root for all widgets.
 *
 * Owns focus management, the active binding chain, and serves as the
 * coordination point for events dispatched to widgets.
 *
 * // [LAW:single-enforcer] Focus changes are enforced at Screen via setFocus.
 * // Widgets call focus()/blur() which delegate here.
 */

import { Widget } from "./widget.js";
import type { WidgetOptions } from "./widget.js";

export class Screen extends Widget {
  private _focused: Widget | null = null;

  constructor(options?: WidgetOptions) {
    super(options);
  }

  // --- Focus ---

  get focusedWidget(): Widget | null {
    return this._focused;
  }

  setFocus(widget: Widget | null): void {
    if (this._focused === widget) return;

    const previous = this._focused;
    if (previous) {
      previous._setFocus(false);
    }

    this._focused = widget;

    if (widget) {
      widget._setFocus(true);
    }
  }

  /**
   * Move focus to the next focusable widget.
   */
  focusNext(): Widget | null {
    const chain = this._focusChain();
    if (chain.length === 0) return null;

    const currentIdx = this._focused ? chain.indexOf(this._focused) : -1;
    const nextIdx = (currentIdx + 1) % chain.length;
    const next = chain[nextIdx]!;
    this.setFocus(next);
    return next;
  }

  /**
   * Move focus to the previous focusable widget.
   */
  focusPrevious(): Widget | null {
    const chain = this._focusChain();
    if (chain.length === 0) return null;

    const currentIdx = this._focused ? chain.indexOf(this._focused) : 0;
    const prevIdx = (currentIdx - 1 + chain.length) % chain.length;
    const prev = chain[prevIdx]!;
    this.setFocus(prev);
    return prev;
  }

  /**
   * Build the focus chain — all focusable widgets in DOM order.
   */
  private _focusChain(): Widget[] {
    const chain: Widget[] = [];
    for (const node of this.walkDepthFirst()) {
      if (node instanceof Widget && node.canFocus && node.display && node.visible) {
        chain.push(node);
      }
    }
    return chain;
  }
}
