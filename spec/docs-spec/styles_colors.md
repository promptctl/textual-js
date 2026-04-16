# Docs Spec: Colors and Opacity Styles

## Purpose
Describes the docs page covering the color-related TCSS properties (`color`, `background`, `background-tint`, `tint`, `opacity`, `text-opacity`), their interactions, accepted color formats, and the rendering order the compositor uses.

## Audience
Widget authors, theme authors, and anyone styling text color, backgrounds, emphasis, or faded/disabled states.

## Required sections
1. Properties at a glance — summary table (property, type, default, what it affects).
2. `color` — syntax, `auto` keyword for contrast-based selection, optional alpha percentage.
3. `background` — syntax, default (transparent), alpha behavior.
4. `background-tint` — syntax, semantics (blended with existing background), typical alpha.
5. `tint` — syntax, semantics (blended with entire widget output), alpha requirement.
6. `opacity` — syntax (`<number>` or `<percentage>`), clamping, propagation to children.
7. `text-opacity` — syntax, clamping, non-propagation.
8. Color value formats — named colors, hex, rgb/rgba, hsl/hsla, textual-js ANSI names; table with examples.
9. Interaction between properties — rendering order from background to final composite.
10. Key distinctions — `opacity` vs. `text-opacity`, `background-tint` vs. `tint`, `color: auto` semantics, propagation rules.

## Key concepts
- `color` is the foreground (text) color; `auto` picks white or black for contrast against the resolved background.
- `background` sets the widget's base background color; transparent by default so parent shows through.
- `background-tint` blends a color with the existing background; a full-alpha tint replaces, a 0-alpha tint is a no-op.
- `tint` blends a color over the entire widget (text, borders, background) — useful for state overlays like errors.
- `opacity` fades the whole widget (and children) toward the parent's background color.
- `text-opacity` fades only the text color toward the widget's own background; does not affect chrome.
- Terminals don't support real transparency — these are composition approximations.
- A trailing `<percentage>` on a color value multiplies the color's alpha channel.

## Behaviors and contracts
- Default values: `color` = white, `background` = transparent, `background-tint` = transparent, `tint` = transparent, `opacity` = 1.0, `text-opacity` = 1.0.
- `opacity` propagates to descendants (children=true): updating it triggers a refresh of the widget and its subtree.
- `text-opacity` does not propagate to descendants; updating it refreshes only the widget itself.
- Values for `opacity` and `text-opacity` are clamped to `[0, 1]` (`0%` through `100%`).
- Rendering order at composition time:
  1. `background` — base fill.
  2. `background-tint` — blended over background.
  3. Content rendered on top.
  4. `text-opacity` — blends foreground toward the tinted background (affects text only).
  5. `tint` — applied over the entire rendered widget.
  6. `opacity` — final widget composited against the parent's background.
- `color: auto` resolves at render time against the *resolved* background (after `background-tint`), not the declared `background`.
- Invalid color strings must produce a TCSS parse error; runtime color-object assignments must raise a typed error.

## Example requirements
All examples JSX/TypeScript using Ink primitives and textual-js widgets:
- A widget with `color: auto` over a dynamic themed background, demonstrating contrast selection.
- A widget with `background: hsl(290, 70%, 80%)` and another with `background: red 20%`.
- Two sibling widgets, one with `opacity: 0.5` (children fade with it) and one with `text-opacity: 0.5` (only the text fades, border stays sharp) — side-by-side comparison.
- A widget demonstrating `background-tint` for focus emphasis (`:focus { background-tint: $accent 20%; }`).
- A widget demonstrating `tint: red 20%` for an error overlay.
- A TCSS authoring example alongside an imperative style-object example.

## Cross-references
- `spec/docs-spec/styles_background_tint.md` — deeper coverage of `background`, `background-tint`, `tint`, `hatch`.
- `spec/docs-spec/styles_display_visibility.md` — `opacity` / `text-opacity` cross-reference.
- `spec/docs-spec/styles_borders.md` — `auto` color for border-title-color / background.
- `spec/docs-spec/api_color.md` — color parsing / Color helper API surface in TS.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS color parsing.
- `spec/spec-src/05-layout-render-and-compositor.md` — composition order.

## Notes for writers
- Drop the `from textual.color import Color` / `Color.parse("pink")` / `widget.styles.color = Color(...)` Python examples. Use TCSS strings and, where imperative is needed, the TS color helper exposed by textual-js (likely a `Color` class in TS or a string-based API — match the actual `api_color.md`).
- The "Textual ANSI colors" (`ansi_red`, `ansi_bright_magenta`) are still valid in textual-js if the library exposes them; confirm and keep, otherwise remove.
- Emphasize that these composition stages are implemented by the textual-js compositor on top of Ink's output — Ink does not compute `opacity` or `tint` by itself.
- Do not confuse `opacity` (widget + subtree) with `visibility: hidden` (layout-preserving invisibility) — cross-link.
- Do not present `opacity` as CSS3 alpha compositing; it is an explicit blend against the parent's computed background color, not a GPU alpha channel.
