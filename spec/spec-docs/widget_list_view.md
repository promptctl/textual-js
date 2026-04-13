# ListView and ListItem

## Overview

`ListView` displays a vertical list of `ListItem` widgets that can be highlighted and selected via keyboard or mouse. It extends `VerticalScroll` and acts as a focusable container whose children cannot individually receive focus (`can_focus=True`, `can_focus_children=False`).

`ListItem` is the element type used within a `ListView`. It is not focusable and not a container. Its sole responsibility is rendering a single row and reporting click events to the parent `ListView`.

Both widgets were added in version 0.6.0.

## ListView

### Constructor

```python
ListView(
    *children: ListItem,
    initial_index: int | None = 0,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

- `*children` -- The `ListItem` widgets to display.
- `initial_index` -- Index to highlight on mount. Defaults to `0`. Pass `None` to start with no highlight. If the item at `initial_index` is disabled, the highlight advances (wrapping) to the next enabled item. If `initial_index` exceeds the child count, it clamps to `0`.

### Reactive Attributes

| Name    | Type           | Default | Description                                                                 |
|---------|----------------|---------|-----------------------------------------------------------------------------|
| `index` | `int \| None`  | `None`  | The currently highlighted index. Set to `None` when the list is empty or no item is highlighted. Clamped to `[0, len-1]` on assignment. |

The `index` reactive is initialized to `None` and set to `initial_index` during mount (after children are available).

### Properties

| Name               | Type               | Description                                        |
|--------------------|--------------------|----------------------------------------------------|
| `highlighted_child`| `ListItem \| None` | The currently highlighted `ListItem`, or `None`.   |

### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `append` | `(item: ListItem)` | `AwaitMount` | Append a single `ListItem` to the end. |
| `extend` | `(items: Iterable[ListItem])` | `AwaitMount` | Append multiple `ListItem`s to the end. |
| `insert` | `(index: int, items: Iterable[ListItem])` | `AwaitMount` | Insert `ListItem`(s) before the given index. |
| `clear`  | `()` | `AwaitRemove` | Remove all items and set `index` to `None`. |
| `pop`    | `(index: int \| None = None)` | `AwaitComplete` | Remove item at `index` (default: last item). Raises `IndexError` on empty list. Updates `index` after removal. |
| `remove_items` | `(indices: Iterable[int])` | `AwaitComplete` | Remove items at the given indices. Negative indices are supported. Updates `index` after removal. |

All mutation methods return an awaitable that resolves when the DOM update is complete.

### Index Maintenance on Removal

When items are removed via `pop` or `remove_items`:

- If the removed item is before the highlighted index, the index decrements to keep the same item highlighted.
- If the removed item is the highlighted item, the index is re-validated (clamped), and the new item at that position receives the highlight.
- If the removed item is after the highlighted index, the index is unchanged.
- If all items are removed, `index` becomes `None`.

### Messages

#### `ListView.Highlighted`

Posted when the highlighted item changes (including when set to `None`).

| Attribute   | Type               | Description                                      |
|-------------|--------------------|--------------------------------------------------|
| `list_view` | `ListView`         | The `ListView` that posted the message.          |
| `item`      | `ListItem \| None` | The newly highlighted item, or `None`.           |
| `control`   | `ListView`         | Alias for `list_view` (used by `on` decorator).  |

Handler name: `on_list_view_highlighted`.

Supports `ALLOW_SELECTOR_MATCH` on `item`, so you can use `@on(ListView.Highlighted, item=selector)`.

#### `ListView.Selected`

Posted when the user selects an item (pressing Enter or clicking).

| Attribute   | Type       | Description                                      |
|-------------|------------|--------------------------------------------------|
| `list_view` | `ListView` | The `ListView` that posted the message.          |
| `item`      | `ListItem` | The selected item.                               |
| `index`     | `int`      | The index of the selected item.                  |
| `control`   | `ListView` | Alias for `list_view` (used by `on` decorator).  |

Handler name: `on_list_view_selected`.

Supports `ALLOW_SELECTOR_MATCH` on `item`.

### Bindings

| Key   | Action              | Description              |
|-------|---------------------|--------------------------|
| Enter | `select_cursor`     | Select the current item. |
| Up    | `cursor_up`         | Move highlight up.       |
| Down  | `cursor_down`       | Move highlight down.     |

All bindings have `show=False`.

### Keyboard Navigation and Disabled Items

- `cursor_down` / `cursor_up` skip disabled `ListItem`s. Navigation uses `loop_from_index` with `wrap=False`, so pressing Down at the last enabled item does nothing (no wrapping during navigation).
- If `index` is `None` (nothing highlighted), pressing Down highlights the first item; pressing Up highlights the last item.

### Mouse Interaction

Clicking a `ListItem` focuses the `ListView`, sets `index` to the clicked item, and posts a `Selected` message. This is mediated by the internal `ListItem._ChildClicked` message.

### Default CSS

```css
ListView {
    background: $surface;
}
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
ListView:focus {
    background-tint: $foreground 5%;
}
ListView:focus > ListItem.-highlight {
    color: $block-cursor-foreground;
    background: $block-cursor-background;
    text-style: $block-cursor-text-style;
}
```

The highlight style changes between focused and blurred states, using `$block-cursor-*` and `$block-cursor-blurred-*` design tokens.

### Other

- `ALLOW_MAXIMIZE = True` -- The widget can be maximized.
- `__len__` returns the number of child items.

## ListItem

### Constructor

Standard `Widget` constructor (no special parameters beyond the usual `name`, `id`, `classes`, `disabled`).

### Reactive Attributes

| Name          | Type   | Default | Description                                              |
|---------------|--------|---------|----------------------------------------------------------|
| `highlighted` | `bool` | `False` | Whether this item is currently highlighted by its parent `ListView`. |

When `highlighted` changes, the `-highlight` CSS class is toggled on the widget.

### CSS Classes (Dynamic)

| Class         | Applied When                             |
|---------------|------------------------------------------|
| `-highlight`  | The item is the currently highlighted item in its parent `ListView`. |
| `-hovered`    | The mouse is hovering over the item.     |

Both classes are toggled programmatically and are used by the `ListView` default CSS to style the active and hovered rows.

### Messages

`ListItem` posts no public messages. It uses an internal `_ChildClicked` message to notify its parent `ListView` when clicked.

### Bindings

None.

### Events

`ListItem` handles `Enter` and `Leave` events to toggle the `-hovered` class. These events are stopped to prevent propagation.

## Usage Patterns

### Basic List

```python
from textual.app import App, ComposeResult
from textual.widgets import Label, ListItem, ListView

class MyApp(App):
    def compose(self) -> ComposeResult:
        yield ListView(
            ListItem(Label("One")),
            ListItem(Label("Two")),
            ListItem(Label("Three")),
        )
```

### Handling Selection

```python
def on_list_view_selected(self, event: ListView.Selected) -> None:
    self.notify(f"Selected item at index {event.index}")
```

### Dynamic Modification

```python
# Append
await list_view.append(ListItem(Label("New item")))

# Insert at position 0
await list_view.insert(0, [ListItem(Label("First"))])

# Remove last item
await list_view.pop()

# Remove specific indices
await list_view.remove_items([0, 2, 4])

# Clear all
await list_view.clear()
```

### Starting With No Highlight

```python
ListView(*items, initial_index=None)
```
