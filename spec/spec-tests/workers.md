# Workers

Textual provides a worker system for running background tasks (async coroutines or threaded functions) without blocking the UI. Workers are tracked by a worker manager, emit state-change events as they progress through their lifecycle, and can be cancelled or grouped for coordination.

## Creating Workers

### `Worker` Class

A `Worker` wraps a callable (regular function, coroutine function, or coroutine object) and runs it in the background. It is constructed with a reference to the app or widget that owns it, the callable, and optional metadata:

```python
worker = Worker(app, my_func, name="foo", group="foo-group", description="Foo test")
```

The constructor accepts `thread=True` to run the work in a thread instead of as an async task. A worker that has not been started is in the `PENDING` state, with `is_cancelled=False`, `is_running=False`, `is_finished=False`, `result=None`, `completed_steps=0`, `total_steps=None`, and `progress=0.0`.

### `run_worker`

Widgets and the App expose `run_worker(callable, ...)` to create and optionally start a worker in one call. Passing `start=False` creates the worker in `PENDING` state without starting it. The worker is automatically added to the app's worker manager.

```python
worker = self.run_worker(self.work, start=False)
worker = self.run_worker(self.work, thread=True)
```

### Input Types

Workers accept several kinds of callables:

- A regular (sync) function, when `thread=True`.
- An async coroutine function.
- An already-created coroutine object.
- Any of the above can be run in a thread by passing `thread=True`.

## The `@work` Decorator

### Basic Usage

The `@work` decorator turns a method into one that launches a worker each time it is called. It can decorate async methods directly:

```python
@work
async def do_something(self) -> str:
    await asyncio.sleep(0.1)
    return "done"
```

### Thread Workers via Decorator

Pass `thread=True` to run the decorated method in a thread. This works for both sync and async methods:

```python
@work(thread=True)
def sync_work(self) -> str:
    time.sleep(0.1)
    return "result"

@work(thread=True)
async def async_thread_work(self) -> str:
    await asyncio.sleep(0.1)
    return "result"
```

### Declaration Errors

Decorating a non-async method without `thread=True` raises `WorkerDeclarationError` at class definition time. A sync function must be explicitly declared as a thread worker:

- `@work` on a sync method raises `WorkerDeclarationError`.
- `@work(thread=False)` on a sync method raises `WorkerDeclarationError`.

### Exclusive Workers

The `@work` decorator accepts `exclusive=True`. When an exclusive worker is launched, any previously running worker from the same decorated method is cancelled before the new one starts. This is useful for operations where only the most recent invocation matters.

```python
@work(exclusive=True)
async def action_info(self) -> None:
    await self.push_screen_wait(InfoScreen("details"))
```

### Nested Workers

Workers can launch other workers from within their execution. All combinations of worker types (async, async-thread, sync-thread) can nest arbitrarily. Each nested worker completes independently, and `wait_for_complete()` may need to be called multiple times to drain a chain of nested workers.

## Worker Lifecycle

### States

A worker progresses through `WorkerState` values. The normal success path is:

1. `PENDING` -- created but not yet running.
2. `RUNNING` -- actively executing.
3. `SUCCESS` -- completed without error.

These states are emitted as `Worker.StateChanged` events, which carry both the new `state` and a reference to the `worker`. The event's `worker.node` refers to the widget or app that owns the worker.

### Waiting for Results

`await worker.wait()` blocks until the worker finishes and returns its result. Calling `wait()` on a worker that was never started raises `WorkerError`.

### Progress Tracking

Workers support progress reporting via `update()` and `advance()`:

```python
worker.update(total_steps=100)
worker.advance(50)       # progress is now 50
worker.update(completed_steps=23)  # progress is now 73
```

### Error State

If the worker's callable raises an exception, `await worker.wait()` raises `WorkerFailed`. The worker transitions through `PENDING -> RUNNING` and then to an error state.

### Cancelled State

Calling `worker.cancel()` marks the worker as cancelled. After cancellation, `worker.is_cancelled` is `True` and `await worker.wait()` raises `WorkerCancelled`. A worker can be cancelled immediately after starting, even before it has had a chance to run.

### Deadlock Detection

If a worker attempts to wait on itself (via `get_current_worker().wait()`), a `DeadlockError` is raised (wrapped in `WorkerFailed`).

### Double Start

Starting a worker that has already been started is a no-op. The worker continues its original execution and returns the same result.

## `get_current_worker`

From inside a running worker, `get_current_worker()` returns the `Worker` instance for the currently executing task. Calling it outside of any worker raises `NoActiveWorker`.

## Worker Manager

### Initialization

Every `App` instance has a `workers` attribute (the worker manager). When empty, it is falsy and has length zero. It supports `len()`, iteration, `reversed()`, and `repr()`.

### Managing Workers

- Workers created via `run_worker` are automatically added to the manager.
- `app.workers.start_all()` starts all pending workers.
- `await app.workers.wait_for_complete()` waits for all tracked workers to finish. Completed workers are removed from the manager (length returns to zero).
- Workers can be checked for membership with `in`.

## Thread vs Async Workers

| Variant | Declaration | Execution |
|---|---|---|
| Async worker | `async def` method, no `thread` flag | Runs as a coroutine on the event loop |
| Async thread worker | `async def` method with `thread=True` | Runs the coroutine in a separate thread |
| Sync thread worker | Regular `def` method with `thread=True` | Runs the function in a separate thread |
| Sync without thread | Regular `def` method, no `thread` flag | **Not allowed** -- raises `WorkerDeclarationError` |

A sync function must always specify `thread=True` because running a blocking function on the event loop would freeze the UI.

## Constraints

- A non-async method decorated with `@work` (or `@work(thread=False)`) raises `WorkerDeclarationError` at class definition time.
- Calling `get_current_worker()` outside of a running worker raises `NoActiveWorker`.
- Calling `await worker.wait()` on a worker that was never started raises `WorkerError`.
- A worker that waits on itself raises `DeadlockError` (surfaced as `WorkerFailed`).
- A worker that raises an exception causes `await worker.wait()` to raise `WorkerFailed`.
- A cancelled worker causes `await worker.wait()` to raise `WorkerCancelled`.
- Workers transition through `PENDING -> RUNNING -> SUCCESS` on the happy path; `Worker.StateChanged` events are emitted for each transition.
- The worker manager removes completed workers after `wait_for_complete()`.
- Exclusive workers cancel any previously running worker from the same decorated method.
