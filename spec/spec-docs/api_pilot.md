# textual.pilot

The `Pilot` class is used by `App.run_test` to programmatically operate a Textual app during testing.

## OutOfBounds

`OutOfBounds(Exception)` -- Raised when a pilot mouse target position is outside of the visible screen region.

## WaitForScreenTimeout

`WaitForScreenTimeout(Exception)` -- Raised if message processing does not complete within the timeout period. Typically indicates a deadlock in app code.

## Pilot

`Pilot(Generic[ReturnType])` -- Pilot object to drive an app programmatically.

Decorated with `@rich.repr.auto(angular=True)`.

### Initialization

```python
def __init__(self, app: App[ReturnType]) -> None
```

- **Parameters:**
  - `app: App[ReturnType]` -- The application instance to drive.

### Properties

- `app -> App[ReturnType]` -- A reference to the application being piloted.

### Methods

#### press

```python
async def press(self, *keys: str) -> None
```

Simulate key-presses. After pressing, waits for the screen to process all pending events.

- **Parameters:**
  - `*keys: str` -- Keys to press (e.g. `"enter"`, `"tab"`, `"a"`).

#### resize_terminal

```python
async def resize_terminal(self, width: int, height: int) -> None
```

Resize the terminal to the given dimensions. If running with the headless driver, updates the driver's internal size. Posts a `Resize` event and pauses.

- **Parameters:**
  - `width: int` -- The new width of the terminal.
  - `height: int` -- The new height of the terminal.

#### mouse_down

```python
async def mouse_down(
    self,
    widget: Widget | type[Widget] | str | None = None,
    offset: tuple[int, int] = (0, 0),
    shift: bool = False,
    meta: bool = False,
    control: bool = False,
    button: int = 1,
) -> bool
```

Simulate a `MouseDown` event at a specified position. Preceded by a `MouseMove` event.

- **Parameters:**
  - `widget` -- A widget instance, widget class, or CSS selector used as origin for the offset. If `None`, offset is relative to the screen.
  - `offset` -- The offset relative to the widget/screen.
  - `shift` -- Simulate with shift key held.
  - `meta` -- Simulate with meta key held.
  - `control` -- Simulate with control key held.
  - `button` -- The mouse button to press (default 1).
- **Raises:** `OutOfBounds` -- If the target position is outside the visible screen.
- **Returns:** `True` if no selector was specified or if the event landed on the selected widget, `False` otherwise.

#### mouse_up

```python
async def mouse_up(
    self,
    widget: Widget | type[Widget] | str | None = None,
    offset: tuple[int, int] = (0, 0),
    shift: bool = False,
    meta: bool = False,
    control: bool = False,
) -> bool
```

Simulate a `MouseUp` event at a specified position. Preceded by a `MouseMove` event. Always uses button 1.

- **Parameters:** Same as `mouse_down` except no `button` parameter.
- **Raises:** `OutOfBounds` -- If the target position is outside the visible screen.
- **Returns:** `True` if no selector was specified or if the event landed on the selected widget, `False` otherwise.

#### click

```python
async def click(
    self,
    widget: Widget | type[Widget] | str | None = None,
    offset: tuple[int, int] = (0, 0),
    shift: bool = False,
    meta: bool = False,
    control: bool = False,
    times: int = 1,
    button: int = 1,
) -> bool
```

Simulate clicking with the mouse. Fires `MouseDown`, `MouseUp`, and `Click` events in sequence. Bypasses normal event processing in `App.on_event`.

- **Parameters:**
  - `widget` -- A widget instance, widget class, or CSS selector as click origin. If `None`, offset is relative to screen.
  - `offset` -- The offset relative to widget/screen.
  - `shift` -- Click with shift held.
  - `meta` -- Click with meta held.
  - `control` -- Click with control held.
  - `times` -- Number of times to click (2 for double-click, 3 for triple-click, etc.). Each repetition fires the full `MouseDown`/`MouseUp`/`Click` sequence with an incrementing `chain` value on the `Click` event.
  - `button` -- The mouse button to click (default 1).
- **Raises:** `OutOfBounds` -- If the target position is outside the visible screen.
- **Returns:** `True` if no selector was specified or if the selected widget was under the mouse, `False` otherwise.

#### double_click

```python
async def double_click(
    self,
    widget: Widget | type[Widget] | str | None = None,
    offset: tuple[int, int] = (0, 0),
    shift: bool = False,
    meta: bool = False,
    control: bool = False,
    button: int = 1,
) -> bool
```

Simulate double clicking. Alias for `click(..., times=2)`.

- **Parameters:** Same as `click` except no `times` parameter (fixed at 2).
- **Raises:** `OutOfBounds`
- **Returns:** Same as `click`.

#### triple_click

```python
async def triple_click(
    self,
    widget: Widget | type[Widget] | str | None = None,
    offset: tuple[int, int] = (0, 0),
    shift: bool = False,
    meta: bool = False,
    control: bool = False,
    button: int = 1,
) -> bool
```

Simulate triple clicking. Alias for `click(..., times=3)`.

- **Parameters:** Same as `click` except no `times` parameter (fixed at 3).
- **Raises:** `OutOfBounds`
- **Returns:** Same as `click`.

#### hover

```python
async def hover(
    self,
    widget: Widget | type[Widget] | str | None = None,
    offset: tuple[int, int] = (0, 0),
) -> bool
```

Simulate hovering with the mouse cursor. Fires a `MouseMove` event. Pauses first to let the mouse "settle" before moving to the new position.

- **Parameters:**
  - `widget` -- Widget, widget class, or CSS selector as hover origin. If `None`, offset is relative to screen.
  - `offset` -- The offset relative to widget/screen.
- **Raises:** `OutOfBounds` -- If the target position is outside the visible screen.
- **Returns:** `True` if no selector was specified or if the hover landed on the selected widget, `False` otherwise.

#### pause

```python
async def pause(self, delay: float | None = None) -> None
```

Insert a pause. Waits for the screen to process pending events, then either waits for CPU idle (if `delay` is `None`) or sleeps for the specified duration. Triggers a timer update on the screen after pausing.

- **Parameters:**
  - `delay: float | None` -- Seconds to pause, or `None` to wait for CPU idle.

#### wait_for_animation

```python
async def wait_for_animation(self) -> None
```

Wait for any current animation to complete. Triggers a timer update on the screen afterward.

#### wait_for_scheduled_animations

```python
async def wait_for_scheduled_animations(self) -> None
```

Wait for any current and scheduled animations to complete. Waits for the screen, waits until the animator is fully complete, waits for the screen again, waits for idle, and triggers a timer update.

#### exit

```python
async def exit(self, result: ReturnType) -> None
```

Exit the app with the given result. Waits for the screen and idle processing before calling `app.exit(result)`.

- **Parameters:**
  - `result: ReturnType` -- The app result returned by `run` or `run_async`.

### Internal Methods

#### _post_mouse_events

```python
async def _post_mouse_events(
    self,
    events: list[type[MouseEvent]],
    widget: Widget | type[Widget] | str | None = None,
    offset: tuple[int, int] = (0, 0),
    button: int = 0,
    shift: bool = False,
    meta: bool = False,
    control: bool = False,
    times: int = 1,
) -> bool
```

Core method for simulating mouse events. Resolves the target widget (from widget instance, class, CSS selector, or screen), computes absolute screen coordinates, validates bounds, and fires the specified sequence of mouse event types. Updates `app.mouse_position` and forwards events directly to the screen (bypassing `App.on_event`).

For `Click` events, includes a `chain` parameter that increments with each repetition (for multi-click support). The widget under the mouse is determined before the first event of each repetition.

#### _wait_for_screen

```python
async def _wait_for_screen(self, timeout: float = 30.0) -> bool
```

Wait for the current screen and its children to have processed all pending events. Uses `call_later` to place decrement callbacks on each widget's message queue, then waits for all callbacks to execute.

- **Parameters:**
  - `timeout: float` -- Timeout in seconds (default 30).
- **Raises:** `WaitForScreenTimeout` -- If processing does not complete within the timeout.
- **Returns:** `True` if all events were processed, `False` if an exception occurred.

## Module-Level Functions

### _get_mouse_message_arguments

```python
def _get_mouse_message_arguments(
    target: Widget,
    offset: tuple[int, int] = (0, 0),
    button: int = 0,
    shift: bool = False,
    meta: bool = False,
    control: bool = False,
) -> dict[str, Any]
```

Compute the argument dictionary for mouse event constructors. Translates the target widget's region offset plus the provided offset into absolute screen coordinates.

- **Returns:** Dictionary with keys: `widget`, `x`, `y`, `delta_x`, `delta_y`, `button`, `shift`, `meta`, `ctrl`, `screen_x`, `screen_y`.
