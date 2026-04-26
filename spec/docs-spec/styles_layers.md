# Docs Spec: Layers and Layer Style Properties

## Purpose
Describes the docs page that teaches readers how to control widget stacking order using the `layers` (container) and `layer` (descendant) TCSS properties.

## Audience
Widget authors and app developers who need deterministic paint order for overlapping widgets, modal-like overlays, decorations, or layered visualizations.

## Required sections
1. Overview (default paint order vs explicit layers)
2. `layers` property (syntax, paint order semantics, scoping)
3. `layer` property (syntax, ancestor requirement)
4. Relationship between `layers` and `layer`
5. Behavior (stacking, scope/inheritance, multiple ancestor declarations)
6. Complete worked example

## Key concepts
- Without layer styling, widgets paint in compose order: later widgets cover earlier ones.
- `layers` on a container declares an ordered list of named layer identifiers; leftmost is bottom, rightmost is top.
- `layer` on a descendant widget assigns that widget to one of those named layers.
- Layers are scoped: a `layers` declaration affects descendants of the container on which it is set.
- A `layer` value that does not match any ancestor's `layers` declaration is silently ignored.
- Within a single layer, widgets still paint in compose/DOM order.
- Widgets that do not set `layer` render on the default (lowest) layer.
- Nested `layers` declarations resolve against the nearest ancestor that defines a matching name.

## Behaviors and contracts
- `layers` is stored as an ordered list of name tokens.
- `layer` is stored as a single name token.
- Cross-layer ordering takes precedence over compose order.
- Layer assignment does NOT move the widget in layout flow — only paint order is affected.
- Layer identifiers are CSS `<name>` tokens (identifiers, no quotes).

## Example requirements
- JSX/TypeScript example with a `Screen` declaring `layers: below above;` in TCSS and two children assigned to different layers.
- A deliberate compose-order inversion where the first-yielded child ends up on top because of `layer: above`.
- TCSS snippet demonstrating three or more named layers.
- Example showing a nested container with its own `layers` scope.

## Cross-references
- `spec/docs-spec/styles_dock_offset.md` — docking and offsetting interact visually with layer stacking.
- `spec/docs-spec/styles_layout.md` — compose order baseline.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS parsing for layer/layers.
- `spec/spec-src/05-layout-render-and-compositor.md` — compositor paint ordering.

## Notes for writers
- Do not show Python tuple assignment (`widget.styles.layers = ("below", "above")`); use TCSS and, if relevant, the JS styles accessor.
- Emphasize the silent-ignore behavior: misspelled layer names become a debugging gotcha.
- Call out that `layer` only affects paint order — users sometimes expect it to move the widget in layout, which it does not.
- Terminal rendering is composited via Ink; textual-js still provides layer semantics on top of Ink's rendering. Do not describe Python rendering internals.
