# Docs Spec: Getting Started and Tutorial

## Purpose
Describes the on-ramp page for new textual-js users: install, verify, write a minimal app, then incrementally build a stopwatch application that introduces each core concept (composition, containers, TCSS, CSS classes, events, reactive state, timers, mount lifecycle, queries, dynamic widgets).

## Audience
Brand-new users. They have not seen the framework before. They want to run something, see it work, and learn the vocabulary as they go.

## Required sections
1. Requirements: Node version, supported OSes, terminal emulator guidance (iTerm2/Kitty/WezTerm/Ghostty on macOS; Windows Terminal on Windows; desktop terminal on Linux; link to the Linux console limitation page).
2. Installation: install the textual-js package, install devtools package (if separate), optional extras (syntax highlighting for TextArea, etc.).
3. CLI / devtools overview and how to invoke the demo app.
4. First app: the smallest functional TextualApp — a React component that composes Header and Footer, declares a binding, and implements an action. Show the run entry point.
5. Tutorial: stopwatch application in progressive stages.
   - Stage 1: App skeleton (Header + Footer + dark-mode binding + action).
   - Stage 2: Custom widgets and composition (TimeDisplay wrapping Digits; Stopwatch wrapping HorizontalGroup with Buttons + TimeDisplay; VerticalScroll container holding multiple Stopwatch instances).
   - Stage 3: TCSS styling via a separate .tcss file, properties (background, height, margin, min-width, padding, text-align, color, width, dock, display).
   - Stage 4: Dynamic styling via CSS classes (add/remove class) and the combined-selector pattern (e.g., `.started #start { display: none }`); introduce button-pressed events.
   - Stage 5: Reactive attributes and watch methods; introduce timers (set-interval, pause/resume); introduce the mount lifecycle.
   - Stage 6: Wiring buttons to TimeDisplay methods via queries (queryOne).
   - Final: Dynamic widgets — mount/remove widgets at runtime using bindings, queries, and scroll-into-view.
6. Key concepts summary: enumerated checklist of everything the tutorial introduced.
7. Where to find example source (repo layout, example directories).

## Key concepts
- TextualApp is a React function component; the app is run via an entry function that wires Ink rendering, the reactive store, and the TCSS engine.
- `compose` equivalent in textual-js: child widgets are children in JSX; containers are normal React components from the framework's container set.
- BINDINGS are declared on a component (as a static/const associated with the component or via a hook) and map keys to action names.
- Actions are named handlers resolved by the binding dispatcher; they can live on the App, a Screen, or a widget.
- Built-in widgets (Header, Footer, Button, Digits) and containers (HorizontalGroup, VerticalScroll) are the starter catalog.
- TCSS is a CSS-like stylesheet language loaded from `.tcss` files (via a static `CSS_PATH` or equivalent).
- CSS classes (distinct from React classes) are a runtime tag system toggled via `addClass`/`removeClass` (or reactive toggleClass).
- Event handlers are registered on widgets (through a consistent mechanism — prop, hook, or subscribe call; mirror the actual framework).
- Reactive attributes (via MobX observables) auto-trigger re-render and watch callbacks.
- Timers (setInterval equivalent on the framework) produce callbacks and can be paused/resumed.
- Queries resolve widgets by CSS selector or component type against the DOM; queryOne returns one, query returns a collection.

## Behaviors and contracts
- The minimal app must run from `node ./app.tsx` (or via the framework's run helper) and exit cleanly on Ctrl+Q (default quit binding).
- The tutorial must be incremental: each stage must run standalone.
- Every CSS property mentioned in stage 3 must be backed by the TCSS engine in textual-js.
- Reactive attribute assignment must trigger both the watch callback and a component re-render (MobX + observer).
- Mount lifecycle fires once per component life, after the component is in the DOM and before first paint.
- Queries must throw when queryOne matches zero or more than one widget (contract: exactly one).
- Dynamic mount/remove must update the DOM observably and animate/scroll as documented.

## Example requirements
All examples JSX/TypeScript, using Ink primitives and the textual-js React API (no Python anywhere):
- Minimal TextualApp with Header, Footer, a toggle-theme binding, and the `actionToggleDark` (or equivalent) handler.
- Stage-by-stage stopwatch code for each tutorial stage.
- A `.tcss` stylesheet demonstrating each CSS property table entry.
- Runtime dark/light theme toggling via theme property (not a dark boolean).
- Reactive-attribute example with a `watch` callback.
- Query example (queryOne by type, query by selector, `.last()` equivalent).
- Dynamic mount and remove via bindings: pressing a key adds a Stopwatch, pressing another removes the last one; newly mounted widget is scrolled into view.

## Cross-references
- `spec/docs-spec/how_to.md` (containers, centering, layout workflow).
- `spec/docs-spec/layout.md` (vertical/horizontal/grid layout).
- `spec/docs-spec/reactivity.md` (reactive attributes, watchers, computed).
- `spec/docs-spec/events.md` (event/message system).
- `spec/docs-spec/input_handling.md` (bindings and actions deep-dive).
- `spec/docs-spec/actions_and_bindings.md`.
- `spec/spec-src/01-runtime-app-and-lifecycle.md` (behavioral spec for app lifecycle).

## Notes for writers
- Drop every Python-specific install instruction: no `pip install textual`, no `pip install textual-dev`, no `micromamba`, no `conda-forge`. Use npm/pnpm/yarn for the textual-js package and its devtools counterpart.
- The minimal app entry is not `app.run()` inside `if __name__ == "__main__":`. In textual-js the entry is typically a `run(<TextualApp />)` helper or an Ink `render(...)` call that the framework wraps. Mirror the framework's actual entry, not Python's.
- `compose()` method is replaced by JSX children. Don't describe a generator.
- `BINDINGS = [...]` as a class variable becomes either a static const on the component, a hook call (e.g., `useBindings([...])`), or a prop — document whichever is canonical.
- `action_toggle_dark` (Python snake_case prefix) becomes a named handler in the framework's binding-action system. Use the real naming (camelCase methods, or a map of action names to handlers).
- `self.theme = "..."` stays conceptually but uses the reactive store API.
- `set_interval` becomes the framework's timer API; keep the pause/resume idea.
- `on_mount` becomes whatever lifecycle hook textual-js exposes (likely a `useOnMount` or a subscription to the Mount event).
- `query_one` / `query` names should be mirrored as the framework's actual naming (likely `queryOne` / `query`).
- Keep the tutorial stages intact conceptually; only the syntax changes.
- Avoid all mention of `asyncio`, generators, dataclasses, or Python imports.
