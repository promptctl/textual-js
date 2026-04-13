# OptionList Widget

The `OptionList` widget displays a vertical list of options that users can highlight, select, and interact with via keyboard and mouse. Each option is represented by an `Option` instance. The list also supports separators (represented by `None` values passed during construction) which are non-interactive visual dividers between groups of options.

## Construction and Content

### Creating an OptionList

An `OptionList` accepts a mix of strings, `Option` instances, and `None` values as positional arguments. Strings are implicitly converted to `Option` instances. `None` values become separators and do not count toward `option_count`.

- `OptionList("a", Option("b"), None, Option("c"))` creates a list with 3 options and 1 separator.
- An `OptionList()` with no arguments creates an empty list where `highlighted` is `None`.

### The Option class

An `Option` has the following constructor parameters:

- `prompt` -- the display text (a string). Multi-line prompts (containing `\n`) are supported.
- `id` -- an optional string identifier. Must be unique within the list.
- `disabled` -- a boolean (default `False`) controlling whether the option can be highlighted or selected.

### option_count

The `option_count` property returns the number of options (excluding separators).

### Accessing options

- `get_option(id)` -- retrieves an `Option` by its string ID. Raises `OptionDoesNotExist` if the ID is not found.
- `get_option_at_index(index)` -- retrieves an `Option` by its zero-based index. Supports negative indexing (e.g., `-1` for the last option). Raises `OptionDoesNotExist` if the index is out of range.

Options are available for lookup immediately after construction, before the widget is mounted.

### Adding options

- `add_option(item)` -- appends a single option. Accepts a string, an `Option`, or `None`. Passing `None` or calling with no argument is a no-op (option count does not change).
- `add_options(items)` -- appends multiple options from a list. An empty list is a no-op.

### Replacing all options

- `set_options(items)` -- replaces the entire contents of the list. Accepts a list of strings or `Option` instances.

### Clearing options

- `clear_options()` -- removes all options. After clearing, `option_count` is 0 and `highlighted` is `None`.

### Duplicate ID handling

- Adding an option whose ID already exists in the list raises `DuplicateID`.
- Adding multiple options in a single `add_options` call where the new options share an ID with each other also raises `DuplicateID`.
- When a `DuplicateID` error is raised, the list remains unchanged (no partial additions).
- After a `DuplicateID` error, subsequent non-duplicate additions succeed normally.

## Disabled Options

### Initial disabled state

Options can be created as disabled via `Option("text", disabled=True)`. The `disabled` property on the option reflects the current state.

### Toggling disabled state by ID

- `disable_option(id)` -- disables the option with the given ID. Raises `OptionDoesNotExist` for an unknown ID.
- `enable_option(id)` -- enables the option with the given ID. Raises `OptionDoesNotExist` for an unknown ID.

### Toggling disabled state by index

- `disable_option_at_index(index)` -- disables the option at the given index. Raises `OptionDoesNotExist` for an out-of-range index.
- `enable_option_at_index(index)` -- enables the option at the given index. Raises `OptionDoesNotExist` for an out-of-range index.

## ID Stability

Options added after construction retain their IDs and can be retrieved by ID immediately. Adding an option with `Option("text", id="x")` followed by `get_option("x")` returns that same option.

## Mouse Interaction

### Clicking

- Clicking an enabled option highlights and selects it, posting both `OptionHighlighted` and `OptionSelected` messages.
- Clicking a disabled option produces no messages and does not change the highlight.
- Clicking a separator produces no messages and does not change the highlight.

### Hovering

- The internal `_mouse_hovering_over` attribute tracks which option index the mouse cursor is over.
- When the mouse is not over the `OptionList`, `_mouse_hovering_over` is `None`.
- Hovering over an enabled option sets `_mouse_hovering_over` to that option's index, regardless of whether it is the currently highlighted option.
- Hovering over a disabled option still sets `_mouse_hovering_over` to that option's index, but does not change the highlight.
- Moving the mouse away from the `OptionList` resets `_mouse_hovering_over` to `None`.

## Keyboard Movement

### highlighted property

- `highlighted` is an integer index (or `None`) indicating which option currently has the highlight.
- On a non-empty list, the initial highlight is index 0.
- On an empty list, highlighted is `None`.
- After clearing, highlighted is `None`.
- The property can be set programmatically.

### Navigation keys

All navigation requires the `OptionList` to have focus (via `tab`).

- **Down** -- moves highlight to the next enabled option. Wraps from the last option to the first.
- **Up** -- moves highlight to the previous enabled option. Wraps from the first option to the last.
- **Home** -- moves highlight to the first enabled option.
- **End** -- moves highlight to the last enabled option.
- **Page Down** -- moves highlight down by a page. At the end of a short list, stays at the end.
- **Page Up** -- moves highlight up by a page. At the start of a short list, stays at the start.
- **Enter** -- selects the currently highlighted option, posting an `OptionSelected` message.

### Movement in an empty or cleared list

All movement keys are no-ops when the list is empty; `highlighted` remains `None`.

### Movement when highlighted is None (non-empty list)

When options exist but nothing is highlighted:

- **Up** lands on the last option.
- **Down** lands on the first option.
- **Home** lands on the first option.
- **End** lands on the last option.
- **Page Up** lands on the first option.
- **Page Down** lands on the last option.

### Skipping disabled options

Keyboard navigation automatically skips disabled options. When moving down or up, the highlight advances past any disabled options to the next enabled one. Wrapping also skips disabled options.

## Subclassing Option

The `Option` class can be subclassed to carry additional data. Subclassed options:

- Retain their concrete type when retrieved via `get_option(id)` or `get_option_at_index(index)` (i.e., `isinstance` checks against the subclass pass).
- Preserve all custom attributes set in the subclass constructor.
- Work identically with ID-based and index-based retrieval.

## Messages

### OptionMessage base

All option list messages inherit from `OptionList.OptionMessage`. Each message exposes:

- `option_id` -- the string ID of the relevant option.
- `option_index` -- the integer index of the relevant option.
- `option_list` / `control` -- a reference to the `OptionList` widget that posted the message.
- `option` -- the `Option` instance.

### OptionHighlighted

- Posted when the highlighted option changes.
- Posted once on startup if the list is non-empty (for the initial highlight at index 0).
- Not posted when programmatically setting `highlighted` to its current value (no duplicate messages).
- Not posted when highlighting a disabled option programmatically.
- Posted when the highlight changes via keyboard or mouse.

### OptionSelected

- Posted when an option is selected via Enter key or mouse click.
- Not posted for disabled options, even when clicked.

### Handling messages

Messages can be handled via `on_option_list_option_highlighted` and `on_option_list_option_selected` handler methods, or via the `@on(OptionList.OptionMessage)` decorator to catch both message types.

## Prompt Replacement

### Replacing by ID

- `replace_option_prompt(id, new_prompt)` -- replaces the prompt text of the option with the given ID.
- Raises `OptionDoesNotExist` if the ID does not exist.

### Replacing by index

- `replace_option_prompt_at_index(index, new_prompt)` -- replaces the prompt text of the option at the given index. Returns the `OptionList` instance (supports chaining).
- Raises `OptionDoesNotExist` if the index is out of range.

### Multi-line prompt replacement

- A single-line prompt can be replaced with a multi-line prompt (containing `\n`).
- A multi-line prompt can be replaced with a single-line prompt.
- A multi-line prompt can be replaced with a different multi-line prompt.

## Removal

### Removing by index

- `remove_option_at_index(index)` -- removes the option at the given index.
- Raises `OptionDoesNotExist` if the index is out of range.

### Removing by ID

- `remove_option(id)` -- removes the option with the given ID.
- Raises `OptionDoesNotExist` if the ID does not exist.

### Highlight adjustment after removal

- Removing the first option when it is highlighted keeps `highlighted` at 0 (now pointing to the next option).
- Removing the last option when a different option is highlighted does not change the highlight index.
- Removing all options sets `highlighted` to `None`.

### Hover reset after removal

- Removing an option resets `_mouse_hovering_over` to `None`, even if the mouse was hovering over a different option than the one removed.

## Constraints

- Option IDs must be unique within a single `OptionList`. Attempting to add a duplicate raises `DuplicateID` and leaves the list unchanged.
- Accessing an option by a nonexistent ID or an out-of-range index raises `OptionDoesNotExist`.
- Separators (`None`) are visual only: they do not count as options, cannot be highlighted or selected, and clicking them is a no-op.
- Disabled options are skipped by keyboard navigation and cannot be selected via mouse click. Hovering and programmatic highlight assignment to disabled options are permitted but do not post `OptionHighlighted`.
- Keyboard navigation wraps around in both directions (down from last goes to first, up from first goes to last), always skipping disabled options.
- An empty or cleared list treats all movement keys as no-ops; `highlighted` stays `None`.
- The `OptionList` posts an initial `OptionHighlighted` message on mount when the list is non-empty.
- Setting `highlighted` to its current value does not re-post `OptionHighlighted`.
