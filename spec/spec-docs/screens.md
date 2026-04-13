# Screens Spec

This spec defines the behavior of Textual's screen management system: the Screen class, the screen stack, push/pop/switch operations, screen modes, modal screens, screen results, CSS, events, and focus management.

---

## Screen Class

### Screen is a special widget that fills the terminal

- A Screen occupies the full dimensions of the terminal; its size cannot be modified via CSS.
- Screens are containers for widgets. An app has at least one screen at all times.
- If no explicit screen is configured, the app creates a default screen automatically.
- Widgets composed or mounted without specifying a screen are added to the default screen.

### Screen class variables

- `AUTO_FOCUS`: CSS selector string determining which widget receives focus when the screen is activated. Set to `None` to inherit from the app, `""` to disable auto-focus.
- `CSS`: Inline CSS string. Rules apply to the whole app, not just the screen. Takes priority over `CSS_PATH`.
- `CSS_PATH`: File path(s) to load CSS from. Rules apply to the whole app.
- `TITLE`: Default title for the screen, overrides the app title. Can be updated at runtime via the `title` reactive attribute.
- `SUB_TITLE`: Default sub-title for the screen, overrides the app sub-title. Can be updated at runtime via the `sub_title` reactive attribute.
- `COMMANDS`: Set of command provider classes for the command palette, scoped to the screen.
- `BINDINGS`: Key bindings for the screen. Default bindings include Tab/Shift+Tab for focus navigation and Ctrl+C/Super+C for copy.
- `HORIZONTAL_BREAKPOINTS`: Horizontal breakpoints that override `App.HORIZONTAL_BREAKPOINTS` if not `None`.
- `VERTICAL_BREAKPOINTS`: Vertical breakpoints that override `App.VERTICAL_BREAKPOINTS` if not `None`.
- `ALLOW_IN_MAXIMIZED_VIEW`: CSS selector for direct children allowed in maximized view alongside the maximized widget. `None` defers to the app setting.
- `ESCAPE_TO_MINIMIZE`: Whether Escape minimizes a maximized widget. `None` defers to the app setting.

### Screen reactive attributes

- `focused`: The currently focused widget, or `None`. Use `set_focus()` to change focus; do not set directly.
- `title`: Screen title, overrides the app title when set.
- `sub_title`: Screen sub-title, overrides the app sub-title when set.
- `maximized`: The currently maximized widget, or `None`.
- `stack_updates`: Integer that increments when the screen is resumed.

### Screen default CSS

- Default layout is `vertical` with `overflow-y: auto`.
- Background is `$background`.
- Inline mode uses `height: auto`, `min-height: 1`, with top and bottom borders.

### Screen constructor

- Accepts optional `name`, `id`, and `classes` parameters.

---

## Screen CSS

### Screens can define CSS that applies app-wide

- The `CSS` class variable contains inline CSS rules that apply to the entire app, not just the screen.
- The `CSS_PATH` class variable specifies external CSS file(s) to load; these also apply app-wide.
- Inline `CSS` rules take priority over rules loaded from `CSS_PATH`.
- Screens can be styled like other widgets except their dimensions cannot be changed.

### Screen opacity and translucency

- If a screen's background color has an alpha component, the screen beneath it shows through.
- Example: `background: rgba(0, 0, 255, 0.5)` blends the screen with 50% blue over the screen below.
- Only the topmost screen is active and receives input, even when lower screens are partially visible.
- Screen opacity is the mechanism used to create the dimming effect on modal dialogs.

---

## Screen Stack

### The stack is the ordered list of active screens

- `app.screen_stack` returns the list of screens currently on the stack.
- `app.screen` returns the topmost (current) screen.
- The default screen occupies position 0 when the app starts. Apps can override `get_default_screen()` to provide a custom default screen.
- Only the topmost screen appears in `app.children`.
- Only the topmost screen renders and receives input events.

### The stack cannot be emptied

- Popping the last screen on the stack raises `ScreenStackError`.

---

## Installing Screens

### Screens can be pre-registered by name via `SCREENS`

- `SCREENS` is a dict class variable on App that maps string names to Screen classes (or callables returning a Screen).
- Screen instances are not allowed in `SCREENS`; supplying one raises `ValueError`.
- Installed screens persist in memory for the lifetime of the app.
- `SCREENS` is recommended for screens that exist for the lifetime of the app.

### Runtime screen installation

- `app.install_screen(screen, name)` installs a screen at runtime, equivalent to adding to `SCREENS`.
- Installing a screen does not add it to the DOM or the screen stack.
- `app.is_screen_installed(name_or_screen)` checks whether a screen is registered.
- `app.get_screen(name)` retrieves a registered screen; raises `KeyError` if not found.
- `app.get_screen(name, expected_type)` retrieves a screen and raises `TypeError` if the screen is not an instance of the expected type.

### Uninstalling screens

- `app.uninstall_screen(name_or_screen)` removes a registration.
- Raises `ScreenStackError` if the screen is currently on the stack.
- Uninstalled screens are removed from memory and cleaned up.

---

## Push, Pop, Switch

### push_screen adds a screen on top of the stack

- Accepts a screen name (string referencing `SCREENS`) or a Screen instance.
- The pushed screen becomes `app.screen`.
- Multiple pushes grow the stack; screens are stacked in order.
- When an installed screen (by name) is pushed multiple times, the same instance is reused.
- Also available as the `"app.push_screen"` action, which requires the name of an installed screen.

### pop_screen removes the topmost screen

- The screen below becomes `app.screen`.
- Popping restores focus to the widget that was focused before the push.
- Popping the only screen raises `ScreenStackError`.
- When a screen is popped, it is removed and deleted unless it is installed or another copy exists on the stack.
- Also available as the `"app.pop_screen"` action.

### switch_screen replaces the topmost screen

- The current top-of-stack is removed and replaced by the new screen.
- The stack depth does not change.
- Switching to the same screen already on top is a no-op (same instance remains).
- Switching clears the result callback of the replaced screen.
- The removed screen is deleted unless it is installed.
- Also available as the `"app.switch_screen"` action, which accepts the name of the screen to switch to.

---

## Screen Results and Dismiss

### Screens are generic over a result type

- `Screen[T]` declares the type of value the screen will return when dismissed.
- `ModalScreen[T]` is also generic over a result type.
- The type parameter adds typing information: the type checker enforces that `dismiss()` receives the correct type and callbacks expect the same type.
- Typing is optional; screens work without type parameters.

### dismiss pops the screen and delivers a result

- `screen.dismiss(value)` pops the screen and delivers `value` to the callback registered when the screen was pushed.
- `dismiss()` with no argument delivers `None`.
- Awaiting `dismiss()` from within the screen's own message handler raises `ScreenError`. Call `self.dismiss()` without `await` in that case.

### Callbacks receive the result

- `app.push_screen(screen, callback)` registers a callback invoked with the dismiss result.
- The callback fires once, when the screen is dismissed.
- The callback runs in the context of the requester (the object that called `push_screen`).

### The dismiss action can be bound in BINDINGS

- `"dismiss(True)"` in a binding string calls `dismiss` with the given argument.
- `"dismiss"` with no argument calls `dismiss` with `None`.

### wait_for_dismiss enables await-based result retrieval

- `await app.push_screen(screen, wait_for_dismiss=True)` returns the result directly.
- Must be called inside a `@work` decorated method (a Textual worker).
- Calling `wait_for_dismiss=True` outside a worker raises `NoActiveWorker`.

### push_screen_wait is an alias for push_screen with wait_for_dismiss

- `await app.push_screen_wait(screen)` behaves the same as `await app.push_screen(screen, wait_for_dismiss=True)`.
- Safe to use with exclusive workers; cancelling the first worker does not break the second push.

---

## Screen Modes

### Modes map names to independent screen stacks

- `App.MODES` maps string mode names to Screen classes, callables returning Screens, or string names referencing `SCREENS`.
- Screen instances are not allowed in `MODES`; supplying one raises `ValueError`.
- Non-Screen, non-string, non-callable values in `MODES` raise `TypeError`.
- Each mode maintains its own independent screen stack.
- The base screen for each mode is determined by the value in `MODES`.

### DEFAULT_MODE determines the initial mode

- `App.DEFAULT_MODE` sets which mode is active when the app starts.

### switch_mode activates a mode

- `app.switch_mode(name)` switches to the named mode.
- The topmost screen in the new mode's stack becomes the active visible screen.
- Switching to an unknown mode raises `UnknownModeError`.
- Switching to the already-active mode is a no-op.
- Also available as the `"app.switch_mode"` action.

### Each mode preserves its own screen stack

- Pushing screens onto the stack while in a mode only affects that mode's stack.
- Switching away from a mode and back restores the full stack, including any screens pushed on top.
- Result callbacks survive mode switches: dismissing a screen after switching away and back still fires the correct callback.

### Modes can be added and removed at runtime

- `app.add_mode(name, screen_factory)` registers a new mode; raises `InvalidModeError` if the name already exists.
- `app.remove_mode(name)` unregisters a mode; raises `ActiveModeError` if the mode is currently active.

---

## Modal Screens

### ModalScreen is a Screen subclass for modal dialogs

- `ModalScreen[T]` is generic over a result type, same as `Screen[T]`.
- Modal screens prevent key bindings defined on the App from being processed. Only the modal screen's own bindings are active.
- Pressing a key bound on the App (e.g., to push another screen) has no effect while a modal screen is active. This prevents stacking duplicate modal screens.
- Default styling applies `background: $background 60%` which dims and shows through to the screen beneath.
- Modal screens are pushed via `app.push_screen(ModalScreen())` with an optional callback.
- Dismissing a modal screen (via button press, key binding, or `dismiss()`) pops it and delivers the result to the callback.

### ModalScreen indicates inactive state visually

- The semi-transparent background lets the user see the underlying screen is still present but inactive.
- Only the topmost modal screen responds to input; the screens below are visible but inert.

---

## Auto-Focus Behavior

### Screens control focus when activated

- `Screen.AUTO_FOCUS` is a CSS selector string determining which widget receives focus when the screen is activated.
- `"*"` focuses the first focusable widget. `""` disables auto-focus. `None` defers to the app's `AUTO_FOCUS`.
- A specific selector (e.g., `"Input"`, `"#two"`) focuses the first matching focusable widget.
- Non-focusable widgets (e.g., `Label`) are skipped; the next focusable widget receives focus.

### AUTO_FOCUS inheritance

- If `Screen.AUTO_FOCUS` is set (non-`None`), it takes precedence over `App.AUTO_FOCUS`.
- If `Screen.AUTO_FOCUS` is `None`, the app's `AUTO_FOCUS` is used as the selector.
- If `Screen.AUTO_FOCUS` is `""` (empty string), auto-focus is disabled regardless of the app setting.

### Focus is restored on pop

- Popping a screen restores focus to the widget that was focused on the screen below.

---

## Focus Chain and Focus Navigation

### Focus chain construction

- `screen.focus_chain` returns the ordered list of currently focusable widgets on the screen.
- A widget is included when `can_focus=True` (or `allow_focus()` returns `True`) and the widget is visible.
- A widget with `can_focus=False` and `can_focus_children=False` is excluded along with its children.
- A widget with `can_focus=False` and `can_focus_children=True` (`ChildrenFocusableOnly`) is excluded from the chain itself but its focusable children are included.
- `allow_focus()` can override the `can_focus` class attribute: returning `True` when `can_focus=False` makes the widget focusable; returning `False` when `can_focus=True` makes it non-focusable.
- `allow_focus_children()` similarly overrides `can_focus_children` on containers.

### Invisible widgets are excluded from the focus chain

- Widgets with `visibility: hidden` are excluded from the focus chain.
- A widget explicitly set `visibility: visible` inside a hidden container is included in the focus chain.
- Visibility is inherited: a widget inside a hidden container is hidden (and thus excluded) unless explicitly made visible.

### focus_next and focus_previous

- `screen.focus_next()` advances focus to the next widget in the focus chain and returns it.
- `screen.focus_previous()` moves focus to the previous widget in the focus chain and returns it.
- Both methods wrap around: `focus_next()` at the end of the chain focuses the first widget; `focus_previous()` at the start focuses the last widget.
- Both accept an optional selector argument to restrict which widgets can receive focus.
  - When a selector is given, only widgets matching it are eligible.
  - If the selector matches the currently focused widget, navigation starts from the next widget after the current one.
  - If the selector matches no widgets in the focus chain, focus is cleared and `None` is returned.

### Mouse interaction and focus

- Pressing the mouse button (`MouseDown`) on a focusable widget gives it focus.
- Releasing the mouse button (`MouseUp`) alone does not give focus.
- Clicking a non-focusable widget focuses the nearest focusable ancestor (if any).
- Clicking outside any focusable subtree leaves focus unchanged (or clears it if there is no focusable ancestor).

### Focus and blur pseudo-classes

- A focused widget has the `:focus` pseudo-class and does not have `:blur`.
- An unfocused widget has the `:blur` pseudo-class and does not have `:focus`.

### Trapping focus

- `widget.trap_focus()` restricts the screen's effective focus chain to the subtree rooted at that widget, but only if the currently focused widget is inside that subtree.
- If the focused widget is not inside the widget called with `trap_focus()`, the trap has no effect.
- `widget.trap_focus(False)` releases the trap and restores the full focus chain.

---

## Screen Events

### ScreenSuspend fires when a screen becomes inactive

- Textual sends a `ScreenSuspend` event to a screen when it becomes inactive due to another screen being pushed on top, or due to a mode switch.
- This event can be used to disable processing for screens that are no longer visible.

### ScreenResume fires when a screen becomes active

- Textual sends a `ScreenResume` event to a screen when it becomes the active (topmost) screen.
- This occurs when a screen above it is popped, or when a mode switch makes this screen's stack active.

---

## Mouse Events on Screens

### Screens receive mouse move events directly

- A `Screen` receives `MouseMove` events when the pointer moves over empty screen space.
- `MouseMove` events bubble from a widget up to the screen.

---

## Screen Lifecycle and Cleanup

### Screen removal and deletion

- When a screen is popped, it is removed and deleted unless it is an installed screen or another copy of it remains on the stack.
- When `switch_screen` replaces a screen, the replaced screen is removed and deleted under the same conditions.
- Installed screens persist in memory until explicitly uninstalled with `uninstall_screen`.

---

## Constraints

- The screen stack must never be empty once the app is running; popping the last screen is an error.
- `SCREENS` and `MODES` must not contain Screen instances; only classes, callables, or name strings.
- `wait_for_dismiss` must only be used inside a Textual worker (`@work`); using it elsewhere raises `NoActiveWorker`.
- A screen that is on the stack cannot be uninstalled.
- Mode names must be unique; adding a duplicate raises `InvalidModeError`.
- The active mode cannot be removed; doing so raises `ActiveModeError`.
- Switching to an unknown mode raises `UnknownModeError`.
- `get_screen` with an `expected_type` that does not match the actual screen type raises `TypeError`.
- Screen dimensions always match the terminal size and cannot be modified via CSS.
- Awaiting `screen.dismiss()` from within the screen's own message handler raises `ScreenError`.
