# Docs Spec: Events and Messages

## Purpose
Describes the doc page that teaches textual-js users how the message/event system works end-to-end: how messages are posted, queued, dispatched, bubbled, stopped, prevented, coalesced, and filtered; how handlers are registered; and how custom messages are authored.

## Audience
Widget authors and application authors. Readers need to understand when their handlers run, in what order, what they can do to control propagation, and how to define their own widget-specific messages (e.g., a custom button-pressed message from a reusable widget).

## Required sections
1. Message vs. Event: Message is the base concept; Event is the framework-emitted subset.
2. Message metadata: bubble flag, verbose flag, no-dispatch flag, namespace, handler name derivation.
3. The message queue: per-widget FIFO processing, ordering guarantees, idle state when drained.
4. Message coalescing: how and why newer messages can supersede older ones.
5. Bubbling and stop semantics: default bubbling, how to stop propagation, auto-stop when parent equals sender.
6. Preventing default: how to suppress framework-supplied default handlers without breaking your own.
7. Handler registration: by convention (handler-name), by decorator/helper with selector filtering, or by dynamic subscription.
8. Handler arguments: with or without event, sync or async.
9. Handler dispatch order: selector-based handlers first, then convention handler; walk of inheritance chain.
10. The `@on`-equivalent helper: attaching selector-filtered handlers to a method/function, with both positional (control) and keyword (other widget attributes) selectors.
11. Posting messages: `postMessage` / equivalent; event-loop re-entrancy guarantees; cross-boundary posting.
12. Scheduling callbacks: call-next, call-later, call-after-refresh semantics.
13. Timers: set-timer and set-interval, resulting Timer events, pause/resume.
14. Preventing specific message types: context-scoped suppression (`prevent(...)`) for programmatic updates.
15. Disabling and re-enabling messages long-term (`disable_messages`/`enable_messages` equivalents).
16. Defining custom messages: recommended co-location with the emitting widget, the `control` property, optional extra selector-matched attributes.
17. Catalog summary of builtin events (lifecycle, input, focus, other) with bubble flag and short description.

## Key concepts
- Every App/Widget has a message queue; processing is sequential and ordered.
- Events are a subclass of Message reserved for framework-generated input/state changes; user-defined messages should subclass Message directly.
- Bubbling is opt-in per message class; lifecycle events generally don't bubble, input events do.
- Stopping bubbling is a caller responsibility (`event.stop()`); preventing base-class default behavior is a separate call (`event.preventDefault()` equivalent).
- Selector-filtered handlers let a parent widget react only to messages from specific descendants (by id, class, or other allow-listed attribute).
- Message coalescing is an opt-in contract on the message class (Resize uses it to avoid burst processing).
- Custom messages defined on a widget are namespaced by the widget, avoiding handler-name collisions across widgets that all emit "Changed".
- Signals (covered in the reactivity doc) are a separate, lighter pub/sub channel for cases where messages are overkill.

## Behaviors and contracts
- Messages are processed in FIFO order; an async handler blocks the queue for the widget until it resolves.
- When bubbling, the message is re-posted to the parent; bubbling halts at the App root, at `stop()`, or when the parent equals the sender (loop guard).
- `@on`-style positional selector filtering requires the message class to declare which widget-valued attribute is the selector target (typically `control` in the textual-js port), plus any other allow-listed widget-valued attributes for keyword selectors.
- Selector parsing must happen at registration time — invalid selectors must raise immediately, not silently fail at dispatch.
- When a message is posted while the pump is closing/closed, the post returns false and is not delivered.
- `call_next`, `call_later`, and `call_after_refresh` have distinct ordering: call_next runs right after the current handler; call_later runs after queued messages; call_after_refresh runs after the next screen refresh.
- `prevent(...)` is a scoped guard: it only suppresses posting inside its scope; nested scopes union their suppression sets.
- Custom messages bubble by default; authors must opt out explicitly if they want a non-bubbling message.

## Example requirements
All examples JSX/TypeScript, using Ink primitives and the textual-js React/MobX API:
- A widget that handles a built-in event by naming convention or subscription, with and without the event argument.
- A widget that defines its own message class with a `control` property and posts it from a method.
- An ancestor component that uses the selector-filtered handler helper to react only to button presses with a specific id.
- An example of using the scoped "prevent" helper to set a reactive value without emitting its Changed message.
- An example of scheduling work via call_later and another via call_after_refresh, showing when to use which.
- An example of a custom message with coalescing enabled (implementing the can_replace-style hook).

## Cross-references
- `spec/docs-spec/events_reference.md` (exhaustive event catalog).
- `spec/docs-spec/input_handling.md` (input-specific flow).
- `spec/docs-spec/actions_and_bindings.md` (where key events become actions).
- `spec/docs-spec/reactivity.md` (signals vs. messages; message triggers vs. reactive refresh).
- `spec/docs-spec/api_message.md`, `spec/docs-spec/api_message_pump.md`, `spec/docs-spec/api_on.md`.
- `spec/spec-src/03-message-event-and-dispatch.md` (behavioral spec).

## Notes for writers
- Do not carry across Python-specific mechanics: no `__init_subclass__`, no metaclasses, no MRO walking as a user-facing idea. Describe handler resolution in terms of the class hierarchy or registered handler list, not MRO.
- Handler naming conventions should be described as textual-js uses them (likely event-type-based subscription rather than auto-discovered `on_<name>` methods). Do not fabricate a Python-style `on_input_changed` convention if the framework uses a different idiom — mirror the framework's actual API.
- Async handlers: use Promise/async-await terminology, not asyncio/coroutines.
- `prevent(...)` is a context manager in Python. In TypeScript, it will typically be a callback-scoped helper (e.g. `prevent(MessageType, () => { ... })`) or a disposable; describe whatever the framework actually implements.
- The `@on` decorator becomes a helper function or HOC; avoid claiming a decorator syntax unless TypeScript decorators are in use.
- Python "thread-safe post_message" language does not translate literally. Document the JS contract as main-runtime re-entrancy safety and explicit marshaling from off-main contexts.
- Keep coalescing, bubbling, stop, and preventDefault semantics faithfully — these translate directly.
- Drop mentions of `asyncio.create_task`; direct readers to the workers doc instead.
