# Docs Spec: API — AwaitComplete

## Purpose
Describes the API reference doc for the optionally-awaitable handle returned by framework methods that do background work (for example, mounting widgets or running composed tasks).

## Audience
Application authors and widget authors who call framework methods that return these handles and want to know whether to await them, and framework-internal contributors who construct them.

## Required sections
1. Overview: what an AwaitComplete handle represents and why methods return one.
2. The "await or ignore" contract: awaiting blocks until the background work completes; ignoring is safe because textual-js awaits it before the next message is processed.
3. The construction surface (for internal use): accepting one or more awaitables and an optional pre-await hook.
4. Inspecting state: whether the work is done, and the error (if any) that the underlying work produced.
5. Scheduling the handle to run after the current message via a helper method.
6. The no-op factory for returning an already-completed handle when a method contract requires one but there is no work to do.
7. Awaiting behavior: pre-await hook runs first, then the underlying work is awaited.
8. Rich/debug representation (retained in textual-js as a debug string, without Rich specifics).

## Key concepts
- The handle wraps one or more promises and resolves when all of them settle.
- Returning the handle lets the caller decide between sequential and fire-and-forget usage while preserving ordering guarantees.
- A `pre-await` hook lets the framework detect deadlocks before actually awaiting.
- The handle remembers where it was created (source location) for diagnostic messages.

## Behaviors and contracts
- If the caller ignores the handle, textual-js must still await the underlying work before dispatching the next message on the owning pump.
- The handle resolves once all wrapped awaitables have settled; errors from any of them must be observable via the error property.
- Creating an already-completed handle must be zero-cost and must allow immediate await.
- The pre-await hook runs exactly once per await, synchronously, before the underlying wait begins.

## Example requirements
All examples must be JSX/TypeScript using Ink primitives and textual-js APIs:
- Calling a framework method that returns an AwaitComplete handle, awaiting it explicitly, and acting on the result.
- The same call, with the handle ignored, showing that the next scheduled work still sees the completed state.
- Using the no-op factory from a custom method to satisfy a return-type contract when no background work is needed.
- Inspecting `isDone` and any captured error after the fact (e.g., for logging).

## Cross-references
- `spec/docs-spec/api_await_remove.md` (sibling handle for removals).
- `spec/docs-spec/api_app.md` (mount returns an AwaitComplete-style handle).
- `spec/spec-src/03-message-event-and-dispatch.md` (message-pump ordering around background work).

## Notes for writers
- Drop Python-specific terminology: `asyncio.Future`, `asyncio.gather`, coroutine, `__await__`, `__call__`, `@rich.repr.auto`. Describe the equivalent JS contract: the handle is a `PromiseLike<T>` (has a `.then` / can be `await`ed), and internally it tracks an array of promises via `Promise.all`.
- Python's `__call__` alias (invoking the handle as if calling it, equivalent to awaiting it) does not have a clean JS analog; either omit it or present the handle as a thenable only.
- Keep the "pre-await hook" concept — it is a framework diagnostic and carries over.
- Avoid referencing `get_caller_file_and_line`; describe the diagnostic capture generically ("the creation site is captured for debugging").
- Do not reference Rich's repr; textual-js has its own debug string behavior.
