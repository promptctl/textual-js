# Button Widget

## Overview

`Button` is a simple clickable widget that can be activated by mouse click or by pressing `Enter` when focused. It posts a `Button.Pressed` message when activated, unless an `action` string is provided (in which case the action is run instead of posting the message).

- Focusable: yes
- Container: no
- Import: `from textual.widgets import Button`

## Constructor

```python
Button(
    label: ContentText | None = None,
    variant: ButtonVariant = "default",
    *,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
    tooltip: RenderableType | None = None,
    action: str | None = None,
    compact: bool = False,
    flat: bool = False,
)
```

| Parameter  | Type                     | Default     | Description                                                             |
|------------|--------------------------|-------------|-------------------------------------------------------------------------|
| `label`    | `ContentText \| None`    | `None`      | Text displayed inside the button. If `None`, uses the CSS identifier.   |
| `variant`  | `ButtonVariant`          | `"default"` | Semantic color variant.                                                 |
| `name`     | `str \| None`            | `None`      | Widget name.                                                            |
| `id`       | `str \| None`            | `None`      | Widget DOM ID.                                                          |
| `classes`  | `str \| None`            | `None`      | CSS classes.                                                            |
| `disabled` | `bool`                   | `False`     | Whether the button is disabled. Disabled buttons cannot be focused or clicked. |
| `tooltip`  | `RenderableType \| None` | `None`      | Optional tooltip shown on hover.                                        |
| `action`   | `str \| None`            | `None`      | Action string to run when pressed (bypasses `Pressed` message).         |
| `compact`  | `bool`                   | `False`     | Compact style (removes borders).                                        |
| `flat`     | `bool`                   | `False`     | Alternative flat visual style.                                          |

## Reactive Attributes

| Name      | Type          | Default     | Description                                                          |
|-----------|---------------|-------------|----------------------------------------------------------------------|
| `label`   | `ContentText` | `Content.empty()` | The text displayed inside the button. Supports markup.          |
| `variant` | `str`         | `"default"` | Semantic styling variant. Must be one of the valid `ButtonVariant` values. |
| `compact` | `bool`        | `False`     | Compact mode removes borders. Toggles CSS class `-textual-compact`.  |
| `flat`    | `bool`        | `False`     | Flat style. Toggles between `-style-flat` and `-style-default` CSS classes. |

## Variants (ButtonVariant)

`ButtonVariant` is a `Literal` type: `"default" | "primary" | "success" | "warning" | "error"`.

Setting an invalid variant raises `InvalidButtonVariant`.

Each variant applies a CSS class `-{variant}` (e.g., `-primary`, `-success`) that controls the button's color scheme. The `default` variant uses surface colors; the other variants use their respective theme colors (`$primary`, `$success`, `$warning`, `$error`).

### Variant Factory Class Methods

Convenience constructors that return a `Button` with the variant pre-set:

- `Button.success(label, *, name, id, classes, disabled, flat)` -- creates a `"success"` variant button.
- `Button.warning(label, *, name, id, classes, disabled, flat)` -- creates a `"warning"` variant button.
- `Button.error(label, *, name, id, classes, disabled, flat)` -- creates an `"error"` variant button.

There is no factory method for `"default"` (it is the default) or `"primary"` (use `variant="primary"`).

## Messages

### Button.Pressed

Sent when the button is pressed and no `action` is set on the button.

| Attribute | Type     | Description                      |
|-----------|----------|----------------------------------|
| `button`  | `Button` | The button instance that was pressed. |
| `control` | `Button` | Alias for `button` (standard Textual convention). |

Handler name: `on_button_pressed`.

The message is **not** posted when `action` is set; in that case the action string is run via `app.run_action` with the button's parent as the default namespace.

## Bindings

| Key     | Action  | Description   | Shown |
|---------|---------|---------------|-------|
| `enter` | `press` | Press button  | No    |

The `action_press` method calls `press()` if the button is not already in its active animation state.

## Methods

### press()

```python
def press(self) -> Self
```

Programmatically activate the button. This triggers the active-press animation and either posts `Button.Pressed` or runs the configured `action`. Does nothing if the button is disabled or not displayed. Returns `self`.

## Instance Attributes

| Attribute                | Type    | Default | Description                                              |
|--------------------------|---------|---------|----------------------------------------------------------|
| `active_effect_duration` | `float` | `0.2`   | Duration in seconds for the button press animation.      |
| `action`                 | `str \| None` | `None` | Action string to run on press instead of posting `Pressed`. |

## Default CSS and Styling

### Layout defaults

- `width: auto`
- `min-width: 16`
- `height: auto`
- `text-align: center`
- `content-align: center middle`
- `pointer: pointer`

### Style modes

The button has two visual modes controlled by the `flat` reactive:

- **Default style** (`-style-default`): Uses `border-top: tall` / `border-bottom: tall` to create a raised 3D appearance. Hover darkens the background; active state inverts the border directions.
- **Flat style** (`-style-flat`): Uses `border: block` with muted variant backgrounds. Hover switches to the full variant color. Active state applies a background tint.

### Disabled state

- Default style: `text-opacity: 0.6`, `pointer: not-allowed`.
- Flat style: `color: auto 50%`, `pointer: not-allowed`.

### Compact mode

When `compact` is `True`, the CSS class `-textual-compact` is added, which removes borders entirely via `border: none !important`.

### Internal CSS classes

These are managed automatically by the widget:

| Class                | Applied when                       |
|----------------------|------------------------------------|
| `-{variant}`         | Always; changes when `variant` changes. |
| `-style-default`     | `flat` is `False`.                 |
| `-style-flat`        | `flat` is `True`.                  |
| `-active`            | Briefly during press animation.    |
| `-textual-compact`   | `compact` is `True`.               |

## Component Classes

None.

## Spacing Note

The visual spacing between button text and button edges comes from `border-top: tall` / `border-bottom: tall` and `min-width: 16`, not from padding. To remove the spacing, set `border: none;` and adjust `min-width` as needed.

## Usage Patterns

### Basic button with handler

```python
def compose(self) -> ComposeResult:
    yield Button("Submit", variant="primary", id="submit")

def on_button_pressed(self, event: Button.Pressed) -> None:
    if event.button.id == "submit":
        self.do_submit()
```

### Using variant factory methods

```python
yield Button.success("Save")
yield Button.warning("Caution")
yield Button.error("Delete")
```

### Button with an action (no Pressed message)

```python
yield Button("Quit", action="quit")
```

When pressed, this runs `app.quit()` (or the action in the parent's namespace) instead of posting `Button.Pressed`.

### Flat buttons

```python
yield Button("Flat Primary", variant="primary", flat=True)
```

### Compact buttons (no borders)

```python
yield Button("Compact", compact=True)
```
