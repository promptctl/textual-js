# Lazy

Lazy loading of widgets defers mounting until after the initial compose and mount cycle, improving perceived startup time for complex layouts.

## Widgets

### Lazy

`Lazy` wraps a container widget and defers mounting of its children. During initial compose, children yielded inside a `Lazy` context are not present in the DOM. They become available after a subsequent refresh cycle.

- `Lazy` accepts a container (e.g., `Horizontal`, `Vertical`) as its argument.
- Children are yielded inside the `Lazy` context manager, just like a normal container.
- On initial mount, the deferred children do not appear in query results.
- Widgets composed outside of `Lazy` mount immediately as usual.
- After the app processes its refresh (one or more `pilot.pause()` cycles in tests), the deferred children are mounted and become queryable.

### Reveal

`Reveal` wraps a container widget and incrementally mounts its children over successive frames rather than all at once.

- `Reveal` accepts a container (e.g., `Vertical`) as its argument.
- Children are yielded inside the `Reveal` context manager.
- On initial mount, only the first child is displayed.
- Remaining children are not yet in the DOM immediately after mount.
- Over successive refresh frames, additional children are mounted and become visible, until all children are present and displayed.

## Constraints

- `Lazy` and `Reveal` are imported from `textual.lazy`.
- Both `Lazy` and `Reveal` take a container widget as their first positional argument.
- Both are used as context managers in `compose`, with children yielded inside the block.
- Non-lazy siblings mount and are queryable immediately; lazy children are absent from the DOM until deferred mounting completes.
- `Reveal` guarantees ordering: the first child is available before later children.
- After all deferred mounting is complete, the final DOM is identical to what a non-lazy compose would produce (all children present and displayed).
