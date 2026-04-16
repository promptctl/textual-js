# Docs Spec: DOM Walking

## Purpose
Document the low-level DOM traversal helpers (depth-first, breadth-first, and breadth-first-by-id) used under the hood by the query system, and advise when to use them vs. higher-level query APIs.

## Audience
Framework extenders and advanced widget authors who need raw traversal over the widget tree. Most readers should use the query API instead.

## Required sections
1. Overview (what these helpers do and why `query` should usually be preferred)
2. Depth-first walk (order, root inclusion toggle, optional type filter)
3. Breadth-first walk (order, root inclusion toggle, optional type filter)
4. Breadth-first search by ID (optimized single-node lookup)
5. Type-filtered iteration and how it interacts with TypeScript generics
6. Warning about DOM mutation during iteration and the alternative (`walkChildren` / safer traversal)

## Key concepts
- Depth-first yields a node then descends into its children before its siblings.
- Breadth-first yields all siblings at a level before descending.
- Root inclusion is a single flag that decides whether the starting node appears in the output.
- Type filtering narrows the iteration (and return type) to a specific widget class without the caller doing the `instanceof` check.
- ID search is a special case because the DOM maintains an id index per node, so lookup can skip whole subtrees.

## Behaviors and contracts
- These helpers are read-only with respect to the DOM; mutating during iteration is undefined behavior.
- All helpers are synchronous iterables / generators.
- The type-filtered overload narrows the iteration's element type; callers receive the filtered type without additional casting.
- ID search returns the first match encountered in BFS order, or undefined if no node matches.
- `withRoot: true` lets the root be yielded (or matched) before descending; `withRoot: false` skips it entirely.

## Example requirements
All examples are JSX/TypeScript. The doc must include:
- Iterating every descendant of a container depth-first.
- Iterating only widgets of a given class breadth-first.
- Finding a widget by id without scanning every node.
- A "don't do this" snippet showing DOM mutation inside a walk, with a pointer to the safe alternative.
- Preferring `container.query(...)` for the common case over raw walking.

## Cross-references
- `spec/docs-spec/api_query.md`
- `spec/docs-spec/api_dom_node.md`
- `spec/spec-src/02-dom-reactivity-and-query.md`

## Notes for writers
- Do not describe `deque` data structures or other Python stdlib types. The JS equivalents (array as stack, array as queue) are implementation details.
- Avoid Python `TypeVar` nomenclature; use TypeScript generic parameter language.
- Keep the emphasis on "prefer `query` unless you have a reason not to" — these helpers exist mostly for internal use.
