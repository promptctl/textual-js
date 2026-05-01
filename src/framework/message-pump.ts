// [LAW:single-enforcer] MessagePump is the sole owner of the framework's
// message queue, prevention/disable gating, deferred-callback ordering, and
// dispatch loop. Cross-cutting concerns (handler resolution, key bindings,
// focus-aware default targets) are invoked through a narrow injected deps
// interface — the pump never reaches back into AppRuntime directly.
// [LAW:one-source-of-truth] queue/closedQueues/unmountingQueues/
// disabledMessageTypes/activePrevention/nextCallbacks/drainPromise live in
// exactly one place: this service. Framework methods are thin delegators.
// [LAW:one-way-deps] The pump depends only on a narrow MessagePumpDeps
// interface; it does NOT import AppRuntime.

import "./mobx-config.js";

import { autoObservable } from "./auto-observable.js";

import {
  Blur,
  Callback,
  CloseMessages,
  Compose,
  DescendantBlur,
  DescendantFocus,
  Focus,
  Idle,
  Key,
  Mount,
  Timer,
} from "../events/events.js";
import { Message, type MessageConstructor } from "../events/message.js";
import { runWithActiveMessagePump } from "../services/concurrency.js";
import type { Binding } from "../bindings/index.js";
import type { Widget } from "./widget.js";
import type { WidgetHandlers, WidgetMessageHandler } from "./widget-registry.js";

export interface QueuedMessage {
  targetId: string | null;
  targetNode?: Widget;
  message: Message;
}

export type DeferredCallback = {
  callback: () => void;
  prevention: PreventionSnapshot;
};

export type PreventionSnapshot = ReadonlyMap<string | null, ReadonlySet<MessageConstructor>>;

export type MessageSubscriber = (message: Message) => void;

// [LAW:dataflow-not-control-flow] Suppression policy reads one tag from the
// Message constructor (suppressionCategory). Loading suppresses both
// "user-input" and "scroll"; disabled suppresses only "user-input" (scroll
// passes through). The asymmetry lives in this rule, not in the message
// classification.
export function shouldSuppressAtNode(node: Widget, message: Message): boolean {
  const category = (message.constructor as MessageConstructor).suppressionCategory;

  if (category === null || category === undefined) {
    return false;
  }

  if (node.isLoadingEffective) {
    return true;
  }

  if (node.isDisabledEffective) {
    return category === "user-input";
  }

  return false;
}

export function clonePreventionSnapshot(
  snapshot: PreventionSnapshot,
): Map<string | null, ReadonlySet<MessageConstructor>> {
  return new Map(
    Array.from(snapshot.entries()).map(([targetId, messageTypes]) => [targetId, new Set(messageTypes)]),
  );
}

// [LAW:one-way-deps] Narrow capability interface the pump requires from its
// host (typically AppRuntime). The pump never imports the host class.
export interface MessagePumpDeps {
  getWidget(nodeId: string): Widget | undefined;
  listWidgets(): Widget[];
  isRunning(): boolean;
  isClosing(): boolean;
  isInBatch(): boolean;
  reportUnhandledError(error: unknown): void;
  resolveHandlers(
    handlers: WidgetHandlers | undefined,
    message: Message,
  ): Array<NonNullable<WidgetHandlers[keyof WidgetHandlers]>>;
  dispatchKeyHandler(handlers: WidgetHandlers | undefined, message: Key): Promise<boolean>;
  resolveBindingsForNode(node: Widget): Binding[];
  dispatchScreenKeyBindings(key: string): boolean;
  dispatchBindingActionForNode(node: Widget, action: string): boolean;
  dispatchPriorityBindings(key: string): boolean;
  resolveDefaultDispatchTarget(): Widget | undefined;
  clearPendingError(): void;
  throwPendingError(): void;
  normalizeAndComposeKey(
    input: string,
    meta: { ctrl?: boolean; shift?: boolean; meta?: boolean; paste?: boolean },
  ): { fullKey: string; character: string | null };
}

export class MessagePump {
  // [LAW:one-source-of-truth] The single backing store for queued messages
  // and dispatch coordination state.
  private readonly queue: QueuedMessage[] = [];
  private readonly closedQueues = new Set<string | null>();
  private readonly unmountingQueues = new Set<string>();
  private readonly disabledMessageTypes = new Map<string | null, Set<MessageConstructor>>();
  private readonly nextCallbacks: DeferredCallback[] = [];
  private readonly messageSubscribers = new Set<MessageSubscriber>();
  private drainPromise: Promise<void> | null = null;
  private activePrevention: PreventionSnapshot = new Map();
  private pendingDrainAfterBatch = false;
  private readonly deps: MessagePumpDeps;

  constructor(deps: MessagePumpDeps) {
    this.deps = deps;
    autoObservable(
      this,
      {
        queue: false,
        closedQueues: false,
        unmountingQueues: false,
        disabledMessageTypes: false,
        nextCallbacks: false,
        messageSubscribers: false,
        drainPromise: false,
        activePrevention: false,
        deps: false,
      },
      { autoBind: true },
    );
  }

  // ---- Subscribers ----

  subscribeToMessages(subscriber: MessageSubscriber): () => void {
    this.messageSubscribers.add(subscriber);
    return () => {
      this.messageSubscribers.delete(subscriber);
    };
  }

  // ---- Prevention / disable gating ----

  preventMessages<T>(
    targetId: string | null,
    messageTypes: MessageConstructor[],
    callback: () => T,
  ): T {
    const previous = this.activePrevention;
    const next = clonePreventionSnapshot(previous);
    const prevented = new Set(next.get(targetId) ?? []);

    for (const messageType of messageTypes) {
      prevented.add(messageType);
    }

    // [LAW:single-enforcer] Scoped message suppression is captured at one
    // pump boundary so direct posts and deferred callbacks share it.
    next.set(targetId, prevented);
    this.activePrevention = next;

    try {
      return callback();
    } finally {
      this.activePrevention = previous;
    }
  }

  capturePreventionSnapshot(): PreventionSnapshot {
    return clonePreventionSnapshot(this.activePrevention);
  }

  private withPrevention<T>(prevention: PreventionSnapshot, callback: () => T): T {
    const previous = this.activePrevention;
    this.activePrevention = prevention;

    try {
      return callback();
    } finally {
      this.activePrevention = previous;
    }
  }

  private isMessagePrevented(targetId: string | null, message: Message): boolean {
    const preventedTypes = this.activePrevention.get(targetId) ?? new Set<MessageConstructor>();
    return preventedTypes.has(message.constructor as MessageConstructor);
  }

  disableMessages(targetId: string | null, messageTypes: MessageConstructor[]): void {
    const disabled = this.disabledMessageTypes.get(targetId) ?? new Set<MessageConstructor>();

    for (const messageType of messageTypes) {
      disabled.add(messageType);
    }

    // [LAW:single-enforcer] Long-lived message suppression is stored in the
    // pump queue gate so every posting path shares exact-type matching.
    this.disabledMessageTypes.set(targetId, disabled);
  }

  enableMessages(targetId: string | null, messageTypes: MessageConstructor[]): void {
    const disabled = this.disabledMessageTypes.get(targetId);

    if (disabled === undefined) {
      return;
    }

    for (const messageType of messageTypes) {
      disabled.delete(messageType);
    }

    if (disabled.size === 0) {
      this.disabledMessageTypes.delete(targetId);
    }
  }

  private isMessageTypeDisabled(targetId: string | null, message: Message): boolean {
    return (this.disabledMessageTypes.get(targetId) ?? new Set<MessageConstructor>()).has(
      message.constructor as MessageConstructor,
    );
  }

  // ---- Queue introspection ----

  get messageQueueSize(): number {
    return this.queue.length;
  }

  getMessageQueueSize(targetId: string | null): number {
    return this.queue.filter(
      (queued) => queued.targetId === targetId || queued.targetNode?.nodeId === targetId,
    ).length;
  }

  isQueueIdle(): boolean {
    return this.queue.length === 0 && this.nextCallbacks.length === 0 && this.drainPromise === null;
  }

  getDrainPromise(): Promise<void> | null {
    return this.drainPromise;
  }

  // ---- Posting ----

  postAppMessage(message: Message): void {
    this.queue.push({ targetId: null, message });
    this.scheduleDrain();
  }

  postMessage(targetId: string, message: Message): boolean {
    const target = this.deps.getWidget(targetId);

    if (
      target === undefined ||
      this.closedQueues.has(targetId) ||
      this.unmountingQueues.has(targetId) ||
      this.isMessagePrevented(targetId, message) ||
      this.isMessageTypeDisabled(targetId, message)
    ) {
      return false;
    }

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
        message: this.withSender(message, target),
      });
    } else {
      this.queue.push({ targetId, message: this.withSender(message, target) });
    }

    this.scheduleDrain();
    return true;
  }

  dispatchMessage(message: Message): void {
    const target = this.deps.resolveDefaultDispatchTarget();

    if (target === undefined) {
      return;
    }

    // [LAW:single-enforcer] App-level dispatch chooses its target here so root
    // callers and test harnesses share one targeting rule without forging sender state.
    this.queue.push({ targetId: target.nodeId, message });
    this.scheduleDrain();
  }

  postToFocused(message: Message): void {
    const target = this.deps.resolveDefaultDispatchTarget();

    if (target !== undefined) {
      this.postMessage(target.nodeId, message);
    }
  }

  postKey(input: string, meta: { ctrl?: boolean; shift?: boolean; meta?: boolean; paste?: boolean } = {}): void {
    const normalized = this.deps.normalizeAndComposeKey(input, meta);

    // [LAW:dataflow-not-control-flow] Every key event flows through the same
    // two-phase pipeline: priority scan from app downwards, then bubble with
    // non-priority bindings interleaved. The data (priority flag, node chain)
    // selects which handlers run, not an if-ladder.
    if (this.deps.dispatchPriorityBindings(normalized.fullKey)) {
      return;
    }

    this.postToFocused(new Key(normalized.fullKey, normalized.character, meta));
  }

  emitBroadcast(message: Message): void {
    this.queue.push({ targetId: null, message });
    this.scheduleDrain();
  }

  enqueueDirectMessage(targetNode: Widget, message: Message): void {
    this.queue.push({
      targetId: null,
      targetNode,
      message: this.withSender(message, targetNode),
    });
    this.scheduleDrain();
  }

  enqueueLifecycleMessages(widget: Widget): void {
    this.enqueueDirectMessage(widget, new Compose({ bubble: false }));
    this.enqueueDirectMessage(widget, new Mount({ bubble: false }));
  }

  enqueueFocusBlur(previousNode: Widget | undefined, nextNode: Widget | undefined): void {
    if (previousNode !== undefined) {
      this.enqueueDirectMessage(previousNode, new Blur({ bubble: false }));
      this.enqueueDirectMessage(previousNode, new DescendantBlur());
    }

    if (nextNode !== undefined) {
      this.enqueueDirectMessage(nextNode, new Focus({ bubble: false }));
      this.enqueueDirectMessage(nextNode, new DescendantFocus());
    }
  }

  // ---- Deferred callbacks ----

  callLater<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    const prevention = this.capturePreventionSnapshot();

    // [LAW:one-source-of-truth] Deferred later-callbacks enter through the
    // message queue so shutdown, observability, and ordering all share one path.
    this.emitBroadcast(new Callback(() => {
      this.withPrevention(prevention, () => {
        callback(...args);
      });
    }));
  }

  callNext<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): void {
    const prevention = this.capturePreventionSnapshot();

    // [LAW:single-enforcer] callNext ordering is enforced by the dispatcher so
    // every caller observes the same after-message boundary instead of ambient microtasks.
    this.nextCallbacks.push({
      prevention,
      callback: () => {
        callback(...args);
      },
    });
    this.scheduleDrain();
  }

  // ---- Idle ----

  async whenIdle(): Promise<void> {
    do {
      const pendingDrain = this.drainPromise;

      if (pendingDrain !== null) {
        try {
          await pendingDrain;
        } catch (error) {
          this.deps.clearPendingError();
          throw error;
        }
      }

      await Promise.resolve();

      // [LAW:single-enforcer] Queue idleness is observed from this boundary so
      // tests and pump callers share one definition of "fully drained."
      if (this.queue.length === 0 && this.nextCallbacks.length === 0 && this.drainPromise === null) {
        this.deps.throwPendingError();
        return;
      }
    } while (true);
  }

  // ---- Lifecycle ----

  reopenAppQueue(): void {
    this.closedQueues.delete(null);
  }

  reopenWidgetQueue(nodeId: string): void {
    this.closedQueues.delete(nodeId);
    this.unmountingQueues.delete(nodeId);
  }

  markWidgetUnmounting(nodeId: string): void {
    this.unmountingQueues.add(nodeId);
  }

  markWidgetClosed(nodeId: string): void {
    this.unmountingQueues.delete(nodeId);
    this.closedQueues.add(nodeId);
    this.disabledMessageTypes.delete(nodeId);
  }

  // [LAW:single-enforcer] Synchronous Unmount delivery enters through the
  // pump so the dispatch path is the same one drainQueue uses.
  async dispatchUnmountImmediate(widget: Widget, message: Message): Promise<void> {
    await this.dispatchToWidgetImmediate(widget, message);
  }

  async dispatchToWidgetImmediate(widget: Widget, message: Message): Promise<void> {
    await this.dispatchQueuedMessage({
      targetId: null,
      targetNode: widget,
      message: this.withSender(message, widget),
    });
  }

  closeMessageQueue(targetId: string | null): void {
    this.closedQueues.add(targetId);
    // [LAW:one-source-of-truth] Queue closure owns pending-message pruning so
    // unmount and shutdown do not each invent their own stale-message cleanup.
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const queued = this.queue[index];

      const targetsClosedQueue =
        targetId === null
          ? queued?.targetId === null && queued.targetNode === undefined
          : queued?.targetId === targetId || queued?.targetNode?.nodeId === targetId;

      if (targetsClosedQueue) {
        this.queue.splice(index, 1);
      }
    }
  }

  closeAllMessageQueues(prune = true): void {
    if (prune) {
      this.closeMessageQueue(null);
    } else {
      this.closedQueues.add(null);
    }

    for (const widget of this.deps.listWidgets()) {
      if (prune) {
        this.closeMessageQueue(widget.nodeId);
      } else {
        this.closedQueues.add(widget.nodeId);
      }
    }
  }

  discardQueuedCallbacks(): void {
    // [LAW:dataflow-not-control-flow] Shutdown discard policy is read from a
    // static tag on each Message constructor; the queue scan does not branch
    // on message kind.
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const entry = this.queue[index];
      if (entry !== undefined && (entry.message.constructor as MessageConstructor).discardOnShutdown) {
        this.queue.splice(index, 1);
      }
    }

    this.nextCallbacks.length = 0;
  }

  emitCloseMessages(): void {
    this.emitBroadcast(new CloseMessages());
  }

  resetBatchPending(): void {
    this.pendingDrainAfterBatch = false;
  }

  // ---- Batch coordination ----

  onBatchExit(): void {
    if (this.pendingDrainAfterBatch) {
      this.pendingDrainAfterBatch = false;
      this.scheduleDrain();
    }
  }

  // ---- Key bindings (dispatch into a node's bindings) ----

  dispatchNodeKeyBindings(node: Widget, key: string): boolean {
    // [LAW:single-enforcer] Per-node key dispatch lives in the pump so the
    // dispatcher and external key paths invoke the same binding chain.
    for (const binding of this.deps.resolveBindingsForNode(node)) {
      if (binding.priority !== true && binding.key === key) {
        if (this.deps.dispatchBindingActionForNode(node, binding.action)) {
          return true;
        }
      }
    }

    return false;
  }

  // ---- Drain loop ----

  scheduleDrain(): void {
    if (this.deps.isInBatch()) {
      this.pendingDrainAfterBatch = true;
      return;
    }

    if (this.drainPromise !== null) {
      return;
    }

    this.drainPromise = Promise.resolve()
      .then(async () => this.drainQueue())
      .catch((error) => {
        this.deps.reportUnhandledError(error);
        throw error;
      })
      .finally(() => {
        this.drainPromise = null;

        if (this.queue.length > 0 || this.nextCallbacks.length > 0) {
          this.scheduleDrain();
        }
      });
  }

  private async drainQueue(): Promise<void> {
    // [LAW:dataflow-not-control-flow] Every queued message and deferred next
    // callback flows through one dispatcher-owned pipeline; variability lives in
    // queued values, not in branching to alternate schedulers.
    do {
      await this.flushCallNextCallbacks();
      let dispatchedQueuedMessage = false;

      while (this.queue.length > 0) {
        const nextMessage = this.queue.shift();

        if (nextMessage !== undefined) {
          dispatchedQueuedMessage = true;
          await this.dispatchQueuedMessage(nextMessage);
          await this.flushCallNextCallbacks();
        }
      }

      if (dispatchedQueuedMessage) {
        await this.dispatchIdlePass();
        await this.flushCallNextCallbacks();
      }
    } while (this.queue.length > 0 || this.nextCallbacks.length > 0);
  }

  private async dispatchQueuedMessage({ targetId, targetNode, message }: QueuedMessage): Promise<void> {
    const messageClass = message.constructor as MessageConstructor;

    try {
      if (message.noDispatch) {
        return;
      }

      if (messageClass.dispatchKind === "self-invoke") {
        if (this.deps.isClosing()) {
          return;
        }

        // [LAW:single-enforcer] Callback / Timer execution is attached to
        // queued message dispatch so deferred work follows the same lifecycle
        // boundary. Both classes carry an invoke() method by convention; the
        // dispatchKind tag is the contract.
        (message as Callback | Timer).invoke();
        return;
      }

      let currentNode = targetId === null ? targetNode : this.deps.getWidget(targetId);

      if (currentNode === undefined) {
        currentNode = targetNode;
      }

      while (currentNode !== undefined) {
        // [LAW:single-enforcer] Disabled/loading gating runs here and only here
        // so event suppression stays consistent across every dispatch path.
        if (shouldSuppressAtNode(currentNode, message)) {
          return;
        }

        const handlers = currentNode.handlersRef.current;
        const matchingHandlers = this.deps.resolveHandlers(handlers, message);

        for (const handler of matchingHandlers) {
          await runWithActiveMessagePump(currentNode, () => (handler as WidgetMessageHandler)(message));

          // [LAW:single-enforcer] preventDefault semantics are enforced in the
          // dispatcher so every handler path shares the same local short-circuit.
          if (message.isDefaultPrevented) {
            break;
          }
        }

        if (messageClass.handlesKeyBindings && !message.isPropagationStopped) {
          const keyMessage = message as Key;
          const keySender = (keyMessage as { sender?: unknown }).sender;
          const keyConsumer =
            keySender !== null && keySender !== undefined && (keySender as Widget).checkConsumeKey !== undefined
              ? (keySender as Widget)
              : undefined;
          const consumedByDescendant =
            keyConsumer !== undefined &&
            keyConsumer.nodeId !== currentNode.nodeId &&
            keyConsumer.checkConsumeKey(keyMessage.key, keyMessage.character);

          if (!consumedByDescendant && this.dispatchNodeKeyBindings(currentNode, keyMessage.key)) {
            message.stop();
          }

          if (!message.isPropagationStopped && (await this.deps.dispatchKeyHandler(handlers, keyMessage))) {
            message.stop();
          }
        }

        if (!message.bubble || message.isPropagationStopped) {
          return;
        }

        const parentNode = currentNode.parentId === null ? undefined : this.deps.getWidget(currentNode.parentId);

        if (parentNode !== undefined && parentNode === message.sender) {
          return;
        }

        currentNode = parentNode;
      }

      if (messageClass.handlesKeyBindings && !message.isPropagationStopped) {
        if (this.deps.dispatchScreenKeyBindings((message as Key).key)) {
          message.stop();
        }
      }
    } finally {
      if (messageClass.markLifecycleReadyAfterDispatch && targetNode !== undefined) {
        targetNode.markLifecycleReady();
      }

      // [LAW:one-source-of-truth] Message observation is published from one
      // boundary so tests and tooling share the same dispatch transcript.
      for (const subscriber of this.messageSubscribers) {
        subscriber(message);
      }
    }
  }

  private async dispatchIdlePass(): Promise<void> {
    if (!this.deps.isRunning()) {
      return;
    }

    // [LAW:single-enforcer] Idle delivery runs from the dispatcher boundary so
    // startup, user input, and deferred work all observe the same idle cadence.
    for (const widget of this.deps.listWidgets()) {
      await this.dispatchQueuedMessage({
        targetId: null,
        targetNode: widget,
        message: this.withSender(new Idle({ bubble: false }), widget),
      });
    }
  }

  private async flushCallNextCallbacks(): Promise<void> {
    while (this.nextCallbacks.length > 0) {
      const deferred = this.nextCallbacks.shift();

      if (deferred !== undefined) {
        this.withPrevention(deferred.prevention, () => {
          deferred.callback();
        });
      }
    }
  }

  private withSender(message: Message, sender: Widget | undefined): Message {
    return message.setSender(message.sender ?? sender ?? null);
  }
}

