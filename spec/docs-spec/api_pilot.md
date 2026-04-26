# Docs Spec: Pilot (Programmatic App Driver for Tests)

## Purpose
Document the Pilot object — the test harness that programmatically drives a running app (key presses, mouse events, resizes, waiting for stable state, and exit) so test authors can write deterministic integration tests without a real terminal.

## Audience
Test authors writing end-to-end or integration tests for apps and widgets. Framework maintainers writing conformance/regression tests.

## Required sections
1. Overview — what Pilot is, how it relates to the test runner, why it exists.
2. Obtaining a Pilot — the test-runner entry point that yields a Pilot bound to an app instance.
3. Keyboard simulation — pressing keys by name.
4. Mouse simulation — `mouseDown`, `mouseUp`, `click`, `doubleClick`, `tripleClick`, `hover`, including modifiers, buttons, and multi-click chaining.
5. Target resolution for mouse events — widget instance vs. widget class vs. CSS selector vs. screen-relative.
6. Offsets and coordinate translation — how the provided offset combines with a widget's region to produce screen coordinates.
7. Bounds checking — the error condition when a simulated position falls outside the visible screen.
8. Waiting — `pause`, `waitForAnimation`, `waitForScheduledAnimations`, and the underlying "wait for screen to process events" primitive.
9. Terminal resize simulation.
10. Graceful exit with a result value.
11. Timeouts and deadlock detection.
12. Return values of mouse methods (whether the action landed on the intended widget).

## Key concepts
- Pilot drives the app from outside the normal input pipeline; it bypasses the driver/event routing for the initial injection but allows the app to run its full event processing.
- Targets are resolved to a widget, then offsets are applied to that widget's region to get absolute screen coordinates.
- Multi-click is a sequence of full down/up/click triples with an incrementing chain counter on each click.
- "Wait for screen" means flushing all pending queued work on the current screen and its descendants until idle, with a timeout.
- Animation waits come in two flavors: waiting for in-flight animations, and waiting for in-flight plus scheduled animations.
- `pause(null)` waits for idle; `pause(ms)` sleeps for a specific duration. Both trigger a timer refresh after waiting.

## Behaviors and contracts
- All pilot methods are asynchronous and return promises.
- Mouse methods fire `MouseMove` before `MouseDown`/`MouseUp`/`Click` to mimic real input ordering.
- If the target position is off-screen, the framework throws the out-of-bounds error; pilot does not silently clamp.
- If screen-processing does not settle within the timeout, the framework throws the timeout error — indicating a likely deadlock in app code.
- Mouse methods return a boolean: `true` when either no selector was specified or the event landed on the selected widget; `false` when a selector was specified but the event landed elsewhere.
- `exit(result)` resolves the running app with the supplied result.
- Terminal resize posts a resize event and waits for settle.
- When Pilot runs against the headless driver, the driver's internal size is updated on `resizeTerminal`.

## Example requirements
JSX/TypeScript examples using Vitest with `ink-testing-library` and the app's test harness. Include at minimum:
- Launching an app under test and obtaining a Pilot.
- Pressing a sequence of keys and asserting resulting state.
- Clicking a button selected by CSS selector and asserting the resulting message.
- Double-clicking and triple-clicking.
- Hovering with an offset relative to a widget.
- Resizing the terminal and asserting layout changes.
- Using `pause()` to wait for idle, and `waitForAnimation()` to wait for an animation to complete.
- Exiting the app with a result and asserting the returned value.

## Cross-references
- `api_app.md` in `spec/docs-spec/` — the app entry point and its test-run variant.
- `api_events.md` in `spec/docs-spec/` — mouse and key event shapes.
- `animation.md` in `spec/docs-spec/` — animation lifecycle that Pilot awaits.
- `api_screen.md` in `spec/docs-spec/` — widget lookup by coordinate.
- `spec/spec-src/13-testability-and-automation-surfaces.md` — test infrastructure requirements.
- `spec/spec-src/08-drivers-io-and-platform-behavior.md` — headless driver behavior.

## Notes for writers
- Do not mention `asyncio`, Python futures, or `await` decorators. TS/JS uses native promises and `await`; describe waiting in those terms.
- Do not mention `rich.repr.auto` or any Python repr infrastructure.
- The source lists a few leading-underscore "internal" methods (`_postMouseEvents`, `_waitForScreen`, `_getMouseMessageArguments`). The doc should treat these as implementation details; describe the semantics they provide (coordinate translation, screen-settle waiting) as part of the public methods' behavior, but do not expose the underscore names as public API.
- Clarify that Pilot bypasses the normal app event loop for injection — so handlers registered directly on the app object's top-level event hook may not fire; instead events are delivered straight to the screen. This is a common source of confusion and must be called out.
- Keyboard input is by key name strings (`"enter"`, `"tab"`, `"ctrl+c"` style), not character codes. Reference the framework's keybinding/key-name table.
