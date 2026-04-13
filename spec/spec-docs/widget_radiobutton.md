# RadioButton Widget

## Overview

`RadioButton` is a toggle widget that stores a boolean value, displayed as a radio button (circular indicator). It extends `ToggleButton` (which extends `Static`). A `RadioButton` is best used within a `RadioSet`, which enforces mutual exclusion so that only one button in the set is active at a time.

- Focusable: yes
- Container: no
- Added in version 0.13.0

## Import

```python
from textual.widgets import RadioButton
```

## Constructor

```python
RadioButton(
    label: ContentText = "",
    value: bool = False,
    button_first: bool = True,
    *,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
    tooltip: RenderableType | None = None,
    compact: bool = False,
)
```

| Parameter      | Type             | Default | Description                                        |
| -------------- | ---------------- | ------- | -------------------------------------------------- |
| `label`        | `ContentText`    | `""`    | The text label displayed next to the button.       |
| `value`        | `bool`           | `False` | Initial on/off state.                              |
| `button_first` | `bool`           | `True`  | Whether the button indicator appears before the label. |
| `name`         | `str \| None`    | `None`  | Widget name for form-like usage.                   |
| `id`           | `str \| None`    | `None`  | DOM identifier.                                    |
| `classes`      | `str \| None`    | `None`  | CSS classes.                                       |
| `disabled`     | `bool`           | `False` | Whether the widget starts disabled.                |
| `tooltip`      | `RenderableType \| None` | `None` | Optional tooltip.                          |
| `compact`      | `bool`           | `False` | Compact display mode (no border, no padding).      |

## Reactive Attributes

| Name      | Type   | Default | Description                                      |
| --------- | ------ | ------- | ------------------------------------------------ |
| `value`   | `bool` | `False` | The boolean state of the radio button.           |
| `compact` | `bool` | `False` | When `True`, renders without border and padding. |

Setting `value` triggers the `Changed` message and toggles the `-on` CSS class.

## Properties

| Name    | Type      | Description                                |
| ------- | --------- | ------------------------------------------ |
| `label` | `Content` | The label content. Readable and writable.  |

## Methods

| Method     | Returns | Description                          |
| ---------- | ------- | ------------------------------------ |
| `toggle()` | `Self`  | Toggles the value and returns self.  |

## Messages

### `RadioButton.Changed`

Posted when `value` changes. Handler method name: `on_radio_button_changed`.

| Attribute      | Type          | Description                                   |
| -------------- | ------------- | --------------------------------------------- |
| `value`        | `bool`        | The new value after the change.               |
| `radio_button` | `RadioButton` | The radio button that changed.                |
| `control`      | `RadioButton` | Alias for `radio_button` (standard control property). |

`Changed` inherits from `ToggleButton.Changed`.

## Bindings

| Key(s)         | Action          | Description       |
| -------------- | --------------- | ----------------- |
| `enter`, `space` | `toggle_button` | Toggle the value. |

## Component Classes

Inherited from `ToggleButton`:

| Class            | Description                                 |
| ---------------- | ------------------------------------------- |
| `toggle--button` | Targets the toggle button indicator itself. |
| `toggle--label`  | Targets the text label of the toggle button.|

## CSS Classes

| Class | Applied When               |
| ----- | -------------------------- |
| `-on` | `value` is `True`.         |
| `-textual-compact` | `compact` is `True`. |

## Visual Representation

The button indicator is composed of three characters:

- `BUTTON_LEFT` = `"▐"` (left side)
- `BUTTON_INNER` = `"●"` (filled circle when on; overrides `ToggleButton`'s `"X"`)
- `BUTTON_RIGHT` = `"▌"` (right side)

The inner character color is controlled by the `toggle--button` component class. When `-on` is applied, the inner character uses the `$text-success` color.

## Usage Patterns

### Basic usage within a RadioSet

```python
from textual.app import App, ComposeResult
from textual.widgets import RadioButton, RadioSet

class MyApp(App):
    def compose(self) -> ComposeResult:
        with RadioSet():
            yield RadioButton("Option A")
            yield RadioButton("Option B")
            yield RadioButton("Option C", value=True)
```

### Handling changes

```python
def on_radio_button_changed(self, event: RadioButton.Changed) -> None:
    if event.value:
        self.notify(f"Selected: {event.radio_button.label}")
```

### Rich text labels

Labels accept `ContentText`, which includes Rich `Text` objects:

```python
from rich.text import Text
RadioButton(Text.from_markup("[bold]Styled[/bold] option"))
```

## Relationship to RadioSet

When used inside a `RadioSet`, only one `RadioButton` can be on at a time. The `RadioSet` listens for `Changed` messages and turns off sibling buttons. Outside a `RadioSet`, multiple `RadioButton` widgets operate independently (though this is not the intended usage pattern -- use `Checkbox` for independent boolean toggles).

## Inheritance Chain

`RadioButton` -> `ToggleButton` -> `Static` -> `Widget`
