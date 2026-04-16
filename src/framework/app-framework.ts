import { makeAutoObservable } from "mobx";

import { Click, Key, Resize } from "../events/events.js";
import { Message, messageHandlerNames } from "../events/message.js";
import { WidgetRegistry, type WidgetHandlers, type WidgetRegistration } from "./widget-registry.js";

export interface RegisterWidgetOptions {
  nodeId: string;
  parentId: string | null;
  id?: string;
  classes: string[];
  typeName: string;
  handlersRef: { current: WidgetHandlers | undefined };
  focusable?: boolean;
  autoFocus?: boolean;
}

interface QueuedMessage {
  targetId: string;
  message: Message;
}

export class TextualFramework {
  readonly registry = new WidgetRegistry();
  focusedNodeId: string | null = null;
  isRunning = false;
  private readonly queue: QueuedMessage[] = [];
  private drainPromise: Promise<void> | null = null;

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

  registerWidget(options: RegisterWidgetOptions): void {
    const entry: WidgetRegistration = {
      nodeId: options.nodeId,
      parentId: options.parentId,
      id: options.id,
      classes: options.classes,
      typeName: options.typeName,
      handlersRef: options.handlersRef,
      focusable: options.focusable ?? false,
      autoFocus: options.autoFocus ?? false,
    };

    this.registry.register(entry);

    if (entry.autoFocus) {
      this.focusWidget(entry.nodeId);
    }
  }

  unregisterWidget(nodeId: string): void {
    if (this.focusedNodeId === nodeId) {
      this.focusedNodeId = null;
    }

    this.registry.deregister(nodeId);
  }

  focusWidget(nodeId: string | null): void {
    this.focusedNodeId = nodeId;
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
    const target = this.registry.getDefaultTarget(this.focusedNodeId);

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
