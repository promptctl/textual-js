# Reactivity

Textual provides a reactivity system for declaring attributes that automatically trigger watchers, validators, and computed values when they change. It also supports data binding between widgets and a signal/pub-sub mechanism.

## Reactive Attributes

### `reactive` and `var`

Reactive attributes are declared as class-level descriptors using `reactive()` or `var()`. Both accept a default value (or a callable that returns one). The key difference is that `var` defaults to `init=True` (the watcher fires on initialization) while `reactive` defaults to `init=False` (the watcher does not fire until the value is explicitly set).

A callable default is invoked to produce the initial value:

```python
class MyApp(App):
    value = reactive(lambda: 123)
```

### `init` Parameter

When `init=True`, the watcher is called during startup even if the user never sets the value. When `init=False`, the watcher only fires on the first explicit assignment that changes the value.

When `init=True` triggers an async watcher at startup (without any explicit assignment), both `old_value` and `new_value` passed to the watcher are the same — they both equal the initial default value.

When `init=True`, the validator is also called at startup, not just the watcher. The validator runs on the initial value and the transformed result is stored as the attribute value.

### `always_update` Parameter

By default, setting a reactive to its current value does not trigger the watcher. With `always_update=True`, the watcher fires on every assignment regardless of whether the value changed.

### `Initialize` Default

A reactive can accept an `Initialize` instance wrapping a method reference. The method is called on the owner to produce the initial value:

```python
class MyApp(App):
    def get_names(self) -> list[str]:
        return ["foo", "bar", "baz"]

    names = reactive(Initialize(get_names))
```

### `set_reactive`

`set_reactive(ClassName.attr, value)` sets a reactive attribute's value without invoking watchers. This is intended for use during `__init__` to configure initial state silently.

### Assignments Made Before the Message Pump is Ready

If a reactive attribute is assigned inside `__init__` before `super().__init__()` has set up the message pump, the assignment is accepted and stored. Watchers are not invoked at that point but will fire once the widget is mounted and the framework processes pending reactions.

### `mutate_reactive`

For mutable containers (lists, dicts, sets), in-place mutations are not detected. After mutating the underlying object, call `widget.mutate_reactive(ClassName.attr)` to explicitly notify the system, which invokes watchers and propagates to data-bound widgets.

### Inheritance

Subclasses inherit reactive attributes from their parents. A subclass can override a reactive by redeclaring it with a new default. Attributes defined in a parent are accessible from grandchildren. A subclass adds to the reactive count only for genuinely new attributes.

## Watchers

### Naming Convention

A watcher is a method named `watch_<attr>` on the same class. It is called whenever the reactive attribute changes (subject to `init` and `always_update` rules).

### Watcher Signatures

A watcher can accept either:
- One parameter (`new_value`), or
- Two parameters (`old_value`, `new_value`).

### Sync and Async Watchers

Watchers can be synchronous or asynchronous (`async def watch_<attr>`). Synchronous watchers run inline and complete before the assignment statement returns — the updated value and any watcher side effects are observable immediately on the next line of calling code. Async watchers are scheduled and run eventually rather than inline.

### Private Watchers

A method named `_watch_<attr>` acts as a private watcher. When both a public (`watch_<attr>`) and private (`_watch_<attr>`) watcher exist, both are called on every change.

### Message Sender Inside a Watcher

When a watcher posts a `Message`, the message's sender is the widget that owns the reactive attribute (the reacting widget), not any ancestor or observer that triggered the change.

### External Watchers via `self.watch()`

A widget can register an external watcher on another widget's reactive attribute:

```python
self.watch(other_widget, "attr_name", self.callback)
```

Duplicate registrations of the same callback are ignored. When `init` is implied, only the newly added external watcher fires -- existing watchers (both class-defined and previously registered external ones) are not re-invoked.

Both synchronous and asynchronous external callbacks are invoked correctly. If the callback is synchronous, it fires inline when the reactive changes. If asynchronous, it is scheduled.

When a duplicate registration is deduplicated, the init call for that callback still fires once (for the first registration) and is not repeated on the second registration attempt.

## Validators

### Naming Convention

A validator is a method named `validate_<attr>`. It receives the proposed new value and returns the value that should actually be stored. Validators run before watchers. The watcher always receives the *post-validator* value, not the original value passed to the assignment.

### Validator Called Before DOM Ready

If a reactive attribute is assigned before the app is fully running (e.g., before `run_test()` completes), the validator still runs when the framework processes the initial value. Setting a `var` (with `init=True`) before the DOM is ready does not skip validation.

### Private Validators

A method named `_validate_<attr>` acts as a private validator. When both exist, the private validator runs first. If the private validator transforms the value (e.g., clamps or replaces it), the public validator never sees the original input.

### Execution Order

For a single attribute assignment, the full pipeline is:
1. Private validator (`_validate_<attr>`)
2. Public validator (`validate_<attr>`)
3. Private watcher (`_watch_<attr>`) and public watcher (`watch_<attr>`)
4. Compute methods for any dependent reactive attributes

## Compute Methods

### Naming Convention

A compute method is named `compute_<attr>`. It returns a derived value. The attribute's value is recalculated whenever any reactive attribute on the same object changes.

### Compute Evaluated at Startup

A `compute_<attr>` method is evaluated at startup even before any explicit assignment. Accessing the computed attribute before any reactive changes still returns the derived value.

### Read-Only

A computed reactive attribute cannot be assigned to directly; doing so raises `AttributeError`.

### Private Compute

A method named `_compute_<attr>` works the same as a public compute. However, defining both a public and private compute for the same attribute raises `TooManyComputesError`.

### Watch + Compute

A computed attribute can also have a watcher. The watcher fires whenever the recomputed value differs from the previous one.

## Data Binding

### `data_bind()`

`data_bind()` connects a child widget's reactive attribute to a parent (ancestor) widget's reactive attribute. When the parent's value changes, the child's value is updated automatically.

```python
# Keyword form: child_attr=ParentClass.parent_attr
yield FooLabel().data_bind(foo=DataBindApp.bar)

# Positional form: same-named attribute
yield TestWidget().data_bind(TestApp.messages)
```

### Binding Rules

- The parent attribute must be defined on an ancestor of the bound widget. Binding to a reactive defined on the child's own class (rather than an ancestor) raises `ReactiveError`.
- If the child does not have a reactive with the target name, a `ReactiveError` is raised at mount time.
- Binding can happen inside `compose()` or later at runtime. A runtime bind takes effect after the next pause.
- Removing a bound widget cleanly detaches the binding; subsequent changes to the parent do not error.
- An unbound widget retains its own class-level default value; only explicitly bound widgets track the parent reactive.

### Mutation Propagation

When `mutate_reactive()` is called on a parent's attribute that is data-bound, watchers on both the parent and the bound child are invoked. The child holds a reference to the same object instance (not a copy).

## Signals

### Creating a Signal

A `Signal` is created with an owner and a description string. It is generic over the published data type:

```python
self.test_signal: Signal[str] = Signal(self, "coffee ready")
```

### Publishing

Call `signal.publish(data)` to notify all subscribers with the given data.

### Subscribing

A widget subscribes by passing itself and a callback:

```python
app.test_signal.subscribe(self, callback)
```

The callback receives the published data as its single argument. Subscribing a widget that is not running (not mounted) raises `SignalError`.

### Unsubscribing

Call `signal.unsubscribe(widget)` to remove a widget's subscription. Subsequent publishes no longer invoke that widget's callback.

### Lifecycle Cleanup

When a subscribed widget is removed from the DOM, its subscription is automatically cleaned up. If the widget is later remounted and resubscribes, it receives future publishes normally.

### Typed Signals

Signals are generic. Multiple signals with different type parameters can coexist on the same owner, each delivering their own typed data to their respective subscribers.

### Signal `repr`

`Signal.__repr__` returns a non-empty string and does not raise. This allows signals to be inspected in debuggers and log output safely.

## Constraints

- A reactive attribute's watcher does not fire when the value is set to its current value, unless `always_update=True`.
- Async watchers are not called inline; they are scheduled. The value is updated immediately on assignment, but the async watcher runs later.
- Validators always run before watchers. Private validators run before public validators.
- Only one compute method (public or private) is permitted per attribute. Defining both raises `TooManyComputesError`.
- Computed attributes are read-only; direct assignment raises `AttributeError`.
- `set_reactive` bypasses watchers entirely. It is the only sanctioned way to set initial values silently.
- In-place mutations to mutable reactive values are not detected. `mutate_reactive()` must be called explicitly to trigger watchers and data-bind propagation.
- Data binding requires the source attribute to be defined on an ancestor widget. Binding to a same-class or non-ancestor attribute raises `ReactiveError`.
- Data binding to a nonexistent reactive attribute on the child raises `ReactiveError` at mount time.
- Signal subscribers must be mounted (running) widgets. Subscribing a non-running widget raises `SignalError`.
- Removing a widget automatically cleans up its signal subscriptions.
- Duplicate external watcher registrations (same callback on same attribute) are deduplicated; the callback is invoked only once per change.
- When adding an external watcher with `self.watch()`, only the newly added watcher is initialized -- pre-existing watchers are not re-triggered.
