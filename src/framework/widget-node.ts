import { makeAutoObservable, observable, runInAction } from "mobx";

import type { Binding } from "../bindings/index.js";
import type { VisualInput } from "../content/index.js";
import type { Message, MessageConstructor } from "../events/message.js";
import { Region } from "../geometry/region.js";
import { Size } from "../geometry/size.js";
import type { Notification, NotificationSeverity } from "../services/notifications.js";
import { Signal } from "../services/signal.js";
import type { TimerOptions } from "../services/timer.js";
import { Worker, type WorkFunction, type WorkerOptions } from "../services/worker.js";
import { ResolvedStyles } from "../styles/resolved-styles.js";
import { DOMQuery, NoMatches, TooManyMatches } from "./dom-query.js";
import type { TextualFramework } from "./app-framework.js";
import type { WidgetActions, WidgetHandlers } from "./widget-registry.js";

export interface WidgetNodeInit {
  framework: TextualFramework;
  nodeId: string;
  parentId: string | null;
  id?: string;
  classes: string[];
  typeName: string;
  handlersRef: { current: WidgetHandlers | undefined };
  actionsRef: { current: WidgetActions | undefined };
  bindingsRef: { current: Binding[] };
  focusable: boolean;
  autoFocus: boolean;
  disabled: boolean;
  loading: boolean;
  tooltip: VisualInput | null;
}

export class WidgetNode {
  readonly framework: TextualFramework;
  readonly nodeId: string;
  parentId: string | null;
  readonly id?: string;
  readonly typeName: string;
  readonly handlersRef: { current: WidgetHandlers | undefined };
  readonly actionsRef: { current: WidgetActions | undefined };
  readonly bindingsRef: { current: Binding[] };
  readonly focusable: boolean;
  readonly autoFocus: boolean;
  readonly classes = observable.set<string>();
  readonly pseudoClasses = observable.map<string, boolean>();
  readonly inlineStyles = observable.map<string, string>();
  readonly resolvedStyles = new ResolvedStyles();
  screenRegion = Region.EMPTY;
  scrollOffsetX = 0;
  scrollOffsetY = 0;
  virtualWidth = 0;
  virtualHeight = 0;
  disabled: boolean;
  loading: boolean;
  tooltip: VisualInput | null;

  constructor(init: WidgetNodeInit) {
    this.framework = init.framework;
    this.nodeId = init.nodeId;
    this.parentId = init.parentId;
    this.id = init.id;
    this.typeName = init.typeName;
    this.handlersRef = init.handlersRef;
    this.actionsRef = init.actionsRef;
    this.bindingsRef = init.bindingsRef;
    this.focusable = init.focusable;
    this.autoFocus = init.autoFocus;
    this.disabled = init.disabled;
    this.loading = init.loading;
    this.tooltip = init.tooltip;

    runInAction(() => {
      for (const className of init.classes) {
        this.classes.add(className);
      }
    });

    makeAutoObservable(
      this,
      {
        framework: false,
        handlersRef: false,
        actionsRef: false,
        bindingsRef: false,
        nodeId: false,
        parentId: false,
        id: false,
        typeName: false,
        focusable: false,
        autoFocus: false,
      },
      { autoBind: true },
    );
  }

  get actions(): WidgetActions | undefined {
    return this.actionsRef.current;
  }

  get bindings(): Binding[] {
    return this.bindingsRef.current;
  }

  // [LAW:dataflow-not-control-flow] Disabled propagation is a pure data lookup
  // up the ancestor chain. Callers do not branch on "is this one or an ancestor";
  // they ask for the effective state.
  get isDisabledEffective(): boolean {
    if (this.disabled) {
      return true;
    }

    return this.parent?.isDisabledEffective ?? false;
  }

  get isLoadingEffective(): boolean {
    if (this.loading) {
      return true;
    }

    return this.parent?.isLoadingEffective ?? false;
  }

  setDisabled(value: boolean): void {
    this.disabled = value;
    this.framework.refreshStyles(true);
  }

  setLoading(value: boolean): void {
    this.loading = value;
    this.framework.refreshStyles(true);
  }

  setTooltip(value: VisualInput | null): void {
    if (this.tooltip === value) {
      return;
    }

    this.tooltip = value;
    this.framework.handleWidgetTooltipChange(this);
  }

  get parent(): WidgetNode | undefined {
    return this.parentId === null ? undefined : this.framework.registry.get(this.parentId);
  }

  get effectiveScreenRegion(): Region {
    let x = this.screenRegion.x;
    let y = this.screenRegion.y;
    let ancestor = this.parent;

    while (ancestor !== undefined) {
      x -= ancestor.scrollOffsetX;
      y -= ancestor.scrollOffsetY;
      ancestor = ancestor.parent;
    }

    return new Region(x, y, this.screenRegion.width, this.screenRegion.height);
  }

  get visibleScreenRegion(): Region {
    const chain: WidgetNode[] = [];
    let current: WidgetNode | undefined = this;

    while (current !== undefined) {
      chain.unshift(current);
      current = current.parent;
    }

    let visibleRegion = new Region(0, 0, this.framework.terminalSize.width, this.framework.terminalSize.height);
    let cumulativeScrollX = 0;
    let cumulativeScrollY = 0;

    for (const node of chain) {
      const effectiveRegion = new Region(
        node.screenRegion.x - cumulativeScrollX,
        node.screenRegion.y - cumulativeScrollY,
        node.screenRegion.width,
        node.screenRegion.height,
      );
      visibleRegion = visibleRegion.intersection(effectiveRegion);
      cumulativeScrollX += node.scrollOffsetX;
      cumulativeScrollY += node.scrollOffsetY;
    }

    return visibleRegion;
  }

  get isFocused(): boolean {
    return this.framework.focusedNodeId === this.nodeId;
  }

  get isHovered(): boolean {
    return this.framework.hoveredNodeId === this.nodeId;
  }

  get display(): "block" | "none" {
    return (this.resolvedStyles.getRule("display") as "block" | "none" | undefined) ?? "block";
  }

  get visibility(): "visible" | "hidden" {
    return (this.resolvedStyles.getRule("visibility") as "visible" | "hidden" | undefined) ?? "visible";
  }

  get isDisplayed(): boolean {
    return this.display !== "none" && (this.parent?.isDisplayed ?? true);
  }

  get isVisible(): boolean {
    if (this.visibility === "hidden") {
      return false;
    }

    if (this.visibility === "visible" && this.resolvedStyles.hasRule("visibility")) {
      return true;
    }

    return this.parent?.isVisible ?? true;
  }

  get isInteractive(): boolean {
    return this.isDisplayed && this.isVisible;
  }

  focus(): void {
    this.framework.focusWidget(this.nodeId);
  }

  postMessage(message: Message): void {
    this.framework.postMessage(this.nodeId, message);
  }

  prevent<T>(messageType: MessageConstructor, callback: () => T): T;
  prevent<T>(messageTypes: MessageConstructor[], callback: () => T): T;
  prevent<T>(messageTypes: MessageConstructor | MessageConstructor[], callback: () => T): T {
    const types = Array.isArray(messageTypes) ? messageTypes : [messageTypes];
    return this.framework.preventMessages(this.nodeId, types, callback);
  }

  updateScreenRegion(region: Region): void {
    if (this.screenRegion.equals(region)) {
      return;
    }

    this.screenRegion = region;
    this.scrollTo(this.scrollOffsetX, this.scrollOffsetY);
  }

  setVirtualSize(width: number | Size, height?: number): void {
    const size = width instanceof Size ? width : new Size(width, height ?? 0);
    this.virtualWidth = Math.max(0, Math.trunc(size.width));
    this.virtualHeight = Math.max(0, Math.trunc(size.height));
    this.scrollTo(this.scrollOffsetX, this.scrollOffsetY);
  }

  scrollTo(x: number, y: number): void {
    const next = this.clampScrollOffsets(x, y);
    this.scrollOffsetX = next.x;
    this.scrollOffsetY = next.y;
  }

  scrollRelative(dx: number, dy: number): void {
    this.scrollTo(this.scrollOffsetX + dx, this.scrollOffsetY + dy);
  }

  scrollEnd(): void {
    this.scrollTo(this.maxScrollX, this.maxScrollY);
  }

  scrollPageUp(): void {
    this.scrollRelative(0, -Math.max(1, this.screenRegion.height));
  }

  scrollPageDown(): void {
    this.scrollRelative(0, Math.max(1, this.screenRegion.height));
  }

  scrollVisible(target: Region | WidgetNode): void {
    const targetRegion =
      target instanceof WidgetNode
        ? new Region(
            target.screenRegion.x - this.screenRegion.x + this.scrollOffsetX,
            target.screenRegion.y - this.screenRegion.y + this.scrollOffsetY,
            target.screenRegion.width,
            target.screenRegion.height,
          )
        : target;
    const viewport = new Region(
      this.scrollOffsetX,
      this.scrollOffsetY,
      this.screenRegion.width,
      this.screenRegion.height,
    );
    const delta = viewport.getScrollToVisible(targetRegion);

    // [LAW:dataflow-not-control-flow] Visibility scrolling computes both axes
    // every time and lets zero deltas encode the "already visible" case.
    this.scrollRelative(delta.x, delta.y);
  }

  runWorker<TResult>(work: WorkFunction<TResult>, options: WorkerOptions = {}): Worker<TResult> {
    return this.framework.runWorker(this, work, options);
  }

  createSignal<TValue>(): Signal<TValue> {
    return this.framework.createSignal(this);
  }

  setTimer(name: string, delayMs: number, callback: () => void): void {
    this.framework.setTimer(this, name, delayMs, callback);
  }

  setInterval(name: string, intervalMs: number, callback: () => void, options: TimerOptions = {}): void {
    this.framework.setInterval(this, name, intervalMs, callback, options);
  }

  clearTimer(name: string): void {
    this.framework.clearTimer(this, name);
  }

  pauseTimer(name: string): void {
    this.framework.pauseTimer(this, name);
  }

  resumeTimer(name: string): void {
    this.framework.resumeTimer(this, name);
  }

  resetTimer(name: string): void {
    this.framework.resetTimer(this, name);
  }

  notify(message: string, severity?: NotificationSeverity, timeout?: number, title?: string): Notification {
    return this.framework.notify(message, severity, timeout, title);
  }

  dismissNotification(identity: string): void {
    this.framework.dismissNotification(identity);
  }

  clearNotifications(): void {
    this.framework.clearNotifications();
  }

  matchesType(typeName: string): boolean {
    return this.typeName === typeName;
  }

  hasClass(className: string): boolean {
    return this.classes.has(className);
  }

  replaceClasses(nextClasses: string[]): void {
    runInAction(() => {
      this.classes.clear();

      for (const className of nextClasses) {
        this.classes.add(className);
      }
    });
  }

  addClass(...classNames: string[]): void {
    let changed = false;

    runInAction(() => {
      for (const className of classNames) {
        if (!this.classes.has(className)) {
          this.classes.add(className);
          changed = true;
        }
      }
    });

    this.framework.refreshStyles(changed);
  }

  removeClass(...classNames: string[]): void {
    let changed = false;

    runInAction(() => {
      for (const className of classNames) {
        if (this.classes.delete(className)) {
          changed = true;
        }
      }
    });

    this.framework.refreshStyles(changed);
  }

  toggleClass(className: string, force?: boolean): void {
    const shouldHaveClass = force ?? !this.classes.has(className);
    const hadClass = this.classes.has(className);

    runInAction(() => {
      if (shouldHaveClass) {
        this.classes.add(className);
      } else {
        this.classes.delete(className);
      }
    });

    this.framework.refreshStyles(hadClass !== shouldHaveClass);
  }

  setClasses(classes: string | string[]): void {
    const nextClasses = Array.isArray(classes)
      ? classes
      : classes
          .split(/\s+/)
          .map((className) => className.trim())
          .filter((className) => className.length > 0);
    const currentClasses = Array.from(this.classes);
    const same =
      currentClasses.length === nextClasses.length &&
      currentClasses.every((className, index) => className === nextClasses[index]);

    runInAction(() => {
      this.classes.clear();

      for (const className of nextClasses) {
        this.classes.add(className);
      }
    });

    this.framework.refreshStyles(!same);
  }

  setPseudoClass(name: string, enabled: boolean): void {
    this.pseudoClasses.set(name, enabled);
    this.framework.refreshStyles(true);
  }

  hasPseudoClass(name: string): boolean {
    if (name === "focus") {
      return this.isFocused;
    }

    if (name === "blur") {
      return !this.isFocused;
    }

    if (name === "disabled") {
      return this.isDisabledEffective;
    }

    if (name === "enabled") {
      return !this.isDisabledEffective;
    }

    if (name === "loading") {
      return this.isLoadingEffective;
    }

    if (name === "can-focus") {
      return this.focusable;
    }

    if (name === "focus-within") {
      let currentNode =
        this.framework.focusedNodeId === null ? undefined : this.framework.registry.get(this.framework.focusedNodeId);

      while (currentNode !== undefined) {
        if (currentNode.nodeId === this.nodeId) {
          return true;
        }

        currentNode = currentNode.parent;
      }
    }

    if (name === "hover") {
      return this.isHovered;
    }

    return this.pseudoClasses.get(name) ?? false;
  }

  setInlineStyle(name: string, value: string | number | null | undefined): void {
    if (value === null || value === undefined) {
      this.inlineStyles.delete(name);
      this.framework.refreshStyles(true);
      return;
    }

    this.inlineStyles.set(name, `${value}`);
    this.framework.refreshStyles(true);
  }

  setInlineStyles(styles: Record<string, string | number | null | undefined>): void {
    for (const [name, value] of Object.entries(styles)) {
      this.setInlineStyle(name, value);
    }
  }

  setDisplay(value: boolean | "block" | "none"): void {
    this.setInlineStyle("display", value === true ? "block" : value === false ? "none" : value);
  }

  setVisible(value: boolean | "visible" | "hidden"): void {
    this.setInlineStyle("visibility", value === true ? "visible" : value === false ? "hidden" : value);
  }

  query(selectorText = "*"): DOMQuery {
    return new DOMQuery(this.framework, this, "descendants").filter(selectorText);
  }

  queryChildren(selectorText = "*"): DOMQuery {
    return new DOMQuery(this.framework, this, "children").filter(selectorText);
  }

  queryOne(selectorText: string): WidgetNode {
    const results = this.query(selectorText).results();

    if (results.length === 0) {
      throw new NoMatches(`No widgets matched "${selectorText}"`);
    }

    return results[0];
  }

  queryExactlyOne(selectorText: string): WidgetNode {
    const results = this.query(selectorText).results();

    if (results.length === 0) {
      throw new NoMatches(`No widgets matched "${selectorText}"`);
    }

    if (results.length > 1) {
      throw new TooManyMatches(`More than one widget matched "${selectorText}"`);
    }

    return results[0];
  }

  queryAncestor(selectorText: string): WidgetNode {
    const selectors = this.framework.parseSelectors(selectorText);
    let currentParent = this.parent;

    while (currentParent !== undefined) {
      const candidate = currentParent;

      if (selectors.some((selector) => this.framework.matchesSelector(candidate, selector))) {
        return candidate;
      }

      currentParent = candidate.parent;
    }

    throw new NoMatches(`No ancestors matched "${selectorText}"`);
  }

  get maxScrollX(): number {
    return Math.max(0, this.virtualWidth - this.screenRegion.width);
  }

  get maxScrollY(): number {
    return Math.max(0, this.virtualHeight - this.screenRegion.height);
  }

  private clampScrollOffsets(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.max(0, Math.min(this.maxScrollX, Math.trunc(x))),
      y: Math.max(0, Math.min(this.maxScrollY, Math.trunc(y))),
    };
  }
}
