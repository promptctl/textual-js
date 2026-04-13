# ListView Widget

A vertical list of selectable items. ListView manages highlight state, keyboard navigation, and item removal. It contains ListItem children, each of which wraps arbitrary content (typically a Label).

## Construction

ListView accepts ListItem instances as positional arguments and an optional `initial_index` parameter that sets which item is highlighted on mount.

```python
ListView(
    ListItem(Label("Apple")),
    ListItem(Label("Banana")),
    ListItem(Label("Cherry")),
    initial_index=1,
)
```

An empty ListView (no children) sets `index` to `None`.

## Behaviors

### Navigation

- **Down arrow** moves the highlight to the next enabled item, skipping disabled items.
- **Up arrow** moves the highlight to the previous enabled item, skipping disabled items.
- Navigation stops at the boundaries of the list; it does not wrap.
- Each highlight change posts a `ListView.Highlighted` message.
- In an empty list, pressing down leaves `index` as `None`.

Given items `[0:disabled, 1, 2:disabled, 3:disabled, 4, 5, 6:disabled, 7, 8:disabled]`, pressing down five times from the initial position produces highlights in order: `1, 4, 5, 7` (then stays on 7). Pressing up five times from 7 produces: `5, 4, 1` (then stays on 1).

### Initial Index

When `initial_index` is provided, the ListView resolves it to the nearest enabled item:

- If the target item is enabled, it is selected directly.
- If the target item is disabled, the ListView searches forward for the nearest enabled item. If none is found forward, it searches backward.
- If `initial_index` is out of range, it wraps/clamps to the nearest enabled item (index 8 in a 9-item list where item 8 is disabled resolves to item 1, the first enabled item).

### Item Removal

#### `len(listview)`

`ListView` supports `__len__`; `len(listview)` returns the number of `ListItem` children currently in the list.

#### `remove_items(indices)`

Removes items at the given indices (supports negative indices and range objects). After removal:

- If the highlighted item was removed, the highlight moves to the item now at the same index position (or the last item if the old index exceeds the new length). A new `Highlighted` message is posted.
- If only items before the highlighted item were removed, the index adjusts downward to keep the same item highlighted. No extra `Highlighted` message is posted.
- If only items after the highlighted item were removed, the index stays the same. No extra `Highlighted` message is posted.
- If all items are removed, `index` becomes `None` and a `Highlighted` message with `item=None` is posted.

#### `pop(index=None)`

Removes and returns a single item by index (supports negative indices, defaults to last item). Follows the same highlight-adjustment rules as `remove_items`. Calling `pop()` on an empty ListView raises `IndexError` with the message "pop from empty list".

### Subclassing

ListView can be subclassed to provide items via `compose()` instead of constructor arguments. A subclass can:

- Override `compose()` to yield ListItem children.
- Add custom `BINDINGS` and action methods.
- Custom actions remain functional even when the list is empty (the empty state does not break action dispatch).

### Messages

#### `ListView.Highlighted`

Posted when the highlighted item changes. The message has an `item` attribute:

- The highlighted `ListItem` when an item is selected.
- `None` when the list becomes empty (all items removed).

## Constraints

- Disabled items are never highlighted, either by keyboard navigation or by `initial_index` resolution.
- Navigation skips disabled items entirely; it does not stop on them.
- `index` is `None` if and only if the list contains no enabled items.
- `pop()` on an empty list raises `IndexError`; it does not silently return `None`.
- After any removal operation, exactly one item has `highlighted = True` on its node (unless the list is empty).
- `Highlighted` messages reflect the final state: when removing the highlighted item, the message carries the new highlighted item, not the removed one.
