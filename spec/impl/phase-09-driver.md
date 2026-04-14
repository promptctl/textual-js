# Phase 9: Driver Interface & HeadlessDriver

## Preconditions

Phases 1–8 complete:
- Full infrastructure: test harness, reactive pipeline, CSS engine, compositor, layout, bindings, actions, workers, signals, modes, themes, notifications, command palette, validation
- Full widget catalog: basic controls, containers, list widgets
- The complete interaction loop works end-to-end through Pilot
- All prior tests pass

The infrastructure and architecture are fully capable of supporting the driver. The compositor produces renderable output, the input pipeline has concrete event types and routing, and widgets exist to validate the full loop. The driver is designed against a stable foundation.

## Goal

Define the driver boundary as the single enforcer of platform input/output normalization, introduce HeadlessDriver, and transition Pilot to route through it.

## Architectural Rationale

// [LAW:single-enforcer] The driver is the single boundary that converts platform input into framework events and framework render output into platform display. No widget or screen normalizes raw input. No compositor writes directly to a display surface.

// [LAW:one-way-deps] The driver depends on the compositor (consuming `CompositorUpdate`) and produces normalized events (consumed by the message pump). It sits at the outermost edge of the architecture.

The driver arrives now — after Phase 8 — because this is when the architecture is complete enough to design the driver interface correctly:
1. The compositor produces `CompositorUpdate` segments (Phase 4) — the driver needs to consume these
2. The input pipeline has concrete event types and routing (Phase 5) — the driver needs to produce these
3. Widgets exist (Phase 8) to validate the full input → dispatch → render → display loop

### Pilot Transition

Pilot currently posts events directly into message pumps. After this phase, Pilot routes through `HeadlessDriver.process_message()` instead. Pilot's public API (`press()`, `click()`, `resize()`) does not change — only the internal routing does.

Tests that relied on direct message-pump posting may break. This is expected and acceptable — those tests are rewritten to use the Pilot API, which now routes through the driver.

## Current State (before this phase)

**Pilot** (from Phase 1): posts `Key`, `Click`, `MouseDown`, etc. directly into message pumps. Methods: `press()`, `click()`, `resize()`, `pause()`.

**Compositor** (from Phase 4): produces `CompositorUpdate` segments, has point queries for mouse hit-testing.

**Event routing** (from Phase 5): `App.on_event()` routes to screen → focused/target widget. Events bubble via MessagePump.

**What does NOT exist**:
- No `Driver` base class
- No driver lifecycle (start/stop)
- No input normalization boundary (`process_message`)
- No output consumption boundary (`write`)
- No HeadlessDriver
- No platform drivers (terminal, browser)

## Scope

### Driver Base Class

- Abstract `Driver` class with:
  - `start(app)` — initialize the driver, connect to the app
  - `stop()` — tear down the driver
  - `write(updates: CompositorUpdate[])` — consume render output and display it
  - `process_message(raw_event)` — normalize raw platform input into framework events (`Key`, `Mouse*`, `Click`, `Resize`, etc.)
- Capability properties: `is_headless`, `is_inline`, `is_web`, `can_suspend`
- The driver does NOT own event routing — it produces normalized events and posts them to the app. The app's `on_event()` (Phase 5) handles routing.

### Input Normalization

- `process_message` is the single boundary where platform-specific input becomes framework events
- Key name normalization: platform-specific key codes → canonical names (`ctrl+c`, `escape`, `tab`, etc.)
- Mouse coordinate translation: platform coordinates → app-relative coordinates
- Mouse button bookkeeping: track button state for drag detection

### HeadlessDriver

- In-memory driver implementation for testing
- `write(updates)`: captures `CompositorUpdate` segments in memory for inspection
- `process_message(event)`: accepts already-normalized events (since there's no real platform input)
- Provides inspection API: query captured output, check what was rendered at (x, y)
- Replaces Pilot's direct message-pump posting

### Pilot Update

- `pilot.press(key)` → creates `Key` event → posts through `HeadlessDriver.process_message()` → app receives normalized event
- `pilot.click(x, y)` → creates click event → posts through `HeadlessDriver.process_message()` → app routes to target widget
- `pilot.resize(w, h)` → posts through driver → app handles resize
- `pilot.pause()` → drains message queue (unchanged)
- Public API unchanged — internal routing changed

### App Driver Ownership

- `App.run()` accepts a driver (or defaults to HeadlessDriver in test mode)
- App owns driver startup in `run()` and shutdown in `exit()`
- App passes `CompositorUpdate` to `driver.write()` after layout/render
- Driver posts normalized events to app via `app.postMessage()`

### Optional: Platform Drivers

- Terminal driver (Node.js): raw mode stdin/stdout, ANSI escape sequences, `SIGWINCH` resize detection
- Browser driver (DOM): Canvas or DOM-based rendering, keyboard/mouse event translation, `ResizeObserver`
- Platform detection and automatic driver selection
- These are optional for this phase — HeadlessDriver is the mandatory deliverable

## Spec References

- `spec/spec-src/08-drivers-io-and-platform-behavior.md` — driver specification
- `spec/spec-src/14-renderer-integration-seams.md` — renderer integration
- `spec/spec-tests/driver.md` — driver test cases
- `spec/spec-tests/xterm_parser.md` — terminal input parsing test cases (if implementing terminal driver)

## Uber-Divergence Resolutions

None directly relevant to this phase.

## Exit Criteria

1. `Driver` base class exists with `start()`, `stop()`, `write()`, `process_message()`.
2. `HeadlessDriver` implemented and passing tests.
3. All existing Pilot-based tests pass through the HeadlessDriver routing (regression).
4. Driver lifecycle tests: start, process events, write output, stop.
5. Input normalization tests through HeadlessDriver.
6. App.run() owns driver creation and cleanup — verified by test.
7. HeadlessDriver inspection API: can query what was rendered at a given position.
8. All prior phase tests still pass (or are updated to use Pilot API which routes through driver).
9. `npm run build` and `npm run lint` pass.

## What the Next Phase Expects

Phase 10 (Text Editing, Advanced Widgets, Animation) expects:
- Full driver loop working: input → normalize → dispatch → render → write output
- HeadlessDriver inspection API for verifying complex widget rendering (TextArea, DataTable)
- All existing widgets working through the driver
