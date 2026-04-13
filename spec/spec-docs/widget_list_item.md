# ListItem

## Overview

`ListItem` is a widget designed for use as a child of `ListView`. It represents a single row in a vertical list. It is not focusable and not a container. Its responsibilities are rendering its content, reporting click events to the parent `ListView` via an internal message, and toggling visual classes for highlight and hover states.

Added in version 0.6.0.

- Focusable: No (`can_focus=False`)
- Container: No

## Constructor

```python
ListItem(
    *children: Widget,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

Standard `Widget` constructor. No special parameters beyond the usual `name`, `id`, `classes`, `disabled`.

## Reactive Attributes

| Name          | Type   | Default | Description                                                              |
|---------------|--------|---------|--------------------------------------------------------------------------|
| `highlighted` | `bool` | `False` | Whether this item is currently highlighted by its parent `ListView`.     |

When `highlighted` changes, the `-highlight` CSS class is added or removed via the `watch_highlighted` watcher using `set_class`.

## Properties

No additional properties beyond those inherited from `Widget`.

## Methods

No public methods beyond those inherited from `Widget`.

## Messages

`ListItem` posts no public messages.

Internally, it uses `_ChildClicked` to notify its parent `ListView` when the item is clicked. This message carries a reference to the clicked `ListItem` in its `item` attribute.

## Bindings

None.

## Component Classes

None.

## CSS Classes (Dynamic)

| Class        | Applied When                                                        |
|--------------|---------------------------------------------------------------------|
| `-highlight` | The item is the currently highlighted item in its parent `ListView`. Toggled by the `watch_highlighted` watcher. |
| `-hovered`   | The mouse is hovering over the item. Toggled by `Enter`/`Leave` event handling. |

Both classes are used by the `ListView` default CSS to style the active and hovered rows.

## Event Handling

### Click

When clicked, `ListItem` posts the internal `_ChildClicked` message to its parent. The parent `ListView` handles this by focusing itself, updating `index`, and posting a `ListView.Selected` message.

### Enter / Leave

`ListItem` handles `Enter` and `Leave` mouse events to toggle the `-hovered` CSS class based on `is_mouse_over`. Both events are stopped to prevent propagation to ancestor widgets.

## Interaction with ListView

`ListItem` is not intended for standalone use. Its behavior is driven by its parent `ListView`:

- The parent `ListView` sets the `highlighted` reactive attribute to `True` on the currently highlighted item and `False` on all others.
- Click events on a `ListItem` are communicated to the parent via the internal `_ChildClicked` message, which the `ListView` uses to update its `index` and post `Selected`.
- The default CSS for `ListItem` is defined within the `ListView` default CSS, providing styles for normal, highlighted, and hovered states using `$block-cursor-*` and `$block-cursor-blurred-*` design tokens.

## Default CSS

`ListItem` has no standalone default CSS. Its styling is provided by the parent `ListView` default CSS:

```css
ListView > ListItem {
    color: $foreground;
    height: auto;
    overflow: hidden hidden;
    width: 1fr;
}
ListView > ListItem.-hovered {
    background: $block-hover-background;
}
ListView > ListItem.-highlight {
    color: $block-cursor-blurred-foreground;
    background: $block-cursor-blurred-background;
    text-style: $block-cursor-blurred-text-style;
}
ListView:focus > ListItem.-highlight {
    color: $block-cursor-foreground;
    background: $block-cursor-background;
    text-style: $block-cursor-text-style;
}
```

The highlight style changes between focused and blurred states of the parent `ListView`.
