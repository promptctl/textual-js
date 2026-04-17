## Static Widget

### Overview

`Static` is a widget that displays text content. It is imported from `textual.widgets`.

### Construction

A `Static` widget can be created with no arguments, in which case its content defaults to an empty string.

```python
static = Static()
```

### Content Property

The `content` property holds the current text of the widget as a `str`. It is readable and writable.

- On a freshly constructed `Static()`, `content` returns `""`.
- Assigning a string to `content` updates the displayed text.
- `content` always returns a `str`.

### Visual Property

The `visual` property returns the content as a `Content` object (from `textual.content`). It reflects the same text as `content` but wrapped in the `Content` type.

- `visual` is always an instance of `Content`.
- Its string value matches `content`.
- `visual` is the canonical styled representation of the widget's content. When the `visual` contains spans (for example, from markup or highlighting), rendering must preserve those spans rather than flattening to plain text first.

### Update Method

`update(value)` sets new text on the widget. After calling `update("Hello")`:

- `content` returns `"Hello"` (as `str`).
- `visual` returns `"Hello"` (as `Content`).

### Styled Content Rendering

- `Static("[bold]Styled[/]")` renders the plain text `"Styled"` with the bold style preserved in the rendered output.
- Passing a `Content` object with spans renders those spans; the render path must consume the `Content`/renderable representation, not just `visual.plain`.
- Multi-line `Content` preserves both line breaks and per-line styling when rendered.

---

## Placeholder Widget

### Overview

`Placeholder` is a widget used to reserve space in a layout, typically during prototyping. It is imported from `textual.widgets`.

### Construction

A `Placeholder` can be created with no arguments or with a `variant` keyword argument.

```python
p = Placeholder()
p = Placeholder(variant="some_variant")
```

Passing an invalid variant string raises `InvalidPlaceholderVariant` (from `textual.widgets._placeholder`).

### Variant Property

The `variant` reactive property controls which visual variant the placeholder displays.

- It is readable and writable.
- Assigning an invalid string raises `InvalidPlaceholderVariant`.

---

## Constraints

- `Static.content` must always be of type `str`, never `Content`.
- `Static.visual` must always be of type `Content`.
- `Static.update()` must keep `content` and `visual` in sync: both reflect the same text value, and `visual` remains the single source of truth for styled rendering.
- A newly constructed `Static()` must have empty-string content and visual.
- `Placeholder` must reject invalid variant strings at construction time by raising `InvalidPlaceholderVariant`.
- `Placeholder` must reject invalid variant strings when assigned to the `variant` property reactively, also raising `InvalidPlaceholderVariant`.
