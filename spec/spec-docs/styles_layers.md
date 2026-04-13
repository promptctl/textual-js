# Layer Style Properties

Textual provides two complementary CSS properties for controlling the visual stacking order of widgets: `layers` (which declares an ordered set of named layers on a container) and `layer` (which assigns a widget to one of those layers).

## Overview

By default, widgets are painted in the order they are yielded (composed): later widgets appear on top of earlier ones. The layer system overrides this default stacking by letting you define explicit named layers with a controlled paint order.

Layers are **scoped to a container**. A container widget declares the available layers via the `layers` property. Any descendant of that container can then assign itself to one of those layers via the `layer` property.

## `layers` Property

### Purpose

Declares an ordered set of named layers on a container widget. Descendant widgets can then be assigned to these layers to control their visual stacking order.

### Syntax

```
layers: <name>+;
```

Accepts one or more space-separated `<name>` tokens. Each name defines a layer.

### Paint Order

The **leftmost** name is the **lowest** (bottom) layer; the **rightmost** name is the **highest** (top) layer. Widgets on higher layers are painted on top of widgets on lower layers.

```css
layers: below above;
```

Here, `below` is the bottom layer and `above` is the top layer. A widget assigned to `above` will be drawn over a widget assigned to `below`, regardless of yield order.

### CSS

```css
Screen {
    layers: below above;
}
```

### Python

```python
widget.styles.layers = ("below", "above")
```

The Python API accepts a tuple of strings.

## `layer` Property

### Purpose

Assigns a widget to a specific named layer defined by an ancestor's `layers` declaration.

### Syntax

```
layer: <name>;
```

Accepts a single `<name>` token that must match one of the names declared in an ancestor's `layers` property.

### Ancestor Requirement

The `<name>` used in `layer` must correspond to a name defined in the `layers` property of an ancestor widget. If the name does not match any ancestor's `layers` declaration, the property has no effect.

### CSS

```css
#box1 {
    layer: above;
}
```

### Python

```python
widget.styles.layer = "above"
```

The Python API accepts a string.

## Relationship Between `layers` and `layer`

- `layers` is set on a **container** (parent/ancestor) to declare available layer names and their order.
- `layer` is set on a **child/descendant** to place it on one of those declared layers.
- A `layer` value that does not match any ancestor's `layers` declaration is silently ignored (no effect).
- Widgets that do not specify a `layer` are placed on the default (lowest) layer.

## Behavior

### Stacking Order

Within a single layer, widgets follow the normal paint order (yield/compose order). Across layers, the layer order defined by `layers` takes precedence over compose order.

### Scope

Layers are inherited through the DOM tree. A `layers` declaration on `Screen` makes those layer names available to all widgets on that screen. A `layers` declaration on a nested container scopes those layer names to that container's descendants.

### Multiple `layers` Declarations

If multiple ancestors declare `layers`, a widget's `layer` assignment is resolved against the nearest ancestor that defines a matching layer name.

## Complete Example

```python
from textual.app import App, ComposeResult
from textual.widgets import Static

class LayersExample(App):
    CSS_PATH = "layers.tcss"

    def compose(self) -> ComposeResult:
        yield Static("box1 (layer = above)", id="box1")
        yield Static("box2 (layer = below)", id="box2")
```

```css
Screen {
    align: center middle;
    layers: below above;
}

Static {
    width: 28;
    height: 8;
    color: auto;
    content-align: center middle;
}

#box1 {
    layer: above;
    background: darkcyan;
}

#box2 {
    layer: below;
    background: orange;
    offset: 12 6;
}
```

In this example, `#box1` is yielded before `#box2`, so without layers `#box2` would appear on top. However, `#box1` is assigned to the `above` layer and `#box2` to the `below` layer, so `#box1` is drawn on top of `#box2`.

## Internal Representation

- `layers` is stored as `tuple[str, ...]` in the styles rules dictionary.
- `layer` is stored as `str` in the styles rules dictionary.
- Both properties use `<name>` CSS type tokens (identifiers without quotes).
