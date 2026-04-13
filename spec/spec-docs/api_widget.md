# API: Widget

API specification for the `textual.widget` module.

## Module Exports

### `AwaitMount`

An awaitable returned by `mount()` and `mount_all()`. Awaiting it waits for all mounted widgets to complete their mount lifecycle.

```python
await self.mount(Static("foo"))
```

### `MountError`

Exception raised when there is a problem with a mount request (duplicate IDs, specifying both `before` and `after`, mounting before the widget is attached, etc.).

### `WidgetError`

Base exception for widget errors.

### `PseudoClasses`

A `NamedTuple` used as a cache key for render/render_line widgets.

| Field | Type | Description |
|---|---|---|
| `enabled` | `bool` | Is the widget enabled? |
| `focus` | `bool` | Does the widget have focus? |
| `hover` | `bool` | Is the mouse hovering? |

## `Widget` Class

```python
class Widget(DOMNode):
```

Base class for all Textual widgets.

### Construction

```python
Widget(
    *children: Widget,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
    markup: bool = True,
)
```

| Parameter | Description |
|---|---|
| `*children` | Child widgets to mount immediately. |
| `name` | Name of the widget. |
| `id` | DOM ID (must be unique). |
| `classes` | Space-separated CSS class names. |
| `disabled` | Whether the widget starts disabled. |
| `markup` | Enable content markup rendering. |

A widget cannot be its own child (raises `WidgetError`). Positional arguments must be `Widget` subclasses (raises `TypeError`).

### Class Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `DEFAULT_CSS` | `str` | *(scrollbar + link styles)* | Lowest-priority CSS. |
| `DEFAULT_CLASSES` | `str` | `""` | Default classes if none supplied. |
| `COMPONENT_CLASSES` | `set[str]` | `set()` | Component classes for line API widgets. |
| `BORDER_TITLE` | `str` | `""` | Initial border title value. |
| `BORDER_SUBTITLE` | `str` | `""` | Initial border subtitle value. |
| `ALLOW_MAXIMIZE` | `bool \| None` | `None` | `None` uses default (focusable widgets may be maximized). `False` disallows. `True` allows. |
| `ALLOW_SELECT` | `bool` | `True` | Whether the widget supports text selection. |
| `FOCUS_ON_CLICK` | `bool` | `True` | Auto-focus focusable widgets on click. |
| `BLANK` | `bool` | `False` | Widget is blank (optimization for large containers). |
| `can_focus` | `bool` | `False` | Whether the widget may receive focus. |
| `can_focus_children` | `bool` | `True` | Whether the widget's children may receive focus. |

### Reactive Attributes

| Attribute | Type | Default | Description |
|---|---|---|---|
| `expand` | `bool` | `False` | Rich renderable may expand beyond optimal size. |
| `shrink` | `bool` | `True` | Rich renderable may shrink below optimal size. |
| `auto_links` | `bool` | `True` | Automatically highlight links. |
| `disabled` | `bool` | `False` | Whether the widget is disabled. |
| `hover_style` | `Style` | `Style` | Current hover style (read only). |
| `highlight_link_id` | `str` | `""` | Currently highlighted link ID (read only). |
| `loading` | `bool` | `False` | Show a loading indicator instead of widget content. |
| `virtual_size` | `Size` | `Size(0, 0)` | The virtual (scrollable) size. |
| `has_focus` | `bool` | `False` | Does this widget have focus? (read only). |
| `mouse_hover` | `bool` | `False` | Is the mouse over this widget? (read only). |
| `scroll_x` | `float` | `0.0` | Horizontal scroll position. |
| `scroll_y` | `float` | `0.0` | Vertical scroll position. |
| `scroll_target_x` | `float` | `0.0` | Target horizontal scroll position. |
| `scroll_target_y` | `float` | `0.0` | Target vertical scroll position. |
| `show_vertical_scrollbar` | `bool` | `False` | Whether the vertical scrollbar is visible. |
| `show_horizontal_scrollbar` | `bool` | `False` | Whether the horizontal scrollbar is visible. |

### Descriptors

| Attribute | Type | Description |
|---|---|---|
| `border_title` | `str \| None` | Title shown in the top border. |
| `border_subtitle` | `str \| None` | Title shown in the bottom border. |

### Properties

| Property | Type | Description |
|---|---|---|
| `is_mounted` | `bool` | Whether the widget has been mounted. |
| `siblings` | `list[Widget]` | Sibling widgets (excluding self). |
| `visible_siblings` | `list[Widget]` | Visible and displayed siblings. |
| `allow_vertical_scroll` | `bool` | Whether vertical scrolling is permitted. |
| `allow_horizontal_scroll` | `bool` | Whether horizontal scrolling is permitted. |
| `allow_maximize` | `bool` | Whether the widget may be maximized. |
| `offset` | `Offset` | Widget offset from origin. Settable. |
| `opacity` | `float` | Total opacity (product of ancestor opacities). |
| `is_anchored` | `bool` | Whether the widget is anchored to the bottom. |
| `is_mouse_over` | `bool` | Whether the mouse pointer is within the widget's region. |
| `is_maximized` | `bool` | Whether this widget is currently maximized. |
| `is_in_maximized_view` | `bool` | Whether this widget or an ancestor is maximized. |
| `text_selection` | `Selection \| None` | Text selection info, or `None`. |
| `is_disabled` | `bool` | Whether the widget is disabled (checks ancestors). |
| `has_focus_within` | `bool` | Whether any descendant has focus. |
| `first_of_type` | `bool` | First widget of its type among siblings. |
| `last_of_type` | `bool` | Last widget of its type among siblings. |
| `first_child` | `bool` | First displayed child of parent. |
| `last_child` | `bool` | Last displayed child of parent. |
| `is_odd` | `bool` | At an odd-numbered position among siblings. |
| `is_even` | `bool` | At an even-numbered position among siblings. |
| `tooltip` | `VisualType \| None` | Tooltip content. Settable. |
| `max_scroll_x` | `int` | Maximum horizontal scroll value. |
| `max_scroll_y` | `int` | Maximum vertical scroll value. |
| `is_vertical_scroll_end` | `bool` | Vertical scroll at maximum. |
| `is_horizontal_scroll_end` | `bool` | Horizontal scroll at maximum. |
| `scrollbar_corner` | `ScrollBarCorner` | Scrollbar corner widget (created on access). |
| `vertical_scrollbar` | `ScrollBar` | Vertical scrollbar (created on access). |
| `horizontal_scrollbar` | `ScrollBar` | Horizontal scrollbar (created on access). |
| `scrollbars_enabled` | `tuple[bool, bool]` | `(vertical_enabled, horizontal_enabled)`. |
| `scrollbars_space` | `tuple[int, int]` | Cells occupied by scrollbars `(vertical, horizontal)`. |
| `scrollbar_size_vertical` | `int` | Width of the vertical scrollbar. |
| `scrollbar_size_horizontal` | `int` | Height of the horizontal scrollbar. |
| `background_colors` | `tuple[Color, Color]` | `(base_background, background)` adjusted for opacity. |
| `colors` | `tuple[Color, Color, Color, Color]` | `(parent_bg, parent_color, bg, color)`. |
| `allow_select` | `bool` | Whether text selection is permitted (considers `ALLOW_SELECT` and `is_container`). |
| `lock` | `RLock` | Asyncio lock for synchronizing widget state. |
| `visual_style` | `VisualStyle` | Cached visual style. |

### CSS Pseudo-Classes

| Pseudo-Class | Matches When |
|---|---|
| `:hover` | Mouse is over the widget. |
| `:focus` | Widget has focus. |
| `:blur` | Widget does not have focus. |
| `:can-focus` | Widget can receive focus. |
| `:disabled` | Widget is disabled. |
| `:enabled` | Widget is not disabled. |
| `:dark` | Current theme is dark. |
| `:light` | Current theme is light. |
| `:focus-within` | A descendant has focus. |
| `:inline` | App is running inline. |
| `:ansi` | ANSI color mode is enabled. |
| `:nocolor` | `NO_COLOR` is set. |
| `:first-of-type` | First sibling of its type. |
| `:last-of-type` | Last sibling of its type. |
| `:first-child` | First displayed child. |
| `:last-child` | Last displayed child. |
| `:odd` | Odd-numbered position. |
| `:even` | Even-numbered position. |
| `:empty` | No displayed children. |

### Compose and Lifecycle

#### `compose()`

Override to yield child widgets. Called during mount and recompose.

```python
def compose(self) -> ComposeResult:
    yield Header()
    yield Footer()
```

#### `recompose()`

Remove children and re-run `compose()`.

#### Context Manager (`__enter__` / `__exit__`)

Widgets can be used as context managers during composition for nesting:

```python
with Container():
    yield Label("Inside container")
```

### Mounting

#### `mount(*widgets, before=None, after=None)`

Mount widgets as children. Returns `AwaitMount`. Only one of `before` or `after` may be specified.

Raises `MountError` for duplicate IDs, specifying both `before` and `after`, or mounting before the widget is attached.

#### `mount_all(widgets, before=None, after=None)`

Mount widgets from an iterable. Same semantics as `mount()`.

#### `mount_compose(compose_result, before=None, after=None)`

Mount widgets from the result of a compose-like function (supporting context managers).

### Removal

#### `remove()`

Remove the widget from the DOM. Returns `AwaitRemove`.

#### `remove_children(selector="*")`

Remove immediate children matching a CSS selector, widget type, or iterable of widgets. Returns `AwaitRemove`.

### Moving Children

#### `move_child(child, before=None, after=None)`

Reorder a child widget. Exactly one of `before` or `after` must be provided. Accepts `int` index or `Widget` reference. Raises `WidgetError` on invalid arguments.

### Rendering

#### `render()`

Return content for the widget. Override in subclasses. Returns `RenderResult` (markup string, `Content`, or Rich renderable).

#### `render_line(y)`

Render a single line. Returns `Strip`.

#### `render_lines(crop)`

Render lines for a region. Returns `list[Strip]`.

#### `render_str(text_content)`

Convert a string to `Content`, respecting widget markup settings. Passes through existing `Content` unchanged.

### Refresh

#### `refresh(*regions, repaint=True, layout=False, recompose=False)`

Schedule a refresh. By default repaints content. Set `layout=True` to also re-layout. Set `recompose=True` to remove and remount children. Returns `Self`.

### Focus

#### `focus(scroll_visible=True)`

Give focus to this widget. Returns `Self`.

#### `blur()`

Remove focus, moving it to the next widget in the focus chain. Returns `Self`.

#### `allow_focus()`

Override to customize focus permission. Default returns `can_focus`.

#### `allow_focus_children()`

Override to customize children focus permission. Default returns `can_focus_children`.

#### `focus_on_click()`

Override to change click-to-focus behavior. Default returns `FOCUS_ON_CLICK`.

### Scrolling

#### `scroll_to(x=None, y=None, animate=True, ...)`

Scroll to absolute coordinates.

#### `scroll_relative(x=None, y=None, animate=True, ...)`

Scroll relative to current position.

#### `scroll_home(animate=True, ...)`

Scroll to the top-left.

#### `scroll_end(animate=True, ...)`

Scroll to the bottom.

#### `scroll_left/right/up/down(...)`

Scroll by one unit in the given direction.

#### `scroll_page_up/down/left/right(...)`

Scroll by one page in the given direction.

#### `scroll_to_widget(widget, ...)`

Scroll until a widget is visible.

#### `scroll_to_region(region, ...)`

Scroll until a region is visible.

#### `scroll_visible(animate=True, ...)`

Scroll the widget into view (scrolls parent containers).

#### `scroll_to_center(widget, ...)`

Scroll to center a widget in the viewport.

#### `set_scroll(x, y)`

Set scroll position directly without validation or animation.

#### `can_view_entire(widget)`

Check if the entire widget is visible within this container.

#### `can_view_partial(widget)`

Check if any part of the widget is visible.

### Anchoring

#### `anchor(anchor=True)`

Anchor a scrollable widget to stay at the bottom when content is added.

#### `release_anchor()`

Release the anchor, allowing normal scrolling.

### Mouse Capture

#### `capture_mouse(capture=True)`

Capture the mouse so events go to this widget regardless of pointer position.

#### `release_mouse()`

Release mouse capture.

### Print Capture

#### `begin_capture_print(stdout=True, stderr=True)`

Capture stdout/stderr writes as `events.Print` messages.

#### `end_capture_print()`

Stop print capture.

### Text Selection

#### `text_select_all()`

Select the entire widget's text.

### Loading

#### `set_loading(loading)`

Show or hide a loading indicator overlay.

#### `get_loading_widget()`

Override to customize the loading indicator widget.

### Layout Hooks

#### `pre_layout(layout)`

Called before layout. Override to make updates that affect layout.

#### `process_layout(placements)`

Hook to manipulate widget placements before rendering. Returns modified placements list.

#### `pre_render()`

Called before rendering. Call `super()` if overriding.

### Content Dimensions

#### `get_content_width(container, viewport)`

Calculate the content width for layout. Override for custom sizing.

#### `get_content_height(container, viewport, width)`

Calculate the content height for layout. Override for custom sizing.

#### `clear_cached_dimensions()`

Clear cached dimension results. Call when a renderable changes size after creation.

### Styling

#### `get_component_rich_style(*names, partial=False, default=None)`

Get a Rich `Style` for component classes. Raises `KeyError` if component doesn't exist and no default provided.

#### `get_visual_style(*component_classes, partial=False)`

Get a `VisualStyle` for the widget including component styles.

#### `get_pseudo_class_state()`

Returns `PseudoClasses` named tuple with current pseudo-class state.

### Tooltips

#### `with_tooltip(tooltip)`

Chainable method to set a tooltip. Returns `Self`.

```python
yield Label("Hello").with_tooltip("A greeting")
```

### Notifications

#### `notify(message, title="", severity="information", timeout=None, markup=True)`

Create a notification (delegates to `App.notify`). Thread-safe.

### Batching

#### `batch()`

Async context manager combining widget locking and update batching.

```python
async with container.batch():
    await container.remove_children(Button)
    await container.mount(Label("Done"))
```

### Widget Lookup

#### `get_child_by_id(id, expect_type=None)`

Return immediate child by ID. Raises `NoMatches` or `WrongType`.

#### `get_widget_by_id(id, expect_type=None)`

Return descendant by ID (depth-first). Raises `NoMatches` or `WrongType`.

#### `get_child_by_type(expect_type)`

Get first immediate child of exact type. Raises `NoMatches`.

### Actions

| Action | Description |
|---|---|
| `action_scroll_home` | Scroll to top. |
| `action_scroll_end` | Scroll to bottom. |
| `action_scroll_left/right/up/down` | Scroll by one unit. |
| `action_page_up/down/left/right` | Scroll by one page. |
| `action_notify(message, title, severity, markup)` | Show a notification. |

### Event Handling

#### `run_action(action, namespaces=None)`

Perform an action with this widget as the default namespace.

#### `post_message(message)`

Post a message to this widget's queue. Returns `True` if queued.

#### `check_message_enabled(message)`

Check if a message is enabled. Disabled widgets block mouse events (except scroll events which pass through).

#### `broker_event(event_name, event)`

Broker an event through the app's action system.

#### `handle_key(event)`

Handle a key event via the dispatch key mechanism.

#### `check_consume_key(key, character)`

Override in widgets that capture keys (e.g., `Input`, `TextArea`) to hide consumed bindings from the footer.
