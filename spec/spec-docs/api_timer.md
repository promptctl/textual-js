# Timer

The `textual.timer` module provides the `Timer` class for sending timer-based events at regular intervals. Timer objects are created by `MessagePump.set_interval()` or `MessagePump.set_timer()` and are not typically constructed directly.

## Exception Classes

| Exception | Base | Description |
|---|---|---|
| `EventTargetGone` | `Exception` | Raised if the timer's event target has been garbage collected before the timer event could be sent |

## Type Aliases

| Name | Definition | Description |
|---|---|---|
| `TimerCallback` | `Union[Callable[[], Awaitable[Any]], Callable[[], Any]]` | A sync or async zero-argument callback for timer events |

## Timer

A class that fires timer events or invokes callbacks at regular intervals.

```python
# Typically created via set_interval or set_timer:
timer = self.set_interval(1.0, self.on_tick)
timer = self.set_timer(5.0, self.on_timeout)
```

### Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `event_target` | `MessageTarget` | required | The object which will receive timer events (stored as weak reference) |
| `interval` | `float` | required | Time between timer events, in seconds |
| `name` | `str \| None` | `None` | A name for the timer (for debugging). Auto-generated as `Timer#N` if not provided |
| `callback` | `TimerCallback \| None` | `None` | Optional callback to invoke on each tick. If `None`, a `Timer` event is posted to the target instead |
| `repeat` | `int \| None` | `None` | Number of times to repeat, or `None` to repeat forever |
| `skip` | `bool` | `True` | Skip scheduled events that could not be sent in time (prevents event pile-up) |
| `pause` | `bool` | `False` | Start the timer in a paused state |

### Properties

| Property | Type | Description |
|---|---|---|
| `target` | `MessageTarget` | The event target. Raises `EventTargetGone` if the target has been garbage collected |
| `name` | `str` | The timer's name |

### Methods

#### stop()

Stop the timer. The timer's internal task is cancelled and no further events or callbacks will fire. Safe to call multiple times or if the timer was never started.

#### pause()

Pause the timer. A paused timer does not fire events until resumed. Does not reset the timer's internal clock.

#### resume()

Resume a paused timer. Events resume from where the timer left off.

#### reset()

Reset the timer so it starts counting from the beginning. Also resumes the timer if it was paused.

### Tick Behavior

On each tick, the timer either:

1. **Invokes the callback** if one was provided. Exceptions from the callback are forwarded to the app's exception handler.
2. **Posts a `Timer` event** to the target if no callback was provided. The event includes:
   - `timer`: The `Timer` instance
   - `time`: The scheduled time of the tick
   - `count`: The tick count
   - `callback`: The callback (always `None` in this path)

### Skip Behavior

When `skip=True` (default), if the timer falls behind (the next scheduled time is already in the past), it advances the count to catch up rather than firing multiple events. This prevents event pile-up when the event loop is busy.

### Internal Lifecycle

- `_start()`: Creates an asyncio task to run the timer loop.
- `_stop_all(timers)`: Class method to stop and await completion of multiple timers concurrently.
- The timer respects `app._exit` and will not fire during app shutdown.
- The timer loop exits if the event target has been garbage collected (`EventTargetGone`).
