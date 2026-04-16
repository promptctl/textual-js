# Docs Spec: Worker API

## Purpose
Describes the Worker API page — the per-task object that represents a single unit of background work, its lifecycle, progress, result, and error semantics in textual-js.

## Audience
Widget authors and app developers who create background work (data loading, debounced computations, long-running streams) and need to observe, cancel, or await individual tasks.

## Required sections
1. Overview — what a Worker is, how it is created (through a helper on App/Widget or by being added to the WorkerManager), and that results are typed by the work callable.
2. Worker State — the lifecycle states (PENDING, RUNNING, CANCELLED, ERROR, SUCCESS) and the allowed transitions.
3. Construction Parameters — `node` (owning DOM node), `work` (the function to run), `name`, `group`, `description`, `exitOnError`, and how they influence manager behavior.
4. Properties and Observables — `node`, `state`, `isCancelled`, `isRunning`, `isFinished`, `completedSteps`, `totalSteps`, `progress`, `result`, `error`. Note which are MobX-observable so `observer()` components re-render when they change.
5. Progress API — `update({ completedSteps?, totalSteps? })` and `advance(steps?)` for reporting progress; indeterminate vs. determinate progress.
6. Cancellation — `cancel()`, the cooperative cancellation signal exposed to the work callable, and the invariant that cancellation may race with running work.
7. Running and Waiting — how the framework runs work, and `wait()` semantics including the errors it can raise.
8. Lifecycle Messages — the state-changed event/message fired at the owning node when state transitions occur.
9. Errors — the set of errors `wait()` and related APIs can surface.
10. Getting the Current Worker — how a work callable can retrieve its own Worker (for progress reporting and cancellation checks).

## Key concepts
- Worker is an owned, observable handle; the work callable is a plain function/async function that returns the result type.
- State is reactive (MobX-backed) so UI that observes a worker updates automatically.
- Cancellation is cooperative: the work function must check the cancellation signal (the framework provides one) or await cancellation-aware primitives.
- Progress is advisory metadata used by UI (progress bars, status lines); `totalSteps === null/undefined` means indeterminate.
- `exitOnError` controls whether an unhandled rejection in the work callable escalates to an app-level crash or is suppressed and recorded on the worker.
- Groups enable the manager to cancel related workers; see the WorkerManager spec.

## Behaviors and contracts
- A newly-constructed worker starts in PENDING and posts a state-changed event on construction.
- Transitioning state posts a state-changed event only when the new state differs.
- `cancel()` flips `isCancelled` to true and signals the work; the worker's final state becomes CANCELLED once the work yields.
- `wait()` resolves with the result on SUCCESS, rejects with a WorkerFailed-equivalent error on ERROR, rejects with a WorkerCancelled-equivalent on CANCELLED, and rejects with a deadlock error if called from within the worker's own function.
- `progress` is clamped to [0, 100] and is 0 when `totalSteps` is unknown.
- Errors raised inside the work callable do not by default crash the app when `exitOnError` is false; they are captured on `error` and the worker state becomes ERROR.

## Example requirements
Describe (do not inline) JSX/TypeScript examples covering:
- Declaring a worker that fetches data and reports progress, consumed by an observer widget that renders a progress bar based on `worker.progress`.
- A work callable that checks the cancellation signal in a loop and exits cleanly.
- Awaiting a worker's result and handling the rejection branches (cancelled vs. failed).
- Reading the currently-active worker from inside a work callable to call `advance()`.
All examples are JSX/TypeScript using textual-js APIs and Ink primitives where UI is shown; no Python.

## Cross-references
- `spec/docs-spec/api_worker_manager.md` — the manager that owns, starts, cancels, and groups workers.
- `spec/spec-src/07-workers-timers-and-signals.md` — authoritative behavioral spec for workers.
- `spec/spec-src/03-message-event-and-dispatch.md` — how state-changed messages propagate and where handlers are attached.
- `spec/docs-spec/api_events.md` (if present) — the message/event dispatch system.

## Notes for writers
- Do not document `asyncio.Task`, `ContextVar`, `threading.Event`, `Coroutine`, or Python exceptions. Use JS idioms: async functions, AbortSignal-like cancellation, Promise rejection.
- The Python `thread=True` option has no direct equivalent in the JS runtime and should be omitted. If textual-js gains Web Worker or worker_thread support, the workers spec is the source of truth — do not invent.
- Do not refer to `WorkType` as a union including a coroutine function; describe it as "an async function or a function returning a Promise."
- Avoid describing Python-style inheritance (`Worker(Generic[ResultType])`); present a generic TypeScript type parameter instead.
- `get_current_worker()` translates to a framework-provided accessor (a function or a hook) — use whatever name the implementation exposes; do not invent a contextvar-based mechanism.
