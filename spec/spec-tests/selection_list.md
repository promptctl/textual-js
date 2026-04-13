# SelectionList

`SelectionList` is a widget that extends `OptionList` to present a list of items with checkboxes that users can select and deselect. It is generic over the type of value associated with each selection (e.g., `SelectionList[int]`).

## Creation

### Constructor arguments

A `SelectionList` accepts selection items as positional arguments. Each item can be:

- A **tuple of two elements** `(prompt, value)` -- creates an unselected selection.
- A **tuple of three elements** `(prompt, value, initial_state)` -- creates a selection with the given initial selected state (`True` or `False`).
- A **`Selection` object** -- `Selection(prompt, value)`, `Selection(prompt, value, initial_state)`, or `Selection(prompt, value, initial_state, id=some_id)`.

All input forms are normalized into `Selection` instances internally.

### Selection identity

Selections that are created with an `id` parameter can be retrieved by that ID using `get_option(id)`. Any selection can be retrieved by its positional index using `get_option_at_index(index)`. Negative indexing is supported (e.g., index `-1` returns the last item).

### Initial selected state

- A two-element tuple `(prompt, value)` defaults to unselected.
- A three-element tuple `(prompt, value, False)` is explicitly unselected.
- A three-element tuple `(prompt, value, True)` is initially selected.
- `Selection(prompt, value, True)` is initially selected.

The `selected` property returns a list of the **values** (not prompts or indices) of all currently selected items. For example, given items created with values `0` through `4` where only items with values `2` and `4` are initially selected, `selected` returns `[2, 4]`.

### Options are available immediately

After constructing a `SelectionList` with items, those items are queryable (e.g., via `get_option`) immediately, before the widget is mounted.

## Adding and Removing Items

### Adding items after creation

- `add_option(item)` accepts a `(prompt, value)` tuple, a `(prompt, value, state)` tuple, or a `Selection` object.
- `add_options(items)` accepts a list of such items. Passing an empty list is a no-op.
- When a newly added item is initially selected, it appears in the `selected` list immediately.

### Invalid additions

Adding any of the following raises `SelectionError`:

- `None`
- An `Option` (from `OptionList`) that is not a `Selection`.
- A bare string.
- A one-element tuple `(prompt,)`.
- A four-or-more-element tuple `(prompt, value, state, extra)`.

### Removing items

- `remove_option_at_index(index)` removes the item at the given index.
- Removing a selected item also removes its value from the `selected` set.
- After removal, the internal index-to-value mapping is reindexed so that remaining items retain correct, contiguous indices.

### Clearing

- `clear_options()` removes all items and empties the `selected` list.

## Toggling Selections

### Single-item operations

- `select(index)` -- selects the item at the given index. If already selected, this is idempotent (no duplicate message).
- `deselect(index)` -- deselects the item at the given index. If already deselected, this is idempotent (no message emitted).
- `toggle(index)` -- flips the selected state of the item at the given index.

### Bulk operations

- `select_all()` -- selects every item. Only emits a single `SelectedChanged` message regardless of how many items changed state. Calling it when all items are already selected is idempotent.
- `deselect_all()` -- deselects every item. Only emits a single `SelectedChanged` message if any item actually changed state. Calling it when nothing is selected is idempotent.
- `toggle_all()` -- flips every item. Emits a `SelectionToggled` for each individual item, followed by a single `SelectedChanged`.

### User interaction

- Pressing **space** on the highlighted item toggles it (equivalent to calling `toggle` on the highlighted index).

## Checkbox Clicking

Clicking anywhere on a selection row toggles it. This includes:

- Clicking on the **prompt text** area.
- Clicking on the **checkbox** itself.

Both produce a `SelectionToggled` message with the correct `selection_index`.

## Messages

`SelectionList` emits three message types. All messages have a `control` property that references the originating `SelectionList` widget.

### SelectionHighlighted

- Subclass of `SelectionMessage`.
- Emitted when the highlighted (focused) row changes.
- On startup, a non-empty list emits `SelectionHighlighted` with `selection_index` 0.
- Setting `highlighted` to a new index programmatically emits this message.

### SelectionToggled

- Subclass of `SelectionMessage`.
- Emitted when a single item's selected state is toggled (via `toggle`, user space key, or click).
- Carries `selection_index` identifying which item was toggled.
- **Not** emitted by `select`, `deselect`, `select_all`, or `deselect_all` -- those operations do not count as toggles.
- `toggle_all` emits one `SelectionToggled` per item.

### SelectedChanged

- Not a subclass of `SelectionMessage` (carries no `selection_index`).
- Emitted whenever the overall set of selected values changes.
- `select(index)` emits it once (if the item was not already selected).
- `deselect(index)` emits it once (if the item was not already deselected).
- `select_all()` emits it at most once, after all items are selected.
- `deselect_all()` emits it at most once, only if something was actually deselected.
- `toggle(index)` emits it once.
- `toggle_all()` emits it once, after all individual `SelectionToggled` messages.

### Message ordering

When toggling a single item, the order is: `SelectedChanged`, then `SelectionToggled`.

When using `toggle_all`, the order is: all `SelectionToggled` messages (one per item), then a single `SelectedChanged`.

## Handling Wide Selections

When a `SelectionList` is constrained to a width narrower than its content (e.g., via CSS `width: 20`), selections that are wider than the widget do not cause errors or change the highlighted state. The widget remains functional with `highlighted` preserving its value.

## Constraints

- `SelectionList` inherits from `OptionList`. All `OptionList` API not overridden by `SelectionList` is assumed to work identically.
- Only `Selection` instances (or tuples convertible to them) may be added. Adding raw `Option` objects, strings, `None`, or malformed tuples raises `SelectionError`.
- `selected` always returns values in index order.
- Idempotent operations (selecting an already-selected item, deselecting an already-deselected item, calling `select_all` when all are selected, calling `deselect_all` when none are selected) do not emit messages.
- Removing an item updates internal index mappings; the value set and index mapping remain consistent.
- `SelectedChanged` is a coalesced summary message; `SelectionToggled` is a per-item detail message. Consumers can listen for either or both depending on their needs.
