# App

The `App` class is the top-level object for a Textual application. It manages the lifecycle, screen stack, focus state, theming, and event dispatch for the entire TUI.

## Construction

### Instantiation

- `App()` can be instantiated without arguments.
- `App` is generic over a return type: `App[int]`, `App[None]`, etc. The type parameter determines what `exit()` returns via `run()` / `run_async()`.
- Accepts an `ansi_color` boolean parameter controlling ANSI color behavior.
- Accepts a `driver_class` parameter to override the default terminal driver.

### Title and Sub-title

- `app.title` coerces any assigned value to a string via `str()`. Assigning `None` produces `"None"`, assigning a number produces its string form, assigning a list produces the list's string representation.
- `app.sub_title` follows the same coercion rules as `title`.

## Running

### Synchronous Run

- `app.run()` starts the application synchronously and returns the exit value.
- `app.run()` accepts an optional `loop` argument to supply a custom `asyncio` event loop.
- `app.run()` works correctly even after a prior `asyncio.run()` call in the same process.
- `app.run(inline=True, inline_no_clear=True)` runs the app in inline mode.

### Asynchronous Run

- `app.run_async()` starts the application as a coroutine and returns the exit value.

### Test Harness

- `async with app.run_test() as pilot` provides a `Pilot` object for programmatic interaction during tests.

## Lifecycle

### Exit

- `app.exit()` terminates the application.
- Calling `exit()` during `on_mount` (early exit) completes without errors in both normal and inline modes.
- `app.exit(return_code=N)` sets the numeric return code.

### Return Code

- Before running, `app.return_code` is `None`.
- While running, `app.return_code` is `None`.
- After a normal exit, `app.return_code` defaults to `0`.
- After a crash (unhandled exception in a handler), `app.return_code` is `1`.
- `app.exit(return_code=N)` causes `app.return_code` to be `N` after shutdown.

### Batch Update

- `app.batch_update()` is a nestable context manager that increments/decrements an internal batch counter.
- The counter starts at 0, increments on enter, decrements on exit, and supports arbitrary nesting depth.

## Screen Stack

### get_screen_stack

- `app.get_screen_stack()` returns a list of `Screen` objects currently on the stack.
- Initially contains a single default screen with id `"_default"`.
- After `app.switch_mode("foo")`, the stack reflects the new mode's screen.

## Focus and Blur

### AUTO_FOCUS

- The `AUTO_FOCUS` class variable accepts a CSS selector string. On mount, the matching widget receives focus.

### AppBlur Event

- When the application receives an `AppBlur` event, the currently focused widget loses focus (`app.focused` becomes `None`).

### AppFocus Event

- When the application receives an `AppFocus` event after a blur, the previously focused widget is restored.
- If nothing was focused before the blur, focus remains `None` after `AppFocus`.
- If the previously focused widget has been removed from the DOM, focus remains `None` after `AppFocus`.
- If a new widget was explicitly focused while in the blurred state, `AppFocus` defers to that new focus rather than overwriting it with the stale reference.

## Hover and Pointer

### Hover Pseudo-class

- Hovering over a widget adds the `"hover"` pseudo-class to that widget's pseudo-class set and triggers a style update (e.g., background color change).

### Pointer Shape

- The pointer shape on the screen updates based on the widget under the cursor (e.g., `"default"` for static content, `"pointer"` for buttons).

## Click Chain

### Multi-click Detection

- Repeated clicks on the same widget within the `CLICK_CHAIN_TIME_THRESHOLD` produce escalating `event.chain` values (1 for single, 2 for double, 3 for triple).
- Clicking different widgets resets the chain to 1 regardless of timing.
- If a chain is in progress and the next click targets a different widget, the chain resets.
- If clicks exceed the time threshold, every click is treated as a single click (chain = 1).
- `CLICK_CHAIN_TIME_THRESHOLD` is a class-level constant (float, in seconds) that controls the maximum interval between clicks for chain detection.

## Theming

### ANSI Theme

- `app.ansi_theme` reflects the active ANSI color theme based on the current light/dark mode.
- `app.ansi_theme_dark` and `app.ansi_theme_light` set themes independently per mode.
- Changing the dark theme while in light mode does not affect `app.ansi_theme` until switching back to dark mode.
- Switching `app.theme` between `"textual-dark"` and `"textual-light"` selects the corresponding ANSI theme.

## Suspend

### Suspend Context Manager

- `app.suspend()` is a context manager that pauses the TUI, yields control to the caller for raw terminal I/O, then resumes.
- Inside the suspend block, stdout and stderr are available for normal use.

### Driver Support

- If the driver does not support suspend (e.g., the headless driver), `app.suspend()` raises `SuspendNotSupported`.
- A driver supports suspend when `driver.can_suspend` is `True` and `driver.is_headless` is `False`.

### Signals

- Suspending fires `app.app_suspend_signal`; resuming fires `app.app_resume_signal`.
- Subscribers receive both signals within the same suspend/resume cycle.
- The driver's `suspend_application_mode()` and `resume_application_mode()` methods are called around the yielded block.

## Command Search

### search_commands

- `app.search_commands(commands)` opens a command palette with the given commands.
- Accepts a list of `SimpleCommand` named tuples (name, callback, help text) or plain tuples (name, callback).
- Selecting and confirming a command invokes its callback.
- Passing an empty list does not crash.

## Features and Constants

### TEXTUAL Environment Variable

- The `TEXTUAL` environment variable is a comma-separated list of feature flags.
- An empty string yields an empty feature set, `devtools` is `None`, and `debug` is `False`.
- `"devtools"` enables the devtools feature; `app.devtools` becomes non-None.
- `"debug"` (requires `"devtools"`) sets `app.debug` to `True`.
- Whitespace around feature names is tolerated (e.g., `"devtools, debug"`).

### Environment Helpers

- `_get_environ_int(name, default, minimum=)` reads an integer from the environment, clamping to the given minimum.
- `_get_environ_bool(name)` reads a boolean: only `"1"` is `True`; everything else is `False`.
- `_get_environ_port(name, default)` reads a port number; values outside 0..65535 fall back to the default.

## Widget Disabled State

### Enabled and Disabled Pseudo-classes

- Widgets start out enabled; every widget in a freshly composed app has `disabled = False`.
- An enabled widget has the `:enabled` pseudo-class and does not have `:disabled`.
- Setting `widget.disabled = True` adds the `:disabled` pseudo-class and removes `:enabled`.

### Container Disabling Propagates to Children

- Disabling a container causes all its child widgets to display as `:disabled` (for CSS purposes) even though their own `disabled` flag is not changed.
- Children that are focused lose focus when their container is disabled.

## Widget Loading State

### Loading Disables Scrollbars

- Setting `widget.loading = True` marks the widget as disabled (disables scrollbar interaction).

### Setting Loading Before Mount

- A widget's `loading` attribute can be set to `True` before the widget is mounted without causing an error.

## Widget Mounting

### Render Only After Mount

- A widget's `render` method is not called until after the widget's `on_mount` handler has completed.

## Shutdown

### Deadlock Safety

- An app containing widgets with complex teardown (e.g., `Footer` + `Tree` inside containers) shuts down without deadlocking.

## Constraints

- `title` and `sub_title` are always strings after assignment; the app never stores the raw non-string value.
- `return_code` transitions from `None` (pre/during run) to an integer (post run); it is never an integer while the app is active.
- Focus restore on `AppFocus` must not override an explicit focus change made while blurred.
- Click chain state must reset when the click target changes, regardless of timing.
- Suspend requires driver cooperation; the app must not attempt to suspend on drivers that do not support it.
- Environment helpers must enforce their documented domains (minimum for ints, 0..65535 for ports, strict `"1"` for bools) and never pass invalid values through.

<!-- Topics that may warrant their own spec files:
  - spec/screen.md — Screen class, screen stack, modes, screen-level focus management
  - spec/pilot.md — Pilot test harness, simulated input (click, hover, press, pause)
  - spec/events.md — Event system, event dispatch, pseudo-classes, mouse events, click events
  - spec/widgets.md — Widget base class, compose, mount/unmount, remove, query
  - spec/driver.md — Driver interface, headless driver, suspend/resume protocol
  - spec/command-palette.md — Command palette, SimpleCommand, search_commands
  - spec/themes.md — Theme system, ANSI themes, dark/light mode switching
  - spec/constants.md — Environment variable parsing helpers (_get_environ_int, _get_environ_bool, _get_environ_port)
-->
