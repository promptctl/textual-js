# Reactivity

Textual's reactive system provides descriptor-based attributes with automatic refresh, validation, watching, computation, data binding, and recomposition capabilities. Reactive attributes are declared at class scope on `Widget` or `App` subclasses using descriptors from `textual.reactive`.

## reactive() Descriptor

`reactive` creates an attribute that triggers a widget repaint when changed.

```python
from textual.reactive import reactive

class MyWidget(Widget):
    name = reactive("default")
    count = reactive(0)
    flag = reactive(True)
```

### Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `default` | value, callable, or `Initialize` | required | Default value, a zero-arg callable returning the default, or an `Initialize` instance |
| `layout` | `bool` | `False` | Trigger a layout recalculation on change |
| `repaint` | `bool` | `True` | Trigger a repaint on change |
| `init` | `bool` | `True` | Call watchers on initialization (post mount) |
| `always_update` | `bool` | `False` | Call watchers even when the new value equals the old value |
| `recompose` | `bool` | `False` | Remove all children and re-call `compose()` on change |
| `bindings` | `bool` | `False` | Refresh key bindings when the reactive changes |
| `toggle_class` | `str \| None` | `None` | Space-separated CSS class name(s) to toggle based on truthiness of the value |

### Smart Refresh Behavior

- Setting a reactive attribute schedules a repaint of the widget (calls `render()`).
- Multiple reactive changes within one message loop iteration result in a single refresh.
- If the new value equals the current value, no refresh or watcher invocation occurs (unless `always_update=True`).
- Setting `layout=True` causes a full CSS layout recalculation (not just a content repaint), which is necessary when the attribute change affects widget sizing.

### Dynamic Defaults

If `default` is a callable (but not an `Initialize` instance), Textual calls it with no arguments at initialization time to produce the default value:

```python
from time import time
start_time = reactive(time)  # calls time() when widget is created
```

### Initialize Defaults

`Initialize` wraps a method reference to produce the default from the owning object:

```python
from textual.reactive import reactive, Initialize

class MyWidget(Widget):
    def get_names(self) -> list[str]:
        return ["foo", "bar"]

    names = reactive(Initialize(get_names))
```

The callback receives the owner instance and returns the default value.

### Typing

Type checkers infer the type from the default. Explicit type hints are needed when the attribute type is broader than the default type:

```python
name: reactive[str | None] = reactive("Paul")
```

## var() Descriptor

`var` is a reactive that does **not** trigger repaint or layout on change. It retains all other reactive capabilities (watchers, validators, compute, data binding).

```python
from textual.reactive import var

class MyWidget(Widget):
    count = var(0)
```

### Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `default` | value, callable, or `Initialize` | required | Default value or callable returning default |
| `init` | `bool` | `True` | Call watchers on initialization |
| `always_update` | `bool` | `False` | Call watchers even when value unchanged |
| `bindings` | `bool` | `False` | Refresh bindings on change |
| `toggle_class` | `str \| None` | `None` | CSS class(es) to toggle on truthiness |

Internally, `var` is a subclass of `Reactive` with `layout=False` and `repaint=False`.

## Watchers

### Watch Methods (watch_ convention)

Define a method named `watch_{attribute_name}` on the same class. Textual calls it automatically when the reactive changes.

- **One parameter**: receives the new value.
- **Two parameters**: receives `(old_value, new_value)`.
- **Zero parameters**: also supported (called with no arguments).
- **Async**: watch methods may be `async`; Textual awaits them appropriately.

```python
class MyWidget(Widget):
    color = reactive(Color.parse("red"))

    def watch_color(self, old_value: Color, new_value: Color) -> None:
        self.styles.background = new_value
```

Watch methods are only called when the value actually changes, unless `always_update=True`.

### Private Watch Methods

A method named `_watch_{name}` is treated as a private watcher. Both private and public watch methods can coexist on the same attribute; the private watcher is called first.

### Dynamic Watchers (DOMNode.watch)

Programmatically watch a reactive on another object:

```python
self.watch(obj, "attribute_name", callback, init=True)
```

- `obj`: the object owning the reactive attribute.
- `attribute_name`: name of the reactive attribute (string).
- `callback`: a callable following the same signature rules as watch methods (0, 1, or 2 params).
- `init`: if `True` (default), the callback is invoked immediately with the current value.

Dynamic watchers are stored on the target object. Watchers for nodes that have closed are automatically pruned.

## Validators

Define a method named `validate_{attribute_name}` to intercept and potentially transform values before they are stored.

```python
class MyWidget(Widget):
    count = reactive(0)

    def validate_count(self, value: int) -> int:
        return max(0, min(value, 10))  # clamp to 0..10
```

- The validator receives the incoming value and must return the value to store.
- A private validator `_validate_{name}` is also supported and runs **before** the public validator.
- Validators run before watchers.
- Validators are **not** called when using `set_reactive`.

## Computed Reactives

Define a method named `compute_{attribute_name}` to make the reactive a computed (read-only) value.

```python
class MyWidget(Widget):
    red = var(0)
    green = var(0)
    blue = var(0)
    color = reactive(Color(0, 0, 0))

    def compute_color(self) -> Color:
        return Color(self.red, self.green, self.blue)
```

### Behavior

- The compute method is called whenever the reactive is accessed via `__get__`.
- The result is cached internally; watchers on the computed reactive fire only when the computed result actually changes.
- When any reactive attribute on the object changes, all compute methods are re-evaluated (via `_compute`).
- Setting a reactive that has a compute method raises `AttributeError` -- computed reactives are read-only.
- A private compute method `_compute_{name}` is also supported. Having both a public and private compute method for the same attribute raises `TooManyComputesError`.

### Execution Order

When a reactive attribute is set:
1. Compute methods (on dependent reactives) are invoked.
2. Validate method runs on the incoming value.
3. The value is stored.
4. Watch methods are called.

For computed reactives specifically, the order is: compute, then validate, then watch.

### Performance

Compute methods should avoid slow or CPU-intensive work since they are re-evaluated when *any* reactive attribute on the object changes.

## init Parameter

The `init` parameter controls whether watchers are called during widget initialization (post-mount).

- `reactive()` defaults to `init=True` -- watchers fire at mount time with the initial value.
- `var()` defaults to `init=True`.
- The base `Reactive` class defaults to `init=False`.

When `init=True`, the watcher is called with the default value during `_initialize_reactive`. When `init=True` and a compute method exists, the compute method is called to produce the initial value.

## Setting Reactives Without Superpowers

### set_reactive

`DOMNode.set_reactive(reactive, value)` sets a reactive value without invoking validators, watchers, or any other side effects. This is useful in constructors where the widget is not yet mounted and watchers that query the DOM would fail.

```python
class Greeter(Widget):
    greeting = reactive("Hello")

    def __init__(self, greeting: str) -> None:
        super().__init__()
        self.set_reactive(Greeter.greeting, greeting)  # no watcher called
```

The first argument must be the reactive descriptor accessed via the class (e.g., `Greeter.greeting`), not the instance attribute.

### mutate_reactive

`DOMNode.mutate_reactive(reactive)` forces reactive superpowers (watchers, refresh, etc.) to run on a mutable value that was changed in place. Textual cannot detect in-place mutations (list append, dict update, etc.).

```python
self.names.append("Alice")
self.mutate_reactive(MyWidget.names)
```

This always triggers watchers regardless of whether the value technically changed (equivalent to `always=True` internally).

## Recompose on Reactive Change

Setting `recompose=True` on a reactive causes Textual to remove all child widgets and re-call `compose()` when the attribute changes. The removal and remounting happen in a single update.

```python
class MyWidget(Widget):
    who = reactive("World", recompose=True)

    def compose(self) -> ComposeResult:
        yield Label(f"Hello, {self.who}!")
```

### Considerations

- Child widgets lose all internal state on recompose (inputs, selections, scroll position, etc.).
- Avoid storing references to child widgets; use queries instead.
- Recompose is less efficient than a simple refresh; avoid for rapid updates or large widget trees.
- Main benefit: eliminates the need for a separate watch method to update child widgets, since `compose()` is the single source of truth for the widget tree.

## Data Binding

Data binding connects a reactive attribute on a parent widget to a reactive attribute on a child widget. Changes to the parent's reactive automatically propagate to the child.

### DOMNode.data_bind

Call `data_bind` on a child widget, passing reactive descriptors:

```python
def compose(self) -> ComposeResult:
    # Positional: binds by matching attribute name
    yield WorldClock("Europe/London").data_bind(WorldClockApp.time)

    # Keyword: binds parent's `time` to child's `clock_time`
    yield WorldClock("Asia/Tokyo").data_bind(clock_time=WorldClockApp.time)
```

### Behavior

- Binding is **unidirectional**: parent to child only. Setting the child's attribute does not update the parent.
- `data_bind` returns `self`, allowing it to be chained in `yield` expressions.
- The parent reactive and the child reactive must both exist. A `ReactiveError` is raised if the child does not have a reactive with the given name, or if the parent class does not own the specified reactive.
- When the binding initializes (at mount time or immediately if already mounted), the child's attribute is set to the parent's current value. Subsequent changes to the parent automatically update the child.

## toggle_class Parameter

The `toggle_class` parameter accepts a space-separated string of CSS class names. These classes are added to or removed from the widget based on the truthiness of the reactive value.

```python
class MyWidget(Widget):
    active = reactive(False, toggle_class="highlighted bold")
```

When `active` becomes truthy, the classes `highlighted` and `bold` are added. When falsy, they are removed. This operates during both initialization and subsequent value changes.

## bindings Parameter

Setting `bindings=True` causes `refresh_bindings()` to be called on the widget whenever the reactive changes. This is used to dynamically update key bindings based on reactive state.

## Signals

Signals (`textual.signal.Signal`) provide a pub-sub mechanism independent of the reactive system. They are not descriptors; they are instances created on a DOMNode.

### Creating a Signal

```python
from textual.signal import Signal

class MyWidget(Widget):
    def __init__(self) -> None:
        super().__init__()
        self.my_signal: Signal[str] = Signal(self, "my-signal")
```

Constructor takes `owner` (a `DOMNode`) and `name` (string identifier for debugging).

### Subscribing

```python
self.parent_widget.my_signal.subscribe(self, self.on_signal_data)
```

- `node`: the subscribing `DOMNode` (must be running/mounted; raises `SignalError` otherwise).
- `callback`: a callable accepting one argument of the signal's type. May be sync or async.
- `immediate`: if `True`, callback is invoked synchronously during `publish`. If `False` (default), callback is posted to the node's message queue for deferred execution.

Subscriptions are stored in a `WeakKeyDictionary` keyed by node, so subscriptions are automatically cleaned up when the subscribing node is garbage collected.

### Unsubscribing

```python
self.parent_widget.my_signal.unsubscribe(self)
```

Removes all callbacks for the given node.

### Publishing

```python
self.my_signal.publish("some data")
```

- Invokes all subscriber callbacks with the provided data.
- Silently skips nodes that are no longer running or attached.
- Skips publishing entirely if the owner is not attached or is being pruned.
- Errors in individual callbacks are logged but do not propagate or halt other callbacks.

### Signal vs Reactive

- **Reactive**: attribute-centric, tied to value changes, integrated with refresh/layout/validation/compute.
- **Signal**: event-centric, explicitly published, no value storage, no validation or compute.
