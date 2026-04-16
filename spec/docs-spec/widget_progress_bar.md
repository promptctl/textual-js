# Docs Spec: ProgressBar Widget

## Purpose
Describes the `ProgressBar` widget — a visual progress indicator that supports both determinate progress (known total) and indeterminate progress (unknown total, animated bouncing bar), with optional percentage and ETA displays. Teaches readers how to drive progress, interpret completion states, and style or compose the bar.

## Audience
Application authors showing long-running task progress (file transfers, builds, downloads, batch jobs). Also useful as a composition example since `ProgressBar` is itself built from smaller sub-widgets.

## Required sections
1. Overview (determinate vs. indeterminate, composed of bar + percentage + ETA)
2. Characteristics (not focusable, not a container at the user-API level)
3. Props (`total`, `showBar`, `showPercentage`, `showEta`, `gradient`, `clock` for tests, standard widget props)
4. Reactive attributes (`progress`, `total`, `percentage` read-only, `gradient`)
5. Methods (`advance(n)`, `update({total?, progress?, advance?})`)
6. Composition / sub-widgets (`Bar`, `PercentageStatus`, `ETAStatus`) with their IDs
7. Bar component classes (`bar--bar`, `bar--complete`, `bar--indeterminate`)
8. States (indeterminate, in-progress, complete) and their class application
9. Default TCSS (overall bar dimensions and layout, sub-widget widths)
10. Gradient support
11. ETA behavior (sample collection, 1-second tick, reset on `total` change, display format)
12. Validation rules (`total` clamps to non-negative)
13. Messages (none)
14. Bindings (none)
15. Usage patterns

## Key concepts
- The bar has three mutually exclusive states driven entirely by data: `total == null` → indeterminate; `percentage < 1` → in-progress; `percentage >= 1` → complete. The component class applied to the inner `Bar` follows from the state, not from conditional rendering
- `percentage` is a derived reactive: `progress / total` clamped to `[0, 1]`, or `null` if `total` is `null`, or `1.0` if `total` is `0` (to avoid divide-by-zero while still signaling completion)
- `update` accepts any combination of `total`, `progress`, and `advance`; `advance` and `progress` are mutually informative (advance adds, progress sets)
- The three sub-widgets bind their display to the parent reactives — setting `progress`/`total` on the parent re-renders all three consistently (single source of truth for progress state)
- Gradient, when provided, overrides the CSS-driven color scheme for the filled portion of the bar — it is an alternate render path
- ETA is a separate subsystem that samples `(time, fraction)` pairs and updates once per second

## Behaviors and contracts
- Setting `total = null` switches to indeterminate mode and resets the ETA
- Setting `total` to a different non-null value resets the ETA sample buffer
- Setting or advancing `progress` records a new ETA sample
- `progress` advances are cumulative; `update({advance: n})` adds `n` to current progress, while `update({progress: n})` sets progress absolutely
- `total` validation clamps negative values to `0` (negatives are never stored)
- The indeterminate bar is animated at ~15 fps via the framework's auto-refresh mechanism (via Ink timer/animation authority, not a manually scheduled interval)
- When `percentage` crosses `1.0`, the `bar--complete` class is applied; when it drops below 1 again (e.g., the total is increased), it reverts to `bar--bar`
- The inner `Bar` widget quantizes its rendered percentage to avoid re-rendering when the visual change is sub-cell
- ETA display format: `HH:MM:SS` when under 100 hours; `{hours}h` when between 100 and 999999 hours; an overflow marker (`+999999h`) beyond that
- When any of `showBar`, `showPercentage`, `showEta` is false, the corresponding sub-widget is not rendered; the remaining sub-widgets retain their layout behavior

## Example requirements
All JSX/TypeScript using Ink primitives and React function components wrapped with `observer()`. Cover:
- Minimal determinate bar driven by a parent state variable
- Indeterminate bar (no `total` passed) while waiting on an async start
- Using `advance` in a tick callback
- Hiding the ETA / percentage for a minimal chrome variant
- Applying a gradient fill
- Styling each component class (`bar--bar`, `bar--complete`, `bar--indeterminate`) through TCSS

## Cross-references
- `spec/docs-spec/animation.md` — animation authority and tick-based updates
- `spec/docs-spec/api_timer.md` — timers / intervals used by ETA
- `spec/spec-src/05-layout-render-and-compositor.md` — layout of horizontal widget groups
- `spec/spec-src/10-widget-catalog.md` — widget catalog entry
- `spec/spec-src/04-styling-and-css-engine.md` — component-class styling

## Notes for writers
- Python's `UNUSED` sentinel for keyword arguments does not translate; describe `update` as taking an options object with optional `total`, `progress`, `advance` fields
- Do not describe Python's `set_interval` — describe the 1-second ETA tick as using the framework's timer API
- `auto_refresh` is a Python-Textual concept; the animated indeterminate bar is driven by the port's single timing authority (Ink / MobX reaction)
- Python's `Gradient` class becomes whatever gradient type the port exposes; do not invent a new class — describe it as "a gradient value understood by the port"
- Python's `Clock` injection is for testing; describe it as a pluggable clock for deterministic tests, not a first-class API feature
- Do not leak Python `data_bind` terminology; describe sub-widget synchronization as "the sub-widgets read the same reactive state as the parent"
- Call out the three-states-are-derived-from-data contract explicitly (it is a common source of bugs in ports where authors reach for conditional rendering)
