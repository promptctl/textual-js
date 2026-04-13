# API: MessagePump

API specification for the `textual.message_pump` module.

## Module Exports

### `Callback`

Type alias: `Callable[..., Any] | Callable[..., Awaitable[Any]]`. Union of sync and async callbacks.

### Exceptions

| Exception | Description |
|---|---|
| `CallbackError` | Raised when a timer callback fails to execute. |
| `MessagePumpClosed` | Raised when attempting to get a message from a closed pump. |

## `MessagePump` Class

```python
class MessagePump(metaclass=_MessagePumpMeta):
```

Base class for any object that processes messages. `Widget`, `Screen`, and `App` all inherit from `MessagePump`. Uses `_MessagePumpMeta` metaclass to populate decorated message handlers and detect compute method conflicts.

### Construction

```python
MessagePump(parent: MessagePump | None = None)
```

| Parameter | Description |
|---|---|
| `parent` | Parent message pump, or `None` for root nodes. Stored as a weak reference. |

### Properties

| Property | Type | Description |
|---|---|---|
| `app` | `App` | The current app. Walks the parent chain to find it. Raises `NoActiveAppError` if none found. |
| `has_parent` | `bool` | Whether this object has a parent. |
| `is_dom_root` | `bool` | Whether this is the root node (the App). Always `False` on base class. |
| `is_attached` | `bool` | Whether this node is linked to the app through the DOM. |
| `is_parent_active` | `bool` | Whether the parent is active (not closed or closing). |
| `is_running` | `bool` | Whether the message pump is running (processing messages). |
| `log` | `Logger` | Logger for this object. |
| `message_queue_size` | `int` | Current number of messages in the queue. |

### Signals

| Signal | Description |
|---|---|
| `message_signal` | Published for every message dispatched to this pump. Low-level; should not replace regular message handling. |

### Message Posting

#### `post_message(message)`

Post a message to this pump's queue. Thread-safe: automatically uses `call_soon_threadsafe` when called from a different thread.

| Parameter | Type | Description |
|---|---|---|
| `message` | `Message` | A message (including events). |

Returns `True` if the message was queued, `False` if the pump is closed/closing or the message type is disabled.

Raises `RuntimeError` if the message is missing expected attributes (common when `super().__init__()` was not called).

### Message Prevention

#### `prevent(*message_types)`

Context manager to temporarily prevent message types from being posted.

```python
input = self.query_one(Input)
with self.prevent(Input.Changed):
    input.value = "foo"
```

When no message types are given, this is a no-op.

### Message Enabling/Disabling

#### `disable_messages(*messages)`

Permanently disable message types from being processed by this pump.

#### `enable_messages(*messages)`

Re-enable previously disabled message types.

#### `check_message_enabled(message)`

Check if a message type is enabled. Returns `True` if it will be sent, `False` if disabled.

### Scheduling Callbacks

#### `set_timer(delay, callback=None, name=None, pause=False)`

Call a function after a delay.

```python
self.set_timer(3 * 60, ready)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `delay` | `float` | required | Seconds to wait. |
| `callback` | `TimerCallback \| None` | `None` | Callback to invoke. |
| `name` | `str \| None` | `None` | Timer name (for debug). |
| `pause` | `bool` | `False` | Start paused. |

Returns a `Timer` object.

#### `set_interval(interval, callback=None, name=None, repeat=0, pause=False)`

Call a function at periodic intervals.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `interval` | `float` | required | Seconds between calls. |
| `callback` | `TimerCallback \| None` | `None` | Callback to invoke. |
| `name` | `str \| None` | `None` | Timer name. |
| `repeat` | `int` | `0` | Number of repetitions, or `0` for continuous. |
| `pause` | `bool` | `False` | Start paused. |

Returns a `Timer` object.

#### `call_later(callback, *args, **kwargs)`

Schedule a callback after all messages in this object's queue are processed.

Returns `True` if scheduled, `False` if the pump is closed.

#### `call_next(callback, *args, **kwargs)`

Schedule a callback to run immediately after the current message is processed.

#### `call_after_refresh(callback, *args, **kwargs)`

Schedule a callback to run after all messages are processed and the screen has been refreshed. The callback is forwarded to the screen for deferred invocation.

Returns `True` if scheduled, `False` if the pump is closed.

#### `wait_for_refresh()`

Async method that waits for the next screen refresh. Must be called from a different task than the one running this widget. Returns `True` if waiting was successful, `False` if called from the same task (returns immediately to avoid deadlock).

### Event Processing

#### `on_event(event)`

Called to process an event. Delegates to `_on_message`. Override for custom event preprocessing.

### Message Dispatch

The message pump dispatches messages through the MRO, looking for:

1. Decorated handlers (via `@on` decorator) with optional CSS selector matching
2. Convention-based handlers (e.g., `on_button_pressed` or `_on_button_pressed`)

Decorated handlers take priority. Messages bubble up the DOM if `message.bubble` is `True` and propagation has not been stopped.

### Message Lifecycle

1. Messages are posted to the queue via `post_message()`
2. The message loop (`_process_messages_loop`) consumes messages
3. Adjacent messages that can replace each other are combined (via `message.can_replace`)
4. `_dispatch_message` routes to the appropriate handler
5. After dispatch, `message_signal` is published
6. When the queue is empty or `_max_idle` is exceeded, an `Idle` event is dispatched
7. Pending `call_next` callbacks are flushed after each message

### Compose and Mount Sequence

Before the message loop starts, these events are dispatched in order:

1. `Compose` event
2. `Mount` event (with any prevented message types from the mount context)

The `_mounted_event` asyncio Event is set after mount completes, enabling `AwaitMount` to resolve.

### Timer Callbacks

Timer callbacks are invoked via `on_timer`. If no screen exists when the timer fires, the callback is skipped with a warning.

### Metaclass Behavior

`_MessagePumpMeta` scans class dictionaries for:

- Methods decorated with `@on`, registering them in `_decorated_handlers`
- Conflicting compute methods (both `compute_X` and `_compute_X` for the same reactive), raising `TooManyComputesError`
