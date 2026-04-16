# Docs Spec: Screen

## Purpose
Document the `Screen` class — the top-level container for a single "page" of an app. Covers screen-stack semantics (including modal screens), focus management within a screen, widget lookup by coordinate, maximization, text selection, bindings, signals, and the screen lifecycle.

## Audience
App authors structuring a multi-screen app (main screen, settings, modal dialogs, command palette). Widget authors integrating with screen-scoped services (focus, maximization, selection). Framework extenders adding screen types.

## Required sections
1. Overview — what a screen is, how it differs from a widget, the screen stack and active/current states, modes.
2. Construction options — `name`, `id`, `classes`.
3. Class-level configuration — auto-focus selector, scoped CSS (inline and file-path), title/subtitle overrides, scoped command providers, maximize allow-list, escape-to-minimize, breakpoints, component classes, text-selection permission.
4. Default bindings — focus-next, focus-previous, copy-selected-text.
5. Reactive attributes — `focused`, `title`, `subTitle`, `maximized`, `selections`, `stackUpdates`.
6. Properties — `isModal`, `isCurrent`, `isActive`, `layers`, `size`, `allowSelect`, `activeBindings`, `focusChain`.
7. Screen-level signals — layout-refresh, bindings-updated, text-selection-started.
8. Focus API — `setFocus`, `focusNext`, `focusPrevious`, `refreshBindings`.
9. Widget lookup by coordinate — `getWidgetAt`, `getHoverWidgetsAt`, `getWidgetsAt`, `getFocusableWidgetAt`, `getStyleAt`, `getWidgetAndOffsetAt`, `getOffset`, `findWidget`.
10. Maximization — `maximize(widget, container)` and `minimize`.
11. Text selection — `clearSelection`, `getSelectedText`.
12. Rendering — `render` (produces the screen's background visual).
13. Layout — `arrange(size)` and how it interacts with maximization.
14. Built-in actions — copy-text, maximize, minimize, blur, focus.
15. Pointer shape updates.
16. Specialized subclasses — `SystemModalScreen` (for framework-internal modal UI) and `ModalScreen` (for user modals).

## Key concepts
- A screen is a widget that fills the terminal; only one screen is "active" at a time but several may be on the stack (modal overlays above a base screen).
- Modal screens restrict input to themselves while active.
- Each screen owns its focus state, its selections, its maximized widget, and its bindings.
- The screen publishes signals when its layout refreshes, its bindings update, and when text selection begins.
- `AUTO_FOCUS`-equivalent selector targets a widget to focus when the screen becomes active.
- `TITLE` / `SUB_TITLE` class-level config overrides the app's title/subtitle while this screen is current.
- `COMMANDS` class-level config extends the command palette with providers scoped to this screen.
- `ALLOW_IN_MAXIMIZED_VIEW` is a selector naming siblings allowed to remain visible alongside a maximized widget.
- Breakpoint class-level config overrides the app-level breakpoints for this screen only.
- `HoverWidgets` is the result shape of a hover-lookup — both the directly-under-mouse widget and any ancestor with a hover style.

## Behaviors and contracts
- `setFocus(widget)` focuses the given widget (or unfocuses when called with null), optionally scrolling into view; framework handles focus-enter/leave events.
- `focusNext(selector)` / `focusPrevious(selector)` move focus through the screen's focus chain filtered by the selector.
- Coordinate-lookup methods translate screen-space `(x, y)` to the widget at that cell. They throw a no-widget error if the coordinate is empty. Widget-and-offset returns null when outside any widget.
- `maximize(widget, container)` attempts to elevate the given widget; when `container` is true, the framework walks ancestors to pick the most suitable container. Returns whether maximization succeeded.
- `minimize()` clears any maximized widget.
- `clearSelection()` clears current text selection; `getSelectedText()` returns the concatenated selected text or null.
- `arrange(size)` lays out children using the dock/container arranger; when a widget is maximized, the arrangement restricts to that widget plus any allow-listed siblings.
- `updatePointerShape()` picks a mouse-pointer shape for the current cursor position by reading styles at the hover target.
- Screens receive a default set of key bindings for tab-navigation and copy; subclasses may override or extend.
- Screens with `TITLE`/`SUB_TITLE` set cause the header/footer widgets to use those overrides while the screen is current.
- `SystemModalScreen` is used internally for framework UI (command palette); user apps should subclass `ModalScreen` instead.
- Result-callback infrastructure: when a screen is pushed with a callback, dismissal with a result invokes that callback (and resolves a promise, if present).

## Example requirements
JSX/TypeScript examples using TextualApp + Screen. Include at minimum:
- Declaring a custom screen class with a `compose` method and an `AUTO_FOCUS` selector.
- Pushing and popping screens in a stack; pushing a modal screen and awaiting a result.
- Declaring a modal dialog via `ModalScreen` with a typed result.
- Using `setFocus` imperatively to focus a specific widget.
- Using `getWidgetAt(x, y)` to find the widget under a coordinate.
- Maximizing the focused widget via the built-in action.
- Subscribing to `screenLayoutRefreshSignal` from another component.
- Overriding `TITLE` / `SUB_TITLE` and observing the header update.
- Using scoped `COMMANDS` to add a command-palette provider active only in this screen.

## Cross-references
- `api_app.md` in `spec/docs-spec/` — the app that hosts the screen stack.
- `api_widget.md` in `spec/docs-spec/` — the base of Screen.
- `api_binding.md` / `actions_and_bindings.md` in `spec/docs-spec/` — binding/action system referenced by default screen bindings.
- `api_signal.md` in `spec/docs-spec/` — the signal primitive used for screen signals.
- `api_command.md` in `spec/docs-spec/` — scoped command providers.
- `api_query.md` in `spec/docs-spec/` — selectors used by AUTO_FOCUS / ALLOW_IN_MAXIMIZED_VIEW.
- `api_geometry.md` / `api_coordinate.md` in `spec/docs-spec/` — Region/Offset/Size types.
- `spec/spec-src/01-runtime-app-and-lifecycle.md` — screen stack and lifecycle.
- `spec/spec-src/05-layout-render-and-compositor.md` — arrangement and layout.

## Notes for writers
- Do not document `asyncio.Future` in `ResultCallback`; the JS port uses a native promise. Describe the semantics: calling the result-callback invokes the user callback with the dismiss-value and resolves any awaited push.
- Do not use Python-style method names (`get_widget_at`). The JS port uses camelCase (`getWidgetAt`). The doc should use JS names throughout.
- The "CSS applies to whole app" note in the source (for `CSS` and `CSS_PATH`) applies in the JS port too — screen-declared TCSS is mounted as app-level rules; make this explicit so authors don't assume it's scoped to that screen.
- Describe `layers` as the ordered stack of named layers including framework-provided system layers used for overlays and scrollbars.
- `ActiveBinding` and `HoverWidgets` appear as data shapes returned from screen APIs — document them as plain objects with the listed fields, not Python NamedTuples.
- Distinguish modal vs. non-modal screens clearly; many newcomers expect the stack to be purely modal.
