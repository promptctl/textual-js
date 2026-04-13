# Workers, Timers, and Signals

## Worker Model

`textual.worker.Worker` encapsulates background execution for app/screen/widget initiated tasks. Every worker is owned by a `DOMNode` (widget, screen, or app) and is tracked by that app's `WorkerManager`.

### Work forms

`WorkType` accepts three shapes of work:

- an async callable returning a coroutine,
- a plain sync callable,
- an already-constructed awaitable.

A worker is either an async worker (runs inside the app event loop) or a thread worker (runs in the default executor), selected by the `thread` flag. Thread workers accept sync callables, coroutine functions, or awaitables; async workers reject plain sync callables with `WorkerError`. Thread workers that execute coroutine/awaitable work do so via `asyncio.run` inside the executor thread, so they get their own loop.

The currently running worker is exposed through the `active_worker` `ContextVar`; `get_current_worker()` returns it or raises `NoActiveWorker`. Thread workers set this ContextVar inside the worker thread before invoking user code.

### Lifecycle and state

`WorkerState` values: `PENDING`, `RUNNING`, `CANCELLED`, `ERROR`, `SUCCESS`. Workers are constructed in `PENDING`, transition to `RUNNING` when `_start` schedules the task, and end in exactly one of `CANCELLED` / `ERROR` / `SUCCESS`. Every state write (including the initial `PENDING` post at construction) sends a `Worker.StateChanged` message to the owning node (`bubble=False`, namespace `"worker"`); transitions to the same state are suppressed so duplicate messages are not posted.

Runtime surface:

- `is_cancelled` / `is_running` / `is_finished` flags,
- progress bookkeeping: `completed_steps`, `total_steps` (may be `None` for indeterminate), `progress` (0-100, clamped), plus `update(...)` and `advance(...)`,
- `result` (populated only on `SUCCESS`), `error` (populated on `ERROR` or `CANCELLED`; holds the `CancelledError` in the cancellation case),
- `name`, `group`, `description` (truncated to 1000 chars), `node`.

`_run` is the single place that drives state: it enters the app context, sets `active_worker`, transitions to `RUNNING`, awaits `run()`, and maps the outcome to the terminal state. `asyncio.CancelledError` maps to `CANCELLED`; any other `Exception` maps to `ERROR`, is logged with a traceback, and — only if `exit_on_error` is true — is wrapped in `WorkerFailed` and handed to `app._handle_exception`. When `exit_on_error` is false, errors are captured on the worker and the app keeps running.

### Cancellation and completion

- `cancel()` sets `_cancelled`, cancels the underlying `asyncio.Task` if started, and sets `cancelled_event` (a `threading.Event`) so thread workers can poll for cancellation.
- `wait()` awaits the task, then raises `WorkerFailed(error)` if the worker ended in `ERROR` or `WorkerCancelled` if it ended in `CANCELLED`; otherwise returns the result. Calling `wait()` before the worker has been started raises `WorkerError`. Calling `wait()` from inside the same worker raises `DeadlockError`.
- `WorkerError` is the base class; `WorkerFailed`, `WorkerCancelled`, `DeadlockError`, and `NoActiveWorker` are the concrete errors exposed by this module.

## Worker Manager

`textual.worker_manager.WorkerManager` owns the set of live workers for an app and is reached via `App.workers` or `DOMNode.workers`.

Behavior:

- `add_worker(worker, start=True, exclusive=True)` registers a worker; when `exclusive` is true and the worker has a group, all existing workers in that same group on the same node are cancelled first. When `start` is true the worker is started immediately and the manager registers its own `_remove_worker` as the done callback so finished workers drop out of the set.
- `_new_worker(...)` (the entry point used by `DOMNode.run_worker`) constructs the `Worker` and forwards to `add_worker`. Its `exclusive` default is `False`, so exclusivity is opt-in at the call site even though `add_worker`'s own default is `True`.
- `cancel_all()` cancels every tracked worker.
- `cancel_group(node, group)` cancels workers matching both node and group and returns them.
- `cancel_node(node)` cancels every worker owned by a given node and returns them.
- `start_all()` starts any workers that were added with `start=False`.
- `wait_for_complete(workers=None)` awaits the given workers (or all tracked workers) via `asyncio.gather` and swallows `asyncio.CancelledError` from the gather itself, so cancellation of the waiter does not propagate out.
- Iteration order is deterministic: workers are yielded sorted by creation time (`__iter__` ascending, `__reversed__` descending).

`DOMNode.run_worker(...)` is the thread-safe entry point: when called off the event-loop thread it marshals worker creation back onto it via `call_from_thread`.

// [LAW:single-enforcer] Worker lifecycle ownership, exclusivity, and cancellation policy are centralized in `WorkerManager` and `Worker._run`; callsites never poke worker state directly.

### `@work` decorator

`textual.\_work_decorator.work` wraps a `DOMNode` method so invoking it calls `self.run_worker(partial(method, *args, **kwargs), ...)` and returns the resulting `Worker`. Options mirror the worker constructor (`name`, `group`, `exit_on_error`, `exclusive`, `description`, `thread`). Non-async methods must set `thread=True`; otherwise the decorator raises `WorkerDeclarationError` at decoration time. When `description` is not supplied it is synthesized from the method name and call arguments. The default `name` falls back to the method's `__name__`.

## Timer Model

`textual.timer.Timer` schedules repeated or one-shot tick actions against a `MessageTarget`. Timers are created via `MessagePump.set_timer` (one-shot) and `set_interval` (repeating).

Behavior:

- The target is held as a `weakref`; once it is collected the timer raises `EventTargetGone` internally and the loop exits cleanly.
- The scheduler uses a monotonic clock (`textual._time.get_time()`). Each tick's deadline is computed as `start + (count + 1) * interval`, so ticks are anchored to the original start time and do not drift from accumulated `sleep` error.
- `skip=True` (the default) collapses missed ticks: if the next scheduled time has already passed the counter jumps forward to catch up and the missed ticks are not delivered. With `skip=False` every tick is dispatched even when late.
- `pause()` / `resume()` toggle an internal `asyncio.Event` that each loop iteration waits on before dispatching; a paused timer continues to respect the scheduled grid when resumed. `reset()` sets the event and flags the loop to re-anchor `start` to the current time and restart counting from zero. A timer can be constructed in the paused state via `pause=True`.
- `stop()` cancels the backing task; `Timer._stop_all(timers)` cancels and awaits a batch.
- When the tick fires, the timer either invokes its `callback` via `_callback.invoke` or posts an `events.Timer` message to the target. Exceptions raised inside a callback are routed to `app._handle_exception`; `CancelledError` is re-raised so task cancellation is not swallowed. If the app is exiting (`app._exit`) the tick is a no-op.

## Signal Pub/Sub

`textual.signal.Signal[T]` is a DOM-scoped pub/sub primitive. A signal has a single owning `DOMNode` (held weakly) and a `WeakKeyDictionary` mapping subscriber nodes to lists of callbacks.

- `subscribe(node, callback, immediate=False)` requires `node.is_running`; otherwise it raises `SignalError`. When `immediate` is true the callback is invoked inline during `publish`; otherwise the callback is scheduled via `node.call_next`, deferring it until the node finishes processing its current messages. Multiple callbacks per subscriber node are supported and appended in order.
- `unsubscribe(node)` removes all callbacks for a given subscriber.
- `publish(data)` is a no-op when there are no subscriptions or when the owner has been collected. It additionally requires the owner to be attached and not pruning, and every ancestor (including the owner itself) to be running — otherwise publication is skipped so signals do not fire during teardown/setup. During iteration, subscribers that are no longer running/attached or are pruning are dropped from the subscription map. Exceptions raised by callbacks are caught and logged via `textual.log.error`; they do not abort publication to remaining subscribers and do not propagate to the publisher.

Weak references on both the owner and the subscriber map mean dead nodes fall out automatically; no explicit teardown is required for the common case.

## App-Level Signals

`App` exposes long-lived signals for cross-cutting state changes:

- `theme_changed_signal: Signal[Theme]` — published (via `call_next`) when the app theme changes.
- `app_suspend_signal: Signal[App]` — published when the app suspends (e.g. Ctrl+Z).
- `app_resume_signal: Signal[App]` — published when the app resumes after suspension.
- `mode_change_signal: Signal[str]` — published when the active mode changes.
- `screen_change_signal: Signal[Screen]` — published on screen push/pop/switch and mode change, carrying the new active screen.

These let features observe global transitions without threading state through intermediate components.

// [LAW:one-source-of-truth] Worker/timer/signal state lives in its owning runtime object; observers see it only through posted `StateChanged` messages, `events.Timer` messages, or signal callbacks.
