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

### Update Method

`update(value)` sets new text on the widget. After calling `update("Hello")`:

- `content` returns `"Hello"` (as `str`).
- `visual` returns `"Hello"` (as `Content`).

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
- `Static.update()` must keep `content` and `visual` in sync: both reflect the same text value.
- A newly constructed `Static()` must have empty-string content and visual.
- `Placeholder` must reject invalid variant strings at construction time by raising `InvalidPlaceholderVariant`.
- `Placeholder` must reject invalid variant strings when assigned to the `variant` property reactively, also raising `InvalidPlaceholderVariant`.
