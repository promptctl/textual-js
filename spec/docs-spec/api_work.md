# Docs Spec: Workers (work API)

## Purpose
Document how to author background work in textual-js: marking a method as a worker, scheduling it, grouping/exclusivity semantics, error propagation, and relationship to the broader worker/timer/signals subsystem.

## Audience
Widget and application authors running long-lived or asynchronous work (network requests, file IO, periodic polling, CPU-bound tasks offloaded where possible).

## Required sections
1. Overview (workers are framework-tracked tasks with lifecycle bound to a DOM node)
2. Declaring a worker (the `work` marker/decorator equivalent in textual-js — a helper function or method-decorator factory)
3. Options (`name`, `group`, `exclusive`, `exitOnError`, `description`, `thread`)
4. Sync vs async workers (when a sync function is acceptable, and the explicit opt-in for thread-style work)
5. Return values and the `Worker<T>` handle
6. Auto-generated debug descriptions
7. Relationship with `runWorker` (underlying mechanism)
8. Cancellation and exclusivity (cancel peers in the same group before starting)
9. Error handling (propagation to app exception handler, suppressing with `exitOnError: false`)
10. Worker declaration errors (misuse is caught at declaration time, not at run time)

## Key concepts
- A worker is a task with an identity, group, lifecycle, and optional exclusivity policy.
- Declaring a method as a worker converts calls into "start a tracked task" instead of "await the result inline". The call returns a `Worker<T>` handle, never the raw value.
- Groups allow coordinating multiple related workers, e.g., cancelling all prior "fetch" workers when a new one starts.
- Exclusivity (`exclusive: true`) makes the most recent call the sole survivor in its group — the workhorse pattern for debounced fetches.
- The `thread` option is an opt-in for workers that must not share the main event loop; non-async functions are allowed only when this is set.
- Workers are bound to a DOM node; when the node is disposed, the worker is cancelled.

## Behaviors and contracts
- Calling a worker-annotated method never blocks; it always returns a `Worker` handle immediately.
- Auto-generated descriptions include the method name and its arguments for readable debug output.
- When `exclusive: true`, prior workers in the same group are cancelled deterministically before the new one starts.
- Errors from a worker are forwarded to the app's exception handler by default (exits the app on unhandled errors).
- Setting `exitOnError: false` suppresses the exit but does not swallow the error silently — it still surfaces via the worker handle's state.
- A non-async function without `thread: true` fails at declaration time with a clear error (not at the first call).
- The first positional parameter of the wrapped method must be a framework node (the equivalent of `self` on a widget/screen/app).

## Example requirements
All examples are JSX/TypeScript. The doc must include:
- Declaring an async worker method on a widget class or as an arrow-function-on-component-instance equivalent (whichever is idiomatic in textual-js).
- An exclusive worker for debounced fetches (group + exclusive).
- A worker that updates a MobX observable when it completes.
- Reading the returned `Worker<T>` handle to inspect state (running, completed, cancelled, errored).
- Using `exitOnError: false` and reporting the error via a notification.
- A thread-mode worker running a CPU-heavy synchronous computation.
- Illustrating what happens when a node unmounts while its worker is running.

## Cross-references
- `spec/docs-spec/api_timer.md` (short periodic ticks vs. long-running workers)
- `spec/docs-spec/api_signal.md`
- `spec/docs-spec/api_message_pump.md`
- `spec/spec-src/07-workers-timers-and-signals.md`

## Notes for writers
- Python uses a `@work` decorator on methods of a `DOMNode` subclass. In textual-js widgets are function components; the equivalent may be a higher-order function (e.g., `const fetchCity = makeWorker(async function(...) { ... }, { group: "net", exclusive: true })`) bound to the component instance, or a method on a widget class for authors using the class-based escape hatch. Describe whichever is the framework's canonical form — do not force the Python decorator metaphor.
- Do not reference `Coroutine[None, None, ReturnType]`, `partial`, or `TypeAlias`. In TypeScript the worker's return type is simply `Worker<T>` where `T` is what the underlying function returns (or resolves to).
- The `thread=True` option in Python maps to running the function without the event-loop integration. In JS there is no GIL and no `asyncio`; describe this as "synchronous workers are allowed only when opted in; use them sparingly and never for blocking IO". Do not fabricate Web Worker integration unless the framework actually provides it — refer to the workers/signals spec for whatever is authoritative.
- Name the error class per textual-js naming conventions (e.g., `WorkerDeclarationError`), keeping the contract that declaration-time misuse fails loudly and early.
