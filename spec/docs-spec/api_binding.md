# Docs Spec: API — Binding

## Purpose
Describes the API reference doc for the binding module: the Binding record, binding groups, the BindingsMap container, keymap application, ActiveBinding, and related error types.

## Audience
Widget authors, application authors, and framework extenders who declare key bindings, manage them programmatically, or implement user-facing keymap overrides.

## Required sections
1. Overview of the binding types and how they fit with actions.
2. Type aliases: BindingType, BindingIDString, KeyString, Keymap.
3. Binding errors: the general binding error, the "no binding" lookup error, and the invalid-key-format error.
4. The Binding record: full field catalog (key, action, description, show, key_display, priority, tooltip, id, system, group) with defaults and meaning.
5. Binding.Group: fields (description, compact) and how grouped bindings display in the Footer.
6. Binding operations: parsing a key string into modifiers plus the terminal key, and returning a copy with a replaced key/display.
7. Expanding a binding iterable (tuples or full records) into individual Binding records, including compound-key expansion (comma-separated keys) and how the `show` flag interacts with description emptiness.
8. ActiveBinding: the tuple surfaced by the current screen for Footer/help-panel rendering (node, binding, enabled, tooltip).
9. BindingsMap: internal container for a node's bindings — constructor, key-to-bindings storage, programmatic bind, get-bindings-for-key (and its failure mode), copy, keymap apply, shown-keys, and iteration semantics.
10. Class methods on BindingsMap: constructing from a raw dict, merging multiple maps.
11. KeymapApplyResult: the set of bindings clashed by a keymap application.

## Key concepts
- Binding is an immutable value; copy-with-changes is the modification pattern.
- A single key string may be a compound (comma-separated) list that expands to multiple records sharing one action.
- Groups let related bindings collapse into a single Footer entry with compact display.
- BindingsMap stores `key -> list<Binding>` because a single key can have multiple bindings from different hosts.
- Keymaps remap keys by binding id; bindings without an id are unaffected.
- Merging multiple BindingsMaps extends (rather than replaces) bindings for the same key.

## Behaviors and contracts
- An empty key string is an invalid binding and must raise an error.
- The `show` flag is effective only when `description` is non-empty; a record with empty description never shows in the Footer even if `show` is true.
- Looking up a key that does not exist must raise the "no binding" error, not return an empty list silently.
- Applying a keymap must preserve bindings for keys not mentioned by the keymap and must report clashes when a key reassignment displaces an existing binding.
- When a keymap overrides a key, the `key_display` reverts to framework-computed (the user-supplied display is ignored).
- `make_bindings` (or its JS equivalent) normalizes single-character keys via the framework's key normalizer.

## Example requirements
All examples must be JSX/TypeScript using Ink primitives and textual-js APIs:
- Declaring BINDINGS with a mix of tuples, full Binding objects, and a grouped set.
- Creating a Binding with `with_key`-style copy to change one field.
- Programmatically adding a binding via a BindingsMap at runtime.
- Iterating bindings to render a Footer listing.
- Applying a Keymap (user remaps) and handling the returned clash set.

## Cross-references
- `spec/docs-spec/actions_and_bindings.md`
- `spec/docs-spec/api_app.md`
- `spec/docs-spec/api_command.md`
- `spec/spec-src/06-input-bindings-actions-and-commands.md`

## Notes for writers
- Python specifics to drop: frozen dataclass, NamedTuple, `dataclasses.replace`, `@rich.repr.auto`. Describe Binding as a plain TS object (typically a readonly record type), and describe copy-with-changes as a spread (`{...binding, key: "…"}`) pattern wrapped behind a helper.
- `get_bindings_for_key` raising `NoBinding` translates cleanly to a function that throws a `NoBindingError`; alternatively the JS API may return `Binding[] | undefined` — document whichever textual-js chose, not the Python signature.
- Keep the BindingsMap concept; it is a framework-internal but user-observable structure.
- The Keymap type (a mapping from binding id to replacement key) carries over verbatim in concept.
- No mention of Python's `Mapping` or `Iterable` abstract base classes; use TS types (`ReadonlyMap<string, string>` and `Iterable<BindingType>`).
