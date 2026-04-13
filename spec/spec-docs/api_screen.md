# API: Screen

API specification for the `textual.screen` module.

## Module Exports

### `ScreenResultType`

TypeVar for the result type of a screen. Used with `Screen[ScreenResultType]`.

### `ScreenResultCallbackType`

Type alias for screen result callback functions. Accepts sync or async callables taking an optional `ScreenResultType` parameter.

### `HoverWidgets`

A `NamedTuple` returned by `Screen.get_hover_widgets_at`.

| Field | Type | Description |
|---|---|---|
| `mouse_over` | `tuple[Widget, Region]` | Widget and region directly under the mouse. |
| `hover_over` | `tuple[Widget, Region] \| None` | Widget with a hover style under the mouse, or `None`. |

Property `widgets` returns `tuple[Widget, Widget | None]` containing just the widget references.

### `ResultCallback`

Holds the details of a callback for screen dismissal results.

```python
ResultCallback(
    requester: MessagePump,
    callback: ScreenResultCallbackType | None,
    future: asyncio.Future | None = None,
)
```

| Attribute | Type | Description |
|---|---|---|
| `requester` | `MessagePump` | The object that requested the callback. |
| `callback` | `ScreenResultCallbackType \| None` | The callback function. |
| `future` | `asyncio.Future \| None` | A Future to hold the result. |

Calling the `ResultCallback` instance invokes the callback with the given result. If `future` is set, the result is also set on the future.

### `ActiveBinding`

A `NamedTuple` representing an active key binding.

| Field | Type | Description |
|---|---|---|
| `node` | `DOMNode` | The node that owns the binding. |
| `binding` | `Binding` | The binding object. |
| `enabled` | `bool` | Whether the binding is enabled. |
| `tooltip` | `str` | Tooltip text for the binding. |

## `Screen` Class

```python
class Screen(Generic[ScreenResultType], Widget):
```

The base class for screens. A screen represents the full terminal content area. Screens are generic over `ScreenResultType`, the type returned when the screen is dismissed.

### Construction

```python
Screen(
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
)
```

| Parameter | Description |
|---|---|
| `name` | The name of the screen. |
| `id` | The ID of the screen in the DOM. |
| `classes` | The CSS classes for the screen. |

### Class Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `AUTO_FOCUS` | `str \| None` | `None` | Selector for auto-focus target. `None` inherits from app. `""` disables. |
| `CSS` | `str` | `""` | Inline CSS (applies to whole app). Rules take priority over `CSS_PATH`. |
| `CSS_PATH` | `CSSPathType \| None` | `None` | File paths to load CSS from (applies to whole app). |
| `TITLE` | `str \| None` | `None` | Default screen title. Overrides app title. |
| `SUB_TITLE` | `str \| None` | `None` | Default screen subtitle. Overrides app subtitle. |
| `COMMANDS` | `set[type[Provider] \| Callable]` | `set()` | Command providers for the command palette, scoped to this screen. |
| `ALLOW_IN_MAXIMIZED_VIEW` | `str \| None` | `None` | Selector for widgets allowed in maximized view. `None` defers to `App.ALLOW_IN_MAXIMIZED_VIEW`. |
| `ESCAPE_TO_MINIMIZE` | `bool \| None` | `None` | Use escape to minimize. `None` defers to `App.ESCAPE_TO_MINIMIZE`. |
| `HORIZONTAL_BREAKPOINTS` | `list[tuple[int, str]] \| None` | `None` | Overrides `App.HORIZONTAL_BREAKPOINTS` if not `None`. |
| `VERTICAL_BREAKPOINTS` | `list[tuple[int, str]] \| None` | `None` | Overrides `App.VERTICAL_BREAKPOINTS` if not `None`. |
| `COMPONENT_CLASSES` | `set[str]` | `{"screen--selection"}` | Component classes for styling selections. |
| `ALLOW_SELECT` | `bool` | `True` | Whether text selection is allowed. Accessed via `allow_select` property. |

### Default Bindings

| Key | Action | Description |
|---|---|---|
| `tab` | `app.focus_next` | Focus next widget. |
| `shift+tab` | `app.focus_previous` | Focus previous widget. |
| `ctrl+c,super+c` | `screen.copy_text` | Copy selected text. |

### Reactive Attributes

| Attribute | Type | Description |
|---|---|---|
| `focused` | `Widget \| None` | The focused widget. Do not set directly; use `set_focus()`. |
| `stack_updates` | `int` | Incremented when the screen is resumed. |
| `title` | `str \| None` | Screen title overriding app title. |
| `sub_title` | `str \| None` | Screen subtitle overriding app subtitle. |
| `maximized` | `Widget \| None` | The currently maximized widget, or `None`. |
| `selections` | `dict[Widget, Selection]` | Map of widgets to their text selections. |

### Properties

| Property | Type | Description |
|---|---|---|
| `is_modal` | `bool` | Whether the screen is modal. |
| `is_current` | `bool` | Whether the screen is currently visible. |
| `is_active` | `bool` | Whether the screen is the topmost (active) screen. |
| `layers` | `tuple[str, ...]` | Layer names including system layers. |
| `size` | `Size` | The size of the screen (app size minus gutter). |
| `allow_select` | `bool` | Whether text selection is permitted. |
| `active_bindings` | `dict[str, ActiveBinding]` | Currently active bindings on this screen. |
| `focus_chain` | `list[Widget]` | Ordered list of widgets that may receive focus. |

### Signals

| Signal | Description |
|---|---|
| `screen_layout_refresh_signal` | Published when the screen's layout is refreshed. |
| `bindings_updated_signal` | Published when bindings are updated. |
| `text_selection_started_signal` | Published when text selection starts. |

### Focus Management

#### `set_focus(widget, scroll_visible=True, from_app_focus=False)`

Focus or un-focus a widget. A focused widget receives key events first.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `widget` | `Widget \| None` | required | Widget to focus, or `None` to un-focus. |
| `scroll_visible` | `bool` | `True` | Scroll widget into view. |
| `from_app_focus` | `bool` | `False` | Whether this focus is from the app regaining focus. |

#### `focus_next(selector="*")`

Focus the next widget in the focus chain, optionally filtered by a CSS selector. Returns the newly focused widget or `None`.

#### `focus_previous(selector="*")`

Focus the previous widget in the focus chain. Same semantics as `focus_next`.

#### `refresh_bindings()`

Request a refresh of bindings (publishes `bindings_updated_signal`).

### Widget Lookup

#### `get_widget_at(x, y)`

Get the widget at screen coordinates. Returns `tuple[Widget, Region]`. Raises `NoWidget` if none found.

#### `get_hover_widgets_at(x, y)`

Get the widget directly under the mouse and the first widget with a hover style. Returns `HoverWidgets`. Raises `NoWidget` if none found.

#### `get_widgets_at(x, y)`

Get all widgets under a coordinate. Returns `Iterable[tuple[Widget, Region]]`.

#### `get_focusable_widget_at(x, y)`

Get the focusable widget under a coordinate, walking ancestors if the direct widget is not focusable. Returns `Widget | None`.

#### `get_style_at(x, y)`

Get the Rich `Style` at screen coordinates. Returns `Style`.

#### `get_widget_and_offset_at(x, y)`

Get widget and content offset at coordinates. Returns `tuple[Widget | None, Offset | None]`.

#### `get_offset(widget)`

Get the absolute offset of a widget relative to the top-left of the terminal.

#### `find_widget(widget)`

Get the `MapGeometry` of a widget in the compositor. Raises `NoWidget` if not found.

### Maximization

#### `maximize(widget, container=True)`

Maximize a widget to fill the screen. When `container=True`, walks ancestors to find the most suitable widget. Returns `True` if maximized.

#### `minimize()`

Restore any maximized widget to normal state.

### Text Selection

#### `clear_selection()`

Clear any selected text.

#### `get_selected_text()`

Get text under the current selection. Returns `str | None`.

### Rendering

#### `render()`

Render the screen's background. Returns a `RenderableType`.

### Layout

#### `arrange(size)`

Arrange children within the screen. Accounts for maximized widgets. Returns `DockArrangeResult`.

### Actions

| Action | Description |
|---|---|
| `action_copy_text` | Copy selected text to clipboard. |
| `action_maximize` | Maximize the currently focused widget. |
| `action_minimize` | Minimize the currently maximized widget. |
| `action_blur` | Remove focus. |
| `action_focus(selector)` | Focus the first widget matching the selector. |

### Pointer Shape

#### `update_pointer_shape()`

Update the screen's mouse pointer shape based on the widget under the cursor and its styles.

## `SystemModalScreen`

A subclass of `Screen` used for system-level modal screens (e.g., the command palette). Marked as modal.

## `ModalScreen`

A subclass of `Screen` for user-defined modal screens. When a modal screen is active, input is restricted to that screen.
