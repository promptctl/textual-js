# Phase 2: Full Reactive Pipeline

## Preconditions

Phase 1 complete:
- `npm test` passes with non-empty suites
- `runTest()` and `Pilot` exist and work
- Existing behavior locked down by tests

## Goal

Replace the bootstrap reactive helpers with the spec-shaped descriptor pipeline before anything else builds on the wrong contract.

## Architectural Rationale

// [LAW:single-enforcer] The reactive pipeline is the single enforcer of validation, watcher invocation, compute propagation, and refresh scheduling. No parallel validation or watcher paths.

// [LAW:dataflow-not-control-flow] The set pipeline is fixed: validate → store → watch → compute dependents → refresh. Variability lives in the descriptor flags and the values, not in which steps execute.

The current function-based API (`getReactive`/`setReactive`/`watchReactive`) lacks validators, computed properties, `init` dispatch, and `always_update` semantics. Every widget, style property, and data binding will depend on this pipeline. Replacing it later means rewriting everything that touches reactive state. It must be correct now.

## Current State (before this phase)

**`src/reactive.ts`** contains:
- `ReactiveOptions`: `layout`, `repaint`, `init`, `alwaysUpdate` flags
- `reactive(defaultValue, options)` — returns `defaultValue` at construction time (no descriptor behavior)
- `getReactive(host, name, defaultValue)` — reads from `REACTIVE_STORE` symbol map
- `setReactive(host, name, newValue, options)` — stores value, runs watchers, triggers refresh. Skips if unchanged unless `alwaysUpdate`.
- `watchReactive(host, name, defaultValue, callback)` — registers a watcher, returns unsubscribe

**What's missing (per spec):**
- Validators: `validate_<name>` convention, called before storage, can reject or transform
- Computed properties: `compute_<name>` convention, recalculated when dependencies change
- `init` dispatch: watchers fire on first mount when `init: true` (defaults to `true` per uber-divergence)
- Descriptor-backed reactivity: the current `reactive()` just returns a value — it should create a property descriptor that intercepts get/set
- Data binding semantics rooted in compose-time ownership
- Global watchers

**Files that use reactive:**
- `src/widget.ts` — does not currently use `reactive()` for its properties (uses plain fields)
- No other files currently depend on the reactive API beyond the exports in `src/index.ts`

## Scope

### Replace function-based reactive with descriptor-backed pipeline

- `reactive<T>(defaultValue, options?)` creates a property descriptor (or class-field initializer pattern) that intercepts get/set on the host instance
- The descriptor stores values under `_reactive_<name>` on the instance
- Get returns the stored value (or computed value if compute exists)
- Set runs the full pipeline: validate → store → watch → compute dependents → refresh

### Validate convention

- If the host has a method `validate_<name>(value: T): T`, it is called before storage
- The validator can transform the value (return a different value) or reject it (throw)
- Validators run before watchers — a rejected value never triggers watchers

### Compute convention

- If the host has a method `compute_<name>(): T`, the property is computed
- Computed properties are read-only from user code (set throws)
- Recomputed when any reactive dependency they read during computation changes
- Dependency tracking: track which reactive properties are read during `compute_<name>` execution

### Init dispatch

- When `init: true` (the default per uber-divergence), watchers fire on first mount
- "First mount" means when the widget receives its `Mount` message
- The init fire passes `undefined` as old value and the current value as new value

### Always update

- When `alwaysUpdate: true`, watchers fire even when the new value equals the old value

### Watcher ordering

- Watchers fire in registration order
- `watch_<name>` naming convention on the host for auto-registered watchers
- Explicit `watchReactive()` registrations fire after convention-based watchers

### Global watchers and data binding

- Global watchers observe a reactive property across all instances of a type
- Data binding: a reactive property on a parent can bind to a reactive property on a child, with the parent as the source of truth during compose-time ownership

### Backward compatibility

- The existing Phase 1 tests must continue to pass
- Any existing code that uses `getReactive`/`setReactive`/`watchReactive` is migrated to the new API

## Spec References

- `spec/spec-src/02-dom-reactivity-and-query.md` — reactive sections
- `spec/spec-tests/reactivity.md` — reactive test cases

## Uber-Divergence Resolutions

| Issue | Resolution |
|-------|-----------|
| `reactive()` `init` default | Defaults to `init: true` |
| Reactive pipeline order | Validate → store → watch → compute dependents |

## Exit Criteria

1. Reactive tests cover: validator ordering, watcher ordering, `init` dispatch, `always_update`, compute-backed values, mutation forcing.
2. The reactive pipeline is the sole authority for validation and watcher dispatch — no parallel paths exist in the codebase.
3. All Phase 1 tests still pass (reactive replacement does not break existing behavior).
4. `npm run build` and `npm run lint` pass.
5. A test demonstrates: setting a reactive property → validator transforms value → watcher fires with transformed value → computed dependent updates.

## What the Next Phase Expects

Phase 3 (CSS Engine & Query API) expects:
- A working descriptor-backed reactive system that style properties can be built on
- `validate_<name>` and `compute_<name>` conventions working, since style properties will use validators
- Reactive refresh triggering layout/repaint invalidation, since style changes must trigger layout
