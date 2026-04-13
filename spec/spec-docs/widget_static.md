# Static

The `Static` widget displays simple static content such as text, Rich renderables, or `Content` objects. It serves both as a standalone display widget and as a base class for more complex widgets.

## Overview

- **Not focusable** -- Static does not accept focus.
- **Not a container** -- Static does not hold child widgets.
- **Inherits from `Widget`** with `inherit_bindings=False`.

Static accepts a content argument that can be a plain string (with optional console markup), a `Content` object, or any Rich renderable. The content is converted internally to a `Visual` for rendering.

## Constructor

```python
Static(
    content: VisualType = "",
    *,
    expand: bool = False,
    shrink: bool = False,
    markup: bool = True,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `content` | `VisualType` | `""` | A `Content` object, Rich renderable, or string containing console markup. |
| `expand` | `bool` | `False` | Expand content if required to fill container. |
| `shrink` | `bool` | `False` | Shrink content if required to fill container. |
| `markup` | `bool` | `True` | Whether console markup in strings should be parsed and rendered. |
| `name` | `str \| None` | `None` | Name of the widget. |
| `id` | `str \| None` | `None` | ID of the widget. |
| `classes` | `str \| None` | `None` | Space-separated list of class names. |
| `disabled` | `bool` | `False` | Whether the widget is disabled. |

## Default CSS

```css
Static {
    height: auto;
}
```

The widget sizes its height to fit its content by default.

## Properties

### `content`

The original content value set via the constructor or the `content` setter. Setting this property updates the display and triggers a layout refresh.

**Type:** `VisualType` (readable and writable)

### `visual`

The `Visual` object that is ultimately rendered. This may differ from the original content -- for example, a string is converted to a `Content` instance. Read-only; computed lazily from `content`.

**Type:** `Visual` (read-only)

## Methods

### `update`

```python
def update(self, content: VisualType = "", *, layout: bool = True) -> None
```

Replace the widget's displayed content.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `content` | `VisualType` | `""` | New content to display. |
| `layout` | `bool` | `True` | Perform a layout pass after updating. Set to `False` when the new content is guaranteed not to change the widget's size. |

## Reactive Attributes

None.

## Messages

None.

## Bindings

None. Bindings are not inherited from `Widget` (`inherit_bindings=False`).

## Component Classes

None.

## Usage Patterns

### Simple text label

```python
from textual.app import App, ComposeResult
from textual.widgets import Static

class MyApp(App):
    def compose(self) -> ComposeResult:
        yield Static("Hello, world!")
```

### Updating content dynamically

Call `update()` or set the `content` property to change what is displayed:

```python
widget = self.query_one(Static)
widget.update("New content")
```

### Rich renderables

Any Rich renderable can be passed as content:

```python
from rich.text import Text
Static(Text("styled", style="bold red"))
```

### Markup control

Disable console markup parsing when displaying raw text that may contain bracket characters:

```python
Static("[not markup]", markup=False)
```

## Related Widgets

- **Label** -- a higher-level text display widget built on Static.
- **Pretty** -- displays Python objects with Pretty printing.
