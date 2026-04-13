# textual.scrollbar

Contains the widgets that manage Textual scrollbars. Most apps will not need to interact with these directly.

## Messages

All scrollbar messages inherit from `ScrollMessage(Message, bubble=False)` -- they do not bubble.

### ScrollMessage

`ScrollMessage(Message, bubble=False)` -- Base class for all scrollbar messages.

### ScrollUp

`ScrollUp(ScrollMessage, verbose=True)` -- Message sent when clicking above the scrollbar handle (scroll up / scroll left).

### ScrollDown

`ScrollDown(ScrollMessage, verbose=True)` -- Message sent when clicking below the scrollbar handle (scroll down / scroll right).

### ScrollLeft

`ScrollLeft(ScrollMessage, verbose=True)` -- Message sent when clicking left of a horizontal scrollbar handle.

### ScrollRight

`ScrollRight(ScrollMessage, verbose=True)` -- Message sent when clicking right of a horizontal scrollbar handle.

### ScrollTo

`ScrollTo(ScrollMessage, verbose=True)` -- Message sent when click-dragging the scrollbar handle.

#### Slots

- `x: float | None` -- Target x scroll position, or `None`.
- `y: float | None` -- Target y scroll position, or `None`.
- `animate: bool` -- Whether to animate the scroll (default `True`).

#### Initialization

```python
def __init__(
    self,
    x: float | None = None,
    y: float | None = None,
    animate: bool = True,
) -> None
```

## ScrollBarRender

`ScrollBarRender` -- Rich renderable that draws a scrollbar (vertical or horizontal). Implements the Rich console protocol.

### Class Variables

- `VERTICAL_BARS: ClassVar[list[str]] = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", " "]` -- Glyphs for vertical scrollbar ends (smoother display).
- `HORIZONTAL_BARS: ClassVar[list[str]] = ["▉", "▊", "▋", "▌", "▍", "▎", "▏", " "]` -- Glyphs for horizontal scrollbar ends (smoother display).
- `BLANK_GLYPH: ClassVar[str] = " "` -- Glyph used for the main body of the scrollbar.

### Initialization

```python
def __init__(
    self,
    virtual_size: int = 100,
    window_size: int = 0,
    position: float = 0,
    thickness: int = 1,
    vertical: bool = True,
    style: StyleType = "bright_magenta on #555555",
) -> None
```

- **Parameters:**
  - `virtual_size` -- Total size of the scrollable content.
  - `window_size` -- Size of the visible window.
  - `position` -- Current scroll position.
  - `thickness` -- Thickness of the scrollbar in cells.
  - `vertical` -- `True` for vertical, `False` for horizontal.
  - `style` -- Style for the scrollbar (foreground = thumb color, background = track color).

### Methods

#### render_bar

```python
@classmethod
def render_bar(
    cls,
    size: int = 25,
    virtual_size: float = 50,
    window_size: float = 20,
    position: float = 0,
    thickness: int = 1,
    vertical: bool = True,
    back_color: Color = Color.parse("#555555"),
    bar_color: Color = Color.parse("bright_magenta"),
) -> Segments
```

Core rendering method. Computes the thumb size and position from the ratio of `window_size` to `virtual_size`, then builds a list of `Segment` objects representing the scrollbar track and thumb.

- Track segments above the thumb get `@mouse.down: "scroll_up"` metadata.
- Track segments below the thumb get `@mouse.down: "scroll_down"` metadata.
- Thumb segments get `@mouse.down: "grab"` metadata.
- Sub-cell bar characters are used at the start and end of the thumb for smoother appearance.
- If `window_size` is zero, `size` is zero, `virtual_size` is zero, or `size == virtual_size`, the entire bar is rendered as a plain track with no thumb.

Returns a `Segments` renderable. Vertical bars include newlines; horizontal bars replicate rows for `thickness`.

### Rich Console Protocol

`__rich_console__` determines the size from console options, resolves the style colors, and delegates to `render_bar`.

## ScrollBar

`ScrollBar(Widget)` -- The scrollbar widget.

Decorated with `@rich.repr.auto`.

### Class Variables

- `renderer: ClassVar[Type[ScrollBarRender]] = ScrollBarRender` -- The class used for rendering scrollbars. Can be overridden at the class level (affects all scrollbars) or on specific instances to customize rendering.
- `DEFAULT_CLASSES: str = "-textual-system"` -- Default CSS classes.
- `ALLOW_SELECT: bool = False` -- Scrollbars do not participate in selection.

### Initialization

```python
def __init__(
    self,
    vertical: bool = True,
    name: str | None = None,
    *,
    thickness: int = 1,
) -> None
```

- **Parameters:**
  - `vertical: bool` -- `True` for vertical scrollbar, `False` for horizontal.
  - `name: str | None` -- Optional widget name.
  - `thickness: int` -- Scrollbar thickness in cells (keyword-only).
- Sets `auto_links` reactive to `False`.

### Reactive Attributes

- `window_virtual_size: Reactive[int] = Reactive(100)` -- Total virtual size of the scrollable content.
- `window_size: Reactive[int] = Reactive(0)` -- Size of the visible window.
- `position: Reactive[float] = Reactive(0)` -- Current scroll position.
- `mouse_over: Reactive[bool] = Reactive(False)` -- Whether the mouse is over the scrollbar.
- `grabbed: Reactive[Offset | None] = Reactive(None)` -- The mouse position when the scrollbar was grabbed, or `None`.

### Instance Attributes

- `vertical: bool` -- Whether this is a vertical scrollbar.
- `thickness: int` -- Scrollbar thickness.
- `grabbed_position: float` -- Scroll position when the grab started (initialized to 0).

### Methods

#### validate_position

```python
def validate_position(self, position: float) -> float
```

Validates the position reactive. Quantizes position to 1/8 cell granularity.

#### render

```python
def render(self) -> RenderableType
```

Renders the scrollbar. Reads styles from the parent widget:
- If grabbed: uses `scrollbar_background_active` and `scrollbar_color_active`.
- If mouse over: uses `scrollbar_background_hover` and `scrollbar_color_hover`.
- Otherwise: uses `scrollbar_background` and `scrollbar_color`.
Background colors with alpha < 1 are composited against the parent's background. If the screen's `scrollbar_color` alpha is 0, renders with default style; otherwise delegates to `_render_bar`.

#### action_scroll_down

```python
def action_scroll_down(self) -> None
```

Scroll down (vertical) or right (horizontal). Posts `ScrollDown` or `ScrollRight` message. No-op if the scrollbar is grabbed.

#### action_scroll_up

```python
def action_scroll_up(self) -> None
```

Scroll up (vertical) or left (horizontal). Posts `ScrollUp` or `ScrollLeft` message. No-op if the scrollbar is grabbed.

#### action_grab

```python
def action_grab(self) -> None
```

Begin capturing the mouse cursor via `capture_mouse()`.

### Event Handlers

- `_on_hide` -- Releases mouse and clears `grabbed` if the scrollbar is hidden while grabbed.
- `_on_enter` -- Sets `mouse_over = True` when the mouse enters this widget.
- `_on_leave` -- Sets `mouse_over = False` when the mouse leaves this widget.
- `_on_mouse_down` -- Stops event propagation (prevents bubbling).
- `_on_mouse_up` -- Releases mouse and clears `grabbed`. Stops event propagation.
- `_on_mouse_capture` -- Begins realtime animation, sets pointer to `"grabbing"`, releases parent anchor, records `grabbed` position and `grabbed_position`.
- `_on_mouse_release` -- Completes realtime animation, resets pointer to `"default"`, clears `grabbed`, checks parent anchor (vertical only). Stops propagation.
- `_on_mouse_move` -- If grabbed, computes the new scroll position from the mouse delta scaled by the ratio of `virtual_size` to `window_size`, then posts a `ScrollTo` message. The `animate` parameter of `ScrollTo` is set to `not self.app.supports_smooth_scrolling`. Stops propagation.
- `_on_click` -- Stops event propagation.

## ScrollBarCorner

`ScrollBarCorner(Widget)` -- Widget that fills the gap between horizontal and vertical scrollbars when both are present.

### Methods

#### render

```python
def render(self) -> RenderableType
```

Renders a `Blank` filled with the parent's `scrollbar_corner_color` style.
