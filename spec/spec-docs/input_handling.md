# Input Handling

Specification for keyboard and mouse input processing in Textual.

## Keyboard Input

### Key Events

When the user presses a key, Textual dispatches a `Key` event (`textual.events.Key`) to the focused widget.

#### Key Event Attributes

| Attribute | Type | Description |
|---|---|---|
| `key` | `str` | Identifies the key pressed. Single character for letters/numbers; longer identifier for other keys. Shift on non-printable keys adds `shift+` prefix (e.g., `shift+home`). Ctrl adds `ctrl+` prefix (e.g., `ctrl+p`). |
| `character` | `str | None` | The printable Unicode character for the key, or `None` for non-printable keys (e.g., function keys). |
| `name` | `str` | Python-identifier-safe version of `key`: lowercased, `+` replaced with `_`, uppercase letters prefixed with `upper_`. E.g., `ctrl+p` becomes `ctrl_p`; `P` becomes `upper_p`. |
| `is_printable` | `bool` | `True` if the key represents a character suitable for text input; `False` for control codes and function keys. |
| `aliases` | `list[str]` | List of possible keys that could have produced this event. Some key combinations are indistinguishable in the terminal (e.g., Tab and Ctrl+I produce `aliases=["tab", "ctrl+i"]`). |

### Key Methods

A widget may define a method named `key_<name>` (where `<name>` matches the event's `name` attribute) to handle a specific key press. For example, `key_space` handles the space key.

Key methods are a convenience for experimentation. For production use, key bindings and actions are preferred.

## Focus System

### Input Focus

Exactly one widget receives key events at a time. That widget has input focus.

### Focusable Widgets

Each widget has a `can_focus` boolean attribute controlling whether it can receive focus. `can_focus=True` is necessary but not sufficient: a disabled widget cannot receive focus even if `can_focus` is `True`.

### Focus Navigation

- **Tab**: moves focus to the next focusable widget.
- **Shift+Tab**: moves focus to the previous focusable widget.
- The `:focus` CSS pseudo-selector applies styles to the focused widget.

### Programmatic Focus Control

Call `widget.focus()` to focus a widget programmatically. By default, Textual focuses the first focusable widget when the app starts.

### Focus Events

| Event | When |
|---|---|
| `Focus` | Widget receives focus. |
| `Blur` | Widget loses focus. |

## Key Bindings

Keys may be associated with actions via bindings. A binding maps a key to an action with an optional human-readable description.

### Defining Bindings

Add a `BINDINGS` class variable (list) to an `App` or `Widget`. Each entry is either:
- A 3-tuple: `(key, action, description)`.
- A `Binding` instance for advanced options.

Multiple keys can bind to the same action via comma separation: `("r,t", "add_bar('red')", "Add Red")`.

### Binding Resolution Order

When a key is pressed, Textual checks for a matching binding starting at the focused widget and walking up the DOM to the `App`. The first match wins.

### Priority Bindings

A `Binding` with `priority=True` is checked before the focused widget's bindings. This enables app-level or screen-level hotkeys that cannot be overridden by widget bindings. The default `ctrl+q` quit binding uses this mechanism.

### Show Bindings

The `Footer` widget displays available bindings. Set `show=False` on a `Binding` to hide it from the footer. Default bindings (ctrl+c, tab, shift+tab) use `show=False`.

### Dynamic Behavior

Bindings cannot be modified at runtime. Use dynamic actions to conditionally enable or disable behavior based on app state.

## Mouse Input

Terminal coordinates are `(x, y)` pairs where X is a character offset from the left and Y is a line offset from the top. Coordinates may be screen-relative or widget-relative (where `(0, 0)` is the widget's top-left corner).

Trackpads and other pointer devices are treated as mouse input by the terminal.

### Mouse Movement

A widget receives `MouseMove` events when the cursor moves over it. The event includes coordinates and modifier key state (Ctrl, Shift, etc.).

### Mouse Capture

By default, mouse move events go to the widget under the cursor. Calling `widget.capture_mouse()` routes all mouse events to that widget regardless of cursor position. Call `widget.release_mouse()` to restore default behavior.

Captured mouse events may have negative coordinates when the cursor is to the left of or above the widget.

| Event | When |
|---|---|
| `MouseCapture` | Mouse capture is acquired. |
| `MouseRelease` | Mouse capture is released. |

### Enter and Leave Events

| Event | When |
|---|---|
| `Enter` | Cursor first moves over a widget. |
| `Leave` | Cursor moves off a widget. |

Both `Enter` and `Leave` bubble. A parent widget may receive these events from a child; compare `event.node` against `self` to determine the originating widget.

### Click Events

A mouse button press produces three events in order:

1. `MouseDown` — button pressed.
2. `MouseUp` — button released.
3. `Click` — logical click completed.

Prefer handling `Click` over `MouseDown`/`MouseUp`. Future pointing devices may not have discrete down/up states.

### Scroll Events

Scroll wheel input produces directional events. Scrollable containers handle these automatically.

| Event | Direction |
|---|---|
| `MouseScrollUp` | Scroll up (wheel away from user). |
| `MouseScrollDown` | Scroll down (wheel toward user). |
| `MouseScrollLeft` | Horizontal scroll left (terminals with support). |
| `MouseScrollRight` | Horizontal scroll right (terminals with support). |

Trackpad gestures are typically converted to scroll events by the terminal emulator.

## Event Propagation

Key events are sent to the focused widget. If the focused widget does not handle the key, Textual walks up the DOM checking each ancestor's bindings until a match is found or the `App` is reached.

Mouse events are sent to the widget under the cursor (or the capturing widget if mouse capture is active). `Enter` and `Leave` events bubble up through the DOM.
