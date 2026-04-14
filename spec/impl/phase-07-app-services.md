# Phase 7: Modes, Notifications, Themes & Command Palette

## Preconditions

Phases 1–6 complete:
- Test harness, reactive pipeline, CSS engine, query API, compositor, layout
- Event routing, bindings, action dispatch, widget base contract
- Workers, signals, enhanced timers
- All prior tests pass

## Goal

Deliver the application-level coordination features that sit on top of the infrastructure: multi-mode screen management, notification system, theme engine, command palette, validation framework, and suggestion system.

## Architectural Rationale

// [LAW:single-enforcer] Each service introduced here is the single enforcer of its concern: modes own screen-stack-per-mode logic, the theme engine owns CSS variable resolution, the command palette owns command discovery and execution.

// [LAW:one-way-deps] These services depend on the infrastructure (CSS, signals, bindings, workers) but the infrastructure does not depend on them. They are leaf services, not cross-cutting concerns.

These features are grouped in one phase because they share the same dependency floor (Phases 1–6) and are all "app services" — coordination features that widgets consume but do not implement. In a serial plan, separating them into three phases (as Plan 2 did) adds overhead without adding clarity.

## Current State (before this phase)

**`src/app.ts`** has:
- Screen stack: `pushScreen()`, `popScreen()`, `switchScreen()`
- No mode concept, no `MODES` declaration
- No `notify()` method
- No theme property

**From Phase 5**: Bindings and action dispatch work. `BINDINGS` class variable, `action_<name>` resolution.

**From Phase 6**: Signals work (`theme_changed_signal`, `mode_change_signal` declared). Workers work (for async command palette providers). Enhanced timers work (for notification auto-dismiss).

**From Phase 3**: CSS engine with variable support (`--var-name`) and stylesheet application.

**What does NOT exist**:
- No mode system
- No notification model or toast display
- No theme engine
- No command palette
- No validation framework
- No suggestion/autocomplete system

## Scope

### Modes

- `MODES` static class variable on App: maps mode names to Screen classes
- `switch_mode(mode_name)` — switches to the named mode's screen
- `add_mode(name, screen_class)`, `remove_mode(name)` — dynamic mode management
- Per-mode screen stacks: each mode maintains its own stack of pushed screens
- `mode_change_signal` published on mode switch (from Phase 6)

### Notifications

- `Notification` model: identity (unique ID), severity (`information`, `warning`, `error`), message text, timeout
- `Notifications` collection on App: stores active notifications, supports pruning by timeout or manual removal
- `notify(message, severity?, timeout?)` on DOMNode — funnels to App
- `clear_notifications()` — removes all active notifications
- `_unnotify(notification_id)` — removes a specific notification
- Internal toast widget for notification display — this is internal support UI, not a public built-in widget (per uber-divergence)
- Auto-dismiss via enhanced timers from Phase 6

### Theme Engine

- Named themes with color palettes
- `App.theme` reactive property — setting it applies the theme
- `theme_changed_signal` published on theme change (from Phase 6)
- CSS variable resolution from theme: theme colors available as `--theme-*` CSS variables
- Theme variables participate in the existing CSS cascade from Phase 3

### Command Palette

- `CommandPalette` screen: opened by a binding (typically `ctrl+p`)
- `Provider` base class: async generator that yields `CommandResult` items
- `COMMANDS` static class variable on App and Screen
- Provider replacement semantics: overriding app-level `COMMANDS` replaces the app's default provider set; screen-level providers are added by union (per uber-divergence)
- Discovery mode: discovery hits visible immediately when the palette opens (per uber-divergence)
- Search: fuzzy matching against command names, result highlighting
- Click-away dismissal
- Providers can use workers (Phase 6) for async command discovery

### Validation Framework

- `Validator` base class with `validate(value): ValidationResult`
- Built-in validators: `Number`, `Integer`, `URL`, `Regex`, `Length`, `Function`
- `validate_on` control: when validation runs (`blur`, `changed`, `submitted`)
- `valid_empty` flag: whether an empty value passes validation
- CSS class toggling: `-valid` and `-invalid` classes applied to the widget based on validation state
- Validators integrate with the reactive system (Phase 2) — validation state is reactive

### Suggester

- `Suggester` base class: provides autocomplete suggestions
- Cache with case-insensitive normalization
- `SuggestionReady` message posted when a suggestion is available
- Prefix-match completion: given partial input, return matching suggestions

## Spec References

- `spec/spec-src/01-runtime-app-and-lifecycle.md` — modes
- `spec/spec-src/12-supporting-subsystems.md` — themes, notifications, validation, suggestions
- `spec/spec-src/06-input-bindings-actions-and-commands.md` — command palette
- `spec/spec-tests/notifications.md` — notification test cases
- `spec/spec-tests/app.md` — app-level features (modes, etc.)
- `spec/spec-tests/command_palette.md` — command palette test cases
- `spec/spec-tests/input_validation.md` — validation test cases
- `spec/spec-tests/suggester.md` — suggester test cases

## Uber-Divergence Resolutions

| Issue | Resolution |
|-------|-----------|
| App `COMMANDS` | Override replaces app providers; screen providers union in |
| Command palette initial results | Discovery hits visible immediately |
| Toast surface | Internal support UI, not public built-in |

## Exit Criteria

1. Mode tests: switch mode, per-mode screen stacks, `add_mode`/`remove_mode`, `mode_change_signal` published.
2. Notification tests: `notify()` creates notification, auto-dismiss by timeout, `clear_notifications()`, `_unnotify()`.
3. Theme tests: `App.theme` changes apply CSS variables, `theme_changed_signal` published.
4. Command palette tests: open/close, provider resolution (app override replaces, screen unions), discovery visibility, fuzzy search, click-away dismiss.
5. Validation tests: validator lifecycle, `valid_empty`, CSS class toggling (`-valid`/`-invalid`), `validate_on` controls.
6. Suggester tests: prefix matching, cache behavior, `SuggestionReady` message.
7. All prior phase tests still pass.
8. `npm run build` and `npm run lint` pass.

## What the Next Phase Expects

Phase 8 (Built-in Widgets) expects:
- Validation framework — `Input` widget uses validators
- Suggester — `Input` widget uses suggesters for autocomplete
- Theme engine — widgets use theme CSS variables for styling
- Notifications — widgets can call `notify()`
- Command palette — app can register command providers
- All app services available as framework services, not widget-local one-offs
