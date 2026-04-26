# Docs Spec: Command Palette

## Purpose
Describes the Command Palette page — the built-in searchable command launcher, the Provider contract authors implement to contribute commands, and the system-command and discovery mechanisms.

## Audience
App authors who want to expose app-specific commands through the palette, and widget/screen authors who want palette contributions scoped to their screen.

## Required sections
1. Overview — what the palette is, the default key (Ctrl+P, configurable), the single-input UX, fuzzy matching, score-based ordering.
2. Launching and Interaction — key binding, arrow-key navigation, Enter to invoke, live filtering on each keystroke.
3. Command Providers — the Provider contract authors implement; required `search(query)` and optional `startup`, `discover`, `shutdown` hooks.
4. Provider Context — accessors the Provider has to `app`, `screen`, `focused` widget, and `matchStyle` for rendering match highlights.
5. Fuzzy Matcher — obtaining a matcher from the Provider (`matcher(userInput, { caseSensitive })`), scoring (0..1), and highlighting matched characters.
6. Hit and DiscoveryHit — the data shapes returned by `search` and `discover`, their fields, and how the palette consumes them.
7. Hits Type — the iterable/async-iterable contract for `search`/`discover` return values.
8. Registering Providers — at the app level (`COMMANDS` on TextualApp) and at the screen level (`COMMANDS` on Screen).
9. System Commands — the default commands installed by the framework; how to add more via a `getSystemCommands(screen)` override that yields `SystemCommand` entries; the discover flag.
10. Discovery Commands — what runs when the palette opens with no input (system commands with `discover: true` plus Provider `discover()` results). Guidance to keep discover fast.
11. Disabling the Palette — `enableCommandPalette` / runtime toggle.
12. Customising the Key Binding — `commandPaletteBinding` and footer-display string.
13. Error Handling — errors thrown in a provider are logged; one broken provider does not disable the palette.

## Key concepts
- Provider is the extension point; Hit/DiscoveryHit are the data exchange contracts.
- Fuzzy matching is provided by uFuzzy (replacing the Python matcher). Scores 0..1; zero-score hits are discarded.
- Search fires per keystroke; discover fires on open with empty input; the framework routes dispatch.
- `text` is auto-populated from `matchDisplay`/`display` when omitted; it is used for plain-text matching and accessibility.
- Screen-scoped providers are only active while that screen is current.
- The match highlight is rendered with the Provider-supplied `matchStyle` so highlights follow the active theme.

## Behaviors and contracts
- Hits are ordered by score (descending). Discovery hits default to score 0; their order is the yield order.
- `search` and `discover` must be async-iterable (or return an async iterable); they are cancelled if the user keeps typing or closes the palette (cooperative cancellation via a passed signal).
- `startup` runs once per palette open; `shutdown` runs once per palette close. Side effects in `startup` should be cleaned up in `shutdown`.
- Errors in a provider are caught, logged to the console, and do not disable the palette.
- Custom providers are merged with the defaults; to add while keeping defaults, spread the existing `COMMANDS` set with the new provider.
- Disabling the palette causes the open-palette action to be a no-op.

## Example requirements
Describe (do not inline) JSX/TypeScript examples covering:
- Declaring a custom `Provider` class (or object with the required methods) with `search` yielding `Hit` objects whose `command` runs an app action.
- Using the provided `matcher` to score candidates and highlight matched characters.
- A `discover` implementation returning a small set of frequently-used commands.
- Registering a provider at the app level via `COMMANDS` and at the screen level via the screen's `COMMANDS`.
- Overriding `getSystemCommands(screen)` and chaining to the built-in provider to add a Bell command.
- Disabling the palette entirely and changing the binding key.
All examples are JSX/TypeScript using textual-js APIs; no Python.

## Cross-references
- `spec/docs-spec/app.md` — `COMMANDS`, `ENABLE_COMMAND_PALETTE`, `COMMAND_PALETTE_BINDING`, `getSystemCommands`.
- `spec/docs-spec/api_fuzzy_matcher.md` (if present) — the uFuzzy-backed matcher API.
- `spec/spec-src/06-input-bindings-actions-and-commands.md` — bindings, actions, and command subsystem.
- `spec/spec-src/12-supporting-subsystems.md` — palette as a supporting subsystem.

## Notes for writers
- Do not describe Python `async def`, `yield`, `AsyncIterator`, or `NamedTuple`. Use TS idioms: `async function*`, `AsyncIterable<Hit | DiscoveryHit>`, plain object types/interfaces.
- The Python matcher referenced by Provider is replaced by uFuzzy in textual-js; describe the matcher's interface (score + highlight) without referring to Rich `Text`. Matched highlights render via textual-js Content / styled segments.
- Do not refer to Rich renderables. `matchDisplay`/`display` accept strings or Content values (see the Content docs).
- `SystemCommand` translates to a plain object shape `{ title, help, callback, discover? }`, not a NamedTuple.
- Avoid Python-style class inheritance. Provider can be documented as an interface authors implement; framework-provided base behavior (dispatching to `search` vs `discover`) is described in prose, not as inheritance.
- `IgnoreReturnCallbackType` simply means a callback whose return value is ignored; describe it as `() => void | Promise<void>` and drop the Python alias.
