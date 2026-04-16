# Docs Spec: Overflow and Scroll Control Styles

## Purpose
Describes the docs page that teaches readers how to control content overflow and scrollbar behavior using `overflow`, `overflow-x`, `overflow-y`, `scrollbar-gutter`, `scrollbar-size` (+ axis variants), and `scrollbar-visibility`.

## Audience
Widget authors building scrollable containers, dashboards, lists, and overflow-aware layouts.

## Required sections
1. Overview (what each property controls and how they relate)
2. `overflow` / `overflow-x` / `overflow-y` (syntax, values, defaults)
3. `scrollbar-gutter` (syntax, values, purpose)
4. `scrollbar-size` / `scrollbar-size-horizontal` / `scrollbar-size-vertical` (syntax, defaults)
5. `scrollbar-visibility` (syntax, values)
6. Property interactions (when to use which, common combinations)

## Key concepts
- `overflow` values: `auto` (default; scrollbar when needed), `hidden` (clip, no scrolling), `scroll` (always show scrollbar).
- `overflow` shorthand takes two values: horizontal then vertical.
- Some built-in containers (e.g., `Horizontal`, `VerticalScroll`) override axis-specific overflow defaults.
- `scrollbar-gutter: stable` reserves space for the vertical scrollbar so layout does not shift when the scrollbar appears or disappears.
- `scrollbar-size` controls the cross-axis thickness of scrollbars (length is always 100% of the container edge).
- Default scrollbar sizes: horizontal = 1 cell tall, vertical = 2 cells wide.
- `scrollbar-size: 0` hides a scrollbar visually on that axis while keeping scrolling functional.
- `scrollbar-visibility: hidden` hides scrollbars but does not prevent scrolling (mousewheel, keyboard, gestures still work).

## Behaviors and contracts
- `overflow: hidden` disables scrolling entirely AND hides the scrollbar; `scrollbar-visibility: hidden` only hides the scrollbar.
- `overflow: scroll` forces the scrollbar to be visible regardless of content size.
- `scrollbar-gutter: stable` has no visible effect when scrollbars are hidden via `scrollbar-visibility: hidden` or `scrollbar-size: 0`.
- All overflow and scrollbar properties trigger a layout refresh on change (except pure color properties, covered in the scrollbar styles doc, which are repaint-only).

## Example requirements
- JSX/TypeScript example of a scrollable list with `overflow-y: auto`.
- JSX/TypeScript example locking layout with `scrollbar-gutter: stable` so content does not reflow when the scrollbar toggles.
- TCSS snippets for each property and the shorthand forms.
- Example showing `scrollbar-size: 0` to hide the scrollbar while retaining mousewheel/keyboard scrolling.
- Example contrasting `overflow: hidden` vs `scrollbar-visibility: hidden` behavior.

## Cross-references
- `spec/docs-spec/styles_scrollbar.md` — scrollbar color/appearance properties.
- `spec/docs-spec/styles_layout.md` — layout context in which overflow applies.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS property parsing.
- `spec/spec-src/05-layout-render-and-compositor.md` — overflow clipping and scrollbar rendering in the compositor.

## Notes for writers
- Do not describe Python-only restrictions (e.g., "cannot set both axes simultaneously in Python"). In TCSS the shorthand works normally; in the JS API, show whatever the textual-js styles accessor supports.
- Emphasize the interaction table: users routinely confuse `overflow: hidden`, `scrollbar-visibility: hidden`, and `scrollbar-size: 0` since all three can make a scrollbar invisible but only one disables scrolling.
- Do not reference Python attribute names (`scrollbar_gutter`, `scrollbar_size_horizontal`, etc.).
- Terminal scrolling in textual-js is still driven by Ink rendering plus textual-js's scrollable regions — do not describe Python scroll containers or asyncio.
