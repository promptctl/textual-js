# Docs Spec: Collapsible Widget

## Purpose
Describes the docs page for `Collapsible` -- a container widget that hides or shows its children under a focusable title bar.

## Audience
App authors building disclosure UIs; widget authors composing collapsible sections.

## Required sections
1. Overview -- container with a title bar that toggles visibility of its children.
2. Structure -- inner composition: a focusable title component and an inner contents container.
3. Props/constructor parameters (children, title, collapsed, collapsedSymbol, expandedSymbol, id, className, disabled).
4. Composing content -- the two supported patterns (children passed as props vs nested JSX); both are equivalent.
5. Reactive/observable properties (`collapsed`, `title`) and their effects.
6. Messages -- `Collapsible.Toggled` (base), `Collapsible.Expanded`, and `Collapsible.Collapsed`; payload (`collapsible`, `control`); message bubbling; the fact that the watcher posts messages for both user interaction and programmatic toggle.
7. Bindings -- `enter` on the title toggles; the title is the focusable element, not the outer container.
8. CSS -- the automatic `-collapsed` class added to the Collapsible while collapsed; no component classes.
9. Default styling summary (width `1fr`, height auto, surface background, top border, padding, focus-within tint, title hover and focus styling, indented contents).
10. Nesting behavior -- inner collapsibles retain their own state; collapsing an outer one hides (but does not modify) the inner one.
11. Typical usage patterns.

## Key concepts
- Collapsible composes two internal pieces: a title component and a contents container.
- When collapsed, the contents container has `display: none` applied via TCSS matching `&.-collapsed > Contents`.
- The outer component delegates focus to its title.
- The collapse/expand glyphs are configurable as strings.
- `Toggled` is the base message; `Expanded` and `Collapsed` are specializations. A handler that subscribes to `Toggled` receives both directions.
- State changes via user interaction and via programmatic assignment to the `collapsed` reactive both go through the same watcher and post messages.
- Each nested Collapsible has independent state; the library preserves it when the ancestor toggles.

## Behaviors and contracts
- Default `collapsed` is `true`, default `title` is a sensible placeholder (e.g., "Toggle").
- Default symbols: `"▶"` when collapsed, `"▼"` when expanded; both configurable.
- The `collapsed` reactive is initialized in a mode that does not fire the watcher during construction; the first message is posted only on an actual state change.
- Clicking the title toggles; `enter` when the title is focused toggles.
- Messages bubble; the `control` property aliases `collapsible` for generic listeners.
- Inner collapsibles are not reset when an outer one is collapsed; their `collapsed` values are preserved.
- Maximization (the widget supports it) is permitted on the outer component; text selection on the title is disabled.

## Example requirements
All examples are JSX/TypeScript. Examples must demonstrate:
- A Collapsible with a title and a Label child, using the JSX-children form.
- A Collapsible constructed with children passed via a prop (for parity with the constructor form).
- Subscribing to `Collapsible.Toggled` and responding to the event.
- Subscribing to `Collapsible.Expanded` and `Collapsible.Collapsed` separately.
- Programmatically flipping `collapsed` from an external handler and observing the emitted message.
- Nested Collapsibles that preserve inner state across outer toggles.

## Cross-references
- `spec/docs-spec/widget_content_switcher.md` -- related visibility-management container.
- `spec/docs-spec/api_containers.md` -- base container behavior.
- `spec/docs-spec/api_on.md` -- message handler conventions.
- `spec/spec-src/10-widget-catalog.md` -- catalog entry.
- `spec/spec-src/09-widget-base-contract.md` -- base widget contract.

## Notes for writers
- Do not describe `CollapsibleTitle.Toggle` as an internal Python message class. Describe the internal title-to-container messaging conceptually: "clicking or pressing Enter on the title causes the Collapsible to toggle its `collapsed` reactive."
- Do not describe `_watch_collapsed` or `_on_collapsible_title_toggle` as hooks users can override; they are internal.
- Replace Python `with Collapsible(...):` context-manager examples with JSX children; both forms end up identical in textual-js.
- Flag labels like `init=False`, `ALLOW_MAXIMIZE`, `ALLOW_SELECT` are implementation details -- summarize behavior without naming these constants.
- `scroll_visible` after refresh is a behavior worth mentioning briefly: when expanded, the contents are scrolled into view if the widget is mounted.
