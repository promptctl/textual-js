# Docs Spec: Testing textual-js Apps

## Purpose
Describes a docs page teaching app authors how to write automated tests for textual-js applications using Vitest and ink-testing-library, including headless app execution, simulated input, assertions on state, and snapshot/visual regression workflows.

## Audience
App authors writing unit and integration tests; CI engineers; widget authors verifying widget behavior.

## Required sections
1. Testing approach and philosophy (headless execution, deterministic simulated input, assertion-driven).
2. Recommended test stack (Vitest, ink-testing-library, plus any textual-js-provided test helpers).
3. Running an app under test -- the textual-js equivalent of Textual's `run_test()` context: a headless harness that mounts the app, yields a pilot/driver handle, and tears down cleanly.
4. Pilot/driver API -- the surface used to drive input and inspect state:
   - Properties (reference to app instance).
   - Pressing keys (single keys, multi-key sequences, modifier combinations such as `ctrl+c`).
   - Mouse interactions (click, double/triple click, hover, mouseDown/mouseUp), including selector-based and widget-instance-based targeting, offset-based targeting, and modifier keys.
   - Coordinate system and bounds checking (origin at top-left, errors on out-of-bounds).
   - Resizing the simulated terminal.
   - Pausing to let messages and reactive effects settle.
   - Waiting for animations to finish (current and scheduled).
   - Programmatic exit with a return value.
5. Error propagation (what happens when compose, handlers, workers, or stylesheets fail inside a test -- errors surface to the test runner, not silenced).
6. Simulating user interaction patterns (examples for keys, clicks, resizes).
7. Snapshot testing -- capturing terminal output and comparing against stored snapshots, including invalidation/update workflow.
8. Test ergonomics -- async handling, settling via pause, asserting reactive state.
9. Constraints and contracts the pilot guarantees (no clamping on out-of-bounds; discrete key events; exceptions never swallowed; tooltips/notifications off by default during tests and opt-in).

## Key concepts
- The test harness runs the app without a real terminal, using the in-memory Ink renderer surface provided by ink-testing-library.
- The pilot is the single authoritative surface for simulating input; app internals are not driven directly.
- Every user-simulated operation is a Promise that must be awaited; message and reactive effect queues drain between operations via an explicit `pause()`.
- Terminal size is a parameter of the harness entry, with a default (e.g., 80 x 24) and a dynamic resize API.
- Click/hover return a boolean indicating whether the intended widget was actually hit (`false` if obscured by another widget); out-of-bounds raises, does not silently clamp.
- Exceptions propagate -- compose, handlers, actions, workers all surface errors to the test.
- Snapshot testing captures the rendered frame as text (Ink's output buffer) or a richer representation; test runs update snapshots via an update flag.

## Behaviors and contracts
- Entering the test harness composes and mounts the app fully before the test body begins.
- `press(...keys)` treats every argument as a discrete key event; no batching or coalescing.
- `click`, `hover`, `mouseDown`, `mouseUp` must:
  - Accept a CSS selector string, a widget class/type reference, or a widget instance.
  - Accept an `offset` relative to the target (or to the screen if no target).
  - Raise on out-of-bounds coordinates.
  - Return `true` if the target is hit, `false` if obscured.
- `resizeTerminal(width, height)` posts a Resize event and updates `app.size` / `app.screen.size` consistently.
- `pause()` waits for all pending reactive effects and queued messages to settle; `pause(delay)` additionally advances by at least the given duration.
- `waitForAnimation()` and `waitForScheduledAnimations()` wait for running and queued animations respectively.
- `exit(value)` shuts down the app and makes the return value observable after the harness closes.
- Stylesheet parse errors surface at harness entry.
- Tooltips and notifications are disabled by default in tests; opt-in via harness options.
- Bounds errors are never silenced; the test must observe them.

## Example requirements
All examples must be TypeScript with Vitest and ink-testing-library. Examples must demonstrate:
- A minimal test: mount an app headlessly, press a key, assert on app state.
- Multi-key sequences and modifier-key combinations.
- Selector-based click, class/type-based click, instance-based click, and offset targeting.
- Double and triple click via a `times` option (or helper methods).
- Hovering and then asserting hover-related state.
- Resizing the terminal mid-test and asserting on re-layout.
- A pause-then-assert pattern after a programmatic mutation.
- Exiting with a return value and inspecting it after the harness closes.
- Catching an exception raised by a handler using the test runner's expected-throws API.
- A snapshot test and the update workflow.

## Cross-references
- `spec/spec-src/13-testability-and-automation-surfaces.md` -- canonical behavioral spec for pilot/test-harness.
- `spec/spec-src/01-runtime-app-and-lifecycle.md` -- lifecycle order invoked by the harness.
- `spec/spec-src/03-message-event-and-dispatch.md` -- message draining semantics for `pause()`.
- `spec/docs-spec/tutorial.md` -- the tutorial app is a reasonable target for integration-test examples.

## Notes for writers
- Do not mention pytest, pytest-asyncio, `asyncio_mode = auto`, `pytest.mark.asyncio`, or `pytest-textual-snapshot`. The JS equivalents are Vitest and ink-testing-library; if a dedicated textual-js snapshot plugin exists it should be named explicitly, otherwise describe the workflow generically.
- Python concepts that do translate: the pilot-driven simulation pattern, out-of-bounds as an error (not clamping), boolean return from hit testing, discrete key events, snapshot update workflow, terminal size as a harness parameter, exception propagation.
- Python concepts that do not translate: `@pytest.mark.asyncio`, `asyncio_mode`, `async with ... as`, `WorkerFailed` (name may differ), `HeadlessDriver` (Ink's test renderer is the equivalent), `StylesheetError` (name may differ), `WaitForScreenTimeout` (name may differ -- document whatever textual-js actually raises).
- Describe the pilot APIs as Promise-returning functions, not as coroutines.
- Call out that `await` is required before assertions that depend on effect/message settling; forgetting this is the most common test bug.
