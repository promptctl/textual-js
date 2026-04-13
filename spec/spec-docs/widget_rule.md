# Rule Widget

## Purpose

The `Rule` widget is a visual separator for content, analogous to the `<hr>` HTML tag. It draws a line across the available space in either horizontal or vertical orientation, using a configurable line style. It is not focusable and not a container.

Source: `textual.widgets.Rule` (`src/textual/widgets/_rule.py`)

## Constructor

```python
Rule(
    orientation: RuleOrientation = "horizontal",
    line_style: LineStyle = "solid",
    *,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `orientation` | `RuleOrientation` | `"horizontal"` | The orientation of the rule line. |
| `line_style` | `LineStyle` | `"solid"` | The visual style of the line character. |
| `name` | `str \| None` | `None` | Widget name. |
| `id` | `str \| None` | `None` | Widget DOM ID. |
| `classes` | `str \| None` | `None` | CSS classes. |
| `disabled` | `bool` | `False` | Whether the widget is disabled. |

## Type Aliases

### `RuleOrientation`

```python
RuleOrientation = Literal["horizontal", "vertical"]
```

### `LineStyle`

```python
LineStyle = Literal[
    "ascii", "blank", "dashed", "double",
    "heavy", "hidden", "none", "solid", "thick",
]
```

## Reactive Attributes

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `RuleOrientation` | `"horizontal"` | The orientation of the rule. Changing this swaps the CSS class between `-horizontal` and `-vertical`. |
| `line_style` | `LineStyle` | `"solid"` | The line style of the rule. |

Both reactives have validators that raise `InvalidRuleOrientation` or `InvalidLineStyle` if set to an unrecognized value.

## Class Methods (Convenience Constructors)

### `Rule.horizontal(line_style="solid", ...) -> Rule`

Creates a `Rule` with `orientation="horizontal"`. Accepts the same keyword arguments as the main constructor (except `orientation`).

### `Rule.vertical(line_style="solid", ...) -> Rule`

Creates a `Rule` with `orientation="vertical"`. Accepts the same keyword arguments as the main constructor (except `orientation`).

## Messages

This widget posts no messages.

## Bindings

This widget defines no bindings.

## Component Classes

This widget defines no component classes.

## CSS Classes (automatic)

| Class | Condition |
|-------|-----------|
| `-horizontal` | Applied when `orientation` is `"horizontal"`. |
| `-vertical` | Applied when `orientation` is `"vertical"`. |

The watcher on `orientation` removes the old class and adds the new one whenever the orientation changes.

## Default CSS

```css
Rule {
    color: $secondary;
}

Rule.-horizontal {
    height: 1;
    margin: 1 0;
    width: 1fr;
}

Rule.-vertical {
    width: 1;
    margin: 0 2;
    height: 1fr;
}
```

- The rule color defaults to `$secondary`.
- Horizontal rules are 1 cell tall, full available width (`1fr`), with vertical margin of 1.
- Vertical rules are 1 cell wide, full available height (`1fr`), with horizontal margin of 2.

## Line Style Characters

### Horizontal

| Style | Character |
|-------|-----------|
| `ascii` | `-` |
| `blank` | ` ` (space) |
| `dashed` | `╍` |
| `double` | `═` |
| `heavy` | `━` |
| `hidden` | ` ` (space) |
| `none` | ` ` (space) |
| `solid` | `─` |
| `thick` | `█` |

### Vertical

| Style | Character |
|-------|-----------|
| `ascii` | `\|` |
| `blank` | ` ` (space) |
| `dashed` | `╏` |
| `double` | `║` |
| `heavy` | `┃` |
| `hidden` | ` ` (space) |
| `none` | ` ` (space) |
| `solid` | `│` |
| `thick` | `█` |

Note: `blank`, `hidden`, and `none` all render as spaces. They are functionally equivalent but exist as distinct named styles.

## Content Sizing

- **Horizontal**: `get_content_width` returns `container.width`; `get_content_height` returns `1`.
- **Vertical**: `get_content_width` returns `1`; `get_content_height` returns `container.height`.

## Rendering

The widget renders via two internal Rich renderables:

- `HorizontalRuleRenderable`: repeats the line character to fill the content width.
- `VerticalRuleRenderable`: emits the line character on each row, separated by newlines, to fill the content height.

The line color is determined by the widget's `rich_style` (i.e., the resolved `color` CSS property).

## Exceptions

| Exception | Raised When |
|-----------|-------------|
| `InvalidRuleOrientation` | `orientation` is set to a value not in `{"horizontal", "vertical"}`. |
| `InvalidLineStyle` | `line_style` is set to a value not in the recognized set. |

## Usage Notes

- The default constructor produces a horizontal solid rule. For the most common case, `yield Rule()` is sufficient.
- Use the convenience constructors `Rule.horizontal()` and `Rule.vertical()` for explicit clarity.
- The rule's color is controlled by the `color` CSS property, defaulting to `$secondary`.
- `expand` is set to `True` on the widget instance, allowing it to fill available space.
- Horizontal rules are typically placed inside vertical containers; vertical rules inside horizontal containers.
