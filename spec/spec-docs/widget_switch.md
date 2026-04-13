# Switch Widget

## Purpose

The `Switch` widget represents a boolean on/off toggle. It displays a sliding indicator that animates between two positions. It is focusable but not a container.

Source: `textual.widgets.Switch` (`src/textual/widgets/_switch.py`)

## Constructor

```python
Switch(
    value: bool = False,
    *,
    animate: bool = True,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
    tooltip: RenderableType | None = None,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `bool` | `False` | Initial boolean value of the switch. |
| `animate` | `bool` | `True` | Whether the slider animates when toggled. |
| `name` | `str \| None` | `None` | Widget name. |
| `id` | `str \| None` | `None` | Widget DOM ID. |
| `classes` | `str \| None` | `None` | CSS classes. |
| `disabled` | `bool` | `False` | Whether the switch is disabled. |
| `tooltip` | `RenderableType \| None` | `None` | Optional tooltip renderable. |

## Reactive Attributes

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `bool` | `False` | The boolean state of the switch. Setting this posts a `Switch.Changed` message. |

The internal `_slider_position` reactive (float, 0.0 to 1.0) tracks the visual position of the slider and drives the `-on` CSS class.

## Methods

### `toggle() -> Self`

Toggles the switch value (inverts `self.value`). Posts a `Switch.Changed` message as a side effect of the value change. Returns the `Switch` instance for chaining.

## Messages

### `Switch.Changed`

Posted whenever `value` changes (via `toggle()`, direct assignment, or clicking).

| Attribute | Type | Description |
|-----------|------|-------------|
| `value` | `bool` | The new value of the switch. |
| `switch` | `Switch` | The switch widget instance that changed. |

The `control` property is an alias for `switch`.

Handler name: `on_switch_changed`.

## Bindings

| Key(s) | Action | Description | Show |
|--------|--------|-------------|------|
| `enter`, `space` | `toggle_switch` | Toggle the switch state. | `False` |

Clicking the switch also toggles it (via `_on_click`).

## Component Classes

| Class | Description |
|-------|-------------|
| `switch--slider` | Targets the slider element of the switch. Controls slider color and background. |

## CSS Classes (automatic)

| Class | Condition |
|-------|-----------|
| `-on` | Applied when the slider position reaches 1.0 (switch is on). Removed when 0.0 (off). |

## Default CSS

The switch uses `border: tall`, `background: $surface`, `height: auto`, `width: auto`, and `padding: 0 2`.

Key visual states in the default stylesheet:

- **Off**: Slider color is `$panel`, slider background is `$panel-darken-2`.
- **On** (`.-on`): Slider color is `$success`.
- **Hover**: Slider lightens (`$panel-lighten-1` when off, `$success-lighten-1` when on).
- **Focus**: Border changes to `$border`, background tint adds `$foreground 5%`.
- **Light theme**: Off slider uses `$primary 15%`; hover uses `$primary 25%`.

Content dimensions: 4 cells wide, 1 cell tall.

## Rendering

The switch renders using `ScrollBarRender` with a virtual size of 100 and window size of 50. The slider position (0.0-1.0) is mapped to a scroll position (0-50), producing the sliding visual.

## Usage Notes

- To remove spacing around a Switch, set `border: none;` and `padding: 0;`.
- The `animate` parameter only affects the constructor. When `animate=False`, value changes snap the slider position immediately instead of animating over 0.3 seconds.
- `ALLOW_SELECT` is `False`, so the switch does not participate in text selection.
- Customizing the slider appearance is done by targeting the `switch--slider` component class:

```css
#my-switch > .switch--slider {
    color: dodgerblue;
    background: darkslateblue;
}
```
