# Events and Messages

## Message Base Class

`Message` (`textual.message`) is the base class for all messages, including events.

### Class Variables

- `bubble: ClassVar[bool] = True` -- If `True`, the message propagates to the parent after processing.
- `verbose: ClassVar[bool] = False` -- Verbose messages are excluded from the textual console unless `-v` is passed.
- `no_dispatch: ClassVar[bool] = False` -- If `True`, the message is not dispatched to handler code.
- `namespace: ClassVar[str] = ""` -- Namespace used to disambiguate handler names. Auto-derived from the enclosing class when a Message is defined as an inner class.
- `handler_name: ClassVar[str]` -- The auto-computed handler method name (e.g. `on_input_changed`).
- `ALLOW_SELECTOR_MATCH: ClassVar[set[str]]` -- Set of attribute names (beyond `control`) that the `@on` decorator may match against with CSS selectors. These attributes must be widgets.

### Instance Attributes

- `time: float` -- Timestamp when the message was created.

### Properties

- `control -> DOMNode | None` -- The widget associated with this message. Returns `None` by default; subclasses override to return the relevant widget.
- `is_forwarded -> bool` -- Whether the message has been forwarded.

### Key Methods

- `prevent_default(prevent=True)` -- Suppress default action(s). Prevents handlers in base classes from being called for this message.
- `stop(stop=True)` -- Stop bubbling propagation to the parent.
- `set_sender(sender)` -- Explicitly set the sender of the message. Normally the sender is set automatically from the active message pump context.
- `can_replace(message) -> bool` -- Check if another message may supersede this one. Returns `False` by default. Used for message coalescing (e.g. `Resize` replaces pending `Resize` messages).

### Subclass Configuration

Messages are configured via `__init_subclass__` keyword arguments:

```python
class MyMessage(Message, bubble=False, verbose=True, no_dispatch=False, namespace="custom"):
    ...
```

### Handler Name Derivation

The `handler_name` is computed automatically from the class hierarchy:

1. Start with `on_`.
2. If the message is defined as an inner class of a widget (e.g. `Input.Changed`), prepend the outer class name as namespace: `on_input_changed`.
3. CamelCase is converted to snake_case.
4. For deeply nested inner classes (e.g. `A.B.C.D`), only the last two parts are used: `on_c_d`.

You can check the handler name for any message class:

```python
>>> Input.Changed.handler_name
'on_input_changed'
```

## Event Base Class

`Event` (`textual.events`) extends `Message`. Events are messages reserved for use by Textual (sent in response to input and other state changes). Custom application messages should extend `Message` directly rather than `Event`.

## Message Queue

Every `App` and `Widget` has a message queue. Messages are placed on the queue and processed sequentially by an asyncio task. This guarantees ordered processing even when messages arrive faster than they are handled.

When the queue is empty and all pending callbacks have been flushed, the widget enters an idle state and receives an `Idle` pseudo-event.

### Message Coalescing

If a message's `can_replace()` returns `True` for the next pending message, the older message is discarded. This is used by `Resize` to coalesce multiple resize events into one.

## Event Bubbling

When a message has `bubble = True` (the default), after the widget's handlers finish, the message is re-posted to the widget's parent. This continues up the DOM tree until either:

- The `App` (root of the DOM) is reached.
- `stop()` is called on the message.
- The parent is the original sender (automatic stop to prevent infinite loops).

Input events (key, mouse) typically bubble. Lifecycle events (Mount, Resize, Focus, etc.) typically do not.

### Stopping Bubbling

Call `message.stop()` inside a handler to prevent the message from propagating further up the DOM.

### Preventing Default Behaviors

Textual automatically calls handlers defined in base classes (walking the MRO). You do not need to call `super()` in event handlers.

Call `message.prevent_default()` to stop Textual from calling handlers on base classes for the current message. This breaks the MRO walk.

## Message Handlers

### Naming Convention

Define a method named `on_<namespace>_<message_name>` where namespace and message name are the CamelCase class names converted to snake_case:

```python
def on_button_pressed(self, event: Button.Pressed) -> None:
    ...
```

### Handler Arguments

Handlers can be written with or without the message argument:

```python
# With message argument -- use when you need message data
def on_button_pressed(self, event: Button.Pressed) -> None:
    self.log(event.button)

# Without message argument -- use when you only need to know it happened
def on_button_pressed(self) -> None:
    self.app.bell()
```

### Async Handlers

Handlers may be `async`. Textual will `await` them. However, a widget cannot process the next message in its queue until the current handler returns. Long-running work should be offloaded to a background task via `asyncio.create_task` or workers.

### Handler Dispatch Order

1. Decorated handlers (`@on`) matching the message are called first, in definition order.
2. The naming-convention handler (`on_<name>`) is called after all decorated handlers.
3. Handlers are resolved walking the MRO (subclass first, then base classes), unless `prevent_default()` is called.

If multiple `@on`-decorated handlers match a message, all of them are called.

## The `@on` Decorator

`textual.on` (`textual._on.on`) creates message handlers with CSS-selector-based filtering.

```python
from textual.on import on

@on(Button.Pressed, "#quit")
def handle_quit(self) -> None:
    self.app.exit()
```

### Positional Selector (control)

The first optional string argument is a CSS selector matched against the message's `control` property. The message class must define a `control` property that returns a widget (not the default `None`), otherwise `OnDecoratorError` is raised at import time.

```python
@on(Button.Pressed, "#bell")
def ring_bell(self) -> None:
    self.app.bell()

@on(Button.Pressed, ".toggle.dark")
def toggle_dark(self) -> None:
    self.dark = not self.dark
```

### Keyword Selectors (ALLOW_SELECTOR_MATCH)

Additional keyword arguments match CSS selectors against other message attributes listed in `Message.ALLOW_SELECTOR_MATCH`:

```python
@on(TabbedContent.TabActivated, pane="#home")
def home_tab(self) -> None:
    ...
```

The attribute must be a widget. If the attribute is not in `ALLOW_SELECTOR_MATCH`, an `OnDecoratorError` is raised at import time.

### Selector Parsing

Selectors are parsed at import time. A `TokenError` during parsing raises `OnDecoratorError` immediately, serving as an early warning.

### How It Works Internally

The decorator attaches a `_textual_on` list attribute to the method containing `(message_type, parsed_selectors)` tuples. The `_MessagePumpMeta` metaclass collects these into `_decorated_handlers` on the class dict at class creation time. At dispatch time, the message pump walks the MRO checking both decorated handlers and naming-convention handlers.

## Message Pump

`MessagePump` (`textual.message_pump`) is the base class for any object that processes messages. `App`, `Screen`, and `Widget` all inherit from `MessagePump`.

### Posting Messages

- `post_message(message) -> bool` -- Post a message to this pump's queue. Returns `True` if queued, `False` if the pump is closing/closed or the message type is disabled. Thread-safe: if called from a different thread, uses `loop.call_soon_threadsafe`.

### Scheduling Callbacks

- `call_next(callback, *args, **kwargs)` -- Schedule a callback to run immediately after the current message finishes processing.
- `call_later(callback, *args, **kwargs) -> bool` -- Schedule a callback to run after all currently queued messages are processed.
- `call_after_refresh(callback, *args, **kwargs) -> bool` -- Schedule a callback to run after all messages are processed and the screen has been refreshed.

### Timers

- `set_timer(delay, callback=None, *, name=None, pause=False) -> Timer` -- Call a function once after `delay` seconds.
- `set_interval(interval, callback=None, *, name=None, repeat=0, pause=False) -> Timer` -- Call a function every `interval` seconds. `repeat=0` means indefinite.

Both return a `Timer` object. Timers produce `events.Timer` events.

### Preventing Messages

- `prevent(*message_types)` -- Context manager that temporarily suppresses posting of the given message types. Useful when programmatically updating a widget's state without triggering change notifications:

```python
input = self.query_one(Input)
with self.prevent(Input.Changed):
    input.value = "foo"  # No Input.Changed is sent
```

The prevention is stack-based: nested `prevent` calls union with the outer set and unwind correctly.

### Disabling/Enabling Messages

- `disable_messages(*messages)` -- Permanently disable message types from being processed (until re-enabled).
- `enable_messages(*messages)` -- Re-enable previously disabled message types.

### Other Properties

- `is_running -> bool` -- Whether the message pump task is active.
- `message_queue_size -> int` -- Current number of messages in the queue.
- `message_signal: Signal[Message]` -- Signal published for every message dispatched by this pump. Low-level mechanism; not a replacement for regular message handling.

## Custom Messages

Define custom messages by subclassing `Message`. The recommended pattern is to define them as inner classes of the widget that sends them:

```python
class ColorButton(Widget):
    class Selected(Message):
        def __init__(self, color: Color) -> None:
            self.color = color
            super().__init__()

        @property
        def control(self) -> "ColorButton":
            # Required for @on decorator CSS matching
            return self._sender
```

Benefits of inner-class definition:

- Importing the widget also imports its messages (`ColorButton.Selected`).
- Creates a namespace: the handler becomes `on_color_button_selected` instead of `on_selected`, avoiding name clashes.

### Sending Custom Messages

Call `self.post_message(MyMessage(...))` to post to the widget's own queue. The message will bubble to parents if `bubble=True`.

### The `control` Property

For the `@on` decorator's CSS selector matching to work, the message must define a `control` property returning the widget that originated the message. Builtin widget messages already provide this. Custom messages need to implement it explicitly (typically returning `self._sender`).

## Builtin Events

### Lifecycle Events

| Event | Bubbles | Description |
|---|---|---|
| `Load` | No | App is running but terminal is not yet in application mode. |
| `Compose` | No | Request to compose and mount children (internal). |
| `Mount` | No | Widget is mounted and may receive messages. |
| `Unmount` | No | Widget is unmounted and may no longer receive messages. |
| `Ready` | No | DOM is ready and the first frame has been displayed (App only). |
| `Show` | No | Widget is first displayed. |
| `Hide` | No | Widget is hidden (removed, scrolled away, `display=False`). |
| `ScreenResume` | No | Screen has been made active. |
| `ScreenSuspend` | No | Screen is no longer active. |

### Input Events

| Event | Bubbles | Description |
|---|---|---|
| `Key` | Yes | A key was pressed. Attributes: `key`, `character`, `aliases`, `name`, `is_printable`. |
| `MouseMove` | Yes | Mouse cursor moved. Verbose. |
| `MouseDown` | Yes | Mouse button pressed. Verbose. |
| `MouseUp` | Yes | Mouse button released. Verbose. |
| `Click` | Yes | Widget was clicked. Includes `chain` for multi-click detection. |
| `MouseScrollDown` | Yes | Mouse wheel scrolled down. Verbose. |
| `MouseScrollUp` | Yes | Mouse wheel scrolled up. Verbose. |
| `MouseScrollRight` | Yes | Mouse wheel scrolled right. Verbose. |
| `MouseScrollLeft` | Yes | Mouse wheel scrolled left. Verbose. |
| `Paste` | Yes | Text was pasted (bracketed paste mode). |

All mouse events inherit from `MouseEvent` which provides: `x`, `y` (relative coordinates), `screen_x`, `screen_y` (absolute coordinates), `delta_x`, `delta_y`, `button`, `shift`, `meta`, `ctrl`, `style`, `offset`, `screen_offset`.

### Focus Events

| Event | Bubbles | Description |
|---|---|---|
| `Focus` | No | Widget gained focus. `from_app_focus` indicates whether focus came from the app regaining focus. |
| `Blur` | No | Widget lost focus. |
| `AppFocus` | No | App gained terminal focus (requires terminal support). |
| `AppBlur` | No | App lost terminal focus. |
| `DescendantFocus` | Yes | A child widget gained focus. |
| `DescendantBlur` | Yes | A child widget lost focus. |
| `Enter` | Yes | Mouse moved over a widget. Check `node` for the widget directly under the mouse. |
| `Leave` | Yes | Mouse moved away from a widget. |

### Other Events

| Event | Bubbles | Description |
|---|---|---|
| `Resize` | No | Widget or app was resized. Coalesces: newer Resize replaces older pending Resize. |
| `Timer` | No | Fired by a timer. Verbose. Attributes: `timer`, `time`, `count`, `callback`. |
| `Idle` | No | Pseudo-event: queue is empty. Not sent through the normal queue. |
| `Callback` | No | Internal: invokes a callback (from `call_next`/`call_later`). Verbose. |
| `Print` | No | Captures Python `print` output (requires `App.begin_capture_print`). |
| `Action` | Yes | An action string to process. |
| `MouseCapture` | No | Mouse has been captured by a widget. |
| `MouseRelease` | No | Mouse capture has been released. |
| `DeliveryComplete` | No | File delivery completed (App). |
| `DeliveryFailed` | No | File delivery failed (App). |

## Timer Events

`events.Timer` is sent when a timer fires. The default handler on `MessagePump.on_timer` calls `prevent_default()` and `stop()`, then invokes the timer's callback. Timer events do not bubble.

Timers are created via:

- `set_timer(delay, callback)` -- One-shot timer.
- `set_interval(interval, callback, repeat=0)` -- Repeating timer. `repeat=0` means infinite.

The `Timer` object returned can be paused, resumed, or stopped.
