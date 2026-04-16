# Docs Spec: DOM and Queries

## Purpose
Describes the DOM and Queries page — the tree of DOM nodes formed by App, Screen, and Widget instances, and the CSS-selector-based query API used to find, refine, and manipulate widgets.

## Audience
Widget authors and app developers who need to find widgets by selector, walk the tree, set classes/attributes in bulk, or react to pseudo-class state.

## Required sections
1. DOM Tree Structure
   - Node hierarchy — App is the root (no parent), Screen sits under App, widgets sit under Screen and may nest.
   - `parent`, `children` (insertion order), `displayedChildren` (filtered by `display`).
   - Ancestors — `ancestors` (immediate parent to app) and `ancestorsWithSelf`.
   - Walking the tree — `walkChildren({ filterType?, withSelf?, method?, reverse? })` with `depth`/`breadth` order and snapshot semantics.
   - Screen access — `node.screen` (raises NoScreen when unmounted), and how `node.screen` can differ from `app.screen`.
2. Node Identity
   - `id` — nullable string, unique within a container, grammar constraints (letters/digits/underscores/hyphens, cannot begin with a digit), used by `#id` selectors; invalid IDs raise a BadIdentifier-equivalent error.
   - CSS classes — `classes` as a read-only Set-like value; replacing the set vs. incremental updates via `addClass`, `removeClass`, `toggleClass`, `hasClass`, `setClass`, `setClasses`.
   - Default classes — a static field (`DEFAULT_CLASSES`) providing initial classes when the constructor receives none.
3. CSS Selectors
   - Simple selectors — type, class, ID, universal.
   - Pseudo-classes — state-reflecting; `getPseudoClasses()` returns the active set for a node.
   - Combinators — descendant (space), child (`>`).
   - Compound and comma-separated selectors.
4. Query Methods on DOMNode — available on App and Widget alike; queries search the subtree rooted at the receiver (excluding the receiver itself).
   - `query(selector?)` — all descendants (recursive). Accepts a CSS string or a widget type. Returns a lazy `DOMQuery`.
   - `queryChildren(selector?)` — like `query` but only immediate children.
   - `queryOne(selector, expectType?)` — first BFS match; throws NoMatches when absent; throws WrongType when expectType mismatches.
   - `queryOneOptional(selector, expectType?)` — returns null instead of throwing NoMatches.
   - `queryExactlyOne(selector, expectType?)` — throws TooManyMatches when more than one matches.
   - `queryAncestor(selector, expectType?)` — walks upward through ancestors.
5. DOMQuery
   - Container semantics — `length`, indexing, slicing, iteration, `reversed()`, truthiness.
   - Refinement — `filter(selector)`, `exclude(selector)` return new queries.
   - Single-element retrieval — `first(expectType?)`, `last(expectType?)`, `onlyOne(expectType?)` with NoMatches/TooManyMatches/WrongType semantics.
   - Iteration — `results({ filterType? })` yields widgets with a type-narrowing filter for type-checkers.
   - Bulk operations — `addClass`, `removeClass`, `toggleClass`, `setClass`, `setClasses`, `set({ display?, visible?, disabled?, loading? })`, `setStyles(...)`, `refresh({ repaint?, layout?, recompose? })`, `focus()`, `blur()`, `remove()` (returns an awaitable).
6. Exceptions
   - `QueryError` as the root, with `InvalidQueryFormat`, `NoMatches`, `TooManyMatches`, `WrongType` as the specific cases.
7. Component Classes — `COMPONENT_CLASSES` static field for virtual DOM nodes participating in CSS matching for line-API widgets. Note this is an advanced surface.

## Key concepts
- The DOM is the single source of truth for widget structure; queries are derived views.
- Queries are lazy: the node list is computed when accessed, and the single-ID cache is invalidated on child mutation.
- Bulk operations on a query return the same query for chaining.
- Pseudo-classes are runtime state; they cannot be set directly by authors (except through the state they reflect).
- COMPONENT_CLASSES is not for adding real children; it is a styling hook for complex renderers.

## Behaviors and contracts
- `queryOne` uses breadth-first search so "nearest" is deterministic relative to mount order.
- `query_one_optional` / `queryOneOptional` returns null instead of throwing for missing nodes but still throws WrongType for type mismatches.
- Adding/removing classes with class manipulation methods triggers CSS re-evaluation and a re-render.
- `remove()` on a query detaches widgets from the DOM and returns an awaitable that resolves when removal completes.
- ID uniqueness is enforced within a container; duplicates raise during mount or construction.
- Tree walks snapshot the tree at call time; mutations during iteration do not affect the yielded results.

## Example requirements
Describe (do not inline) JSX/TypeScript examples covering:
- Finding a button by ID and calling a method on it (e.g. changing its label).
- Finding all descendants of a given type and applying a class to them with a bulk operation.
- Narrowing `query().results({ filterType: Button })` so TypeScript infers `Button`.
- Using `queryOneOptional` to handle "maybe-present" widgets without try/catch.
- Walking ancestors to find the nearest `Screen` or `Dialog`.
- Observing `classes` change trigger a re-render via an `observer()` component.
All examples are JSX/TypeScript using textual-js APIs; no Python.

## Cross-references
- `spec/docs-spec/css_overview.md` — selector grammar.
- `spec/docs-spec/app.md` — focus, mount, and `push_screen`/`pop_screen` semantics.
- `spec/docs-spec/api_dom_node.md` (if present) — the DOMNode base contract.
- `spec/spec-src/02-dom-reactivity-and-query.md` — authoritative DOM, reactivity, and query behavior.
- `spec/spec-src/03-message-event-and-dispatch.md` — how mount/unmount events interact with the DOM.

## Notes for writers
- Do not use snake_case method names. `walk_children` → `walkChildren`; `add_class` → `addClass`; `query_one` → `queryOne`; `query_children` → `queryChildren`; etc.
- Replace `frozenset[str]` with "a read-only Set-like value" (or `ReadonlySet<string>` in TS).
- Do not document Python-specific behavior around insertion order beyond "insertion order is preserved" (JS objects/arrays already provide this).
- When describing the lazy query: a `DOMQuery` is evaluated on access; do not imply Python's generator semantics.
- Exceptions are JS `Error` subclasses; examples should use `try/catch`, not Python `except`.
- `AwaitRemove` becomes a Promise (or a thenable) in JS; describe it as "returns a promise that resolves when the removal completes" without naming a Python type.
- Do not reference `isinstance` in the `results({ filterType })` description; describe it as "runs an instance-of filter" and explain the TypeScript narrowing outcome.
