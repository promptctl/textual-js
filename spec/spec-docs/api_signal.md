# Signal

The `textual.signal` module provides a simple pub-sub mechanism for DOMNodes. Nodes subscribe to a signal with a callback, which is invoked when the signal is published.

## Exception Classes

| Exception | Base | Description |
|---|---|---|
| `SignalError` | `Exception` | Raised for signal-related errors, such as subscribing a non-running node |

## Type Aliases

| Name | Definition | Description |
|---|---|---|
| `SignalCallbackType` | `Union[Callable[[SignalT], Awaitable[Any]], Callable[[SignalT], Any]]` | A sync or async callback that receives the signal data |

## Signal

A generic class `Signal[SignalT]` representing a named signal owned by a DOMNode. Other nodes can subscribe to receive callbacks when the signal is published.

```python
from textual.signal import Signal

class MyWidget(Widget):
    def on_mount(self) -> None:
        self.my_signal = Signal(self, "my-signal")
```

### Constructor

| Parameter | Type | Description |
|---|---|---|
| `owner` | `DOMNode` | The DOM node that owns this signal |
| `name` | `str` | An identifier for debugging purposes |

The owner is stored as a weak reference. Subscriptions are stored in a `WeakKeyDictionary` keyed by the subscribing node.

### Properties

| Property | Type | Description |
|---|---|---|
| `owner` | `DOMNode \| None` | The owner node, or `None` if the owner has been garbage collected |

### Methods

#### subscribe(node, callback, immediate=False)

Subscribe a node to this signal.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `node` | `DOMNode` | required | The node subscribing to the signal |
| `callback` | `SignalCallbackType[SignalT]` | required | Callback invoked when the signal is published; receives a single argument of type `SignalT` |
| `immediate` | `bool` | `False` | If `True`, invoke the callback synchronously during publish. If `False`, post the callback to the node's message queue to be called after existing messages are processed |

| Raises | Condition |
|---|---|
| `SignalError` | The subscribing node is not running (not yet mounted) |

A single node can have multiple callbacks registered for the same signal.

#### unsubscribe(node)

Remove all subscriptions for the given node.

| Parameter | Type | Description |
|---|---|---|
| `node` | `DOMNode` | The node to unsubscribe |

This is a no-op if the node is not subscribed.

#### publish(data)

Publish the signal, invoking all subscribed callbacks with the given data.

| Parameter | Type | Description |
|---|---|---|
| `data` | `SignalT` | The data to pass to each callback |

#### Publish Behavior

Publishing follows these rules:

1. If there are no subscriptions, return immediately.
2. If the owner has been garbage collected, return immediately.
3. If the owner is not attached to the DOM or is being pruned, return immediately.
4. If any ancestor of the owner is not running, return immediately.
5. For each subscribed node:
   - If the node is no longer running, attached, or is being pruned, remove its subscription.
   - Otherwise, invoke all of its registered callbacks with the data.
6. Exceptions raised by callbacks are logged but do not propagate; other callbacks continue to execute.

### Lifecycle

- Signals use weak references for both the owner and subscribers, so garbage collection of nodes automatically cleans up subscriptions.
- Nodes must be running (mounted) to subscribe. Attempting to subscribe a non-running node raises `SignalError`.
- When `immediate=False` (default), callbacks are posted via `node.call_next()`, ensuring they execute after the current message processing completes. This prevents re-entrancy issues.
- When `immediate=True`, callbacks execute synchronously during the `publish()` call.
