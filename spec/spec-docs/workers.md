# Workers

Workers provide managed concurrency for Textual applications. Any operation that could block the event loop (network requests, subprocess communication, CPU-heavy computation) should run in a worker so the UI remains responsive.

## Concept

A worker wraps a callable, coroutine, or awaitable and runs it in the background as either an async task or an OS thread. Workers are created from any `DOMNode` (widget, screen, or app) and are automatically tied to that node's lifecycle -- removing the widget or popping the screen cancels its workers.

## Creating Workers

### `run_worker` Method

`DOMNode.run_worker` is the primary API for creating workers. It accepts a function, async function, or awaitable and returns a `Worker` object immediately (non-blocking).

```python
worker = self.run_worker(
    work,                    # callable, coroutine, or awaitable
    name="",                 # short identifier for logs/debugging
    group="default",         # group name for exclusive cancellation
    description="",          # longer description for debugging
    exit_on_error=True,      # exit app on unhandled exception
    start=True,              # start immediately
    exclusive=False,         # cancel existing workers in same group
    thread=False,            # run as thread instead of async task
)
```

### `@work` Decorator

The `@work` decorator converts a method into a worker factory. Calling the decorated method creates and starts a worker, returning a `Worker` object. The decorator accepts the same parameters as `run_worker`.

```python
@work(exclusive=True)
async def update_weather(self, city: str) -> str:
    ...
```

After decoration, calling `self.update_weather("Paris")` no longer requires `await` -- it creates a worker and returns immediately. The decorator auto-generates a `description` from the method name and arguments unless one is explicitly provided.

A non-async function decorated with `@work` **must** set `thread=True`. Omitting it raises `WorkerDeclarationError`.

## Async Workers vs Thread Workers

### Async Workers (default)

The work callable must be a coroutine function or awaitable. It runs on the main event loop as an `asyncio.Task`. Cancellation raises `asyncio.CancelledError` inside the coroutine.

### Thread Workers (`thread=True`)

The work callable may be a regular (synchronous) function. It runs in a separate OS thread via `loop.run_in_executor`.

Thread worker constraints:

- **Do not call UI methods or set reactive variables directly from the thread.** Use `app.call_from_thread()` to marshal calls back to the main thread.
- **Cancellation is cooperative.** Threads cannot be cancelled the way coroutines can. Use `get_current_worker()` to obtain the active `Worker` instance and check `worker.is_cancelled` or wait on `worker.cancelled_event` (a `threading.Event`).
- **`post_message` is thread-safe** and can be called directly from a thread worker without `call_from_thread`.
- For thread workers that need to make multiple UI updates, sending custom messages and handling them in message handlers is recommended over repeated `call_from_thread` calls.

## Worker Lifecycle

Workers transition through the `WorkerState` enumeration:

| State | Description |
|---|---|
| `PENDING` | Created but not yet started. |
| `RUNNING` | Currently executing. |
| `CANCELLED` | Cancelled before completion. |
| `ERROR` | Exited with an unhandled exception. |
| `SUCCESS` | Completed successfully. |

The valid transitions are: `PENDING` -> `RUNNING` -> one of `{CANCELLED, ERROR, SUCCESS}`.

### Return Values

- `worker.result` is `None` until the worker reaches `SUCCESS`, then holds the return value.
- `await worker.wait()` blocks until the worker completes and returns the result.
  - Raises `WorkerFailed` if the worker ended in `ERROR`.
  - Raises `WorkerCancelled` if the worker was cancelled.
  - Raises `DeadlockError` if called from within the worker's own function.
  - Raises `WorkerError` if the worker has not been started.

### Error Handling

- `exit_on_error=True` (default): an unhandled exception in the worker exits the app and displays the traceback.
- `exit_on_error=False`: the exception is captured in `worker.error` and the state moves to `ERROR`, but the app continues running.

### Cancellation

`worker.cancel()` cancels the worker. For async workers this cancels the underlying `asyncio.Task`, raising `CancelledError` in the coroutine. For thread workers it sets `worker.cancelled_event` (a `threading.Event`) and marks `worker.is_cancelled` as `True`, but the thread must check these cooperatively.

## Worker Events

Every state transition posts a `Worker.StateChanged` message to the node that owns the worker. The message has `bubble=False` and uses the `worker` namespace, so the handler is `on_worker_state_changed`.

```python
def on_worker_state_changed(self, event: Worker.StateChanged) -> None:
    # event.worker - the Worker instance
    # event.state  - the new WorkerState
    ...
```

## Exclusive Workers and Groups

Every worker belongs to a `group` (default: `"default"`). When `exclusive=True`, creating a new worker cancels all existing workers in the same group on the same node before starting. This prevents stale results from out-of-order completions -- for example, cancelling a previous network request when the user types a new character.

## Progress Tracking

Workers support progress reporting:

- `worker.update(completed_steps=N, total_steps=M)` -- increment completed steps and optionally set total.
- `worker.advance(steps=1)` -- shorthand to increment completed steps by a given amount.
- `worker.progress` -- returns percentage (0.0-100.0), or 0.0 if `total_steps` is `None` (indeterminate).
- `worker.completed_steps` -- number of completed steps.
- `worker.total_steps` -- total steps, or `None` for indeterminate.

## WorkerManager

`WorkerManager` is a container that tracks all workers for the app. Accessed via `app.workers` (or equivalently `widget.workers`, which delegates to the app).

### Container Protocol

- Iterable: yields workers sorted by creation time (oldest first).
- Reversible: yields workers sorted by creation time (newest first).
- Supports `len()`, `bool()`, and `in` membership testing.

### Methods

| Method | Description |
|---|---|
| `cancel_all()` | Cancel every managed worker. |
| `cancel_group(node, group)` | Cancel all workers in the given group on the given node. Returns list of cancelled workers. |
| `cancel_node(node)` | Cancel all workers associated with a DOM node. Returns list of cancelled workers. |
| `await wait_for_complete(workers=None)` | Wait for the given workers (or all workers) to finish. Swallows `CancelledError`. |

## Helper Function

`get_current_worker()` returns the `Worker` instance for the currently executing worker context. Raises `NoActiveWorker` if called outside a worker. This is primarily useful in thread workers to check cancellation status.

## Exceptions

| Exception | Description |
|---|---|
| `NoActiveWorker` | `get_current_worker()` called outside a worker context. |
| `WorkerError` | Base class for worker-related errors. |
| `WorkerFailed` | Worker raised an exception. Wraps the original in `.error`. |
| `WorkerCancelled` | Worker was cancelled before completion. |
| `DeadlockError` | `worker.wait()` called from within its own worker function. |
| `WorkerDeclarationError` | Non-async function decorated with `@work` without `thread=True`. |
