# SelectionList

## Overview

`SelectionList` is a vertical list widget that allows the user to select (check/uncheck) multiple items. Each item in the list consists of a prompt (display text), an associated value, and a selected/unselected state represented by a toggle button. The widget extends `OptionList` and layers selection semantics on top of it.

- Focusable: Yes
- Container: No
- Added in version 0.27.0

## Typing

`SelectionList` is a `Generic[SelectionType]`, parameterized by the type of the selection values. For example, `SelectionList[int]` indicates that all selection values are integers. Typing is optional.

## Selection

`Selection[SelectionType]` is a subclass of `Option` that represents a single item in the list.

### Constructor

```python
Selection(prompt: ContentText, value: SelectionType, initial_state: bool = False, id: str | None = None, disabled: bool = False)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `prompt` | `ContentText` | required | The display text for the selection. Can be a string or Rich `Text`. |
| `value` | `SelectionType` | required | The value associated with this selection. Must be unique within the list. |
| `initial_state` | `bool` | `False` | Whether the selection starts in the selected state. |
| `id` | `str \| None` | `None` | Optional ID for the selection. |
| `disabled` | `bool` | `False` | Whether the selection is disabled. |

### Properties

| Property | Type | Description |
|---|---|---|
| `value` | `SelectionType` | The value associated with the selection. |
| `initial_state` | `bool` | The initial selected state. |

## SelectionList Constructor

```python
SelectionList(
    *selections: Selection[SelectionType] | tuple[ContentText, SelectionType] | tuple[ContentText, SelectionType, bool],
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
    compact: bool = False,
)
```

Selections can be provided as:
- `Selection` objects directly.
- 2-tuples of `(prompt, value)` -- defaults to unselected.
- 3-tuples of `(prompt, value, initial_state)`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `*selections` | see above | required | The items to populate the list with. |
| `name` | `str \| None` | `None` | Widget name. |
| `id` | `str \| None` | `None` | Widget DOM ID. |
| `classes` | `str \| None` | `None` | CSS classes. |
| `disabled` | `bool` | `False` | Whether the widget is disabled. |
| `compact` | `bool` | `False` | Enable a compact display style (no blank lines between items). |

## Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `highlighted` | `int \| None` | `None` | The index of the highlighted selection. `None` means nothing is highlighted. |

## Properties

| Property | Type | Description |
|---|---|---|
| `selected` | `list[SelectionType]` | List of values for all currently selected items. |

## Methods

### Selection State

| Method | Signature | Description |
|---|---|---|
| `select` | `(selection: Selection \| SelectionType) -> Self` | Mark the given selection as selected. Accepts a `Selection` object or a raw value. |
| `deselect` | `(selection: Selection \| SelectionType) -> Self` | Mark the given selection as not selected. |
| `toggle` | `(selection: Selection \| SelectionType) -> Self` | Toggle the selected state of the given selection. |
| `select_all` | `() -> Self` | Select all items. Sends a single `SelectedChanged` message. |
| `deselect_all` | `() -> Self` | Deselect all items. Sends a single `SelectedChanged` message. |
| `toggle_all` | `() -> Self` | Toggle the state of all items. Sends a single `SelectedChanged` message. |

### Option Management (inherited from OptionList)

| Method | Signature | Description |
|---|---|---|
| `add_option` | `(item) -> Self` | Add a new selection option to the end of the list. Accepts `Selection`, tuples, or `None`. |
| `add_options` | `(items: Iterable) -> Self` | Add multiple new selection options. Only `Selection` objects and prompt/value tuples are accepted; passing a bare `Option` or separator raises `SelectionError`. |
| `clear_options` | `() -> Self` | Remove all selections from the list. Clears the selected set and the value-to-index mapping. |
| `get_option_at_index` | `(index: int) -> Selection` | Get the selection at the given index. Raises `OptionDoesNotExist` if invalid. |
| `get_option` | `(option_id: str) -> Selection` | Get the selection with the given ID. Raises `OptionDoesNotExist` if not found. |

## Messages

### SelectionHighlighted

Sent when a selection is highlighted (cursor moves to a new item). Inherits from `SelectionMessage`.

Handler: `on_selection_list_selection_highlighted`

| Attribute | Type | Description |
|---|---|---|
| `selection_list` | `SelectionList` | The selection list that sent the message. |
| `selection` | `Selection` | The highlighted selection. |
| `selection_index` | `int` | The index of the highlighted selection. |
| `control` | `OptionList` | Alias for `selection_list` (used by the `on` decorator). |

### SelectionToggled

Sent when a selection is explicitly toggled via `toggle`, `toggle_all`, or user interaction (spacebar/click). NOT sent when `select` or `deselect` is called programmatically. When a bulk toggle occurs (e.g., `toggle_all`), one message is sent per toggled option.

Handler: `on_selection_list_selection_toggled`

Same attributes as `SelectionHighlighted`.

### SelectedChanged

Sent whenever the collection of selected values changes, regardless of whether the change was programmatic or via user interaction. When a bulk operation occurs (e.g., `select_all`, `deselect_all`), only a single `SelectedChanged` message is sent.

Handler: `on_selection_list_selected_changed`

| Attribute | Type | Description |
|---|---|---|
| `selection_list` | `SelectionList` | The selection list that sent the message. |
| `control` | `SelectionList` | Alias for `selection_list`. |

This is a `@dataclass` message, unlike `SelectionHighlighted` and `SelectionToggled`.

### Message Timing

Messages are not sent until after the widget is mounted. During `__init__`, initial selection states are applied silently.

## Bindings

| Key | Action | Description |
|---|---|---|
| `space` | `select` | Toggle the state of the highlighted selection. |

Inherited from `OptionList`:

| Key | Action | Description |
|---|---|---|
| `up` | `cursor_up` | Move highlight up. |
| `down` | `cursor_down` | Move highlight down. |
| `enter` | `select` | Select the highlighted option (which triggers toggle in SelectionList). |

## Component Classes

| Class | Description |
|---|---|
| `selection-list--button` | Default (unselected, unhighlighted) toggle button style. |
| `selection-list--button-selected` | Toggle button style when the item is selected. |
| `selection-list--button-highlighted` | Toggle button style when the item is highlighted. |
| `selection-list--button-selected-highlighted` | Toggle button style when the item is both selected and highlighted. |

Inherited from `OptionList`:

| Class | Description |
|---|---|
| `option-list--option-disabled` | Disabled option style. |
| `option-list--option-hover` | Option hovered with mouse. |
| `option-list--option-hover-highlighted` | Option both hovered and highlighted. |
| `option-list--option-highlighted` | Currently highlighted option. |

## Default CSS

```css
SelectionList {
    height: auto;
    text-wrap: nowrap;
    text-overflow: ellipsis;
}
```

The toggle button colors default to:
- Unselected: `$panel-darken-2` on `$panel`
- Selected: `$text-success` on `$panel`

## Errors

| Error | Description |
|---|---|
| `SelectionError` (subclass of `TypeError`) | Raised when a selection is badly formed (e.g., tuple with wrong number of elements, or unsupported type passed to `add_options`). |
| `OptionDoesNotExist` | Raised by `get_option_at_index` or `get_option` when the target does not exist. |

## Usage Patterns

### Building with tuples

```python
SelectionList[int](
    ("Falken's Maze", 0, True),   # pre-selected
    ("Black Jack", 1),             # not selected
    ("Chess", 6, True),            # pre-selected
)
```

### Building with Selection objects

```python
from textual.widgets.selection_list import Selection

SelectionList[str](
    Selection("Falken's Maze", "maze", True),
    Selection("Black Jack", "blackjack"),
)
```

### Reacting to selection changes

```python
@on(SelectionList.SelectedChanged)
def update_view(self) -> None:
    selected_values = self.query_one(SelectionList).selected
```

### Programmatic manipulation

```python
selection_list.select("some_value")      # select by value
selection_list.deselect("some_value")    # deselect by value
selection_list.toggle("some_value")      # toggle by value
selection_list.select_all()              # select everything
selection_list.deselect_all()            # clear all selections
```

All mutation methods return `Self` for chaining.
