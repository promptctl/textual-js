# ContentSwitcher Widget

## Overview

`ContentSwitcher` is a container widget that displays exactly one of its children at a time, hiding all others. It provides a mechanism for building tabbed or switchable views where the visible child is selected by its DOM ID. It is a subclass of `Container`.

- Not focusable.
- Is a container (composes children).

## Constructor

```python
ContentSwitcher(
    *children: Widget,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
    initial: str | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `*children` | `Widget` | -- | The child widgets to switch between. Each must have a unique ID. |
| `name` | `str \| None` | `None` | The name of the widget. |
| `id` | `str \| None` | `None` | The DOM ID of the ContentSwitcher itself. |
| `classes` | `str \| None` | `None` | CSS classes for the ContentSwitcher. |
| `disabled` | `bool` | `False` | Whether the widget starts disabled. |
| `initial` | `str \| None` | `None` | The ID of the child to display initially. If `None`, no child is visible on mount. |

## Child Widget Requirements

- All children that participate in switching must have a unique ID.
- Children without an ID are hidden and ignored by the switcher.
- IDs are scoped to the ContentSwitcher's parent, so children can share IDs with widgets elsewhere in the DOM (e.g., buttons that drive the switcher can have the same IDs as the switcher's children, since they live in different parents).

## Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `current` | `str \| None` | `None` | The ID of the currently-visible child. Set to `None` to hide all children. |

### Behavior of `current`

- When `current` changes, the previously-visible child's `display` is set to `False` and the new child's `display` is set to `True`.
- Setting `current` to `None` hides all children.
- Setting `current` to an ID that does not match any child raises `NoMatches` (`textual.css.query.NoMatches`).
- Changes are applied inside `app.batch_update()` to avoid intermediate repaints.
- The reactive is initialized with `init=False`, meaning the watcher does not fire during construction. The initial visibility is set up in the `Mount` event handler instead.

## Properties

| Property | Type | Description |
|---|---|---|
| `visible_content` | `Widget \| None` | Returns the currently-visible child widget, or `None` if `current` is `None`. |

## Methods

### `add_content`

```python
add_content(
    widget: Widget,
    *,
    id: str | None = None,
    set_current: bool = False,
) -> AwaitComplete
```

Dynamically adds a new child widget to the switcher after mount.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `widget` | `Widget` | -- | The widget to add. |
| `id` | `str \| None` | `None` | An ID to assign to the widget. If `None`, the widget must already have an ID. |
| `set_current` | `bool` | `False` | If `True`, immediately switch to the newly added widget. |

- The new widget is mounted with `display = False` initially.
- If `set_current` is `True`, `current` is set to the new widget's ID after mounting.
- Raises `ValueError` if the widget has no ID and no `id` parameter is provided.
- Returns an `AwaitComplete` that resolves when the widget has been mounted.

## Messages

This widget posts no messages.

## Bindings

This widget has no bindings.

## Component Classes

This widget has no component classes.

## Default CSS

```css
ContentSwitcher {
    height: auto;
}
```

## Mount Behavior

On mount, the switcher iterates all children and sets `display = False` on every child except the one whose ID matches `initial`. If `initial` is `None` (or not provided), all children are hidden. This setup runs inside `app.batch_update()`.

## Error Conditions

| Condition | Exception |
|---|---|
| `current` set to an ID not present among children | `NoMatches` |
| `add_content` called with a widget that has no ID and no `id` parameter | `ValueError` |

## Typical Usage Pattern

ContentSwitcher is commonly paired with buttons or tabs that drive visibility. The pattern is:

1. Compose a set of buttons (or similar controls) with IDs corresponding to the switcher's children.
2. Compose a `ContentSwitcher` with children that have matching IDs, and optionally set `initial` to show one on startup.
3. In a button-pressed (or equivalent) handler, set `switcher.current = event.button.id`.

```python
def compose(self) -> ComposeResult:
    with Horizontal():
        yield Button("View A", id="a")
        yield Button("View B", id="b")
    with ContentSwitcher(initial="a"):
        yield WidgetA(id="a")
        yield WidgetB(id="b")

def on_button_pressed(self, event: Button.Pressed) -> None:
    self.query_one(ContentSwitcher).current = event.button.id
```
