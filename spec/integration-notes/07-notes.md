# Integration notes for spec-src/07-workers-timers-and-signals.md

## Critical context

- **Rich-js role**: minimal. Workers, timers, and signals are type-parametric — they can carry any type including rich-js types, but the subsystems themselves don't depend on rich-js.
- **Terminal-UI reality**: `Worker.description` is displayed (command palette, error messages, devtools); may be rich-js `Content`. Signals are commonly used to broadcast theme changes that carry rich-js `Color` values.

## Gaps to fix

### 1. Worker description type

**Where**: Worker interface table.
**Current state**: `description: string`.
**Why insufficient**: Descriptions are shown in devtools / command palette / error dialogs. Should allow markup for consistency with other user-facing strings.
**Required change**: Change `description: string` to `description: string | Content`. Note: resolves to plain text when displayed in contexts that don't support styling.

### 2. Signal<T> type-parameter examples

**Where**: Signal introduction or App-level signals section.
**Current state**: Generic `Signal<T>` described abstractly.
**Why insufficient**: Several app-level signals carry rich-js types; explicit examples help.
**Required change**: Add a sentence where app-level signals are introduced: "Signal type parameters are unconstrained and frequently carry rich-js types. Examples in the framework: `theme_changed_signal: Signal<Theme>` (Theme contains rich-js `Color` instances); `notification_added_signal: Signal<Notification>` (Notification contains `Content`); `workers_changed_signal: Signal<Worker[]>`."

## Do not change

- Worker lifecycle and state machine
- AbortController cancellation model
- WorkerManager methods and semantics
- Timer model (drift-free, skip mode, named, pausable, resettable)
- Signal subscribe/publish behavior
- Weak subscriber cleanup
- Signals vs MobX reactions guidance table
- App-level signal inventory (theme_changed_signal, app_suspend_signal, app_resume_signal, mode_change_signal, screen_change_signal)
