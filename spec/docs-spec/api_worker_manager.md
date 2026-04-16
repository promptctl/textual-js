# Docs Spec: Worker Manager API

## Purpose
Describes the WorkerManager API page — the application-level coordinator that owns, starts, cancels, and awaits workers started from any node (App, Screen, or Widget) in textual-js.

## Audience
Widget authors and app developers who spawn background work (async tasks, long-running jobs, debounced side effects) and need to cancel, group, or await those jobs at the app, screen, or widget level.

## Required sections
1. Overview — what WorkerManager is and where to access it (`app.workers`, `screen.workers`, `widget.workers` — all delegate to the same app-level manager).
2. Getting a Manager — clarify you never construct it directly; it is exposed by the framework.
3. Iteration and container semantics — iteration (oldest-first), reverse iteration (newest-first), length, truthiness, membership test.
4. Adding Workers — `addWorker` semantics: `start` flag, `exclusive` flag, group-based cancellation on add.
5. Starting and Cancelling — `startAll`, `cancelAll`, `cancelGroup(node, group)`, `cancelNode(node)`, with return values where applicable.
6. Awaiting Completion — `waitForComplete(workers?)` and how it handles cancellations (cancelled workers do not surface errors from the wait).
7. Relation to Worker — cross-reference the Worker spec for per-worker lifecycle and state.

## Key concepts
- Single app-level manager; all nodes expose the same instance through a `workers` accessor.
- Workers are ordered by creation time, enabling deterministic iteration.
- Groups partition workers so they can be cancelled en masse (per-node, per-group).
- Nodes own the workers they spawned; unmounting/removing a node should cancel its workers (cross-reference lifecycle/mount spec).
- Exclusive-on-add: when `exclusive=true` and a group is named, adding a worker cancels any existing workers in the same group on the same node before enqueueing the new one.

## Behaviors and contracts
- `addWorker` is the single entry point for registering a worker; it atomically performs group cancellation (when exclusive) and optional start.
- `cancelGroup` and `cancelNode` return the list of workers they cancelled; callers can inspect that list but should not rely on order beyond creation order.
- `waitForComplete` resolves when the targeted workers reach a terminal state; cancellations during the wait do not reject the promise.
- Iteration yields a snapshot — mutations during iteration do not disturb the in-flight iterator.
- Membership tests compare worker identity (reference equality), not name/description.

## Example requirements
Describe (do not inline) JSX/TypeScript examples covering:
- Accessing the manager from a widget (`this.workers` or equivalent hook) inside an observer component.
- Adding a worker with an exclusive group so rapid re-triggers cancel the prior run (e.g., a search-as-you-type provider).
- Awaiting all workers belonging to a widget in a teardown path.
- Cancelling every worker in a named group when a tab/screen deactivates.
All examples are JSX/TypeScript using textual-js APIs; no Python.

## Cross-references
- `spec/docs-spec/api_worker.md` — Worker lifecycle, state, progress, and wait semantics.
- `spec/spec-src/07-workers-timers-and-signals.md` — behavioral spec governing workers, timers, and signals in textual-js.
- `spec/spec-src/01-runtime-app-and-lifecycle.md` — when workers are cancelled as a consequence of node removal or app exit.

## Notes for writers
- Do not describe Python `asyncio.Task`, `gather`, `CancelledError`, or `ContextVar`. textual-js runs on JavaScript's event loop; workers are Promise-based and cancellation is cooperative via an `AbortSignal`-shaped affordance exposed on the worker.
- The Python iteration protocol (`iter`, `reversed`, `len`, `in`) maps to JS `Symbol.iterator`, explicit `reverse()`/`size`/`has(worker)` members, or a small equivalent API — describe the JS-native surface, not the Python dunder names.
- "Swallows CancelledError" from the Python doc translates to "cancellations do not reject the wait promise"; do not name a Python exception.
- Avoid documenting thread workers as OS threads — textual-js has no OS-thread variant. If a background-isolate story exists, it lives in the workers spec; otherwise omit.
