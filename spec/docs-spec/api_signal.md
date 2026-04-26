# Docs Spec: Signal (Pub-Sub for DOM Nodes)

## Purpose
Document the signal primitive — a simple named pub-sub object that a DOM node can own and other nodes can subscribe to with a callback. Explain when to use a signal vs. a reactive attribute vs. a message.

## Audience
Widget authors coordinating cross-widget state changes that don't fit the message/event model; app authors hooking framework-emitted signals (e.g. screen-layout-refresh, bindings-updated, text-selection-started).

## Required sections
1. Overview — what a signal is, how it differs from reactives (no stored value) and messages (not event-dispatched, not bubble-able).
2. Creating a signal — constructing a signal owned by a node with an identifier (for debugging).
3. Subscribing — `subscribe(node, callback, { immediate })`.
4. Unsubscribing — `unsubscribe(node)` removes all callbacks registered by that node.
5. Publishing — `publish(data)`; data shape is generic per signal.
6. Lifecycle and weak references — owners and subscribers are weakly held; garbage collection cleans up subscriptions.
7. Publish rules — when `publish` is a no-op.
8. Immediate vs. deferred callbacks — sync during `publish` vs. queued on the subscriber's message queue.
9. Error handling — exceptions from callbacks are logged but do not propagate; other subscribers still run.
10. When to use signals vs. reactives vs. messages.

## Key concepts
- A signal is owned by a node and carries a payload type `T`.
- Multiple callbacks from the same node can register against a signal.
- Subscription requires the subscribing node to be running (mounted); subscribing an unmounted node throws a signal error.
- Owners and subscribers are held weakly; when a node is garbage collected its subscriptions vanish automatically.
- `publish` is a no-op if the owner has been collected, is not attached to the DOM, is being pruned, or any ancestor is not running.
- With `immediate: true`, callbacks run synchronously inside `publish`. With `immediate: false` (default), callbacks are queued on the subscriber's message queue to run after the current processing completes.

## Behaviors and contracts
- Creating a signal records the owner node weakly and keeps subscriptions in a weakly-keyed map keyed by the subscribing node.
- `subscribe(node, callback, { immediate })` registers the callback under the subscribing node; multiple callbacks may coexist per node. Re-subscribing the same callback is not deduplicated by default — readers should not rely on either behavior; framework implementation is documented elsewhere.
- Subscribing a non-running node throws the signal error.
- `unsubscribe(node)` removes all callbacks registered by that node; it is a no-op if the node has no registrations.
- `publish(data)`:
  - Returns immediately if there are no subscriptions, or the owner has been collected, or the owner is detached/pruning, or any ancestor is not running.
  - For each subscribed node: if that node is no longer running, attached, or being pruned, its registration is removed; otherwise its callbacks run.
  - Exceptions raised by callbacks are logged and swallowed; other callbacks continue.
- Deferred callbacks (default) use the node's "call on next tick" primitive so they do not execute during the publish call, preventing re-entrancy.
- Async callbacks are supported; they are awaited on their own task.

## Example requirements
JSX/TypeScript examples. Include at minimum:
- A widget owns a signal and publishes it from an event handler; a sibling subscribes and reacts.
- Subscribing to a framework-emitted signal (e.g. screen-layout-refresh) from a widget.
- Using `immediate: true` and explaining when that's appropriate.
- Unsubscribing on widget unmount (or relying on GC).
- Handling a signal payload with a typed object.

## Cross-references
- `api_reactive.md` in `spec/docs-spec/` — alternative for value-change notifications with stored state.
- `api_message.md` / `api_events.md` in `spec/docs-spec/` — alternative for bubbled/routed events.
- `api_screen.md` in `spec/docs-spec/` — framework-emitted screen signals.
- `api_dom_node.md` in `spec/docs-spec/` — the "running"/"attached"/"pruning" lifecycle states referenced by publish.
- `spec/spec-src/02-dom-reactivity-and-query.md` — reactive/signal coordination.
- `spec/spec-src/03-message-event-and-dispatch.md` — contrast with message dispatch.

## Notes for writers
- Do not document `SignalCallbackType` as a Python Union; in JS it is simply `(data: T) => void | Promise<void>`.
- The JS port uses `WeakRef`/`FinalizationRegistry` or equivalent weak-collection mechanics for weakness; describe the behavior ("owners and subscribers are weakly held") rather than implementation details.
- Do not mention `WeakKeyDictionary`; describe the behavior ("subscriptions are keyed by subscribing node and cleaned up when that node is collected").
- Clarify the decision tree for when to use a signal:
  - Use a reactive when one widget owns a value and others want to react to its change with the new value.
  - Use a message when one widget wants to notify an ancestor in the DOM tree using the event-bubbling path.
  - Use a signal when one node wants to broadcast a named event to arbitrary unrelated subscribers without the overhead or structure of the message pipeline.
- Describe "running" as "mounted and not being unmounted"; avoid Python's `MessagePump` terminology.
- The framework exposes several built-in signals (see `api_screen.md`); do not invent others not present in the source.
