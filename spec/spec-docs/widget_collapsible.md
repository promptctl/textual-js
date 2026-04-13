# Collapsible Widget

## Overview

Added in version 0.37.

`Collapsible` is a container widget that wraps child content behind a clickable/focusable title bar. The content can be shown (expanded) or hidden (collapsed) by clicking the title or pressing Enter when the title is focused.

- Focusable (the title is focusable; the container itself delegates focus to its title)
- Container (children are placed inside an inner `Collapsible.Contents` container)

## Structure

A `Collapsible` composes two children:

1. **`CollapsibleTitle`** -- a focusable `Static` widget that displays the collapse/expand symbol followed by the title text.
2. **`Collapsible.Contents`** -- a `Container` that holds all user-provided child widgets.

When collapsed, the `-collapsed` CSS class is added to the `Collapsible` widget, and the `Contents` container has `display: none` applied via the default CSS rule `&.-collapsed > Contents { display: none; }`.

## Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `*children` | `Widget` | -- | Child widgets to place inside the collapsible contents. |
| `title` | `str` | `"Toggle"` | Text displayed in the title bar. |
| `collapsed` | `bool` | `True` | Initial collapsed state. `True` means content is hidden. |
| `collapsed_symbol` | `str` | `"▶"` | Symbol shown before the title when collapsed. |
| `expanded_symbol` | `str` | `"▼"` | Symbol shown before the title when expanded. |
| `name` | `str \| None` | `None` | Widget name. |
| `id` | `str \| None` | `None` | Widget DOM ID. |
| `classes` | `str \| None` | `None` | CSS classes. |
| `disabled` | `bool` | `False` | Whether the widget is disabled. |

## Composing Content

Content can be added via constructor arguments or context manager syntax:

```python
# Constructor style
yield Collapsible(Label("Hello"), title="Greeting")

# Context manager style (preferred)
with Collapsible(title="Greeting"):
    yield Label("Hello")
```

Both produce identical results. The context manager form calls `compose_add_child` internally to append widgets to the contents list.

## Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `collapsed` | `bool` | `True` | Controls collapsed/expanded state. Setting this programmatically triggers the watcher, posts the appropriate message, and updates the DOM. Defined with `init=False` so the watcher does not fire during construction. |
| `title` | `str` | `"Toggle"` | The title text. Changing this updates the `CollapsibleTitle` label reactively. |

## Messages

All messages bubble up through the DOM and carry a `collapsible` attribute referencing the originating `Collapsible` widget. The `control` property aliases `collapsible`.

### `Collapsible.Toggled`

Base message posted on every state change (collapse or expand). Handle with `@on(Collapsible.Toggled)` or `on_collapsible_toggled` to respond to both directions.

- **Attribute**: `collapsible: Collapsible` -- the widget that was toggled.
- **Property**: `control` -- alias for `collapsible`.

### `Collapsible.Expanded`

Subclass of `Toggled`. Posted when the widget transitions from collapsed to expanded. Handle with `on_collapsible_expanded`.

### `Collapsible.Collapsed`

Subclass of `Toggled`. Posted when the widget transitions from expanded to collapsed. Handle with `on_collapsible_collapsed`.

### Message Posting Behavior

Messages are posted by the `_watch_collapsed` watcher, which means they fire both when toggled via user interaction (click or Enter key) and when the `collapsed` reactive is set programmatically.

## Bindings

Bindings are defined on `CollapsibleTitle`, not on `Collapsible` itself:

| Key | Action | Description |
|---|---|---|
| `enter` | `toggle_collapsible` | Toggle the collapsible. Not shown in footer. |

Clicking the title also toggles the state (handled via `_on_click`).

## CSS Classes

### Automatic Classes

| Class | Applied To | Condition |
|---|---|---|
| `-collapsed` | `Collapsible` | When the widget is in collapsed state. |

### Component Classes

This widget has no component classes.

## Default CSS

### Collapsible

- `width: 1fr` -- fills available horizontal space.
- `height: auto` -- sizes to content.
- `background: $surface`.
- `border-top: hkey $background`.
- `padding-bottom: 1; padding-left: 1`.
- On `:focus-within`: applies a subtle background tint (`$foreground 5%`).

### CollapsibleTitle

- `width: auto; height: auto`.
- `padding: 0 1`.
- Text style and color from `$block-cursor-blurred-*` design tokens.
- `pointer: pointer` (shows pointer cursor on hover).
- On `:hover`: `background: $block-hover-background; color: $foreground`.
- On `:focus`: uses `$block-cursor-*` tokens for focused block appearance.

### Collapsible.Contents

- `width: 100%; height: auto`.
- `padding: 1 0 0 3` (indented left to align under title text, past the symbol).

## Nesting

Collapsible widgets can be nested. Collapsing an outer `Collapsible` hides its `Contents` (which contains the inner `Collapsible`), but does not change the inner widget's `collapsed` state. Each `Collapsible` maintains independent state.

## Internal Mechanics

- `CollapsibleTitle` posts an internal `CollapsibleTitle.Toggle` message on click or Enter.
- `Collapsible._on_collapsible_title_toggle` catches this message, stops propagation, and flips the `collapsed` reactive.
- The `_watch_collapsed` watcher: (1) calls `_update_collapsed` to sync the `-collapsed` class and the title's `collapsed` reactive, (2) posts the appropriate `Expanded` or `Collapsed` message, and (3) if mounted, schedules `scroll_visible` after refresh.
- `ALLOW_MAXIMIZE = True` on `Collapsible` -- the widget supports the maximize feature.
- `ALLOW_SELECT = False` on `CollapsibleTitle` -- text selection is disabled on the title.

## Exported Names

The module exports `Collapsible` and `CollapsibleTitle` via `__all__`.
