## Static Widget

### Overview

`Static` is a widget that displays visual content. It is imported from `textual.widgets`.

### Construction

A `Static` widget can be created with no arguments, in which case its content defaults to an empty string.

```python
static = Static()
```

### Content Property

The `content` property holds the current visual-bearing source value for the widget. It is readable and writable.

- On a freshly constructed `Static()`, `content` returns `""`.
- Assigning a string to `content` updates the displayed text.
- Assigning a `Content` value preserves that `Content` as the source value.
- Assigning a supported renderable/visual value preserves that value as the source value rather than flattening it to plain text.

### Visual Property

The `visual` property returns the derived renderable/visual object used by the framework to render the content.

- `visual` is the canonical rendered representation of `content`.
- When the source value is textual, `visual` may be a `Content`-like visual with spans.
- When the source value is a renderable, `visual` preserves that renderable structure instead of collapsing it to plain text.

### Update Method

`update(value)` sets new content on the widget. After calling `update("Hello")`:

- `content` returns the source value `"Hello"`.
- `visual` returns a textual visual representing `"Hello"`.

### Styled Content Rendering

- `Static("[bold]Styled[/]")` renders the plain text `"Styled"` with the bold style preserved in the rendered output.
- Passing a `Content` object with spans renders those spans; the render path must consume the `Content`/renderable representation, not just `visual.plain`.
- Passing a supported renderable preserves the renderable structure; the widget must not flatten it to plain text before rendering.
- Styled rendering preserves the full rich-js style model rather than an Ink / Chalk subset. Named ANSI colors, bright colors, 8-bit palette colors, truecolor values, and text attributes all survive the bridge intact.
- Widget text styling is the base visual style under the `visual`; explicit `Content` spans override that base style on conflicts using rich-js merge semantics.
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

- `Static.content` must preserve the original visual-bearing source value.
- `Static.visual` must be the single source of truth for rendering that source value.
- `Static.update()` must keep `content` and `visual` in sync without collapsing renderables to plain text.
- A newly constructed `Static()` must have empty-string content and visual.
- `Placeholder` must reject invalid variant strings at construction time by raising `InvalidPlaceholderVariant`.
- `Placeholder` must reject invalid variant strings when assigned to the `variant` property reactively, also raising `InvalidPlaceholderVariant`.
