# Docs Spec: Layout-Related Style Properties

## Purpose
Describes the docs page covering TCSS properties that control widget layout participation, visibility, arrangement, docking, and alignment: `display`, `visibility`, `layout`, `dock`, `position`, `offset`, `align`, `content-align`.

## Audience
Widget authors and app developers composing screens; anyone needing to understand the baseline layout vocabulary of textual-js.

## Required sections
1. `display` (syntax, values, behavior, contrast with `visibility`)
2. `visibility` (syntax, values, inheritance, child override)
3. `layout` (syntax, values, behavior, built-in container widgets)
4. `dock` (syntax, values, behavior)
5. `position` (syntax, values, interaction with `align`)
6. `offset` / `offset-x` / `offset-y` (syntax, scalar units, behavior)
7. `align` (container-level child alignment, horizontal/vertical axes)
8. `content-align` (widget self-content alignment, distinction from `align` and `text-align`)
9. Summary of distinctions (a comparison table)

## Key concepts
- `display: none` removes the widget from layout entirely; `display: block` (default) keeps it participating.
- `visibility: hidden` hides the widget while preserving its layout space; children inherit visibility but can override it.
- `layout` on a container switches the arrangement algorithm: `vertical` (default), `horizontal`, or `grid` (requires grid-* companions).
- Built-in `Horizontal` and `Vertical` containers set their `layout` automatically.
- `dock` fixes a widget to an edge; docked widgets leave normal flow but still reduce available area for siblings.
- `position: relative` (default) places offset relative to computed position; `position: absolute` places offset relative to container's top-left origin and overrides the parent's `align` for that child.
- `offset` is purely visual — siblings are not displaced.
- `align` on a container positions its children within available space; only affects children smaller than the container on the relevant axis.
- `content-align` aligns a widget's rendered content inside the widget's own bounding box; distinct from `align` and from inline `text-align`.

## Behaviors and contracts
- Unlike browser CSS, textual-js `position: absolute` still reserves layout space for the widget; it does not remove the widget from flow.
- Absolute-positioned children ignore their parent's `align` rule.
- Offset scalars may be integer cells or percentages of the widget's own dimensions; negatives allowed.
- Defaults: `display: block`, `visibility: visible`, `layout: vertical`, `position: relative`, `offset: 0 0`, `align: left top`, `content-align: left top`.
- Horizontal layout flows left-to-right and wraps to additional rows if overflow permits.
- Visibility inheritance respects explicit child overrides (`visibility: visible` inside a hidden parent makes the child visible).

## Example requirements
- JSX/TypeScript showing `display: none` vs `visibility: hidden` side-by-side to demonstrate space reservation.
- JSX/TypeScript showing a `layout: horizontal` container with aligned children.
- JSX/TypeScript using `dock: top` for a header bar.
- JSX/TypeScript using `position: absolute` with `offset` to place a floating overlay within a container.
- JSX/TypeScript using `align: center middle` on a container vs `content-align: center middle` on a single widget to demonstrate the distinction.
- A comparison table summary (documented from the source) showing which property applies where.

## Cross-references
- `spec/docs-spec/styles_dock_offset.md` — focused page on dock/offset/position.
- `spec/docs-spec/styles_grid.md` — grid-specific companions for `layout: grid`.
- `spec/docs-spec/styles_layers.md` — painting order for overlapping widgets.
- `spec/docs-spec/styles_overflow.md` — overflow interactions inside layouts.
- `spec/spec-src/05-layout-render-and-compositor.md` — layout engine behavior.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS parsing of these properties.

## Notes for writers
- Do not show Python snake_case attributes (`styles.content_align`, `styles.align_horizontal`); use TCSS syntax and the JS-side styles accessor where appropriate.
- Clarify the three alignment properties and how they differ: `align` (container positioning children), `content-align` (widget aligning its own content), and `text-align` (inline text alignment, covered in the text styles doc).
- Reinforce the non-browser-CSS semantics of `position: absolute` — it does not remove from flow.
- textual-js layout is powered by Ink (Yoga flexbox) plus additional layout modes; do not describe Python layout implementation internals.
- Do not describe Python-only tuple-assignment restrictions for `offset`; in TCSS the shorthand and axis-specific properties both work.
