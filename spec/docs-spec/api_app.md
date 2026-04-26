# Docs Spec: API — TextualApp

## Purpose
Describes the API reference doc for the top-level application component (`TextualApp`), its configuration surface, lifecycle, screen/mode/theme management, notifications, focus, and built-in actions in textual-js.

## Audience
Application authors building a textual-js app, and framework extenders integrating with app-level hooks.

## Required sections
1. Overview of `TextualApp` and its role as the root component of every textual-js app.
2. Constructing/configuring the app: CSS path(s), inline CSS, ANSI color preservation, optional CSS watcher.
3. Class-variable-style defaults (CSS, CSS_PATH, DEFAULT_CSS, TITLE, SUB_TITLE, SCREENS, MODES, DEFAULT_MODE, AUTO_FOCUS, BINDINGS, COMMANDS, and so on) — described as static config properties on the app.
4. Reactive app attributes (title, sub_title, theme, focus state, ANSI theme config).
5. Computed/read-only properties (active screen, screen stack, current mode, focused widget, workers manager, debug/headless/inline flags, active bindings).
6. CSS pseudo-classes that react to app state (`:focus`, `:blur`, `:dark`, `:light`, `:inline`, `:ansi`, `:nocolor`).
7. Lifecycle: initial composition, mount event, and full recomposition.
8. Running the app: the main run entry point, test-mode runner, and how Ink is started/teared down under the hood.
9. Exiting: returning a value, setting a return code, printing a farewell message.
10. Screen management (push, pop, switch, install by name) and mode management (switch, add at runtime).
11. Theme management (register, unregister, switch, signal).
12. Suspend/resume (when platform-supported) and related signals.
13. Notifications (toast severity levels, timeout, markup support) and clearing them.
14. Mounting widgets at runtime and setting focus programmatically.
15. The built-in action catalog provided by the app.
16. Default bindings and how to override them.
17. The command palette integration: the default system-commands provider, the opening binding, extending commands.
18. Responsive breakpoints (horizontal and vertical), and inline-mode considerations.
19. Error conditions that the app surfaces (invalid CSS path, invalid theme, invalid screen-stack op, suspend not supported).

## Key concepts
- The app is a React component hosted by Ink; its configuration is declared at the component/class level and via props.
- Reactive state on the app is backed by MobX; reading these fields inside an observer component creates an automatic subscription.
- The app owns a stack of screens per mode; modes are named independent stacks.
- CSS is layered: default CSS, inline CSS, and external CSS file(s), with documented precedence.
- The app exposes worker and notification services that widgets can access through context.

## Behaviors and contracts
- Setting a theme to an unregistered name is a hard error.
- Mount returns an awaitable handle; callers may ignore it and textual-js will await before delivering the next message.
- Notifications are safe to call from any context (including worker contexts).
- The active binding set is derived from the current screen focus chain plus app-level priority bindings; it updates reactively.
- Responsive breakpoints add/remove CSS classes based on terminal size; only the largest matching class per axis is active.
- Exiting terminates the Ink render tree cleanly; `run` resolves with the exit value.
- Inline mode is documented as unsupported on Windows (same limitation carries over because it lives at the terminal driver level).

## Example requirements
All examples must be JSX/TypeScript using Ink primitives and textual-js APIs:
- Defining a minimal `TextualApp` subclass with BINDINGS, CSS_PATH, and an initial composition.
- Pushing/popping a screen and waiting on the result in an async flow.
- Switching themes and reacting to the theme-changed signal.
- Showing a notification with severity and timeout.
- Extending the system commands list.
- Running the app under the test harness to drive it programmatically.

## Cross-references
- `spec/docs-spec/actions_and_bindings.md`
- `spec/docs-spec/api_binding.md`
- `spec/docs-spec/api_command.md`
- `spec/docs-spec/api_compose.md`
- `spec/docs-spec/api_await_complete.md`
- `spec/spec-src/01-runtime-app-and-lifecycle.md`
- `spec/spec-src/08-drivers-io-and-platform-behavior.md`

## Notes for writers
- Drop Python-only concepts: `asyncio.AbstractEventLoop`, `Generic[ReturnType]`, `Iterable`, `AsyncIterator`, `Callable`, NamedTuples. Describe their textual-js counterparts using TS types.
- The Python `run()` vs `run_async()` split does not translate; textual-js has a single async run entry point (Ink is async-native).
- `suspend()` as a Python `with` context manager becomes an async helper in textual-js; describe its semantics without Python's `with` keyword.
- `call_later` and coroutine scheduling are Python-specific; use "schedule a callback" language.
- Keep the class-variable-style defaults catalog; just present them as TypeScript static members/props.
- Keep the built-in actions, default bindings, and CSS pseudo-classes lists — these are framework-level contracts that carry over.
- Do not mention `textual-dev` or the `textual` CLI; those are Python ecosystem tools.
