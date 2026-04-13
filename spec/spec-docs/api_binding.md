# textual.binding

This module contains the `Binding` class and related objects for key binding configuration.

## Type Aliases

- `BindingType` -- `Binding | tuple[str, str] | tuple[str, str, str]` -- The possible types of a binding found in the `BINDINGS` class variable. Tuples map positionally to `(key, action)` or `(key, action, description)`.
- `BindingIDString` -- `str` -- The ID of a Binding defined somewhere in the application. Corresponds to the `id` parameter of the `Binding` class.
- `KeyString` -- `str` -- A string representing a key binding (e.g. `"x"`, `"ctrl+i"`, `"ctrl+shift+a"`, `"ctrl+j,space,x"`).
- `Keymap` -- `Mapping[BindingIDString, KeyString]` -- A mapping of binding IDs to key strings, used for overriding default key bindings.

## Exceptions

### BindingError

General binding-related error.

### NoBinding

Raised when a binding was not found.

### InvalidBinding

Raised when a binding key is in an invalid format.

## Binding

`Binding` is a frozen dataclass representing the configuration of a key binding.

### Fields

- `key: str` -- Key to bind. Can be a comma-separated list of keys to map multiple keys to a single action.
- `action: str` -- Action to bind to.
- `description: str = ""` -- Description of the action.
- `show: bool = True` -- Show the action in Footer, or `False` to hide.
- `key_display: str | None = None` -- How the key should be shown in the footer. If `None`, uses `App.get_key_display`. Ignored if overridden in a keymap.
- `priority: bool = False` -- Enable priority binding for this key.
- `tooltip: str = ""` -- Optional tooltip to show in footer.
- `id: str | None = None` -- ID of the binding. Intended to be globally unique (not enforced). Used for keymap lookup: if specified in the App's keymap, Textual substitutes the `key` property with the key from the keymap.
- `system: bool = False` -- Make this binding a system binding, which removes it from the key panel.
- `group: Binding.Group | None = None` -- Optional binding group (used to group related bindings in the footer).

### Binding.Group

A frozen dataclass nested inside `Binding`. Groups related bindings under a single description in the footer.

#### Fields

- `description: str = ""` -- Description of the group.
- `compact: bool = False` -- Show keys in compact form (no spaces).

### Methods

- `parse_key() -> tuple[list[str], str]` -- Parse the key string into a list of modifiers and the actual key. Splits on `+`.
- `with_key(key: str, key_display: str | None = None) -> Binding` -- Return a new Binding with the key and key_display replaced. Uses `dataclasses.replace`.

### Class Methods

- `make_bindings(bindings: Iterable[BindingType]) -> Iterable[Binding]` -- Convert an iterable of `BindingType` (tuples or Binding instances) into individual `Binding` instances. Compound bindings like `"j,down"` are expanded into separate Binding instances (one per key). Empty keys raise `InvalidBinding`. Single-character keys are normalized via `_character_to_key`. The `show` field is set to `True` only if both `description` is non-empty and `show` is `True`.

## ActiveBinding

`ActiveBinding` is a `NamedTuple` representing information about an active binding (returned from `Screen.active_bindings`).

### Fields

- `node: DOMNode` -- The node where the binding is defined.
- `binding: Binding` -- The binding information.
- `enabled: bool` -- Whether the binding is enabled. Disabled bindings are typically rendered dim.
- `tooltip: str = ""` -- Optional tooltip shown in Footer.

## BindingsMap

`BindingsMap` manages a set of bindings. Decorated with `@rich.repr.auto`.

### Constructor

`BindingsMap(bindings: Iterable[BindingType] | None = None)`

Initializes the map from an iterable of `BindingType`. Internally uses `Binding.make_bindings` to expand tuples and compound keys.

### Attributes

- `key_to_bindings: dict[str, list[Binding]]` -- Mapping of key strings (e.g. `"ctrl+a"`) to lists of `Binding` objects for that key.

### Methods

- `bind(keys: str, action: str, description: str = "", show: bool = True, key_display: str | None = None, priority: bool = False) -> None` -- Bind keys to an action. `keys` can be a comma-separated list. Each key gets its own Binding entry. The `show` flag is set to `True` only if `description` is non-empty and `show` is `True`.
- `get_bindings_for_key(key: str) -> list[Binding]` -- Get the list of bindings for a given key. Raises `NoBinding` if the key is not found.
- `copy() -> BindingsMap` -- Return a shallow copy.
- `apply_keymap(keymap: Keymap) -> KeymapApplyResult` -- Replace bindings for keys present in the keymap. Preserves existing bindings for keys not in the keymap. Handles clashes: if a keymap reassigns a key that already has a different binding, the clashed binding is recorded. Returns a `KeymapApplyResult`.

### Class Methods

- `from_keys(keys: dict[str, list[Binding]]) -> BindingsMap` -- Construct a BindingsMap directly from a dict of keys to binding lists (bypasses `make_bindings` expansion).
- `merge(bindings: Iterable[BindingsMap]) -> BindingsMap` -- Merge multiple BindingsMap instances into one. Keys from later maps extend (not replace) bindings for the same key.

### Properties

- `shown_keys -> list[Binding]` -- A list of bindings where `show` is `True`.

### Iteration

Iterating over a `BindingsMap` yields `(key: str, binding: Binding)` tuples, expanding multi-binding keys.

## KeymapApplyResult

`KeymapApplyResult` is a `NamedTuple` representing the result of applying a keymap.

### Fields

- `clashed_bindings: set[Binding]` -- Bindings that were clashed and replaced by the keymap.
