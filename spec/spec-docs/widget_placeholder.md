# Placeholder Widget

## Purpose

The `Placeholder` widget is a simple stand-in widget for use during layout prototyping. It has no complex functionality -- its role is to fill space in the UI so developers can study layout before building custom widgets. Each placeholder is automatically assigned a distinct background color (cycling through 12 predefined colors), making it easy to visually distinguish regions.

The placeholder has three display variants that show different information. Clicking a placeholder cycles through the variants.

- Not focusable
- Not a container

Source: `textual.widgets.Placeholder` (`src/textual/widgets/_placeholder.py`)

## Constructor

```python
Placeholder(
    label: str | None = None,
    variant: PlaceholderVariant = "default",
    *,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | `str \| None` | `None` | A custom label to display in the `default` variant. If `None`, falls back to `#<id>` if an ID is set, otherwise `"Placeholder"`. |
| `variant` | `PlaceholderVariant` | `"default"` | The initial display variant. Must be one of `"default"`, `"size"`, or `"text"`. |
| `name` | `str \| None` | `None` | Widget name. |
| `id` | `str \| None` | `None` | Widget DOM ID. |
| `classes` | `str \| None` | `None` | CSS classes. |
| `disabled` | `bool` | `False` | Whether the placeholder is disabled. |

## Variants

The `PlaceholderVariant` type is `Literal["default", "size", "text"]`.

| Variant | Display Content |
|---------|----------------|
| `"default"` | The custom label if provided, otherwise `#<id>` if an ID is set, otherwise `"Placeholder"`. |
| `"size"` | The current width and height of the placeholder (e.g. `80 x 24`), rendered in bold. Updates on resize. |
| `"text"` | Five repetitions of a Lorem Ipsum paragraph, separated by blank lines. Useful for testing text overflow and scrolling. |

Setting an invalid variant raises `InvalidPlaceholderVariant`.

## Reactive Attributes

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `PlaceholderVariant` | `"default"` | The current display variant. Validated on change; raises `InvalidPlaceholderVariant` for invalid values. |

## Methods

### `cycle_variant() -> Self`

Advances to the next variant in the cycle (`default` -> `size` -> `text` -> `default` -> ...). Returns the `Placeholder` instance for chaining. The cycle starts from whatever variant was set at construction time.

## Messages

This widget posts no messages.

## Bindings

This widget has no bindings.

## Component Classes

This widget has no component classes.

## CSS Classes (automatic)

| Class | Condition |
|-------|-----------|
| `-default` | Applied when the variant is `"default"`. |
| `-size` | Applied when the variant is `"size"`. |
| `-text` | Applied when the variant is `"text"`. Adds `padding: 1` in the default stylesheet. |

When the variant changes, the old variant class is removed and the new one is added (via `watch_variant`).

## Default CSS

```css
Placeholder {
    content-align: center middle;
    overflow: hidden;
    color: $text;
}
Placeholder:disabled {
    opacity: 0.7;
}
Placeholder.-text {
    padding: 1;
}
```

Each placeholder is also assigned a semi-transparent background color at compose time. Colors cycle through 12 predefined hex values (`#881177`, `#aa3355`, `#cc6666`, `#ee9944`, `#eedd00`, `#99dd55`, `#44dd88`, `#22ccbb`, `#00bbcc`, `#0099cc`, `#3366bb`, `#663399`) at 50% opacity. The color index is tracked per-app via a `WeakKeyDictionary`, so consecutive placeholders within the same app get consecutive colors.

## Click Behavior

Clicking the placeholder calls `cycle_variant()`, advancing to the next variant in order.

## Resize Behavior

On resize, the `"size"` variant renderable is updated with the new dimensions. If the current variant is `"size"`, the widget is also refreshed to display the updated size immediately.

## Usage Notes

- The label and variant renderables are cached at construction time. The label text cannot be changed after construction (only the variant can be changed reactively).
- The `"default"` variant label resolution order is: explicit `label` parameter, then `#<id>`, then the string `"Placeholder"`.
- The automatic background color assignment means placeholders created in different apps (or after app restart) reset the color counter independently.
