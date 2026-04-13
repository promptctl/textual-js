# textual.compose

The `textual.compose` module provides the `compose` function for building widget trees from generators outside of the standard `Widget.compose` lifecycle method.

## `compose` Function

```python
def compose(node: App | Widget, compose_result: ComposeResult | None = None) -> list[Widget]
```

Compose child widgets from a generator, replicating the behavior of `Widget.compose` but usable from event handlers, callbacks, or other non-compose contexts. Supports context managers (e.g., `with containers.HorizontalGroup():`) within the generator.

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `node` | `App \| Widget` | -- | The parent node that provides the app context for composition. |
| `compose_result` | `ComposeResult \| None` | `None` | A compose result (generator yielding widgets). If `None`, calls `node.compose()`. |

### Returns

A `list[Widget]` containing the composed widget tree.

### Behavior

- Iterates the `compose_result` generator (or `node.compose()` if none provided), collecting yielded widgets.
- Supports nested composition via context managers: widgets yielded inside a `with` block are added as children of the context manager widget via `compose_add_child`.
- Validates that every yielded value is a `Widget` instance. Raises `MountError` (thrown into the generator if possible) for non-widget values.
- Validates that every widget has an `id` attribute (i.e., `super().__init__()` was called). Raises `MountError` if missing.
- Manages the app's internal `_compose_stacks` and `_composed` lists for proper nesting.

### Example

```python
def on_key(self, event: events.Key) -> None:

    def add_key(key: str) -> ComposeResult:
        with containers.HorizontalGroup():
            yield Label("You pressed:")
            yield Label(key)

    self.mount_all(
        compose(self, add_key(event.key)),
    )
```
