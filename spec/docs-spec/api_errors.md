# Docs Spec: Framework Errors

## Purpose
Enumerate the general framework-wide error classes and teach readers when they're thrown and how to handle them.

## Audience
All app authors (for try/catch around framework APIs) and widget/driver extenders.

## Required sections
1. Overview of the framework error hierarchy rooted at `TextualError`.
2. Individual errors:
   - `TextualError` — base class; do not throw directly, catch as a family.
   - `NoWidget` — raised when a named/referenced widget cannot be located.
   - `RenderError` — raised when an object could not be rendered.
   - `DuplicateKeyHandlers` — raised when multiple handlers resolve to the same key (for example, both a `ctrl+i` binding and a `tab` binding on the same target).
3. Pattern for handling errors: catch-by-base vs. by-specific-class.
4. Where each error surfaces (which framework API throws it).

## Key concepts
- Errors are part of the API contract; silently swallowing them violates framework guarantees.
- `DuplicateKeyHandlers` is a structural validation error raised at registration time, not at dispatch time — so bad bindings fail loudly before use.
- Other framework errors (DOM errors, reactive errors, query errors) live in their respective modules and are cross-referenced here.

## Behaviors and contracts
- All framework error classes must extend `TextualError` so consumers can catch the family with one handler.
- Messages must include enough context to localize the cause (widget id/name, key that conflicted, object type that failed to render).

## Example requirements
- A TS snippet showing a try/catch with `instanceof TextualError` as the broad catch.
- A snippet provoking `NoWidget` from a bad query and catching it.
- A snippet showing two bindings that would raise `DuplicateKeyHandlers` and how to resolve it.

## Cross-references
- `spec/docs-spec/api_dom_node.md` (DOM-related errors like `BadIdentifier`, `NoScreen`, `DOMError`).
- `spec/docs-spec/api_query.md` (query-specific errors: `NoMatches`, `WrongType`, `TooManyMatches`, `InvalidQueryFormat`).
- `spec/docs-spec/api_reactive.md` (`ReactiveError`).
- `spec/docs-spec/api_binding.md` (binding registration validation).
- `spec/spec-src/03-message-event-and-dispatch.md` (key dispatch and duplicate-handler validation).

## Notes for writers
- The source enumerates only four classes; keep the doc small. Do not invent additional errors.
- Do not reference Python `Exception` hierarchy; in TS the base is `Error` with a framework-specific class.
- Do not auto-wrap thrown errors in `TextualError`; preserve the caller's error when the framework is merely propagating.
