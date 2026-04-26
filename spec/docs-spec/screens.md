# Docs Spec: Screens

## Purpose
Describes the docs page that teaches textual-js users how screens work: how to define them, install them, push/pop/switch between them, receive results, organize them into modes, and present modal dialogs.

## Audience
Application authors building multi-view apps, widget authors who need to understand screen-scoped CSS and focus, and anyone using modal dialogs, command palettes, or mode-based navigation.

## Required sections
1. Screen overview — what a screen is, why it exists, and how it relates to the app shell.
2. Declaring a screen — component/class definition, required vs. optional metadata (title, subtitle, bindings, CSS).
3. Screen-scoped configuration — AUTO_FOCUS selector, CSS and CSS file paths, BINDINGS, COMMANDS, breakpoints, maximize rules.
4. Reactive screen state — focused widget, title, sub_title, maximized widget, stack update counter.
5. Default screen styling and inline-mode considerations.
6. Installing screens by name (`SCREENS` registry) vs. constructing on demand.
7. Runtime registration — install/uninstall/get/is-installed helpers.
8. Screen stack model — what "current screen" means, why only the top screen renders and receives input.
9. Push, pop, switch operations — signatures, effects, identity rules for reused instances.
10. Screen results and dismiss flow — result typing, callbacks, await-based retrieval, dismiss as a bindable action.
11. Screen modes — MODES registry, DEFAULT_MODE, per-mode stacks, switching, runtime add/remove.
12. Modal screens — how modals suppress app-level bindings and present a dimmed backdrop.
13. Auto-focus behavior — selector semantics, inheritance from the app, the empty-string and wildcard cases.
14. Focus chain — which widgets are focusable, how visibility affects focus, focus_next/focus_previous semantics.
15. Mouse interaction and focus — which pointer events change focus.
16. Focus pseudo-classes (`:focus`, `:blur`) and focus trapping.
17. Screen lifecycle events — suspend and resume.
18. Mouse events on screens — when the screen itself receives MouseMove.
19. Screen lifecycle and cleanup — when screens are disposed, when they persist.
20. Constraints and error conditions — non-empty stack invariant, disallowed registrations, mode errors, dismiss-from-handler error.

## Key concepts
- A screen is a full-terminal container that owns a binding set, a CSS scope, and a focus chain.
- An app always has at least one screen; the stack cannot be emptied.
- The stack is ordered; only the top screen is active.
- Installed screens persist for the app's lifetime; non-installed pushed screens are disposed when popped.
- Modes are independent screen stacks keyed by name.
- Modal screens inherit from the regular screen type but suppress app-level bindings and typically present a translucent backdrop.
- `dismiss(value)` pops a screen and delivers a typed result to the caller's callback or awaiter.
- Auto-focus is a selector applied when the screen activates; screen setting overrides app setting unless explicitly inheriting.
- Focus is restored to the previously focused widget on pop.

## Behaviors and contracts
- Popping the last screen must raise a framework error; the stack invariant is never violated.
- Only the top screen appears in the app's children and receives input.
- `SCREENS` and `MODES` accept classes/factories/name-strings; supplying an already-constructed screen instance must error.
- Switching to the currently active mode is a no-op; switching to an unknown mode must error.
- Removing the active mode must error; removing a mode that has screens still cleans them up safely.
- `push_screen` with a callback delivers the dismiss result exactly once.
- `push_screen_wait` (or the `wait_for_dismiss` variant) resolves with the dismiss result and must only be used inside a worker; using it outside a worker must error.
- Dismissing from within the screen's own message handler in an awaited form must error; non-awaited dismiss is allowed.
- Result callbacks survive mode switches: dismissing after switching away and back still fires the correct callback.
- AUTO_FOCUS selector `"*"` focuses the first focusable widget; `""` disables auto-focus; unset/null inherits from app.
- Widgets with `visibility: hidden` are excluded from the focus chain unless a descendant explicitly overrides with `visibility: visible`.
- Clicking a non-focusable widget escalates to the nearest focusable ancestor; clicking into a subtree with no focusable ancestor leaves focus unchanged.
- `trap_focus()` only constrains the focus chain when the currently focused widget is inside the trapping subtree; otherwise it is a no-op.
- ScreenSuspend fires on the outgoing screen; ScreenResume fires on the newly-active screen (push, pop, or mode switch).
- CSS declared on a screen (inline or file-loaded) applies app-wide, not just within that screen. Inline CSS takes priority over file-loaded CSS.
- Modal screens prevent app-level bindings from firing; only the modal's own bindings and those of widgets inside it respond.

## Example requirements
All examples are JSX/TypeScript using Ink primitives and textual-js APIs:
- A screen component that declares BINDINGS, AUTO_FOCUS, and a CSS block, composed of simple widgets.
- An app with a `SCREENS` registry pushing an installed screen by name and dismissing with a typed result via a callback.
- An example using the await-based result form (`push_screen_wait`) inside a worker.
- A modal screen example (confirm dialog) with a translucent backdrop, showing dismiss delivering a boolean.
- A modes example with two named modes and a binding that switches between them, demonstrating preserved per-mode stacks.
- A focus navigation example showing `focus_next` / `focus_previous` with a selector argument.
- An example of `trap_focus()` scoping focus to a subtree.

## Cross-references
- `spec/docs-spec/api_screen.md` — Screen class API.
- `spec/docs-spec/api_app.md` — screen registry, push/pop/switch, modes.
- `spec/docs-spec/actions_and_bindings.md` — binding dismiss, app-level actions.
- `spec/docs-spec/api_events.md` — ScreenSuspend / ScreenResume events.
- `spec/docs-spec/api_work.md` — workers (required for `wait_for_dismiss`).
- `spec/docs-spec/styles_display_visibility.md` — visibility inheritance and focus chain.
- `spec/spec-src/01-runtime-app-and-lifecycle.md` — stack, modes, lifecycle.
- `spec/spec-src/03-message-event-and-dispatch.md` — screen events dispatch.

## Notes for writers
- Do not carry across Python-specific framing: no `async def dismiss`, no `@work` decorator, no `Generic[T]` / `Screen[T]` syntax as such. In textual-js, screens are generic via TypeScript type parameters on the component/class and the worker marker is a framework API call, not a decorator.
- `AUTO_FOCUS = None` in the source is the "inherit" case; in TS express this as `AUTO_FOCUS: string | null = null` (or undefined) and explain the tri-state (`null` inherit, `""` disable, otherwise selector).
- The dismiss-from-handler error needs rewording: there is no `await` on a method call to an own handler — explain it as "do not await dismiss from a message handler that the screen is currently dispatching".
- `NoActiveWorker`, `ScreenStackError`, `UnknownModeError`, `InvalidModeError`, `ActiveModeError`, `ScreenError` are framework errors; use the textual-js error names (likely the same) but describe them as thrown JS errors, not Python exception classes.
- "The only topmost screen appears in `app.children`" — in textual-js this is still true but framed in terms of the observable MobX tree that React renders; reinforce that hidden screens are suspended and do not render.
- Screen dimensions always match the terminal (Ink surface); CSS cannot change them — this still holds.
- Inline mode (height:auto with top/bottom border) is still a thing; do not drop it.
