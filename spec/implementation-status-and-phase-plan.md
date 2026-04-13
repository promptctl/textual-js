# Textual JS Implementation Status And Remaining Phase Plan

Audit date: 2026-04-13

This document evaluates the current `textual-js` codebase against the canonical specification set in [`spec/uber-spec`](./uber-spec/INDEX.md) and the implementation-derived ownership model in [`spec/spec-src`](./spec-src/00-overview-and-scope.md).

// [LAW:one-source-of-truth] The evaluation is organized by the canonical spec areas, not by the current file layout, so the plan tracks the intended behavior surface rather than the bootstrap implementation.

## Evidence Snapshot

- Repo runtime surface today is `22` TypeScript source files under `src/`.
- `npm run build` passes on 2026-04-13.
- `npm run lint` passes on 2026-04-13.
- `npm test` fails because there are currently no test files discovered by Vitest.
- `src/widgets/` is empty.
- `src/css/` is empty.
- The implemented public surface is limited to geometry primitives, `Message`/`MessagePump`, `DOMNode`, `Widget`, `Screen`, `App`, and three layout strategies.

## Current State Against The Spec

| Spec area | Canonical references | Current state | Assessment |
| --- | --- | --- | --- |
| Runtime and lifecycle | [`spec/uber-spec/runtime-and-lifecycle.md`](./uber-spec/runtime-and-lifecycle.md), [`spec/spec-src/01-runtime-app-and-lifecycle.md`](./spec-src/01-runtime-app-and-lifecycle.md) | `App.run()` starts a message pump, creates a default `Screen`, and supports basic push/pop/switch and resize. There is no driver ownership, CSS loading, mode registry, installed screens, notifications, theme/signal surface, shutdown contract, or `run_test()` harness. | Bootstrap only |
| DOM, query, reactivity, dispatch | [`spec/uber-spec/dom-reactivity-and-dispatch.md`](./uber-spec/dom-reactivity-and-dispatch.md), [`spec/spec-src/02-dom-reactivity-and-query.md`](./spec-src/02-dom-reactivity-and-query.md), [`spec/spec-src/03-message-event-and-dispatch.md`](./spec-src/03-message-event-and-dispatch.md) | Tree ownership and bubbling exist in simplified form. `NodeList` tracks ids and update versions, and `MessagePump` has a queue, callback scheduling, timers, and simple naming-based dispatch. Query APIs, selector parsing/matching, `DOMQuery`, decorated handlers, suppression scopes, callback messages, full reactive descriptors, compute pipeline, and data binding are absent. | Partial foundation |
| Styling, layout, rendering, compositor | [`spec/uber-spec/styling-layout-and-rendering.md`](./uber-spec/styling-layout-and-rendering.md), [`spec/spec-src/04-styling-and-css-engine.md`](./spec-src/04-styling-and-css-engine.md), [`spec/spec-src/05-layout-render-and-compositor.md`](./spec-src/05-layout-render-and-compositor.md) | Layout exists only as simplified `vertical`, `horizontal`, and `grid` strategies with placeholder sizing rules. There is no CSS parser, stylesheet, selector matching, style precedence, compositor, dirty-region tracking, render cache, scroll integration, animation system, or driver-facing render pipeline. | Mostly absent |
| Input, bindings, actions, commands | [`spec/uber-spec/input-actions-and-commands.md`](./uber-spec/input-actions-and-commands.md), [`spec/spec-src/06-input-bindings-actions-and-commands.md`](./spec-src/06-input-bindings-actions-and-commands.md) | A few event classes exist (`Key`, mouse events), but there is no driver normalization, binding model, action dispatch, key parsing, command palette, system commands, or fuzzy matching. | Absent |
| Widget base contract and widget catalog | [`spec/uber-spec/widgets.md`](./uber-spec/widgets.md), [`spec/spec-src/09-widget-base-contract.md`](./spec-src/09-widget-base-contract.md), [`spec/spec-src/10-widget-catalog.md`](./spec-src/10-widget-catalog.md) | `Widget` and `Screen` exist with basic focus, display, visibility, mounting, and layout delegation. Scroll behavior, style-backed state, disabled/loading states, pseudo-classes, event forwarding, scrollbars, container helpers, and every built-in widget are still missing. | Minimal base only |
| Workers, timers, signals, text editing, supporting subsystems, testing | [`spec/uber-spec/text-editing-and-supporting-subsystems.md`](./uber-spec/text-editing-and-supporting-subsystems.md), [`spec/spec-src/07-workers-timers-and-signals.md`](./spec-src/07-workers-timers-and-signals.md), [`spec/spec-src/11-text-editing-and-document-model.md`](./spec-src/11-text-editing-and-document-model.md), [`spec/spec-src/12-supporting-subsystems.md`](./spec-src/12-supporting-subsystems.md), [`spec/spec-src/13-testability-and-automation-surfaces.md`](./spec-src/13-testability-and-automation-surfaces.md) | Basic repeating timers exist inside `MessagePump`, but there is no worker model, signal system, content/strip/renderable helpers, validation, suggestions, notifications model, themes, text document model, or testing/pilot APIs. | Absent |

## Practical Reading Of The Current Port

The repository is currently a bootstrap kernel, not a narrow but spec-complete subset. It has enough code to express:

- tree ownership and direct-child mutation
- queued message dispatch with basic bubbling
- geometry values
- a root app and screen abstraction
- placeholder layout algorithms

It does not yet have the cross-cutting enforcement boundaries that the spec assumes:

- stylesheet application as the single style arbiter
- compositor ownership of geometry and dirty regions
- driver ownership of platform input/output normalization
- reactive descriptor ownership of validation, watchers, computes, and refresh scheduling
- test harness ownership of deterministic runtime verification

// [LAW:single-enforcer] These missing enforcement boundaries are the main reason the remaining work should be phased around subsystems, not around individual widgets.

## Major Gaps That Block Broad Spec Progress

1. There is no verification harness, so progress against the spec is not machine-checkable beyond `tsc`.
2. There is no CSS and selector engine, which blocks query semantics, style-backed widget state, pseudo-classes, layout sizing, and a large share of widget behavior.
3. There is no compositor or driver seam, so rendering, scrolling, hit testing, and partial updates have no authoritative owner.
4. Reactivity is a helper API rather than the descriptor-based pipeline described by the spec, so validation, watcher ordering, compute-backed values, and data binding cannot be implemented correctly on top of it.
5. The widget catalog should not start before the base widget contract, styling, input, and render pipeline exist; otherwise the port will accumulate widget-local shims.

// [LAW:dataflow-not-control-flow] The phase order below follows the fixed runtime pipelines in the spec: lifecycle and verification first, then DOM/reactivity/style, then layout/compositor/input, then widgets on top.
// [LAW:one-way-deps] Driver, compositor, stylesheet, and widget layers must be introduced as downward dependencies; widgets should consume them, not own parallel copies of their behavior.

## Remaining Implementation Phases

## Phase 1: Verification Harness And Runtime Seams

Goal: make the runtime machine-verifiable and establish the boundaries the rest of the port depends on.

Scope:

- add Vitest coverage for the existing geometry, `NodeList`, `Message`, `MessagePump`, `DOMNode`, `Widget`, `Screen`, and `App` behavior
- implement a headless driver seam and make `App.run()` own driver startup and shutdown
- add `run_test()` and a minimal pilot-style harness for scripted key, mouse, resize, and idle coordination
- formalize lifecycle sequencing so compose, mount, resize, and shutdown are deterministic and testable

Exit criteria:

- `npm test` runs non-empty suites and passes
- app lifecycle tests cover startup, resize, push/pop/switch, and shutdown
- a headless app can be executed in-process and inspected without a real terminal
- every later phase can add spec tests without inventing a second harness

## Phase 2: DOM Query And Full Reactivity Contract

Goal: replace the bootstrap tree helpers with the spec-shaped DOM and reactive model.

Scope:

- implement selector parsing and matching for type, class, id, descendant, and child combinators
- add `query`, `query_children`, `query_one`, `query_exactly_one`, `query_ancestor`, and lazy `DOMQuery`
- replace the function-style reactive helper with descriptor-backed reactivity that owns validation, watcher invocation, compute propagation, and refresh scheduling
- add global watchers and data binding semantics rooted in compose-time ownership

Exit criteria:

- query APIs and error taxonomy are covered by tests derived from `spec/spec-tests/dom.md` and `spec/spec-tests/reactivity.md`
- `NodeList._updates` is the only cache invalidation signal consumed by query caches
- reactive tests cover validator ordering, watcher ordering, `init`, `always_update`, compute-backed values, and mutation forcing

// [LAW:one-source-of-truth] `NodeList._updates` and the reactive descriptor pipeline should remain the only authorities for query invalidation and reactive side effects, respectively.

## Phase 3: CSS Engine, Style Resolution, And Widget Style State

Goal: introduce the style system that the widget and layout contracts depend on.

Scope:

- implement CSS tokenization, parsing, selectors, specificity, `!important`, variables, and `initial`
- add stylesheet source registration and cache invalidation
- split base CSS styles, inline styles, and merged render styles on each node
- move `display`, `visible`, and other style-backed widget attributes onto the style system
- support class mutation and inline style mutation through the stylesheet/application path

Exit criteria:

- style parsing and application tests cover the core contracts in `spec/spec-tests/css_parsing.md`, `css_styles.md`, `css_scalars.md`, `css_nested.md`, and `widget.md`
- writing class or inline style changes produces deterministic refresh/layout invalidation through one path
- default CSS for widget classes participates in the same precedence model as user CSS

// [LAW:single-enforcer] Base-style mutation must happen only through the stylesheet/write arbiter; widget code should never hand-roll parallel style resolution.

## Phase 4: Layout Pipeline, Compositor, Rendering, And Scrolling

Goal: replace placeholder placement logic with the staged render pipeline described by the spec.

Scope:

- implement staged arrangement: filtering, layers, split, dock, layout strategy, alignment, and absolute offsets
- build compositor ownership for widget geometry, visibility ordering, dirty regions, and point queries
- add scroll translation, scrollport calculation, and scrollbar chrome injection
- introduce render caches and driver-facing update forms for full and partial redraws
- upgrade layout strategies so sizing comes from styles rather than fixed placeholder rules

Exit criteria:

- compositor and layout tests cover the behaviors in `spec/spec-tests/layouts.md`, `scrolling.md`, `compositor.md`, and `renderables.md`
- scroll changes are compositor translations, not ad hoc widget-local coordinate rewrites
- partial update and full update paths are both exercised in tests

## Phase 5: Input, Bindings, Actions, Commands, Workers, Timers, And Signals

Goal: make the runtime interactive and event-complete.

Scope:

- implement driver input normalization and app-level event routing
- add bindings, action parsing/dispatch, key resolution, and `@on` handler support
- implement command palette providers, search, and system commands
- replace the placeholder timer API with spec-shaped timers, callback messages, and signal publication
- add workers and worker ownership/lifecycle

Exit criteria:

- interaction tests cover bindings, actions, events/messages, workers, timers, and command palette behavior
- driver normalization is the only boundary that converts platform input into framework events
- worker, timer, and signal ownership is observable and deterministic under the test harness

## Phase 6: Widget Base Contract, Core Built-Ins, And Supporting Subsystems

Goal: make the framework usable by implementing the shared widget contract plus the highest-value widget set.

Scope:

- finish widget base behavior: disabled/loading state, pseudo-classes, focus chain rules, scroll helpers, and event forwarding
- add core containers and controls first: `Static`, `Label`, `Button`, `Input`, `ListView`, `OptionList`, `Tabs`/`TabbedContent`, `ContentSwitcher`, `Tree`, `Header`/`Footer`, `ProgressBar`, `Switch`, and `Select`
- implement notifications, validation, suggestions, content helpers, strip/renderable helpers, and theme plumbing required by those widgets
- keep widget APIs thin by relying on the already-built DOM/style/input/compositor layers

Exit criteria:

- widget tests exist for each implemented public widget
- shared behaviors are tested once at the widget-base layer and not duplicated per widget
- the supporting subsystems required by shipped widgets exist as framework services, not widget-local one-offs

// [LAW:one-type-per-behavior] Shared control behaviors should be implemented as common widget/base services or reusable primitives, not copy-pasted independently into each built-in widget.

## Phase 7: Text Editing, Advanced Widgets, And Conformance Closure

Goal: finish the deepest subsystem work and close the highest-value remaining gaps against the spec set.

Scope:

- implement the document model, wrapped document behavior, text-area editing/navigation/history, and syntax/highlighting hooks
- add advanced widgets whose contracts depend on the earlier phases: data table, markdown, rich log, masked input, directory tree, markdown viewer, sparkline, pretty, selection list, and the remaining catalog
- backfill missing testability helpers such as await/remove and await/complete surfaces as needed
- add a maintained conformance tracker that maps implemented tests to `spec/spec-tests` files

Exit criteria:

- text-editing and advanced-widget tests cover the implemented surfaces from `spec/spec-tests/text_area.md`, `document.md`, `markdown.md`, `data_table.md`, and related files
- the conformance tracker identifies which spec-test areas are implemented, in progress, or intentionally deferred
- the remaining gap list is small enough to plan by widget/subsystem rather than by architecture layer

## Recommended Execution Strategy

1. Treat Phases 1 through 4 as architecture phases and do not start broad widget work before they land.
2. Use `spec/spec-tests` as the primary executable backlog for Phases 1 through 7, promoting or adapting tests only when the current spec consolidation report identifies contradictions.
3. Keep each phase shippable behind the headless test harness, with build, lint, and targeted conformance tests required before moving forward.

// [LAW:verifiable-goals] Every phase above ends in deterministic tests and toolable checks; the plan intentionally avoids any phase whose success condition is "manual app testing later."

## Short-Term Recommendation

If implementation resumes now, the next concrete milestone should be Phase 1 plus the beginning of Phase 2:

- add the test harness
- lock down the current bootstrap behavior with tests
- introduce selector/query infrastructure
- replace the current reactive helper before more widget APIs are built on the wrong contract

That sequence keeps the port from hardening around bootstrap shortcuts that will otherwise need to be removed later.
