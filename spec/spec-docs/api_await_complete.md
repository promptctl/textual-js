# AwaitComplete

## Overview

**Module:** `textual.await_complete`

`AwaitComplete` is an optionally-awaitable object returned by Textual methods that perform work in the background. It wraps one or more coroutines (or other awaitables) and runs them concurrently via `asyncio.gather`.

When a method returns an `AwaitComplete`, the caller has two choices:

1. **Await it** -- to block until the background work finishes.
2. **Ignore it** -- Textual will automatically await the work before processing the next message.

Users are unlikely to need to instantiate `AwaitComplete` directly; it is produced by framework internals.

---

## Class: `AwaitComplete`

Decorated with `@rich.repr.auto(angular=True)` for Rich-compatible display.

### Constructor

```python
AwaitComplete(*awaitables: Awaitable, pre_await: CallbackType | None = None)
```

| Parameter | Type | Description |
|---|---|---|
| `*awaitables` | `Awaitable` | One or more awaitables to execute concurrently. Internally gathered via `asyncio.gather`. |
| `pre_await` | `CallbackType \| None` | Optional callback invoked immediately before the object is awaited. Used internally by Textual (e.g. deadlock detection). Defaults to `None`. |

Internal state captured at construction:

- `_awaitables` -- the raw awaitable tuple.
- `_future` -- an `asyncio.Future` produced by `asyncio.gather(*awaitables)`.
- `_pre_await` -- the pre-await callback.
- `_caller` -- source file and line of the caller (via `get_caller_file_and_line`), for debugging.

---

### Properties

| Property | Type | Description |
|---|---|---|
| `is_done` | `bool` | `True` if the underlying future has completed. |
| `exception` | `BaseException \| None` | Returns the exception raised by the gathered awaitables, or `None` if not yet done or if no exception occurred. |

---

### Methods

#### `set_pre_await_callback(pre_await: CallbackType | None) -> None`

Sets (or clears) the callback invoked just before the object is awaited. Used internally by Textual for deadlock checking. Application code is unlikely to need this.

| Parameter | Type | Description |
|---|---|---|
| `pre_await` | `CallbackType \| None` | The callback to run before awaiting, or `None` to clear. |

#### `call_next(node: MessagePump) -> Self`

Schedules this object to be awaited after the current message has been processed. Delegates to `node.call_next(self)`.

| Parameter | Type | Description |
|---|---|---|
| `node` | `MessagePump` | The message pump (widget, screen, or app) that created this object. |

Returns `self` for chaining.

---

### Awaitable Protocol

`AwaitComplete` implements both `__await__` and `__call__`:

- **`__await__`** -- If a `pre_await` callback is set, it is invoked (synchronously) first. Then yields from the internal `Future.__await__`, blocking until all gathered awaitables complete.
- **`__call__`** -- Alias for `await self`. Allows the object to be used as an async callable.

---

### Class Methods

#### `AwaitComplete.nothing() -> AwaitComplete`

Factory that returns an already-completed `AwaitComplete` instance. The internal future is immediately resolved with `None`. Useful as a no-op return value when no background work is needed but the return type contract requires an `AwaitComplete`.

---

### Rich Representation

`__rich_repr__` yields:

1. The awaitables tuple (positional).
2. `pre_await` (omitted when `None`).
3. `caller` (omitted when `None`).
