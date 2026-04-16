# Textual-JS Implementation Plan

Audit date: 2026-04-14

A terminal UI application framework built as a React component library on Ink. Ported from Python's Textual, adapted to leverage the JS ecosystem.

## Architecture

textual-js is NOT a port of Textual's rendering engine. It is a port of Textual's **application framework** — the screen stack, focus chain, binding/action system, TCSS styling, widget catalog, command palette, and supporting subsystems — built on top of React/Ink instead of Textual's custom rendering pipeline.

### What the JS ecosystem provides

| Concern | Library | Replaces |
|---------|---------|----------|
| Component model & reconciliation | **React** | DOMNode, NodeList, manual tree management |
| Terminal rendering & layout | **Ink** (Yoga flexbox) | Custom layout engine, compositor, driver, ANSI output |
| Reactive state & dependency tracking | **MobX** | Custom reactive.ts, manual refresh scheduling |
| CSS parsing & selector matching | **css-tree** | Custom TCSS tokenizer/parser |
| Fuzzy search | **uFuzzy** | Custom command palette matcher |
| Markdown parsing | **marked** | Custom markdown parser |
| Syntax highlighting | **Shiki** | Custom syntax/highlighting hooks |

### What we build

The application framework layer that none of these libraries provide:

- TCSS cascade with specificity, variables, pseudo-classes → translated to Ink style props
- Focus management: focus chain, tab navigation, focus groups
- Screen stack with push/pop/switch, modes
- Key binding system with action dispatch
- Message system with bubbling and coalescing
- Widget catalog: 30+ interactive components as React/Ink components
- Command palette, notifications, themes, validation, suggestions
- Text editing subsystem (Document, TextArea)
- Worker lifecycle management, signals

### Enforcement Boundaries

// [LAW:single-enforcer] Each subsystem is the single enforcer of its concern.

1. **MobX** is the single enforcer of reactive state, validation, watchers, and computed values (Phase 1)
2. **css-tree + our cascade** is the single enforcer of style resolution (Phase 2)
3. **React** is the single enforcer of rendering and tree reconciliation (foundation)
4. **Ink** is the single enforcer of terminal I/O and layout (foundation)
5. **The binding system** is the single enforcer of key-to-action mapping (Phase 3)

### What happens to the existing codebase

The initial bootstrap (`src/`) was written for a renderer-agnostic architecture with custom tree management. With React/Ink as the foundation:

| Existing module | Disposition |
|----------------|-------------|
| `geometry/` (Size, Offset, Region, Spacing) | **Keep** — still useful for internal calculations |
| `events/message.ts` (Message base class) | **Keep and adapt** — message types still needed |
| `events/message-pump.ts` (MessagePump) | **Rework** — message dispatch adapted for React component tree |
| `events/events.ts` (built-in events) | **Keep and extend** — event types still needed |
| `dom-node.ts` (DOMNode) | **Replace** — React component tree replaces manual tree linkage |
| `node-list.ts` (NodeList) | **Replace** — React owns children |
| `widget.ts` (Widget) | **Replace** — becomes a React component pattern |
| `screen.ts` (Screen) | **Replace** — becomes a React component |
| `app.ts` (App) | **Replace** — becomes a React component (root provider) |
| `reactive.ts` | **Replace** — MobX |
| `layout/` (all) | **Remove** — Yoga via Ink |

## Phase Map

| Phase | File | Title | Libraries Introduced |
|-------|------|-------|---------------------|
| 1 | `phase-01-foundation.md` | React/Ink + MobX Foundation | react, ink, mobx, mobx-react-lite |
| 2 | `phase-02-tcss-and-query.md` | TCSS Engine & Query API | css-tree |
| 3 | `phase-03-focus-screens-bindings.md` | Focus, Screens, Bindings & Actions | — |
| 4 | `phase-04-app-services.md` | Workers, Signals, Notifications, Themes & Commands | uFuzzy |
| 5 | `phase-05-core-widgets.md` | Core Widget Catalog | — |
| 6 | `phase-06-advanced-widgets.md` | Advanced Widgets & Text Editing | marked, Shiki |
| 7 | `phase-07-animation-conformance.md` | Animation & Conformance Closure | — |

## Execution Rules

1. Phases execute serially. No parallel tracks.
2. Each phase gates on the prior phase's exit criteria. Do not start Phase N+1 until Phase N passes.
3. Phase 1 is the architecture phase. Do not start framework features before it lands.
4. Use `spec/spec-tests/` as the primary executable backlog.
5. Keep each phase shippable: build, lint, and targeted tests must pass before moving forward.

## Conformance Tracker

Updated at each phase boundary. Every "Implemented" row must correspond to a passing test file.

| spec-tests file | Phase | Status | Test file(s) |
|----------------|-------|--------|-------------|
| `geometry.md` | 1 | Phase 1 foundation | `tests/geometry.test.ts` |
| `events_and_messages.md` | 1 | Phase 1 foundation | `tests/message.test.tsx` |
| `reactivity.md` | 1 | Phase 1 foundation | `tests/reactive.test.ts` |
| `app.md` | 1 | Phase 1 foundation | `tests/app.test.tsx`, `tests/integration.test.tsx` |
| `css_parsing.md` | 2 | — | — |
| `css_styles.md` | 2 | — | — |
| `dom.md` | 2 | — | — |
| `bindings_and_actions.md` | 3 | — | — |
| `widget.md` | 3 | — | — |
| `workers.md` | 4 | — | — |
| `notifications.md` | 4 | — | — |
| `command_palette.md` | 4 | — | — |
| `button.md` | 5 | — | — |
| `input.md` | 5 | — | — |
| `list_view.md` | 5 | — | — |
| `data_table.md` | 6 | — | — |
| `text_area.md` | 6 | — | — |
| `markdown.md` | 6 | — | — |
| `animations.md` | 7 | — | — |
