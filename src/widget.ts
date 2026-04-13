/**
 * Widget — the primary renderable, interactive unit of a Textual application.
 *
 * Extends DOMNode with:
 * - compose() for declarative child creation
 * - render() for content production (returns rich-js Renderable)
 * - arrange() for layout (delegates to a LayoutStrategy)
 * - Focus, scroll, and display state
 *
 * // [LAW:one-source-of-truth] Widget state (virtual size, scroll offsets,
 * // focus) lives in instance fields. Derived caches are rebuilt from these.
 */

import type { Renderable } from "rich-js";
import { RichText } from "rich-js";
import { DOMNode } from "./dom-node.js";
import { Size } from "./geometry/size.js";
import { Offset } from "./geometry/offset.js";
import { VerticalLayout } from "./layout/vertical.js";
import type { LayoutStrategy } from "./layout/strategy.js";
import type { WidgetPlacement } from "./layout/placement.js";

export interface WidgetOptions {
  id?: string;
  classes?: string;
}

export class Widget extends DOMNode {
  /** Default CSS for this widget class. Subclasses override. */
  static DEFAULT_CSS = "";

  /** Whether this widget can receive focus. Subclasses override. */
  static canFocus = false;

  /** Whether children of this widget can receive focus. */
  static canFocusChildren = true;

  private _hasFocus = false;
  private _layout: LayoutStrategy = new VerticalLayout();
  private _scrollOffset: Offset = Offset.ZERO;
  private _virtualSize: Size = Size.ZERO;
  protected _size: Size = Size.ZERO;
  private _display = true;
  private _visible = true;

  constructor(options?: WidgetOptions) {
    super(options);
  }

  // --- Focus ---

  get canFocus(): boolean {
    return (this.constructor as typeof Widget).canFocus;
  }

  get hasFocus(): boolean {
    return this._hasFocus;
  }

  /** @internal Set by Screen.setFocus. */
  _setFocus(focused: boolean): void {
    this._hasFocus = focused;
    this.refresh({ repaint: true });
  }

  // --- Display ---

  get display(): boolean {
    return this._display;
  }

  set display(value: boolean) {
    if (this._display !== value) {
      this._display = value;
      this.refresh({ layout: true });
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    if (this._visible !== value) {
      this._visible = value;
      this.refresh({ repaint: true });
    }
  }

  // --- Layout ---

  get layout(): LayoutStrategy {
    return this._layout;
  }

  set layout(strategy: LayoutStrategy) {
    this._layout = strategy;
    this.refresh({ layout: true });
  }

  get size(): Size {
    return this._size;
  }

  /** @internal Set by the renderer after layout. */
  _setSize(size: Size): void {
    this._size = size;
  }

  // --- Scroll ---

  get scrollOffset(): Offset {
    return this._scrollOffset;
  }

  set scrollOffset(value: Offset) {
    if (!this._scrollOffset.equals(value)) {
      this._scrollOffset = value;
      this.refresh({ repaint: true });
    }
  }

  get virtualSize(): Size {
    return this._virtualSize;
  }

  set virtualSize(value: Size) {
    if (!this._virtualSize.equals(value)) {
      this._virtualSize = value;
      this.refresh({ layout: true });
    }
  }

  // --- Content ---

  /**
   * Produce the children for this widget. Override in subclasses.
   * Called during the Compose lifecycle event.
   */
  compose(): Iterable<Widget> {
    return [];
  }

  /**
   * Produce the renderable content for this widget. Override in subclasses.
   * The renderer calls this to get what to display.
   */
  render(): Renderable {
    return new RichText("", { end: "" });
  }

  // --- Arrangement ---

  /**
   * Arrange children within the given size using this widget's layout strategy.
   * The renderer calls this to get child placements.
   */
  arrange(size: Size): WidgetPlacement[] {
    const displayedChildren: DOMNode[] = [];
    for (const child of this.children) {
      if (child instanceof Widget && child.display) {
        displayedChildren.push(child);
      }
    }
    return this._layout.arrange(this, displayedChildren, size, true);
  }

  // --- Child management (public API) ---

  /**
   * Mount child widgets into this widget.
   */
  mount(...widgets: Widget[]): void {
    for (const child of widgets) {
      this._mountChild(child);
    }
    this.refresh({ layout: true });
  }

  /**
   * Mount all widgets from an iterable.
   */
  mountAll(widgets: Iterable<Widget>): void {
    for (const child of widgets) {
      this._mountChild(child);
    }
    this.refresh({ layout: true });
  }

  /**
   * Remove this widget from its parent.
   */
  remove(): void {
    const parent = this.parent;
    if (parent) {
      parent._unmountChild(this);
      parent.refresh({ layout: true });
    }
  }
}
