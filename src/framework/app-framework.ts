import { makeAutoObservable } from "mobx";

import { Click, Compose, Key, Mount, MouseDown, MouseMove, MouseUp, Resize, Unmount } from "../events/events.js";
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
  targetId: string | null;
  targetNode?: WidgetNode;
  message: Message;
}

interface WidgetTypeState {
  defaultCss?: string;
  defaultStylesheet?: ParsedStylesheet;
}

type MessageSubscriber = (message: Message) => void;

function normalizeCssSource(source: string | undefined): string | undefined {
  const normalizedSource = source?.trim();
  return normalizedSource === undefined || normalizedSource.length === 0 ? undefined : normalizedSource;
}

const SPECIAL_KEY_NAMES = new Map<string, string>([
  [" ", "space"],
  ["?", "question_mark"],
  [",", "comma"],
  [".", "period"],
  ["~", "tilde"],
  ["_", "underscore"],
  ["-", "minus"],
  ["+", "plus"],
  ["=", "equals"],
  ["[", "left_square_bracket"],
  ["]", "right_square_bracket"],
  ["{", "left_curly_bracket"],
  ["}", "right_curly_bracket"],
  ["(", "left_parenthesis"],
  [")", "right_parenthesis"],
  ["/", "slash"],
  ["\\", "backslash"],
]);

export function normalizeKeyName(key: string): { key: string; character: string | null } {
  const trimmedKey = key.trim();

  if (trimmedKey.includes("+")) {
    return { key: trimmedKey.toLowerCase(), character: null };
  }

  if (trimmedKey.length === 1) {
    return {
      key: SPECIAL_KEY_NAMES.get(trimmedKey) ?? trimmedKey.toLowerCase(),
      character: trimmedKey,
    };
  }

  return {
    key: trimmedKey.toLowerCase(),
    character: null,
  };
}

export class TextualFramework {
  readonly registry = new WidgetRegistry();
  focusedNodeId: string | null = null;
  isRunning = false;
  exitResult: unknown = undefined;
  terminalSize = new Size(80, 24);
  private readonly queue: QueuedMessage[] = [];
  private drainPromise: Promise<void> | null = null;
  private userStylesheets: ParsedStylesheet[] = [];
  private readonly widgetTypes = new Map<string, WidgetTypeState>();
  private readonly messageSubscribers = new Set<MessageSubscriber>();

  constructor() {
    makeAutoObservable(
      this,
      {
        queue: false,
        drainPromise: false,
        widgetTypes: false,
        messageSubscribers: false,
      } as never,
      { autoBind: true },
    );
  }

  startup(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    for (const widget of this.registry.list()) {
      this.enqueueLifecycleMessages(widget);
    }
  }

  shutdown(): void {
    this.queue.length = 0;
    this.focusedNodeId = null;
    this.isRunning = false;
  }

  exit(result?: unknown): unknown {
    this.exitResult = result;
    this.shutdown();
    return result;
  }

  registerWidgetType(typeName: string, defaultCss?: string): void {
    const normalizedDefaultCss = normalizeCssSource(defaultCss);
    const existing = this.widgetTypes.get(typeName);

    if (existing === undefined) {
      this.widgetTypes.set(typeName, {
        defaultCss: normalizedDefaultCss,
        defaultStylesheet:
          normalizedDefaultCss === undefined
            ? undefined
            : parseTcss(normalizedDefaultCss, {
                origin: "default",
                scopeTypeName: typeName,
              }),
      });

      return;
    }

    if (normalizedDefaultCss === undefined || existing.defaultCss === normalizedDefaultCss) {
      return;
    }

    if (existing.defaultCss !== undefined) {
      // [LAW:one-source-of-truth] DEFAULT_CSS is canonical per widget type.
      // Conflicting declarations must fail instead of silently picking one mount.
      throw new Error(`Widget type "${typeName}" registered with conflicting DEFAULT_CSS`);
    }

    existing.defaultCss = normalizedDefaultCss;
    existing.defaultStylesheet = parseTcss(normalizedDefaultCss, {
      origin: "default",
      scopeTypeName: typeName,
    });

    if (this.isRunning) {
      this.recalculateStyles();
    }
  }

  registerWidget(widget: WidgetNode): void {
    this.registry.register(widget);

    if (widget.autoFocus) {
      this.focusWidget(widget.nodeId);
    }

    this.recalculateStyles();

    if (this.isRunning) {
      this.enqueueLifecycleMessages(widget);
    }
  }

  notifyWillUnmount(widget: WidgetNode): void {
    void this.dispatchQueuedMessage({
      targetId: null,
      targetNode: widget,
      message: this.withSender(new Unmount({ bubble: false }), widget),
    });
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

  getActiveStylesheetsFor(typeName: string): ParsedStylesheet[] {
    const defaultStylesheet = this.widgetTypes.get(typeName)?.defaultStylesheet;
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
    const replacementIndex = this.queue.findIndex(
      (queued) =>
        queued.targetId === targetId &&
        queued.targetNode === undefined &&
        queued.message.constructor === message.constructor &&
        message.canReplace(queued.message),
    );

    if (replacementIndex >= 0) {
      this.queue.splice(replacementIndex, 1, {
        targetId,
        message: this.withSender(message, this.registry.get(targetId)),
      });
    } else {
      this.queue.push({ targetId, message: this.withSender(message, this.registry.get(targetId)) });
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
    const normalized = normalizeKeyName(input);
    this.postToFocused(new Key(normalized.key, normalized.character ?? "", meta));
  }

  postClick(x: number, y: number, chain = 1): void {
    this.postToFocused(new Click(x, y, chain));
  }

  postMouseDown(x: number, y: number): void {
    this.postToFocused(new MouseDown(x, y));
  }

  postMouseUp(x: number, y: number): void {
    this.postToFocused(new MouseUp(x, y));
  }

  postMouseMove(x: number, y: number): void {
    this.postToFocused(new MouseMove(x, y));
  }

  postResize(width: number, height: number): void {
    this.setTerminalSize(new Size(width, height));
    this.postToFocused(new Resize(width, height));
  }

  async whenIdle(): Promise<void> {
    await this.drainPromise;
    await Promise.resolve();
  }

  subscribeToMessages(subscriber: MessageSubscriber): () => void {
    this.messageSubscribers.add(subscriber);

    return () => {
      this.messageSubscribers.delete(subscriber);
    };
  }

  findWidgets(selectorText: string): WidgetNode[] {
    const trimmedSelector = selectorText.trim();

    if (trimmedSelector.startsWith("#") && !trimmedSelector.includes(" ")) {
      const match = this.registry.getByCssId(trimmedSelector.slice(1));
      return match === undefined ? [] : [match];
    }

    const selectors = parseSelectorList(trimmedSelector);

    return this.registry.list().filter((widget) => selectors.some((selector) => this.matchesSelector(widget, selector)));
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

  private async dispatchQueuedMessage({ targetId, targetNode, message }: QueuedMessage): Promise<void> {
    try {
      if (message.noDispatch) {
        return;
      }

      let currentNode = targetId === null ? targetNode : this.registry.get(targetId);

      if (currentNode === undefined) {
        currentNode = targetNode;
      }

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
    } finally {
      // [LAW:one-source-of-truth] Message observation is published from one
      // boundary so tests and tooling share the same dispatch transcript.
      for (const subscriber of this.messageSubscribers) {
        subscriber(message);
      }
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

  private enqueueLifecycleMessages(widget: WidgetNode): void {
    this.enqueueDirectMessage(widget, new Compose({ bubble: false }));
    this.enqueueDirectMessage(widget, new Mount({ bubble: false }));
  }

  private enqueueDirectMessage(targetNode: WidgetNode, message: Message): void {
    this.queue.push({
      targetId: null,
      targetNode,
      message: this.withSender(message, targetNode),
    });
    this.scheduleDrain();
  }

  private withSender(message: Message, sender: WidgetNode | undefined): Message {
    return message.setSender(message.sender ?? sender ?? null);
  }
}
