# Phase 4: Workers, Signals, Notifications, Themes & Commands

## Preconditions

Phases 1–3 complete:
- React/Ink/MobX foundation, TCSS engine, query API
- Focus manager, screen stack, modes
- Binding/action system, widget base contract
- All prior tests pass

## Goal

Deliver the framework services that widgets depend on: async task management, typed pub/sub, notifications, theming, command palette, input validation, and suggestions.

## Architectural Rationale

// [LAW:single-enforcer] Each service is the single enforcer of its concern: workers own async task lifecycle, the theme engine owns CSS variable resolution, the command palette owns command discovery.

// [LAW:one-way-deps] These are leaf services consumed by widgets. Widgets depend on them; they do not depend on specific widgets.

### Library: uFuzzy

The command palette needs fuzzy matching. uFuzzy is ~4KB, purpose-built for command palettes, and returns highlight ranges for result display. No reason to build a custom fuzzy matcher.

## Current State (before this phase)

**From Phase 1:** MobX reactive state, message system, React/Ink rendering.
**From Phase 2:** TCSS cascade with CSS variables, query API.
**From Phase 3:** Binding system (command palette opened by binding), screen stack (command palette is a screen), focus manager, action dispatch.

**What does NOT exist:**
- No worker system
- No signal pub/sub
- No notifications/toasts
- No theme engine
- No command palette
- No validation framework
- No suggestion/autocomplete system

## Scope

### Workers

- `Worker` class: managed async task with lifecycle states: pending → running → success | error | cancelled
- `useWorker(asyncFn, options?)` hook on widgets — creates and starts a worker
- Worker cancellation: `worker.cancel()` transitions to cancelled, aborts the async operation
- Error propagation: unhandled worker errors post a `Worker.StateChanged` message
- `WorkerManager`: owns all workers for a widget instance, cancels on unmount (via `useEffect` cleanup)
- `cancel_all()`, list active workers

Note: JS has native `AbortController` for cancellation. Workers should use `AbortSignal` internally for cooperative cancellation — this is more idiomatic than Python's approach.

### Signals

MobX's `reaction()` and `when()` provide most of what Textual's Signal does. However, Textual's Signal is a standalone pub/sub channel, not tied to a specific observable. Implementation:

- `Signal<T>` class backed by a MobX observable
- `signal.subscribe(callback)` → returns unsubscribe function (registers a MobX reaction)
- `signal.publish(value)` → updates the observable, triggering all reactions
- Weak-reference cleanup: use `FinalizationRegistry` for subscriber cleanup (or skip if over-engineering — MobX reaction disposal handles it)

App-level signals (MobX observables on the app store):
- `theme_changed_signal`
- `app_suspend_signal` / `app_resume_signal`
- `mode_change_signal`
- `screen_change_signal`

### Enhanced Timers

- Named timer management as a hook: `useTimer(name, intervalMs, callback)`
- Timer pause/resume: `pauseTimer(name)`, `resumeTimer(name)`
- Auto-cleanup on unmount via `useEffect`
- Timers post messages rather than calling raw callbacks (integrates with message dispatch)

### Notifications

- `Notification` model: unique ID, severity (information, warning, error), message text, timeout
- `NotificationStore` (MobX store on app context): tracks active notifications
- `notify(message, severity?, timeout?)` — available to any widget via context
- `clearNotifications()` / `dismissNotification(id)` — **Known divergence**: `dismissNotification(id)` is a textual-js addition; upstream only exposes `clear_notifications()` publicly
- Auto-dismiss via timer
- Internal toast React component for display — not a public widget

### Theme Engine

- Named themes with color palettes
- `App.theme` as MobX observable — setting it applies the theme
- Theme colors available as CSS variables (`--theme-primary`, `--theme-surface`, etc.)
- CSS variables resolve through the TCSS cascade (Phase 2)
- `theme_changed_signal` published on change
- Default theme + dark/light variants

### Command Palette

- Install `ufuzzy` as a runtime dependency
- `CommandPalette` screen component: opened by binding (default: `ctrl+p`)
- `Provider` base class: returns command items (can be async via workers)
- `COMMANDS` static property on App and Screen components
- Provider replacement: overriding app `COMMANDS` replaces app providers; screen providers union in
- Discovery mode: discovery hits visible immediately when palette opens
- Search: uFuzzy fuzzy matching against command names
- Result highlighting: uFuzzy returns highlight ranges, render them
- Click-away or Escape dismissal
- Selected command triggers its action

### Validation Framework

- `Validator` base class: `validate(value): ValidationResult`
- Built-in validators: `NumberValidator`, `IntegerValidator`, `URLValidator`, `RegexValidator`, `LengthValidator`, `FunctionValidator`
- `validate_on` control: when validation runs (blur, changed, submitted)
- `valid_empty` flag: whether empty string passes validation
- CSS class toggling: `-valid` / `-invalid` classes applied to widget (triggers TCSS pseudo-class matching)
- Validators integrate with MobX — validation state is observable

### Suggester

- `Suggester` base class: provides autocomplete suggestions
- Cache with case-insensitive normalization
- `SuggestionReady` message posted when a suggestion matches
- Prefix-match completion

## Spec References

- `spec/spec-src/07-workers-timers-and-signals.md` — workers, timers, signals
- `spec/spec-src/12-supporting-subsystems.md` — themes, notifications, validation, suggestions
- `spec/spec-src/06-input-bindings-actions-and-commands.md` — command palette
- `spec/spec-src/01-runtime-app-and-lifecycle.md` — modes (signal integration)
- `spec/spec-tests/workers.md` — worker test cases
- `spec/spec-tests/notifications.md` — notification test cases
- `spec/spec-tests/command_palette.md` — command palette test cases
- `spec/spec-tests/input_validation.md` — validation test cases
- `spec/spec-tests/suggester.md` — suggester test cases

## Exit Criteria

1. Worker tests: lifecycle states, cancellation via AbortController, error propagation, auto-cancel on unmount.
2. Signal tests: subscribe, publish, unsubscribe.
3. Timer tests: named timers, pause/resume, auto-cleanup.
4. Notification tests: notify, auto-dismiss, clear, dismiss by ID.
5. Theme tests: theme change applies CSS variables, signal published.
6. Command palette tests: open/close, provider resolution (app override replaces, screen unions), discovery visibility, uFuzzy search, Escape dismiss.
7. Validation tests: validator lifecycle, valid_empty, CSS class toggling.
8. Suggester tests: prefix matching, cache, SuggestionReady message.
9. All prior phase tests still pass.
10. `npm run build` and `npm run lint` pass.

## What the Next Phase Expects

Phase 5 (Core Widgets) expects:
- Validation framework — Input widget uses validators
- Suggester — Input widget uses suggestions
- Theme engine — widgets use theme CSS variables
- Notifications — widgets call notify()
- All framework services available as context-provided stores
