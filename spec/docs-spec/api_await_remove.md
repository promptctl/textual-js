# Docs Spec: API — AwaitRemove

## Purpose
Describes the API reference doc for the optionally-awaitable handle returned by framework methods that remove widgets from the DOM.

## Audience
Application and widget authors who call remove methods and need to know when it is safe to mount replacements or inspect the tree afterwards.

## Required sections
1. Overview: what an AwaitRemove handle represents and why removal methods return one.
2. The "await or ignore" contract: awaiting blocks until the widget tree has finished the removal; ignoring is safe because textual-js completes the removal before the next message is processed.
3. The construction surface (for internal use): a list of in-progress removal tasks plus an optional post-removal callback.
4. Awaiting behavior: all pending removal tasks must settle, then the optional post-removal callback fires.
5. Self-deadlock avoidance: if the handle is awaited from within one of the tasks it wraps, that task is excluded from the wait.
6. Debug-friendly representation (creation site captured for diagnostics).

## Key concepts
- Widget removal is asynchronous because children unmount, run their cleanup, and release resources before the parent's unmount completes.
- Returning an AwaitRemove handle lets callers sequence follow-up work (for example, mounting a replacement) against the completion of the removal.
- The optional post-removal callback runs once, after all tasks have completed, and supports both sync and async implementations.

## Behaviors and contracts
- If the caller ignores the handle, textual-js must still complete the removal before the next message is delivered.
- Awaiting from inside one of the removal tasks must not deadlock; the currently-running task is excluded from the aggregate wait.
- The post-removal callback is invoked exactly once, after all task promises settle, regardless of whether the caller awaited the handle explicitly.

## Example requirements
All examples must be JSX/TypeScript using Ink primitives and textual-js APIs:
- Removing a widget and awaiting the handle, then mounting a replacement.
- Removing a widget and ignoring the handle, showing that later scheduled work sees an empty slot.
- Passing a post-removal callback and observing it run once after all removals resolve.

## Cross-references
- `spec/docs-spec/api_await_complete.md` (sibling handle for general background work).
- `spec/docs-spec/api_app.md` (remove/mount flow).
- `spec/spec-src/02-dom-reactivity-and-query.md` (DOM lifecycle).

## Notes for writers
- Drop Python-specific terminology: `asyncio.Task`, `gather`, `__await__`, `__call__`, `@rich.repr.auto`. Translate to JS: the handle is a `PromiseLike<void>`, wrapping an array of cleanup promises via `Promise.all`; the post-removal callback is a `() => void | Promise<void>`.
- Python's `__call__` alias for awaiting has no clean JS analog; either omit it or present the handle purely as a thenable.
- The self-deadlock avoidance concept carries over — textual-js must document it, even though the implementation will use different primitives (for example, checking the currently running task via a context variable).
- Do not mention Rich repr internals; textual-js may have its own debug representation and that is out of scope for this page.
