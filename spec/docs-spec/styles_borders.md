# Docs Spec: Borders and Outlines

## Purpose
Describes the docs page that teaches users how to draw borders and outlines around widgets, including the set of border types, per-edge control, the difference between border and outline, and the border title / subtitle styling properties.

## Audience
Widget authors, app authors styling UI components, and theme authors building reusable widget chrome.

## Required sections
1. Overview — two mechanisms (`border`, `outline`) with a shared border-type vocabulary but different layout semantics.
2. Border type catalog — table of all named border types (`ascii`, `blank`, `dashed`, `double`, `heavy`, `hidden`, `hkey`, `inner`, `none`, `outer`, `panel`, `round`, `solid`, `tall`, `thick`, `vkey`, `wide`) with short descriptions.
3. How to preview border types in the running app (if textual-js exposes a preview command).
4. `border` style — syntax, shorthand with optional type / color / percentage, per-edge variants (`border-top`, `border-right`, `border-bottom`, `border-left`), interaction with `box-sizing`.
5. `outline` style — syntax, per-edge variants, how outline is drawn over content rather than consuming layout space.
6. Border vs Outline comparison table (layout impact, content occlusion, `box-sizing` awareness, same-edge conflict, opacity blend).
7. Border title — setting the title via the widget's `border_title` property, and the TCSS properties `border-title-align`, `border-title-color`, `border-title-background`, `border-title-style`.
8. Border subtitle — `border_subtitle` property and the mirrored TCSS properties `border-subtitle-align`, `border-subtitle-color`, `border-subtitle-background`, `border-subtitle-style`.
9. Property summary table — TCSS property, TS style key, value shape, default.
10. Related styles — `box-sizing`, `keyline`.

## Key concepts
- A widget can have either a border or an outline on any given edge — not both.
- Border consumes layout space; outline draws over content and does not shift layout.
- Both share the same set of border types and the same color syntax.
- Per-edge variants allow asymmetric borders; the shorthand sets all four edges at once.
- Border title and subtitle are strings embedded in the top and bottom edges; their content is set via widget properties, their styling via TCSS.

## Behaviors and contracts
- A border on an edge must reserve one cell of space along that edge; content is pushed inward accordingly.
- An outline must not reserve layout space — enabling it must not cause layout reflow.
- Setting both `border-top` and `outline-top` on the same widget must be a framework error (or the latter must clearly override with a warning — document the chosen behavior).
- The optional trailing percentage on `border` blends the border color with the widget's background color; `outline` has no percentage parameter.
- Border title `align` defaults to `left`; border subtitle `align` defaults to `right`.
- Border title color/background accept a color or the literal `auto` (pick based on contrast against the border color); default is `auto`.
- Title and subtitle styles accept text-style tokens (`bold`, `italic`, `underline`, etc.) with multiple tokens space-separated.
- Border types `hidden` and `none` are aliases that disable the border while still honoring box-sizing rules where relevant.
- `blank` reserves space without drawing — useful for aligning borders across widgets when some have borders and some do not.

## Example requirements
All examples JSX/TypeScript, using Ink primitives and textual-js widgets:
- A widget with `border: heavy white` and another with per-edge variants (`border-left: outer red`, etc.).
- A widget with a semi-transparent border via `border: round orange 50%`.
- A focused-state outline that does not shift surrounding layout (`outline: heavy $accent` applied only under `:focus`).
- A widget setting a `borderTitle` (TS property) and styling it with `border-title-align: center`, `border-title-color`, `border-title-style: bold underline`.
- The same pattern for `borderSubtitle` aligned `right` with a contrasting background.
- A comparison example: two otherwise-identical widgets, one with border and one with outline, illustrating the layout shift.

## Cross-references
- `spec/docs-spec/styles_box_model.md` — `box-sizing` and how border width participates in declared dimensions.
- `spec/docs-spec/styles_colors.md` — color formats and the `auto` keyword.
- `spec/docs-spec/styles_text.md` — text-style tokens used by border-title-style / border-subtitle-style.
- `spec/docs-spec/styles_keyline.md` — related chrome for grouping adjacent widgets.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS parser for border/outline tokens.
- `spec/spec-src/05-layout-render-and-compositor.md` — compositor draws borders, outlines, titles.

## Notes for writers
- Drop the `widget.styles.border = ("heavy", "white")` Python tuple form. In textual-js, either use the TCSS authoring surface (preferred) or the imperative style object with the TS-appropriate shape (e.g., `style.border = { type: "heavy", color: "white" }` or a tuple — match the actual API).
- `widget.border_title` (Python attribute) becomes a TS property on the widget, named per the library convention (likely `borderTitle`). Do not document snake_case.
- The `textual borders` CLI preview does not exist in textual-js unless the library ships a similar demo; remove or rewrite to reference the actual preview surface (e.g., a Storybook page or a `pnpm demo:borders` script) only if it exists.
- Border drawing is done by the textual-js compositor, not by Ink. Authors should not assume Yoga border widths map 1:1 — in TCSS a border is always one cell.
- `auto` for title/subtitle color must be explained as "framework picks white or black based on contrast with the current border color", not as a CSS cascade keyword.
