# textual._work_decorator

The `@work` decorator (imported as `from textual import work`) converts a method on a `DOMNode` subclass into a worker factory. Calling the decorated method creates and starts a `Worker`, returning it immediately without blocking.

## `work` Decorator

```python
@work
async def my_method(self, ...) -> ReturnType:
    ...

# or with parameters:
@work(name="fetch", group="network", exclusive=True, thread=False)
async def my_method(self, ...) -> ReturnType:
    ...
```

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `method` | `Callable \| None` | `None` | The function or coroutine to decorate. When used without parentheses, this is the decorated method itself. |
| `name` | `str` | `""` | A short string to identify the worker in logs and debugging. Defaults to the method's `__name__`. |
| `group` | `str` | `"default"` | A short string to identify the worker group. Used for exclusive cancellation. |
| `exit_on_error` | `bool` | `True` | Exit the app if the worker raises an error. Set to `False` to suppress exceptions. |
| `exclusive` | `bool` | `False` | Cancel all workers in the same group before starting the new one. |
| `description` | `str \| None` | `None` | Readable description for debugging. If `None`, auto-generates from the method name and arguments. |
| `thread` | `bool` | `False` | Mark the method as a thread worker. |

### Behavior

- The decorator can be used with or without parentheses: `@work` or `@work(exclusive=True)`.
- The first positional argument of the decorated method must be a `DOMNode` instance (i.e., `self` on a widget, screen, or app method).
- The decorated method's return type changes from `ReturnType` to `Worker[ReturnType]`.
- When `description` is `None`, the decorator auto-generates a debug description from the method name and its arguments (e.g., `"fetch_data('Paris', limit=10)"`).
- Internally, the decorator calls `self.run_worker(partial(method, *args, **kwargs), ...)`.

### Constraints

- A non-async function decorated with `@work` **must** set `thread=True`. Omitting it raises `WorkerDeclarationError` at decoration time.

## `WorkerDeclarationError` Exception

```python
class WorkerDeclarationError(Exception)
```

Raised when a worker method is declared incorrectly -- specifically, when a non-async function is decorated with `@work` without setting `thread=True`.

## Type Aliases

### `Decorator`

```python
Decorator: TypeAlias = Callable[
    [Union[Callable[..., ReturnType], Callable[..., Coroutine[None, None, ReturnType]]]],
    Callable[..., Worker[ReturnType]],
]
```

The type of the decorator returned when `@work(...)` is called with keyword arguments.
