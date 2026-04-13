# Screens Spec

This spec defines the behavior of Textual's screen management system: the screen stack, push/pop/switch operations, screen modes, modal screens, and screen results.

---

## Screen Stack

### The stack is the ordered list of active screens

- `app.screen_stack` returns the list of screens currently on the stack.
- `app.screen` returns the topmost (current) screen.
- The default screen occupies position 0 when the app starts. Apps can override `get_default_screen()` to provide a custom default screen.
- Only the topmost screen appears in `app.children`.

### The stack cannot be emptied

- Popping the last screen on the stack raises `ScreenStackError`.

---

## Installing Screens

### Screens can be pre-registered by name via `SCREENS`

- `SCREENS` maps string names to Screen classes (or callables returning a Screen).
- Screen instances are not allowed in `SCREENS`; supplying one raises `ValueError`.
- Screens can also be installed at runtime with `app.install_screen(screen, name)`.
- Installing a screen does not add it to the DOM or the screen stack.
- `app.is_screen_installed(name_or_screen)` checks registration.
- `app.get_screen(name)` retrieves a registered screen; raises `KeyError` if not found.
- `app.get_screen(name, expected_type)` retrieves a screen and raises `TypeError` if the screen is not an instance of the expected type.
- `app.uninstall_screen(name_or_screen)` removes a registration; raises `ScreenStackError` if the screen is currently on the stack.

---

## Push, Pop, Switch

### push_screen adds a screen on top of the stack

- Accepts a screen name (string referencing `SCREENS`) or a Screen instance.
- The pushed screen becomes `app.screen`.
- Multiple pushes grow the stack; screens are stacked in order.
- When an installed screen (by name) is pushed multiple times, the same instance is reused.

### pop_screen removes the topmost screen

- The screen below becomes `app.screen`.
- Popping restores focus to the widget that was focused before the push.
- Popping the only screen raises `ScreenStackError`.

### switch_screen replaces the topmost screen

- The current top-of-stack is removed and replaced by the new screen.
- The stack depth does not change.
- Switching to the same screen already on top is a no-op (same instance remains).
- Switching clears the result callback of the replaced screen.

---

## Screen Results and Dismiss

### Screens are generic over a result type

- `Screen[T]` declares the type of value the screen will return when dismissed.
- `screen.dismiss(value)` pops the screen and delivers `value` to the callback.
- `dismiss` with no argument delivers `None`.

### Callbacks receive the result

- `app.push_screen(screen, callback)` registers a callback invoked with the dismiss result.
- The callback fires once, when the screen is dismissed.

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

- `MODES` maps string mode names to Screen classes, callables returning Screens, or string names referencing `SCREENS`.
- Screen instances are not allowed in `MODES`; supplying one raises `ValueError`.
- Non-Screen, non-string, non-callable values in `MODES` raise `TypeError`.

### switch_mode activates a mode

- `app.switch_mode(name)` switches to the named mode.
- Switching to an unknown mode raises `UnknownModeError`.
- Switching to the already-active mode is a no-op.

### Each mode preserves its own screen stack

- Pushing screens onto the stack while in a mode only affects that mode's stack.
- Switching away from a mode and back restores the full stack, including any screens pushed on top.
- Result callbacks survive mode switches: dismissing a screen after switching away and back still fires the correct callback.

### Modes can be added and removed at runtime

- `app.add_mode(name, screen_factory)` registers a new mode; raises `InvalidModeError` if the name already exists.
- `app.remove_mode(name)` unregisters a mode; raises `ActiveModeError` if the mode is currently active.

---

## Modal Screens

### ModalScreen is a Screen subclass for dialogs

- `ModalScreen[T]` is generic over a result type, same as `Screen[T]`.
- Modal screens are pushed via `app.push_screen(ModalScreen())` with an optional callback.
- Dismissing a modal screen (via button press, key binding, or `dismiss()`) pops it and delivers the result to the callback.
- Modal screens can be styled to overlay the screen beneath them (alignment, background, borders).

---

## Auto-Focus Behavior

### Screens control focus when pushed

- `Screen.AUTO_FOCUS` is a CSS selector string determining which widget receives focus.
- `"*"` focuses the first focusable widget. `""` disables auto-focus. `None` defers to the app's `AUTO_FOCUS`.
- A specific selector (e.g., `"Input"`, `"#two"`) focuses the first matching focusable widget.
- Non-focusable widgets (e.g., `Label`) are skipped; the next focusable widget receives focus.

### AUTO_FOCUS inheritance

- If `Screen.AUTO_FOCUS` is set, it takes precedence over `App.AUTO_FOCUS`.
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

## Mouse Events on Screens

### Screens receive mouse move events directly

- A `Screen` receives `MouseMove` events when the pointer moves over empty screen space.
- `MouseMove` events bubble from a widget up to the screen.

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
