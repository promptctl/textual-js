# Docs Spec: Dock, Offset, and Position Styles

## Purpose
Describes the docs page that teaches readers how to place widgets outside the normal layout flow using the `dock`, `offset`, `offset-x`, `offset-y`, and `position` style properties in textual-js TCSS.

## Audience
Widget authors and app developers who are composing screens and need to pin widgets to container edges, nudge widgets visually without affecting layout, or place widgets at absolute container coordinates.

## Required sections
1. Overview (what the three style concepts accomplish together)
2. `dock` property (syntax, values, defaults, behavior)
3. `offset` / `offset-x` / `offset-y` properties (syntax, scalar units, defaults)
4. `position` property (relative vs absolute, interaction with `align`)
5. Property summary table (property, accepted values, default)
6. Related styles (links to `align`, `layers`/`layer`)

## Key concepts
- Dock removes a widget from normal flow and pins it to an edge (`top`, `right`, `bottom`, `left`); it stays fixed when the container scrolls.
- Multiple docked widgets to the same edge stack in DOM/compose order.
- `top`/`bottom` docked widgets span full container width; `left`/`right` span full height.
- Offset is purely visual — it does not displace siblings.
- Offset scalars accept integer cells or percentages of the widget's own dimensions; negative values move left/up.
- Position toggles whether `offset` is relative to the widget's computed layout position or absolute from the container's top-left origin.
- Absolute positioning overrides the parent container's `align` rule.
- Offset can be animated.

## Behaviors and contracts
- Docked widgets reduce the available area for non-docked children of the same container.
- The `dock` property has no default (unset means not docked).
- The `offset` default is `0 0`; `position` default is `relative`.
- Unlike CSS `position: absolute`, textual-js `position: absolute` does NOT remove the widget from layout — its original space is still reserved.
- Layout refreshes when `dock` or `position` change; offset changes should be repaint-only (or via animation).

## Example requirements
- JSX/TypeScript example showing a `Header`/`Footer`-like widget docked with TCSS.
- JSX/TypeScript example using `offset` to visually nudge a widget.
- JSX/TypeScript example using `position: absolute` with `offset` to place a widget at specific container coordinates.
- TCSS snippets for each property variant, including the shorthand and axis-specific forms.
- A short example demonstrating `offset` animation via the textual-js animation API.

## Cross-references
- `spec/docs-spec/styles_layout.md` — broader layout properties including `align`.
- `spec/docs-spec/styles_layers.md` — z-ordering that interacts with docked/positioned widgets.
- `spec/spec-src/04-styling-and-css-engine.md` — style parsing and property contracts.
- `spec/spec-src/05-layout-render-and-compositor.md` — layout pass behavior for docking and offset.

## Notes for writers
- Do NOT show Python API (`widget.styles.dock = ...`); use TCSS strings and, where applicable, the MobX-backed styles accessor on widget instances.
- Remind readers that `offset-x` and `offset-y` can be set independently in TCSS. The "tuple-only" Python restriction does not apply.
- Emphasize the difference vs. browser CSS: textual-js `position: absolute` still reserves layout space — this is a common confusion point.
- Do not mention Python tuples, decorators, or Python-specific attribute names.
