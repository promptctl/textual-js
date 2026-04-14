# Phase 6: Workers, Timers & Signals

## Preconditions

Phases 1–5 complete:
- Test harness, reactive pipeline, CSS engine, query API, compositor, layout
- Event routing, bindings, actions, widget base contract
- All prior tests pass

Architectural dependency note: This phase's core concepts (workers, timers, signals) depend primarily on Phase 1's MessagePump, not on Phases 2–5. However, since execution is serial, the codebase already has CSS, layout, compositor, bindings, and the widget base contract in place when this phase starts. The implementing agent does not need deep knowledge of those systems — workers, timers, and signals are largely independent subsystems that integrate through the message pump.

## Goal

Deliver async task management, enhanced timer lifecycle, and typed pub/sub coordination.

## Architectural Rationale

// [LAW:single-enforcer] Workers are the single enforcer of async task lifecycle (pending → running → success/error/cancelled). No widget manages its own async tasks outside the worker system.

// [LAW:single-enforcer] Signals are the single enforcer of typed pub/sub. No ad hoc event buses or custom notification patterns.

// [LAW:one-source-of-truth] Timer state lives in the MessagePump. The enhanced timer API replaces the basic `setInterval` wrappers — there is one timer system, not two.

## Current State (before this phase)

**`src/events/message-pump.ts`** has basic timer support:
- `setTimer(name, intervalMs, callback)` — wraps `setInterval`
- `clearTimer(name)` — wraps `clearInterval`
- Timers stored in `Map<string, ReturnType<typeof setInterval>>`
- Timers cleared on `stop()`

**What does NOT exist**:
- No `Worker` class or async task lifecycle
- No `WorkerManager` for per-widget worker ownership
- No `Signal` pub/sub system
- No named timer management beyond basic set/clear
- No timer pause/resume
- No callback messages (timers call raw callbacks, not message-based)

## Scope

### Worker

- `Worker` class: managed async task with lifecycle states: `pending` → `running` → `success | error | cancelled`
- `run_worker(coroutine, options?)` method on Widget — creates and starts a worker
- Decorator equivalent: `@work` or convention-based auto-registration
- Worker cancellation: `worker.cancel()` transitions to `cancelled` state
- Error propagation: unhandled worker errors post a `Worker.StateChanged` message
- Worker completion posts `Worker.StateChanged` message with final state

### WorkerManager

- Owns all workers for a widget instance
- Automatically cancels workers when the owning widget is unmounted
- Provides `cancel_all()`, `wait_for_dismiss()` (wait for all workers to complete or cancel)
- Queryable: list active workers, check if any are running

### Signal

- `Signal<T>` class: typed pub/sub channel
- `signal.subscribe(callback)` — returns unsubscribe function
- `signal.publish(value)` — invokes all subscribers
- Weak-reference subscriber cleanup: subscribers that are garbage-collected are automatically removed
- `immediate` dispatch option: if true, subscriber is called synchronously; if false (default), scheduled via `callLater`

### App-Level Signals

- `theme_changed_signal: Signal<ThemeChangedData>` — published when theme changes
- `app_suspend_signal: Signal<void>` — published when app is suspended
- `app_resume_signal: Signal<void>` — published when app resumes
- `mode_change_signal: Signal<ModeChangeData>` — published when mode switches (consumed by Phase 7)
- `screen_change_signal: Signal<ScreenChangeData>` — published when screen stack changes

### Enhanced Timers

- Replace basic `setInterval` wrappers with spec-shaped timer API
- Named timer management integrated with MessagePump lifecycle
- Timer pause/resume: `pauseTimer(name)`, `resumeTimer(name)`
- Callback messages: timers post `Timer` messages instead of calling raw callbacks — integrates with the message dispatch pipeline
- Timer auto-cleanup on widget unmount (already partially exists via `stop()`)

## Spec References

- `spec/spec-src/07-workers-timers-and-signals.md` — workers, timers, signals specification
- `spec/spec-tests/workers.md` — worker test cases
- `spec/spec-tests/reactivity.md` — signal sections (if signals are covered there)

## Uber-Divergence Resolutions

None directly relevant to this phase.

## Exit Criteria

1. Worker lifecycle tests: pending → running → success, pending → running → error, pending → running → cancelled.
2. WorkerManager tests: auto-cancellation on unmount, `cancel_all()`, worker listing.
3. Signal tests: subscribe, publish, unsubscribe, weak-reference cleanup, `immediate` dispatch.
4. Timer tests: named timers, pause/resume, callback messages, auto-cleanup on stop.
5. App-level signals declared and publish at correct lifecycle points.
6. No residual `setInterval` wrappers — all timers use the enhanced API.
7. All prior phase tests still pass.
8. `npm run build` and `npm run lint` pass.

## What the Next Phase Expects

Phase 7 (App Services) expects:
- Signals working — modes publish `mode_change_signal`, themes publish `theme_changed_signal`
- Workers working — command palette providers use workers for async search
- Enhanced timers working — notifications use timers for auto-dismiss
