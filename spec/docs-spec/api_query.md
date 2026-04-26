# Docs Spec: DOM Query

## Purpose
Document the query object returned from `DOMNode.query(...)` — a jQuery-inspired, lazily-evaluated set of widgets that supports filtering, exclusion, single/first/last retrieval, bulk CSS class manipulation, bulk style setting, bulk display/visibility/disabled/loading toggling, bulk refresh, focus, blur, and removal.

## Audience
App and widget authors selecting multiple widgets for bulk operations, or retrieving a single widget by type or selector for imperative use.

## Required sections
1. Overview — what a query is, lazy evaluation, how it compares to DOM/jQuery.
2. Obtaining a query — the `node.query(selectorOrType)` call signature; the difference between string selectors and widget-class targets for type narrowing.
3. Query construction parameters — `node`, `filter`, `exclude`, `deep`, `parent`.
4. Iteration and indexing — length, truthiness, iteration, reverse iteration, integer index, slice.
5. Filtering methods — `filter(selector)`, `exclude(selector)` (chainable, combined with AND).
6. Retrieval methods — `first`, `onlyOne`, `last`, `results`, and their type-assertion variants.
7. CSS class manipulation — `setClass`, `setClasses`, `addClass`, `removeClass`, `toggleClass`.
8. Style manipulation — `setStyles` (accepts either a declaration string or a style object).
9. Display/state manipulation — `set({ display, visible, disabled, loading })`.
10. Bulk actions — `refresh`, `focus`, `blur`, `remove` (and the awaitable returned by `remove`).
11. Error classes and when they are thrown.
12. Chaining contract — which methods return the query itself.

## Key concepts
- A query is a description of a matching set, not a snapshot; `nodes` is evaluated lazily the first time it is accessed.
- Filters compose additively with AND semantics; excludes subtract from the set.
- `deep` controls recursive descent vs. direct children only.
- Type narrowing: passing a widget class (constructor) both filters and narrows the TypeScript type parameter.
- Retrieval methods `first`, `onlyOne`, `last` throw on violated expectations; `results` yields zero or more without throwing.
- Bulk setters only change attributes whose value is provided (undefined means "leave alone").

## Behaviors and contracts
- Constructing a query with an unparseable selector throws the invalid-query error.
- `first()` throws "no matches" if the query is empty; throws "wrong type" if a type was asserted and the first node is not of that type.
- `onlyOne()` throws "no matches" if empty, "too many matches" if >1, "wrong type" if type-asserted and mismatched.
- `last()` throws "no matches" if empty; throws "wrong type" if asserted type mismatches.
- `results()` never throws for emptiness; it simply yields nothing.
- Class-manipulation methods return the query for chaining.
- `refresh`, `focus`, `blur`, `set`, `setStyles` return the query for chaining.
- `focus()` focuses the first node in the query that permits focus.
- `blur()` unfocuses the first node in the query that is currently focused.
- `remove()` returns an awaitable that completes when the removal finishes (see the framework's await-remove primitive).
- The query is generic over the widget type; chaining filters that further narrow produce a query with a narrower type parameter.

## Example requirements
JSX/TypeScript examples. Include at minimum:
- Querying all buttons and iterating over them.
- Querying a single widget with `onlyOne()` for strict assertions.
- Chaining `filter` and `exclude` to narrow a set.
- Passing a widget class as the query target for type-narrowed results.
- Bulk adding a CSS class to every match.
- Bulk setting styles on every match via both the declaration-string form and the object form.
- Bulk disabling a set of widgets.
- Removing a set and awaiting completion.
- Handling `noMatches` / `tooManyMatches` / `wrongType` errors.

## Cross-references
- `api_dom_node.md` in `spec/docs-spec/` — the `query` method on DOM nodes.
- `api_widget.md` in `spec/docs-spec/` — widget attributes (`display`, `visible`, `disabled`, `loading`).
- `api_style.md` and `api_renderables.md` in `spec/docs-spec/` — style system.
- `api_await_remove.md` in `spec/docs-spec/` — the awaitable returned by `remove()`.
- `spec/spec-src/02-dom-reactivity-and-query.md` — query semantics.
- `spec/spec-src/04-styling-and-css-engine.md` — selector grammar.

## Notes for writers
- Do not mention Python generators, `Iterable[...]` type hints, or Python "slice objects". JS iteration and array-like access is the analogue.
- In the JS port CSS is TCSS parsed via css-tree; the selector grammar documented here is the TCSS-subset the framework supports, not full browser CSS. Link to the TCSS reference for the exact grammar.
- The `setStyles` method taking a CSS declaration string mirrors the source; the object form in the JS API should use camelCased keys that match the TCSS style surface documented elsewhere.
- `exclude` combined with `filter` can be surprising: `exclude` removes previously-matched nodes; document example semantics with care.
- Note that `query` is imperative — it does not establish a reactive subscription; if callers want to react to changes they must use MobX observation or subscribe to relevant signals.
