# Select Widget

The `Select` widget (`textual.widgets.Select`) is a compact dropdown control that allows the user to pick one option from a list. It is a generic class (`Select[SelectType]`) where `SelectType` is a `Hashable` type representing the option values.

- Focusable: Yes
- Container: No

**Source:** `src/textual/widgets/_select.py`

## Construction

### `Select.__init__`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `options` | `Iterable[tuple[RenderableType, SelectType]]` | required | Sequence of `(display, value)` tuples. Display can be a string or Rich renderable. |
| `prompt` | `str` | `"Select"` | Placeholder text shown when no option is selected. |
| `allow_blank` | `bool` | `True` | Whether the widget can have no selection (`Select.NULL`). |
| `value` | `SelectType \| NoSelection` | `Select.NULL` | Initial selected value. Must match one of the option values. |
| `type_to_search` | `bool` | `True` | Enable type-to-search when the overlay is expanded. |
| `name` | `str \| None` | `None` | Widget name. |
| `id` | `str \| None` | `None` | Widget DOM ID. |
| `classes` | `str \| None` | `None` | CSS classes. |
| `disabled` | `bool` | `False` | Whether the widget starts disabled. |
| `tooltip` | `RenderableType \| None` | `None` | Optional tooltip. |
| `compact` | `bool` | `False` | Compact mode (no borders). |

**Raises:**
- `EmptySelectError` -- if `options` is empty and `allow_blank` is `False`.

### `Select.from_values` (classmethod)

Convenience constructor that creates options from an iterable of values. Each option's display label is `str(value)`.

```python
Select.from_values(["alpha", "beta", "gamma"])
```

Accepts the same keyword arguments as `__init__` except `options` is replaced by `values: Iterable[SelectType]`.

## Typing

`Select` is a `Generic[SelectType]` where `SelectType` is bound to `Hashable`. Type annotation is optional:

```python
my_select: Select[int] = Select([(\"One\", 1), (\"Two\", 2)])
```

The type alias `SelectOption` is defined as `tuple[str, SelectType]`.

## Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `expanded` | `bool` | `False` | Whether the dropdown overlay is visible. Not initialized on construction (`init=False`). |
| `value` | `SelectType \| NoSelection` | `Select.NULL` | The currently selected value. Not initialized on construction (`init=False`). Setting to an illegal value raises `InvalidSelectValueError`. |
| `prompt` | `str` | `"Select"` | Placeholder text displayed when nothing is selected. |
| `compact` | `bool` | `False` | Compact mode toggle. Toggles the `-textual-compact` CSS class. |

### Value Validation

When `value` is set, the `_validate_value` method checks that the new value exists in the current set of legal values. If not, `InvalidSelectValueError` is raised. Setting `value` to `None` (instead of `Select.NULL`) produces a helpful error message suggesting `Select.clear()`.

## The NULL Sentinel

`Select.NULL` is a singleton instance of the `NoSelection` class. It represents the "no selection" state. Comparing `value == Select.NULL` or calling `is_blank()` tests for this state. `Select.NULL` is distinct from `None`.

## Messages

### `Select.Changed`

Posted when the selected value changes. Handler method name: `on_select_changed`.

| Attribute | Type | Description |
|---|---|---|
| `select` | `Select[SelectType]` | The Select widget that changed. |
| `value` | `SelectType \| NoSelection` | The new value (may be `Select.NULL`). |
| `control` | `Select[SelectType]` | Alias for `select` (property). |

## Bindings

| Key(s) | Action | Description |
|---|---|---|
| `enter`, `down`, `space`, `up` | `show_overlay` | Open the dropdown overlay. Not shown in footer. |

When the overlay is open, the `SelectOverlay` (an `OptionList` subclass) handles:

| Key | Action | Description |
|---|---|---|
| `escape` | `dismiss` | Close the overlay without changing selection. |

## Methods

### `set_options(options)`

Replace all options. Resets the selection to blank (if `allow_blank`) or the first option.

- **Parameters:** `options: Iterable[tuple[RenderableType, SelectType]]`
- **Raises:** `EmptySelectError` if options is empty and `allow_blank` is `False`.

### `is_blank() -> bool`

Returns `True` if the current value is `Select.NULL` (no selection).

### `clear()`

Sets the value to `Select.NULL`. Only valid when `allow_blank` is `True`.

- **Raises:** `InvalidSelectValueError` if `allow_blank` is `False`.

### `selection` (property)

Returns the currently selected value, or `None` if nothing is selected. Unlike `value`, this never returns `Select.NULL` -- it maps that to `None`.

## Blank State

When `allow_blank=True` (the default), the widget can exist with no selection. In this state:

- `value` equals `Select.NULL`
- `is_blank()` returns `True`
- `selection` returns `None`
- The prompt placeholder text is displayed (dimmed)
- The first item in the overlay is the blank/prompt option

When `allow_blank=False`:
- The widget auto-selects the first option if no explicit `value` is provided.
- Calling `clear()` raises `InvalidSelectValueError`.
- Setting `value = Select.NULL` raises `InvalidSelectValueError`.

## Type-to-Search

When `type_to_search=True` (default) and the overlay is expanded, typing printable characters performs a substring search across option labels. The cursor jumps to the best match (earliest substring position wins). The search query resets after 0.7 seconds of inactivity.

Disable with `type_to_search=False` in the constructor.

## Internal Composition

The `Select` widget composes two children:

1. **`SelectCurrent`** -- A `Horizontal` container displaying the current selection label and an arrow indicator (down-arrow when collapsed, up-arrow when expanded).
2. **`SelectOverlay`** -- An `OptionList` subclass that appears as a screen overlay when expanded. Max height is 12 lines.

Clicking `SelectCurrent` toggles the overlay. Selecting an option in the overlay updates the value and collapses the overlay.

## CSS Structure

The widget uses the `-expanded` class when the overlay is open.

### Default Styling

- The select has `height: auto`.
- `SelectCurrent` has a tall border (`$border-blurred`), switching to `$border` on focus.
- `SelectOverlay` uses `overlay: screen` and `constrain: none inside` to float above other content.
- Compact mode (`.compact` reactive or `-textual-compact` class) removes borders from `SelectCurrent`.
- The overlay has `max-height: 12`.

### Component Classes

This widget has no component classes.

## Exceptions

| Exception | Module | Description |
|---|---|---|
| `InvalidSelectValueError` | `textual.widgets.select` | Setting `value` to an unknown option or clearing when `allow_blank=False`. |
| `EmptySelectError` | `textual.widgets.select` | Constructing or calling `set_options` with no options when `allow_blank=False`. |

## Usage Patterns

### Basic construction with tuples

```python
options = [("First", 1), ("Second", 2), ("Third", 3)]
select = Select(options)
```

### Construction from plain values

```python
select = Select.from_values(["alpha", "beta", "gamma"])
```

### Handling selection changes

```python
from textual import on
from textual.widgets import Select

@on(Select.Changed)
def on_changed(self, event: Select.Changed) -> None:
    if event.value == Select.NULL:
        self.notify("Nothing selected")
    else:
        self.notify(f"Selected: {event.value}")
```

### Dynamically replacing options

```python
select = self.query_one(Select)
select.set_options([("New A", "a"), ("New B", "b")])
```

### Pre-selecting a value

```python
Select(options, value=2, allow_blank=False)
```
