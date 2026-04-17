# Docs Spec: Reactivity

## Purpose
Describes the doc page that teaches textual-js's reactive system: how to declare reactive attributes, how to observe changes via watchers, how to validate and compute derived values, how to bind data between parent and child widgets, how to force refresh behavior on in-place mutations, and how to use signals for event-like pub/sub that sits outside the reactive system.

## Audience
Widget authors and application authors who want widget state to trigger UI updates automatically, coordinate across parent/child, or publish events to arbitrary subscribers. This is a core guide — most non-trivial apps need reactivity.

## Required sections
1. Overview: reactivity connects state to rendering; built on MobX (observables + reactions) under the hood.
2. Declaring reactive attributes: the `reactive(...)` descriptor / helper — default value, options.
3. `reactive` options: layout, repaint, init, alwaysUpdate, recompose, bindings, toggleClass.
4. Smart refresh behavior: one refresh per loop iteration, no-op when value unchanged, `layout: true` to trigger a re-layout not just repaint.
5. Dynamic defaults: passing a zero-arg callable; Initialize-style wrapper to produce the default from the owning instance.
6. Typing: how to declare broader static types than the default implies.
7. `var(...)` descriptor: reactive but without automatic repaint/layout.
8. Watchers: convention-named watch methods (one, two, or zero parameters), async-supported, private watchers, dynamic watchers attached programmatically on another node.
9. Validators: convention-named validate methods that intercept and potentially transform values; ordering relative to watchers.
10. Computed reactives: compute methods for read-only derived values; caching; recompute whenever any reactive on the object changes.
11. Execution order for a reactive set: compute dependents -> validate -> store -> watch.
12. The `init` parameter: whether watchers fire at mount time with the initial value.
13. Setting reactives without side effects: `setReactive(...)` for bypassing validators/watchers in constructors.
14. Mutating in place: `mutateReactive(...)` to force watchers/refresh when a list or object is changed in place.
15. Recompose on change: `recompose: true` behavior, cost, when to use it.
16. Data binding: binding a parent reactive to a child reactive, positional (same-name) and keyword (name-remapped) forms; unidirectional; must exist on both ends.
17. `toggleClass` parameter: auto-toggle CSS classes based on value truthiness.
18. `bindings` parameter: auto-call the binding refresh hook when the reactive changes.
19. Signals: creating a Signal, subscribing (with node + callback, immediate vs. deferred), publishing, unsubscribing, lifetime rules (weak subscription, pruning closed nodes).
20. Signal vs. reactive: when to use each.

## Key concepts
- Reactive attributes are descriptors/helpers that wrap an underlying MobX observable and wire in watchers, validators, compute, layout/repaint flags, class toggling, and data binding.
- Watchers observe change; validators gate change; compute derives from other reactives.
- Computed reactives are read-only and recalc on any reactive change on their host — keep them cheap.
- `init: true` means "call the watcher at mount time with the initial value" — a powerful shortcut for initialization.
- `setReactive` is the escape hatch for construction-time assignments where watchers would fail (not yet mounted).
- `mutateReactive` covers the MobX blind spot where the observable reference didn't change (in-place list/object mutation).
- Recompose is a heavy operation; it remounts all children. Useful when the compose output depends on a reactive.
- Data binding is unidirectional parent -> child; bidirectional binding is not supported and should not be emulated via two bindings.
- Signals are pub/sub without state; reactives are state with observers.

## Behaviors and contracts
- Setting a reactive to an equal value is a no-op unless `alwaysUpdate: true` (no watcher, no refresh).
- `layout: true` implies `repaint: true` (layout changes always require a repaint).
- Both `reactive()` and `var()` default to `init: true`, calling the watcher during mount with the initial value (verified in original codebase).
- Multiple reactive writes within one message-loop iteration coalesce into a single refresh.
- Computed reactives throw when assigned — they are read-only.
- Execution order on reactive set: private validator, public validator, store, then (on next iteration) private watcher, public watcher.
- For a computed reactive: compute -> validate -> store cached -> watch, when the computed result changes.
- `setReactive` bypasses validators, watchers, and refresh.
- `mutateReactive` forces the side-effect pipeline even when the value reference is equal.
- `data_bind`-style binding: the child's target reactive is set to the parent's current value at bind time, and then on every subsequent parent change; a ReactiveError must fire if either the parent or child reactive does not exist.
- Signal subscriptions are keyed by subscribing node and stored weakly; when the subscriber is garbage collected or its node closes, the subscription is automatically pruned.
- A signal publish silently skips closed/detached nodes and swallows per-callback errors after logging them (does not halt other callbacks).
- Immediate vs. deferred signal publishing: immediate invokes callbacks synchronously; deferred posts to the subscriber's message queue.

## Example requirements
All examples JSX/TypeScript, using Ink primitives, MobX, and the textual-js React API:
- A widget with a `count` reactive and a `watchCount` handler.
- A widget that uses `validate` to clamp a reactive into a range.
- A widget with `red`, `green`, `blue` vars and a computed `color` reactive.
- A widget with `init: true` that initializes a style in its watcher when the widget mounts.
- A widget that uses `mutateReactive` after pushing to a list to trigger a refresh.
- A widget with `recompose: true` on a reactive whose compose() uses that value (and a sibling comparison widget with `watch` updating children in place — showing the tradeoff).
- A parent/child pair using data binding (positional same-name, and keyword remap).
- A widget using `toggleClass` to toggle CSS classes as a reactive goes truthy/falsy.
- A widget with `bindings: true` that refreshes its footer bindings when a reactive changes state.
- A Signal declared on a parent, subscribed to by a child, published from an action method, with both immediate and deferred subscribers.

## Cross-references
- `spec/docs-spec/events.md` (messages vs. signals vs. reactive watchers).
- `spec/docs-spec/getting_started.md` (introduction to reactive attributes in the tutorial).
- `spec/docs-spec/api_reactive.md`, `spec/docs-spec/api_signal.md`.
- `spec/spec-src/02-dom-reactivity-and-query.md` (behavioral spec).

## Notes for writers
- Under the hood, reactivity is MobX. State-bearing widgets are `observer`-wrapped React function components; the reactive descriptor/helper wires a MobX observable and connects watcher/validator/compute pipelines. Describe this briefly so users can reason about the semantics (tracking is automatic, assignments are sync, reads inside `render` are tracked).
- Drop Python-specific mechanics: no descriptors-as-class-variables syntax, no `__set_name__`, no dataclasses. In TypeScript, reactivity is attached via a helper (e.g., `const count = reactive(0)`) or a decorator (if the project uses TS decorators), or a hook; describe what the framework actually ships.
- Watch methods by naming convention (`watch_count`) must be translated: in textual-js the equivalent is either a callback registered via `watch(...)`, a subscription via MobX reaction, or a hook. Mirror the real API.
- Validators and computed reactives: same translation — describe the actual helper API.
- `set_reactive(Greeter.greeting, ...)` passes a class-level descriptor reference. The TypeScript equivalent is a handle/key that identifies the reactive field; describe that.
- Do not use Python `asyncio` terminology; async watchers in textual-js return Promises.
- MobX's `intercept` is a good mental model for validators; mention it as an implementation note, not a public API.
- Data binding is unidirectional; do not describe any Python two-way idiom as applicable.
- Signals exist as an explicit Signal class — keep the API shape (`subscribe`, `unsubscribe`, `publish`, optional `immediate` flag). Weak-subscription semantics are a real feature and must be documented so users understand subscription lifetime.
- When describing recompose cost, remind readers that textual-js ultimately renders through React/Ink — children remount, internal state (e.g. a text-input cursor position) is lost unless hoisted.
