# Docs Spec: Actions and Key Bindings

## Purpose
Describes the doc page that teaches textual-js users how to declare key bindings on the App, Screen, and Widget level, how to define and dispatch actions, and how the command palette's system commands integrate with the binding/action system.

## Audience
Widget authors, application authors, and framework extenders who need to wire keyboard input to behavior and expose commands in the command palette.

## Required sections
1. Overview of actions and bindings (how they connect input to behavior).
2. Declaring actions on a widget, screen, or app (including async actions).
3. Action strings: syntax, parameter parsing, namespaces (`app`, `screen`, `focused`).
4. Running actions programmatically.
5. Actions inside content markup (clickable text runs via the `@click` tag).
6. The built-in actions catalog (quit, bell, focus, push/pop/switch screen, screenshot, etc.).
7. Dynamic actions via a check-action hook (enable/disable/dim) and refreshing footer bindings.
8. Declaring key bindings via the `BINDINGS` class member, including tuple shorthand and full Binding objects.
9. The Binding record: all fields (key, action, description, show, key_display, priority, tooltip, id, system, group).
10. Binding groups and compact display in the Footer.
11. Compound keys (comma-separated) and binding inheritance up the class hierarchy.
12. Priority bindings: how App-down resolution differs from widget-up resolution.
13. ActiveBinding and how the Footer/help panel consumes it.
14. BindingsMap operations: merging, programmatic binding, looking up a key.
15. Keymaps: user-facing remapping by binding id, clash handling.
16. Binding-related error conditions.
17. System commands and the command palette: declaring commands, overriding the system command list, registering providers.

## Key concepts
- Actions are allow-listed callbacks on App/Screen/Widget instances, identified by a naming convention rather than by implicit exposure.
- Action strings are parsed by the framework, not evaluated; only literal parameters (numbers, strings, arrays, objects) are allowed.
- Namespaces (`app.`, `screen.`, `focused.`) route action dispatch to specific hosts.
- BINDINGS on a class declare `key -> action` associations with display metadata.
- Binding inheritance follows the class chain; subclasses can override a key or opt out of inherited bindings entirely.
- Priority bindings invert resolution order (App-first vs. focused-widget-first).
- Keymaps let end users remap keys by binding id without touching source.
- System commands surface in the command palette via a default provider; apps may extend the list.

## Behaviors and contracts
- Action dispatch never uses `eval` or arbitrary code execution; only literal-argument parsing is supported.
- Normal bindings resolve from the focused widget outward to Screen then App; priority bindings resolve from App inward.
- When a binding's check-action hook returns "disabled", the key must still appear in the Footer but be rendered dimmed; when it returns "unavailable", the key must be hidden.
- Refreshing bindings must be automatic when a reactive attribute marked as affecting bindings changes; otherwise a manual refresh API is required.
- A binding with a comma-separated key string expands to multiple binding records sharing one action.
- Applying a keymap must report any clashes (bindings displaced by a key reassignment).
- Providing an invalid binding tuple or empty key must raise a framework error, not silently no-op.

## Example requirements
All examples must be JSX/TypeScript, using Ink primitives and the textual-js React API:
- A TextualApp subclass (or functional equivalent) declaring BINDINGS with a mix of tuples and full Binding objects, and an action handler method.
- A widget with an action method invoked via a `@click` tag embedded in its content.
- An example of the check-action hook returning values that enable/disable/hide a binding.
- An example of declaring priority bindings and explaining when they override widget bindings.
- An example of contributing a custom system command via the app's system-commands hook.
- An example of applying a keymap at runtime (user remap by binding id).

## Cross-references
- `spec/docs-spec/api_binding.md` (Binding record, BindingsMap, Keymap API surface).
- `spec/docs-spec/api_command.md` (command palette, providers, hits).
- `spec/docs-spec/api_app.md` (App BINDINGS defaults, `get_system_commands`).
- `spec/spec-src/06-input-bindings-actions-and-commands.md` (behavioral spec).

## Notes for writers
- Do not carry across Python-specific mechanics: no `async def`, no decorators, no `action_<name>` method prefix. In textual-js, actions are declared as methods on the class whose names are matched by the action router; describe this in TypeScript terms (e.g., a typed action map or method name convention the framework uses).
- Tuple shorthand in `BINDINGS` is valid in both languages; keep it.
- The dynamic-actions "return None" tri-state in Python becomes an enum or discriminated-union return in TS; describe it as "available | disabled | hidden".
- System commands are real in textual-js (command palette exists via uFuzzy); document them against that subsystem, not against Python iterables.
- Avoid any mention of asyncio, `coroutine`, or Python exception class names; use JS `Error` subclasses (e.g., `BindingError`) by name only.
