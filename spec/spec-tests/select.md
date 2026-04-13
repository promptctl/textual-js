# Select Widget

The `Select` widget presents a dropdown selection from a list of options. It is generic over the value type (e.g., `Select[int]`).

## Behavior

### Options and Values

Options are provided as a sequence of `(prompt, value)` tuples. The `value` parameter sets an initial value; if omitted, the select starts blank (`Select.NULL`).

- Setting `value` to a known option value selects that option.
- Setting `value` to an unknown value raises `InvalidSelectValueError`.
- Setting `value` to an unknown value *inside `compose`* (before mount) also raises `InvalidSelectValueError`, propagated at app startup.
- Setting `value` to `Select.NULL` returns the select to the blank state (when `allow_blank=True`).
- `set_options(new_options)` replaces all options and resets the value to blank (or to the first option when `allow_blank=False`).

### Blank State

By default, `allow_blank=True` and the initial value is `Select.NULL`.

- `is_blank()` returns `True` when the value is `Select.NULL`.
- `selection` returns `None` when the select is blank.
- When `allow_blank=False`, the select automatically picks the first option as its initial value, unless an explicit `value` is provided.

### Clearing

`clear()` resets the select to the blank state.

- When `allow_blank=True`, `clear()` sets the value to `Select.NULL` and `is_blank()` returns `True`.
- When `allow_blank=False`, `clear()` raises `InvalidSelectValueError`.

### Changed Message

`Select.Changed` is posted when the selected value changes.

- Selecting an option (via click or programmatic assignment) posts exactly one `Select.Changed` message.
- Selecting the same option that is already selected does not post a message.
- `Select.Changed.control` references the `Select` widget that sent the message.

### Empty State

A `Select` can be constructed with an empty options list, or have its options cleared via `set_options([])`.

- When `allow_blank=True`, an empty options list is accepted and the select is blank.
- When `allow_blank=False`, constructing with an empty list or calling `set_options([])` raises `EmptySelectError`.

### Prompt

The `prompt` parameter sets the text displayed when the select is blank.

- `prompt` is reactive: changing it updates both the current display label and the overlay's blank option immediately.
- When `allow_blank=False`, changing `prompt` has no visible effect because the display always shows the selected option's label, not the prompt.

### Option Removal

A `Select` widget can be removed from the DOM during a value change handler without error.

## Constraints

- A value that does not match any current option (and is not `Select.NULL`) always raises `InvalidSelectValueError`, both at construction time and on later assignment.
- `clear()` and assigning `Select.NULL` are forbidden when `allow_blank=False` (raises `InvalidSelectValueError`).
- An empty options list is forbidden when `allow_blank=False` (raises `EmptySelectError`).
- `set_options()` always resets the value: to blank when `allow_blank=True`, to the first new option when `allow_blank=False`.
- `Select.Changed` is posted at most once per distinct value transition; duplicate selections are suppressed.
