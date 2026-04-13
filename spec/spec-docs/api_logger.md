# textual (Logger)

The `Logger` class and related utilities for logging to the Textual devtools console. Defined in `textual.__init__`.

## LoggerError Class

`LoggerError` (`textual`) extends `Exception`. Raised when the logger fails to write a log message (e.g. no active app or devtools connection).

## Logger Class

`Logger` (`textual`) is a callable logger that sends log messages to the Textual devtools console. Decorated with `@rich.repr.auto`.

### Constructor

```python
def __init__(
    self,
    log_callable: LogCallable | None,
    group: LogGroup = LogGroup.INFO,
    verbosity: LogVerbosity = LogVerbosity.NORMAL,
    app: App | None = None,
) -> None
```

**Parameters:**

- `log_callable: LogCallable | None` -- The underlying callable that performs the actual logging. May be `None` (in which case the active app's `_log` is used).
- `group: LogGroup = LogGroup.INFO` -- The log group classification for messages from this logger.
- `verbosity: LogVerbosity = LogVerbosity.NORMAL` -- The verbosity level.
- `app: App | None = None` -- The associated application. Stored as a weak reference.

**Internal State:**

- `_log: LogCallable | None` -- The log callable.
- `_group: LogGroup` -- The log group.
- `_verbosity: LogVerbosity` -- The verbosity level.
- `_app: weakref.ref[App] | None` -- Weak reference to the associated app, or `None`.

### Properties

- `app -> App | None` -- The associated application, or `None` if there is no associated app or it has been garbage collected.

### Calling the Logger

```python
def __call__(self, *args: object, **kwargs) -> None
```

Log a message. Accepts arbitrary positional and keyword arguments.

**Behavior:**

1. If `constants.LOG_FILE` is set, formats the arguments and appends them to the log file.
2. Attempts to find the active app (from `self.app` or `active_app` context variable).
3. If no app is found and `constants.DEBUG` is true, prints to stdout.
4. If the app has no devtools connection (`_is_devtools_connected` is false), returns immediately.
5. Otherwise, captures the caller's frame info (file, line number) and invokes the log callable with the group, verbosity, caller info, and all arguments.
6. If logging raises `LoggerError` and `constants.DEBUG` is true, prints to stdout as fallback.

### Group Properties

Each property returns a new `Logger` instance with the specified `LogGroup`, inheriting the log callable and app reference:

- `event -> Logger` -- Logger for events (`LogGroup.EVENT`).
- `debug -> Logger` -- Logger for debug messages (`LogGroup.DEBUG`).
- `info -> Logger` -- Logger for informational messages (`LogGroup.INFO`).
- `warning -> Logger` -- Logger for warnings (`LogGroup.WARNING`).
- `error -> Logger` -- Logger for errors (`LogGroup.ERROR`).
- `system -> Logger` -- Logger for system information (`LogGroup.SYSTEM`).
- `logging -> Logger` -- Logger for messages from stdlib's `logging` module (`LogGroup.LOGGING`).
- `worker -> Logger` -- Logger for worker information (`LogGroup.WORKER`).

### Verbosity Methods

- `verbose -> Logger` (property) -- Returns a new `Logger` with `LogVerbosity.HIGH`.
- `verbosity(verbose: bool) -> Logger` -- Returns a new `Logger` with `LogVerbosity.HIGH` if `verbose` is true, otherwise `LogVerbosity.NORMAL`.

### Rich Repr

`__rich_repr__` yields the group (default `LogGroup.INFO`) and verbosity (default `LogVerbosity.NORMAL`).

## Module-Level Instance

- `log: Logger = Logger(None)` -- Global logger instance that logs to the currently active app. Only works if there is an active app in the current thread. Use `app.log` to write logs from a thread without an active app.

### Example

```python
from textual import log
log(locals())
```
