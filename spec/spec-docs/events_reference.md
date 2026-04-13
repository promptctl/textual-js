# Events Reference

Complete reference for all built-in event types in `textual.events`. Every event inherits from `Event`, which inherits from `Message`.

## Inheritance Hierarchy

```
Message
  Event
    Load
    Idle
    Compose
    Mount
    Unmount
    Show
    Hide
    Ready
    Resize
    Focus
    Blur
    AppFocus
    AppBlur
    DescendantFocus (dataclass)
    DescendantBlur (dataclass)
    Paste
    Print
    ScreenResume (dataclass)
    ScreenSuspend
    MouseCapture
    MouseRelease
    Action
    Timer
    Callback
    DeliveryComplete (dataclass)
    DeliveryFailed (dataclass)
    InputEvent
      Key
      MouseEvent
        MouseMove
        MouseDown
        MouseUp
        MouseScrollDown
        MouseScrollUp
        MouseScrollRight
        MouseScrollLeft
        Click
    Enter
    Leave
```

---

## Lifecycle Events

### Load

Sent when the App is running but *before* the terminal is in application mode. Use this to run setup that does not require visuals (loading configuration, binding keys).

- **Class:** `textual.events.Load`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:** None
- **Handler:** `on_load(self, event: events.Load)`

### Mount

Sent when a widget is mounted and may receive messages. This is the standard place to perform widget initialization that requires access to the DOM.

- **Class:** `textual.events.Mount`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:** None
- **Handler:** `on_mount(self, event: events.Mount)`

### Unmount

Sent when a widget is unmounted and may no longer receive messages. Use for cleanup.

- **Class:** `textual.events.Unmount`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:** None
- **Handler:** `on_unmount(self, event: events.Unmount)`

### Show

Sent when a widget is first displayed (becomes visible in the terminal).

- **Class:** `textual.events.Show`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:** None
- **Handler:** `on_show(self, event: events.Show)`

### Hide

Sent when a widget has been hidden. Fires when any of these conditions apply:

- The widget is removed from the DOM.
- The widget is scrolled or clipped out of the visible area.
- The widget's `display` attribute is set to `False`.
- The widget's `display` CSS style is set to `"none"`.

- **Class:** `textual.events.Hide`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:** None
- **Handler:** `on_hide(self, event: events.Hide)`

### Ready

Sent to the `App` when the DOM is ready and the first frame has been displayed. App-only event.

- **Class:** `textual.events.Ready`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:** None
- **Handler:** `on_ready(self, event: events.Ready)`

### Compose

Sent to a widget to request it to compose and mount children. Internal event; you typically handle this via the `compose()` method rather than an event handler.

- **Class:** `textual.events.Compose`
- **Bubbles:** No
- **Verbose:** Yes
- **Attributes:** None
- **Handler:** `on_compose(self, event: events.Compose)`

---

## Screen Events

### ScreenResume

Sent to a screen that has been made active (pushed to the top of the screen stack or uncovered by a pop).

- **Class:** `textual.events.ScreenResume`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:**
  - `refresh_styles: bool` -- Whether the resuming screen should refresh its styles. Defaults to `True`.
- **Handler:** `on_screen_resume(self, event: events.ScreenResume)`

### ScreenSuspend

Sent to a screen when it is no longer active (another screen has been pushed on top, or the screen has been popped).

- **Class:** `textual.events.ScreenSuspend`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:** None
- **Handler:** `on_screen_suspend(self, event: events.ScreenSuspend)`

---

## Focus Events

### Focus

Sent when a widget gains input focus.

- **Class:** `textual.events.Focus`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:**
  - `from_app_focus: bool` -- `True` if the focus was triggered by the app itself regaining focus (via `AppFocus`). `False` if focus came from within the Textual app (e.g. tab navigation or programmatic focus).
- **Handler:** `on_focus(self, event: events.Focus)`

### Blur

Sent when a widget loses input focus (is un-focused).

- **Class:** `textual.events.Blur`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:** None
- **Handler:** `on_blur(self, event: events.Blur)`

### AppFocus

Sent when the terminal application gains focus from the operating system. Only available in terminals that support `FocusIn` events, or when running via textual-web.

- **Class:** `textual.events.AppFocus`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:** None
- **Handler:** `on_app_focus(self, event: events.AppFocus)`

### AppBlur

Sent when the terminal application loses focus to the operating system. Only available in terminals that support `FocusOut` events, or when running via textual-web.

- **Class:** `textual.events.AppBlur`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:** None
- **Handler:** `on_app_blur(self, event: events.AppBlur)`

### DescendantFocus

Sent when a child widget gains focus. Bubbles up the DOM, so ancestor widgets can react to focus changes anywhere in their subtree.

- **Class:** `textual.events.DescendantFocus` (dataclass)
- **Bubbles:** Yes
- **Verbose:** Yes
- **Attributes:**
  - `widget: Widget` -- The widget that was focused.
- **Properties:**
  - `control -> Widget` -- Alias for `widget`.
- **Handler:** `on_descendant_focus(self, event: events.DescendantFocus)`

### DescendantBlur

Sent when a child widget loses focus. Bubbles up the DOM, so ancestor widgets can react to focus changes anywhere in their subtree.

- **Class:** `textual.events.DescendantBlur` (dataclass)
- **Bubbles:** Yes
- **Verbose:** Yes
- **Attributes:**
  - `widget: Widget` -- The widget that was blurred.
- **Properties:**
  - `control -> Widget` -- Alias for `widget`.
- **Handler:** `on_descendant_blur(self, event: events.DescendantBlur)`

---

## Keyboard Events

### Key

Sent when the user presses a key on the keyboard.

- **Class:** `textual.events.Key`
- **Inherits:** `InputEvent`
- **Bubbles:** Yes
- **Verbose:** No
- **Attributes:**
  - `key: str` -- The key that was pressed (e.g. `"a"`, `"ctrl+c"`, `"enter"`).
  - `character: str | None` -- A printable character, or `None` if the key is not printable.
  - `aliases: list[str]` -- All aliases for the key, including the key itself.
- **Properties:**
  - `name -> str` -- Key name suitable for use as a Python identifier (lowercase, `+` replaced with `_`).
  - `name_aliases -> list[str]` -- The corresponding name for every alias.
  - `is_printable -> bool` -- `True` if the key produces a printable unicode character.
- **Handler:** `on_key(self, event: events.Key)`

---

## Mouse Events

All mouse events (except `Enter`, `Leave`, `MouseCapture`, and `MouseRelease`) inherit from `MouseEvent`, which provides a common set of attributes and properties.

### MouseEvent (Base Class)

- **Class:** `textual.events.MouseEvent`
- **Inherits:** `InputEvent`
- **Bubbles:** Yes
- **Verbose:** No
- **Attributes:**
  - `widget: Widget | None` -- The widget under the mouse at the time of the event.
  - `button: int` -- Index of the pressed button (0 = no button).
  - `shift: bool` -- `True` if the shift key is pressed.
  - `meta: bool` -- `True` if the meta key is pressed.
  - `ctrl: bool` -- `True` if the ctrl key is pressed.
- **Properties:**
  - `x -> int` -- Relative X coordinate of the cell under the mouse.
  - `y -> int` -- Relative Y coordinate of the cell under the mouse.
  - `delta_x -> int` -- Change in X since the last mouse event.
  - `delta_y -> int` -- Change in Y since the last mouse event.
  - `screen_x -> int` -- Absolute X coordinate relative to the top-left of the screen.
  - `screen_y -> int` -- Absolute Y coordinate relative to the top-left of the screen.
  - `pointer_x -> float` -- Relative X coordinate of the pointer (sub-cell precision).
  - `pointer_y -> float` -- Relative Y coordinate of the pointer (sub-cell precision).
  - `pointer_screen_x -> float` -- Absolute X coordinate of the pointer (sub-cell precision).
  - `pointer_screen_y -> float` -- Absolute Y coordinate of the pointer (sub-cell precision).
  - `offset -> Offset` -- Mouse coordinate as an `Offset(x, y)`.
  - `screen_offset -> Offset` -- Mouse coordinate relative to the screen.
  - `delta -> Offset` -- Change since last event as an `Offset`.
  - `style -> Style` -- The Rich `Style` under the cursor.
  - `control -> Widget | None` -- Alias for `widget`.
- **Methods:**
  - `get_content_offset(widget) -> Offset | None` -- Offset within a widget's content area, or `None` if the mouse is in padding/border.
  - `get_content_offset_capture(widget) -> Offset` -- Offset from a widget's content area, even if outside the content region.

### Click

Sent when a widget is clicked (mouse button pressed and released over the same widget).

- **Class:** `textual.events.Click`
- **Inherits:** `MouseEvent`
- **Bubbles:** Yes
- **Verbose:** No
- **Attributes:** All `MouseEvent` attributes, plus:
  - `chain: int` -- Number of clicks in quick succession. `1` = single click, `2` = double click, `3` = triple click, etc. Clicks must occur within 500ms of each other (configurable via `App.CLICK_CHAIN_TIME_THRESHOLD`).
- **Handler:** `on_click(self, event: events.Click)`

### MouseDown

Sent when a mouse button is pressed.

- **Class:** `textual.events.MouseDown`
- **Inherits:** `MouseEvent`
- **Bubbles:** Yes
- **Verbose:** Yes
- **Attributes:** All `MouseEvent` attributes.
- **Handler:** `on_mouse_down(self, event: events.MouseDown)`

### MouseUp

Sent when a mouse button is released.

- **Class:** `textual.events.MouseUp`
- **Inherits:** `MouseEvent`
- **Bubbles:** Yes
- **Verbose:** Yes
- **Attributes:** All `MouseEvent` attributes.
- **Handler:** `on_mouse_up(self, event: events.MouseUp)`

### MouseMove

Sent when the mouse cursor moves.

- **Class:** `textual.events.MouseMove`
- **Inherits:** `MouseEvent`
- **Bubbles:** Yes
- **Verbose:** Yes
- **Attributes:** All `MouseEvent` attributes.
- **Handler:** `on_mouse_move(self, event: events.MouseMove)`

### MouseScrollDown

Sent when the mouse wheel is scrolled down.

- **Class:** `textual.events.MouseScrollDown`
- **Inherits:** `MouseEvent`
- **Bubbles:** Yes
- **Verbose:** Yes
- **Attributes:** All `MouseEvent` attributes.
- **Handler:** `on_mouse_scroll_down(self, event: events.MouseScrollDown)`

### MouseScrollUp

Sent when the mouse wheel is scrolled up.

- **Class:** `textual.events.MouseScrollUp`
- **Inherits:** `MouseEvent`
- **Bubbles:** Yes
- **Verbose:** Yes
- **Attributes:** All `MouseEvent` attributes.
- **Handler:** `on_mouse_scroll_up(self, event: events.MouseScrollUp)`

### MouseScrollLeft

Sent when the mouse wheel is scrolled left.

- **Class:** `textual.events.MouseScrollLeft`
- **Inherits:** `MouseEvent`
- **Bubbles:** Yes
- **Verbose:** Yes
- **Attributes:** All `MouseEvent` attributes.
- **Handler:** `on_mouse_scroll_left(self, event: events.MouseScrollLeft)`

### MouseScrollRight

Sent when the mouse wheel is scrolled right.

- **Class:** `textual.events.MouseScrollRight`
- **Inherits:** `MouseEvent`
- **Bubbles:** Yes
- **Verbose:** Yes
- **Attributes:** All `MouseEvent` attributes.
- **Handler:** `on_mouse_scroll_right(self, event: events.MouseScrollRight)`

### Enter

Sent when the mouse cursor moves over a widget. This event bubbles, so a parent widget may receive it when the mouse enters a child. Check the `node` attribute for the widget directly under the mouse.

- **Class:** `textual.events.Enter`
- **Bubbles:** Yes
- **Verbose:** Yes
- **Attributes:**
  - `node: DOMNode` -- The DOM node directly under the mouse cursor.
- **Properties:**
  - `control -> DOMNode` -- Alias for `node`.
- **Handler:** `on_enter(self, event: events.Enter)`

### Leave

Sent when the mouse cursor moves away from a widget, or when a widget is programmatically disabled while hovered. This event bubbles, so a parent widget may receive it when the mouse leaves a child. Check the `node` attribute for the widget that was previously under the mouse.

- **Class:** `textual.events.Leave`
- **Bubbles:** Yes
- **Verbose:** Yes
- **Attributes:**
  - `node: DOMNode` -- The DOM node that was previously directly under the mouse cursor.
- **Properties:**
  - `control -> DOMNode` -- Alias for `node`.
- **Handler:** `on_leave(self, event: events.Leave)`

### MouseCapture

Sent when the mouse has been captured by a widget. When captured, all further mouse events are sent to the capturing widget regardless of cursor position.

- **Class:** `textual.events.MouseCapture`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:**
  - `mouse_position: Offset` -- The position of the mouse when captured.
- **Handler:** `on_mouse_capture(self, event: events.MouseCapture)`
- **Related:** `Widget.capture_mouse()`, `Widget.release_mouse()`

### MouseRelease

Sent when mouse capture has been released.

- **Class:** `textual.events.MouseRelease`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:**
  - `mouse_position: Offset` -- The position of the mouse when released.
- **Handler:** `on_mouse_release(self, event: events.MouseRelease)`
- **Related:** `Widget.capture_mouse()`, `Widget.release_mouse()`

---

## Clipboard Events

### Paste

Sent when text is pasted into the application. Requires a terminal emulator that supports bracketed paste mode. Textual enables bracketed paste on app start and disables it on shutdown.

- **Class:** `textual.events.Paste`
- **Bubbles:** Yes
- **Verbose:** No
- **Attributes:**
  - `text: str` -- The text that was pasted.
- **Handler:** `on_paste(self, event: events.Paste)`

---

## Resize Event

### Resize

Sent when the app or a widget has been resized. Supports message coalescing: a newer `Resize` replaces any pending older `Resize` in the queue.

- **Class:** `textual.events.Resize`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:**
  - `size: Size` -- The new size of the widget.
  - `virtual_size: Size` -- The virtual (scrollable) size of the widget.
  - `container_size: Size` -- The size of the widget's container. Defaults to `size` if not provided.
  - `pixel_size: Size | None` -- Size of the terminal window in pixels, or `None` if not known.
- **Class Methods:**
  - `from_dimensions(cells, pixels) -> Resize` -- Construct from `(width, height)` tuples.
- **Handler:** `on_resize(self, event: events.Resize)`

---

## Print Event

### Print

Sent to a widget that is capturing Python `print()` output via `App.begin_capture_print`.

- **Class:** `textual.events.Print`
- **Bubbles:** No
- **Verbose:** No
- **Attributes:**
  - `text: str` -- The text that was printed.
  - `stderr: bool` -- `True` if the print was to stderr, `False` for stdout.
- **Handler:** `on_print(self, event: events.Print)`

---

## Internal / Low-Level Events

These events exist in `textual.events` but are primarily for internal use.

### Idle

Pseudo-event sent when the message queue is empty. Not sent through the normal message queue.

- **Class:** `textual.events.Idle`
- **Bubbles:** No
- **Verbose:** No

### Callback

Sent by Textual to invoke a callback scheduled via `call_next` or `call_later`.

- **Class:** `textual.events.Callback`
- **Bubbles:** No
- **Verbose:** Yes
- **Attributes:**
  - `callback: CallbackType` -- The callback to invoke.

### Action

An action string to process.

- **Class:** `textual.events.Action`
- **Bubbles:** Yes
- **Verbose:** No
- **Attributes:**
  - `action: str` -- The action string.

### Timer

Sent when a timer fires. The default handler on `MessagePump` calls `prevent_default()` and `stop()`, then invokes the timer's callback. Created via `set_timer()` or `set_interval()`.

- **Class:** `textual.events.Timer`
- **Bubbles:** No
- **Verbose:** Yes
- **Attributes:**
  - `timer: TimerClass` -- The timer object that fired.
  - `time: float` -- The time when the timer fired.
  - `count: int` -- The number of times the timer has fired.
  - `callback: TimerCallback | None` -- The callback to invoke.

### DeliveryComplete

Sent to the App when a file has been delivered (via `App.deliver_text` or `App.deliver_binary`).

- **Class:** `textual.events.DeliveryComplete` (dataclass)
- **Bubbles:** No
- **Verbose:** No
- **Attributes:**
  - `key: str` -- The delivery key associated with the delivery.
  - `path: Path | None` -- The path where the file was saved, or `None` if unavailable (e.g. web browser delivery).
  - `name: str | None` -- Optional name to identify the download.

### DeliveryFailed

Sent to the App when a file delivery fails.

- **Class:** `textual.events.DeliveryFailed` (dataclass)
- **Bubbles:** No
- **Verbose:** No
- **Attributes:**
  - `key: str` -- The delivery key associated with the delivery.
  - `exception: BaseException` -- The exception raised during delivery.
  - `name: str | None` -- Optional name to identify the download.

---

## Quick Reference Table

| Event | Bubbles | Verbose | Handler |
|---|---|---|---|
| `Load` | No | No | `on_load` |
| `Mount` | No | No | `on_mount` |
| `Unmount` | No | No | `on_unmount` |
| `Show` | No | No | `on_show` |
| `Hide` | No | No | `on_hide` |
| `Ready` | No | No | `on_ready` |
| `Compose` | No | Yes | `on_compose` |
| `ScreenResume` | No | No | `on_screen_resume` |
| `ScreenSuspend` | No | No | `on_screen_suspend` |
| `Focus` | No | No | `on_focus` |
| `Blur` | No | No | `on_blur` |
| `AppFocus` | No | No | `on_app_focus` |
| `AppBlur` | No | No | `on_app_blur` |
| `DescendantFocus` | Yes | Yes | `on_descendant_focus` |
| `DescendantBlur` | Yes | Yes | `on_descendant_blur` |
| `Key` | Yes | No | `on_key` |
| `Click` | Yes | No | `on_click` |
| `MouseDown` | Yes | Yes | `on_mouse_down` |
| `MouseUp` | Yes | Yes | `on_mouse_up` |
| `MouseMove` | Yes | Yes | `on_mouse_move` |
| `MouseScrollDown` | Yes | Yes | `on_mouse_scroll_down` |
| `MouseScrollUp` | Yes | Yes | `on_mouse_scroll_up` |
| `MouseScrollLeft` | Yes | Yes | `on_mouse_scroll_left` |
| `MouseScrollRight` | Yes | Yes | `on_mouse_scroll_right` |
| `Enter` | Yes | Yes | `on_enter` |
| `Leave` | Yes | Yes | `on_leave` |
| `MouseCapture` | No | No | `on_mouse_capture` |
| `MouseRelease` | No | No | `on_mouse_release` |
| `Paste` | Yes | No | `on_paste` |
| `Resize` | No | No | `on_resize` |
| `Print` | No | No | `on_print` |
| `Idle` | No | No | `on_idle` |
| `Callback` | No | Yes | `on_callback` |
| `Action` | Yes | No | `on_action` |
| `Timer` | No | Yes | `on_timer` |
| `DeliveryComplete` | No | No | `on_delivery_complete` |
| `DeliveryFailed` | No | No | `on_delivery_failed` |
