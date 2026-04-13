# Textual Source Specification: Overview and Scope

This specification set defines behavior for the Textual codebase under `src/textual`.

## Source of Truth

- Canonical source: `src/textual/**/*.py` and bundled runtime assets under `src/textual/tree-sitter/highlights/*`.
- All behavior statements in this spec are implementation-derived, not docs-derived.

// [LAW:one-source-of-truth] The runtime implementation in `src/textual` is the sole authority for behavior.

## Package Surface

`textual.__init__` exposes the small root convenience API:

- `__version__` is resolved lazily via module `__getattr__`, calling `importlib.metadata.version("textual")` on first access,
- `log` is the process-wide `Logger` instance,
- `on` re-exports the message-handler decorator,
- `work` re-exports the worker decorator.

`Logger` behavior is runtime-coupled to the active app context:

- it always appends a plain-text line to `constants.LOG_FILE` when that path is configured, regardless of app state,
- it then resolves the active app from an explicit weak reference captured at construction or, failing that, `active_app.get()`,
- it drops structured log traffic when no app is active unless `constants.DEBUG` is set, in which case it falls back to `print(...)`,
- when an app is resolved it forwards only if `app._is_devtools_connected`, dispatching through the logger's own `_log` callable or `app._log`,
- a `LoggerError` raised by the underlying sink is swallowed, with a `print(...)` fallback gated on `constants.DEBUG`.

The package-level contract is intentionally narrow: the root module provides convenience exports and logging entrypoints, while subsystem behavior lives in dedicated modules such as `app`, `widget`, `screen`, `dom`, and `css.*`.

## Architectural Topology

The runtime object graph is layered as follows:

1. `App` is the DOM root and process coordinator.
2. `Screen` instances represent active/background view stacks per mode.
3. `Widget` instances implement visual/content behavior.
4. `DOMNode` provides tree membership, style/query/reactivity primitives.
5. `MessagePump` provides message queue, dispatch, timers, callback scheduling.

Supporting engines:

- Styling: `textual.css.*` (`parse`, `match`, `query`, `stylesheet`, `styles`).
- Layout/render: `layout`, `layouts/*`, `_arrange`, `_compositor`, `strip`, `visual`.
- Input and actions: `events`, `binding`, `actions`, command system.
- Concurrency: `worker`, `worker_manager`, `timer`, `signal`.
- Platform I/O: `driver` plus `drivers/*` backends.

## Primary Runtime Flows

### Startup and lifecycle flow

1. `App.run` / `App.run_async` initializes driver and message loop.
2. Initial mode is resolved and base screen is mounted.
3. `Compose` then `Mount` are dispatched by each `MessagePump` before normal loop processing.
4. CSS is loaded/reparsed and applied to app/screen/node tree.

### Input and event flow

1. Driver parses terminal/browser input into `events.*` messages.
2. `App.on_event` routes input to screen/focus/mouse targets.
3. Widgets/screens receive forwarded events and may bubble messages upward.
4. Idle turn triggers queued callbacks and deferred refresh/layout work.

### Render flow

1. Layout generates `WidgetPlacement` sets (`_arrange` + layout strategy).
2. Compositor builds visibility maps and dirty regions.
3. Driver receives `CompositorUpdate` render segments (full, inline, or chopped updates).

## Canonical Behavior Constraints

- Message handling order is deterministic per queue order, with optional coalescing via `Message.can_replace`.
- Decorated handlers (`@on`) are considered before naming-convention handlers.
- Style precedence is resolved by specificity + default/user rule origin + tie breaker.
- Screen and mode transitions mutate screen stacks through explicit APIs (`push/switch/pop/install/uninstall`, mode switch/add/remove).

// [LAW:dataflow-not-control-flow] Event/render/style pipelines execute in fixed phases; variability is expressed via message/style values and selector matches.
// [LAW:single-enforcer] Each cross-cutting concern has one primary enforcement boundary: dispatch in `MessagePump`, style application in `Stylesheet`, driver normalization in `Driver.process_message`.
// [LAW:one-way-deps] Core direction is driver -> app -> screen -> widget; bubbling propagates upward but does not invert module dependency direction.

## Scope of Remaining Spec Files

- `01`: app lifecycle, modes, screens, shutdown.
- `02`: DOM, query semantics, reactivity, data binding.
- `03`: message/event transport and dispatch semantics.
- `04`: CSS parser, selectors, stylesheet application.
- `05`: layout/compositor mechanics.
- `06`: keys, bindings, actions, command palette.
- `07`: workers/timers/signals.
- `08`: driver and platform behavior.
- `09`: widget base contract.
- `10`: built-in widget catalog.
- `11`: text editing/document subsystem.
- `12`: themes/notifications/validation/suggestions and related helpers.
- `13`: testing surfaces and awaitable control helpers.
- `99`: source coverage matrix for all modules.
