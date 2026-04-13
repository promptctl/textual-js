# RadioSet

## Overview

`RadioSet` is a container widget that groups `RadioButton` widgets into a mutually-exclusive set. When one radio button is turned on, the previously-on button is automatically turned off. The widget itself is focusable, but its children are not -- keyboard navigation between buttons is handled entirely by the `RadioSet`.

- **Focusable**: No (individual buttons); Yes (the set itself)
- **Container**: Yes
- **Base class**: `VerticalScroll` (with `can_focus=True`, `can_focus_children=False`)
- **Added in**: v0.13.0

## Construction

`RadioSet` accepts either `RadioButton` instances or plain strings as positional arguments. When a `str` is provided, a `RadioButton` is automatically created from it.

```python
# From strings
RadioSet("Option A", "Option B", "Option C")

# From RadioButton instances
with RadioSet():
    yield RadioButton("Option A")
    yield RadioButton("Option B", value=True)
    yield RadioButton("Option C")
```

### Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `*buttons` | `str \| RadioButton` | -- | Labels or radio buttons to group. |
| `name` | `str \| None` | `None` | The name of the widget. |
| `id` | `str \| None` | `None` | The DOM id of the widget. |
| `classes` | `str \| None` | `None` | CSS classes for the widget. |
| `disabled` | `bool` | `False` | Whether the widget is disabled. |
| `tooltip` | `RenderableType \| None` | `None` | Optional tooltip. |
| `compact` | `bool` | `False` | Enable compact display (removes border and padding). |

## Properties

| Property | Type | Description |
|---|---|---|
| `pressed_button` | `RadioButton \| None` | The currently-pressed radio button, or `None` if none are pressed. |
| `pressed_index` | `int` | The index of the currently-pressed radio button, or `-1` if none are pressed. |

## Reactive Attributes

| Attribute | Type | Default | Description |
|---|---|---|---|
| `compact` | `bool` | `False` | When `True`, toggles the `-textual-compact` CSS class, which removes the border and padding. |

## Messages

### RadioSet.Changed

Posted when the pressed button in the set changes. Handle with `on_radio_set_changed`.

| Attribute | Type | Description |
|---|---|---|
| `radio_set` | `RadioSet` | Reference to the `RadioSet` that changed. |
| `pressed` | `RadioButton` | The `RadioButton` that was pressed. |
| `index` | `int` | The index of the pressed button within the set. |
| `control` | `RadioSet` | Alias for `radio_set` (used by the `on` decorator). |

**Selector matching**: The `pressed` attribute is available for use with the `on` decorator's CSS selector matching (`ALLOW_SELECTOR_MATCH`).

**Bubbling behavior**: `RadioButton.Changed` messages from child buttons are intercepted and stopped. They do not bubble out of the `RadioSet`. Only `RadioSet.Changed` is emitted to parent widgets.

## Bindings

| Key(s) | Action | Description |
|---|---|---|
| `enter`, `space` | `toggle_button` | Toggle the currently-selected button. |
| `up`, `left` | `previous_button` | Select the previous radio button (wraps around). |
| `down`, `right` | `next_button` | Select the next radio button (wraps around). |

All bindings have `show=False`.

## Actions

| Action | Description |
|---|---|
| `action_next_button` | Navigate to the next enabled button, wrapping from end to start. |
| `action_previous_button` | Navigate to the previous enabled button, wrapping from start to end. |
| `action_toggle_button` | Toggle the state of the currently-selected button. |

## CSS Styling

### Default Styles

- `border: tall $border-blurred` (changes to `tall $border` on focus)
- `background: $surface` (gains `background-tint: $foreground 5%` on focus)
- `padding: 0 1`
- `height: auto`
- `width: 1fr`
- `pointer: pointer`

### Compact Mode

When `compact=True`, the `-textual-compact` class is applied, which sets `border: none` and `padding: 0`.

### Child RadioButton Styling

Child `RadioButton` widgets are restyled within the set: `background: transparent`, `border: none`, `padding: 0`, `width: 1fr`.

### Selection Highlighting

- **Focused**: The `-selected` radio button's label receives `$block-cursor-background`, `$block-cursor-foreground`, and `$block-cursor-text-style`.
- **Blurred**: The `-selected` radio button's label receives `$block-cursor-blurred-background`.

### Toggle Button Colors

- Default toggle button: `color: $panel-darken-2`, `background: $panel`.
- Active (on) toggle button: `color: $text-success`.

## Component Classes

This widget has no component classes.

## Mount Behavior

On mount, the `RadioSet`:

1. Selects the first available (enabled) button via `action_next_button`.
2. Disables focus on all child `RadioButton` widgets (focus is managed by the set).
3. If multiple buttons were passed with `value=True`, only the first one is kept on; the rest are turned off silently (without emitting `Changed` messages).
4. Tracks the initially-pressed button.

## Click Handling

Clicking anywhere within the `RadioSet` (including on a child `RadioButton`) focuses the `RadioSet` itself.

## Mutual Exclusion Invariant

The `RadioSet` enforces that at most one `RadioButton` is on at any time. When a button is toggled on, the previously-on button is turned off. Attempting to toggle a button off by clicking it again is prevented -- the button stays on.
