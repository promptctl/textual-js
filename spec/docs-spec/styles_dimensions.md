# Docs Spec: Dimension Styles (width, height, min/max)

## Purpose
Describes the docs page that teaches users how to size widgets using `width`, `height`, `min-width`, `max-width`, `min-height`, and `max-height`, including the full vocabulary of scalar units and the rules that resolve them.

## Audience
Widget authors and app authors performing layout, especially anyone combining fixed, proportional, and content-derived sizing.

## Required sections
1. Overview — the six dimension properties and what each controls.
2. Scalar values — table of every accepted unit (`N` cells, `Nfr`, `N%`, `Nw`, `Nh`, `Nvw`, `Nvh`, `auto`) with one-line descriptions.
3. Accepted value shapes in TypeScript — plain numbers, strings with units, framework scalar helper, `null`/`undefined` to clear.
4. `width` — syntax, default, what box it measures (content area by default; border-box shifts this), percent semantics.
5. `height` — symmetric with `width`.
6. `min-width` / `max-width` — semantics, behavior when computed width falls below min or above max.
7. `min-height` / `max-height` — symmetric.
8. Constraint resolution order — compute base size → clamp to min → clamp to max, with the min-wins-over-max tiebreaker.
9. Box-sizing interaction — what `width`/`height` measure under `content-box` vs. `border-box`.
10. Cross-axis unit behavior — `w` and `h` reference the *other* axis of the container (aspect-ratio-like sizing).
11. Fraction unit behavior — `fr` distributes remaining space proportionally among siblings in the same container.
12. Auto sizing — fit-to-content behavior; still subject to min/max constraints.

## Key concepts
- Every dimension property accepts the same scalar vocabulary.
- Cells are integers — floats are truncated to integers when the unit resolves to cells.
- `%` is relative to the container's same-axis dimension; `w` and `h` reference the opposite axis of the container.
- `vw` / `vh` are relative to the viewport (terminal minus docked widgets on the relevant edge).
- `fr` is relative to sibling `fr` values in the same container after fixed and percentage siblings are allocated.
- `auto` means "compute optimal content-fitting size", still clamped by min/max.
- Leaving a property unset defers to the layout engine's default, not to a particular numeric default.

## Behaviors and contracts
- Setting a numeric value (number, numeric string) is interpreted as cell units.
- Setting a unit-suffixed string (e.g., `"50%"`, `"1fr"`, `"25vw"`, `"auto"`) is parsed into a scalar.
- Setting invalid value types (complex numbers, big-decimal libs, arrays, objects, non-numeric strings, scientific notation strings) must raise a typed error.
- Setting `null` / `undefined` (or the TCSS equivalent of unsetting) clears the rule.
- `min-*` raises the computed value up to at least the minimum; `max-*` lowers it down to at most the maximum.
- When `min-X > max-X`, the minimum wins.
- `width`/`height` and their min/max counterparts respect `box-sizing`: they measure the same box.
- `fr` is only meaningful with siblings and a bounded container; an `fr` value in an unbounded context falls back to `auto`-like behavior (document the actual framework rule).
- Percentage and viewport units that reference a not-yet-resolved container dimension must fall back deterministically (document the actual behavior).

## Example requirements
All examples JSX/TypeScript using Ink primitives and textual-js widgets:
- A widget with `width: 10` and another with `width: 50%`, inside a known-size container.
- A row of three siblings using `width: 1fr`, `width: 2fr`, `width: 1fr` to illustrate proportional sharing.
- A widget using `width: 25vw` / `height: 25vh` tracking the viewport.
- A widget using `width: 25h` to make its width a fraction of the container's *height*.
- A widget with `width: auto` sizing to a `"hello"` label.
- A widget with `width: 20; min-width: 30; max-width: 40` illustrating the clamping order.
- A TS imperative example setting `style.width = 10`, `style.width = "50%"`, and `style.width = null`.

## Cross-references
- `spec/docs-spec/styles_box_model.md` — `box-sizing` interaction with width/height.
- `spec/docs-spec/styles_spacing.md` — padding/margin contribute to outer size under `content-box`.
- `spec/docs-spec/styles_alignment.md` — how alignment uses available space.
- `spec/docs-spec/styles_layout.md` — how layout modes (horizontal, vertical, grid) affect fr distribution.
- `spec/docs-spec/api_geometry.md` — scalar / size helpers in TS.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS parsing of scalar values.
- `spec/spec-src/05-layout-render-and-compositor.md` — constraint resolution and fr distribution.

## Notes for writers
- Drop the Python examples (`widget.styles.width = 10`, snake_case attributes). Use TCSS for declarative cases and the TS style object for imperative ones (`style.width`, `style.minWidth`, `style.maxWidth`, etc. — camelCase to match TS conventions).
- `StyleValueError` is a Python exception name; use the textual-js typed error name without importing Python.
- `Scalar` / `Unit.CELLS` / `Unit.WIDTH` are Python enum constructs; if textual-js exposes similar helpers in TS, document them using TS names — otherwise describe the value-type vocabulary in prose.
- Emphasize that `fr` is implemented by the textual-js layout pass over Ink/Yoga — Yoga's own flex-grow is *not* the same semantic; do not tell readers to use Yoga properties directly.
- Viewport units (`vw`/`vh`) subtract the space taken by docked widgets — cross-link to `styles_dock_offset.md` so readers understand what "viewport" means here.
- Emphasize numeric floats truncate to integers at cell resolution — avoid fractional cell surprises.
