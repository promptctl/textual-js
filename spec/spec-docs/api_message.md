# textual.message

## Message Class

`Message` (`textual.message`) is the base class for all messages, including events.

### Class Variables

- `ALLOW_SELECTOR_MATCH: ClassVar[set[str]] = set()` -- Set of additional attribute names (beyond `control`) that the `@on` decorator may match against with CSS selectors. These attributes must be widgets.
- `bubble: ClassVar[bool] = True` -- If `True`, the message propagates to the parent after processing.
- `verbose: ClassVar[bool] = False` -- Verbose messages are excluded from the textual console unless `-v` is passed.
- `no_dispatch: ClassVar[bool] = False` -- If `True`, the message is not dispatched to handler code.
- `namespace: ClassVar[str] = ""` -- Namespace used to disambiguate handler names. Auto-derived from the enclosing class when a Message is defined as an inner class.
- `handler_name: ClassVar[str]` -- The auto-computed handler method name (e.g. `on_input_changed`).

### Instance Attributes

- `time: float` -- Timestamp (from `_time.get_time()`) when the message was created.

### Internal Slots

- `_sender: MessagePump | None` -- The message pump that sent this message. Automatically set from `active_message_pump` context variable during `__post_init__`.
- `_forwarded: bool` -- Whether the message has been forwarded.
- `_no_default_action: bool` -- Whether default action (base class handlers) is suppressed.
- `_stop_propagation: bool` -- Whether bubbling has been stopped.
- `_prevent: set[type[Message]]` -- Set of message types currently being prevented.

### Initialization

- `__init__()` -- Calls `__post_init__()`.
- `__post_init__()` -- Initializes all instance attributes. Exists to allow dataclass-based messages to initialize correctly.

### Subclass Configuration

Messages are configured via `__init_subclass__` keyword arguments:

```python
class MyMessage(Message, bubble=False, verbose=True, no_dispatch=False, namespace="custom"):
    ...
```

Parameters:
- `bubble: bool | None = True` -- Set to `None` to inherit from parent class.
- `verbose: bool = False` -- Mark message as verbose.
- `no_dispatch: bool | None = False` -- Set to `None` to inherit from parent class.
- `namespace: str | None = None` -- Override the auto-derived namespace. Set to `None` to use auto-derivation.

### Handler Name Derivation

The `handler_name` is computed automatically from the class hierarchy in `__init_subclass__`:

1. If `namespace` is explicitly provided, the name is `on_{namespace}_{snake_case_class_name}`.
2. Otherwise, the qualified name is used. If the class is defined inside a function (contains `<locals>.`), only the part after `<locals>.` is used.
3. For deeply nested inner classes (e.g. `A.B.C.D`), only the last two parts are used: `on_c_d` (for backwards compatibility).
4. CamelCase parts are converted to snake_case and joined with underscores.
5. The final handler name is prefixed with `on_`.

### Properties

- `control -> DOMNode | None` -- The widget associated with this message. Returns `None` by default; subclasses override to return the relevant widget.
- `is_forwarded -> bool` -- Whether the message has been forwarded (reads `_forwarded`).

### Methods

- `prevent_default(prevent: bool = True) -> Message` -- Suppress default action(s). Prevents handlers in base classes from being called for this message. Returns self.
- `stop(stop: bool = True) -> Message` -- Stop bubbling propagation to the parent. Returns self.
- `set_sender(sender: MessagePump) -> Self` -- Explicitly set the sender of the message. Normally the sender is set automatically from the active message pump context. Returns self.
- `can_replace(message: Message) -> bool` -- Check if another message may supersede this one. Returns `False` by default. Used for message coalescing (e.g. `Resize` replaces pending `Resize` messages).

### Internal Methods

- `_set_forwarded()` -- Marks the message as forwarded by setting `_forwarded = True`.
- `_bubble_to(widget: MessagePump)` -- Bubble to a widget (typically the parent). Resets `_no_default_action` to `False` before posting to the target.

### Rich Repr

`Message` is decorated with `@rich.repr.auto`. The default `__rich_repr__` yields nothing; subclasses should override to provide meaningful representation.
