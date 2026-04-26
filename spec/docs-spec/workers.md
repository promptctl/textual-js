# Docs Spec: Workers

## Purpose
Describes the Workers concept doc page — how to run background work in a textual-js app without blocking the render loop, including worker creation, lifecycle, groups, exclusive cancellation, progress tracking, error handling, and the worker manager.

## Audience
App developers and widget authors doing any of: network requests, long-running computation, debounced side effects (search-as-you-type), subprocess interaction, streaming data feeds. Framework extenders integrating services that spawn background tasks.

## Required sections
1. Concept — what a worker is (a managed Promise-backed unit of background work) and why it exists (keep the render loop responsive, tie background work to node lifecycle).
2. Creating workers — the `runWorker` method on any node (app, screen, or widget); parameters: the work function/promise, `name`, `group`, `description`, `exitOnError`, `start`, `exclusive`, plus any textual-js-specific options (e.g. an abort-signal accessor).
3. Worker factory helper — textual-js's equivalent of the Python `@work` decorator: a helper that converts a method into a worker factory so calling it starts a worker and returns a handle. Describe as a TS helper (e.g. a higher-order function or a decorator-like utility), not Python decorator syntax.
4. Work function shapes — an async function, a function returning a Promise, or a raw Promise/Thenable. There is no "thread worker" variant in textual-js; background isolates, if any, are out of scope for this page.
5. Worker lifecycle — the state enumeration (`PENDING`, `RUNNING`, `CANCELLED`, `ERROR`, `SUCCESS`) and the valid transitions.
6. Return values and waiting — `worker.result`, `await worker.wait()`, and the failure modes: wait rejects if the worker errored, wait rejects with a distinct cancelled reason if the worker was cancelled, wait rejects with a deadlock error if called from inside the worker, and wait rejects if the worker was never started.
7. Error handling — `exitOnError` true vs false; when false, `worker.error` carries the captured exception and state moves to `ERROR`; when true, the app exits and surfaces the stack.
8. Cancellation — `worker.cancel()` signals cancellation cooperatively via an `AbortSignal`-shaped hook the work function can check; state moves to `CANCELLED`. Node unmount cancels all workers owned by that node.
9. Worker events — every transition posts a `Worker.StateChanged` message to the owning node (non-bubbling, in the `worker` namespace); the handler subscribes to state changes and can branch on `event.state`.
10. Exclusive workers and groups — every worker belongs to a named group (default `"default"`); `exclusive: true` at creation cancels all existing workers in the same group on the same node before starting; canonical use case is replacing the prior network request when the user types a new character.
11. Progress tracking — `worker.update({ completedSteps, totalSteps })`, `worker.advance(steps = 1)`, `worker.progress` (0–100), `worker.completedSteps`, `worker.totalSteps` (null for indeterminate).
12. Worker manager — `app.workers`, also reachable via `screen.workers` and `widget.workers`; container semantics (iteration oldest-first, reverse iteration newest-first, length, membership by identity); methods `cancelAll`, `cancelGroup(node, group)`, `cancelNode(node)`, `waitForComplete(workers?)` with cancellations swallowed in the wait.
13. Helper for the current worker — `getCurrentWorker()` returning the active worker from within a work function, or throwing if called outside a worker context; useful for progress reporting and cooperative-cancellation checks inside shared helpers.
14. Error taxonomy — the error subtypes (base worker error, worker-failed, worker-cancelled, deadlock, declaration error, no-active-worker) and when each is thrown.
15. Patterns — debounced search-as-you-type (exclusive group), long-running stream with progress updates, coordinated shutdown via the manager.

## Key concepts
- Workers are always owned by a node; lifecycle is coupled to mount/unmount of that node.
- Groups exist to make "replace the previous one" atomic via `exclusive: true`.
- Cancellation is cooperative; the work function must check the abort signal (or equivalent) to honor a cancel. There is no preemptive cancellation.
- `worker.wait()` is the async join point; the resolution/rejection taxonomy is the worker's contract with its caller.
- The worker manager is a single app-level object all nodes proxy to.
- State transitions drive messages; widgets can react to worker state without holding the worker reference directly.

## Behaviors and contracts
- `runWorker` returns the worker handle synchronously; the work has already been scheduled (or started, depending on `start`).
- Every state change posts a `StateChanged` message to the owning node with `bubble: false`.
- Unmounting a node cancels every worker owned by that node as part of teardown.
- Adding an exclusive worker to a group atomically cancels existing workers in that group (on the same node) before starting.
- Cancellation sets the state to `CANCELLED`; it does not reject currently-registered `wait()` callers with an error unrelated to cancellation — they see the cancelled-rejection reason.
- `waitForComplete(workers?)` at the manager level resolves without rejecting when constituent workers are cancelled during the wait.
- `exitOnError: true` is the default and is intentional: unhandled errors in background work surface loudly; opt in to silent error capture only when the app can meaningfully handle it.
- Progress is optional metadata; `totalSteps: null` means indeterminate (used for spinners) — `progress` returns 0 in that case.
- Calling `worker.wait()` from within the worker's own function is a hard error (deadlock detection).

## Example requirements
All examples JSX/TypeScript, using textual-js APIs; no Python, no asyncio. Describe (do not inline) examples for:
- Starting an async worker from a widget with `runWorker` and awaiting the result.
- Using the worker-factory helper to declare a method that, when called, runs as a worker.
- Search-as-you-type: each keystroke starts an `exclusive` worker in a named group, cancelling the previous in-flight fetch.
- Reporting progress during a multi-step task and reflecting it in the UI via a reactive binding.
- Handling `Worker.StateChanged` to update UI when a worker transitions to `SUCCESS` or `ERROR`.
- Capturing errors with `exitOnError: false` and surfacing them as a notification.
- Using the manager to wait for all outstanding workers during a graceful screen-pop.
- Cooperative cancellation: a long-running loop that checks the abort signal / `getCurrentWorker().isCancelled` between iterations.

## Cross-references
- `spec/docs-spec/api_worker_manager.md` — detailed manager API.
- `spec/docs-spec/api_app.md` — where the manager is hosted on the app.
- `spec/docs-spec/events_reference.md` — `Worker.StateChanged` dispatch.
- `spec/spec-src/07-workers-timers-and-signals.md` — authoritative behavioral spec for workers, timers, signals.
- `spec/spec-src/01-runtime-app-and-lifecycle.md` — node-unmount cancellation path.

## Notes for writers
- Do not describe `asyncio.Task`, `asyncio.CancelledError`, `run_in_executor`, or `loop` internals. textual-js runs on JavaScript's event loop; workers are Promise-based.
- There is no thread-worker variant in textual-js. Omit `thread=True`, `call_from_thread`, `threading.Event`, cooperative thread cancellation patterns, and `get_current_worker` as a "thread-safety" helper. `getCurrentWorker()` still exists but is described as "get the active worker from within a work function," not "get the worker from a thread."
- Do not use the Python `@work` decorator syntax or `async def`. Describe the worker-factory helper as a TS utility; show it conceptually, not as a language-level decorator unless textual-js ships a TS decorator form.
- Drop `WorkerDeclarationError` framed as "non-async function decorated with `@work` without `thread=True`"; in textual-js the analogous error is "work function did not return a Promise" or similar — describe it in JS terms.
- `post_message` being "thread-safe" does not translate; omit.
- Keep the state machine, the group/exclusive semantics, the progress API, the manager container protocol, and the error-handling options — these are framework-level contracts that carry over cleanly.
- "Swallows CancelledError" in the original doc translates to "cancellations during `waitForComplete` do not reject the returned promise." Describe the behavior; do not name a Python exception.
- Use camelCase for all APIs (`runWorker`, `cancelGroup`, `completedSteps`, etc.) to match textual-js conventions; the source uses snake_case.
