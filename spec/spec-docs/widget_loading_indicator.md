# LoadingIndicator Widget

## Overview

`LoadingIndicator` displays an animated sequence of pulsating dots to communicate that data is being loaded or an operation is in progress. It renders five filled-circle characters (`●`) whose colors cycle through a gradient derived from the widget's `color` style and background.

- Focusable: no
- Container: no
- Added in version 0.15.0

## Import

```python
from textual.widgets import LoadingIndicator
```

## Constructor

```python
LoadingIndicator(
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

| Parameter  | Type            | Default | Description                          |
| ---------- | --------------- | ------- | ------------------------------------ |
| `name`     | `str \| None`   | `None`  | Widget name.                         |
| `id`       | `str \| None`   | `None`  | DOM identifier.                      |
| `classes`  | `str \| None`   | `None`  | CSS classes.                         |
| `disabled` | `bool`          | `False` | Whether the widget starts disabled.  |

## Reactive Attributes

This widget has no reactive attributes.

## Messages

This widget posts no messages.

## Bindings

This widget has no bindings.

## Component Classes

This widget has no component classes.

## Input Handling

`LoadingIndicator` stops and prevents all `InputEvent` instances from bubbling. This effectively disables any widgets beneath it while the loading indicator is visible, preventing user interaction during a loading state.

## Rendering Behavior

- On mount, the widget records a start time and sets `auto_refresh = 1/16` (approximately 60 fps).
- Each render computes elapsed time and produces five dot characters with colors derived from a `Gradient` that blends from the background toward the widget's `color` style value.
- The dots pulse in a wave pattern at a speed factor of `0.8`, creating the appearance of traveling animation.
- When `app.animation_level` is `"none"`, the widget renders the static text `"Loading..."` instead of animated dots.

## Default CSS

```css
LoadingIndicator {
    width: 100%;
    height: 100%;
    min-height: 1;
    content-align: center middle;
    color: $primary;
    text-style: not reverse;
}
```

When used as the internal loading overlay (class `-textual-loading-indicator`):

```css
LoadingIndicator.-textual-loading-indicator {
    layer: _loading;
    background: $boost;
    dock: top;
}
```

## Changing Indicator Color

Set the `color` CSS property to change the dot color:

```css
LoadingIndicator {
    color: red;
}
```

The gradient is computed from the widget's background blended toward this color value.

## Integration with Widget.loading

Any widget has a `loading` reactive attribute. Setting `widget.loading = True` overlays a `LoadingIndicator` on top of that widget (with the `-textual-loading-indicator` CSS class applied). Setting it back to `False` removes the overlay. The overlay widget can be customized by overriding the `get_loading_widget` method on any widget.

When used as an overlay:
- The indicator is placed on the `_loading` layer, docked to the top.
- It covers the target widget and blocks all input events from reaching it.

## Usage Patterns

### Standalone usage

```python
from textual.app import App, ComposeResult
from textual.widgets import LoadingIndicator

class LoadingApp(App):
    def compose(self) -> ComposeResult:
        yield LoadingIndicator()
```

### Using the loading reactive on a widget

```python
async def on_button_pressed(self) -> None:
    self.query_one(DataTable).loading = True
    data = await self.fetch_data()
    self.query_one(DataTable).loading = False
```

## Inheritance Chain

`LoadingIndicator` -> `Widget`
