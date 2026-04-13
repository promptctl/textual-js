# textual.worker_manager

The `textual.worker_manager` module contains `WorkerManager`, a class that manages workers for a Textual application. Access it via `App.workers` or `Widget.workers` (both delegate to the same app-level manager).

## `WorkerManager` Class

```python
class WorkerManager
```

An object to manage a number of workers. You do not construct this class manually; widgets, screens, and apps expose it via a `workers` attribute.

### Constructor

```python
WorkerManager(app: App)
```

| Parameter | Type | Description |
|---|---|---|
| `app` | `App` | The application instance that owns these workers. |

### Container Protocol

`WorkerManager` supports standard container operations:

| Operation | Description |
|---|---|
| `iter(manager)` | Yields `Worker` instances sorted by creation time (oldest first). |
| `reversed(manager)` | Yields `Worker` instances sorted by creation time (newest first). |
| `len(manager)` | Returns the number of managed workers. |
| `bool(manager)` | Returns `True` if there are any managed workers. |
| `worker in manager` | Tests whether a specific `Worker` is being managed. |

### Methods

#### `add_worker(worker, start=True, exclusive=True) -> None`

Add a new worker to the manager.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `worker` | `Worker` | -- | The worker instance to add. |
| `start` | `bool` | `True` | Start the worker immediately. If `False`, the worker must be started manually. |
| `exclusive` | `bool` | `True` | Cancel all workers in the same group as `worker` before adding. |

When `exclusive=True` and the worker has a non-empty group, all existing workers in that group on the same node are cancelled before the new worker is added.

#### `start_all() -> None`

Start all workers that have been added to the manager.

#### `cancel_all() -> None`

Cancel every managed worker.

#### `cancel_group(node, group) -> list[Worker]`

Cancel all workers in a given group that belong to a specific node.

| Parameter | Type | Description |
|---|---|---|
| `node` | `DOMNode` | The DOM node whose workers to cancel. |
| `group` | `str` | The group name to match. |

Returns a list of workers that were cancelled.

#### `cancel_node(node) -> list[Worker]`

Cancel all workers associated with a given DOM node.

| Parameter | Type | Description |
|---|---|---|
| `node` | `DOMNode` | The DOM node (widget, screen, or App) whose workers to cancel. |

Returns a list of workers that were cancelled.

#### `await wait_for_complete(workers=None) -> None`

Wait for workers to complete.

| Parameter | Type | Description |
|---|---|---|
| `workers` | `Iterable[Worker] \| None` | An iterable of workers to wait for. If `None`, waits for all workers in the manager. |

Swallows `CancelledError` during the gather operation.
