# Docs Spec: SelectionList Widget

## Purpose
Describe the SelectionList widget: a focusable vertical list where each item
has a toggle state, allowing multi-select. Covers the Selection item model,
highlight vs. selection semantics, bulk operations, the three distinct
messages, and styling.

## Audience
Application authors building multi-select pickers, checklists, permission
matrices, or any UI where the user checks and unchecks a set of items.

## Required sections
1. Overview (multi-select, built on top of the option list primitive)
2. The Selection item: prompt, value, initial state, optional id/disabled
3. Construction patterns: Selection objects, 2-tuples, and 3-tuples
4. Props / constructor parameters
5. Observable state (`highlighted` index)
6. Reading selected values: the `selected` list (values, not indices)
7. Mutation API: `select`, `deselect`, `toggle`, `selectAll`, `deselectAll`,
   `toggleAll`, plus inherited option management (`addOption`, `addOptions`,
   `clearOptions`, `getOptionAtIndex`, `getOption`)
8. Messages: `SelectionHighlighted`, `SelectionToggled`, `SelectedChanged`
   (including which message fires for which operation, and how bulk
   operations collapse messages)
9. Bindings (inherited cursor keys + `space` to toggle)
10. Component classes for toggle button styling
11. Default TCSS
12. Errors (malformed selection tuple; option not found)
13. Message timing (no messages during construction; first messages after
    mount)
14. Examples

## Key concepts
- Each item has three pieces: display prompt, value, and a boolean state
- Values must be unique within the list and are what the `selected` list
  exposes
- "Highlighted" (cursor position) is independent from "selected" (checked
  state)
- Mutation methods accept either a Selection object or a raw value
- Bulk toggles fan out: one `SelectionToggled` per toggled item; a single
  `SelectedChanged` per bulk call
- Programmatic `select`/`deselect` do not emit `SelectionToggled`; they do
  emit `SelectedChanged` when the set actually changes

## Behaviors and contracts
- `selected` is a list of values (the order is the item order)
- `select(x)` and `deselect(x)` are idempotent on state (calling twice does
  not double-fire `SelectedChanged` if the state did not change)
- `toggle(x)` flips the state and emits `SelectionToggled` for that item
- `selectAll` / `deselectAll` emit one `SelectedChanged` only if the
  resulting set differs from the prior set
- `toggleAll` emits one `SelectionToggled` per item and one
  `SelectedChanged`
- Constructor tuples must be 2-tuples `(prompt, value)` or 3-tuples
  `(prompt, value, initialState)`; anything else is an error
- `addOptions` rejects bare options and separators (use Selection objects
  or prompt/value tuples)
- Spacebar and Enter both trigger toggle on the highlighted item
- Messages are suppressed during construction; they start flowing once the
  widget is mounted
- Generic over the value type for type safety in TypeScript

## Example requirements
All examples JSX/TypeScript using Ink primitives:
- SelectionList built from mixed tuple forms (2-tuple and 3-tuple)
- SelectionList built from explicit Selection objects
- Reading `selected` values after user interaction
- Handling `SelectedChanged` to update a sibling widget
- Programmatic bulk toggle via `selectAll` / `deselectAll`
- Distinguishing between `SelectionToggled` (which item flipped) and
  `SelectedChanged` (the set changed)
- Styling the toggle buttons via the component classes
- Compact mode

## Cross-references
- spec/docs-spec/widget_select.md (single-select counterpart)
- spec/docs-spec/api_events.md (message/event handler plumbing)
- spec/spec-src/03-message-event-and-dispatch.md (message contract)
- spec/spec-src/10-widget-catalog.md (catalog entry)

## Notes for writers
- Do not describe Python `Generic[SelectionType]`; describe TypeScript
  generics using the JS-idiomatic pattern.
- Do not use Python handler names like `on_selection_list_selection_toggled`.
  textual-js uses JS/React event props; name them using the framework's
  actual convention.
- Do not describe Python `ContentText` or Rich `Text`; prompts are React
  nodes or strings.
- Do not describe Python `@dataclass` distinctions between messages; in JS
  these are all plain message objects with a defined shape.
- The three messages are a contract the docs must clearly separate: which
  one fires, when, and in what multiplicity for bulk ops. Present this as
  a simple table with the operation in rows and the messages in columns.
- Keep the highlight vs. selection distinction prominent - new users
  routinely confuse the two.
