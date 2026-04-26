# Docs Spec: DOMNode

## Purpose
Document the `DOMNode` base type from which `App`, `Screen`, and `Widget` derive — the root of the widget tree contract covering identity, classes, reactive state, queries, focus, styling, actions, workers, and refresh.

## Audience
Widget authors and framework extenders who need the full base-class surface; app developers needing a reference for query, classes, reactive bindings, and action checking.

## Required sections
1. Overview of the node hierarchy: `App` -> `Screen` -> `Widget`, all are `DOMNode`s.
2. Construction inputs: `name`, `id`, `classes` (and validation rules for identifiers — letters, numbers, underscores, hyphens; cannot start with a digit).
3. Subclass configuration: inheritance toggles for CSS, bindings, and component classes (`inheritCss`, `inheritBindings`, `inheritComponentClasses`).
4. Static/type-level hooks on widget types: `DEFAULT_CSS`, `DEFAULT_CLASSES`, `COMPONENT_CLASSES`, `BINDINGS`, `BINDING_GROUP_TITLE`, `SCOPED_CSS`, `HELP`.
5. Identity, tree relationships, and readable properties: `parent`, `screen` (throws when unmounted), `id` (set-once), `name`, `classes`, `children`, `displayedChildren`, `displayedAndVisibleChildren`, `isEmpty`, `cssIdentifier`, `cssPathNodes`, `ancestors`, `ancestorsWithSelf`.
6. Display and visibility: `display` and `visible` setters, inheritance of visibility, the difference between `display=false` (no layout) and `visible=false` (reserves space).
7. Pseudo-class surface: `pseudoClasses`, `getPseudoClasses()`, `hasPseudoClass(name)`, `hasPseudoClasses(names)`.
8. Reactive management: `setReactive(reactive, value)` (bypass watchers), `mutateReactive(reactive)` (force-notify mutable observables), `dataBind(...)` (chainable), `watch(obj, key, callback, { init })`.
9. CSS class management: `hasClass`, `addClass`, `removeClass`, `toggleClass`, `setClass(enabled, ...names)`, `setClasses(list)`.
10. Querying: `query(selector)`, `queryChildren(selector)`, `queryOne`, `queryOneOptional`, `queryExactlyOne`, `queryAncestor`.
11. Child management: `sortChildren({ key, reverse })`, `composeAddChild(widget)` redirect hook.
12. Worker management: `runWorker(work, options)` with all options (`name`, `group`, `description`, `exitOnError`, `start`, `exclusive`, `thread` equivalent).
13. Focus trapping: `trapFocus({ enabled })`.
14. Styling API: `setStyles(cssOrObject)`, `getComponentStyles(...names)`, `notifyStyleUpdate`, `resetStyles`, `updateNodeStyles({ animate })`.
15. Actions: `checkAction(action, parameters)` returning `true` / `false` / `null` (enabled-visible, disabled-hidden, disabled-visible-grayed), `actionToggle(attributeName)`, `refreshBindings()`.
16. Refresh: `refresh({ repaint, layout, recompose })`, `automaticRefresh` callback, `autoRefresh` property.
17. Color and style accessors: `textStyle`, `selectionStyle`, `richStyle`, `backgroundColors`, `colors`.

## Key concepts
- Single-assignment `id` with structural validation.
- Class list as an immutable `ReadonlySet<string>`; mutations go through `addClass` / `setClasses`.
- Reactive attributes wrapped by MobX observables — `setReactive` is the back door that skips validators/watchers.
- Query language uses the framework's TCSS selectors; `query*` methods return DOMQuery collections or single nodes, with strict variants throwing on miss/multi.
- Pseudo-classes drive TCSS style selection at runtime.
- `checkAction` tri-state controls command palette / footer visibility alongside enabled state.
- `refresh` is a no-op at `DOMNode` level; `Widget` overrides.

## Behaviors and contracts
- Setting `id` twice must throw.
- Identifier validation runs on every class or id assignment.
- `screen` throws when the node is detached from any screen.
- `display=false` removes the node from layout entirely; `visible=false` keeps layout but paints nothing.
- `query*` throws typed errors on miss or type mismatch (`NoMatches`, `WrongType`, `TooManyMatches`).
- `dataBind` returns `this` and is chainable.
- `watch` with `init: true` fires once immediately with the current value.
- `runWorker({ exclusive: true })` cancels other workers in the same group.
- `checkAction` return triples map: `true` -> enabled+visible, `false` -> disabled+hidden, `null` -> disabled+visible (grayed).
- `automaticRefresh` only fires when the node is on-screen.
- `refresh({ recompose: true })` triggers a full recompose of children.

## Example requirements
- JSX/TypeScript snippets for:
  - Defining a widget subclass with `DEFAULT_CSS`, `BINDINGS`, and component classes declared as static fields.
  - Toggling a CSS class on a state change (`setClass(active, "-active")`).
  - Querying a descendant with a type assertion via `queryOne(Button)`.
  - Binding a reactive from a parent (`child.dataBind(parent.time)`).
  - Watching an external reactive on `app.theme`.
  - Running a worker exclusively inside a group.
  - Implementing `checkAction` to gray out an action.
- A table of inheritance toggles with their defaults and effects.
- A table of display vs. visible behaviors.

## Cross-references
- `spec/docs-spec/api_reactive.md` (reactive attributes).
- `spec/docs-spec/api_query.md` (DOMQuery internals).
- `spec/docs-spec/api_binding.md` (BINDINGS and action system).
- `spec/docs-spec/actions_and_bindings.md` (`checkAction` semantics).
- `spec/docs-spec/api_message_pump.md` (message pump inherited behavior).
- `spec/docs-spec/api_screen.md` (`screen` property source).
- `spec/docs-spec/api_app.md` (root node).
- `spec/spec-src/02-dom-reactivity-and-query.md`, `spec/spec-src/03-message-event-and-dispatch.md`, `spec/spec-src/06-input-bindings-actions-and-commands.md`, `spec/spec-src/07-workers-timers-and-signals.md`.

## Notes for writers
- Do not describe Python's `MessagePump` inheritance chain; `DOMNode` "is also a message target" suffices.
- Replace `set()` and `frozenset()` with `ReadonlySet`/`Set` or array descriptions.
- Do not show Python class definitions with `inherit_css=True` subclass-config syntax; in TS this is a static field or decorator. Describe the contract, not the syntax.
- Avoid Rich `Tree`, `Text`, and `Style` types in user-facing docs — reference the JS-native equivalents.
- "Thread worker" in Python has no direct JS equivalent; describe worker modes that textual-js actually supports (per the workers spec) and drop `thread=True` otherwise.
- Python `async def` vs sync split does not apply; `runWorker` accepts a function that may return a Promise.
- Keep snake_case -> camelCase renames consistent throughout examples.
- The `tree` / `cssTree` Rich-tree helpers are debug aids; mention they exist but do not exhaustively document Rich rendering.
