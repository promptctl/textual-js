# Textual-JS Implementation Plan

Audit date: 2026-04-13

This plan merges the architectural depth of plan1 with the execution granularity of plan2 into 10 self-contained phase files. Each phase file contains all context a fresh agent needs to execute that phase independently.

## Evidence Snapshot

- Runtime surface: 22 TypeScript source files under `src/`.
- `npm run build` passes.
- `npm run lint` passes.
- `npm test` fails — no test files exist.
- `src/widgets/` is empty.
- `src/css/` is empty.
- Implemented public surface: geometry primitives, `Message`/`MessagePump`, `DOMNode`, `Widget`, `Screen`, `App`, three layout strategies, function-based reactive helpers.

## Architectural Principles

// [LAW:single-enforcer] Each subsystem introduced by a phase becomes the single enforcer of its concern. No later phase duplicates its responsibility.

// [LAW:one-source-of-truth] Each concept has exactly one authoritative representation. Derived views are synchronized through the owner.

// [LAW:one-way-deps] Dependencies flow downward: App → Screen → Widget → DOMNode → MessagePump. No back-edges. No cycles.

// [LAW:one-type-per-behavior] Shared widget behaviors are implemented once at the base layer, not copied into each built-in widget.

// [LAW:verifiable-goals] Every phase ends in deterministic tests and toolable checks. No phase whose success condition is "manual app testing later."

### Enforcement Boundaries

The spec assumes five cross-cutting enforcement boundaries that the bootstrap codebase does not yet have. The phases introduce them in dependency order:

1. **Test harness** as the single enforcer of runtime verification (Phase 1)
2. **Reactive pipeline** as the single enforcer of validation, watchers, computes, and refresh scheduling (Phase 2)
3. **Stylesheet** as the single enforcer of style resolution (Phase 3)
4. **Compositor** as the single enforcer of geometry, visibility, and dirty regions (Phase 4)
5. **Driver** as the single enforcer of platform input/output normalization (Phase 9)

The driver is deferred until the infrastructure and architecture are fully capable of supporting it — it is designed against a stable foundation, not a moving target.

## Phase Map

| Phase | File | Title | Enforcement Boundary |
|-------|------|-------|---------------------|
| 1 | `phase-01-verification-harness.md` | Verification Harness & Lifecycle Lockdown | Test harness |
| 2 | `phase-02-reactive-pipeline.md` | Full Reactive Pipeline | Reactive descriptors |
| 3 | `phase-03-css-and-query.md` | CSS Engine, Selectors & Query API | Stylesheet |
| 4 | `phase-04-layout-and-compositor.md` | Style-Driven Layout, Compositor & Scrolling | Compositor |
| 5 | `phase-05-input-bindings-actions.md` | Input, Bindings, Actions & Widget Base Contract | Binding/action dispatch |
| 6 | `phase-06-workers-timers-signals.md` | Workers, Timers & Signals | Async task lifecycle, pub/sub |
| 7 | `phase-07-app-services.md` | Modes, Notifications, Themes & Command Palette | App-level coordination |
| 8 | `phase-08-built-in-widgets.md` | Built-in Widgets | Widget catalog |
| 9 | `phase-09-driver.md` | Driver Interface & HeadlessDriver | Platform I/O normalization |
| 10 | `phase-10-text-editing-advanced-animation.md` | Text Editing, Advanced Widgets, Animation & Conformance | Final subsystems |

## Execution Rules

1. Phases execute serially. No parallel tracks.
2. Each phase gates on the prior phase's exit criteria. Do not start Phase N+1 until Phase N passes.
3. Phases 1–4 are architecture phases. Do not start widget work before they land.
4. Use `spec/spec-tests/` as the primary executable backlog, promoting or adapting tests when the consolidation report identifies contradictions.
5. Keep each phase shippable: build, lint, and targeted conformance tests must pass before moving forward.
6. When the spec and uber-divergence conflict, follow the uber-divergence resolution documented in each phase file.

## Spec Contradictions Reference

Follow the resolutions in `spec/uber-divergence.md`. Key resolved divergences:

| Issue | Resolution |
|-------|-----------|
| `reactive()` `init` default | Defaults to `init: true` |
| Reactive pipeline order | Validate → store → watch → compute dependents |
| Widget ID uniqueness | DOM/screen-wide (HTML semantics) |
| `check_action(null)` | Disabled but visible (not hidden) |
| App `COMMANDS` | Override replaces app providers; screen providers union in |
| Command palette initial results | Discovery hits visible immediately |
| CSS `initial` | Property-sensitive fallback |
| Sparkline width/reduction | `width=null` uses render width; default reduction is `max` |
| `ContentSwitcher` child IDs | Constructor tolerates ID-less; `add_content` requires ID |
| `Tabs`/`TabbedContent` APIs | Layered: `Tabs.hide()`/`show()` vs `TabbedContent.hide_tab()`/`show_tab()` |
| `force_stop_animation` | Schedule `on_complete` via `call_later` |
| Toast surface | Internal support UI, not public built-in |

## Conformance Tracker

Updated at each phase boundary. Every "Implemented" row must correspond to a passing test file.

| spec-tests file | Phase | Status | Test file(s) |
|----------------|-------|--------|-------------|
| `geometry.md` | 1 | — | — |
| `events_and_messages.md` | 1 | — | — |
| `app.md` | 1 | — | — |
| `reactivity.md` | 2 | — | — |
| `css_parsing.md` | 3 | — | — |
| `css_styles.md` | 3 | — | — |
| `dom.md` | 3 | — | — |
| `layouts.md` | 4 | — | — |
| `compositor.md` | 4 | — | — |
| `scrolling.md` | 4 | — | — |
| `bindings_and_actions.md` | 5 | — | — |
| `widget.md` | 5 | — | — |
| `workers.md` | 6 | — | — |
| `notifications.md` | 7 | — | — |
| `command_palette.md` | 7 | — | — |
| `button.md` | 8 | — | — |
| `input.md` | 8 | — | — |
| `driver.md` | 9 | — | — |
| `text_area.md` | 10 | — | — |
| `animations.md` | 10 | — | — |
