# Pretty Widget Spec

## Purpose

The `Pretty` widget displays a pretty-printed representation of any Python object. It delegates rendering to Rich's `Pretty` renderable, producing syntax-highlighted, formatted output for data structures such as dicts, lists, sets, and custom objects.

- Focusable: No
- Container: No

## Inheritance

`Pretty` extends `Widget`.

## Constructor

```python
Pretty(
    object: Any,
    *,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
)
```

| Parameter | Type          | Default | Description                          |
|-----------|---------------|---------|--------------------------------------|
| `object`  | `Any`         | —       | The Python object to pretty-print.   |
| `name`    | `str \| None` | `None`  | Widget name.                         |
| `id`      | `str \| None` | `None`  | Widget DOM ID.                       |
| `classes` | `str \| None` | `None`  | CSS classes.                         |

**Note:** The `disabled` parameter is not accepted by this widget's constructor.

## Reactive Attributes

This widget has no reactive attributes.

## Instance Attributes

| Name                  | Type             | Description                                                        |
|-----------------------|------------------|--------------------------------------------------------------------|
| `_pretty_renderable`  | `PrettyRenderable` | The Rich `Pretty` renderable wrapping the current object. Private. |

The widget sets `self.shrink = False` during initialization.

## Methods

### `update(object: object) -> None`

Replace the displayed object with a new one. This:

1. Creates a new `Rich.Pretty` renderable from the given object.
2. Clears cached dimensions (since the new object may have a different size).
3. Triggers a layout refresh.

### `render() -> RenderResult`

Returns the internal `PrettyRenderable` for Rich to render.

## Messages

This widget posts no messages.

## Bindings

This widget defines no bindings.

## Component Classes

This widget defines no component classes.

## Default CSS

```css
Pretty {
    height: auto;
}
```

The widget sizes itself to fit its content vertically.

## Usage Patterns

### Basic usage

```python
from textual.app import App, ComposeResult
from textual.widgets import Pretty

DATA = {"name": "Alice", "scores": [95, 87, 92]}

class MyApp(App):
    def compose(self) -> ComposeResult:
        yield Pretty(DATA)
```

### Updating the displayed object

Use `update()` to replace the content dynamically:

```python
pretty = self.query_one(Pretty)
pretty.update({"status": "refreshed", "timestamp": 1234567890})
```

### Displaying arbitrary Python objects

`Pretty` accepts any Python object. Rich's `Pretty` renderable handles formatting for built-in types (dicts, lists, sets, tuples, etc.) and falls back to `repr()` for custom objects.
