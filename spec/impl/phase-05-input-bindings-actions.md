# Phase 5: Input, Bindings, Actions & Widget Base Contract

## Preconditions

Phases 1–4 complete:
- Test harness, reactive pipeline, CSS engine, query API
- Compositor with point queries (for mouse hit-testing)
- Style-driven layout producing correct widget placements
- All prior tests pass

## Goal

Make the framework interactive: key/mouse events route through bindings to actions, and the widget base contract is complete enough to build widgets on.

## Architectural Rationale

// [LAW:single-enforcer] Bindings are the single enforcer of key-to-action mapping. Action dispatch is the single enforcer of `action_<name>` resolution. No widget implements its own key-to-behavior mapping outside the binding system.

// [LAW:one-type-per-behavior] The widget base contract (disabled-state gating, loading state, `_forward_event`, pseudo-classes) is implemented once here. Every built-in widget in Phase 8 consumes these behaviors — none reimplements them.

Note on input normalization: Without a driver (Phase 9), events are posted by the Pilot directly as already-normalized `Key`, `Click`, `MouseDown`, etc. The event types and routing logic are implemented here. The driver's `process_message` normalization boundary comes in Phase 9 — for now, Pilot posts already-normalized events and that is sufficient.

## Current State (before this phase)

**Event types exist** (`src/events/events.ts`): `Key` (with `key` and `character`), `MouseDown`/`MouseUp`/`MouseMove`/`Click`/`ScrollEvent` — all with coordinates and bubble=true.

**MessagePump dispatch works**: handler resolution by `_on<Type>`/`on<Type>` naming, bubbling to parent.

**Screen has focus management**: `setFocus()`, `focusNext()`, `focusPrevious()`, focus chain.

**Compositor has point queries**: given (x, y), returns the topmost widget.

**What does NOT exist**:
- No event routing from App to correct target widget
- No `Binding` model or `BINDINGS` class variable
- No action dispatch (`action_<name>`)
- No key name normalization or parsing
- No `check_action` for binding visibility/enabled state
- No disabled-state event gating
- No `_forward_event` for event delegation
- No loading state or loading overlay
- No tooltip surface
- No pseudo-classes
- No `@on` handler support

## Scope

### Event Routing

- `App.on_event(event)` routes events to the active screen
- Screen routes key events to the focused widget
- Screen routes mouse events to the widget at the event's (x, y) coordinates — using compositor point queries
- Events bubble upward through the DOM via MessagePump's existing bubbling mechanism
- Focus/Blur events posted when `Screen.setFocus()` changes target (currently `_setFocus` updates the flag but does not post Focus/Blur messages — fix this)

### Binding Model

- `Binding` class: maps a key (e.g., `"ctrl+s"`) to an action name (e.g., `"save"`) with optional description, priority, and show flag
- `BINDINGS` static class variable on Widget, Screen, and App — array of `Binding` declarations
- Binding resolution order: focused widget → ancestors → screen → app
- First matching binding wins (priority resolution)

### Action Dispatch

- When a binding matches, the framework calls `action_<name>(...)` on the appropriate target
- Namespace support: `"app.quit"` routes to `app.action_quit()`, `"screen.focus_next"` routes to `screen.action_focus_next()`
- Actions can take string arguments parsed from the binding: `"toggle_dark"` calls `action_toggle_dark()`

### check_action

- `check_action(action_name)` method on Widget/Screen/App
- Returns `true` → action is enabled (binding shown normally)
- Returns `false` → action is hidden (binding not shown)
- Returns `null` → action is disabled but visible (binding shown grayed out)
- Per uber-divergence: `null` means disabled but visible, NOT hidden

### Key Parsing and Normalization

- Parse key names: `"ctrl+c"`, `"shift+tab"`, `"escape"`, `"enter"`, `"f1"` through `"f12"`, letter keys, etc.
- Normalize aliases: `"return"` → `"enter"`, `"esc"` → `"escape"`
- Key matching: given a `Key` event, find matching bindings by comparing normalized key names

### Widget Base Contract Completion

- **Disabled state**: `disabled` reactive property. Disabled widgets suppress pointer interactions (MouseDown, MouseUp, Click, MouseMove) except wheel scroll. Events are consumed, not bubbled.
- **`_forward_event`**: event delegation mechanism — a widget can forward events it receives to another widget
- **Loading state**: `loading` reactive property. Loading overlay suppresses all interaction. Visual indicator via pseudo-class.
- **Tooltip surface**: `tooltip` reactive property. Posts a tooltip message when hovered.
- **Pseudo-classes**: `:focus`, `:hover`, `:disabled`, `:loading`, and other state-driven pseudo-classes. These affect CSS selector matching from Phase 3.
- **Focus chain rules**: `canFocus`, `canFocusChildren`, focus ordering (tab index equivalent)

### @on Handler Support

- Decorator or convention for declaring event handlers with selector filtering
- `@on(EventType, selector?)` — handler only fires if event came from a widget matching the selector

## Spec References

- `spec/spec-src/06-input-bindings-actions-and-commands.md` — bindings and actions
- `spec/spec-src/09-widget-base-contract.md` — widget base contract
- `spec/spec-src/03-message-event-and-dispatch.md` — dispatch routing
- `spec/spec-tests/bindings_and_actions.md` — binding/action test cases
- `spec/spec-tests/widget.md` — widget base contract test cases
- `spec/spec-tests/input.md` — input event test cases

## Uber-Divergence Resolutions

| Issue | Resolution |
|-------|-----------|
| `check_action(null)` | Disabled but visible (not hidden). `false` = hidden. |

## Exit Criteria

1. Event routing tests: key events reach focused widget, mouse events reach correct target via compositor point query.
2. Binding resolution tests: focused widget bindings override screen bindings override app bindings.
3. Action dispatch tests: `action_<name>` called on correct target, namespace routing works.
4. `check_action` tests: `true`/`false`/`null` states produce correct binding visibility.
5. Disabled-state tests: disabled widget suppresses pointer events except scroll wheel.
6. Loading-state tests: loading widget suppresses all interaction.
7. Pseudo-class tests: `:focus`, `:disabled`, `:loading` affect CSS selector matching.
8. Focus/Blur events posted when focus changes — verified by test.
9. All prior phase tests still pass.
10. `npm run build` and `npm run lint` pass.

## What the Next Phase Expects

Phase 6 (Workers, Timers & Signals) expects:
- Action dispatch working — workers can be triggered by actions
- Event routing working — signal-driven events route correctly
- Widget base contract complete — workers attach to widgets with lifecycle cleanup on unmount
