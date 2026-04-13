# textual.events

All builtin events sent by Textual. Events extend `Message` (via `Event`) and are reserved for use by Textual. Custom application messages should extend `Message` directly.

## Event Base Class

`Event` extends `Message`. It is the base class for all builtin events. No additional behavior beyond `Message`.

## InputEvent

`InputEvent` extends `Event`. Base class for input events (`Key`, `MouseEvent`). No additional behavior.

## Lifecycle Events

### Load

- Extends: `Event`
- Bubbles: No
- Verbose: No

Sent when the App is running but before the terminal is in application mode. Use for non-visual setup such as loading configuration and binding keys.

### Compose

- Extends: `Event`
- Bubbles: No
- Verbose: Yes

Sent to a widget to request it to compose and mount children. Internal to Textual.

### Mount

- Extends: `Event`
- Bubbles: No
- Verbose: No

Sent when a widget is mounted and may receive messages.

### Unmount

- Extends: `Event`
- Bubbles: No
- Verbose: No

Sent when a widget is unmounted and may no longer receive messages.

### Show

- Extends: `Event`
- Bubbles: No
- Verbose: No

Sent when a widget is first displayed.

### Hide

- Extends: `Event`
- Bubbles: No
- Verbose: No

Sent when a widget has been hidden. Conditions: widget removed from the DOM, scrolled/clipped from the terminal or container, `display` attribute set to `False`, or `display` style set to `"none"`.

### Ready

- Extends: `Event`
- Bubbles: No
- Verbose: No

Sent to the App when the DOM is ready and the first frame has been displayed.

### ScreenResume

- Extends: `Event` (dataclass)
- Bubbles: No
- Verbose: No
- Attributes:
  - `refresh_styles: bool = True` -- Whether the resuming screen should refresh its styles.

Sent to a screen that has been made active.

### ScreenSuspend

- Extends: `Event`
- Bubbles: No
- Verbose: No

Sent to a screen when it is no longer active.

## Resize

- Extends: `Event`
- Bubbles: No
- Verbose: No
- Attributes:
  - `size: Size` -- The new size of the widget.
  - `virtual_size: Size` -- The virtual (scrollable) size of the widget.
  - `container_size: Size` -- The size of the widget's container. Defaults to `size` if not provided.
  - `pixel_size: Size | None` -- Size of terminal window in pixels if known, or `None`.

### Constructor

`Resize(size, virtual_size, container_size=None, pixel_size=None)`

### Class Methods

- `from_dimensions(cells: tuple[int, int], pixels: tuple[int, int] | None) -> Resize` -- Construct from basic dimensions. Creates a Resize where `size`, `virtual_size`, and `container_size` are all set to the same `Size(*cells)`.

### Message Coalescing

`can_replace(message)` returns `True` if `message` is an instance of `Resize`. This means newer Resize events replace older pending ones in the queue.

## Key Events

### Key

- Extends: `InputEvent`
- Bubbles: Yes
- Verbose: No
- Attributes:
  - `key: str` -- The key that was pressed.
  - `character: str | None` -- A printable character, or `None` if not printable. If `character` argument is `None`, falls back to `key` if `key` is a single character.
  - `aliases: list[str]` -- The aliases for the key, including the key itself (from `_get_key_aliases`).

### Properties

- `name -> str` -- Name of the key suitable for use as a Python identifier (lowercased, modifiers joined with `_`).
- `name_aliases -> list[str]` -- The corresponding identifier name for every alias in the `aliases` list.
- `is_printable -> bool` -- Whether the key produces a printable unicode character. Returns `False` if `character` is `None`, otherwise delegates to `str.isprintable()`.

## Mouse Events

### MouseEvent

- Extends: `InputEvent`
- Bubbles: Yes
- Verbose: No
- Constructor: `MouseEvent(widget, x, y, delta_x, delta_y, button, shift, meta, ctrl, screen_x=None, screen_y=None, style=None)`

### Attributes

- `widget: Widget | None` -- The widget under the mouse at the time of the event.
- `button: int` -- Index of the pressed button.
- `shift: bool` -- Whether the shift key is pressed.
- `meta: bool` -- Whether the meta key is pressed.
- `ctrl: bool` -- Whether the ctrl key is pressed.

### Properties

- `x -> int` -- Relative X coordinate of the cell under the mouse (truncated to int).
- `y -> int` -- Relative Y coordinate of the cell under the mouse (truncated to int).
- `delta_x -> int` -- Change in X since the last message.
- `delta_y -> int` -- Change in Y since the last message.
- `screen_x -> int` -- Absolute X coordinate relative to top-left of screen (truncated to int).
- `screen_y -> int` -- Absolute Y coordinate relative to top-left of screen (truncated to int).
- `pointer_x -> float` -- Relative X coordinate of the pointer (sub-cell precision).
- `pointer_y -> float` -- Relative Y coordinate of the pointer (sub-cell precision).
- `pointer_screen_x -> float` -- Absolute X coordinate of the pointer (sub-cell precision).
- `pointer_screen_y -> float` -- Absolute Y coordinate of the pointer (sub-cell precision).
- `control -> Widget | None` -- Returns `self.widget`.
- `offset -> Offset` -- The mouse coordinate as an `Offset(x, y)`.
- `screen_offset -> Offset` -- Mouse coordinate relative to the screen as `Offset(screen_x, screen_y)`.
- `delta -> Offset` -- Mouse coordinate delta as `Offset(delta_x, delta_y)`.
- `style -> Style` -- The Rich Style under the cursor. Settable.

### Methods

- `from_event(cls, widget: Widget, event: MouseEvent) -> MouseEventT` -- Class method. Construct a new mouse event of the same type from an existing event, with a different widget.
- `get_content_offset(widget: Widget) -> Offset | None` -- Get offset within a widget's content area. Returns `None` if the offset is not in the content region (i.e. in padding or border).
- `get_content_offset_capture(widget: Widget) -> Offset` -- Get offset from a widget's content area, even if the offset is outside the content region.

### MouseEvent Subclasses

All inherit from `MouseEvent` and add no extra attributes unless noted.

| Class | Bubbles | Verbose |
|---|---|---|
| `MouseMove` | Yes | Yes |
| `MouseDown` | Yes | Yes |
| `MouseUp` | Yes | Yes |
| `MouseScrollDown` | Yes | Yes |
| `MouseScrollUp` | Yes | Yes |
| `MouseScrollRight` | Yes | Yes |
| `MouseScrollLeft` | Yes | Yes |

### Click

- Extends: `MouseEvent`
- Bubbles: Yes
- Verbose: No
- Extra attribute: `chain: int = 1` -- The number of clicks in the chain. 2 is a double click, 3 is a triple click, etc.

Overrides `from_event` to accept an additional `chain` parameter.

## Focus Events

### Focus

- Extends: `Event`
- Bubbles: No
- Verbose: No
- Attributes:
  - `from_app_focus: bool = False` -- `True` if this focus event was sent because the app itself regained focus (via AppFocus). `False` if the focus came from within the Textual app.

### Blur

- Extends: `Event`
- Bubbles: No
- Verbose: No

Sent when a widget is blurred (loses focus).

### AppFocus

- Extends: `Event`
- Bubbles: No
- Verbose: No

Sent when the app has terminal focus. Only available with terminals that support `FocusIn`, or via textual-web.

### AppBlur

- Extends: `Event`
- Bubbles: No
- Verbose: No

Sent when the app loses terminal focus. Only available with terminals that support `FocusOut`, or via textual-web.

### DescendantFocus

- Extends: `Event` (dataclass)
- Bubbles: Yes
- Verbose: Yes
- Attributes:
  - `widget: Widget` -- The widget that was focused.
- Properties:
  - `control -> Widget` -- Alias for `widget`.

### DescendantBlur

- Extends: `Event` (dataclass)
- Bubbles: Yes
- Verbose: Yes
- Attributes:
  - `widget: Widget` -- The widget that was blurred.
- Properties:
  - `control -> Widget` -- Alias for `widget`.

### Enter

- Extends: `Event`
- Bubbles: Yes
- Verbose: Yes
- Attributes:
  - `node: DOMNode` -- The node directly under the mouse.
- Properties:
  - `control -> DOMNode` -- Alias for `node`.

Note: This event bubbles, so a widget may receive it when the mouse moves over a child widget. Check `node` for the widget directly under the mouse.

### Leave

- Extends: `Event`
- Bubbles: Yes
- Verbose: Yes
- Attributes:
  - `node: DOMNode` -- The node that was previously directly under the mouse.
- Properties:
  - `control -> DOMNode` -- Alias for `node`.

Sent when the mouse moves away from a widget, or if a widget is programmatically disabled while hovered.

## Other Events

### Idle

- Extends: `Event`
- Bubbles: No
- Verbose: No

Pseudo-event sent when there are no more items in the message queue. Created by the Textual system and does not go through the usual message queue.

### Callback

- Extends: `Event`
- Bubbles: No
- Verbose: Yes
- Attributes:
  - `callback: CallbackType` -- The callback to invoke.

Sent by Textual to invoke a callback (from `call_next` / `call_later`).

### Action

- Extends: `Event`
- Bubbles: Yes (default)
- Verbose: No
- Attributes:
  - `action: str` -- The action string to process.

### Timer

- Extends: `Event`
- Bubbles: No
- Verbose: Yes
- Attributes:
  - `timer: TimerClass` -- The timer instance that fired.
  - `time: float` -- The time when the timer fired.
  - `count: int = 0` -- The number of times this timer has fired.
  - `callback: TimerCallback | None = None` -- Optional callback to invoke.

### Paste

- Extends: `Event`
- Bubbles: Yes
- Verbose: No
- Attributes:
  - `text: str` -- The text that was pasted.

Only appears when running in a terminal emulator that supports bracketed paste mode. Textual enables bracketed pastes on app start and disables on shutdown.

### Print

- Extends: `Event`
- Bubbles: No
- Verbose: No
- Attributes:
  - `text: str` -- The text that was printed.
  - `stderr: bool = False` -- `True` if printed to stderr, `False` for stdout.

Sent to a widget that is capturing print output (requires `App.begin_capture_print`).

### MouseCapture

- Extends: `Event`
- Bubbles: No
- Verbose: No
- Attributes:
  - `mouse_position: Offset` -- The position of the mouse when captured.

Sent when the mouse has been captured. All further mouse events will be sent to the capturing widget.

### MouseRelease

- Extends: `Event`
- Bubbles: No
- Verbose: No
- Attributes:
  - `mouse_position: Offset` -- The position of the mouse when released.

Sent when mouse capture has been released.

### DeliveryComplete

- Extends: `Event` (dataclass)
- Bubbles: No
- Verbose: No
- Attributes:
  - `key: str` -- The delivery key associated with the delivery (same key returned by `App.deliver_text`/`App.deliver_binary`).
  - `path: Path | None = None` -- The path where the file was saved, or `None` if not available (e.g. delivered via web browser).
  - `name: str | None = None` -- Optional name to identify the download.

### DeliveryFailed

- Extends: `Event` (dataclass)
- Bubbles: No
- Verbose: No
- Attributes:
  - `key: str` -- The delivery key associated with the delivery.
  - `exception: BaseException` -- The exception raised during delivery.
  - `name: str | None = None` -- Optional name to identify the download.

### CursorPosition

- Extends: `Event` (dataclass)
- Bubbles: No
- Verbose: No
- Attributes:
  - `x: int` -- Cursor X position.
  - `y: int` -- Cursor Y position.

Internal event used to retrieve the terminal's cursor position.

### TextSelected

- Extends: `Event`
- Bubbles: Yes
- Verbose: No

Sent from the screen when text is selected (not Input and TextArea).
