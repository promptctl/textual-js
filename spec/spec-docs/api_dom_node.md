# API: DOMNode

API specification for the `textual.dom` module.

## Module Exports

### `WalkMethod`

Type alias: `Literal["depth", "breadth"]`. Valid walking methods for `DOMNode.walk_children`.

### Exceptions

| Exception | Description |
|---|---|
| `BadIdentifier` | Raised when an `id` or class name is in an invalid format. Identifiers must contain only letters, numbers, underscores, or hyphens, and must not begin with a number. |
| `DOMError` | Base exception for DOM-related errors. |
| `NoScreen` | Raised when a node has no associated screen. |

### `check_identifiers(description, *names)`

Module-level function that validates identifiers and raises `BadIdentifier` on failure.

## `DOMNode` Class

```python
class DOMNode(MessagePump):
```

Base class for any object in the Textual DOM: `App`, `Screen`, and `Widget` all inherit from `DOMNode`.

### Construction

```python
DOMNode(
    *,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
)
```

| Parameter | Description |
|---|---|
| `name` | Optional name for the node. |
| `id` | Optional DOM ID (validated as an identifier). |
| `classes` | Space-separated CSS class names (each validated). |

### Subclass Configuration

```python
class MyWidget(Widget, inherit_css=True, inherit_bindings=True, inherit_component_classes=True):
```

| Parameter | Default | Description |
|---|---|---|
| `inherit_css` | `True` | Inherit CSS from base classes. |
| `inherit_bindings` | `True` | Inherit key bindings from base classes. |
| `inherit_component_classes` | `True` | Inherit component classes from base classes. |

### Class Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `DEFAULT_CSS` | `str` | `""` | Default TCSS styles. |
| `DEFAULT_CLASSES` | `str` | `""` | Default CSS classes if none supplied. |
| `COMPONENT_CLASSES` | `set[str]` | `set()` | Component classes for line API widgets. |
| `BINDING_GROUP_TITLE` | `str \| None` | `None` | Title shown where bindings are displayed. |
| `BINDINGS` | `list[BindingType]` | `[]` | Key bindings for this node. |
| `SCOPED_CSS` | `bool` | `True` | Whether default CSS is scoped to this widget type. |
| `HELP` | `str \| None` | `None` | Help text for the help panel (Markdown format). |

### Properties

| Property | Type | Description |
|---|---|---|
| `parent` | `DOMNode \| None` | The parent node. `None` for the App root. |
| `screen` | `Screen` | The screen containing this node. Raises `NoScreen` if unmounted. |
| `id` | `str \| None` | The DOM ID. May only be set once; raises `ValueError` on re-assignment. |
| `name` | `str \| None` | The node's name. |
| `classes` | `frozenset[str]` | Current CSS classes. Settable with a string or iterable. |
| `children` | `Sequence[Widget]` | A view of child widgets. |
| `displayed_children` | `Sequence[Widget]` | Children where `display==True`. |
| `displayed_and_visible_children` | `Sequence[Widget]` | Children where `display==True` and `visible==True`. |
| `is_empty` | `bool` | Whether there are no displayed children. |
| `display` | `bool` | Whether the node is displayed. Settable to `bool` or valid display string (`"block"`, `"none"`). `False` prevents the node from consuming layout space. |
| `visible` | `bool` | Whether the node is visible. Inherits from ancestors if not explicitly set. Settable to `bool` or visibility string. Invisible nodes reserve space but show nothing. |
| `pseudo_classes` | `frozenset[str]` | All active pseudo classes. |
| `css_identifier` | `str` | A CSS selector that identifies this node (e.g., `"MyWidget#my-id"`). |
| `css_identifier_styled` | `Text` | Syntax-highlighted CSS identifier. |
| `css_path_nodes` | `list[DOMNode]` | Path from App to this node. |
| `tree` | `Tree` | Rich tree for DOM visualization. |
| `css_tree` | `Tree` | Rich tree annotated with CSS info. |
| `text_style` | `Style` | Inherited text style from ancestors. |
| `selection_style` | `Style` | Style for selected text. |
| `rich_style` | `Style` | Fully resolved Rich style. |
| `ancestors_with_self` | `list[DOMNode]` | Ancestors from self to App (inclusive). |
| `ancestors` | `list[DOMNode]` | Ancestors from parent to App. |
| `auto_refresh` | `float \| None` | Seconds between auto-refreshes, or `None`. Settable. |
| `workers` | `WorkerManager` | Shortcut for `self.app.workers`. |
| `is_modal` | `bool` | Whether the node is modal. |
| `is_on_screen` | `bool` | Whether the node was in the last screen update. |
| `background_colors` | `tuple[Color, Color]` | `(base_background, background)` adjusted for opacity. |
| `colors` | `tuple[Color, Color, Color, Color]` | `(parent_bg, parent_color, bg, color)`. |

### Reactive Management

#### `set_reactive(reactive, value)`

Set a reactive value without invoking validators or watchers.

```python
self.set_reactive(App.theme, "textual-light")
```

Raises `AttributeError` if the argument is not a reactive. Raises `TypeError` if a non-reactive is passed.

#### `mutate_reactive(reactive)`

Force an update to a mutable reactive (list, dict, etc.). Triggers watchers even if the value hasn't changed.

```python
self.reactive_name_list.append("Jessica")
self.mutate_reactive(MyClass.reactive_name_list)
```

#### `data_bind(*reactives, **bind_vars)`

Bind reactive data so changes on one widget automatically update another. Returns `Self` (chainable).

```python
yield WorldClock("Europe/London").data_bind(WorldClockApp.time)
```

Raises `ReactiveError` if the data binding fails.

#### `watch(obj, attribute_name, callback, init=True)`

Watch for changes to a reactive attribute on another object.

```python
self.watch(self.app, "theme", self.on_theme_change, init=False)
```

### CSS Class Management

#### `has_class(*class_names)`

Returns `True` if the node has all given class names.

#### `add_class(*class_names, update=True)`

Add CSS class names. Returns `Self`.

#### `remove_class(*class_names, update=True)`

Remove CSS class names. Returns `Self`.

#### `toggle_class(*class_names)`

Toggle CSS class names (add if absent, remove if present). Returns `Self`.

#### `set_class(add, *class_names, update=True)`

Add or remove classes based on a boolean condition. Returns `Self`.

```python
self.set_class(is_active, "-active")
```

#### `set_classes(classes)`

Replace all classes. Accepts a space-separated string or iterable. Returns `Self`.

### Querying the DOM

#### `query(selector=None)`

Query descendants matching a CSS selector or widget type. Returns `DOMQuery`.

```python
self.query(".highlight")
self.query(Button)
```

#### `query_children(selector=None)`

Query only immediate children (one level deep). Returns `DOMQuery`.

#### `query_one(selector, expect_type=None)`

Get exactly one matching descendant (first match). Raises `NoMatches` if none found, `WrongType` if type mismatch.

#### `query_one_optional(selector, expect_type=None)`

Like `query_one` but returns `None` instead of raising `NoMatches`. Still raises `WrongType`.

#### `query_exactly_one(selector, expect_type=None)`

Like `query_one` but also raises `TooManyMatches` if more than one match exists.

#### `query_ancestor(selector, expect_type=None)`

Find an ancestor matching a CSS selector. Raises `NoMatches` if none found, `InvalidQueryFormat` on bad selector.

### Child Management

#### `sort_children(key=None, reverse=False)`

Sort child widgets. Without a key, sorts by construction order.

```python
screen.sort_children(key=lambda w: w.name or "")
```

#### `compose_add_child(widget)`

Add a widget during composition. Override to redirect children to a different container.

### Worker Management

#### `run_worker(work, name="", group="default", description="", exit_on_error=True, start=True, exclusive=False, thread=False)`

Run work in a background worker (async task or thread).

| Parameter | Description |
|---|---|
| `work` | Function, async function, or awaitable. |
| `name` | Short identifier for the worker. |
| `group` | Group identifier. |
| `description` | Longer description. |
| `exit_on_error` | Exit app on worker error. |
| `start` | Start immediately. |
| `exclusive` | Cancel other workers in the same group. |
| `thread` | Run as a thread worker. |

Returns the new `Worker` instance.

### Focus Trapping

#### `trap_focus(trap_focus=True)`

Limit tab-to-focus to children of this container. Useful for modal-like widgets.

### Styling

#### `set_styles(css=None, **update_styles)`

Set inline styles from a CSS string or keyword arguments. Returns `Self`.

#### `get_component_styles(*names)`

Get `RenderStyles` for component classes defined in `COMPONENT_CLASSES`. Raises `KeyError` if not found.

#### `notify_style_update()`

Called after styles are updated. Override to clear cached data on CSS reload.

#### `reset_styles()`

Reset all styles to their initial state.

#### `update_node_styles(animate=True)`

Request an update of this node's styles (called by Textual on class/pseudo-class changes).

#### `get_pseudo_classes()`

Return the set of currently active pseudo-class names.

#### `has_pseudo_class(class_name)`

Check if a single pseudo class is active.

#### `has_pseudo_classes(class_names)`

Check if all given pseudo classes are active.

### Actions

#### `check_action(action, parameters)`

Override to implement dynamic actions. Return `True` (enabled+visible), `False` (disabled+hidden), or `None` (disabled+visible/grayed).

#### `action_toggle(attribute_name)`

Toggle a boolean attribute on the node.

#### `refresh_bindings()`

Request a refresh of key binding displays (e.g., Footer).

### Refresh

#### `refresh(repaint=True, layout=False, recompose=False)`

Schedule a refresh. Base `DOMNode` implementation is a no-op (overridden in `Widget`). Returns `Self`.

### Automatic Refresh

#### `automatic_refresh()`

Called on auto-refresh interval. Override for custom refresh behavior. Only refreshes when the node is on screen.
