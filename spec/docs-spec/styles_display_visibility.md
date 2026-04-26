# Docs Spec: Display, Visibility, and Opacity

## Purpose
Describes the docs page covering the four styles that control whether a widget participates in layout and how visible it appears: `display`, `visibility`, `opacity`, and `text-opacity`.

## Audience
Widget authors and app authors who need to conditionally hide widgets, dim content, or differentiate "gone from layout" from "invisible but still there".

## Required sections
1. Overview — all four styles at once, clearly stated differences.
2. `display` — syntax, values (`block`, `none`), TCSS and TS examples, the boolean shortcut on the widget (`widget.display = true/false`).
3. `visibility` — syntax, values (`visible`, `hidden`), inheritance rules, boolean shortcut (`widget.visible = true/false`).
4. Display vs visibility comparison table (layout space, child inheritance, effect).
5. `opacity` — syntax (`<number>` or `<percentage>`), terminal-transparency caveat, propagation to children.
6. `text-opacity` — syntax, non-propagation, what it actually blends toward (widget's own background).
7. Opacity vs text-opacity comparison table (what is affected, which background it blends toward).
8. Property summary table — TCSS property, TS style key, value type, default.

## Key concepts
- `display: none` removes the widget from layout entirely; no space reserved.
- `visibility: hidden` keeps the widget in layout but does not draw it.
- Visibility is inherited from parent; children can override back to `visible` to be drawn inside a hidden container.
- `opacity` fades the widget and all its children by blending with the parent's background color.
- `text-opacity` fades only the foreground text toward the widget's own background; borders and chrome are untouched.
- Terminals cannot do real alpha; textual-js approximates by color blending in the compositor.

## Behaviors and contracts
- Defaults: `display: block`, `visibility: visible`, `opacity: 1.0`, `text-opacity: 1.0`.
- `display: none` removes the widget from the layout tree (Ink/Yoga sees it as not present for sizing purposes) and from the focus chain.
- `visibility: hidden` leaves the widget in the layout tree but the compositor skips drawing it; the widget is excluded from the focus chain unless a descendant explicitly sets `visibility: visible`.
- Visibility inheritance is one-way: children default to parent's value, but children can override.
- `opacity` and `text-opacity` values are clamped to `[0, 1]` / `[0%, 100%]`.
- `opacity` refresh propagates (children=true): changing it triggers a redraw of the widget and its subtree.
- `text-opacity` does not propagate; only the widget itself is refreshed.
- Boolean shortcut on the widget (`widget.display = false`, `widget.visible = false`) is equivalent to the corresponding TCSS value.
- Invalid values must produce a TCSS parse error (declarative) or a typed error (imperative).

## Example requirements
All examples JSX/TypeScript using Ink primitives and textual-js widgets:
- A container with three siblings where the middle one toggles between `display: none` and `display: block`, showing layout reflow.
- The same scenario with `visibility` instead of `display`, showing space preserved.
- A hidden container with a nested widget that overrides to `visibility: visible`.
- Two widgets: one at `opacity: 50%` (whole widget fades, children fade too), one at `text-opacity: 50%` (only text fades, border stays sharp).
- The boolean-shortcut form: `widget.display = false` and `widget.visible = false` in a TS event handler.

## Cross-references
- `spec/docs-spec/styles_colors.md` — `opacity` / `text-opacity` alongside the other color-composition properties.
- `spec/docs-spec/styles_background_tint.md` — `tint` as the whole-widget analog of a persistent overlay.
- `spec/docs-spec/screens.md` — focus chain impact when visibility is hidden.
- `spec/docs-spec/api_widget.md` — `display` / `visible` boolean properties on the widget.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS parsing for these properties.
- `spec/spec-src/05-layout-render-and-compositor.md` — compositor behavior for visibility, opacity, text-opacity.

## Notes for writers
- Drop Python snake_case attribute examples (`widget.styles.display = "none"`). Use TCSS for the declarative form and the TS style object for imperative (`style.display = "none"`, `style.visibility = "hidden"`, `style.opacity = 0.5`, `style.textOpacity = 0.5`).
- The boolean shortcut (`widget.display = true/false`, `widget.visible = true/false`) is a widget-level convenience; describe it with the textual-js widget API conventions.
- Clarify that the compositor performs the blending — Ink does not render `opacity` natively.
- Cross-reference focus chain semantics (`visibility: hidden` removes a widget from the focus chain) to `screens.md` and the focus-chain spec.
- "Terminals cannot do true transparency" caveat is framework-critical — keep it verbatim in spirit.
- Avoid any reference to CSS3 rendering pipeline or web-style stacking contexts; textual-js does not have layers in that sense (it does have the `layers` style, but that is orthogonal to `display`/`visibility`).
