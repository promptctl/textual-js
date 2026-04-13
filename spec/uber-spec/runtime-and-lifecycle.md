# Runtime And Lifecycle

## App Role

`App` is the process root and runtime coordinator. Its behavior includes:

- starting and stopping the runtime
- creating and owning the active driver
- loading and reloading CSS
- owning screen stacks and screen modes
- coordinating notifications, themes, workers, timers, and command palette behavior
- publishing app-level lifecycle and state-change signals

Primary entry points:

- `run()`
- `run_async()`
- `run_test()` for in-process scripted testing

## Screen Model

Screens are stacked view roots. Textual supports:

- pushing, popping, and switching screens
- retaining installed screens for reuse
- separate stacks per mode, with exactly one active mode at a time
- one active screen at a time for user interaction and rendering
- suspend/resume transitions as screens become inactive or active, emitted as `ScreenSuspend`/`ScreenResume` messages
- maximized-view behavior controlled jointly by app and screen settings
- `push_screen(..., wait_for_dismiss=True)` only inside a worker, returning a future resolved by the screen's dismissal
- invalid stack operations are loud: popping the last screen, switching to an unknown mode, removing the active mode, or uninstalling a screen still on a stack all raise rather than silently no-op

`Screen.ALLOW_IN_MAXIMIZED_VIEW` and `App.ALLOW_IN_MAXIMIZED_VIEW` are different knobs:

- screen-level behavior decides what this screen allows around a maximized widget
- app-level behavior supplies the default

The default app-level value is `"Footer"`.

Screen lifetime authority is the per-mode screen stacks plus the installed-screen registry; no secondary ownership store exists.

## Run Lifecycle

Every run goes through the same fixed sequence regardless of entry point:

1. Activate the app context (binding the active-app and active-message-pump context vars for the duration of the run).
2. Load CSS from class-level sources, path sources, and default widget CSS; dispatch `events.Load` as a pre-driver hook. A load failure aborts startup before the driver is built.
3. Build and start the driver, redirecting stdout/stderr to app-owned capture sinks.
4. Under a batched update: dispatch `Compose` (which initializes the current mode's base screen and mounts the app's composed children), synthesize an initial `Resize`, apply the stylesheet, dispatch `Mount`, mark the app mounted, initialize reactives, and start the animator.
5. Run the message loop until exit.
6. On loop exit, cancel workers, stop the animator and timers, and proceed to shutdown.

Variation between runs comes from data (CSS sources, composed widgets, exit flag set during load) rather than from skipping steps. Context activation happens in exactly one place so that `active_app` / `active_message_pump` lookups have a single binding authority.

## Batch Updates

`batch_update()` is a context manager that suppresses layout and repaint work until the outermost batch exits; nested batches are counted. `delay_update(delay)` opens a batch and closes it on a scheduled timer, refreshing the screen on completion. Batches are the single mechanism for coalescing repaint work across the runtime.

## Suspend and Resume

- `suspend()` is a context manager requiring an active driver that advertises suspend support; environments without it raise `SuspendNotSupported`. It publishes the suspend signal, hands the terminal back to the host, restores real stdout/stderr, yields, then re-enters application mode, publishes the resume signal, and forces a full refresh.
- `action_suspend_process()` (Unix only) publishes the suspend signal and raises `SIGTSTP`; the driver republishes the resume signal via a `SignalResume` event when the process is foregrounded.

## Shutdown

`App.exit(...)` records the return value, return code, and any exit renderable, then posts an `ExitApp` message. Handling `ExitApp` opens an unterminated batch (suppressing further repaints for the rest of the process) and terminates the message loop.

Shutdown itself runs deterministically under `asyncio.shield` so that cancellation cannot interrupt it:

- disable driver input
- for every mode stack, prune and clear the running screens; clear the installed-screen registry and the mode registry
- close the app's own message pump and dispatch `Unmount`
- close the driver
- clear the app's DOM children
- disconnect devtools if connected
- print any queued panic/exit renderables to the original stderr/stdout
- optionally pretty-print the stored return value

Successful shutdown is machine-checkable: the runtime is no longer running, every mode stack is empty, the installed-screen and mode registries are empty, and the driver is closed.

## Notifications

Notifications have two layers:

- a logical notification model with identity, severity, timeout, and collection behavior
- a visual toast presentation

`App.notify(...)` is the app-level entry point for creating notifications, and `clear_notifications()` clears the active collection. Individual notifications can be removed one at a time. Expiry is lazy: each notification's remaining time is computed on collection access rather than driven by a timer. Toast rendering is the UI projection of that state, not the ownership boundary for notification behavior.

## Themes And Signals

App-level theme changes and key lifecycle transitions are observable through published signals and through user-visible side effects such as stylesheet variable updates and screen/view refresh.

The app-level signal surface includes:

- theme changes
- suspend and resume
- mode changes
- screen changes

## Testing Surface

`run_test()` and `Pilot` are part of the framework behavior.

- headless execution
- scripted key, mouse, and resize interaction
- wait helpers for idle and animation coordination
- exception propagation back into the test harness
- deterministic inspection of widget state during a running test session
