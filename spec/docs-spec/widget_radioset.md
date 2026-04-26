# Docs Spec: RadioSet Widget

## Purpose
Describes the `RadioSet` widget — a container that groups `RadioButton` children into a mutually exclusive set with a single focus target and unified keyboard navigation. Teaches readers how to build a radio group, observe the chosen option, and rely on the mutual-exclusion invariant.

## Audience
Application authors building single-choice selection UIs (settings, filters, form controls). Also useful as a reference for "focus the container, not the children" patterns.

## Required sections
1. Overview (mutual-exclusion grouping of radio buttons, set-level focus)
2. Characteristics (the set is focusable; children are not; container yes)
3. Construction (strings auto-wrapped into `RadioButton` instances, or children passed as `RadioButton` nodes)
4. Props (variadic buttons/strings, `tooltip`, `compact`, standard widget props)
5. Properties (`pressedButton`, `pressedIndex`)
6. Reactive attributes (`compact`)
7. Messages (`Changed`) with payload shape and selector-matching note
8. Bubbling behavior (child `RadioButton.Changed` messages are intercepted and stopped; only `RadioSet.Changed` is emitted upward)
9. Bindings (`up`/`left`/`down`/`right` for navigation, `enter`/`space` to toggle)
10. Actions (`nextButton`, `previousButton`, `toggleButton`)
11. Mount behavior (selects first enabled button, disables focus on children, enforces single-on invariant across multiple `value={true}` children)
12. Click handling (clicks anywhere focus the set)
13. Default TCSS (selection highlighting, compact-mode class, child restyling)
14. Mutual exclusion invariant (at most one on at a time; clicking an on button keeps it on)
15. Usage patterns

## Key concepts
- The container is the focus authority — children's focus is explicitly disabled on mount (single enforcer for keyboard navigation)
- Navigation wraps at the ends (pressing `down` on the last button selects the first)
- Navigation actions skip disabled buttons
- Mutual exclusion is an invariant: the set enforces that at most one button is on at any time; toggling one on turns the previous one off
- A button once pressed cannot be toggled off by clicking it again — it stays on (the only way to change state is to select a different button)
- `pressedIndex` is `-1` when no button is pressed — a sentinel rather than `null`, chosen to keep the field numeric
- Child `RadioButton.Changed` messages are consumed by the set and do not escape — parent widgets only see `RadioSet.Changed` (single source of truth for "the set's selection changed")

## Behaviors and contracts
- Construction with bare strings produces `RadioButton` instances with default state
- If multiple children arrive with `value: true`, only the first is kept on; the rest are silently turned off without emitting per-button `Changed` messages (avoids spurious events during initialization)
- On mount, the first enabled button is highlighted/pressed via the next-button action
- `nextButton` / `previousButton` actions navigate through enabled buttons only, wrapping at the ends
- `toggleButton` action toggles the currently-highlighted button — subject to the mutual-exclusion invariant, so toggling an on button is a no-op
- `RadioSet.Changed` fires whenever the pressed button changes and carries `radioSet`, `pressed` (the now-on button), `index`, and a `control` alias
- The `pressed` attribute is exposed to the port's `on()` selector-matching equivalent so handlers can filter by selector
- Clicking anywhere in the set — including on a child button — focuses the set itself (not the child)
- `compact` adds the compact class, removing border and padding

## Example requirements
All JSX/TypeScript using Ink primitives and React function components wrapped with `observer()`. Cover:
- RadioSet built from bare strings
- RadioSet with `RadioButton` children, one marked with initial `value={true}`
- Handling `Changed` to read the selected option
- Navigating with keyboard (`up`/`down`/`left`/`right`) and toggling with `enter`/`space`
- Using `compact` for a chromeless variant
- Styling the focused vs. blurred `-selected` label via TCSS

## Cross-references
- `spec/docs-spec/widget_radiobutton.md` — child widget
- `spec/docs-spec/widget_option_list.md` — alternative list-style single-select UI
- `spec/spec-src/03-message-event-and-dispatch.md` — message bubbling and stop-propagation
- `spec/spec-src/06-input-bindings-actions-and-commands.md` — bindings and actions
- `spec/spec-src/10-widget-catalog.md` — widget catalog entry
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS classes and focus/blurred styling

## Notes for writers
- Do not describe `VerticalScroll` as an inherited base; describe the widget as a vertical, scrollable container at the behavior level
- `can_focus=True` / `can_focus_children=False` are Python class-variable overrides; describe the behavior ("the set is focusable; children are not") without referencing the Python attribute names
- Python handler naming (`on_radio_set_changed`) is Python-specific; describe subscription via the port's message API / `on()` equivalent
- The `ALLOW_SELECTOR_MATCH` flag on the `pressed` attribute is a Python-Textual internal; describe behaviorally as "you can filter `Changed` handlers by the pressed button's selector via the port's `on()`-style API"
- `RenderableType` for tooltip becomes the port's tooltip type (string or content value)
- Do not reproduce Python action method names (`action_next_button`); describe action names as they are registered in the port
- Call out explicitly that clicking an already-on button does NOT turn it off — this is a commonly-mistaken behavior
- Be explicit that `pressedIndex` uses `-1` (not `null`/`undefined`) to signal "nothing pressed"
