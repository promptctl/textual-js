# textual.logging

A Python standard library `logging` handler that routes log messages through Textual's logging infrastructure. When an active Textual app exists, messages are sent to the devtools console; otherwise they are written to stderr or stdout.

## TextualHandler Class

`TextualHandler` (`textual.logging`) extends `logging.Handler`. A logging handler for Textual apps.

### Constructor

```python
def __init__(self, stderr: bool = True, stdout: bool = False) -> None
```

**Parameters:**

- `stderr: bool = True` -- If true, log to stderr when there is no active Textual app.
- `stdout: bool = False` -- If true, log to stdout when there is no active Textual app.

**Internal State:**

- `_stderr: bool` -- Whether to fall back to stderr output.
- `_stdout: bool` -- Whether to fall back to stdout output.

### Methods

#### emit

```python
def emit(self, record: LogRecord) -> None
```

Invoked by the standard library `logging` module to process a log record.

**Parameters:**

- `record: LogRecord` -- The log record to emit.

**Behavior:**

1. Formats the record using `self.format(record)`.
2. Attempts to retrieve the active Textual app from the `active_app` context variable.
3. If no active app is found (`LookupError`):
   - If `_stderr` is true, prints the formatted message to `sys.stderr`.
   - Else if `_stdout` is true, prints the formatted message to `sys.stdout`.
4. If an active app is found, routes the message through `app.log.logging(message)`, which sends it to the Textual devtools console under the `LOGGING` log group.

### Usage

```python
import logging
from textual.logging import TextualHandler

logging.basicConfig(
    level=logging.DEBUG,
    handlers=[TextualHandler()],
)
```

When used as a logging handler, all standard library `logging` calls (e.g. `logging.info()`, `logging.warning()`) will be routed to the Textual devtools console when a Textual app is active, or to stderr/stdout otherwise.
