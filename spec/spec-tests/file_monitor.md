# FileMonitor

File monitoring for hot reload support. `FileMonitor` watches a set of file paths and invokes a callback when changes are detected.

## Specification

### Construction

A `FileMonitor` is constructed with a list of `Path` objects to watch and a callback function to invoke when changes are detected.

### Change Detection

Calling a `FileMonitor` instance (via `__call__` / `await`) checks the watched files for modifications and fires the callback for each check cycle where a change is detected.

### Representation

A `FileMonitor` has a string representation that includes the class name `"FileMonitor"`.

### Missing Files

A `FileMonitor` tolerates paths that never exist on disk. Calling `check()` on a monitor whose paths do not resolve to real files must not raise an exception.

### Transient File Unavailability

Files may become temporarily unavailable during saving (e.g., editors that delete-then-write). The monitor handles this gracefully:

- While a previously-available file is missing, the callback is **not** fired.
- Multiple checks during the unavailability window do not accumulate spurious callback invocations.
- When the file reappears, the next check fires the callback exactly once.

This ensures the monitor recovers from transient filesystem states without crashing or producing duplicate reload events.

## Constraints

- The callback is only fired when the file is available at check time; unavailable files are silently skipped without error.
- A file that has never existed does not cause an exception on any check operation.
- The monitor must survive the full lifecycle of a watched file: creation, modification, deletion, and re-creation.
- Each check cycle produces at most one callback invocation regardless of how many watched paths changed.
