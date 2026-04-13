# App Runtime and Lifecycle

## Core Type

`textual.app.App[ReturnType]` is the runtime root. It inherits from `DOMNode` and is both a generic over its return value and the owner of:

- driver lifecycle and application-mode entry/exit,
- per-mode screen stacks and installed-screen registry,
- global action dispatch and binding chain composition,
- CSS source loading, live reload, and reparse,
- notifications, themes, command palette, suspend/resume, and shutdown sequencing.

## Class-Level Configuration Surface

Important class vars exposed by `App` (see `src/textual/app.py` around lines 296–525):

- CSS and styling: `CSS`, `DEFAULT_CSS`, `CSS_PATH`. `ansi_color` is an instance reactive, while `ansi_theme_light` / `ansi_theme_dark` select the `rich.terminal_theme.TerminalTheme` used by the ANSI-to-truecolor filter.
- navigation: `MODES`, `SCREENS`, `DEFAULT_MODE` (defaults to `"_default"`), `AUTO_FOCUS`.
- input/action: `BINDINGS`, `COMMANDS`, `COMMAND_PALETTE_BINDING`, `COMMAND_PALETTE_DISPLAY`, `ENABLE_COMMAND_PALETTE`.
- UX behavior: `ALLOW_SELECT`, `ALLOW_IN_MAXIMIZED_VIEW`, `ESCAPE_TO_MINIMIZE`, `HORIZONTAL_BREAKPOINTS`, `VERTICAL_BREAKPOINTS`, `CLICK_CHAIN_TIME_THRESHOLD`, `SUSPENDED_SCREEN_CLASS`.
- runtime knobs: `TOOLTIP_DELAY`, `NOTIFICATION_TIMEOUT`, `INLINE_PADDING`, `PAUSE_GC_ON_SCROLL`, `ENABLE_SELECT_AUTO_SCROLL`, `SELECT_AUTO_SCROLL_LINES`, `SELECT_AUTO_SCROLL_SPEED`.

// [LAW:one-source-of-truth] The class attributes listed above are the sole declarative inputs consulted during instance initialization; instance overrides feed back into the same fields.

## Runtime Responsibilities at Initialization

When an `App` instance is created (`App.__init__`, `app.py:560`), it prepares the runtime services needed to execute consistently:

- Rich `Console` bound to a `_NullFile` sink (the app writes via the driver, not the console), plus a stderr `error_console`.
- `WorkerManager`, `Animator`, `Stylesheet` (seeded with theme-derived CSS variables), and the app-level line-filter chain (`ANSIToTruecolor`, optional `NoColor`/`Monochrome`/`DimFilter`).
- Driver class selection via `driver_class` argument or `get_driver_class()`.
- `_screen_stacks` initialised as `{DEFAULT_MODE: []}` and `_current_mode` set; `_installed_screens` is seeded from the class-level `SCREENS` map; `_modes` is copied from `MODES`.
- Registered themes from `BUILTIN_THEMES` plus any later `register_theme` calls; `-dark-mode`/`-light-mode` DOM classes set from the current theme.
- Lifecycle state flags: `_running`, `_exit`, `_return_value`, `_return_code`, `_dom_ready`, `_batch_count`, `_exception`.
- Signals published on the app: `theme_changed_signal`, `app_suspend_signal`, `app_resume_signal`, `mode_change_signal`, `screen_change_signal`.
- Optional `FileMonitor` for `watch_css`/`debug` reload, optional devtools client wiring when the `devtools` feature flag is set.
- If `ENABLE_COMMAND_PALETTE` is true and no binding already targets `command_palette`, a priority binding is synthesised from `COMMAND_PALETTE_BINDING`.

## Startup/Run Lifecycle

### Entry points

- Synchronous run: `App.run(...)` — dispatches to `run_async` via `asyncio.run` or an existing loop (`app.py:2272`).
- Async run: `App.run_async(...)` — captures the running loop, enables eager task factory when available, sets the app context vars via `_context()`, runs `_process_messages`, then always runs `_shutdown()` inside `asyncio.shield` (`app.py:2184`).
- Test harness: `App.run_test(...)` (`app.py:2097`) wraps `run_async` with headless defaults, message hook, and a Pilot-driven auto-pilot.

### Context activation

`App._context()` is a single context manager that sets the `active_app` and `active_message_pump` `ContextVar`s defined in `textual._context` for the duration of a run. All code that looks up the current app/pump via `textual._context.active_app` / `active_message_pump` depends on this being active.

// [LAW:single-enforcer] `_context()` is the one place that binds the active-app/active-pump context vars during a run.

### Startup phases

Executed inside `_process_messages` (`app.py:3328`):

1. `_thread_init()` records the running thread id.
2. `app_prelude()`: connect devtools if enabled, read CSS from `css_path`, add `_get_default_css` sources, and add the class-level `CSS` string as a source. Any exception aborts startup (return False → no driver is started). If `css_monitor` is configured, schedule it at 0.25s.
3. Dispatch an `events.Load` message to the app (pre-driver initialization hook).
4. Build the driver via `_build_driver(headless, inline, mouse, size)`. If `_exit` was set during load, the driver is never started.
5. `driver.start_application_mode()`, then redirect stdout/stderr to `_capture_stdout`/`_capture_stderr` for the duration of the run.
6. Inside `batch_update()`, run `run_process_messages()`:
   - Dispatch `events.Compose` — `App.on_event` handles this by calling `_init_mode(current_mode)` to create and push the mode's base screen, then delegates to `super().on_event` which triggers `_on_compose` to mount the app's own composed widgets onto the screen.
   - Dispatch an initial `events.Resize` synthesised from `self.size`.
   - Apply the stylesheet to the app, dispatch `events.Mount`, then `check_idle`.
   - Mark `_mounted_event` and `_is_mounted = True` (in a `finally`, so it happens even on failure).
   - Initialize reactives (`Reactive._initialize_object(self)`).
   - If composing mounted a different default screen, re-apply stylesheet to it.
   - Start the animator.
   - Under `finally`: set `_running = True`, call `_ready()` (logs ready time, schedules screenshot timer if configured), then invoke the optional `ready_callback`.
7. Run `_process_messages_loop()` (inherited from `MessagePump`). On completion (normal or `CancelledError`): cancel all workers, stop the animator, stop all timers.
8. On teardown: clear Reactive watchers; if the driver is inline, emit the cursor-reset control sequences and optionally print the final compositor; call `driver.stop_application_mode()`.

// [LAW:dataflow-not-control-flow] The startup sequence is fixed: every run executes load → driver build → application mode → Compose → Resize → stylesheet apply → Mount → animator → message loop. Variation comes from data (css sources, composed widgets, `_exit` flag) rather than from skipping steps.

### Input routing

`App.on_event` (`app.py:4024`) is the top-level router for messages that bubble back to the app:

- `events.Compose`: triggers `_init_mode` before falling through to the inherited `on_event`, guaranteeing the mode's base screen exists before app-level composition runs.
- `events.InputEvent` (only when `is_forwarded` is false):
  - Non-focus `Key`/`MouseDown` events flip `app_focus` to True.
  - `MouseEvent`: update `mouse_position` and `mouse_position_high_resolution`; on `MouseDown` record `_mouse_down_widget` via `get_widget_at`; forward to the current screen. On `MouseUp`, if the hit target matches the recorded mouse-down widget, synthesise a `Click` event (with chain count derived from `_click_chain_last_offset` + `CLICK_CHAIN_TIME_THRESHOLD`) and forward it to the screen.
  - `events.Key`: if a widget is maximized, `escape_to_minimize` is true, and the key is `escape`, minimize and stop routing. Otherwise, clear any focused tooltip, check **priority** app/screen bindings via `_check_bindings(priority=True)`, and if not consumed forward to the focused widget or screen.
  - Other input events forward to the current screen.
- `events.Paste` (only when not forwarded): forward to the focused widget if any, otherwise the current screen.
- All other events delegate to `super().on_event`.

Non-priority bindings are checked later in `_on_key` (`app.py:4305`) via `_check_bindings(key)` followed by `dispatch_key` for methods named `on_key_*`.

// [LAW:single-enforcer] Binding dispatch is enforced in exactly one place — `App._check_bindings` walks `Screen._binding_chain` (priority) or `Screen._modal_binding_chain` and delegates to `run_action`.

## Mode and Screen Stack Semantics

### Mode model

- Each mode owns an independent screen stack inside `_screen_stacks`.
- Exactly one mode is active at a time (`_current_mode`).
- `switch_mode(mode)` is a no-op when `mode == _current_mode`; otherwise it calls `delay_update`, posts `ScreenSuspend` to the current screen, initialises the target mode stack if absent (`_init_mode`), swaps `_current_mode`, reapplies CSS if the new screen's `_css_update_count` is stale, publishes `mode_change_signal` and `screen_change_signal`, sends a screen resize, and posts `ScreenResume`.
- `add_mode(name, base_screen)` registers a mode class (rejects `"_default"` and duplicates, and rejects passing a Screen **instance**).
- `remove_mode(name)` rejects the active mode and schedules all screens in that mode's stack for pruning via `_replace_screen`.

### Screen stack operations

- `push_screen(screen_or_name, callback=None, wait_for_dismiss=False, *, mode=None)` resolves the target mode's stack (raising `UnknownModeError` for unknown modes), posts `ScreenSuspend` to the previously active screen (if any), calls `_get_screen` (which registers the screen lazily if not yet running), loads screen-scoped CSS via `_load_screen_css`, appends to the stack, posts `ScreenResume` if the new screen is active, and publishes `screen_change_signal`. When `wait_for_dismiss=True`, it must run under a worker and returns a future resolved by `Screen.dismiss`.
- `switch_screen(screen_or_name)` replaces the top of the current mode's stack. It is a no-op if the target is already current; otherwise it pops the top, pops its result callback, loads CSS for the new screen, appends the new screen, posts `ScreenResume`, publishes `screen_change_signal`, and asynchronously runs `_replace_screen(top_screen)` to suspend/remove the old top.
- `pop_screen()` requires stack depth > 1 (raises `ScreenStackError` otherwise), pops the top, posts `ScreenResume` to the now-active screen, publishes `screen_change_signal`, and schedules `_replace_screen` on the popped screen.
- `install_screen(screen, name)` registers a retained screen instance (raises `ScreenError` on duplicate name or duplicate instance).
- `uninstall_screen(screen_or_name)` is a null-op for unknown names; raises `ScreenStackError` if the screen is still on any mode stack; otherwise removes it from the installed registry.
- `_replace_screen(screen)` posts `ScreenSuspend`; if the screen is neither installed nor present in any stack, it releases mouse capture and removes the screen.

`ScreenResume` and `ScreenSuspend` messages notify screens of transitions; `screen_change_signal` and `mode_change_signal` broadcast the current state to external subscribers.

// [LAW:one-source-of-truth] Screen lifetime authority is the per-mode `_screen_stacks` dict plus the `_installed_screens` registry; no secondary ownership store exists.

## Theming and CSS Runtime

- Theme registry: built-ins loaded in `__init__`, plus `register_theme(theme)` / `unregister_theme(name)`. The currently-selected built-in default cannot be unregistered.
- `theme` reactive selects the current theme by name; `_watch_theme` validates the name, rebuilds `theme_variables`, updates the `-dark-mode`/`-light-mode` DOM classes, calls `_invalidate_css()`, and publishes `theme_changed_signal`.
- `get_css_variables()` merges theme-derived variables with `get_theme_variable_defaults()` overrides.
- `refresh_css(animate=True)` reparses the stylesheet and reapplies styles to the app and all screens on the active stack.
- Live reload: when `css_monitor` detects a change, `_on_css_change` reparses a copied stylesheet and, on success, swaps it in and calls `stylesheet.update` for the app and every screen in the current mode's stack. Parse failures are logged and ring the bell; subsequent parses report recovery.

## Actions and Binding Dispatch

- `run_action(action, default_namespace=None, namespaces=None)` parses the action via `_parse_action`, which accepts either a pre-parsed tuple or delegates to `actions.parse`. The namespace is resolved from the explicit `namespaces` map, then from `_action_targets = {"app", "screen", "focused"}` when the destination matches, falling back to `default_namespace` (which defaults to `self` in `run_action`).
- Action availability is gated by `DOMNode.check_action`; actions returning `False` are skipped and `run_action` returns `False`.
- `_dispatch_action` always prefers a private handler `_action_<name>` over the public `action_<name>`; the first callable it finds is invoked via `invoke` and the method returns `True`.
- `SkipAction` raised inside an action handler is logged and treated as non-handling, allowing higher-level fallback behavior.
- `_broker_event` allows the app to drive the action system from event `style.meta` handler strings (e.g. `@click="..."`).

// [LAW:single-enforcer] All action invocation flows through `_dispatch_action`; there is no parallel path that invokes `action_*` methods directly from input handling.

## Notifications

- `notify(message, *, title, severity, timeout, markup)` constructs a `Notification`, adds it to the app-level `_notifications` collection, and posts a `Notify` message (`app.py:4577`).
- `_on_notify` refreshes the on-screen toast rack by calling `_refresh_notifications`, which finds the screen's `ToastRack` (when present) and hands it the current notifications.
- Notifications expire lazily: expiry is computed on collection access via each notification's `time_left`/`has_expired` fields.
- `clear_notifications()` drops all notifications; `_unnotify(notification)` removes a single one and optionally refreshes.

## Batch Updates

`batch_update()` is a context manager that calls `_begin_batch()` on entry and `_end_batch()` on exit; the latter triggers `check_idle()` when the batch count returns to zero. `delay_update(delay)` starts a batch and ends it via a scheduled timer, refreshing the screen on completion. During shutdown, `_begin_batch()` is called without a matching `_end_batch`, deliberately suppressing all repaint/layout work for the remainder of the process.

## Suspend and Resume

- `suspend()` is a context manager that requires an active driver with `can_suspend`. It publishes `app_suspend_signal`, calls `driver.suspend_application_mode()`, enters `driver.no_automatic_restart()` while redirecting stdout/stderr back to the real streams, yields, resumes application mode, publishes `app_resume_signal`, and forces a full refresh. Environments without suspend support raise `SuspendNotSupported`.
- `action_suspend_process()` (Unix only) publishes the suspend signal and sends `SIGTSTP` to the current process. The resume signal is published later by the driver via a `SignalResume` event handled by `_resume_signal`.

## Shutdown

`App.exit(result=None, return_code=0, message=None)` (`app.py:1251`) sets `_exit = True`, stores the return value/code, appends any exit renderable, and posts `messages.ExitApp`. The handler `_on_exit_app` calls `_begin_batch()` (suppressing further repaints) and pushes `None` onto the message queue to terminate `_process_messages_loop`.

`_shutdown()` (`app.py:3701`), always executed under `asyncio.shield` from `run_async`, runs deterministically:

1. `_begin_batch()` — prevents any layout/repaint for the rest of shutdown.
2. Clear `_running`; if a driver exists, `driver.disable_input()`.
3. `_close_all()`: for every mode stack, prune running screens (`_prune`) and clear the stack; clear `_installed_screens` and `_modes`; close any remaining registered nodes via `_close_messages`.
4. `_close_messages()` on the app itself.
5. Dispatch `events.Unmount`.
6. `driver.close()` if a driver exists.
7. Clear the app's own DOM children (`_nodes._clear()`).
8. Disconnect devtools if connected.
9. `_print_error_renderables()` — prints queued panic/exit renderables to the original stderr/stdout.
10. If `SHOW_RETURN` is set, pretty-print the stored return value.

// [LAW:verifiable-goals] Successful shutdown is machine-checkable: `_running` is false, every mode stack is empty, `_installed_screens` and `_modes` are empty, the driver is closed, and the message queue has been drained.
