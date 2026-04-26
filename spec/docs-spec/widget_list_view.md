# Docs Spec: ListView Widget

## Purpose
Document the `ListView` widget — a focusable vertical list of `ListItem` children with keyboard navigation, highlight/selection semantics, and dynamic add/remove methods — so readers can build scrollable pick lists, menus, and sidebars.

## Audience
App authors building lists and menus; widget authors composing list-backed custom widgets.

## Required sections
1. Overview — what `ListView` is, its relationship to `ListItem`, and its focus model (`canFocus: true`, `canFocusChildren: false`).
2. Importing and mounting — composition with `ListItem` children.
3. Props / options — `initialIndex` (nullable), plus standard widget props.
4. Reactive attributes — `index` (nullable, clamped to `[0, length-1]`).
5. Properties — `highlightedChild` returning the current `ListItem` or null.
6. Messages / events — `Highlighted` and `Selected`, the fields on each, and their handler names (or `on`-mechanism equivalents).
7. Bindings — Up, Down, Enter (all hidden from the footer).
8. Keyboard navigation — disabled items are skipped; navigation does not wrap; pressing Down when nothing is highlighted highlights the first item; pressing Up highlights the last.
9. Mouse interaction — clicking an item focuses the list, sets the index, and posts `Selected`.
10. Mutation API — `append`, `extend`, `insert`, `clear`, `pop`, `removeItems`, and the awaitable returned by each.
11. Index maintenance on removal — rules for how `index` is adjusted when items before/at/after the highlighted index are removed.
12. Initial highlight — `initialIndex` defaults to 0; `null` means no initial highlight; a disabled initial item advances (with wrapping) to the next enabled item.
13. Styling — default TCSS including focus-state variants using `$block-cursor-*` and `$block-cursor-blurred-*` tokens.
14. `length` — the widget reports the number of children (e.g., via a `length` property).
15. Examples — basic list, handling selection, dynamic modification, starting with no highlight, styling the highlight.

## Key concepts
- List-shaped focusable container; children cannot individually focus.
- `ListItem` is the required child type.
- The list owns `index`; children passively reflect their highlighted state.
- Selection (via Enter or click) is distinct from highlight (cursor movement).
- Mutation methods return awaitables that resolve when the DOM update completes.
- Focused vs. blurred state changes the highlight styling.

## Behaviors and contracts
- `index` is clamped into `[0, length-1]` on assignment; becomes null when the list is empty.
- `initial_index` out of range clamps to 0.
- Down at last enabled item is a no-op (no wrap). Up at first enabled item is a no-op.
- Pressing Down when `index` is null highlights the first item. Pressing Up highlights the last.
- Disabled items are skipped during navigation.
- `pop()` with no arguments removes the last item.
- `removeItems` accepts negative indices.
- Index adjustments on removal:
  - Removing items before the highlight decrements the highlight.
  - Removing the highlighted item re-validates the highlight (clamps) and re-highlights the new item at that position.
  - Removing items after the highlight leaves it unchanged.
  - Removing all items sets `index` to null.
- `Highlighted` is posted whenever the highlighted item changes, including transitions to null.
- `Selected` is posted on Enter or click with the current item and its index.
- Both events support selector-based matching (e.g., an `on`-mechanism filter on `item`).
- Clicking an item focuses the list first, then updates `index`, then posts `Selected`.

## Example requirements
All examples are JSX/TypeScript using Ink primitives.
- Basic list of three items, each wrapping a Label.
- Handling `Selected` via the `on` mechanism (inspecting `event.index` and `event.item`).
- Dynamic modification: append, insert at position 0, pop last, remove by indices, clear all — all awaited.
- Starting with no highlight (`initialIndex: null`).
- Using selector-based event matching to respond only when a specific item is selected.
- Styling the highlighted row via TCSS on `ListView:focus > ListItem.-highlight`.

## Cross-references
- Related docs specs: `spec/docs-spec/widget_list_item.md`, `spec/docs-spec/widget_option_list.md`, `spec/docs-spec/widget_tree.md`, `spec/docs-spec/actions_and_bindings.md`, `spec/docs-spec/api_on.md`.
- Related behavioral specs: `spec/spec-src/10-widget-catalog.md`, `spec/spec-src/09-widget-base-contract.md`, `spec/spec-src/03-message-event-and-dispatch.md`, `spec/spec-src/06-input-bindings-actions-and-commands.md`, `spec/spec-src/04-styling-and-css-engine.md`.

## Notes for writers
- Do not describe `AwaitMount`, `AwaitRemove`, `AwaitComplete` as Python types. Describe mutation return values as Promises that resolve after the DOM update is applied.
- Do not describe `loop_from_index` or other Python internals; describe navigation as "skip disabled items, do not wrap at the edges".
- Do not describe `@on(ListView.Highlighted, item=selector)` using Python decorator syntax. Describe selector-based matching in terms of the textual-js `on` mechanism (see `api_on.md` docs spec).
- Do not mention `IndexError` exceptions. Describe `pop()` on an empty list as an error condition; the concrete error type is defined by textual-js.
- Make clear that `ListView` defines the default styling for its `ListItem` children via descendant selectors, so styling for items is scoped inside `ListView { ... }` blocks.
- The `__len__` Python method is exposed as a `length` property (or equivalent) in textual-js.
