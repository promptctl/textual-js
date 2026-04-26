# Docs Spec: API — Command Palette

## Purpose
Describes the API reference doc for the command module: the CommandPalette screen, the Provider base class, the Hit and DiscoveryHit records, the SimpleProvider convenience, and related types for the command palette subsystem.

## Audience
Application authors adding custom commands or providers, widget authors exposing actions through the palette, and framework extenders integrating search providers.

## Required sections
1. Overview of the command palette and its role (fuzzy-search entry point for app actions).
2. Type aliases: Hits (async stream of results), ProviderSource (a list of provider classes or lazy provider factories), CommandListItem (the shape accepted by the simple provider).
3. Hit: result record for a search match — score, display, command callback, text, help; ordering by score.
4. DiscoveryHit: result record for the pre-input discovery list — display, command, text, help; ordering by text; score always zero.
5. Provider base class: the contract to implement custom providers (constructor receives the active screen and an optional match style; subclasses implement `search`, optionally `discover`, optionally `startup`, and optionally `shutdown`).
6. Provider utilities: creating a fuzzy matcher for user input, with case-sensitivity control.
7. Provider properties surfaced for convenience: focused widget, active screen, app, preferred match style.
8. SimpleProvider: a ready-made provider that accepts a list of commands directly (each item either a SimpleCommand record or a `(name, callback)` / `(name, callback, help)` tuple).
9. SimpleCommand: name, callback, optional help text.
10. Command list and command input widgets used internally by the palette (usually not constructed directly).
11. Search icon widget (with a reactive icon property).
12. CommandPalette screen: how to open it (default binding on the app), placeholder text, default bindings (cursor navigation, jump to first/last, page up/down, escape to close).
13. CommandPalette class-level options: auto-focus the input, run-on-select behavior.
14. Component CSS classes for styling match highlights and help text.
15. Static "is this palette open" helper and the messages emitted to the app (opened, closed with selection flag, option highlighted).

## Key concepts
- A provider yields hits asynchronously; the palette streams results into the list as they arrive, with batching and a delayed "busy" indicator.
- Providers are constructed once per palette open and can perform async startup/shutdown.
- Discovery hits are shown when the query is empty; search hits are shown (and ranked by score) once the user types.
- The App class-level provider list and the Screen class-level provider list combine to form the default provider source.
- The fuzzy matcher used by providers is supplied by the framework (backed by uFuzzy in textual-js).

## Behaviors and contracts
- The palette is a modal screen; opening it pushes a dedicated screen onto the stack.
- Hit ordering by score (descending) drives list position; DiscoveryHit ordering is by text and yield order.
- `run_on_select=true` executes the command immediately on selection; `run_on_select=false` fills the input and waits for a second confirmation.
- Provider `startup` and `shutdown` errors are caught and logged, not propagated.
- The palette emits framework messages for opened, closed (with selection status), and option highlighted; app code may observe them.

## Example requirements
All examples must be JSX/TypeScript using Ink primitives and textual-js APIs:
- Creating a custom Provider subclass that streams hits from an external search (e.g., a project file search).
- Declaring the provider in the App's COMMANDS list.
- Using SimpleProvider to register a static list of `(name, callback)` commands.
- Using the provider-supplied matcher to rank hits and highlight matched spans in the display.
- Listening for palette opened/closed/highlighted messages to drive side effects.

## Cross-references
- `spec/docs-spec/actions_and_bindings.md` (system commands default provider).
- `spec/docs-spec/api_app.md` (App.COMMANDS and default palette binding).
- `spec/docs-spec/api_binding.md` (bindings used by the palette screen).
- `spec/spec-src/06-input-bindings-actions-and-commands.md` (behavioral spec).

## Notes for writers
- Drop Python specifics: ABC, `TypeAlias`, `AsyncIterator`, dataclass, NamedTuple, `@dataclass(order=True)`. Translate to TS: provider is a base class with an async generator `search` method that `yield`s Hit/DiscoveryHit objects (or returns an `AsyncIterable`); Hit and DiscoveryHit are plain records.
- Python ordering via `__lt__`/`__eq__` becomes a documented comparator function or sort key; describe ordering semantically rather than via dunder methods.
- The `SystemModalScreen[None]` generic parameter maps to a TS generic whose return type is `void`/`null`.
- uFuzzy is the backing fuzzy matcher in textual-js; the match style concept still applies (spans that should be highlighted), but describe it in the context of Ink-rendered styled text, not Rich `Style`.
- Internal constants (busy countdown, batching interval, "no matches" delay) are real contracts that affect UX; keep them documented but mark them as "tunable" rather than as Python class attributes.
- Do not mention OptionList/Option as Python-only; the command list widget exists in textual-js and extends the framework's option list widget.
