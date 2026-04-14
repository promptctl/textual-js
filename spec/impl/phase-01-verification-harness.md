# Phase 1: Verification Harness & Lifecycle Lockdown

## Preconditions

None. This is the first phase.

The codebase has 22 TypeScript source files under `src/` with zero test files. `npm test` fails because Vitest discovers no tests.

## Goal

Make the existing bootstrap kernel machine-verifiable and establish the test harness that every subsequent phase depends on.

## Architectural Rationale

// [LAW:verifiable-goals] Without a test harness, no phase has machine-checkable exit criteria. The harness is the first enforcement boundary: all subsequent phases gate on test passage.

// [LAW:single-enforcer] `run_test()` becomes the single way to execute an app in a test context. No later phase invents a second harness.

## Current State (before this phase)

### Source files the agent will work with

**`src/events/message-pump.ts`** — `MessagePump` abstract class. Provides:
- Message queue with coalescing (`canReplace`)
- Handler resolution by naming convention (`_on<Type>` then `on<Type>`)
- Bubbling to parent
- `callLater()` for deferred callbacks
- `setTimer()`/`clearTimer()` for repeating timers (basic `setInterval` wrappers)
- `start()`/`stop()` lifecycle
- `processMessages()` drains queue and runs pending callbacks

**`src/events/message.ts`** — `Message` base class with `messageId`, `bubble`, `canReplace`, `stop()`, `preventDefault()`, `forwarded`, sender tracking.

**`src/events/events.ts`** — Built-in event types: `Compose`, `Mount`, `Unmount`, `Focus`, `Blur`, `Resize` (with `canReplace`), `Idle` (with `canReplace`), `Key` (bubbles), `MouseDown`/`MouseUp`/`MouseMove`/`Click`/`ScrollEvent` (all bubble).

**`src/dom-node.ts`** — `DOMNode` extends `MessagePump`. Tree linkage, CSS identity (`id`, `cssClasses`, `cssTypeName`, `cssPath`), traversal (`walkDepthFirst`, `walkBreadthFirst`, `ancestors`), class mutation (`addClass`, `removeClass`, `toggleClass`), `refresh()`/`onRefresh()` seam for renderer integration.

**`src/node-list.ts`** — `NodeList` with ordered children, ID fast-path lookup, `_updates` version counter, duplicate-ID detection.

**`src/widget.ts`** — `Widget` extends `DOMNode`. `compose()`, `render()`, `arrange()`, focus/display/visible state, scroll offset, virtual size, mount/remove. Static `canFocus`, `canFocusChildren`, `DEFAULT_CSS`.

**`src/screen.ts`** — `Screen` extends `Widget`. Focus management: `setFocus()`, `focusNext()`, `focusPrevious()`, private `_focusChain()`.

**`src/app.ts`** — `App` extends `Widget`. Screen stack (`pushScreen`, `popScreen`, `switchScreen`), `run()` (starts pump, creates default screen, posts Compose/Mount), `handleResize()`, `exit()`.

**`src/geometry/`** — `Size`, `Offset`, `Region`, `Spacing`. All immutable with full operator sets.

**`src/layout/`** — `LayoutStrategy` (abstract), `VerticalLayout`, `HorizontalLayout`, `GridLayout`, `WidgetPlacement`. All use placeholder fixed sizing.

**`src/reactive.ts`** — Function-based reactive: `reactive()` returns default value at construction time, `getReactive()`/`setReactive()`/`watchReactive()` drive the pipeline. Missing: validators, computed properties, `init` dispatch, decorator API.

### Configuration

- `package.json`: Vitest 3.0.0 as devDependency, `"test": "vitest run"`, ESM (`"type": "module"`)
- `tsconfig.json`: target ES2022, module Node16, strict, experimentalDecorators
- No vitest config file exists

## Scope

### Test harness

- Implement `runTest()` as an async function that:
  1. Accepts an App class or instance
  2. Creates the app, composes, mounts, and processes initial messages
  3. Yields a `Pilot` object for test interaction
  4. Cleans up (calls `exit()`) when done
- This is purely in-process. No driver, no terminal I/O.

### Pilot (minimal)

- `pilot.press(key)` — posts a `Key` message to the focused widget or active screen
- `pilot.click(x, y)` — posts a `Click` message to the active screen
- `pilot.resize(width, height)` — calls `app.handleResize()`
- `pilot.pause()` — drains the message queue (calls `processMessages()`)
- Pilot posts messages directly into the message pump. This is intentional — the driver boundary does not exist yet and will be introduced in Phase 9.

### Test suites

Write Vitest suites covering all existing behavior:

- **Geometry**: `Size`, `Offset`, `Region`, `Spacing` — construction, operators, immutability, edge cases
- **NodeList**: append, insert, remove, clear, duplicate ID rejection, `_updates` counter increment, ID lookup
- **Message**: construction, `messageId` uniqueness, `stop()`, `preventDefault()`, sender tracking
- **MessagePump**: dispatch with handler resolution (`_on` vs `on` naming), coalescing, bubbling to parent, `callLater` execution, timer scheduling
- **DOMNode**: tree construction (`_mountChild`/`_unmountChild`), `ancestors()`, `walkDepthFirst()`, `walkBreadthFirst()`, class mutation, `cssPath`, `refresh()` propagation
- **Widget**: `compose()` lifecycle, focus state, display/visible, mount/remove, arrange delegation
- **Screen**: `setFocus()`, `focusNext()`, `focusPrevious()`, focus chain construction
- **App**: `run()` lifecycle, screen stack push/pop/switch, resize handling, `exit()` shutdown
- **Integration**: `runTest()` + Pilot — compose an app, interact, verify state

### Lifecycle formalization

- Ensure Compose → Mount ordering is deterministic and tested
- Ensure shutdown contract: `exit()` stops the pump, clears timers, unmounts screens
- Document the lifecycle sequence that tests depend on

## Spec References

- `spec/spec-src/13-testability-and-automation-surfaces.md` — `run_test()` and Pilot contract
- `spec/spec-src/01-runtime-app-and-lifecycle.md` — lifecycle sequencing
- `spec/spec-tests/testing.md` — test case specifications (if it exists)
- `spec/spec-tests/events_and_messages.md` — message dispatch test cases
- `spec/spec-tests/geometry.md` — geometry test cases
- `spec/spec-tests/app.md` — app lifecycle test cases

## Uber-Divergence Resolutions

None directly relevant to this phase.

## Exit Criteria

1. `npm test` runs non-empty suites and passes.
2. Test count > 0 for each module listed in Scope (geometry, NodeList, Message, MessagePump, DOMNode, Widget, Screen, App).
3. `runTest()` can create an app, compose it, and return a Pilot — verified by integration tests.
4. App lifecycle tests cover: startup, resize, push/pop/switch screen, shutdown.
5. A headless app can be instantiated, composed, and inspected in-process without any terminal or driver.
6. `npm run build` and `npm run lint` still pass.

## What the Next Phase Expects

Phase 2 (Full Reactive Pipeline) expects:
- A working test harness (`runTest()` + `Pilot`) to write reactive tests against
- All existing behavior locked down by tests, so the reactive replacement can be validated as non-breaking
- Vitest configured and running
