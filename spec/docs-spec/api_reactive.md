# Docs Spec: Reactive Attributes

## Purpose
Describe how widgets declare reactive attributes — state fields that trigger repaints, layouts, recomposition, watcher callbacks, validation, computed derivations, data binding, and optional CSS class toggling when their value changes.

## Audience
Widget authors declaring state on widgets. App authors doing data binding across widgets.

## Required sections
1. Overview — what reactive attributes are, why they exist, how they differ from raw instance state.
2. The three flavors — the general reactive (full control), the "typical" reactive (sensible defaults for visible widget state), and the "var" reactive (state without visual side effects).
3. Declaring a reactive — default values (literal, zero-arg factory, owner-aware factory).
4. Options — `layout`, `repaint`, `init`, `alwaysUpdate`, `compute`, `recompose`, `bindings`, `toggleClass`.
5. The set-sequence — what happens in order when a reactive is assigned.
6. Validators — private and public validation hooks and how they transform or reject incoming values.
7. Watchers — naming convention, the zero/one/two-argument signatures, private-vs-public precedence, sync/async callbacks.
8. Computed reactives — read-only attributes whose value comes from a compute method; private-over-public precedence; rule against having both.
9. CSS class toggling via `toggleClass`.
10. Data binding — subscribing a watcher to an attribute on another node.
11. Owner-aware defaults — deferring default computation to a method on the owning object.

## Key concepts
- Reactive attributes are declared on the widget class and are connected to the framework's reactive engine (MobX in the JS port).
- A reactive with a compute function is read-only; assignment is an error.
- Watchers are discovered by name convention (`watchX`, `_watchX`), both may be present, and both run (private first).
- Watchers may accept 0, 1, or 2 parameters, corresponding to "no args", "new value", "old and new value".
- Async watchers are scheduled on the owner's task/message queue; they do not block the setter.
- `init: true` means the watcher runs once when the widget mounts, with the initial value.
- `alwaysUpdate: true` means watchers run even when old === new (normally equal writes are coalesced).
- `layout`, `repaint`, `recompose` cause the framework to schedule corresponding work on the widget after the value change.
- `bindings: true` refreshes key bindings after the value change (for dynamic binding enabling/disabling).
- `toggleClass: "foo bar"` adds those classes when the value is truthy and removes them when falsy.
- Owner-aware defaults: the default can be a callback that receives the owner instance and returns the initial value.

## Behaviors and contracts
- Assignment sequence (in order): validate (private then public) → toggle classes if configured → if value actually changed (or `alwaysUpdate`): store new value, run private watcher, run public watcher, run bound watchers, run compute methods (if enabled), refresh bindings (if configured), schedule repaint/layout/recompose (if configured).
- A reactive with a compute method cannot be written; attempting to set raises.
- Computed reactives produce a stored value on read; watchers fire when the computed value changes.
- Private names (`_watchX`, `_computeX`) take precedence over public names (`watchX`, `computeX`); both may coexist but private runs first for watchers, and private replaces public for computes.
- Having both a public and private compute for the same attribute is an error (too-many-computes).
- Data binding registers a watcher on another object's reactive; duplicate registration of the same callback is a no-op. Optional immediate invocation with the current value at registration.
- The `var` flavor never triggers repaint or layout; it is for pure data that nonetheless needs validators, watchers, or bindings.
- Accessing a reactive before the owner's initialization has completed is an error.

## Example requirements
JSX/TypeScript examples. Include at minimum:
- Declaring a simple reactive with a default value.
- Declaring a reactive that triggers layout (e.g. a size-affecting attribute).
- Declaring a reactive with a watcher in each of the three signature forms.
- Declaring a reactive with both validator and watcher.
- Declaring a computed reactive (read-only).
- Declaring a reactive with `toggleClass`.
- Declaring a reactive using an owner-aware default.
- Binding one widget's attribute to another's via the cross-node watch primitive.
- Declaring a `var`-style reactive for non-visible data.

## Cross-references
- `api_widget.md` in `spec/docs-spec/` — where reactives live.
- `api_dom_node.md` in `spec/docs-spec/` — reactive plumbing on all DOM nodes.
- `api_signal.md` in `spec/docs-spec/` — alternative pub/sub mechanism; when to use which.
- `spec/spec-src/02-dom-reactivity-and-query.md` — reactive pipeline behavior.
- `spec/spec-src/09-widget-base-contract.md` — widget lifecycle hooks used by reactives.

## Notes for writers
- Python descriptors are not the model in JS. The JS port uses MobX observables; describe the public surface (declare-this-way / options / watchers) rather than descriptor-protocol mechanics. Do not mention `__get__`, `__set__`, `__set_name__`.
- Do not use terms like "ReactiveError" / "TooManyComputesError" verbatim — use the framework's JS error names (see the errors module spec).
- MobX `intercept` is the natural home for validators; MobX `reaction` or custom reactive-field hooks are the natural home for watchers. The doc must describe the semantics, not the underlying MobX calls.
- The reactive pipeline must preserve ordering described above even though MobX's own autorun scheduling is batched; describe this as a contract the framework upholds, not an incidental property.
- The source file documents an `Initialize` wrapper for owner-aware defaults; the JS API should describe this as "pass a function `(owner) => value` as the default" rather than a dedicated wrapper class, unless the implementation chooses otherwise. Do not prescribe syntax; describe the capability.
- `computeX` and `_computeX` in the source are method names; in the JS port these may be class methods or an options-bag field. Describe the concept ("compute function that derives the value from other reactives") without prescribing syntax.
