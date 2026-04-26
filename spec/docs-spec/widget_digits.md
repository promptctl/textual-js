# Docs Spec: Digits Widget

## Purpose
Document the `Digits` widget — a non-focusable display widget that renders a string of digits, hex letters, currency symbols, operators, and parentheses as tall (3-row x 3-column) glyphs — so readers can use it for clocks, counters, and large numeric displays in a terminal UI.

## Audience
New users building dashboards or clock-style displays, and widget authors who need to understand the widget's sizing contract before composing it inside custom layouts.

## Required sections
1. Overview — what `Digits` is and when to reach for it.
2. Supported characters — the complete set of characters rendered in large form, plus the behavior for unsupported characters.
3. Importing and mounting — how to import the widget and how to include it in a Ink-based screen.
4. Props / options — mirrors the construction options (`value`, `name`, `id`, `classes`, `disabled`).
5. Updating the value — how to change the displayed string after mount.
6. Sizing behavior — width is sum of 3 cells per supported character plus 1 per unsupported; height is always 3 lines.
7. Styling — default TCSS rules, the `text-align` property, and the automatic bold-variant glyph selection.
8. Special character handling — `.` replaced by middle dot; unsupported characters rendered at single-cell size on the bottom row.
9. Selection support — selecting the widget yields the raw value string.
10. Examples — static display, dynamic clock.

## Key concepts
- Fixed-height (3 lines) widget with content-derived width.
- Automatic bold variant glyph set chosen based on resolved text style.
- Text alignment via TCSS (`left`, `center`, `right`; other values fall back to `left`).
- Unsupported characters degrade gracefully (single-cell, bottom-aligned).
- The widget is purely a presentation component — no messages, no bindings, no reactive inputs besides the value.

## Behaviors and contracts
- The displayed `value` is always a string; passing a non-string must be rejected.
- Updating the value triggers a layout refresh only when the rendered width changes; equal-width updates only repaint.
- Height is unconditionally 3 rows regardless of content.
- The period (`.`) is always replaced with a middle dot (`•`) before rendering.
- Supported set: `0`–`9`, `A`–`F`, `+`, `-`, `^`, `x`, `:`, `$`, `£`, `€`, `(`, `)`.
- Selecting text over the widget returns the raw value (no replaced characters).

## Example requirements
All examples are JSX/TypeScript using Ink primitives and `TextualApp` composition.
- A static example showing `<Digits value="3.141,592,653,5897" id="pi" />` inside a screen.
- A dynamic example showing a clock that updates once per second via a timer/interval and calls the equivalent of `update()` — express this through a reactive state variable (MobX observable) bound to the `value` prop so the widget re-renders on every tick.
- A styling example showing `text-align: center` applied via TCSS.

## Cross-references
- Related docs specs: `spec/docs-spec/widget_label.md`, `spec/docs-spec/widget_loading_indicator.md` (other simple display widgets).
- Related behavioral specs: `spec/spec-src/10-widget-catalog.md`, `spec/spec-src/09-widget-base-contract.md`, `spec/spec-src/04-styling-and-css-engine.md`.

## Notes for writers
- Do not describe `value` mutation through a Python `update()` method. In textual-js, the value is a React prop driven by observable state; re-rendering flows through MobX, not a mutator call.
- Do not describe a Python `TypeError` for non-string values. Document the TypeScript type instead and mention runtime input must be coerced at the call site (trust boundary).
- Do not describe `get_content_width` as a user-facing API; instead describe the sizing as a behavior the reader can rely on.
- Avoid mentioning Rich — the bold-variant behavior must be framed as "triggered by the resolved TCSS `text-style`".
