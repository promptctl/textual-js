# Docs Spec: MessagePump — The Message Loop Base

## Purpose
Describes the docs page that explains the message pump abstraction — the shared base that lets widgets, screens, and the app post messages, schedule callbacks, and dispatch handlers in a deterministic order.

## Audience
Widget and screen authors who need to post custom messages, schedule timers and callbacks, prevent or disable specific message types, and understand dispatch order. Also relevant to framework extenders.

## Required sections
1. Overview — what a message pump is, and which framework objects are pumps (widgets, screens, app).
2. Posting messages — `postMessage(message)` and event-loop / worker-boundary safety.
3. Preventing messages — `prevent(...messageTypes)` context scope during mutations.
4. Enabling / disabling messages — `disableMessages`, `enableMessages`, `checkMessageEnabled`.
5. Scheduling callbacks — `setTimer`, `setInterval`, `callLater`, `callNext`, `callAfterRefresh`, `waitForRefresh`.
6. Dispatch order — decorated handlers, convention-based handlers, MRO walk, bubbling, propagation.
7. Lifecycle — compose / mount sequence, idle events, queue draining.
8. Message coalescing — `canReplace` for replacing pending messages (for example, resize).
9. `messageSignal` — observing every dispatched message.
10. Errors — `MessagePumpClosed`, callback errors.

## Key concepts
- Pump: an object with a per-instance message queue and a loop that dispatches queued messages to handlers.
- Handler discovery: decorated handlers (registered via the `on` decorator / helper) take priority over convention-based `onFooBar` methods; both are discovered across the class hierarchy.
- Bubbling: if `message.bubble` is true and propagation is not stopped, the message is posted to the parent pump after local handlers run.
- Propagation control: `stop()` halts bubbling; `preventDefault()` suppresses default handlers in base classes.
- Message prevention scope: a scoped block that tags outgoing messages of given types so they are dropped before reaching the queue. Useful when a widget mutates another widget and does not want the resulting change message to fire.
- Enable/disable: a permanent per-pump filter on message types.
- Scheduling primitives: different kinds of "run this later" — immediate next, after queue drain, after refresh, after delay, at interval.
- Coalescing: adjacent queued messages may be replaced by a newer one when `canReplace` returns true (for example, the compositor coalesces pending resize messages).
- Idle event: dispatched when the queue is empty or has been idle past a threshold.
- Message signal: low-level observable published for every dispatched message; intended for devtools and diagnostics, not regular handling.

## Behaviors and contracts
- `postMessage(message)` queues the message on the main runtime. It is re-entrancy-safe across handlers, timers, `callNext`, `callLater`, Promise continuations, and worker-completion callbacks. Returns `true` if queued, `false` if the pump is closed/closing or the type is disabled.
- Off-main contexts do not call the pump directly in the current JS runtime; they marshal back to the main runtime, which performs the post.
- `postMessage` throws if the message is missing expected internal attributes — this usually means the base class constructor was not invoked.
- `prevent(...types) { ... }` (scoped block): while active, messages of the listed types posted to this pump are dropped. No types = no-op.
- Disabled messages are silently dropped for the life of the pump until re-enabled.
- Dispatch order for a single message:
  1. Compose + mount events complete before regular message dispatch begins.
  2. `callNext` callbacks run after the current message finishes.
  3. Handlers run in MRO order; decorated handlers fire first within each class.
  4. `messageSignal` is published after dispatch.
  5. If bubbling is enabled and not stopped, the message is posted to the parent.
- `callAfterRefresh` defers a callback until the next screen refresh cycle completes.
- `waitForRefresh` awaits the next refresh; calling it from the same task as the widget returns immediately (to avoid deadlock) rather than waiting.
- Timers and intervals return a timer handle with pause / resume / stop operations; see `api_timer.md`.
- Selecting bubble behavior on a message class is set at definition time; runtime changes happen via `stop` and `preventDefault`.

## Example requirements
All examples are JSX/TypeScript using Ink primitives and textual-js widgets:
- Posting a custom message from a widget and handling it on the parent screen.
- Using the prevent scope to mutate an `Input` without firing a `Changed` message.
- Scheduling a delayed callback with `setTimer` and clearing it.
- Running an interval callback and pausing/resuming it.
- Using `callAfterRefresh` to act after the DOM has settled following a state change.
- Subscribing to `messageSignal` for a diagnostic overlay.
- Disabling a noisy message type on a widget that does not need it.

## Cross-references
- `spec/docs-spec/api_message.md` — the `Message` base class.
- `spec/docs-spec/api_events.md` — built-in events.
- `spec/docs-spec/api_on.md` — decorated handler registration.
- `spec/docs-spec/api_timer.md` — timer handles.
- `spec/docs-spec/api_signal.md` — signals and their semantics.
- `spec/docs-spec/api_logger.md` — per-pump logger.
- `spec/spec-src/03-message-event-and-dispatch.md` — dispatch spec.
- `spec/spec-src/07-workers-timers-and-signals.md` — scheduling primitives.

## Notes for writers
- Python Textual uses asyncio and a metaclass (`_MessagePumpMeta`) to pre-populate decorated handlers and detect conflicting compute methods. textual-js does not have metaclasses; describe decorated handler registration in terms of the `on` helper (applied to class methods or to function-component event wiring via a hook).
- Do not mention `metaclass`, `__init_subclass__`, `MRO`, or `asyncio`. Describe dispatch as walking the class hierarchy and use "promise" / "microtask" instead of "coroutine" / "awaitable".
- Do not document `CallbackError` / `MessagePumpClosed` as Python exception classes with specific import paths; treat them as typed errors with textual-js names.
- `prevent` is presented in Python as a `with` statement; in textual-js it is typically a scoped helper that takes a callback (for example, `pump.prevent([Input.Changed], () => { ... })`) or an async block — use whichever form the framework actually exposes.
- Do not describe `postMessage` as thread-safe in the Python sense unless the implementation truly supports shared-memory multi-threading. The current contract is main-runtime re-entrancy safety.
- Compute-method conflict detection (`TooManyComputesError`) is a MobX-era concern; document it in the reactive section, not here.
- Weak-reference semantics on `parent` are implementation details unless they have visible behavior.
- The compose / mount sequencing is load-bearing — make sure this page references `api_widget.md` for the full lifecycle rather than redefining it.
