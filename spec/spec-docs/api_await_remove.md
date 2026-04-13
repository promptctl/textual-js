# AwaitRemove

## Overview

**Module:** `textual.await_remove`

`AwaitRemove` is an optionally-awaitable object returned by methods that remove widgets, such as `Widget.remove()`. It waits for the underlying removal tasks to complete and then optionally invokes a post-removal callback.

When a method returns an `AwaitRemove`, the caller has two choices:

1. **Await it** -- to block until the widget(s) have been fully removed from the DOM.
2. **Ignore it** -- Textual will wait for the removal to finish before handling the next message.

Users are unlikely to need to instantiate `AwaitRemove` directly; it is produced by framework internals.

---

## Class: `AwaitRemove`

Decorated with `@rich.repr.auto` for Rich-compatible display.

### Constructor

```python
AwaitRemove(tasks: list[Task], post_remove: CallbackType | None = None)
```

| Parameter | Type | Description |
|---|---|---|
| `tasks` | `list[Task]` | A list of `asyncio.Task` objects representing the in-progress removal operations. |
| `post_remove` | `CallbackType \| None` | Optional callback invoked after all removal tasks complete. Defaults to `None`. |

Internal state captured at construction:

- `_tasks` -- the task list.
- `_post_remove` -- the post-removal callback.
- `_caller` -- source file and line of the caller (via `get_caller_file_and_line`), for debugging.

---

### Awaitable Protocol

`AwaitRemove` implements both `__await__` and `__call__`:

- **`__await__`** -- Gathers all tasks except the current task (to avoid self-deadlock). After all tasks complete, if a `post_remove` callback was provided, it is invoked via `textual._callback.invoke`. This supports both sync and async callbacks.
- **`__call__`** -- Alias for `await self`. Allows the object to be used as an async callable.

The self-deadlock avoidance is important: if `AwaitRemove` is awaited from within one of the removal tasks themselves, that task is excluded from the gather to prevent a hang.

---

### Rich Representation

`__rich_repr__` yields:

1. `tasks` -- the task list.
2. `post_remove` -- the post-removal callback.
3. `caller` (omitted when `None`).
