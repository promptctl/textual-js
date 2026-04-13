# Auto-Refresh

Textual provides a mechanism for widgets and apps to refresh themselves on a periodic timer without requiring manual timer setup.

### Setting the Refresh Interval

The `auto_refresh` attribute can be set on an `App` (and by extension, widgets) to a numeric value representing the refresh interval in seconds. Setting `auto_refresh = 0.1` causes the app to refresh every 100 milliseconds.

The attribute can be set at any point during the app lifecycle, including from `on_mount`.

### The `automatic_refresh` Callback

Each time the auto-refresh interval elapses, the `automatic_refresh` method is called. Subclasses can override this method to perform work on each refresh tick. Overrides should call `super().automatic_refresh()` to preserve the default refresh behavior.

### Timing Behavior

The refresh fires repeatedly at the configured interval. For example, with `auto_refresh = 0.1`, three refresh cycles complete within approximately 0.2 to 0.8 seconds (accounting for scheduling jitter and system load).

### Exiting from a Refresh Callback

An app can call `self.exit(result)` from within `automatic_refresh` to terminate the application and return a result value. This allows refresh-driven logic to control the app lifecycle.

## Constraints

- `auto_refresh` is specified in seconds as a float.
- `automatic_refresh` must call `super().automatic_refresh()` when overridden, to ensure the underlying refresh mechanism continues to operate.
- The auto-refresh timer is not perfectly precise; actual intervals may vary depending on system load and event loop scheduling.
- Setting `auto_refresh` begins the periodic cycle immediately; there is no separate start/stop API exposed by the tests.
