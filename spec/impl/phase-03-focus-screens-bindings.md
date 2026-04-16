# Phase 3: Focus, Screens, Bindings & Actions

## Preconditions

Phases 1–2 complete:
- React/Ink/MobX foundation, test harness, message system
- TCSS engine with css-tree, selector matching, query API
- Pseudo-class support (`:focus`, `:disabled`) in selectors
- Widget registry with parent references
- All prior tests pass

## Goal

Make the framework interactive: focus management, screen stack with modes, and the key binding/action dispatch system.

## Architectural Rationale

// [LAW:single-enforcer] The focus manager is the single enforcer of which widget has focus. The binding system is the single enforcer of key-to-action mapping. The screen stack is the single enforcer of which screen is active.

// [LAW:one-type-per-behavior] The widget base contract (disabled-state gating, loading state, tooltip) is implemented once via hooks/context. Every widget consumes it — none reimplements it.

// [LAW:dataflow-not-control-flow] Key event handling is a fixed pipeline: key → normalize → match bindings (widget → ancestors → screen → app) → dispatch action. Every step always runs. An empty binding list at any level is a no-op, not a skipped step.

## Current State (before this phase)

**From Phase 1:**
- Message system with dispatch and bubbling through React component tree
- `Key` event type with `key` and `character` fields
- MobX reactive state on widgets
- TextualApp root component with context

**From Phase 2:**
- Widget registry with CSS identity and parent references
- Query API — can query focusable widgets
- Pseudo-class `:focus` supported in selectors (but nothing sets focus yet)
- `:disabled` pseudo-class supported

**What does NOT exist:**
- No focus manager
- No screen stack or modes
- No key binding system
- No action dispatch
- No disabled-state event gating
- No loading state
- No tooltip

## Scope

### Focus Manager

- `FocusManager` (MobX store, provided via TextualApp context)
- Tracks the currently focused widget (MobX observable)
- `setFocus(widget)` — changes focus, updates `:focus` pseudo-class on old and new widgets
- `focusNext()` / `focusPrevious()` — moves focus through the focus chain
- Focus chain: all widgets with `canFocus: true` in DOM order (queried from registry)
- `canFocus` and `canFocusChildren` properties on widget registration
- Focus changes trigger `:focus` pseudo-class update → TCSS recalculation → re-render
- Tab / Shift+Tab default bindings for focus navigation

### Screen Stack

- `ScreenStack` (MobX store, provided via TextualApp context)
- The active screen is a React component rendered by TextualApp
- `pushScreen(ScreenComponent)` — pushes a new screen, renders it on top
- `popScreen()` — removes the top screen, reveals the one below
- `switchScreen(ScreenComponent)` — replaces the current screen
- Screen components are regular React components with Textual framework integration
- Each screen has its own focus chain
- Screen transitions post `ScreenResume` / `ScreenSuspend` messages

### Modes

- `MODES` static property on the App component: maps mode names to Screen components
- `switchMode(modeName)` — switches to the named mode's screen
- `addMode(name, ScreenComponent)` / `removeMode(name)` — dynamic mode management
- Per-mode screen stacks: each mode maintains its own stack
- `mode_change_signal` published on mode switch (if signals exist; otherwise deferred to Phase 4)

### Key Binding System

- `Binding` type: `{ key: string, action: string, description?: string, priority?: boolean, show?: boolean }`
- `BINDINGS` static property on widget components — array of Binding declarations
- Binding resolution order: focused widget → ancestors → active screen → app
- First matching binding wins
- Key normalization: `"ctrl+c"`, `"shift+tab"`, `"escape"`, `"enter"`, `"f1"`–`"f12"`, etc.
- Ink handles stdin parsing and provides key events — we match against normalized key names

### Action Dispatch

- When a binding matches, call `action_<name>()` on the appropriate target
- Namespace support: `"app.quit"` → app's `action_quit()`, `"screen.focus_next"` → screen's `action_focus_next()`
- Actions are methods on the widget/screen/app — resolved by naming convention
- Action arguments: `"delete(confirm=true)"` → `action_delete({ confirm: true })`

### check_action

- `check_action(actionName)` method on widgets/screens/app
- Returns `true` → action enabled, binding shown normally
- Returns `false` → action hidden, binding not shown
- Returns `null` → action disabled but visible, binding shown grayed out
- `null` = disabled but visible

### Widget Base Contract

- **Disabled state**: `disabled` MobX observable. Disabled widgets suppress pointer interactions except scroll. Updates `:disabled` pseudo-class. Events consumed, not bubbled.
- **Loading state**: `loading` MobX observable. Loading overlay suppresses all interaction. Updates `:loading` pseudo-class.
- **Tooltip**: `tooltip` MobX observable. Posts tooltip message on hover.
- **`_forward_event`**: event delegation — a widget can forward received events to another widget
- These are implemented as hooks or mixins consumed by all widgets — not reimplemented per widget.

### @on Handler Support

- Convention for declaring event handlers with selector filtering
- `on<EventType>` handler on a widget only fires if the event matches a specified selector
- Implementation via the message dispatch system from Phase 1

## Spec References

- `spec/spec-src/06-input-bindings-actions-and-commands.md` — bindings and actions
- `spec/spec-src/09-widget-base-contract.md` — widget base contract
- `spec/spec-src/01-runtime-app-and-lifecycle.md` — screen stack, modes
- `spec/spec-src/03-message-event-and-dispatch.md` — dispatch routing
- `spec/spec-tests/bindings_and_actions.md` — binding/action test cases
- `spec/spec-tests/widget.md` — widget base contract test cases
- `spec/spec-tests/input.md` — input event test cases
- `spec/spec-tests/app.md` — screen stack, mode test cases

## Exit Criteria

1. Focus tests: setFocus changes `:focus` pseudo-class, focusNext/focusPrevious cycle through chain.
2. Screen stack tests: push/pop/switch, correct screen renders, ScreenResume/ScreenSuspend messages.
3. Mode tests: switchMode, per-mode screen stacks, dynamic add/remove mode.
4. Binding resolution tests: focused widget → ancestors → screen → app priority.
5. Action dispatch tests: `action_<name>` called on correct target, namespace routing.
6. `check_action` tests: true/false/null produce correct binding visibility.
7. Disabled-state tests: disabled widget suppresses pointer events except scroll.
8. Loading-state tests: loading widget suppresses all interaction.
9. Tab/Shift+Tab navigate focus — verified via Pilot.
10. All prior phase tests still pass.
11. `npm run build` and `npm run lint` pass.

## What the Next Phase Expects

Phase 4 (App Services) expects:
- Focus manager — command palette needs to manage its own focus
- Screen stack — command palette is a pushed screen
- Binding system — command palette opened by a binding (ctrl+p)
- Action dispatch — notification dismiss, worker cancel are actions
- Widget base contract — built-in widgets use disabled/loading states
