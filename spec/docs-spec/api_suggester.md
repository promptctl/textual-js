# Docs Spec: Suggester (auto-completion for Input)

## Purpose
Document the auto-completion suggestion system: the `Suggester` contract, the built-in list-backed suggester, and how completions are delivered to an `Input` widget.

## Audience
Application authors wiring auto-complete into forms, and widget authors writing custom suggesters (API-backed, fuzzy, async, etc.).

## Required sections
1. Overview (what a suggester is, where it plugs in, how results reach the input)
2. `Suggester` contract (shape, options, abstract `getSuggestion` method)
3. Caching behavior and when to disable it
4. Case sensitivity and casefolding rules
5. Built-in `SuggestFromList` (constructor, priority order, case sensitivity default)
6. Delivery message (`SuggestionReady`) — fields and how widgets react to it
7. Wiring into an `Input` widget (prop usage in JSX)
8. Writing a custom suggester (async data source, error handling)

## Key concepts
- A suggester is a pluggable strategy object. It receives the current input value and returns a suggested completion string (or nothing).
- Results are delivered asynchronously; the input posts a `SuggestionReady` message carrying both the original value and the suggested completion.
- Built-in caching keyed by normalized input value; non-deterministic suggesters must opt out.
- Case-sensitivity flips whether the input and candidates are normalized (lowercased) before comparison; returned strings always preserve original casing.
- `SuggestFromList` defaults to case sensitive — different from the base contract's default.

## Behaviors and contracts
- `getSuggestion` must be idempotent for a given input unless caching is disabled.
- The returned suggestion should start with (or otherwise logically extend) the input value so the input can render the tail as a ghost completion.
- Only the first match wins when multiple candidates qualify; list order expresses priority.
- The suggester never mutates the input directly — it only produces a string; the input widget decides how to present it.
- Case-insensitive matching preserves the candidate's original casing in the returned string.
- Errors from a custom async suggester must not crash the app; the doc should describe how they surface.

## Example requirements
All examples are JSX/TypeScript. The doc must include:
- Using `SuggestFromList` with a static list, passed as a prop to `<Input>`.
- Writing a custom async suggester that queries a remote service (with caching disabled).
- Handling `SuggestionReady` in a component that wraps `<Input>` with `observer()`.
- Demonstrating the difference in behavior when case-sensitive is on vs off.

## Cross-references
- `spec/docs-spec/api_widget.md` (how messages are posted/received)
- `spec/docs-spec/api_message.md`
- `spec/docs-spec/api_fuzzy_matcher.md` (alternative matching strategy for command palette)
- Widget catalog entry for `Input` (in `spec/spec-src/10-widget-catalog.md`)

## Notes for writers
- Do not describe Python abstract base classes; present the contract as a TypeScript interface or class with one async method to implement.
- Drop `async` keyword talk specific to Python's `async def` — describe as "returns a Promise of string or undefined".
- Casefolding in JS uses `String.prototype.toLowerCase()` / `toLocaleLowerCase()`; do not replicate Python's `str.casefold` nuances unless they materially affect behavior.
- Keep `SuggestionReady`'s default case-sensitivity inconsistency explicit — it's a real pitfall.
