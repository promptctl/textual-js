# textual.worker

The `textual.worker` module contains the `Worker` class and related types for managing concurrent work in Textual applications.

## Module-Level

### `active_worker`

A `ContextVar[Worker]` that holds the currently active worker for the running task or thread.

### `get_current_worker() -> Worker`

Returns the `Worker` instance for the currently executing worker context.

- Raises `NoActiveWorker` if called outside a worker (i.e., no active worker in the current task or thread).

### `WorkType` (TypeAlias)

```python
WorkType = Union[
    Callable[[], Coroutine[None, None, ResultType]],
    Callable[[], ResultType],
    Awaitable[ResultType],
]
```

The union of callable types accepted by workers: a coroutine function, a regular callable, or an awaitable.

## `WorkerState` Enum

Describes the worker's current lifecycle state. Values:

| Value | Int | Description |
|---|---|---|
| `PENDING` | 1 | Initialized but not yet running. |
| `RUNNING` | 2 | Currently executing. |
| `CANCELLED` | 3 | Not running; was cancelled. |
| `ERROR` | 4 | Not running; exited with an error. |
| `SUCCESS` | 5 | Not running; completed successfully. |

## `Worker` Class

```python
class Worker(Generic[ResultType])
```

A class to manage concurrent work, either as an async task or an OS thread. Generic over the return type of the work.

### Constructor

```python
Worker(
    node: DOMNode,
    work: WorkType,
    *,
    name: str = "",
    group: str = "default",
    description: str = "",
    exit_on_error: bool = True,
    thread: bool = False,
)
```

| Parameter | Description |
|---|---|
| `node` | The widget, screen, or App that initiated the work. |
| `work` | A callable, coroutine, or other awaitable object to run. |
| `name` | Short identifier for logs and debugging. |
| `group` | The worker group name (used for exclusive cancellation). |
| `description` | Longer description for debugging. Truncated to 1000 characters. |
| `exit_on_error` | If `True`, exit the app on unhandled exception. If `False`, suppress exceptions. |
| `thread` | If `True`, run as a thread worker instead of an async task. |

On construction, a `Worker.StateChanged` message is posted to the node with the initial state (`PENDING`).

### Properties

| Property | Type | Description |
|---|---|---|
| `node` | `DOMNode` | The node where this worker was run from. Read-only. |
| `state` | `WorkerState` | The current state. Setting this posts a `StateChanged` message if the value changes. |
| `is_cancelled` | `bool` | Whether the work has been cancelled. Note: cancelled work may still be running. |
| `is_running` | `bool` | Whether the state is `RUNNING`. |
| `is_finished` | `bool` | Whether the state is `CANCELLED`, `ERROR`, or `SUCCESS`. |
| `completed_steps` | `int` | The number of completed progress steps. |
| `total_steps` | `int \| None` | The total number of steps, or `None` if indeterminate. |
| `progress` | `float` | Progress as a percentage (0.0--100.0). Returns 0.0 if `total_steps` is `None`. Clamped to [0, 100]. |
| `result` | `ResultType \| None` | The return value of the work, or `None` if not yet available. |
| `error` | `BaseException \| None` | The exception raised by the worker, or `None` if no error. |

### Attributes

| Attribute | Type | Description |
|---|---|---|
| `name` | `str` | Short identifier for logs/debugging. |
| `group` | `str` | The worker group name. |
| `description` | `str` | Longer description for debugging. |
| `exit_on_error` | `bool` | Whether to exit the app on error. |
| `cancelled_event` | `threading.Event` | A threading event that is set when the worker is cancelled. Useful for thread workers. |

### Methods

#### `update(completed_steps=None, total_steps=-1) -> None`

Update progress tracking.

| Parameter | Type | Description |
|---|---|---|
| `completed_steps` | `int \| None` | Number of steps to add to completed count. `None` to leave unchanged. |
| `total_steps` | `int \| None` | Total number of steps. `None` for indeterminate. `-1` to leave unchanged. |

#### `advance(steps=1) -> None`

Increment the number of completed steps.

| Parameter | Type | Description |
|---|---|---|
| `steps` | `int` | Number of steps to advance. Default: 1. |

#### `cancel() -> None`

Cancel the worker. Cancels the underlying `asyncio.Task` (if any) and sets `cancelled_event`.

#### `await run() -> ResultType`

Run the work. This is the method that executes the work callable. It dispatches to either `_run_threaded` or `_run_async` based on the `thread` flag. Can be overridden in subclasses.

#### `await wait() -> ResultType`

Wait for the work to complete and return the result.

- Raises `WorkerFailed` if the worker ended in `ERROR` state.
- Raises `WorkerCancelled` if the worker was cancelled.
- Raises `DeadlockError` if called from within the worker's own function.
- Raises `WorkerError` if the worker has not been started (still `PENDING`).

### Messages

#### `Worker.StateChanged`

```python
class StateChanged(Message, bubble=False, namespace="worker")
```

Posted when the worker state changes. Does not bubble. Uses the `worker` namespace, so the handler name is `on_worker_state_changed`.

| Attribute | Type | Description |
|---|---|---|
| `worker` | `Worker` | The worker instance. |
| `state` | `WorkerState` | The new state. |

## Exceptions

| Exception | Inherits | Description |
|---|---|---|
| `NoActiveWorker` | `Exception` | Raised by `get_current_worker()` when called outside a worker context. |
| `WorkerError` | `Exception` | Base class for worker-related errors. |
| `WorkerFailed` | `WorkerError` | The worker raised an exception and did not complete. Has an `error` attribute holding the original `BaseException`. |
| `DeadlockError` | `WorkerError` | The operation would result in a deadlock (e.g., calling `wait()` from within the worker). |
| `WorkerCancelled` | `WorkerError` | The worker was cancelled and did not complete. |
