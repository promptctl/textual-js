# Label Widget

## Overview

`Label` is a simple widget for displaying static text or Rich renderables. It extends `Static` with semantic color variants and slightly different default CSS (auto width instead of full width).

- Focusable: no
- Container: no
- Import: `from textual.widgets import Label`

## Constructor

```python
Label(
    content: VisualType = "",
    *,
    variant: LabelVariant | None = None,
    expand: bool = False,
    shrink: bool = False,
    markup: bool = True,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

| Parameter  | Type                     | Default | Description                                                        |
|------------|--------------------------|---------|--------------------------------------------------------------------|
| `content`  | `VisualType`             | `""`    | Text, Content object, or Rich renderable to display.               |
| `variant`  | `LabelVariant \| None`   | `None`  | Semantic color variant. Adds the variant name as a CSS class.      |
| `expand`   | `bool`                   | `False` | Expand content to fill container width if needed.                  |
| `shrink`   | `bool`                   | `False` | Shrink content to fit container width if needed.                   |
| `markup`   | `bool`                   | `True`  | Whether to parse Textual markup in string content.                 |
| `name`     | `str \| None`            | `None`  | Widget name.                                                       |
| `id`       | `str \| None`            | `None`  | Widget DOM ID.                                                     |
| `classes`  | `str \| None`            | `None`  | Space-separated CSS classes.                                       |
| `disabled` | `bool`                   | `False` | Whether the widget is disabled.                                    |

## Inheritance

`Label` inherits from `Static`, which inherits from `Widget`. It gains the `update()` method and `content` property from `Static` for changing displayed content after construction.

## Variants (LabelVariant)

`LabelVariant` is a `Literal` type: `"success" | "error" | "warning" | "primary" | "secondary" | "accent"`.

When a variant is provided, the variant name is added as a CSS class on the widget (e.g., `variant="success"` adds the class `success`). Each variant applies themed foreground and background colors:

| Variant     | Color             | Background          |
|-------------|-------------------|---------------------|
| `success`   | `$text-success`   | `$success-muted`    |
| `error`     | `$text-error`     | `$error-muted`      |
| `warning`   | `$text-warning`   | `$warning-muted`    |
| `primary`   | `$text-primary`   | `$primary-muted`    |
| `secondary` | `$text-secondary` | `$secondary-muted`  |
| `accent`    | `$text-accent`    | `$accent-muted`     |

Unlike `Button`, there is no `"default"` variant. When `variant` is `None`, no variant class is added and the label uses inherited/default colors.

## Reactive Attributes

This widget has no reactive attributes of its own. It inherits `expand` and `shrink` from `Static`/`Widget`.

## Messages

This widget posts no messages.

## Bindings

This widget has no bindings.

## Component Classes

None.

## Default CSS

```css
Label {
    width: auto;
    height: auto;
    min-height: 1;
}
```

Notable difference from `Static`: Label defaults to `width: auto` (sized to content), while `Static` does not set an explicit width (inheriting the widget default of `width: 1fr`, which fills available space).

## Usage Patterns

### Basic text display

```python
def compose(self) -> ComposeResult:
    yield Label("Hello, world!")
```

### Using a variant for semantic coloring

```python
yield Label("Operation successful", variant="success")
yield Label("Something went wrong", variant="error")
yield Label("Proceed with caution", variant="warning")
```

### Updating content after creation

```python
label = self.query_one("#my-label", Label)
label.update("New text content")
```

### Rich renderables

Since `Label` extends `Static`, it accepts any Rich renderable (tables, panels, etc.) as content, not just plain strings.
