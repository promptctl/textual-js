/**
 * MessagePump — async message queue and dispatch engine.
 *
 * Every DOMNode (App, Screen, Widget) extends MessagePump. It provides:
 * - A message queue with coalescing (canReplace)
 * - Handler resolution by naming convention (onMessageType / _onMessageType)
 * - Bubbling to parent
 * - Timer scheduling
 * - Callback scheduling
 *
 * // [LAW:single-enforcer] Message dispatch, handler resolution, and bubbling
 * // are enforced here. Subclasses post messages but don't dispatch them.
 */

import { Message, type MessageTarget } from "./message.js";

type MessageHandler = (message: Message) => void | Promise<void>;

export abstract class MessagePump implements MessageTarget {
  private _messageQueue: Message[] = [];
  private _running = false;
  private _closing = false;
  private _parent: MessagePump | null = null;
  private _timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private _pendingCallbacks: Array<() => void | Promise<void>> = [];
  private _processing = false;

  /** Set by DOMNode when this node is added to the tree. */
  get parent(): MessagePump | null {
    return this._parent;
  }

  /** @internal */
  _setParent(parent: MessagePump | null): void {
    this._parent = parent;
  }

  get isRunning(): boolean {
    return this._running;
  }

  get isClosing(): boolean {
    return this._closing;
  }

  /**
   * Post a message to this pump's queue.
   */
  postMessage(message: Message): void {
    message._setSender(this);

    // Coalescing: if canReplace, remove any earlier message of the same type
    if (message.canReplace) {
      const ctor = message.constructor;
      const idx = this._messageQueue.findIndex(m => m.constructor === ctor);
      if (idx !== -1) {
        this._messageQueue.splice(idx, 1);
      }
    }

    this._messageQueue.push(message);
    this._scheduleProcessing();
  }

  /**
   * Start the message loop.
   */
  async start(): Promise<void> {
    this._running = true;
  }

  /**
   * Stop the message loop and clean up timers.
   */
  async stop(): Promise<void> {
    this._closing = true;
    for (const timer of this._timers.values()) {
      clearInterval(timer);
    }
    this._timers.clear();
    this._running = false;
  }

  /**
   * Schedule a callback to run on the next processing cycle.
   */
  callLater(callback: () => void | Promise<void>): void {
    this._pendingCallbacks.push(callback);
    this._scheduleProcessing();
  }

  /**
   * Set a repeating timer that posts a callback message.
   */
  setTimer(name: string, intervalMs: number, callback: () => void): void {
    this.clearTimer(name);
    const timer = setInterval(callback, intervalMs);
    this._timers.set(name, timer);
  }

  /**
   * Clear a named timer.
   */
  clearTimer(name: string): void {
    const timer = this._timers.get(name);
    if (timer !== undefined) {
      clearInterval(timer);
      this._timers.delete(name);
    }
  }

  /**
   * Process all queued messages and pending callbacks.
   */
  async processMessages(): Promise<void> {
    if (this._processing) return;
    this._processing = true;

    while (this._messageQueue.length > 0 || this._pendingCallbacks.length > 0) {
      // Drain message queue
      while (this._messageQueue.length > 0) {
        const message = this._messageQueue.shift()!;
        await this._dispatch(message);
      }

      // Run pending callbacks
      const callbacks = this._pendingCallbacks.splice(0);
      for (const cb of callbacks) {
        await cb();
      }
    }

    this._processing = false;
  }

  /**
   * Dispatch a single message: find handler, call it, bubble if applicable.
   *
   * Handler resolution order:
   * 1. _on<MessageType> (private/internal handler)
   * 2. on<MessageType> (public handler)
   */
  private async _dispatch(message: Message): Promise<void> {
    if (this._closing) return;

    const handler = this._resolveHandler(message);
    if (handler) {
      await handler.call(this, message);
    }

    // Bubble to parent if not stopped and message bubbles
    if (!message.isStopped && message.bubble && this._parent) {
      this._parent.postMessage(message);
    }
  }

  /**
   * Resolve the handler method for a message by naming convention.
   */
  private _resolveHandler(message: Message): MessageHandler | null {
    const typeName = message.constructor.name;

    // Try _on<Type> first (internal handler)
    const privateName = `_on${typeName}` as keyof this;
    if (typeof this[privateName] === "function") {
      return this[privateName] as unknown as MessageHandler;
    }

    // Then on<Type> (public handler)
    const publicName = `on${typeName}` as keyof this;
    if (typeof this[publicName] === "function") {
      return this[publicName] as unknown as MessageHandler;
    }

    return null;
  }

  /**
   * Schedule async processing of the message queue.
   * Uses microtask so multiple postMessage calls within one tick are batched.
   */
  private _scheduleProcessing(): void {
    if (!this._processing && this._running) {
      queueMicrotask(() => this.processMessages());
    }
  }
}
