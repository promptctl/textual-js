# Workers, Timers, and Signals

## Overview

Three concurrency primitives support async and time-based behavior:

1. **Workers**: managed async tasks with lifecycle tracking and cancellation via `AbortController`.
2. **Timers**: named, pausable, drift-free repeating or one-shot scheduled actions.
3. **Signals**: typed pub/sub channels for cross-cutting state observation.

All three are owned by widgets and automatically cleaned up on unmount.

## Worker Model

A `Worker` encapsulates background execution for widget-initiated tasks. Every worker is owned by a widget and tracked by the app's `WorkerManager`.

### Creating workers

```tsx
const MyWidget = observer(() => {
  const { runWorker } = useTextual();

  const loadData = async (signal: AbortSignal) => {
    const response = await fetch('/api/data', { signal });
    return response.json();
  };

  useEffect(() => {
    const worker = runWorker(loadData, {
      name: 'load-data',
      group: 'data',
      exclusive: true,      // Cancel other workers in this group
      exitOnError: false,    // Don't crash the app on error
    });

    return () => worker.cancel(); // Cancel on unmount
  }, []);

  // ...
});
```

The `useWorker` hook provides a convenience wrapper:

```tsx
const { worker, start, cancel } = useWorker(loadData, {
  name: 'load-data',
  exclusive: true,
});
// worker.isRunning, worker.progress, worker.result, worker.error
```

### Lifecycle and state

```
PENDING ──► RUNNING ──┬──► SUCCESS (result populated)
                      ├──► ERROR (error populated)
                      └──► CANCELLED (via AbortController)
```

Workers are constructed in `PENDING`, transition to `RUNNING` when started, and end in exactly one terminal state. Every state transition posts a `Worker.StateChanged` message to the owning widget (non-bubbling). Transitions to the same state are suppressed — no duplicate messages.

### Worker interface

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `state` | `WorkerState` | Current lifecycle state |
| `isRunning` | `boolean` | Whether state is `RUNNING` |
| `isCancelled` | `boolean` | Whether state is `CANCELLED` |
| `isFinished` | `boolean` | Whether state is `SUCCESS`, `ERROR`, or `CANCELLED` |
| `result` | `T \| undefined` | Return value (only on `SUCCESS`) |
| `error` | `Error \| undefined` | Error (on `ERROR` or `CANCELLED`) |
| `name` | `string` | Worker name |
| `group` | `string \| undefined` | Group for exclusive cancellation |
| `description` | `string \| Content` | Human-readable description |
| `node` | `Widget` | Owning widget |
| `progress` | `number` | 0–100, clamped |
| `completedSteps` | `number` | Steps completed so far |
| `totalSteps` | `number \| null` | Total steps (`null` for indeterminate) |
| `cancel()` | `void` | Abort via `AbortController.abort()` |
| `wait()` | `Promise<T>` | Await result. Throws `WorkerFailed` on ERROR, `WorkerCancelled` on CANCELLED. Throws `WorkerError` if called before start. |
| `update(completed, total?)` | `void` | Update progress |
| `advance(steps?)` | `void` | Increment `completedSteps` by `steps` (default 1) |

Worker descriptions may use markup or pre-built `Content` when displayed in rich contexts such as devtools or command palettes. Contexts that do not support styling flatten the description to plain text.

### Cancellation

- `cancel()` sets cancelled state and calls `AbortController.abort()`.
- The async function receives the `AbortSignal` as a parameter and should check `signal.aborted` or pass it to fetch/other abort-aware APIs.
- `AbortError` from the signal maps to `CANCELLED` state, not `ERROR`.

### Error handling

- When `exitOnError: true` (default), unhandled errors in the worker are forwarded to the app's error handler (which may exit the app).
- When `exitOnError: false`, the error is captured on the worker (`worker.error`) and the app keeps running. The `Worker.StateChanged` message notifies the widget.

### Error types

| Error | When |
|-------|------|
| `WorkerError` | Base error class for worker issues |
| `WorkerFailed` | `wait()` on a worker that ended in `ERROR` |
| `WorkerCancelled` | `wait()` on a worker that ended in `CANCELLED` |

## Worker Manager

`WorkerManager` owns the set of live workers for the app. It is a MobX store on the app context.

| Method | Description |
|--------|-------------|
| `addWorker(worker, start?, exclusive?)` | Register a worker. `exclusive: true` with a group cancels existing workers in that group on the same widget first. `start: true` starts immediately. |
| `cancelAll()` | Cancel every tracked worker |
| `cancelGroup(node, group)` | Cancel workers matching both widget and group |
| `cancelNode(node)` | Cancel every worker owned by a widget |
| `waitForComplete(workers?)` | Await the given workers (or all tracked workers) |

- Iteration order is deterministic: workers are yielded sorted by creation time.
- Finished workers are automatically removed from the set.
- Widget unmount automatically cancels all workers owned by that widget (via `useEffect` cleanup).

// [LAW:single-enforcer] Worker lifecycle ownership, exclusivity, and cancellation policy are centralized in WorkerManager and Worker.run. No callsite pokes worker state directly.

## Timer Model

Timers schedule repeated or one-shot actions against a widget.

**Known divergence — units**: all timer durations are in milliseconds (upstream uses seconds). This conforms to JS ecosystem conventions where `setTimeout`/`setInterval` universally use ms.

**Known divergence — API shape**: upstream returns `Timer` objects with `.pause()`/`.resume()` instance methods. textual-js uses a name-based API (`setTimer`/`setInterval`/`clearTimer`/`pauseTimer`/`resumeTimer`) exposed via `useTextual()`, with name-based replacement semantics (setting a timer with an existing name cancels the previous one). This is a deliberate API redesign for the hook-based React model, not a 1:1 port.

### Creating timers

```tsx
const { setTimer, setInterval, clearTimer, pauseTimer, resumeTimer } = useTextual();

// One-shot timer
setTimer('save-delay', 2000, () => {
  performAutoSave();
});

// Repeating timer
setInterval('poll', 5000, () => {
  checkForUpdates();
});

// Cancel, pause, resume
clearTimer('poll');
pauseTimer('poll');
resumeTimer('poll');
```

### Timer behavior

| Property | Description |
|----------|-------------|
| **Drift-free** | Each tick's deadline is computed relative to the original start time, not the previous tick. Ticks do not drift from accumulated delay. |
| **Skip mode** (default: `true`) | Collapses missed ticks: if the next scheduled time has already passed, the counter jumps forward. With `skip: false`, every tick is dispatched even when late. |
| **Named** | Timers are identified by name. Setting a timer with an existing name cancels the previous one. |
| **Pausable** | `pause()` / `resume()` toggle dispatch. A paused timer respects the scheduled grid when resumed. |
| **Resettable** | `reset()` re-anchors the start time and restarts counting from zero. |

### Timer execution

When a tick fires, the timer either:
- Invokes its callback directly, or
- Posts a `Timer` message to the owning widget (integrating with the message dispatch pipeline).

Exceptions raised inside a callback are routed to the app's error handler — they do not crash the widget or suppress future ticks.

Timer cleanup on widget unmount is automatic via `useEffect` cleanup.

### Timer interface

| Method | Description |
|--------|-------------|
| `setTimer(name, delay, callback)` | One-shot timer. Delay in ms. |
| `setInterval(name, interval, callback, options?)` | Repeating timer. Interval in ms. Options: `skip` (default true), `repeat` (number of ticks, default unlimited) |
| `clearTimer(name)` | Cancel a named timer |
| `pauseTimer(name)` | Pause a named timer |
| `resumeTimer(name)` | Resume a paused timer |
| `resetTimer(name)` | Reset timer to original start time |

## Signal Pub/Sub

`Signal<T>` is a typed pub/sub primitive. A signal has a single owning widget and a subscriber map.
Signal type parameters are unconstrained and frequently carry rich-js types. Examples in the framework include `theme_changed_signal: Signal<Theme>` (where `Theme` contains rich-js `Color` values), `notification_added_signal: Signal<Notification>` (where `Notification` may contain `Content`), and `workers_changed_signal: Signal<Worker[]>`.

### Creating and using signals

```tsx
// Define a signal (typically on a store or app context)
const dataLoaded = new Signal<DataPayload>(ownerWidget);

// Subscribe (from another widget)
useEffect(() => {
  const unsub = dataLoaded.subscribe(myWidget, (data) => {
    handleNewData(data);
  });
  return unsub;
}, []);

// Publish
dataLoaded.publish({ items: [...] });
```

### Subscribe behavior

| Parameter | Description |
|-----------|-------------|
| `node` | The subscribing widget. Must be mounted; otherwise throws `SignalError`. |
| `callback` | Called when the signal publishes. |
| `immediate` | If `true`, callback is invoked inline during `publish`. If `false` (default), deferred until the node finishes processing its current messages. |

- `subscribe()` returns an unsubscribe callback. This is the **primary cleanup contract** — callers return it from `useEffect` cleanup (as shown above) or call it directly when done. This matches standard JS/React resource-cleanup patterns.
- **Behavioral invariant**: each `subscribe()` call returns a handle that removes *only that subscription*. Calling it has no effect on other subscriptions from the same node. Multiple callbacks per subscriber are supported and invoked in registration order.
- `unsubscribe(node)` is a **secondary bulk-removal API** that removes *all* callbacks for a given subscriber at once. Use it for owner-scoped teardown (e.g., removing all subscriptions for a widget being unmounted). It is not the primary subscription cleanup mechanism.

// [LAW:one-source-of-truth] The primary subscription cleanup shape is the returned unsubscribe callback. `unsubscribe(node)` exists as a bulk-removal convenience, not a co-equal alternative.

### Publish behavior

`publish(data)` notifies all subscribers:

- No-op when there are no subscriptions or when the owner has been unmounted.
- Publication is skipped during teardown/setup so signals do not fire at unsafe times.
- Subscribers that are no longer mounted are dropped from the subscription map during iteration.
- Exceptions raised by callbacks are caught and logged — they do not abort publication to remaining subscribers and do not propagate to the publisher.

### Automatic cleanup

Weak references (or `FinalizationRegistry`) on subscribers mean unmounted widgets fall out automatically. No explicit teardown is required for the common case, though `unsubscribe` is available for early cleanup.

### Signals vs MobX reactions

Signals and MobX reactions serve different purposes:

| Concern | Use MobX `reaction()` | Use `Signal` |
|---------|----------------------|--------------|
| Derived state | ✓ Computed values, auto-updating UI | |
| One-to-many broadcast | | ✓ Event notification to multiple subscribers |
| Cross-cutting lifecycle events | | ✓ Theme change, mode change, suspend/resume |
| Widget-local state changes | ✓ Observable → observer re-render | |
| Decoupled communication | | ✓ Publisher doesn't know subscribers |

## App-Level Signals

App exposes long-lived signals for cross-cutting state changes. These are available via the app context:

| Signal | Type parameter | Published when |
|--------|---------------|----------------|
| `theme_changed_signal` | `Theme` | App theme changes |
| `app_suspend_signal` | `void` | App suspends (terminal returns to normal mode) |
| `app_resume_signal` | `void` | App resumes after suspension |
| `mode_change_signal` | `string` | Active mode changes (carries new mode name) |
| `screen_change_signal` | `Screen` | Screen push/pop/switch or mode change (carries new active screen) |

These let features observe global transitions without threading state through intermediate components or prop-drilling.

```tsx
// Subscribe to theme changes from any widget
const { signals } = useTextual();

useEffect(() => {
  return signals.theme_changed_signal.subscribe(myWidget, (theme) => {
    console.log(`Theme changed to: ${theme.name}`);
  });
}, []);
```

// [LAW:one-source-of-truth] Worker/timer/signal state lives in its owning runtime object; observers see it only through posted StateChanged messages, Timer messages, or signal callbacks. No secondary state store exists.
