# True North Architecture Refactor

## Status (2026-05-01)

**Phase 7 ("Extract internal services beneath App") — CLOSED.** Epic `textual-true-north-7w9`.

Phase 7 split the `TextualFramework` god-object into ten cohesive internal services (signal registry, binding dispatcher, command service, theme broker, notification service, lifecycle orchestrator, style engine, focus engine, pointer engine, async-resource manager, layout engine, tooltip service, message pump, screen-stack service, widget-type registry) and rewired `App` to compose them directly. The final ticket (`7w9.10`) eliminated the `TextualFramework` class as a public concept — the class is renamed to `AppRuntime`, lives only in `src/framework/_app-runtime.ts`, is not exported from any barrel, and is held privately by `App` as `_runtime`. `Widget`, `DOMQuery`, the React context, the test harness, and every consumer now drive `App` directly: `widget.app`, `useTextual()` returns `App`, `session.app` (the legacy `session.framework` is gone), and `app.X` exposes every method previously reached via `app.framework.X`. `grep -r "TextualFramework" src/ tests/` returns zero. All four verification gates pass.

## Status (2026-04-28)

**Phase 1 ("Declare the Runtime Truth") — CLOSED.** Epic `textual-true-north-thu`.

- `.1` Audit `TextualFramework` public surface — produced `design-docs/textual-framework-public-surface-audit.md` (137 members, ~750 external references).
- `.2` Add App-equivalent methods for definitely-public framework members — `App` now exposes lifecycle, focus, dispatch, async, and sub-API access for every audit-§4.1 member.
- `.3` Rewrite consumer tests to drive App — 26 test files migrated, ~720 callsites changed.
- `.4` Drop TextualFramework from public exports — public + internal barrels cleaned.
- `.5` Migrate `runTest` harness to drive App.
- `.6` Verify `TextualApp` makes no runtime decisions — `[LAW:single-enforcer]` header documents host-bridge role.
- `.7` README and design docs updated to describe App as authority.
- `.8` LAW markers asserting App as runtime root.
- `.9` Architectural guard `scripts/check-framework-imports.ts` — forbids `TextualFramework` imports outside `src/framework/` and `src/app/`, wired into `npm run lint`.

**Phase 2 ("Collapse Identity Models" — reframed as service extraction) — CLOSED.** Epic `textual-true-north-o1w`.

Reframed during execution: rather than collapsing duplicate-identity types (none survived Phase 1 in significant form), Phase 2 extracted internal services from the `TextualFramework` god-object so that Phase 7's "delete the framework shell" becomes mechanical. Each service owns a coherent slice of state, exposes a public API, accepts a narrow injected `Deps` interface, and has no back-reference to `TextualFramework`. Framework retains thin delegators so the public API is unchanged.

- `.5` `ScreenStackService` — modeStacks, modeFactories, installedScreens, activeMode, screenStackVersion, ScreenFactoryRecord; install/push/pop/switch/mode operations.
- `.6` `MessagePump` — queue, prevention discipline, deferred callbacks, dispatch/postMessage/whenIdle/subscribeToMessages/dispatchNodeKeyBindings.
- `.7` `StyleEngine` — userStylesheets, cssPath, cssWatchers, screenStyleCache, pending recalc; setUserStylesheet/setCssPath/refreshStyles/getActiveStylesheetsFor.
- `.8` `FocusEngine` — focusTrapNodeId, blur state, FocusAddress; focusWidget/clearFocusWithin/trapFocus/getFocusChain/focusNext/focusPrevious.
- `.9` `PointerEngine` — hoveredNodeId, pendingPointerClick, lastClickChain; dispatchPointer*, hitTest.
- `.10` `AsyncResourceManager` — timers, appWorkerOwner, appThreadId; setTimer/setInterval/runWorker/runAppWorker/callFromThread.
- `.11` `LayoutEngine` (afterRefreshCallbacks, layoutReaders) + `TooltipService` (tooltipTimer, reveal pipeline).

`TextualFramework` shrank from ~4,100 lines to 2,718 lines; ~1,400 lines extracted into 7 cohesive services totalling ~2,724 lines (each in `src/framework/<service>.{ts}`). Remaining framework concerns (binding/action dispatch, command palette, theme delegation, signal registry, widget-type registry, app lifecycle orchestration) await Phase 7 — most are smaller and more cohesive than the original god-object.

**Phases 3–8 remain aspirational** — open epics: `textual-true-north-czk` (Phase 3), `textual-true-north-224` (Phase 4), `textual-true-north-r1k` (Phase 5), `textual-true-north-9vj` (Phase 6), `textual-true-north-7w9` (Phase 7), `textual-true-north-e0z` (Phase 8). Phase 7's job is now significantly easier: the services exist, dependencies are explicit, and removing the framework shell is mostly deleting the remaining delegators and rewiring `App` to reference services directly.

## Purpose

This document defines the target architecture for `textual-js`.

It is intentionally a north-star plan, not a change list. The goal is to make the system easy to explain, easy to reason about, and aligned with the project laws: one owner for each concept, one runtime authority, one render surface, and one clear internal/public boundary.

`// [LAW:one-source-of-truth] This plan defines exactly one authoritative owner for each runtime concept.`
`// [LAW:single-enforcer] Cross-cutting invariants are assigned to one boundary each.`
`// [LAW:one-type-per-behavior] Public and internal types should not duplicate the same behavior under different names.`
`// [LAW:one-way-deps] Public API flows inward to internal runtime services; internal services do not point back upward to public wrappers.`
`// [LAW:verifiable-goals] The end state is described in terms that can be checked in code, tests, and public API shape.`

## Executive Summary

The end state is:

1. `App` is the only runtime authority.
2. There is one widget identity model.
3. There is one screen model.
4. There is one render surface.
5. There is one style write path and one derived style read model.
6. There is one reactive/state model.
7. There is one async ownership model for timers, workers, and shutdown.
8. Testing drives the same authority production uses.
9. Internal runtime services exist, but they are implementation details beneath `App`, not peer architectures competing with it.

The system should be explainable in one paragraph:

> An `App` owns the runtime. It owns a tree of mounted widgets, a stack of screens, the message loop, styles, focus, pointer routing, and async resources. Widgets and screens are public runtime objects. React/Ink is only the host renderer for those objects. Internal services help `App` do its job, but none of them are alternate runtime authorities.

## Current Architectural Problem

Today the project has the opposite shape:

- the real runtime authority is `TextualFramework`
- `App` is mostly a facade
- `TextualApp` also participates in runtime decisions
- widget behavior is spread across `Widget`, `WidgetNode`, and React host components
- style behavior is spread across several mutable surfaces
- the project exposes more than one state/runtime model

That creates the same class of failure repeatedly: one concept exists in multiple places, and refactors become invasive because there is no single source of truth to target.

## Problem Areas And True North

This section names each major architectural issue directly and states the intended end state.

### 1. Hidden Runtime Root

Problem:

- `TextualFramework` behaves as the real runtime
- `App` presents itself as the public root
- `TextualApp` also participates in runtime decisions

True north:

- `App` is the runtime root
- any framework-like machinery becomes internal to `App`
- `TextualApp` is only a renderer/host integration layer

### 2. Split Widget Architecture

Problem:

- widget behavior is split across `Widget`, `WidgetNode`, and React host constructs
- detached widget construction creates a second ownership model
- mount, lifecycle, and render concerns are not anchored to one widget type

True north:

- there is one canonical widget runtime object
- parent/child ownership, mount state, style state, and lifecycle all belong to that object
- host adapters render widgets but do not define a second widget architecture

### 3. Split Screen Architecture

Problem:

- `Screen` is public
- internal screen stack records hold authoritative state
- render selection and active-screen semantics are spread across layers

True north:

- `Screen` is the canonical screen runtime object
- stack metadata exists, but it does not replace screen identity
- active screen resolution has one owner under `App`

### 4. Multiple Render Surfaces

Problem:

- runtime decisions are shared between runtime objects and host-layer structures
- host lifecycle gates can become de facto render authority

True north:

- runtime state selects what exists
- host rendering paints that state
- there is one conceptual render surface for the system

### 5. Fragmented Style System

Problem:

- style behavior is spread across multiple mutable surfaces
- it is too easy for callers to wonder which style object is canonical

True north:

- each widget has one writable style input model
- the runtime derives one resolved style snapshot from it
- other style views are read-only helpers, not alternate ownership surfaces

### 6. Parallel Reactive Model

Problem:

- the codebase exposes an additional reactive/runtime model beside the main runtime
- that model is not the obvious backbone of the application runtime

True north:

- the project has one reactive model for application/runtime state
- any exported state abstraction either is the real runtime model or does not exist

### 7. Testing Against A Hidden Kernel

Problem:

- tests and harnesses often target the hidden runtime object directly
- that preserves the split between public authority and actual authority

True north:

- test harnesses drive the same public authority production users are meant to understand
- internal services may still be inspected in focused implementation tests, but contract tests target the public runtime model

### 8. God Object Centrality

Problem:

- one very large module owns too many unrelated concerns
- lifecycle, styles, screens, async resources, focus, pointer routing, and overlays all change in the same place

True north:

- `App` remains the authority
- internal services split by change reason, not by arbitrary file size
- authority stays centralized while implementation becomes modular

## End-State Principles

### 1. `App` Owns Runtime

`App` is not a wrapper around the runtime. `App` is the runtime.

In the target architecture, `App` owns:

- widget registry and widget lifecycle
- screen stack and active screen
- focus and pointer routing
- message dispatch
- style cascade and recomputation triggers
- timers, workers, and coordinated shutdown
- notifications, tooltips, command palette, and other app-scoped runtime features
- testing hooks and runtime inspection

Internal services may exist for these concerns, but they are private collaborators owned by `App`.

`// [LAW:one-source-of-truth] Runtime ownership belongs to App alone.`
`// [LAW:single-enforcer] App is the single boundary for lifecycle, dispatch, focus, and shutdown invariants.`

### 2. Public API and Runtime Identity Are the Same Thing

If a user has a public `Widget`, `Screen`, or `App` object, that object should be the runtime object, not a wrapper, mirror, detached precursor, or alias to another internal record.

There should not be:

- a public object and a separate internal runtime object for the same widget
- a public screen object and a separate active screen record that owns the real state
- a public app object and a hidden kernel object that actually runs the program

Public runtime objects may hold internal service references, but those services are not the public concept.

`// [LAW:one-type-per-behavior] Widget behavior should belong to one widget type, not parallel public and internal widget types.`
`// [LAW:one-source-of-truth] Screen and app identity should not be duplicated in wrapper and record form.`

### 3. React/Ink Is a Host Renderer, Not a Peer Runtime

The React layer should exist to render and bind UI to runtime state. It should not be a second owner of lifecycle or identity.

In the target architecture:

- React components render mounted runtime objects
- the runtime decides what exists
- the renderer observes runtime state and paints it
- React host components do not create alternate widget identity
- React host components do not decide what the active app or active screen "really" is

This is the direct answer to the "multiple render surfaces" problem: there is one runtime render surface, and React is the implementation vehicle for it.

`// [LAW:one-source-of-truth] Rendering is derived from runtime state, not jointly owned by runtime and host components.`

### 4. Internal Services Are Small, Crisp, and Non-Authoritative

The target architecture still allows internal services, but their role is narrow:

- message pump
- style engine
- focus engine
- pointer/hit-test engine
- async resource manager
- screen stack manager

These services are not public API surfaces. They do not become alternate domain objects. They exist to keep `App` understandable and reduce blast radius.

`// [LAW:locality-or-seam] Services provide seams so unrelated work does not funnel through one god object.`
`// [LAW:one-way-deps] Services depend on lower-level primitives; App composes them; services do not point back up into public wrappers.`

## Target Object Model

### `App`

`App` is the only runtime root.

It should be the answer to all of these questions:

- What is currently mounted?
- What screen is active?
- Where does this message go?
- Who owns this timer/worker?
- Is the app shutting down?
- What styles are effective here?
- What widget is focused?

If the answer currently lives somewhere else, the long-term goal is to move that authority under `App`.

### `Screen`

`Screen` is a public runtime object owned by `App`.

It is the unit of screen-stack membership, modal behavior, screen-local commands, and screen-local lifecycle.

There should not be a second record type that owns the "real" active screen state while `Screen` is just an API shape.

The runtime may keep stack metadata, but the screen object itself remains the canonical screen identity.

### `Widget`

`Widget` is a public runtime object owned by `App`.

A widget should have:

- one identity
- one parent/child relationship
- one lifecycle state
- one style state entry point
- one source for geometry and hit-testing participation

No second internal widget type should exist with overlapping responsibilities.

If internal storage is needed, it should be a private implementation detail of `Widget`, not a second public-ish type.

### React Widget Components

React widget components are render adapters for runtime widgets.

They should:

- bind runtime state to host rendering
- emit user input back to the runtime
- avoid creating alternate widget ownership or lifecycle rules

They should not be treated as a separate widget architecture.

## Target Ownership Map

### Lifecycle

Owned by `App`.

`App` decides:

- when a widget or screen becomes mounted
- when lifecycle transitions occur
- when unmount/teardown is complete
- when shutdown is complete

No other layer should invent competing notions of "ready", "mounted", or "closed".

### Rendering

Owned by `App` conceptually, executed by the host renderer.

The renderer paints the runtime tree selected by `App`. It does not decide the canonical tree independently.

### Screen Stack

Owned by `App`.

The active screen, modal stack semantics, and dismissal behavior all come from one stack authority.

### Widget Tree

Owned by `App`.

Widgets belong to one app, one parent, one mounted tree. Detached construction may exist as a staging state, but it must not create an alternate long-lived ownership model.

### Styles

Owned by `App` and the style engine it controls.

There should be:

- one mutable style input surface per widget
- one derived resolved style snapshot

Everything else should be a view or helper over those two realities.

`// [LAW:one-source-of-truth] Style writes and style reads should converge onto one input model and one derived output model.`

### Reactive State

Owned by the runtime model chosen by `App`.

The project should expose one coherent answer to:

- how state is stored
- how state changes propagate
- where validation/watch side effects live
- how reactive behavior is observed by the renderer

There should not be a second exported runtime-state architecture competing with the real one.

`// [LAW:one-source-of-truth] The project should have one runtime state model, not a production model plus a parallel exported model.`

### Focus and Pointer Routing

Owned by `App`.

Focus chain construction, pointer targeting, and hit testing must come from one authority so keyboard, mouse, and tests all share the same answer.

### Async Work

Owned by `App`.

Timers, workers, scheduled callbacks, and shutdown draining are app-owned resources. Widget-scoped work is still registered through the app, with ownership metadata pointing back to the widget.

`// [LAW:single-enforcer] Async cleanup rules should be enforced once at the App boundary.`

### Testing and Inspection

Owned by `App`.

Test harnesses should drive the same public runtime authority that production code uses. Tests should not need a separate hidden kernel concept in order to inspect state or drive interaction.

`// [LAW:behavior-not-structure] Contract tests should target public runtime behavior, not preserve internal split-authority shapes.`

## Public vs Internal Boundary

## Public Surface

The public conceptual surface should be:

- `App`
- `Screen`
- `Widget`
- public message/event types
- public style/value/content abstractions

That is the model users should learn.

## Internal Surface

The internal surface may include:

- message queue implementation
- style resolution engine
- host renderer bindings
- hit-testing implementation
- resource managers
- state propagation helpers

These are not alternate public concepts. They are private machinery.

## What Should Disappear Over Time

This document does not prescribe exact code edits, but the target architecture implies that these categories disappear:

- hidden runtime roots that compete with `App`
- duplicate widget types with overlapping behavior
- screen record types that are more authoritative than `Screen`
- host-layer lifecycle gates that compete with runtime lifecycle
- multiple mutable style objects representing the same concept
- alternate exported runtime/state systems that the main runtime does not use
- test harnesses that imply the hidden kernel is the real app
- internal record types that outrank public runtime objects in practice

## Target Module Shape

The end state should be explainable as a small set of layers:

1. **Public Runtime Layer**
   - `App`
   - `Screen`
   - `Widget`

2. **Runtime Services Layer**
   - dispatch
   - styles
   - focus/pointer
   - async resources
   - screen stack
   - state propagation

3. **Host Renderer Layer**
   - React/Ink bindings
   - measurement hooks
   - rendering adapters

4. **Pure Value Layer**
   - geometry
   - content
   - events/messages
   - selectors and style parsing

Dependencies flow downward only.

`// [LAW:one-way-deps] Public runtime composes services, services use pure values, and host rendering depends on runtime state; no upward ownership calls.`

## Migration Direction

This is still a high-level plan, but the sequence matters.

### Phase 1: Declare the Runtime Truth

Make `App` the conceptual runtime authority in docs, tests, and public API direction.

Goal:

- every new architectural decision assumes `App` is the owner
- no new features deepen `TextualFramework` as a peer public runtime

### Phase 2: Collapse Identity Models

Unify app, screen, and widget identity so public objects are the runtime objects.

Goal:

- remove parallel ownership models
- make "what object actually owns this behavior?" always have one answer

### Phase 3: Collapse To One State Model

Choose one reactive/state architecture and make it the only runtime state model.

Goal:

- one answer to how state propagates
- no exported alternate state architecture that is not the real runtime backbone

### Phase 4: Recast React/Ink as Renderer Only

Reduce host-layer lifecycle and identity ownership until React is purely the rendering and input binding mechanism.

Goal:

- no React-host-created alternate widget reality
- no host-side "real render surface" separate from runtime ownership

### Phase 5: Collapse Style And Geometry Ownership

Reduce styles and measurement to one write path and one derived read model.

Goal:

- style input has one owner
- resolved style and geometry are derived once for all consumers
- rendering, hit testing, and tests share the same spatial truth

### Phase 6: Align Testing With Public Authority

Move contract tests and harnesses so they primarily exercise the public runtime model.

Goal:

- the architecture users learn is the architecture tests reinforce
- internal implementation tests exist only where they pay for themselves

### Phase 7: Extract Internal Services Beneath `App`

Split the current god-object behavior into internal services only after ownership is clear.

Goal:

- smaller modules without redistributing confusion
- `App` stays the authority while internals become composable

### Phase 8: Remove Orphaned Alternate Systems

Delete or absorb unused/parallel state systems, duplicate style surfaces, and obsolete runtime abstractions.

Goal:

- one architecture remains
- the exported API matches the architecture that actually runs

## Success Criteria

The refactor is successful when these statements are true:

1. A new contributor can answer "what owns runtime state?" with "`App`" and be correct.
2. A new contributor can answer "what is a widget?" with one type, not a list.
3. A new contributor can answer "what is the active screen?" with one object, not a wrapper plus an internal record.
4. There is one render surface to reason about.
5. There is one answer to how runtime state propagates.
6. Style writes, focus routing, pointer routing, and async cleanup each have one obvious owner.
7. The test harness drives the same runtime authority that production uses.
8. Internal services are implementation details, not alternate architectures.

`// [LAW:verifiable-goals] These criteria can be checked by API shape, module boundaries, test harness usage, and the absence of duplicate runtime owners.`

## Non-Goals

This plan does not require:

- preserving every current internal class name
- keeping compatibility with confusing internal seams
- maximizing short-term refactor convenience

The goal is architectural sanity, not minimal churn.

## Decision Heuristics For Future Work

While the refactor is in progress, decisions should be judged by these questions:

1. Does this make `App` more or less obviously authoritative?
2. Does this reduce or increase the number of owners for the concept?
3. Does this collapse a duplicated runtime surface, or preserve it?
4. Does this collapse toward one state model, or preserve multiple ones?
5. Does this move React/Ink toward pure rendering, or make it more runtime-authoritative?
6. Does this make the system easier to explain in one paragraph?

If a change improves behavior but deepens split authority, it is not moving toward true north.

## Final Statement

The target architecture is not "smaller files" or "less framework."

It is a system where:

- `App` is the runtime
- `Screen` and `Widget` are the real runtime objects
- state propagation follows one runtime model
- React/Ink renders those objects
- styles and geometry have one source of truth
- tests reinforce the public architecture instead of bypassing it
- internal services support the runtime without competing with it
- each important concept has one owner

That is the standard future changes should optimize for.
