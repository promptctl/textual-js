# Docs Spec: System Commands Source

## Purpose
Document the built-in command-palette provider that surfaces app-wide system commands (toggle theme, quit, etc.) and how apps extend or customize that list.

## Audience
Application authors adding or replacing system commands; framework extenders building alternative palette providers.

## Required sections
1. Overview (what the system commands provider is and where it is installed by default on `TextualApp`)
2. The command palette contract it fulfills (discovery vs. search)
3. How system commands are sourced from the app (hook for providing name, help text, callback, discoverable flag)
4. Default system commands shipped by textual-js
5. Adding or overriding system commands on your app
6. Discoverability flag (browsable in palette vs. searchable only)
7. Relationship with the fuzzy matcher used for scoring search queries

## Key concepts
- System commands are plain records: name, help text, callback, discoverable flag.
- The palette has two entry points: discovery (browsing with no query) and search (filtered by fuzzy match on name).
- The app exposes an extension point for contributing system commands scoped to the active screen.
- The provider is registered by default; apps can remove it or layer additional providers.

## Behaviors and contracts
- Discovery yields only commands whose discoverable flag is true; search yields any command whose name fuzzy-matches the query with a positive score.
- Results for discovery are sorted alphabetically by command name.
- Search results are ordered by fuzzy match score (highest first) and include the highlighted name for rendering.
- Callbacks run in the app's normal event context; errors are routed through the app's exception handler.
- The provider is screen-aware: commands may vary depending on the active screen.

## Example requirements
All examples are JSX/TypeScript. The doc must include:
- Overriding the app's `getSystemCommands` hook to add a custom command.
- Disabling the default provider by replacing the `COMMANDS` list on the app.
- A custom command whose callback toggles a reactive MobX observable.
- A command marked not-discoverable so it appears only when searched by name.

## Cross-references
- `spec/docs-spec/api_command.md` (command palette providers, Hit/DiscoveryHit types)
- `spec/docs-spec/api_fuzzy_matcher.md`
- `spec/docs-spec/api_app.md`
- `spec/spec-src/01-runtime-app-and-lifecycle.md`

## Notes for writers
- Keep it short — this is a default provider; most readers only need to know how to add/remove commands.
- Avoid Python `Provider` subclassing language; describe the provider as a plain object or class conforming to the command-palette provider interface.
- Do not document internal types `Hits` / iterables specific to Python; treat providers as returning arrays/async iterables of hit records.
