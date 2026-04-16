# Docs Spec: Select Widget

## Purpose
Describe the Select widget, a focusable dropdown that lets the user pick
exactly one option from a list. Covers the option model, the blank/no-selection
state, overlay behavior, type-to-search, messages, and styling.

## Audience
Application authors building forms, command inputs, setting panels, or any UI
that needs a compact single-choice picker.

## Required sections
1. Overview (single-choice dropdown; compact vs. bordered)
2. Option model: `{ label, value }` pairs with unique, hashable values
3. Construction: primary constructor and a `fromValues` convenience factory
4. Props / constructor parameters
5. Observable (reactive) state (`expanded`, `value`, `prompt`, `compact`)
6. The blank / no-selection sentinel (what "nothing selected" means and how
   to test for it)
7. `allowBlank` behavior (auto-select first item when false; cannot clear
   when false)
8. Methods: `setOptions`, `clear`, `isBlank`, reading `selection` vs `value`
9. Overlay behavior: opening, dismissing, max height, screen overlay
10. Type-to-search (substring, inactivity timeout)
11. Messages: `Select.Changed`
12. Bindings (collapsed widget keys, overlay keys)
13. Default TCSS and the `-expanded` state class, compact styling
14. Validation errors (setting an unknown value, clearing when blank is
    disallowed, constructing with no options when blank is disallowed)
15. Examples

## Key concepts
- Generic option value type; values must be unique and comparable
- A dedicated "no selection" sentinel distinct from `null`/`undefined`
- Two composed pieces: a compact "current value" row and a floating overlay
  option list
- `value` is the authoritative selected value; `selection` is a convenience
  that maps the blank sentinel to `null`
- `expanded` reactive drives the overlay's visibility
- Type-to-search matches substrings within option labels; ties break toward
  the earliest match; idle time resets the query

## Behaviors and contracts
- Only one option is selected at a time
- Setting `value` to an unknown option is a validation error, not a silent
  no-op
- When `allowBlank` is false: the widget must always have a selection;
  construction with no options is an error; `clear()` is an error; setting
  the blank sentinel is an error
- When `allowBlank` is true: `clear()` returns the widget to the blank
  state and the prompt placeholder is shown
- `setOptions` replaces the entire option set; on replacement, selection
  resets to blank (if allowed) or to the first option
- `Select.Changed` is posted whenever `value` transitions, regardless of
  whether the change was programmatic or user-driven
- Opening the overlay is the single code path for selection: keyboard and
  click both route through it (no separate "direct pick" bypass)
- Overlay is dismissed without a selection change on escape
- Compact mode is a styling toggle only; it does not change semantics

## Example requirements
All examples JSX/TypeScript using Ink primitives:
- Basic Select with an array of label/value objects
- `fromValues` factory producing labels via `String(value)`
- Handling a selection change with the event handler and reading `value`
- Comparing `value` to the blank sentinel vs. reading `selection` (which
  returns `null` for blank)
- Pre-selecting a value with `allowBlank: false`
- Replacing options dynamically via `setOptions`
- Type-to-search demonstration with a longer list

## Cross-references
- spec/docs-spec/widget_selection_list.md (multi-select counterpart)
- spec/docs-spec/api_events.md (Changed message plumbing)
- spec/spec-src/03-message-event-and-dispatch.md (message contract)
- spec/spec-src/10-widget-catalog.md (catalog entry)

## Notes for writers
- Do not describe Python `Hashable`, `Generic[SelectType]`, `NoSelection` as
  a Python class, or `Select.NULL` as a Python sentinel. Use a JS-idiomatic
  sentinel concept (e.g., a unique exported symbol or constant); document
  the contract, not the Python type system.
- Do not describe the Python `@on(Select.Changed)` decorator; use the JS
  event-handler pattern for messages as defined by textual-js.
- Do not describe Rich renderables as option labels; labels are React nodes
  or strings.
- Do not describe Python `classmethod` semantics for `fromValues`; document
  it as a static factory on the component.
- Validation errors should be described behaviorally (what triggers them,
  what the developer sees) without naming Python exception classes.
- "Type to search resets after 0.7 seconds" is a specific tunable; describe
  it as "resets after a short idle period" and let the spec nail down the
  number in the behavioral spec, not the docs.
