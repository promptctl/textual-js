# Docs Spec: ListItem Widget

## Purpose
Document the `ListItem` widget — a non-focusable row widget designed to be a child of `ListView`, responsible for rendering its own content and reporting clicks to its parent — so readers understand how to compose items into a `ListView`.

## Audience
App authors composing lists (menus, pickers, sidebars); widget authors building list-based custom widgets.

## Required sections
1. Overview — `ListItem`'s role as a `ListView` child and what it is not (not focusable, not a container of app interactive logic).
2. Importing and mounting — typically only used inside a `ListView`.
3. Props / options — standard widget props only.
4. Reactive attributes — `highlighted`, toggled by the parent `ListView`.
5. Dynamic CSS classes — `-highlight` (from highlighted state) and `-hovered` (from mouse hover).
6. Event handling — click events are reported to the parent; Enter/Leave events toggle hover class and are stopped.
7. Relationship to `ListView` — ListView owns the highlighted index and assigns `highlighted` to each child; default styling lives in `ListView`'s TCSS.
8. Styling — there is no standalone default TCSS; styling comes from the parent `ListView`'s scoped rules for `ListView > ListItem`.
9. Examples — wrapping a Label or custom content in a `ListItem`; using the `-highlight` and `-hovered` classes for custom theming.

## Key concepts
- `ListItem` is a row-shaped content wrapper for `ListView`.
- It is not focusable; the parent `ListView` is the focus target.
- Highlight and hover state are reflected in dynamic CSS classes.
- Click events are forwarded to the parent, which owns selection semantics.

## Behaviors and contracts
- `highlighted` reactive toggles `-highlight` on the widget.
- Mouse Enter / Leave toggle `-hovered` and stop propagation.
- Click on a `ListItem` notifies the parent `ListView`, which focuses itself, sets its index, and posts a `Selected` message.
- `ListItem` posts no public messages.
- `ListItem` has no bindings and no component classes.
- Default styling is provided by the parent `ListView`'s TCSS; overriding styles in a parent context uses `ListView > ListItem.-highlight` and similar selectors.

## Example requirements
All examples are JSX/TypeScript using Ink primitives.
- A minimal `ListView` containing several `ListItem`s, each wrapping a `<Label>`.
- Custom content inside a `ListItem` (multiple children, a small row layout).
- TCSS customizing the `-highlight` and `-hovered` appearances via `ListView > ListItem.-highlight { ... }`.

## Cross-references
- Related docs specs: `spec/docs-spec/widget_list_view.md`, `spec/docs-spec/widget_label.md`.
- Related behavioral specs: `spec/spec-src/10-widget-catalog.md`, `spec/spec-src/09-widget-base-contract.md`, `spec/spec-src/03-message-event-and-dispatch.md`.

## Notes for writers
- Do not document the internal `_ChildClicked` message as a public API; mention it only conceptually ("the click is forwarded to the parent") if at all.
- Avoid Python `watch_*` method references. Describe state changes as observable reactions owned by the widget.
- Do not present `ListItem` as usable outside `ListView`; emphasize the coupling.
- `ALLOW_MAXIMIZE` and other Python class variables do not translate literally. Only document an observable behavior if textual-js exposes it.
