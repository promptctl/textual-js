# Docs Spec: Lazy and Reveal — Deferred Widget Mounting

## Purpose
Describes the docs page that teaches developers how to defer mounting of heavy or currently-invisible widgets to improve perceived startup responsiveness, using the `Lazy` and `Reveal` wrappers.

## Audience
Application developers building screens with many children, tabbed UIs with initially-hidden panes, or complex dashboards where up-front mount cost is visible to the user.

## Required sections
1. Overview — why lazy mounting matters for perceived performance.
2. `Lazy` — wrap a single widget to mount it after first refresh.
3. `Reveal` — wrap a container to mount its children one per frame.
4. Timing and lifecycle — when the wrapped children become queryable.
5. Default styling — the wrappers are hidden (`display: none`) and replaced by the wrapped widget after mounting.
6. Gotchas — DOM queries during the mount window, interaction with focus, tests, and animations.
7. Choosing between `Lazy` and `Reveal`.

## Key concepts
- Lazy mount: the wrapped widget is not in the DOM during the initial compose cycle; it is inserted after the first refresh completes and the wrapper is removed from the DOM.
- Incremental reveal: `Reveal` mounts each child with a short delay (framework default ~20ms) so the user sees continuous progress instead of a long blank.
- Replacement semantics: the wrapper's own position in the parent is taken over by the real widget; the wrapper itself is removed.
- Query visibility window: between compose and the post-refresh mount, the real widget is not findable by `queryOne` / selectors. Application code must handle this.

## Behaviors and contracts
- `Lazy` defers insertion of its wrapped child until after the first refresh; after mount the `Lazy` node is removed.
- `Reveal` collects all composed children, then mounts them sequentially (one per short interval) into the wrapped container.
- Both wrappers declare a default TCSS rule of `display: none` so they do not take space while still unresolved.
- Queries (`queryOne`, `query`) will not find wrapped widgets until their mount callback has executed.
- Failures during incremental mounting (for example, the parent is removed mid-reveal) are handled silently and do not crash the application.
- Wrapped widgets participate in the normal lifecycle (compose, mount, focus) once inserted.

## Example requirements
All examples are JSX/TypeScript using Ink primitives and textual-js widgets:
- A tabbed screen where each tab pane past the first is wrapped in `Lazy` so only the visible tab mounts initially.
- A large dashboard wrapped in `Reveal` that mounts a list of charts/cards one per frame.
- A test that uses the pilot/test harness to wait for lazy widgets to become queryable before asserting on them.
- A case that uses `callAfterRefresh` (or the equivalent effect hook) to run logic after the lazy widget has actually mounted.

## Cross-references
- `spec/docs-spec/api_widget.md` — widget lifecycle (compose, mount).
- `spec/docs-spec/api_await_complete.md` and `spec/docs-spec/api_await_remove.md` — awaiting mount/removal.
- `spec/docs-spec/api_query.md` and `spec/docs-spec/api_getters.md` — DOM query behavior and how it interacts with unmounted widgets.
- `spec/docs-spec/api_pilot.md` — test pilot for waiting on mount cycles.
- `spec/spec-src/01-runtime-app-and-lifecycle.md` — lifecycle contracts.
- `spec/spec-src/02-dom-reactivity-and-query.md` — DOM query semantics during mount.

## Notes for writers
- Python Textual's `Lazy` / `Reveal` override `compose_add_child` and `mount_composed_widgets`; textual-js wraps this internally. Do not expose these method names; describe the behavior in terms of compose children and deferred mount.
- Do not mention asyncio, `call_after_refresh` as an async method, or Python's coroutine semantics. In textual-js this is a scheduled post-refresh callback (effect / microtask / next-tick).
- Document the small delay between reveals (framework default ~20ms) without overspecifying — the doc should note it is tunable only if the framework exposes it; otherwise leave it as an implementation detail.
- Emphasize the DOM-query caveat; this is the most common source of bugs when using lazy widgets.
- Avoid `yield` / `compose()` generator syntax in examples — textual-js uses JSX children.
