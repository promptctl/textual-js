# Checkbox Widget

## Overview

`Checkbox` is a toggle widget that stores and displays a boolean value. It renders as a labeled button with a visual indicator that reflects the current on/off state. Added in version 0.13.0.

- Focusable: Yes
- Container: No

`Checkbox` inherits from `ToggleButton`, which inherits from `Static`. The `ToggleButton` base class is considered internal; `Checkbox` is the public API.

## Constructor

```python
Checkbox(
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

| Parameter | Type | Default | Description |
|---|---|---|---|
| `label` | `ContentText` | `""` | The text label displayed alongside the toggle indicator. Supports Rich markup and Content markup. |
| `value` | `bool` | `False` | Initial checked state. |
| `button_first` | `bool` | `True` | If `True`, the toggle indicator appears before the label; if `False`, after. |
| `name` | `str \| None` | `None` | Widget name for form-like usage. |
| `id` | `str \| None` | `None` | DOM identifier. |
| `classes` | `str \| None` | `None` | CSS class names. |
| `disabled` | `bool` | `False` | Whether the checkbox is disabled. |
| `tooltip` | `RenderableType \| None` | `None` | Tooltip displayed on hover. |
| `compact` | `bool` | `False` | When `True`, removes border and padding for a minimal display. |

Setting `value` in the constructor does **not** emit a `Changed` message (it is set inside `prevent(self.Changed)`).

## Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `value` | `bool` | `False` | The checked state. Setting this toggles the `-on` CSS class and posts a `Changed` message. |
| `compact` | `bool` | `False` | Controls compact display mode. Toggles the `-textual-compact` CSS class. |

## Properties

| Name | Type | Settable | Description |
|---|---|---|---|
| `label` | `Content` | Yes | The label displayed next to the toggle indicator. Assigning triggers a layout refresh. |

## Methods

### `toggle() -> Self`

Inverts the `value` attribute (`True` becomes `False` and vice versa). Returns the `Checkbox` instance for chaining.

## Messages

### `Checkbox.Changed`

Posted when the `value` reactive changes. Handle with `on_checkbox_changed` or `@on(Checkbox.Changed)`.

| Attribute/Property | Type | Description |
|---|---|---|
| `value` | `bool` | The new value after the change. |
| `checkbox` | `Checkbox` | The checkbox instance that changed. |
| `control` | `Checkbox` | Alias for `checkbox`. |

The message inherits from `ToggleButton.Changed`, which stores the originating widget as `_toggle_button`.

## Key Bindings

Inherited from `ToggleButton`:

| Key(s) | Action | Description |
|---|---|---|
| `enter`, `space` | `toggle_button` | Toggle the value. |

Clicking the checkbox also toggles the value.

## Component Classes

Inherited from `ToggleButton`:

| Class | Description |
|---|---|
| `toggle--button` | Targets the toggle indicator (the visual checkbox character). |
| `toggle--label` | Targets the text label. |

## CSS Classes (automatic)

| Class | Condition |
|---|---|
| `-on` | Applied when `value` is `True`; removed when `False`. |
| `-textual-compact` | Applied when `compact` is `True`. |

## Default Styling

The checkbox has `width: auto`, a tall border (blurred when unfocused, solid when focused), padding of `0 1`, and `$surface` background. The toggle indicator uses `$panel` background; when `-on`, the indicator text color becomes `$text-success`. On focus, the label receives block-cursor styling. In compact mode, border and padding are removed.

The toggle indicator is rendered as three characters: `BUTTON_LEFT` (`▐`), `BUTTON_INNER` (`X`), `BUTTON_RIGHT` (`▌`). The left and right characters use the button's background color as their foreground, creating a seamless block appearance against the widget background.

## Usage Patterns

### Basic usage

```python
yield Checkbox("Accept terms")
yield Checkbox("Subscribe", True)  # initially checked
```

### Handling changes

```python
def on_checkbox_changed(self, event: Checkbox.Changed) -> None:
    self.notify(f"{event.checkbox.label}: {event.value}")
```

### Programmatic control

```python
checkbox = self.query_one("#my-checkbox", Checkbox)
checkbox.value = True       # check it (posts Changed)
checkbox.toggle()           # flip it (posts Changed)
```
