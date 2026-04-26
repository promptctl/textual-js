# Docs Spec: Tutorial -- Building a Stopwatch App

## Purpose
Describes a progressive, hands-on tutorial that walks a reader from zero to a complete stopwatch application, introducing the core textual-js concepts along the way: app shell, composition, styling via TCSS, reactive state, timers, event handling, DOM queries, dynamic mount/remove, and key bindings.

## Audience
New users encountering textual-js for the first time; readers who prefer learning by building a complete example.

## Required sections
1. Introduction -- what the tutorial builds and what the reader will learn.
2. App skeleton -- the `TextualApp` React component (or equivalent top-level component), running the app, the default quit binding, dark/light theme toggle.
3. Built-in widgets used -- Header, Footer, Button (with variants), Digits (large numeric display).
4. Containers -- horizontal row container, vertical scrollable container, how children are placed.
5. Custom widget composition -- authoring a `Stopwatch` widget and a `TimeDisplay` widget as composed React components.
6. Styling with TCSS -- external `.tcss` file, file-format and selector syntax, dynamic class toggling at runtime.
7. Display vs visibility semantics.
8. Event handling -- message subscription/handler conventions for button presses.
9. Mount lifecycle hook -- what it is and when to use it for initialization that requires DOM placement (e.g., starting timers).
10. Reactive attributes -- declaring reactive fields on a widget, watchers that run on change, how UI updates happen automatically.
11. Timers -- scheduling a repeating callback, pause/resume control, choosing an appropriate rate (e.g., 60 Hz for a stopwatch display).
12. DOM queries -- retrieving exactly one widget by selector or type, retrieving all matches, handling zero/multi-match conditions.
13. Dynamic widget management -- mounting and removing widgets at runtime, scrolling the new widget into view.
14. Final app -- full key bindings table, `TimeDisplay` state machine (stopped, running, stopped-with-accumulated-time, reset), display format.
15. Command palette mention -- the `Ctrl+P` palette is always available.
16. Progression of files -- stopwatch01 through final, with what each step adds (kept as incremental milestones even if the JS tutorial uses different filenames).

## Key concepts
- An app is a React component tree rooted in textual-js's top-level app component; composition is expressed as JSX, not generator methods.
- Built-in widgets are function components wrapped by mobx-react-lite's `observer()`.
- Keys are bound via a bindings declaration; each binding names an action that maps to a handler.
- Action handler names follow a consistent convention (cover the JS convention explicitly -- for example a bindings array entry like `{ key: "d", action: "toggleDark", description: "Toggle dark mode" }` paired with an `actionToggleDark` method or a handler map).
- TCSS files are loaded at startup and support live editing during development.
- CSS classes are runtime-toggleable tags that drive re-evaluation of applicable TCSS rules.
- `display: none` removes the widget from layout entirely; `visibility: hidden` preserves layout space.
- Reactive state is powered by MobX; updating a reactive field causes the widget (an `observer` component) to re-render. Watchers are explicit subscriptions that run a side effect on change.
- Timers are schedulable, pausable, and resumable; they are owned by the widget that creates them and cleaned up on unmount.
- `queryOne` (or equivalent) returns exactly one match and throws on zero-or-many; `query` returns a collection.
- Mounting a widget programmatically is an asynchronous operation; scrolling the new widget into view is a separate follow-up call.
- Themes are named; built-in theme names include the dark and light textual themes.

## Behaviors and contracts
- `Ctrl+Q` quits by default.
- Bindings are declared on the component; actions are dispatched via a deterministic lookup.
- Reactive assignments trigger re-render and watchers automatically.
- A repeating timer continues until paused, unmounted, or cancelled.
- `queryOne` raises (throws) when the result count is not exactly one; `query` returns a collection that is falsy when empty.
- `mount(widget)` appends to the target container's children and completes asynchronously.
- `remove()` unmounts a widget and reclaims its layout space.
- Style classes added via `addClass` / `removeClass` (or equivalent) take effect immediately after the next render pass.

## Example requirements
All examples must be JSX/TypeScript using textual-js components and Ink primitives where appropriate. Each tutorial step must include a complete, runnable component (not a fragment). Examples must demonstrate:
- A minimal app with Header, Footer, and a theme-toggle binding.
- Composing a custom `Stopwatch` widget containing three Buttons and a `TimeDisplay`.
- A small TCSS file loaded by the app and the same UI re-styled by it.
- A runtime class toggle wired up in a button-press handler.
- A MobX-observable field as a reactive attribute, with an `observer`-wrapped component that re-renders when it changes, and a `reaction`/watcher as the explicit change-subscription.
- A 60 Hz timer started on mount in a paused state, resumed when the user presses Start.
- `queryOne` used to get the timers container and mount a new `Stopwatch` on key press.
- `remove()` used to remove the last Stopwatch on another key press.

## Cross-references
- `spec/docs-spec/widget_button.md` -- Button is the primary interactive widget used.
- `spec/docs-spec/actions_and_bindings.md` -- deeper treatment of bindings and actions.
- `spec/docs-spec/api_on.md` -- the message-handler convention used for Button.Pressed-style events.
- `spec/docs-spec/animation.md` -- not used by the tutorial but referenced by the command palette corner indicator.
- `spec/spec-src/01-runtime-app-and-lifecycle.md` -- app and widget lifecycle invoked here.
- `spec/spec-src/02-dom-reactivity-and-query.md` -- query semantics used by the tutorial.
- `spec/spec-src/07-workers-timers-and-signals.md` -- timer semantics used for the 60 Hz update loop.

## Notes for writers
- Replace every Python construct: subclassing `App` becomes authoring a React component that composes textual-js's app component; `compose(self)` becomes the JSX returned by the component or its children; `BINDINGS` becomes a bindings declaration array/object; `action_*` method naming becomes whatever the textual-js action convention is (state it explicitly once).
- `reactive(...)` descriptors become MobX `observable` fields on a class or properties on an observable object; `watch_<attr>` becomes a MobX `reaction` or `autorun`. Be explicit about which MobX primitive maps to which Textual concept.
- `on_mount` becomes the textual-js mount lifecycle hook; do not reuse the Python handler name.
- `set_interval(interval, callback, pause=True)` maps to a textual-js timer API; describe `pause`/`resume` on the returned timer handle.
- `query_one` and `query` keep their conceptual roles; rename to the textual-js method names (e.g., `queryOne`).
- `mount()` / `remove()` keep their conceptual roles; describe the Promise semantics for asynchronous mount.
- `@monotonic` default-value callables become regular functions passed to the observable initializer.
- Do not mention `docs/examples/tutorial/*.py`. Replace with textual-js example filenames (likely `.tsx`).
- The command palette is real in textual-js; keep the `Ctrl+P` mention but remove any Python-specific command-registration detail.
- Keep the pedagogical structure (seven progressive steps) even if the file names differ. Each step must produce a self-contained, runnable component.
