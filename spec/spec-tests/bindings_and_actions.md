# Bindings and Actions

## Overview

Textual's binding system connects keyboard input to actions. Bindings are declared on App, Screen, and Widget classes via the `BINDINGS` class variable. Actions are string-encoded method calls that get dispatched through the DOM hierarchy. Keymaps allow end-user remapping of bindings at runtime without changing application code.

---

### Binding Declaration

A `Binding` associates one or more keys with an action string and a human-readable description. Multiple keys can map to the same action using a comma-separated string (e.g., `"a,b"`). Whitespace around keys in the comma-separated list is stripped.

Bindings can be declared as `Binding` objects or as tuples of 2 or 3 elements (key, action) or (key, action, description). Tuples with fewer than 2 or more than 3 elements raise `BindingError`.

A binding with an empty or all-comma key string (e.g., `",,,"`or `", ,"`) raises `InvalidBinding` at class definition time.

Each `Binding` has the following fields:
- **key**: comma-separated key string
- **action**: action string to invoke
- **description**: human-readable label
- **show**: boolean controlling visibility in the footer (defaults to true); `shown_keys` on `BindingsMap` returns only bindings where `show` is true
- **priority**: boolean controlling dispatch order (see Binding Inheritance below)
- **id**: optional string identifier used by the keymap system

### BindingsMap

`BindingsMap` is the runtime container for bindings. It normalizes comma-separated key strings into individual key entries. Looking up a key that has no binding raises `NoBinding`.

`BindingsMap.merge` combines multiple maps. When two maps bind the same key, the merged result contains both bindings for that key (a list), preserving order (left map entries first, then right map entries).

---

### Action Strings

Action strings are parsed by `textual.actions.parse` into a namespace, action name, and argument tuple.

- A bare name like `"spam"` parses to namespace `""`, name `"spam"`, args `()`.
- Parentheses invoke with arguments: `"another_action(1)"` yields args `(1,)`.
- Dotted prefixes denote namespace: `"foo.bar.baz(3, 3.15, 'Python')"` yields namespace `"foo.bar"`, name `"baz"`.
- Arguments support Python literals: booleans, None, integers, floats, strings, lists, and nested tuples.
- Strings containing special characters like parentheses are handled correctly when quoted.
- Malformed action strings (e.g., `"foo(,,,,,)"`, `"bar(1 2 3 4 5)"`, unbalanced parens) raise `ActionError`.

The `app.` namespace prefix dispatches the action to the App instance (e.g., `"app.record('x')"` calls `action_record("x")` on the App).

---

### Binding Inheritance and Priority

Bindings propagate through the widget hierarchy: focused widget, then parent widgets, then screen, then app. When a key is pressed, the framework walks this chain looking for a matching binding.

**Default dispatch (no priority):** When no binding in the chain is marked `priority=True`, the focused widget's binding wins. If the focused widget has no binding for that key, the key bubbles up through parent widgets, then to the screen, then to the app.

**Priority dispatch:** A binding with `priority=True` is checked before non-priority bindings lower in the hierarchy. Among priority bindings, the app is checked first, then the screen, then the widget. Specifically:

| App Priority | Screen Priority | Widget Priority | Winner |
|---|---|---|---|
| No | No | No | Widget |
| Yes | No | No | App |
| No | Yes | No | Screen |
| No | No | Yes | Widget |
| Yes | Yes | No | App |
| Yes | No | Yes | App |
| No | Yes | Yes | Screen |

**Hard-coded app bindings:** An app with no `BINDINGS` declared still has hard-coded bindings for `ctrl+q`, `ctrl+c`, and `ctrl+p`. The `ctrl+q` binding has `priority=True`.

**Screen bindings:** Screens can declare their own `BINDINGS`. When a focused child widget has no binding for a key, the key reaches the screen. A non-scrolling container between the widget and the screen does not consume the key.

**`inherit_bindings`:** Setting `inherit_bindings=False` on a widget class prevents that widget from inheriting bindings from its parent classes in the MRO. However, keys the widget does not handle still bubble up through the DOM to the screen and app. This is true regardless of whether the widget declares `BINDINGS = []` (empty) or omits `BINDINGS` entirely.

**SkipAction:** An action handler can raise `SkipAction` to decline handling a binding. The framework then continues walking the hierarchy as if the binding did not exist on that node. The action handler is still called (side effects before the raise execute), but the binding is treated as unhandled and the next matching binding in the chain fires.

---

### Dynamic Bindings

The `check_action` method on any DOM node controls whether a binding is active at runtime. It receives the action name and its parameters and returns:

- `True`: the binding is enabled and shown in the footer.
- `False`: the binding is disabled and hidden from the footer. The key press is consumed (not bubbled).
- `None`: the binding is disabled and hidden. The key press is consumed.

Both `False` and `None` prevent the action from executing and prevent the key from bubbling further. This enables contextual enabling/disabling of bindings without modifying the `BINDINGS` list.

---

### Keymap Configuration

Keymaps let users remap binding keys at runtime using binding IDs. A keymap is a `dict[str, str]` mapping binding IDs to new comma-separated key strings.

**Binding IDs:** A `Binding` can have an `id` field (e.g., `Binding(key="i,up", action="increment", id="app.increment")`). The keymap references this ID to remap the binding's key.

**`set_keymap`:** Replaces the entire keymap. Fires the `bindings_updated_signal` on the active screen each time it is called, even if the keymap content is identical.

**`update_keymap`:** Merges new mappings into the existing keymap without removing previous entries.

**Key normalization:** Special characters in keymap values are normalized to named tokens (e.g., `"?"` becomes `"question_mark"`, `"$"` becomes `"dollar_sign"`, `" "` (space) stays `"space"`).

**Unknown IDs:** A keymap entry whose ID does not match any declared binding is silently ignored (no error, no effect).

**Keymap overrides original keys:** When a keymap remaps a binding, the original keys are deactivated. Only the new keys trigger the action.

**Inheritance with shared IDs:** When a parent widget and a child widget both declare a binding with the same `id`, a keymap entry for that ID remaps the binding on both parent and child. The original key is deactivated on both.

**Inheritance with different IDs:** When a parent and child use different IDs for their bindings (even if they share the same default key), a keymap entry only affects the binding whose ID matches. The child retains its original key if its ID is not in the keymap.

**Clash detection:** When a keymap causes two bindings on the same node to share a key, the framework calls `handle_bindings_clash` on the app with the set of clashed bindings and the affected node.

**Pre-mount usage:** `update_keymap` can be called in `__init__` before the app is mounted. The keymap takes effect once the app starts.

---

### Click Actions in Markup

The `@click` meta syntax in Rich markup associates click handlers with text. Various parameter forms are supported:

- `[@click=]text[/]` — Empty action: clicking does nothing (no error raised).
- `[@click=()]text[/]` — Empty parentheses: clicking does nothing (no error raised).
- `[@click=foobar]text[/]` — Unknown action without parentheses: clicking does nothing (action silently ignored).
- `[@click=foobar()]text[/]` — Unknown action with parentheses: clicking does nothing (action silently ignored).
- `[@click=app.action_name]text[/]` — Known action without parentheses: calls the action method with default arguments.
- `[@click=app.action_name()]text[/]` — Known action with empty parentheses: calls the action method with default arguments.
- `[@click=app.action_name(value)]text[/]` — Known action with parameter: calls the action method with the given argument.

### System Commands and the Command Palette

The `ctrl+p` hard-coded binding opens the command palette. Apps can extend the command palette by overriding `get_system_commands` and yielding `SystemCommand` instances. Each `SystemCommand` has a title, help text, and a callable that is invoked when the command is selected.

- `get_system_commands` should call `super().get_system_commands(screen)` to include built-in commands, then yield additional `SystemCommand` instances.
- When a system command invokes an action that pushes a modal screen (e.g., via `push_screen(ModalScreen, callback)`), the modal functions correctly: the dismiss callback fires when the modal is dismissed.

---

## Constraints

- A binding key string must contain at least one non-empty key; `",,,"`and `", ,"` are rejected with `InvalidBinding` at class definition time.
- Binding tuples must have exactly 2 or 3 elements; otherwise `BindingError` is raised.
- Action strings must be syntactically valid Python-like expressions; malformed strings raise `ActionError`.
- `NoBinding` is raised when looking up a key that has no binding in a `BindingsMap`.
- `check_action` returning `False` or `None` both suppress the action and consume the key press.
- `SkipAction` only affects the current node's handling; the framework continues searching the hierarchy.
- Keymap entries with unrecognized binding IDs are silently ignored.
- `set_keymap` always emits `bindings_updated_signal`, even when called with the same keymap values.
- Keymap remapping deactivates the original keys; there is no way to keep both old and new keys active through the keymap system alone.
- `inherit_bindings=False` prevents MRO-based binding inheritance but does not prevent key bubbling through the DOM hierarchy.
- Click actions with empty, malformed, or unknown action strings must silently do nothing — they must not raise exceptions or crash the app. Only recognized actions on valid targets are dispatched.
