# Docs Spec: App (TextualApp)

## Purpose
Describes the App page — the entry point of every textual-js application, covering construction, lifecycle, screens/modes, theming, CSS loading, notifications, bindings/actions, and the app-wide configuration surface.

## Audience
New users building their first app, and experienced authors who need a reference for configuration flags, lifecycle hooks, screen/mode APIs, and exit semantics.

## Required sections
1. Overview — apps are declared using `TextualApp` (a React component) wired with configuration props; the app is the root of the DOM of widgets rendered via Ink.
2. Construction / Instantiation — the props / options supported when instantiating/rendering the app (CSS paths, watch-css, ansi-color, driver variants).
3. Lifecycle
   - Compose — how the initial widget tree is declared (React children / `compose`-style function returning JSX).
   - Mount — the mount event and how `onMount`-equivalent hooks run setup.
   - Recompose — triggering a full rebuild of the current screen's tree.
   - Shutdown — exit paths and terminal restoration.
4. Running the App — `run()` / `runAsync()` equivalents, headless and inline modes, testing entry point.
5. CSS — loading TCSS via file paths, inline string, and default (base) CSS; live reload in dev mode.
6. Title and Subtitle — reactive (MobX) fields consumed by the Header widget.
7. Exit — exit value, return code, and post-exit accessors.
8. Suspend and Resume — temporarily leaving application mode to run another program; process-suspend action; suspend/resume signals.
9. Themes — active theme reactive field, registering/unregistering themes, dark/light pseudo-classes, ANSI-color mode, `NO_COLOR` behavior.
10. Screens and Modes — screen stack, push/pop/switch, installed screens, modes with independent stacks.
11. Command Palette — configuration hooks (enable flag, key binding, providers, system commands override).
12. Notifications — `notify()` API and timeout configuration.
13. Bindings and Actions — default bindings and the built-in actions set.
14. Focus — focused widget accessor, auto-focus selector, programmatic focus.
15. Configuration Reference — a single table listing every configurable option (the JS-friendly equivalents of Python `CSS`, `CSS_PATH`, `TITLE`, `SCREENS`, `MODES`, `DEFAULT_MODE`, `AUTO_FOCUS`, `ALLOW_SELECT`, `ENABLE_COMMAND_PALETTE`, `COMMAND_PALETTE_BINDING`, `COMMANDS`, `NOTIFICATION_TIMEOUT`, `BINDINGS`, `CLOSE_TIMEOUT`, `TOOLTIP_DELAY`, `ESCAPE_TO_MINIMIZE`, `INLINE_PADDING`, `CLICK_CHAIN_TIME_THRESHOLD`, `ALLOW_IN_MAXIMIZED_VIEW`, `HORIZONTAL_BREAKPOINTS`, `VERTICAL_BREAKPOINTS`, `SUSPENDED_SCREEN_CLASS`, etc.).
16. Reactive Attributes — table of observable fields (`title`, `subTitle`, `theme`, `appFocus`, `ansiColor`, ANSI theme mappings).
17. Pseudo-Classes — table of app-level pseudo-classes (`:focus`, `:blur`, `:dark`, `:light`, `:inline`, `:ansi`, `:nocolor`).
18. Properties — readonly accessors exposed on the app (return value, return code, focused widget, active screen and stack, current mode, workers, headless/inline/web flags, themes, active bindings).
19. Responsive Breakpoints — width-based and height-based class application.
20. Scroll Sensitivity — X/Y sensitivity defaults and rationale (cells ~twice as tall as wide).
21. Mounting Widgets at Runtime — adding children after compose and the await-to-observe pattern.

## Key concepts
- The app is the DOM root; `Screen` and widgets are descendants.
- Configuration is expressed through component props / static fields on a class-based TextualApp, not through Python class variables.
- MobX backs every reactive field; observer components react automatically to `title`, `subTitle`, `theme`, etc.
- TCSS is loaded and merged in priority order: `DEFAULT_CSS` (base) → `CSS_PATH` (file) → `CSS` (inline). Ties on specificity favor later-loaded sources.
- Inline mode renders the app beneath the prompt; full-screen mode takes over the terminal.
- Screen stacks are per-mode; `screenStack` is a snapshot of the active mode's stack.
- The command palette is opt-out via a single flag; system commands are declared through an override that must chain to the built-in provider.

## Behaviors and contracts
- `run()` blocks (or resolves) until the app exits and yields the value passed to `exit()`; `returnCode` defaults to 0 on normal exit and is 1 on unhandled errors.
- The framework does not call the OS exit itself; the caller is responsible for propagating `returnCode`.
- Live CSS reload is active when `watchCss` is true (dev runs enable this automatically).
- Changing `theme` to an unregistered name raises an InvalidTheme error.
- `notify()` is safe to call from any scope (including workers); the notification subsystem is thread/async safe.
- Mounting is asynchronous — querying a newly-mounted widget requires awaiting the mount.
- `action_suspend_process` is Unix/macOS only; inline mode is not supported on Windows.

## Example requirements
Describe (do not inline) JSX/TypeScript examples covering:
- Declaring a minimal TextualApp component with children (Header, Footer) and running it.
- An `onMount`-equivalent hook performing setup (setting styles, starting workers).
- Assigning `title`/`subTitle` reactively from a handler.
- Loading external TCSS via a `cssPath` prop and inline CSS via a `css` prop.
- Pushing and popping screens, and switching modes.
- Calling `notify()` with severity and timeout.
- Declaring default bindings and binding keys to built-in actions.
- Reading `returnValue` / `returnCode` after `run()` completes.
- Enabling inline mode and observing the `:inline` pseudo-class.
All examples are JSX/TypeScript using Ink primitives and textual-js APIs; no Python.

## Cross-references
- `spec/docs-spec/dom_and_queries.md` — DOM tree, IDs, classes, queries.
- `spec/docs-spec/css_overview.md` — TCSS loading, selectors, specificity.
- `spec/docs-spec/design.md` — themes and design tokens.
- `spec/docs-spec/command_palette.md` — providers and system commands.
- `spec/docs-spec/api_worker_manager.md` — accessing `app.workers`.
- `spec/spec-src/01-runtime-app-and-lifecycle.md` — authoritative app lifecycle.
- `spec/spec-src/04-styling-and-css-engine.md` — CSS merge order and priority.
- `spec/spec-src/06-input-bindings-actions-and-commands.md` — bindings and actions.

## Notes for writers
- Do not document Python inheritance (`class MyApp(App):`). textual-js uses React composition: apps are components, configuration is props or static fields, and "class variables" map to static fields or defaultProps.
- Do not use snake_case method names (`action_quit`, `register_theme`). Use camelCase equivalents (`actionQuit`, `registerTheme`, etc.). When listing built-in actions for binding purposes, the action name string used in bindings may follow the documented action-name convention — cite the bindings spec for the canonical format.
- Do not reference `asyncio`, event loops, or `run_async(loop=...)`. The equivalent is a Promise-returning `run()` that can be awaited.
- Do not describe `CSSPathType` or Python path resolution rules. Instead, describe that relative paths are resolved relative to a project root (or an explicit base) — defer the exact rule to the CSS spec.
- `Pilot` testing is present in textual-js too, but for the test harness use the testing docs (Vitest + ink-testing-library). Point at those rather than documenting `run_test()` in Python terms.
- The Rich `TerminalTheme` has a JS equivalent — call it by whatever the implementation exposes (likely a plain object mapping ANSI indexes to hex); do not reference Rich.
- Headless mode exists for tests; do not describe it as a driver class name — it is a prop/option.
- "Swallowing CancelledError" and `sys.exit()` should not appear; explain the JS-native behavior (no auto-exit) in one sentence.
