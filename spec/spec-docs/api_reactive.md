# Reactive API

The `textual.reactive` module provides descriptor classes for declaring reactive attributes on `Widget` and `App` subclasses. Reactive attributes automatically trigger refreshes, invoke watchers, run validators, execute compute methods, and support data binding.

## Exception Classes

| Exception | Base | Description |
|---|---|---|
| `ReactiveError` | `Exception` | Base class for reactive errors |
| `TooManyComputesError` | `ReactiveError` | Raised when an attribute has both public and private compute methods |

## Initialize

A wrapper class that defers the default value computation to a method on the owning object. This allows the default to depend on the object's state.

```python
from textual.reactive import reactive, Initialize

class MyWidget(Widget):
    def get_names(self) -> list[str]:
        return ["foo", "bar"]

    names = reactive(Initialize(get_names))
```

### Constructor

| Parameter | Type | Description |
|---|---|---|
| `callback` | `Callable[[ReactableType], ReactiveType]` | A method reference that takes the owner object and returns the default value |

### Behavior

When the reactive attribute is first accessed, `callback(obj)` is called with the owning object to produce the default, rather than calling a zero-argument callable.

## Reactive (Base Descriptor)

The `Reactive` class is the base descriptor that implements the full reactive protocol. It is generic over `ReactiveType`, the type of the attribute's value.

```python
from textual.reactive import Reactive

class MyWidget(Widget):
    count = Reactive(0, layout=True)
```

### Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `default` | `ReactiveType \| Callable[[], ReactiveType] \| Initialize[ReactiveType]` | required | Default value, zero-arg callable, or `Initialize` instance |
| `layout` | `bool` | `False` | Trigger layout recalculation on change |
| `repaint` | `bool` | `True` | Trigger repaint on change |
| `init` | `bool` | `False` | Call watchers on initialization (post mount) |
| `always_update` | `bool` | `False` | Call watchers even when the new value equals the old value |
| `compute` | `bool` | `True` | Run compute methods when attribute is changed |
| `recompose` | `bool` | `False` | Recompose widget (remove children and re-call `compose()`) on change |
| `bindings` | `bool` | `False` | Refresh key bindings when the reactive changes |
| `toggle_class` | `str \| None` | `None` | Space-separated CSS class name(s) to toggle based on truthiness of value |

### Properties

| Property | Type | Description |
|---|---|---|
| `owner` | `Type[MessageTarget]` | The class where the reactive was declared |

### Descriptor Protocol

#### __set_name__(owner, name)

Called when the descriptor is assigned to a class attribute. Sets up:
- The attribute `name` and `internal_name` (`_reactive_{name}`)
- The `compute_name` (prefers `_compute_{name}` over `compute_{name}`)
- Registers compute methods in the owner's `__computes` list
- Stores the default as `_default_{name}` on the owner class

#### __get__(obj, obj_type)

- If accessed on the class (obj is None), returns the descriptor itself.
- If accessed on an instance, initializes the reactive if needed, then:
  - If a compute method exists, calls it, stores the result, checks watchers, and returns the computed value.
  - Otherwise, returns the stored internal value.
- Raises `ReactiveError` if the object is missing initialization data (super().__init__() not called).

#### __set__(obj, value)

Sets the reactive attribute value. The full sequence:

1. Validates the object has been initialized (raises `ReactiveError` if not).
2. Raises `AttributeError` if a compute method exists (computed reactives are read-only).
3. Calls `_validate_{name}(value)` if it exists (private validator).
4. Calls `validate_{name}(value)` if it exists (public validator).
5. Toggles CSS classes if `toggle_class` is set.
6. If the value changed (or `always_update=True`):
   - Stores the value in the internal attribute.
   - Invokes watchers (private `_watch_{name}`, then public `watch_{name}`, then bound watchers).
   - Runs compute methods if `compute=True`.
   - Refreshes bindings if `bindings=True`.
   - Calls `refresh()` with appropriate flags if `repaint`, `layout`, or `recompose` is set.

### Watcher Invocation

Watchers are discovered by naming convention and may accept 0, 1, or 2 parameters:

| Signature | Arguments Passed |
|---|---|
| `watch_name()` | No arguments |
| `watch_name(new_value)` | The new value |
| `watch_name(old_value, new_value)` | The old and new values |

The same pattern applies to `_watch_name` (private watchers). Private watchers run before public watchers. Watchers may be sync or async; async watchers are scheduled as tasks.

### Compute Methods

If a method named `compute_{name}` or `_compute_{name}` exists on the owner, it is called to produce the attribute's value. Private compute methods take precedence. An attribute with a compute method is read-only (setting raises `AttributeError`).

### Class Methods

#### _initialize_object(obj)

Initialize all reactive attributes on an object by setting defaults and calling initial watchers/computes.

#### _reset_object(obj)

Clear reactive watchers and computes on an object (used to break reference cycles).

#### _check_watchers(obj, name, old_value)

Invoke all watchers for a given attribute, including private, public, and bound (global) watchers.

#### _compute(obj)

Invoke all compute methods on an object and check watchers for any that produced changed values.

#### _clear_watchers(obj)

Clear all watchers registered on a given object.

## reactive (Subclass)

A subclass of `Reactive` with different defaults, intended for typical widget attributes that should trigger repaints.

```python
from textual.reactive import reactive

class MyWidget(Widget):
    name = reactive("default")
```

### Constructor Parameters

Same as `Reactive` except:
- `init` defaults to `True` (not `False`)
- `compute` parameter is not exposed (always `True`)

| Parameter | Type | Default |
|---|---|---|
| `default` | `ReactiveType \| Callable[[], ReactiveType] \| Initialize[ReactiveType]` | required |
| `layout` | `bool` | `False` |
| `repaint` | `bool` | `True` |
| `init` | `bool` | `True` |
| `always_update` | `bool` | `False` |
| `recompose` | `bool` | `False` |
| `bindings` | `bool` | `False` |
| `toggle_class` | `str \| None` | `None` |

## var (Subclass)

A subclass of `Reactive` that does not trigger any automatic refresh (no repaint, no layout). Useful for data attributes that should invoke watchers but not cause visual updates.

```python
from textual.reactive import var

class MyWidget(Widget):
    data = var([])
```

### Constructor Parameters

| Parameter | Type | Default |
|---|---|---|
| `default` | `ReactiveType \| Callable[[], ReactiveType] \| Initialize[ReactiveType]` | required |
| `init` | `bool` | `True` |
| `always_update` | `bool` | `False` |
| `bindings` | `bool` | `False` |
| `toggle_class` | `str \| None` | `None` |

`layout` and `repaint` are always `False`.

## _watch() Module Function

Register a watcher callback on a reactive attribute of another object (used for data binding).

```python
_watch(node, obj, "attribute_name", callback, init=True)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `node` | `DOMNode` | required | The node that created the watcher |
| `obj` | `Reactable` | required | The object owning the reactive attribute |
| `attribute_name` | `str` | required | Name of the attribute to watch |
| `callback` | `WatchCallbackType` | required | Callback to invoke on change |
| `init` | `bool` | `True` | If `True`, invoke the callback immediately with the current value |

Duplicate callbacks (same function) are not added twice.

## invoke_watcher() Module Function

Invoke a watch function with the appropriate number of arguments based on its parameter count.

| Parameter | Type | Description |
|---|---|---|
| `watcher_object` | `Reactable` | The object watching for changes |
| `watch_function` | `WatchCallbackType` | The watch function (sync or async) |
| `old_value` | `object` | Previous value |
| `value` | `object` | New value |

If the watcher is async, it is scheduled via `call_next` and a compute pass runs after it completes.
