# Input, Bindings, Actions, and Command System

## Binding Model

`textual.binding.Binding` is a frozen dataclass mapping a key to an action string with metadata:

- `key` (single key or comma-separated list), `action`, `description`,
- display controls: `show` (footer visibility; forced to `False` when `description` is empty), `key_display` (overrides `App.get_key_display`; ignored when a keymap rewrites the binding), `tooltip`,
- `priority` flag (see dispatch ordering),
- `system` flag (hides from the key panel),
- optional globally-addressable `id` for keymap overrides,
- optional `group` (`Binding.Group(description, compact)`) for grouped footer rendering.

`Binding.make_bindings(iterable)` accepts `Binding` instances or `(key, action)` / `(key, action, description)` tuples, expands comma-separated key lists into one `Binding` per key, strips whitespace, raises `InvalidBinding` on empty keys, raises `BindingError` on malformed tuples, and promotes single printable characters to their long-form key name via `keys._character_to_key`.

`Binding.with_key(key, key_display=None)` returns a copy with the key replaced (used by keymap application, which always clears `key_display`).

### BindingsMap

`BindingsMap` stores `key_to_bindings: dict[str, list[Binding]]` (same key may have multiple bindings). It supports:

- construction from any `BindingType` iterable (dispatches through `Binding.make_bindings`),
- `from_keys`, `copy`, iteration over `(key, binding)` pairs,
- `bind(keys, action, ...)` for late/programmatic additions,
- `get_bindings_for_key(key)` raising `NoBinding` when absent,
- `shown_keys` (bindings with `show=True`),
- `merge(iterable[BindingsMap])` — flat concatenation of per-key lists across maps. Merge is list-preserving; precedence is determined by the caller's iteration order at dispatch time, not by merge.

### Keymap application

`BindingsMap.apply_keymap(keymap)` rewrites bindings in place:

- only bindings whose `id` appears in `keymap` are eligible; others are untouched,
- for each matching binding the old key entry is removed and one new `Binding` is inserted for every key in the (comma-separated) override string, produced via `with_key` (so `key_display` is reset to `None`),
- if an override key is already bound (by default or by a previous override that is not itself being rebound) the pre-existing bindings are collected into a `KeymapApplyResult.clashed_bindings` set and removed,
- returns `KeymapApplyResult(clashed_bindings)`.

`Screen._binding_chain` invokes `apply_keymap` on each namespace's bindings when `App._keymap` is non-empty and forwards clashes to `App.handle_bindings_clash(clashed_bindings, node)` (default implementation is a no-op, intended for subclass override).

## Keymap Override API

`App.set_keymap(keymap)` replaces `App._keymap`; `App.update_keymap(keymap)` merges into it. Both normalize incoming key strings through `_normalize_keymap` (long-form names, e.g. `"question_mark"` not `"?"`) and then call `refresh_bindings()`.

## Binding Chains and Dispatch Order

Binding resolution happens on every `events.Key` delivered to `App.on_event`:

1. If a widget is maximized and `App.escape_to_minimize` is true, `escape` minimizes and the event is consumed before binding dispatch.
2. `App._check_bindings(event.key, priority=True)` runs — this walks `reversed(screen._binding_chain)` (App → Screen → … → focused) and fires only bindings whose `priority` flag is `True`.
3. If not handled, the event is forwarded to `self.focused or self.screen` via `_forward_event`, which bubbles through the DOM. When the bubble reaches a node whose `_on_key` runs, `Widget._on_key` calls `App._check_bindings(event.key, priority=False)` — this walks `screen._modal_binding_chain` (focused → … → nearest modal ancestor inclusive) and fires non-priority bindings. If nothing handles it, `dispatch_key(self, event)` is called.

### Binding chain construction

`App._binding_chain`:

- if `self.focused is None`: `[(screen, screen._bindings), (app, app._bindings)]`,
- otherwise: `[(node, node._bindings) for node in focused.ancestors_with_self]` (focused-first, ending at the App).

`Screen._binding_chain` is the same list after each namespace's bindings have had `apply_keymap(app._keymap)` applied (clashes reported to `handle_bindings_clash`).

`Screen._modal_binding_chain` truncates the chain at the nearest ancestor with `is_modal=True` (inclusive), so modal screens contain their bubble.

`Screen.active_bindings` walks `_modal_binding_chain` and produces the de-duplicated `dict[key, ActiveBinding]` used by the Footer/key panel. Within a key, the first binding encountered wins unless a later binding has `priority=True` and the incumbent does not, in which case priority replaces it. Each candidate is filtered through `App._check_action_state` which delegates to the owning node's `check_action(action, params)`:

- `True` → binding included and enabled,
- `None` → binding included but disabled (grayed-out in footer),
- `False` → binding omitted entirely.

## Action Parsing and Dispatch

### Parse format

`textual.actions.parse(action)` (LRU-cached) returns `(namespace, action_name, params)`:

- bare action: `"quit"` → `("", "quit", ())`,
- call form: `"focus('input')"` → `("", "focus", ("input",))` (arguments parsed with `ast.literal_eval` after being wrapped as a trailing-comma tuple so a single tuple argument is disambiguated from a comma-separated list),
- dotted namespace: `"app.quit"`, `"screen.dismiss()"` → namespace is the dotted prefix before the final segment.
- malformed argument lists raise `ActionError`.

`SkipAction` (raised inside an action method) tells dispatch to treat the action as not handled so bubbling bindings can run.

### Dispatch flow

`App.run_action(action, default_namespace=None, namespaces=None)`:

1. `_parse_action` turns the string (or pre-parsed tuple) into `(action_target, action_name, params)`. The target is chosen by:
   - explicit `namespaces` mapping if it contains the namespace,
   - otherwise a namespace name must be in `App._action_targets` (`{"app", "screen", "focused"}`) and is resolved via `getattr(self, namespace)`; unknown namespaces raise `ActionError`,
   - no namespace → `default_namespace` (or `self` when `None`).
2. `action_target.check_action(action_name, params)` gates execution. A falsy/`None` return aborts and `run_action` returns `False`.
3. `_dispatch_action` looks up `_action_<name>` first, then `action_<name>`, and `invoke`s the first callable found with `*params`. Returns `True` on successful invocation, `False` if neither method exists. `SkipAction` raised by the method is caught and reported as not handled.

// [LAW:single-enforcer] Action parse and dispatch behavior is centralized in `actions.parse` + `App._parse_action` / `App.run_action` / `App._dispatch_action`. Binding evaluation is centralized in `App._check_bindings` and `Screen.active_bindings`.

## Key Name Normalization and Aliases

`textual.keys` owns the name space:

- `KEY_NAME_REPLACEMENTS` maps punctuation/short names (e.g. `?` → `question_mark`) to canonical long forms. `_xterm_parser` applies this when emitting keys so the binding layer only ever sees canonical names.
- `_character_to_key` (used by `Binding.make_bindings`) promotes single printable characters to their canonical name so `("?", "help")` and `("question_mark", "help")` are equivalent.
- `events.Key.name_aliases` (via `keys._get_key_aliases`) expands the canonical key into the ordered list of handler method suffixes that `dispatch_key` will try.

## Widget-Level Key Handler Dispatch

`dispatch_key(node, event)` (`textual._dispatch_key`) is the fallback after binding resolution:

- returns `False` immediately if `event.name` is empty,
- iterates `event.name_aliases` and for each alias looks up `key_<alias>` then `_key_<alias>` on the node,
- if more than one alias resolves to a handler, raises `DuplicateKeyHandlers`,
- aborts without invoking when the owning screen is no longer active,
- a handler returning `False` explicitly is treated as *not handled* so the event continues to bubble; any other return value (including `None`) counts as handled.

Widget key path: `Widget._on_key → Widget.handle_key → dispatch_key(self, event)`. Widgets can override bindings, implement `check_consume_key(key, character)` to claim raw keys before binding dispatch (used by `Screen._forward_event` to short-circuit input-capturing widgets), and define `key_*` / `action_*` methods.

## Brokered Style-Meta Event Actions

`App._broker_event(event_name, event, default_namespace)` lets click/hover actions be attached to styled content:

- reads `event.style.meta`, extracts `(modifiers, action)` via `_event_broker.extract_handler_actions`, stops the event on success,
- a string action is dispatched through `run_action`,
- a `(action_name, params)` tuple re-parses the name through `actions.parse` and dispatches with the externally supplied `params`,
- malformed tuples log a warning in debug mode and return `False`.

## Command Palette Architecture

Core types in `textual.command`:

- `Hit` (scored, with `match_display`, `command`, `text`, `help`) and `DiscoveryHit` (unscored, ordered by provider yield order),
- `Hits = AsyncIterator[Hit | DiscoveryHit]`,
- abstract `Provider` plus `SimpleProvider` / `SimpleCommand` for lightweight callers,
- `CommandPalette` (a `SystemModalScreen`), its `CommandInput` and `CommandList` widgets.

### Provider contract

- constructed with `(screen, match_style)`; exposes `screen`, `app`, `focused`, `match_style`, and `matcher(user_input, case_sensitive=False)` that returns a `fuzzy.Matcher`,
- optional async `startup()` and `shutdown()` (wrapped in `_post_init` / `_shutdown` which log exceptions via `rich.traceback`),
- abstract `async search(query)` for typed search,
- optional `async discover()` for empty-query defaults,
- `_search(query)` awaits init, then dispatches to `discover()` when `query` is empty and `search()` otherwise, and gates all output on `_init_success`; hits equal to `NotImplemented` are filtered out.

### CommandPalette runtime

- provider set resolved from an explicit argument, else `Screen.COMMANDS` ∪ `App.COMMANDS` (`App.COMMANDS` defaults to `{get_system_commands_provider}`),
- `App.ENABLE_COMMAND_PALETTE` gates availability; `App.COMMAND_PALETTE_BINDING` (default `ctrl+p`) and `App.COMMAND_PALETTE_DISPLAY` define its launch key (added as a priority binding during App init),
- results gathered concurrently under `@work(exclusive=True, group=...)` and streamed into the option list in batches sized by `_RESULT_BATCH_TIME`,
- busy and no-match indicators are driven by timers,
- emits `Opened`, `Closed`, and option-highlight messages.

### System commands provider

`SystemCommandsProvider` (`textual.system_commands`) drives both `discover()` and `search()` from `App.get_system_commands(screen)`. Each `SystemCommand` carries `(name, help_text, callback, discover)`; `discover()` yields only commands whose `discover` flag is true, and `search()` fuzzy-matches all of them via `Provider.matcher`. Subclasses override `App.get_system_commands` to add/remove entries.

## Built-in App-Level Input Actions

`App` ships default action methods including (non-exhaustive): `action_quit`, `action_bell`, `action_focus`, `action_focus_next` / `action_focus_previous`, `action_switch_screen`, `action_push_screen`, `action_pop_screen`, `action_switch_mode`, `action_back`, `action_add_class` / `action_remove_class` / `action_toggle_class`, `action_change_theme`, `action_toggle_dark`, `action_screenshot`, `action_notify`, `action_show_help_panel` / `action_hide_help_panel`, `action_command_palette`, `action_simulate_key`, `action_suspend_process`, and `action_help_quit` (the ctrl+C hint that surfaces the real quit binding via `active_bindings`).

## Input Event Routing Summary

- Driver emits low-level `events.InputEvent` instances into `App.on_event`.
- Non-forwarded `MouseEvent`s update `App.mouse_position`, drive click-chain detection, and are forwarded via `screen._forward_event`; click synthesis matches `MouseUp` to the widget under the original `MouseDown` with chain counting gated by `CLICK_CHAIN_TIME_THRESHOLD`.
- Non-forwarded `Key` events run priority bindings, then forward to `self.focused or self.screen`.
- Non-forwarded `Paste` events are forwarded directly to the focused widget (or screen).
- `Widget`'s disabled state suppresses most mouse interactions except scroll-wheel pass-through (enforced inside `_forward_event`).
