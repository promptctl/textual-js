import { observable, runInAction } from "mobx";
import { autoObservable } from "./auto-observable.js";

import type { Binding, BindingDeclaration } from "../bindings/index.js";
import { Content, type ContentInput, type VisualInput } from "../content/index.js";
import { Hide, Show } from "../events/events.js";
import type { Message, MessageConstructor } from "../events/message.js";
import { Offset } from "../geometry/offset.js";
import { Region } from "../geometry/region.js";
import { Size } from "../geometry/size.js";
import type { Notification, NotificationContent, NotificationSeverity } from "../services/notifications.js";
import type { NotifyOptions } from "./_app-runtime.js";
import { Signal } from "../services/signal.js";
import type { TimerOptions } from "../services/timer.js";
import { Worker, type WorkerCallable, type WorkerOptions } from "../services/worker.js";
import { PSEUDO_CLASSES } from "../styles/pseudo-classes.js";
import { ResolvedStyles } from "../styles/resolved-styles.js";
import { type StyleAssignmentValue } from "../styles/stylesheet.js";
import { createStylesProxy, Styles } from "../styles/styles.js";
import { DOMQuery, NoMatches, TooManyMatches, ensureQueryType, type QueryTypeConstraint } from "./dom-query.js";
import type { AnimationLevel } from "./_app-runtime.js";
import type { App } from "../app/app.js";
import { NodeList, type WidgetActions, type WidgetHandlers } from "./widget-registry.js";

// [LAW:one-source-of-truth] Widget has two constructor-input shapes, but
// exactly one class. WidgetInit is the framework-internal shape (every field
// pre-resolved by useWidget or the test harness). WidgetOptions is the
// public, user-friendly shape (framework required; classes accepted as
// string or string[]; nodeId synthesized). Both shapes feed the same
// constructor body via a single conversion point (optionsToInit).
export interface WidgetInit {
  app: App;
  nodeId: string;
  parentId: string | null;
  id?: string;
  classes: string[];
  typeName: string;
  handlersRef: { current: WidgetHandlers | undefined };
  actionsRef: { current: WidgetActions | undefined };
  bindingsRef: { current: Binding[] };
  focusable: boolean;
  canFocusChildren?: boolean;
  autoFocus: boolean;
  disabled: boolean;
  loading: boolean;
  tooltip: VisualInput | null;
  borderTitle?: ContentInput | null;
  borderSubtitle?: ContentInput | null;
}

export interface WidgetOptions {
  app: App;
  id?: string;
  classes?: string | readonly string[];
  name?: string;
  handlers?: WidgetHandlers;
  actions?: WidgetActions;
  bindings?: BindingDeclaration[];
  focusable?: boolean;
  canFocusChildren?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  loading?: boolean;
  tooltip?: VisualInput | null;
  borderTitle?: ContentInput | null;
  borderSubtitle?: ContentInput | null;
}

let nextPublicWidgetId = 1;

export class BadIdentifier extends Error {}

export class MountError extends Error {}

export class WidgetError extends Error {}

export class BadWidgetName extends Error {}

export interface PseudoClasses {
  enabled: boolean;
  focus: boolean;
  hover: boolean;
}

export type MountSpot = number | string | Widget;

export interface MountOptions {
  before?: MountSpot;
  after?: MountSpot;
}

export interface MoveChildOptions {
  before?: number | Widget;
  after?: number | Widget;
}

export interface WalkChildrenOptions {
  method?: "depth" | "breadth";
  withSelf?: boolean;
  reverse?: boolean;
}

export interface ScrollToOptions {
  animate?: boolean;
  duration?: number;
}

export interface ScrollAnimationState {
  x: number;
  y: number;
  duration: number;
}

const TEXTUAL_IDENTIFIER = /^-?[A-Za-z_][A-Za-z0-9_-]*$/;

function validateCssIdentifier(identifier: string, kind: "id" | "class"): void {
  if (!TEXTUAL_IDENTIFIER.test(identifier)) {
    throw new BadIdentifier(`Invalid CSS ${kind} "${identifier}"`);
  }
}

function splitMountArgs(items: Array<Widget | MountOptions>): { widgets: Widget[]; options: MountOptions } {
  const last = items.at(-1);
  const hasOptions = last !== undefined && !(last instanceof Widget);
  const options = hasOptions ? (last as MountOptions) : {};
  const widgetItems = hasOptions ? items.slice(0, -1) : items;
  const widgets = widgetItems.map((item) => {
    if (!(item instanceof Widget)) {
      throw new TypeError("mount() accepts only Widget instances");
    }

    return item;
  });

  return { widgets, options };
}

function normalizeInsertionIndex(index: number, length: number): number {
  const integer = Math.trunc(index);
  const normalized = integer < 0 ? length + integer : integer;

  if (normalized < 0 || normalized > length) {
    throw new WidgetError(`Child index ${index} is out of range`);
  }

  return normalized;
}

function normalizeExistingIndex(index: number, length: number): number {
  const integer = Math.trunc(index);
  const normalized = integer < 0 ? length + integer : integer;

  if (normalized < 0 || normalized >= length) {
    throw new WidgetError(`Child index ${index} is out of range`);
  }

  return normalized;
}

function resolveChildIndex(children: Widget[], child: Widget | number, label: string): number {
  if (typeof child === "number") {
    return normalizeExistingIndex(child, children.length);
  }

  const index = children.indexOf(child);

  if (index === -1) {
    throw new WidgetError(`move_child ${label} is not a direct child`);
  }

  return index;
}

function compareSortValues(left: unknown, right: unknown): number {
  if (left === right) {
    return 0;
  }

  return String(left) < String(right) ? -1 : 1;
}

function isNumberPair(value: readonly [number, number] | object): value is readonly [number, number] {
  return Array.isArray(value);
}

function normalizeClassInput(classes: string | string[]): string[] {
  return Array.isArray(classes)
    ? classes
    : classes
        .split(/\s+/)
        .map((className) => className.trim())
        .filter((className) => className.length > 0);
}

function normalizeBorderLabelInput(value: ContentInput | null | undefined): Content | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Content.fromText(value).firstLine;
}

export class Widget {
  static DEFAULT_CSS = "";
  static CSS = "";
  static COMPONENT_CLASSES: readonly string[] = [];
  static BINDINGS: readonly BindingDeclaration[] = [];
  static canFocus = false;
  static canFocusChildren = true;
  static inheritCss = true;
  static inheritBindings = true;

  readonly app: App;
  readonly nodeId: string;
  parentId: string | null;
  readonly id?: string;
  readonly typeName: string;
  readonly handlersRef: { current: WidgetHandlers | undefined };
  readonly actionsRef: { current: WidgetActions | undefined };
  readonly bindingsRef: { current: Binding[] };
  readonly focusable: boolean;
  readonly canFocusChildren: boolean;
  readonly autoFocus: boolean;
  private readonly classNames = observable.set<string>();
  readonly pseudoClasses = observable.map<string, boolean>();
  readonly resolvedStyles = new ResolvedStyles();
  readonly styles: Styles;
  screenRegion = Region.EMPTY;
  private placed = false;
  scrollOffsetX = 0;
  scrollOffsetY = 0;
  scrollTargetX = 0;
  scrollTargetY = 0;
  scrollAnimation: ScrollAnimationState | null = null;
  virtualWidth = 0;
  virtualHeight = 0;
  disabled: boolean;
  loading: boolean;
  tooltip: VisualInput | null;
  borderTitle: Content | null;
  borderSubtitle: Content | null;
  lifecycleReady = false;
  private offsetValue = Offset.ZERO;

  constructor(init: WidgetInit);
  constructor(options: WidgetOptions);
  constructor(input: WidgetInit | WidgetOptions) {
    // [LAW:one-source-of-truth] Both construction paths converge into a
    // single WidgetInit before any field is assigned, so the rest of the
    // constructor and every field reader see exactly one shape.
    const init: WidgetInit = "nodeId" in input
      ? (input as WidgetInit)
      : optionsToInit(input as WidgetOptions, new.target as typeof Widget);

    this.app = init.app;
    this.nodeId = init.nodeId;
    this.parentId = init.parentId;
    this.id = init.id;
    this.typeName = init.typeName;
    this.handlersRef = init.handlersRef;
    this.actionsRef = init.actionsRef;
    this.bindingsRef = init.bindingsRef;
    this.focusable = init.focusable;
    this.canFocusChildren = init.canFocusChildren ?? true;
    this.autoFocus = init.autoFocus;
    this.disabled = init.disabled;
    this.loading = init.loading;
    this.tooltip = init.tooltip;
    // [LAW:one-source-of-truth] widget.styles is the single writable style input;
    // widget.resolvedStyles is the single derived output from the cascade.
    this.styles = createStylesProxy(
      new Styles(() => {
        this.app.refreshStyles(true);
      }),
    );
    this.borderTitle = normalizeBorderLabelInput(init.borderTitle);
    this.borderSubtitle = normalizeBorderLabelInput(init.borderSubtitle);

    if (init.id !== undefined) {
      validateCssIdentifier(init.id, "id");
    }

    runInAction(() => {
      for (const className of init.classes) {
        validateCssIdentifier(className, "class");
        this.classNames.add(className);
      }
      this.syncStateClass("-disabled", init.disabled);
      this.syncStateClass("-loading", init.loading);
    });

    if (new.target === Widget) {
      autoObservable(
        this,
        {
          app: false,
          handlersRef: false,
          actionsRef: false,
          bindingsRef: false,
          nodeId: false,
          parentId: false,
          id: false,
          typeName: false,
          focusable: false,
          canFocusChildren: false,
          autoFocus: false,
          styles: false,
        },
        { autoBind: true },
      );
    }
  }

  get is_mounted(): boolean {
    return this.app.isNodeMounted(this);
  }

  get is_attached(): boolean {
    return this.is_mounted;
  }

  get classes(): ReadonlySet<string> {
    return this.classNames;
  }

  set classes(value: string | string[]) {
    this.setClasses(value);
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

  get canFocus(): boolean {
    return this.focusable;
  }

  setDisabled(value: boolean): void {
    const wasDisabledEffective = this.isDisabledEffective;
    const changed = this.disabled !== value;
    this.disabled = value;
    runInAction(() => {
      this.syncStateClass("-disabled", value);
    });
    this.app.refreshStyles(changed);

    if (!wasDisabledEffective && this.isDisabledEffective) {
      this.app.clearFocusWithin(this);
    }
  }

  setLoading(value: boolean): void {
    const changed = this.loading !== value;
    this.loading = value;
    runInAction(() => {
      this.syncStateClass("-loading", value);
    });
    this.app.refreshStyles(changed);
  }

  setTooltip(value: VisualInput | null): void {
    if (this.tooltip === value) {
      return;
    }

    this.tooltip = value;
    this.app.handleWidgetTooltipChange(this);
  }

  get parent(): Widget | undefined {
    return this.parentId === null ? undefined : this.app.registry.get(this.parentId);
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
    const chain: Widget[] = [];
    let current: Widget | undefined = this;

    while (current !== undefined) {
      chain.unshift(current);
      current = current.parent;
    }

    let visibleRegion = new Region(0, 0, this.app.terminalSize.width, this.app.terminalSize.height);
    let cumulativeScrollX = 0;
    let cumulativeScrollY = 0;

    for (const node of chain) {
      // [LAW:one-source-of-truth] Child visibility is clipped by measured
      // ancestor regions only; an unmeasured ancestor contributes no geometry.
      if (node !== this && node.screenRegion.isEmpty) {
        continue;
      }

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
    return this.app.focusedNodeId === this.nodeId;
  }

  get isHovered(): boolean {
    return this.app.hoveredNodeId === this.nodeId;
  }

  get display(): "block" | "none" {
    return (this.resolvedStyles.getRule("display") as "block" | "none" | undefined) ?? "block";
  }

  set display(value: boolean | "block" | "none") {
    this.setDisplay(value);
  }

  get visibility(): "visible" | "hidden" {
    return (this.resolvedStyles.getRule("visibility") as "visible" | "hidden" | undefined) ?? "visible";
  }

  get visible(): boolean {
    return this.isVisible;
  }

  set visible(value: boolean | "visible" | "hidden") {
    this.setVisible(value);
  }

  get offset(): Offset {
    return this.offsetValue;
  }

  set offset(value: Offset | readonly [number, number] | { x: number; y: number }) {
    if (value instanceof Offset) {
      this.offsetValue = value;
      return;
    }

    this.offsetValue = isNumberPair(value) ? new Offset(value[0], value[1]) : new Offset(value.x, value.y);
  }

  get border_title(): Content | null {
    return this.borderTitle;
  }

  set border_title(value: ContentInput | null) {
    this.borderTitle = normalizeBorderLabelInput(value);
    this.app.refreshStyles(true);
  }

  get border_subtitle(): Content | null {
    return this.borderSubtitle;
  }

  set border_subtitle(value: ContentInput | null) {
    this.borderSubtitle = normalizeBorderLabelInput(value);
    this.app.refreshStyles(true);
  }

  get children(): NodeList {
    return this.app.registry.getChildNodeList(this.nodeId);
  }

  get siblings(): Widget[] {
    return this.parentId === null
      ? []
      : this.app.registry.getChildren(this.parentId).filter((widget) => widget.nodeId !== this.nodeId);
  }

  get isEmpty(): boolean {
    return this.children.isEmpty;
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
    this.app.focusWidget(this.nodeId);
  }

  blur(): void {
    if (this.isFocused) {
      this.app.focusWidget(null);
    }
  }

  allowFocus(): boolean {
    return this.focusable && !this.isDisabledEffective && !this.isLoadingEffective && this.isInteractive;
  }

  allowFocusChildren(): boolean {
    return this.canFocusChildren && !this.isDisabledEffective && !this.isLoadingEffective && this.isInteractive;
  }

  trap_focus(enabled = true): void {
    this.app.trapFocus(this, enabled);
  }

  checkConsumeKey(key: string, character: string | null): boolean {
    const checker = this.actions?.checkConsumeKey as ((key: string, character: string | null) => unknown) | undefined;
    return typeof checker === "function" ? checker(key, character) === true : false;
  }

  get messageQueueSize(): number {
    return this.app.getMessageQueueSize(this.nodeId);
  }

  postMessage(message: Message): boolean {
    return this.app.postMessage(this.nodeId, message);
  }

  prevent<T>(messageType: MessageConstructor, callback: () => T): T;
  prevent<T>(messageTypes: MessageConstructor[], callback: () => T): T;
  prevent<T>(messageTypes: MessageConstructor | MessageConstructor[], callback: () => T): T {
    const types = Array.isArray(messageTypes) ? messageTypes : [messageTypes];
    return this.app.preventMessages(this.nodeId, types, callback);
  }

  disableMessages(...messageTypes: MessageConstructor[]): void {
    this.app.disableMessages(this.nodeId, messageTypes);
  }

  enableMessages(...messageTypes: MessageConstructor[]): void {
    this.app.enableMessages(this.nodeId, messageTypes);
  }

  markLifecycleReady(): void {
    this.lifecycleReady = true;
  }

  markLifecyclePending(): void {
    this.lifecycleReady = false;
  }

  // [LAW:types-are-the-program] The bit `screenRegion` alone cannot carry.
  // `Region.EMPTY` is both the pre-measurement value and a legitimate
  // measurement of a widget with no room, so `width === 0` answered two
  // questions at once and every width-aware widget invented its own tiebreak.
  // The layout writer knows which is which; this records it so nobody guesses.
  get isPlaced(): boolean {
    return this.placed;
  }

  updateScreenRegion(region: Region): void {
    this.placed = true;

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

  get virtualSize(): Size {
    return new Size(this.virtualWidth, this.virtualHeight);
  }

  set virtualSize(value: Size | readonly [number, number] | { width: number; height: number }) {
    const size = value instanceof Size ? value : isNumberPair(value) ? new Size(value[0], value[1]) : new Size(value.width, value.height);
    this.setVirtualSize(size);
  }

  get scrollOffset(): Offset {
    return new Offset(this.scrollOffsetX, this.scrollOffsetY);
  }

  set scrollOffset(value: Offset | readonly [number, number] | { x: number; y: number }) {
    const offset = value instanceof Offset ? value : isNumberPair(value) ? new Offset(value[0], value[1]) : new Offset(value.x, value.y);
    this.scrollTo(offset.x, offset.y);
  }

  get isScrollable(): boolean {
    const overflowX = this.resolvedStyles.getRule<string>("overflow-x") ?? "auto";
    const overflowY = this.resolvedStyles.getRule<string>("overflow-y") ?? "auto";
    return overflowX !== "hidden" || overflowY !== "hidden";
  }

  get showVerticalScrollbar(): boolean {
    return this.isScrollable && this.virtualHeight > this.screenRegion.height;
  }

  get showHorizontalScrollbar(): boolean {
    return this.isScrollable && this.virtualWidth > this.screenRegion.width;
  }

  get allowVerticalScroll(): boolean {
    return !this.isDisabledEffective && !this.isLoadingEffective && this.showVerticalScrollbar;
  }

  get allowHorizontalScroll(): boolean {
    return !this.isDisabledEffective && !this.isLoadingEffective && this.showHorizontalScrollbar;
  }

  scrollTo(x: number, y: number, options: ScrollToOptions = {}): void {
    const next = this.clampScrollOffsets(x, y);
    this.scrollTargetX = next.x;
    this.scrollTargetY = next.y;
    this.scrollAnimation = this.createScrollAnimation(next, options, this.app.animationLevel);
    this.scrollOffsetX = next.x;
    this.scrollOffsetY = next.y;
  }

  scrollRelative(dx: number, dy: number, options: ScrollToOptions = {}): void {
    this.scrollTo(this.scrollOffsetX + dx, this.scrollOffsetY + dy, options);
  }

  scrollEnd(): void {
    this.scrollTo(this.maxScrollX, this.maxScrollY);
  }

  scrollHome(): void {
    this.scrollTo(0, 0);
  }

  scrollUp(lines = 1, options: ScrollToOptions = {}): void {
    this.scrollRelative(0, -Math.max(0, Math.trunc(lines)), options);
  }

  scrollDown(lines = 1, options: ScrollToOptions = {}): void {
    this.scrollRelative(0, Math.max(0, Math.trunc(lines)), options);
  }

  scrollLeft(cells = 1, options: ScrollToOptions = {}): void {
    this.scrollRelative(-Math.max(0, Math.trunc(cells)), 0, options);
  }

  scrollRight(cells = 1, options: ScrollToOptions = {}): void {
    this.scrollRelative(Math.max(0, Math.trunc(cells)), 0, options);
  }

  action_scroll_home(): void {
    this.scrollHome();
  }

  action_scroll_end(): void {
    this.scrollEnd();
  }

  action_scroll_up(): void {
    this.scrollUp();
  }

  action_scroll_down(): void {
    this.scrollDown();
  }

  action_scroll_left(): void {
    this.scrollLeft();
  }

  action_scroll_right(): void {
    this.scrollRight();
  }

  action_scroll_page_up(): void {
    this.scrollPageUp();
  }

  action_scroll_page_down(): void {
    this.scrollPageDown();
  }

  scrollPageUp(): void {
    this.scrollRelative(0, -Math.max(1, this.screenRegion.height));
  }

  scrollPageDown(): void {
    this.scrollRelative(0, Math.max(1, this.screenRegion.height));
  }

  scrollVisible(target: Region | Widget): void {
    const targetRegion =
      target instanceof Widget
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

  runWorker<TResult>(work: WorkerCallable<TResult>, options: WorkerOptions = {}): Worker<TResult> {
    return this.app.runNodeWorker(this, work, options);
  }

  run_worker<TResult>(work: WorkerCallable<TResult>, options: WorkerOptions = {}): Worker<TResult> {
    // [LAW:one-source-of-truth] runWorker is the canonical JS widget surface;
    // run_worker is an alias that shares the framework worker boundary.
    return this.runWorker(work, options);
  }

  createSignal<TValue>(description = ""): Signal<TValue> {
    return this.app.createSignal(this, description);
  }

  setTimer(name: string, delayMs: number, callback: () => void): void {
    this.app.setTimer(this, name, delayMs, callback);
  }

  setInterval(name: string, intervalMs: number, callback: () => void, options: TimerOptions = {}): void {
    this.app.setInterval(this, name, intervalMs, callback, options);
  }

  clearTimer(name: string): void {
    this.app.clearTimer(this, name);
  }

  pauseTimer(name: string): void {
    this.app.pauseTimer(this, name);
  }

  resumeTimer(name: string): void {
    this.app.resumeTimer(this, name);
  }

  resetTimer(name: string): void {
    this.app.resetTimer(this, name);
  }

  notify(
    message: NotificationContent,
    severityOrOptions?: NotificationSeverity | NotifyOptions,
    timeout?: number,
    title?: NotificationContent,
    markup?: boolean,
  ): Notification {
    return this.app.notify(message, severityOrOptions, timeout, title, markup);
  }

  dismissNotification(identity: string): void {
    this.app.dismissNotification(identity);
  }

  clearNotifications(): void {
    this.app.clearNotifications();
  }

  matchesType(typeName: string): boolean {
    return this.app.widgetMatchesType(this.typeName, typeName);
  }

  hasClass(className: string): boolean {
    return this.classNames.has(className);
  }

  private syncStateClass(className: string, enabled: boolean): void {
    if (enabled) {
      this.classNames.add(className);
    } else {
      this.classNames.delete(className);
    }
  }

  replaceClasses(nextClasses: string[]): void {
    runInAction(() => {
      this.classNames.clear();

      for (const className of nextClasses) {
        validateCssIdentifier(className, "class");
        this.classNames.add(className);
      }
      this.syncStateClass("-disabled", this.disabled);
      this.syncStateClass("-loading", this.loading);
    });
  }

  addClass(...classNames: string[]): void {
    let changed = false;

    runInAction(() => {
      for (const className of classNames) {
        validateCssIdentifier(className, "class");

        if (!this.classNames.has(className)) {
          this.classNames.add(className);
          changed = true;
        }
      }
    });

    this.app.refreshStyles(changed);
  }

  removeClass(...classNames: string[]): void {
    let changed = false;

    runInAction(() => {
      for (const className of classNames) {
        validateCssIdentifier(className, "class");

        if (this.classNames.delete(className)) {
          changed = true;
        }
      }
    });

    this.app.refreshStyles(changed);
  }

  toggleClass(className: string, force?: boolean): void {
    validateCssIdentifier(className, "class");
    const shouldHaveClass = force ?? !this.classNames.has(className);
    const hadClass = this.classNames.has(className);

    runInAction(() => {
      if (shouldHaveClass) {
        this.classNames.add(className);
      } else {
        this.classNames.delete(className);
      }
    });

    this.app.refreshStyles(hadClass !== shouldHaveClass);
  }

  setClasses(classes: string | string[]): void {
    const nextClasses = normalizeClassInput(classes);
    const currentClasses = Array.from(this.classNames);
    const same =
      currentClasses.length === nextClasses.length &&
      currentClasses.every((className, index) => className === nextClasses[index]);

    runInAction(() => {
      this.classNames.clear();

      for (const className of nextClasses) {
        validateCssIdentifier(className, "class");
        this.classNames.add(className);
      }
      this.syncStateClass("-disabled", this.disabled);
      this.syncStateClass("-loading", this.loading);
    });

    this.app.refreshStyles(!same);
  }

  setPseudoClass(name: string, enabled: boolean): void {
    const changed = this.pseudoClasses.get(name) !== enabled;
    this.pseudoClasses.set(name, enabled);
    this.app.refreshStyles(changed);
  }

  hasPseudoClass(name: string): boolean {
    // [LAW:dataflow-not-control-flow] Built-in pseudo-classes resolve through
    // PSEUDO_CLASSES; ad-hoc widget-set pseudo-classes resolve through the
    // instance map. The two sources are unioned by data flow (?? chain), not
    // by branching on name.
    return PSEUDO_CLASSES[name]?.(this) ?? this.pseudoClasses.get(name) ?? false;
  }

  get_pseudo_class_state(): PseudoClasses {
    return {
      enabled: this.hasPseudoClass("enabled"),
      focus: this.hasPseudoClass("focus"),
      hover: this.hasPseudoClass("hover"),
    };
  }

  get first_of_type(): boolean {
    return this.hasPseudoClass("first-of-type");
  }

  get last_of_type(): boolean {
    return this.hasPseudoClass("last-of-type");
  }

  get first_child(): boolean {
    return this.hasPseudoClass("first-child");
  }

  get last_child(): boolean {
    return this.hasPseudoClass("last-child");
  }

  get is_odd(): boolean {
    return this.hasPseudoClass("odd");
  }

  get is_even(): boolean {
    return this.hasPseudoClass("even");
  }

  setInlineStyle(name: string, value: StyleAssignmentValue | null | undefined): void {
    // [LAW:single-enforcer] Programmatic style assignment normalizes at the
    // same style boundary as TCSS parsing before the cascade stores anything.
    this.styles.setRule(name, value);
  }

  setInlineStyles(styles: Record<string, StyleAssignmentValue | null | undefined>): void {
    for (const [name, value] of Object.entries(styles)) {
      this.setInlineStyle(name, value);
    }
  }

  setDisplay(value: boolean | "block" | "none"): void {
    this.setInlineStyle("display", value === true ? "block" : value === false ? "none" : value);
  }

  setVisible(value: boolean | "visible" | "hidden"): void {
    const wasVisible = this.isVisible;
    this.setInlineStyle("visibility", value === true ? "visible" : value === false ? "hidden" : value);
    this.app.callAfterRefresh(() => {
      const isVisible = this.isVisible;

      if (wasVisible !== isVisible && this.app.isNodeMounted(this)) {
        // [LAW:single-enforcer] Visibility event emission is owned by the
        // widget visibility setter so public visible changes share one seam.
        this.postMessage(isVisible ? new Show() : new Hide());
      }
    });
  }

  get _cover_widget(): object | null {
    return this.loading ? { owner: this } : null;
  }

  render(): ContentInput {
    return "";
  }

  render_str(value: ContentInput): Content {
    return Content.fromText(value);
  }

  get_content_width(): number {
    return Math.max(
      ...Content.fromText(this.render())
        .plain.split("\n")
        .map((line) => Content.fromText(line, { markup: false }).cellLength),
      0,
    );
  }

  get_content_height(): number {
    const plain = Content.fromText(this.render()).plain;
    return plain.length === 0 ? 0 : plain.split("\n").length;
  }

  mount(...widgetsOrOptions: Array<Widget | MountOptions>): Widget[] {
    const { widgets, options } = splitMountArgs(widgetsOrOptions);

    if (!this.app.isNodeMounted(this)) {
      throw new MountError("Cannot mount children on an unmounted widget");
    }

    if (options.before !== undefined && options.after !== undefined) {
      throw new MountError("Cannot specify both before and after");
    }

    const insertionIndex =
      options.before !== undefined
        ? this._find_mount_point(options.before)[1]
        : options.after !== undefined
          ? this._find_mount_point(options.after)[1] + 1
          : this.children.length;

    widgets.forEach((widget, offset) => {
      if (widget === this) {
        throw new WidgetError("A widget cannot own itself");
      }

      widget.parentId = this.nodeId;
      this.app.registerWidget(widget);
      this.children._insert(insertionIndex + offset, widget);
    });

    return widgets;
  }

  mount_all(widgets: Iterable<Widget>, options: MountOptions = {}): Widget[] {
    return this.mount(...Array.from(widgets), options);
  }

  move_child(child: Widget | number, options: MoveChildOptions): void {
    if ((options.before === undefined) === (options.after === undefined)) {
      throw new WidgetError("move_child requires exactly one of before or after");
    }

    const children = this.children.toArray();
    const childIndex = resolveChildIndex(children, child, "child");
    const childWidget = children[childIndex]!;
    const targetSpot = options.before ?? options.after;
    const targetIndex = resolveChildIndex(children, targetSpot as Widget | number, "target");

    if (childIndex === targetIndex) {
      return;
    }

    const afterAdjustment = options.after === undefined ? 0 : 1;
    const withoutChildIndex = childIndex < targetIndex ? targetIndex - 1 : targetIndex;
    this.children._insert(withoutChildIndex + afterAdjustment, childWidget);
    this.app.registry.touch();
  }

  remove(): void {
    if (!this.app.isNodeMounted(this)) {
      return;
    }

    for (const widget of this.walkChildren({ withSelf: true, reverse: true })) {
      this.app.notifyWillUnmount(widget);
      this.app.unregisterWidget(widget.nodeId);
    }
  }

  remove_children(selector?: string | QueryTypeConstraint): void {
    for (const child of this.matchDirectChildren(selector)) {
      child.remove();
    }
  }

  sort_children(key?: (widget: Widget) => unknown, reverse = false): void {
    const ordered = this.children
      .toArray()
      .map((widget, index) => ({ widget, index, value: key?.(widget) ?? index }))
      .sort((left, right) => compareSortValues(left.value, right.value) || left.index - right.index)
      .map((entry) => entry.widget);

    if (reverse) {
      ordered.reverse();
    }

    this.children._clear();
    for (const child of ordered) {
      this.children._append(child);
    }
    this.app.registry.touch();
  }

  _find_mount_point(spot: MountSpot): [Widget, number] {
    if (typeof spot === "number") {
      return [this, normalizeInsertionIndex(spot, this.children.length)];
    }

    if (typeof spot === "string") {
      const matches = this.queryChildren(spot).results();

      if (matches.length === 0) {
        throw new NoMatches(`No child matched "${spot}"`);
      }

      if (matches.length > 1) {
        throw new TooManyMatches(`More than one child matched "${spot}"`);
      }

      return [this, this.children.index(matches[0]!)];
    }

    const parent = spot.parent;

    if (parent === undefined || !this.app.isNodeMounted(spot)) {
      throw new MountError("Mount point widget is not in the DOM");
    }

    return [parent, parent.children.index(spot)];
  }

  get_child_by_id(id: string): Widget {
    const child = this.children.toArray().find((widget) => widget.id === id);

    if (child === undefined) {
      throw new NoMatches(`No child with id "${id}"`);
    }

    return child;
  }

  get_widget_by_id(id: string): Widget {
    const widget = this.walkChildren().find((candidate) => candidate.id === id);

    if (widget === undefined) {
      throw new NoMatches(`No descendant with id "${id}"`);
    }

    return widget;
  }

  get_child_by_type(typeConstraint: QueryTypeConstraint): Widget {
    const typeName = this.app.resolveWidgetTypeName(typeConstraint);
    const child = this.children.toArray().find((candidate) => candidate.matchesType(typeName));

    if (child === undefined) {
      throw new NoMatches(`No child matched requested type`);
    }

    return child;
  }

  private matchDirectChildren(selector?: string | QueryTypeConstraint): Widget[] {
    if (selector === undefined || selector === "*") {
      return this.children.toArray();
    }

    if (typeof selector === "string") {
      return this.queryChildren(selector).results();
    }

    const typeName = this.app.resolveWidgetTypeName(selector);
    return this.children.toArray().filter((child) => child.matchesType(typeName));
  }

  query(selectorText = "*"): DOMQuery {
    return new DOMQuery(this.app, this, "descendants").filter(selectorText);
  }

  queryChildren(selectorText = "*"): DOMQuery {
    return new DOMQuery(this.app, this, "children").filter(selectorText);
  }

  queryOne(selectorText: string, typeConstraint?: QueryTypeConstraint): Widget {
    const results = this.query(selectorText).results();

    if (results.length === 0) {
      throw new NoMatches(`No widgets matched "${selectorText}"`);
    }

    return new DOMQuery(this.app, this, "descendants").filter(selectorText).first(typeConstraint);
  }

  queryOneOptional(selectorText: string, typeConstraint?: QueryTypeConstraint): Widget | null {
    const results = this.query(selectorText).results();

    if (results.length === 0) {
      return null;
    }

    return new DOMQuery(this.app, this, "descendants").filter(selectorText).first(typeConstraint);
  }

  queryExactlyOne(selectorText: string, typeConstraint?: QueryTypeConstraint): Widget;
  queryExactlyOne(typeConstraint: QueryTypeConstraint): Widget;
  queryExactlyOne(selectorOrType: string | QueryTypeConstraint, typeConstraint?: QueryTypeConstraint): Widget {
    const selectorText = typeof selectorOrType === "string" ? selectorOrType : "*";
    const effectiveTypeConstraint = typeof selectorOrType === "string" ? typeConstraint : selectorOrType;
    const results = this.query(selectorText).results(effectiveTypeConstraint);

    if (results.length === 0) {
      throw new NoMatches(`No widgets matched "${selectorText}"`);
    }

    if (results.length > 1) {
      throw new TooManyMatches(`More than one widget matched "${selectorText}"`);
    }

    return new DOMQuery(this.app, this, "descendants").filter(selectorText).onlyOne(effectiveTypeConstraint);
  }

  query_exactly_one(typeConstraint: QueryTypeConstraint): Widget {
    return this.queryExactlyOne(typeConstraint);
  }

  queryAncestor(selectorText: string, typeConstraint?: QueryTypeConstraint): Widget {
    const selectors = this.app.parseSelectors(selectorText);
    let currentParent = this.parent;

    while (currentParent !== undefined) {
      const candidate = currentParent;

      if (selectors.some((selector) => this.app.matchesSelector(candidate, selector))) {
        return ensureQueryType(candidate, typeConstraint);
      }

      currentParent = candidate.parent;
    }

    throw new NoMatches(`No ancestors matched "${selectorText}"`);
  }

  walkChildren(options: WalkChildrenOptions = {}): Widget[] {
    const method = options.method ?? "depth";
    const withSelf = options.withSelf ?? false;
    const seed = withSelf ? [this] : this.app.registry.getChildren(this.nodeId);
    const output: Widget[] = [];
    const queue = [...seed];

    // [LAW:one-source-of-truth] Traversal snapshots derive from the widget
    // registry parent links; no parallel tree representation is created.
    while (queue.length > 0) {
      const node = queue.shift();

      if (node === undefined) {
        continue;
      }

      output.push(node);
      const children = this.app.registry.getChildren(node.nodeId);

      if (method === "depth") {
        queue.unshift(...children);
      } else {
        queue.push(...children);
      }
    }

    return options.reverse === true ? output.reverse() : output;
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

  private createScrollAnimation(
    target: { x: number; y: number },
    options: ScrollToOptions,
    animationLevel: AnimationLevel,
  ): ScrollAnimationState | null {
    const duration = Math.max(0, Math.trunc(options.duration ?? 0));
    const shouldAnimate = options.animate === true && duration > 0 && animationLevel !== "none";

    // [LAW:one-source-of-truth] The scroll target is stored once on the widget;
    // animation metadata is derived from that target plus framework policy.
    return shouldAnimate ? { x: target.x, y: target.y, duration } : null;
  }
}

function optionsToInit(options: WidgetOptions, typeSource: typeof Widget): WidgetInit {
  if (options === null || typeof options !== "object") {
    throw new TypeError("Widget constructor options must be an object");
  }

  if (options.app === undefined || options.app === null) {
    throw new WidgetError("Widget requires an app");
  }

  const typeName = options.name ?? typeSource.name;
  validatePublicWidgetName(typeName);

  return {
    app: options.app,
    nodeId: `public-widget-${nextPublicWidgetId++}`,
    parentId: null,
    id: options.id,
    classes: normalizePublicClasses(options.classes),
    typeName,
    handlersRef: { current: options.handlers },
    actionsRef: { current: options.actions },
    bindingsRef: { current: [] },
    focusable: options.focusable ?? typeSource.canFocus,
    canFocusChildren: options.canFocusChildren ?? typeSource.canFocusChildren,
    autoFocus: options.autoFocus ?? false,
    disabled: options.disabled ?? false,
    loading: options.loading ?? false,
    tooltip: options.tooltip ?? null,
    borderTitle: options.borderTitle,
    borderSubtitle: options.borderSubtitle,
  };
}

function normalizePublicClasses(classes: WidgetOptions["classes"]): string[] {
  if (classes === undefined) {
    return [];
  }

  if (typeof classes === "string") {
    return classes.split(/\s+/).filter((className) => className.length > 0);
  }

  return [...classes];
}

function validatePublicWidgetName(typeName: string): void {
  if (!/^[A-Z]/.test(typeName)) {
    throw new BadWidgetName(`Widget class names must start with an uppercase letter: ${typeName}`);
  }
}
