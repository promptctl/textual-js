import { makeAutoObservable } from "mobx";

import { Click, Key, Resize } from "../events/events.js";
import { Message, messageHandlerNames } from "../events/message.js";
import { Size } from "../geometry/index.js";
import {
  matchesSelector as selectorMatchesWidget,
  parseSelectorList,
  resolveStylesForWidget,
  type ParsedSelector,
  type ParsedStylesheet,
  parseTcss,
} from "../styles/index.js";
import { WidgetNode } from "./widget-node.js";
import { WidgetRegistry, type WidgetHandlers } from "./widget-registry.js";

export interface RegisterWidgetOptions {
  nodeId: string;
  parentId: string | null;
  id?: string;
  classes: string[];
  typeName: string;
  handlersRef: { current: WidgetHandlers | undefined };
  focusable?: boolean;
  autoFocus?: boolean;
  defaultCss?: string;
}

interface QueuedMessage {
  targetId: string;
  message: Message;
}

export class TextualFramework {
  readonly registry = new WidgetRegistry();
  focusedNodeId: string | null = null;
  isRunning = false;
  terminalSize = new Size(80, 24);
  private readonly queue: QueuedMessage[] = [];
  private drainPromise: Promise<void> | null = null;
  private userStylesheets: ParsedStylesheet[] = [];
  private readonly defaultStylesheets = new Map<string, ParsedStylesheet>();

  constructor() {
    makeAutoObservable(
      this,
      {
        queue: false,
        drainPromise: false,
      } as never,
      { autoBind: true },
    );
  }

  startup(): void {
    this.isRunning = true;
  }

  shutdown(): void {
    this.queue.length = 0;
    this.focusedNodeId = null;
    this.isRunning = false;
  }

  registerWidget(widget: WidgetNode): void {
    this.registry.register(widget);

    if (widget.defaultCss !== undefined && !this.defaultStylesheets.has(widget.typeName)) {
      this.defaultStylesheets.set(
        widget.typeName,
        parseTcss(widget.defaultCss, {
          origin: "default",
          scopeTypeName: widget.typeName,
        }),
      );
    }

    if (widget.autoFocus) {
      this.focusWidget(widget.nodeId);
    }

    this.recalculateStyles();
  }

  unregisterWidget(nodeId: string): void {
    if (this.focusedNodeId === nodeId) {
      this.focusedNodeId = null;
    }

    this.registry.deregister(nodeId);
    this.recalculateStyles();
  }

  focusWidget(nodeId: string | null): void {
    this.focusedNodeId = nodeId;
    this.recalculateStyles();
  }

  setTerminalSize(size: Size): void {
    if (this.terminalSize.equals(size)) {
      return;
    }

    this.terminalSize = size;
    this.recalculateStyles();
  }

  setUserStylesheet(source: string): void {
    this.userStylesheets = source.trim().length === 0 ? [] : [parseTcss(source, { origin: "user" })];
    this.recalculateStyles();
  }

  getActiveStylesheetsFor(typeName: string, defaultCss?: string): ParsedStylesheet[] {
    const defaultStylesheet =
      defaultCss === undefined
        ? undefined
        : this.defaultStylesheets.get(typeName) ??
          parseTcss(defaultCss, {
            origin: "default",
            scopeTypeName: typeName,
          });
    const stylesheets = [defaultStylesheet, ...this.userStylesheets].filter(
      (stylesheet): stylesheet is ParsedStylesheet => stylesheet !== undefined,
    );

    return stylesheets;
  }

  parseSelectors(selectorText: string): ParsedSelector[] {
    return parseSelectorList(selectorText);
  }

  matchesSelector(widget: WidgetNode, selector: ParsedSelector): boolean {
    return selectorMatchesWidget(this, widget, selector);
  }

  refreshStyles(changed: boolean): void {
    this.registry.touch();

    if (changed) {
      this.recalculateStyles();
    }
  }

  recalculateStyles(): void {
    const visit = (widget: WidgetNode, inheritedCustomProperties: Record<string, string>): void => {
      const resolvedStyles = resolveStylesForWidget(this, widget, inheritedCustomProperties);
      widget.resolvedStyles.update(resolvedStyles);

      for (const child of this.registry.getChildren(widget.nodeId)) {
        visit(child, resolvedStyles.customProperties);
      }
    };

    // [LAW:dataflow-not-control-flow] Every style recalculation walks the same
    // tree in the same order. Variability lives in selector matches and values.
    for (const rootWidget of this.registry.getChildren(null)) {
      visit(rootWidget, {});
    }
  }

  get messageQueueSize(): number {
    return this.queue.length;
  }

  postMessage(targetId: string, message: Message): void {
    const sender = this.registry.get(targetId);
    message.sender = message.sender ?? sender ?? null;

    const replacementIndex = this.queue.findIndex(
      (queued) =>
        queued.targetId === targetId &&
        queued.message.constructor === message.constructor &&
        message.canReplace(queued.message),
    );

    if (replacementIndex >= 0) {
      this.queue.splice(replacementIndex, 1, { targetId, message });
    } else {
      this.queue.push({ targetId, message });
    }

    this.scheduleDrain();
  }

  postToFocused(message: Message): void {
    const interactiveWidgets = this.registry.list().filter((entry) => entry.isInteractive);
    const target =
      interactiveWidgets.find((entry) => entry.nodeId === this.focusedNodeId) ??
      interactiveWidgets.find((entry) => entry.focusable) ??
      interactiveWidgets[0];

    if (target !== undefined) {
      this.postMessage(target.nodeId, message);
    }
  }

  postKey(input: string, meta: { ctrl?: boolean; shift?: boolean; meta?: boolean; paste?: boolean } = {}): void {
    this.postToFocused(new Key(input, input, meta));
  }

  postClick(x: number, y: number, chain = 1): void {
    this.postToFocused(new Click(x, y, chain));
  }

  postResize(width: number, height: number): void {
    this.setTerminalSize(new Size(width, height));
    this.postToFocused(new Resize(width, height));
  }

  async whenIdle(): Promise<void> {
    await this.drainPromise;
    await Promise.resolve();
  }

  private scheduleDrain(): void {
    if (this.drainPromise !== null) {
      return;
    }

    this.drainPromise = Promise.resolve()
      .then(async () => this.drainQueue())
      .finally(() => {
        this.drainPromise = null;
      });
  }

  private async drainQueue(): Promise<void> {
    // [LAW:dataflow-not-control-flow] Every queued message flows through the same
    // dispatch pipeline; bubbling decisions live on message data, not skipped steps.
    while (this.queue.length > 0) {
      const nextMessage = this.queue.shift();

      if (nextMessage !== undefined) {
        await this.dispatchQueuedMessage(nextMessage);
      }
    }
  }

  private async dispatchQueuedMessage({ targetId, message }: QueuedMessage): Promise<void> {
    let currentNode = this.registry.get(targetId);

    while (currentNode !== undefined) {
      const handlers = currentNode.handlersRef.current;
      const matchingHandlers = this.resolveHandlers(handlers, message);

      for (const handler of matchingHandlers) {
        await handler(message);
      }

      if (!message.bubble || message.isPropagationStopped) {
        return;
      }

      currentNode = currentNode.parentId === null ? undefined : this.registry.get(currentNode.parentId);
    }
  }

  private resolveHandlers(
    handlers: WidgetHandlers | undefined,
    message: Message,
  ): Array<NonNullable<WidgetHandlers[keyof WidgetHandlers]>> {
    if (handlers === undefined) {
      return [];
    }

    const matchingHandlers = messageHandlerNames(message)
      .map((name) => handlers[name])
      .filter((handler): handler is NonNullable<WidgetHandlers[keyof WidgetHandlers]> => handler !== undefined);

    return Array.from(new Set(matchingHandlers));
  }
}
