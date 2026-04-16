# Docs Spec: Checkbox Widget

## Purpose
Describes the docs page for the `Checkbox` widget -- a focusable toggle control that stores and displays a boolean value, posting a change message when the value changes.

## Audience
App authors adding boolean-input controls; widget authors referencing the Checkbox API.

## Required sections
1. Overview -- what a Checkbox is, focusable, not a container, inherits the toggle-button behavior.
2. Props/constructor parameters (label, value, buttonFirst, id, className, disabled, tooltip, compact).
3. Note that setting the initial value in the constructor does not emit a change message.
4. Reactive/observable properties (value, compact) and their effects (CSS class toggles, re-layout).
5. `label` property -- mutable; assignment triggers re-layout.
6. `toggle()` method -- inverts `value`, returns the component instance for chaining.
7. Messages -- `Checkbox.Changed` shape (`value`, `checkbox`, `control`), subscription convention.
8. Key bindings -- `enter` and `space` toggle the value.
9. Component classes (`toggle--button`, `toggle--label`) for targeting sub-parts in TCSS.
10. Automatic CSS classes (`-on` when checked, `-textual-compact` when compact).
11. Default styling summary -- border behavior (blurred vs focused), padding, surface background, toggle indicator glyphs, focus cursor style on label, compact-mode stripping of border and padding.
12. Usage patterns -- basic, handler, programmatic control.

## Key concepts
- Checkbox stores a boolean and visually reflects it via an `-on` class that restyles the indicator.
- The widget renders three characters for the indicator: a left cap, an inner character (e.g., `X`), and a right cap; the caps match the widget background so the indicator looks like a contiguous block.
- `buttonFirst` controls whether the indicator appears before or after the label.
- Click and the `enter`/`space` keys all toggle the value and post `Changed`.
- Setting the initial value via the constructor is a "quiet" assignment -- no `Changed` message.
- Compact mode removes border and padding for minimal display.
- `label` is rewritable and triggers a layout refresh when changed.
- `toggle()` returns the component for chaining.

## Behaviors and contracts
- Default `value` is `false`.
- Default `buttonFirst` is `true`.
- Setting `value` programmatically (outside the constructor) posts `Changed`.
- Setting `value` inside the constructor suppresses `Changed` (matches the prevent-initial-emit pattern).
- `Changed` carries the new value and a reference to the checkbox; `control` aliases `checkbox` for generic listeners.
- Click and key bindings are the only UI entry points that toggle; disabled checkboxes do not respond to either.
- The `-on` CSS class is managed automatically; user code should not toggle it directly.

## Example requirements
All examples are JSX/TypeScript. Examples must demonstrate:
- A basic Checkbox and an initially-checked Checkbox.
- Subscribing to the `Changed` message and reading `event.value`.
- Querying a Checkbox by id, setting `value` programmatically (and noting that this posts `Changed`), and calling `toggle()`.
- Styling via `toggle--button` and `toggle--label` component classes in TCSS.
- Compact mode alongside normal mode.

## Cross-references
- `spec/docs-spec/widget_button.md` -- related activation-message pattern.
- `spec/docs-spec/api_on.md` -- handler subscription convention for `Changed`.
- `spec/spec-src/10-widget-catalog.md` -- catalog entry.
- `spec/spec-src/09-widget-base-contract.md` -- base contract and toggle-button shared behavior.

## Notes for writers
- Do not describe the `ToggleButton` base class or `Static` as Python inheritance; describe the shared toggle behavior as a composable behavior or mixin in textual-js terms. The public API is `Checkbox`.
- Replace `ContentText` with the textual-js renderable type (likely `React.ReactNode`).
- Replace `on_checkbox_changed` / `@on(Checkbox.Changed)` with the textual-js handler convention; state it once and use it consistently.
- `prevent(self.Changed)` is Python; describe the behavior ("initial value is set without emitting Changed") without referring to the Python construct.
- The indicator characters (`BUTTON_LEFT` `▐`, `BUTTON_INNER` `X`, `BUTTON_RIGHT` `▌`) are implementation details worth mentioning for styling context; do not present them as configurable API.
- Describe the focus styling as a block-cursor effect on the label; underlying implementation is Ink text styling, not a custom terminal escape.
