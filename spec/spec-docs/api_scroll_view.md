# textual.scroll_view

`ScrollView` is a base class for Line API widgets -- widgets that handle their own scrolling rather than relying on the compositor to render children.

## ScrollView

`ScrollView(ScrollableContainer)` -- A base class for widgets that manage their own scrolling.

This is typically the wrong class for making something scrollable. For standard scrolling, set the `overflow` style to `auto` or `scroll`, or use a pre-defined scrolling container such as `VerticalScroll`.

### Class Variables

- `ALLOW_MAXIMIZE: bool = True` -- Allows the widget to be maximized.

### Default CSS

```css
ScrollView {
    overflow-y: auto;
    overflow-x: auto;
}
```

### Properties

- `is_scrollable -> bool` -- Always returns `True`. ScrollView is always scrollable.
- `is_container -> bool` -- Always returns `False`. Since a ScrollView is a Line API widget, it does not have children and is not a container.

### Methods

#### get_content_width

```python
def get_content_width(self, container: Size, viewport: Size) -> int
```

Gets the width of the content area.

- **Parameters:**
  - `container: Size` -- Size of the container (immediate parent) widget.
  - `viewport: Size` -- Size of the viewport.
- **Returns:** `int` -- The virtual size width (`self.virtual_size.width`).

#### get_content_height

```python
def get_content_height(self, container: Size, viewport: Size, width: int) -> int
```

Gets the height (number of lines) in the content area.

- **Parameters:**
  - `container: Size` -- Size of the container (immediate parent) widget.
  - `viewport: Size` -- Size of the viewport.
  - `width: int` -- Width of renderable.
- **Returns:** `int` -- The virtual size height (`self.virtual_size.height`).

#### scroll_to

```python
def scroll_to(
    self,
    x: float | None = None,
    y: float | None = None,
    *,
    animate: bool = True,
    speed: float | None = None,
    duration: float | None = None,
    easing: EasingFunction | str | None = None,
    force: bool = False,
    on_complete: CallbackType | None = None,
    level: AnimationLevel = "basic",
    immediate: bool = False,
) -> None
```

Scroll to a given absolute coordinate, optionally animating. This is a custom override that does not require `call_after_refresh`.

- **Parameters:**
  - `x: float | None` -- X coordinate (column) to scroll to, or `None` for no change.
  - `y: float | None` -- Y coordinate (row) to scroll to, or `None` for no change.
  - `animate: bool` -- Whether to animate to the new scroll position.
  - `speed: float | None` -- Speed of scroll if animating; `None` to use `duration`.
  - `duration: float | None` -- Duration of animation if animating and `speed` is `None`.
  - `easing: EasingFunction | str | None` -- Easing method for the animation.
  - `force: bool` -- Force scrolling even when prohibited by overflow styling.
  - `on_complete: CallbackType | None` -- Callable invoked when the animation finishes.
  - `level: AnimationLevel` -- Minimum animation level required (default `"basic"`).
  - `immediate: bool` -- If `True`, scroll immediately; if `False`, defer until after a screen refresh.

#### refresh_line

```python
def refresh_line(self, y: int) -> None
```

Refresh a single line at the given coordinate (adjusted for scroll offset).

- **Parameters:**
  - `y: int` -- Coordinate of the line in virtual space.

#### refresh_lines

```python
def refresh_lines(self, y_start: int, line_count: int = 1) -> None
```

Refresh one or more lines starting at `y_start` (adjusted for scroll offset).

- **Parameters:**
  - `y_start: int` -- First line to refresh in virtual space.
  - `line_count: int` -- Total number of lines to refresh (default 1).

#### render

```python
def render(self) -> RenderableType
```

Render the scrollable region. This is a fallback if `render_lines` is not implemented. Returns a Rich `Panel` displaying the scroll offset and vertical scrollbar visibility (for debugging).

### Watchers

- `watch_scroll_x(old_value: float, new_value: float)` -- Updates the horizontal scrollbar position and refreshes the widget when the rounded value changes.
- `watch_scroll_y(old_value: float, new_value: float)` -- Updates the vertical scrollbar position and refreshes the widget when the rounded value changes.

### Event Handlers

- `on_mount()` -- Calls `_refresh_scrollbars()` to initialize scrollbar state.

### Internal Methods

- `_size_updated(size: Size, virtual_size: Size, container_size: Size, layout: bool = True) -> bool` -- Called when the widget's size is updated. Recalculates container size (subtracting gutter), triggers scroll updates, and returns whether a resize event should be sent. Does not update `virtual_size` from the parameter (uses the existing `self.virtual_size` instead).
