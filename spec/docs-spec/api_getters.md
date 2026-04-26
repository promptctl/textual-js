# Docs Spec: Typed Getter Helpers for DOM Access

## Purpose
Describes the docs page that teaches widget, screen, and app authors how to declare typed, cached accessors for child widgets and the active app, so callsites do not have to repeat selector strings or type narrowing.

## Audience
Widget authors and screen authors who need ergonomic, typed access to other widgets in the DOM, especially `query_one` and "child by id" lookups, plus app extenders who want typed access to a custom `TextualApp` subclass.

## Required sections
1. Overview and motivation (what problem these helpers solve versus calling `query` or `queryOne` directly).
2. `app(AppType)` helper — typed access to the active app subclass.
3. `queryOne(selector, expectType?)` helper — typed getter backed by a TCSS selector.
4. `childById(id, expectType?)` helper — efficient direct-child lookup by `id`.
5. Error cases: no active app, no match, wrong type.
6. When to use each helper versus inline `queryOne` / `getElementById`-style access.
7. Interaction with lazy mounting (values may not exist immediately after construction).

## Key concepts
- Typed accessors that wrap `queryOne` / direct child lookup so the returned value is narrowed to a specific widget subclass.
- `app` helper returns the active `TextualApp` subclass instance — resolves via the active-app context, falling back to walking the parent chain.
- `queryOne` helper runs a TCSS selector against the DOM subtree and narrows the result to an expected widget type.
- `childById` helper restricts the search to direct children, skipping full DOM traversal for performance.
- All three helpers raise on ambiguity or mismatch rather than returning `null`.

## Behaviors and contracts
- `app(AppType)` returns the active app instance; throws a "no active app" error if none is active.
- `queryOne(selector)` / `queryOne(selector, ExpectedType)` returns the first matching widget; throws on no match and on wrong type.
- `childById(id)` / `childById(id, ExpectedType)` searches only the immediate children collection; throws on no match and on wrong type.
- Helpers are evaluated each time they are read (they are accessors, not cached one-shot values) unless the framework documents caching. Document the evaluation semantics explicitly.
- Selector string vs widget-type-as-selector equivalence: when a widget type is passed as the selector, its class-derived selector is used.
- Never returns `null` — callers rely on throw-on-miss semantics.

## Example requirements
All examples are JSX/TypeScript using Ink primitives and textual-js widgets:
- A screen/widget class (or hook) that declares a typed `app` accessor pointing at a custom `TextualApp` subclass and reads a custom app property inside an effect.
- A screen that declares a typed `queryOne` accessor for a `RichLog` by id selector, then writes to it after mount.
- A screen that declares a typed `childById` accessor for a direct child `RichLog` and demonstrates the performance win over `queryOne`.
- A negative example showing the error thrown when the expected type does not match.

## Cross-references
- `spec/docs-spec/api_query.md` — base query/queryOne API.
- `spec/docs-spec/api_dom_node.md` — DOM traversal primitives.
- `spec/docs-spec/api_app.md` — the `TextualApp` class and active-app concept.
- `spec/docs-spec/api_widget.md` — widget lifecycle and mounting.
- `spec/spec-src/02-dom-reactivity-and-query.md` — query semantics and DOM model.
- `spec/spec-src/01-runtime-app-and-lifecycle.md` — active app resolution.

## Notes for writers
- Python Textual implements these as descriptor classes; textual-js implements them as accessor helpers / factory functions (possibly class field initializers or hooks). Do not mention Python descriptors, `__get__`, `Generic[AppType]`, or the descriptor protocol.
- Do not document `NoActiveAppError`, `NoMatches`, or `WrongType` as Python exception classes; describe them as typed errors the helper throws, using the textual-js error names.
- Clarify that since widgets are React function components wrapped in `observer()`, these helpers are typically used from effects, lifecycle callbacks (e.g. `onMount`), or event handlers — not inside render bodies that expect stable referential output.
- Call out interaction with lazy-mounted widgets: a `queryOne` accessor may throw briefly until mounting completes; link to `api_lazy.md`.
- Avoid Python idioms like `type[Widget]`; use TypeScript idioms such as `new (...args: any[]) => Widget` or a branded widget-type token when describing the expected-type parameter.
