# OptionList

## Overview

`OptionList` is a focusable, non-container widget that displays a vertical list of selectable options. Each option's prompt can be a plain string, Textual markup, or any Rich renderable (tables, panels, etc.), allowing multi-line and richly formatted entries. Options can be separated by visual dividers, disabled individually, and looked up by ID or index.

- Focusable: Yes
- Container: No
- Inherits from: `ScrollView`

## Construction

```python
OptionList(
    *content: OptionListContent,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
    markup: bool = True,
    compact: bool = False,
)
```

- `*content` -- Positional arguments become the options. Each may be a string, Rich renderable, `Option` instance, or `None` (which adds a separator/divider after the preceding option).
- `markup` -- When `True` (default), string prompts are interpreted as Textual content markup. When `False`, they are treated as plain text.
- `compact` -- When `True`, renders without border and padding (toggles the `-textual-compact` CSS class).

If options are provided at construction, the highlight is automatically moved to the first enabled option.

## Type Alias

`OptionListContent: TypeAlias = "Option | VisualType | None"` -- The types accepted by the constructor and `add_options()`.

## Option Class

`Option` represents a single item in the list.

```python
Option(prompt: VisualType, id: str | None = None, disabled: bool = False)
```

| Property   | Type              | Description                                      |
|------------|-------------------|--------------------------------------------------|
| `prompt`   | `VisualType`      | The display content (read-only property).        |
| `id`       | `str \| None`     | Optional unique identifier (read-only property). |
| `disabled` | `bool`            | Whether the option is disabled (mutable).        |

Options are hashed by identity (`id(self)`), not by value.

## Separator

Passing `None` as a content item adds a horizontal rule divider after the preceding option. This is a visual separator only -- it does not create a selectable entry in the list.

## Reactive Attributes

| Name          | Type            | Default | Description                                                     |
|---------------|-----------------|---------|-----------------------------------------------------------------|
| `highlighted` | `int \| None`   | `None`  | Index of the highlighted option. `None` means nothing highlighted. |
| `compact`     | `bool`          | `False` | Enables compact display mode (no border, no padding).           |

The `highlighted` reactive is validated: values below 0 clamp to 0, values at or above `option_count` clamp to `option_count - 1`, and if there are no options the value becomes `None`.

When `highlighted` changes to a non-disabled option, the widget scrolls to make it visible and posts an `OptionHighlighted` message.

## Properties

| Property             | Type                | Description                                          |
|----------------------|---------------------|------------------------------------------------------|
| `options`            | `Sequence[Option]`  | Read-only sequence of all options in the list.       |
| `option_count`       | `int`               | The number of options.                               |
| `highlighted_option` | `Option \| None`    | The currently highlighted `Option`, or `None`.       |

## Messages

All messages inherit from `OptionList.OptionMessage`.

### OptionMessage (base)

| Attribute      | Type            | Description                                |
|----------------|-----------------|--------------------------------------------|
| `option_list`  | `OptionList`    | The option list that sent the message.     |
| `option`       | `Option`        | The option the message relates to.         |
| `option_id`    | `str \| None`   | The ID of the option (may be `None`).      |
| `option_index` | `int`           | The index of the option in the list.       |
| `control`      | `OptionList`    | Alias for `option_list` (used by `on()`).  |

### OptionHighlighted

Posted when the highlighted option changes to a non-disabled option. Handler name: `on_option_list_option_highlighted`.

### OptionSelected

Posted when the user selects an option (via `Enter` key or mouse click on a non-disabled option). Handler name: `on_option_list_option_selected`.

## Bindings

| Key        | Action          | Description                              |
|------------|-----------------|------------------------------------------|
| `down`     | `cursor_down`   | Move the highlight down.                 |
| `up`       | `cursor_up`     | Move the highlight up.                   |
| `enter`    | `select`        | Select the current option.               |
| `home`     | `first`         | Move the highlight to the first option.  |
| `end`      | `last`          | Move the highlight to the last option.   |
| `pagedown` | `page_down`     | Move the highlight down a page.          |
| `pageup`   | `page_up`       | Move the highlight up a page.            |

All bindings have `show=False`.

## Component Classes

| Class                            | Description                                               |
|----------------------------------|-----------------------------------------------------------|
| `option-list--option`            | Base style for options (not disabled, highlighted, or hovered). |
| `option-list--option-disabled`   | Applied to disabled options.                              |
| `option-list--option-highlighted`| Applied to the currently highlighted option.              |
| `option-list--option-hover`      | Applied to the option under the mouse cursor.             |
| `option-list--separator`         | Applied to separator/divider lines.                       |

Style priority when rendering a line: disabled takes precedence over highlighted, which takes precedence over hover.

## Methods

### Adding Options

| Method | Signature | Description |
|--------|-----------|-------------|
| `add_option` | `(option: Option \| VisualType \| None = None) -> Self` | Add a single option (or separator if `None`). |
| `add_options` | `(new_options: Iterable[OptionListContent]) -> Self` | Add multiple options at once. |
| `set_options` | `(options: Iterable[OptionListContent]) -> Self` | Clear all existing options and set new ones. |

### Removing Options

| Method | Signature | Description |
|--------|-----------|-------------|
| `remove_option` | `(option_id: str) -> Self` | Remove the option with the given ID. |
| `remove_option_at_index` | `(index: int) -> Self` | Remove the option at the given index. |
| `clear_options` | `() -> Self` | Remove all options and reset highlight to `None`. |

### Retrieving Options

| Method | Signature | Description |
|--------|-----------|-------------|
| `get_option` | `(option_id: str) -> Option` | Get option by ID. Raises `OptionDoesNotExist` if not found. |
| `get_option_at_index` | `(index: int) -> Option` | Get option by index. Raises `OptionDoesNotExist` if out of range. |
| `get_option_index` | `(option_id: str) -> int` | Get the index of the option with the given ID. Raises `OptionDoesNotExist`. |

### Enabling and Disabling Options

| Method | Signature | Description |
|--------|-----------|-------------|
| `enable_option` | `(option_id: str) -> Self` | Enable the option with the given ID. |
| `disable_option` | `(option_id: str) -> Self` | Disable the option with the given ID. |
| `enable_option_at_index` | `(index: int) -> Self` | Enable the option at the given index. |
| `disable_option_at_index` | `(index: int) -> Self` | Disable the option at the given index. |

When a currently highlighted option is disabled, the highlight automatically moves to the next enabled option.

### Replacing Option Prompts

| Method | Signature | Description |
|--------|-----------|-------------|
| `replace_option_prompt` | `(option_id: str, prompt: VisualType) -> Self` | Replace the prompt of the option with the given ID. |
| `replace_option_prompt_at_index` | `(index: int, prompt: VisualType) -> Self` | Replace the prompt at the given index. |

### Scrolling

| Method | Signature | Description |
|--------|-----------|-------------|
| `scroll_to_highlight` | `(top: bool = False) -> None` | Scroll the list so the highlighted option is visible. If `top=True`, scrolls so the highlighted option is at the top of the widget. |

## Actions

| Action         | Method               | Description                                    |
|----------------|----------------------|------------------------------------------------|
| `cursor_up`    | `action_cursor_up`   | Move highlight to the previous enabled option. |
| `cursor_down`  | `action_cursor_down` | Move highlight to the next enabled option.     |
| `first`        | `action_first`       | Move highlight to the first enabled option.    |
| `last`         | `action_last`        | Move highlight to the last enabled option.     |
| `page_up`      | `action_page_up`     | Move highlight up roughly one page.            |
| `page_down`    | `action_page_down`   | Move highlight down roughly one page.          |
| `select`       | `action_select`      | Select the highlighted option (posts `OptionSelected`). |

Navigation actions skip disabled options. Page navigation avoids selecting disabled options by searching in the movement direction.

## Exceptions

| Exception           | Description                                              |
|---------------------|----------------------------------------------------------|
| `OptionListError`   | Base exception for all OptionList errors.                |
| `DuplicateID`       | Raised when adding an option with an ID that already exists. |
| `OptionDoesNotExist`| Raised when requesting an option by ID or index that does not exist. |

## Mouse Interaction

- **Click** on a non-disabled option: sets `highlighted` to that option and triggers `action_select` (posting `OptionSelected`).
- **Mouse move** over the widget: tracks hover state, applying `option-list--option-hover` to the option under the cursor.
- **Mouse leave**: clears hover state.

## Default CSS

The widget ships with these default styles:

- `height: auto; max-height: 100%` -- sizes to content up to full container height.
- `overflow-x: hidden` -- no horizontal scrollbar.
- `border: tall $border-blurred` -- border style that changes to `tall $border` on focus.
- `padding: 0 1` -- horizontal padding for the list area.
- `background: $surface` with `background-tint: $foreground 5%` when focused.
- Highlighted option uses blurred cursor colors when unfocused and active cursor colors when focused.
- Disabled options use `$text-disabled` color.
- Separators use `$foreground 15%` color.
- Compact mode (`-textual-compact` class) removes border and padding.

## Usage Patterns

### Simple String Options

```python
option_list = OptionList("Option 1", "Option 2", "Option 3")
```

### Options with IDs and Separators

```python
option_list = OptionList(
    Option("First", id="first"),
    Option("Second", id="second"),
    None,  # separator
    Option("Third", id="third", disabled=True),
)
```

### Rich Renderable Options

Any Rich renderable can be used as a prompt, enabling multi-line and complex visual options (tables, panels, markdown, etc.).

### Handling Selection

```python
def on_option_list_option_selected(self, event: OptionList.OptionSelected) -> None:
    selected_option = event.option
    selected_index = event.option_index
    selected_id = event.option_id
```
