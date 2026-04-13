# Testability and Automation Surfaces

## Headless Test Runtime

`App.run_test(...)` is the primary in-process test harness. It is an async context manager that yields a `Pilot` bound to a running app.

Contract:

- runs the app under the headless driver by default (`headless=True`),
- forces a deterministic terminal size (default `(80, 24)`; `None` auto-detects),
- disables tooltips and notifications by default (`tooltips=False`, `notifications=False`) so test output is not polluted by transient UI,
- accepts an optional `message_hook` callable that is installed into `message_hook_context_var` for the duration of the run and is invoked for every message observed by any message pump in the app,
- spawns the app's message loop as a background task, waits for the app-ready callback before yielding the `Pilot`, and calls `pilot._wait_for_screen()` once before the test body runs so the first screen is fully mounted,
- on exit, performs an `await asyncio.sleep(0)` yield, runs `App._shutdown()`, awaits the background task, and re-raises `App._exception` if one was captured so test frameworks see the original failure.

`run_test` does not take an `auto_pilot` callback; autopilot is a feature of `run_async`/`run`, not of `run_test`.

Headless runs use `textual.drivers.headless_driver.HeadlessDriver`, which still delivers resize events and supports full message dispatch but produces no terminal output.

## Pilot Interface

`textual.pilot.Pilot` provides async interaction methods over a running app. It holds a reference to the app (`pilot.app`) and exposes:

- keyboard: `press(*keys)` — forwards to `App._press_keys` and then waits for the screen to settle,
- pointer press/release: `mouse_down(...)`, `mouse_up(...)` — synthesize a `MouseMove` followed by a `MouseDown`/`MouseUp`,
- pointer click: `click(...)`, `double_click(...)`, `triple_click(...)` — synthesize `MouseDown` -> `MouseUp` -> `Click` sequences; `double_click` and `triple_click` are thin wrappers that set `times=2`/`times=3`,
- pointer hover: `hover(...)` — pauses first so the mouse "settles," then synthesizes a `MouseMove`,
- terminal resize: `resize_terminal(width, height)` — updates `HeadlessDriver._size` when running headless and then posts a `Resize` event to the app,
- idle/settling: `pause(delay=None)` — waits for the screen to drain, then either sleeps `delay` seconds or waits for CPU idle, then pokes the screen timer,
- animation waits: `wait_for_animation()` (current animations only) and `wait_for_scheduled_animations()` (drains screen, waits for the animator to complete, drains again, waits for idle, and pokes the screen timer),
- graceful shutdown: `exit(result)` — drains the screen, waits for idle, then calls `App.exit(result)`.

All pointer helpers accept an optional `widget` selector (instance, `Widget` subclass, or CSS query string) plus an `offset`; the target offset is resolved relative to the widget's region (or the screen when no widget is given) and must lie inside the visible screen.

Return semantics for pointer helpers: they return `True` when no selector was specified or when the widget under the resolved coordinate is the requested target, `False` otherwise. This lets tests assert "the click actually landed on the intended widget."

Errors:

- `OutOfBounds` — raised by any pointer helper when the resolved coordinate is outside the visible screen region,
- `WaitForScreenTimeout` — raised by `_wait_for_screen` (default 30s timeout) when queued `call_later` callbacks never drain, indicating a deadlock-like stall.

Synthetic pointer routing is intentionally not uniform:

- mouse helpers bypass `App.on_event` and inject events directly via `Screen._forward_event`,
- because `App.on_event` normally maintains `App.mouse_position`, the pilot patches `app.mouse_position` itself before forwarding each event so tooltip and hover logic still see the right coordinate,
- `resize_terminal` mutates the headless driver's size field first so subsequent layout math sees the new size, then posts the `Resize` event through the normal pump.

// [LAW:dataflow-not-control-flow] Pilot still drives deterministic message sequences; the "bypass" is a lower injection point into the same dispatch pipeline, not a parallel control path.

## Awaitable Coordination Helpers

### `AwaitComplete`

- wraps one or more awaitables,
- can be scheduled with `call_next` before awaiting,
- includes a pre-await callback hook used for deadlock checks,
- supports state inspection (`is_done`, `exception`).

### `AwaitRemove`

- waits for prune/removal task completion,
- optional post-remove callback invocation,
- returned by widget/screen removal APIs.

// [LAW:verifiable-goals] These awaitable helpers create machine-checkable completion boundaries for UI state transitions, which is what lets pilot-driven tests assert "the mutation has finished" without polling.

## Import and CLI Bootstrapping Surfaces

### `textual._import_app.import_app`

Resolves an app target from a string and returns a live `App` instance. Behavior:

- accepts `module.path` or a filesystem path ending in `.py` (also detected via `#!` shebang containing `python`),
- supports `target:attribute` to pick a specific binding,
- for file paths: loads via `runpy.run_path`, appends the file's parent to `sys.path`, rewrites `sys.argv` to `[path, *extra_argv]` parsed from the import string,
- for module paths: imports via `importlib.import_module`, rewrites `sys.argv` to `[import_name, *extra_argv]`,
- when no attribute is given: prefers a binding named `app`, otherwise scans the module namespace for a single `App` subclass or instance (raising `AppFail` for zero or multiple matches),
- instantiates the target if it is an `App` subclass rather than an instance,
- raises `AppFail` for any resolution or import failure so CLI callers get a single, typed failure mode.

### `textual.__main__`

Top-level module entrypoint: constructs `DemoApp()`, runs it, and on exit prints a sponsor panel via Rich. This is a direct runner, not a subcommand dispatcher — there is no argument parser, no `run`/`demo` subcommand, and no alternate targets.

### `textual.demo.__main__`

The `textual.demo` package also has its own `__main__` that simply constructs and runs `DemoApp()` (no sponsor panel). Invoking `python -m textual.demo` is equivalent to running the demo app directly.

### `textual._doc`

Documentation tooling (`format_svg`, `take_svg_screenshot`) drives apps through `Pilot` to produce deterministic SVG screenshots for the docs. It:

- imports apps via `import_app`,
- runs them with `app.run(headless=True, auto_pilot=..., size=...)`,
- inside the autopilot, replays key presses, optional hover, and `wait_for_scheduled_animations()` before calling `App.export_screenshot()`,
- caches rendered SVGs on disk keyed by a hash of the app source, CSS, press/hover/title/size, so repeated doc builds are idempotent.

This is the canonical example of an autopilot-driven, non-test automation surface sharing the same `Pilot` contract as `run_test`.

## Print and Error Capture in Tests

- the app redirects stdout/stderr via capture streams during runtime so `print()` from widgets does not corrupt terminal output,
- panic/fatal paths collect renderables and expose deterministic shutdown behavior; `run_test` surfaces the captured exception by re-raising `App._exception` after shutdown,
- debug mode controls the number and detail of emitted error renderables.

## Determinism Expectations for Automation

- message pumps process `Compose`/`Mount` before normal loop work, so `run_test` can guarantee the first screen is mounted before the test body runs,
- refresh/layout/scroll changes are idle-driven and observable via `pilot.pause()` / `pilot.wait_for_animation()` / `pilot.wait_for_scheduled_animations()`,
- the headless driver emits resize events and supports the full message dispatch pipeline, so tests that depend on layout reacting to size changes work identically to live runs,
- `message_hook_context_var` is the single, documented seam for observing every message dispatched during a test without subclassing the app.

// [LAW:one-source-of-truth] `Pilot` is the single automation surface shared by tests (`run_test`), documentation screenshots (`_doc.take_svg_screenshot`), and ad-hoc autopilot runs (`run_async(auto_pilot=...)`). New automation needs should extend `Pilot`, not add a parallel driver.
