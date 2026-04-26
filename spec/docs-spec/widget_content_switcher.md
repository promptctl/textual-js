# Docs Spec: ContentSwitcher Widget

## Purpose
Describes the docs page for `ContentSwitcher` -- a container that displays exactly one of its children at a time, selected by id.

## Audience
App authors building tabbed or switchable views; widget authors composing view-stacks.

## Required sections
1. Overview -- single-visible-child container, not focusable, subclass of the standard container.
2. Props/constructor parameters (children, id, className, disabled, initial).
3. Child widget requirements -- every switchable child must have a unique id; id-less children are hidden and ignored; child ids are scoped to the switcher's parent.
4. Reactive/observable properties -- `current` (the id of the visible child, or `null` to hide all).
5. Behavior when `current` changes -- the previously-visible child's `display` is set to false, the new child's to true, all under a batched update to avoid intermediate repaints.
6. Error conditions -- setting `current` to an unknown id raises a "no matches" error; adding a child with no id and no explicit id parameter raises a validation error.
7. Mount behavior -- on mount, every child except `initial` starts hidden; `null`/missing `initial` hides all children.
8. `visibleContent` property -- returns the current visible child or null.
9. `addContent(widget, options)` method -- adds a child after mount, optionally switching to it immediately; returns a Promise that resolves when the child is mounted.
10. No messages, no bindings, no component classes.
11. Default CSS (height auto).
12. Typical usage patterns -- buttons paired with switcher children, driven by a single handler.

## Key concepts
- The switcher is purely a visibility controller: all children remain in the DOM, but `display` toggles keep exactly one visible.
- Id scoping -- children's ids are scoped to the switcher's parent, so button ids can intentionally match switcher child ids (they live in separate parents).
- `current` is the single source of truth for visibility; setting it triggers the change under a batched update.
- `addContent` is the safe dynamic-addition path; it handles mount ordering, default-hidden display, and optional auto-switch.
- The widget is intentionally message-free and binding-free -- driving logic lives in the parent.

## Behaviors and contracts
- Default `current` is `null` (no visible child) unless `initial` is provided.
- Setting `current` to an unknown id raises a no-matches error.
- Setting `current` to `null` hides all children.
- The reactive must not fire its watcher during construction; initial visibility is applied in the mount lifecycle.
- `addContent` with no id and no explicit id option raises a validation error.
- `addContent` mounts the new widget with display set to hidden, then (if `setCurrent` is true) updates `current` to the new widget's id.
- The return value of `addContent` is a Promise that resolves when the mount completes.
- Visibility transitions are batched: intermediate frames where two children are visible at once must not be observable.

## Example requirements
All examples are JSX/TypeScript. Examples must demonstrate:
- Buttons paired with a `ContentSwitcher` whose children have matching ids; a single button-pressed handler sets `switcher.current = event.button.id`.
- Using `initial` to choose the startup view.
- Setting `current` to `null` to hide all children.
- Calling `addContent(widget, { id, setCurrent: true })` from a handler to add and switch to a new view.
- Catching the no-matches error when setting `current` to a bogus id.

## Cross-references
- `spec/docs-spec/widget_collapsible.md` -- related visibility-management container.
- `spec/docs-spec/widget_button.md` -- the canonical driver for the switcher.
- `spec/docs-spec/api_containers.md` -- base container behavior.
- `spec/spec-src/10-widget-catalog.md` -- catalog entry.
- `spec/spec-src/02-dom-reactivity-and-query.md` -- id scoping and query semantics.

## Notes for writers
- Replace `from textual.css.query import NoMatches` with a conceptual description; name the textual-js error class explicitly once but do not keep the Python import.
- `AwaitComplete` is a Python awaitable; the JS equivalent is a Promise. Describe the return value as a Promise.
- `app.batch_update()` should be described as "batched update" (the equivalent textual-js batching primitive); do not expose Python method syntax.
- `init=False` on the reactive is an implementation detail -- describe the observed behavior ("the watcher does not fire during construction").
- Do not mention `display = False` as a Python attribute access; describe it as toggling the `display` style.
