# Docs Spec: Scrollbar Style Properties

## Purpose
Describes the docs page that teaches readers how to style scrollbars in textual-js, covering thumb/track/corner colors across rest/hover/active states plus `scrollbar-size`, `scrollbar-gutter`, and `scrollbar-visibility`.

## Audience
Widget authors and theme designers who want to control scrollbar appearance per widget or across a theme.

## Required sections
1. Overview (scrollbar anatomy: track, thumb, corner)
2. Color properties
   - Thumb colors (`scrollbar-color`, `scrollbar-color-hover`, `scrollbar-color-active`)
   - Track colors (`scrollbar-background`, `scrollbar-background-hover`, `scrollbar-background-active`)
   - Corner color (`scrollbar-corner-color`)
3. Color state transitions (rest / hover / active semantics)
4. `scrollbar-size` / `scrollbar-size-horizontal` / `scrollbar-size-vertical`
5. `scrollbar-gutter`
6. `scrollbar-visibility`
7. Property interactions

## Key concepts
- A scrollbar has a track (background), a thumb (the draggable handle), and when both axes are present, a corner square where they meet.
- Each color has three interaction states (rest, hover, active) for both thumb and track, independently.
- All color properties accept `<color>` with optional `<percentage>` opacity.
- Default thumb and track colors provide reasonable contrast against theme backgrounds and change across states to give visible feedback.
- `scrollbar-size` controls cross-axis thickness only; length always fills the container edge.
- `scrollbar-gutter: stable` reserves vertical scrollbar space to prevent layout reflow.
- `scrollbar-visibility: hidden` hides scrollbars while keeping scrolling (mousewheel, keyboard, gestures) functional.

## Behaviors and contracts
- Defaults (from theme) for thumb: rest = `ansi_bright_magenta`, hover = `ansi_yellow`, active = `ansi_bright_yellow`.
- Defaults for track: rest = `#555555`, hover = `#444444`, active = `black`.
- Default for corner: `#666666`.
- State transitions: rest -> hover when the pointer enters the scrollbar; hover -> active during click/drag of the thumb; back to rest on release/exit.
- Color properties trigger a repaint only; size, gutter, and visibility changes trigger a layout refresh.
- Color properties are only visible when the scrollbar is actually rendered (i.e., `scrollbar-visibility: visible` and size > 0).

## Example requirements
- JSX/TypeScript showing a scrollable container with customized thumb, track, and corner colors.
- TCSS snippets for each of the nine color properties, including at least one with opacity.
- JSX/TypeScript example demonstrating `scrollbar-size` customization.
- JSX/TypeScript example showing `scrollbar-gutter: stable` preventing layout shift as a list grows/shrinks.
- JSX/TypeScript example demonstrating `scrollbar-visibility: hidden` while scrolling still works via keyboard/mousewheel.
- A theming example showing scrollbar colors bound to theme variables (e.g., `$accent`).

## Cross-references
- `spec/docs-spec/styles_overflow.md` — overflow and scrollbar visibility (overlapping coverage; cross-link both ways).
- `spec/docs-spec/styles_pointer.md` — scrollbars automatically set pointer shapes when hovered.
- `spec/spec-src/04-styling-and-css-engine.md` — color parsing and theme variable resolution.
- `spec/spec-src/05-layout-render-and-compositor.md` — scrollbar rendering behavior and layout impact.

## Notes for writers
- Do not reference Python class names (`ScrollbarColorProperty`, `IntegerProperty`) or source file paths inside textual (`src/textual/css/styles.py`) — those are Python implementation details that do not apply to textual-js.
- Do not show Python snake_case attribute names. Use TCSS and the JS-side styles accessor where applicable.
- Call out the distinction vs `styles_overflow.md`: this page owns colors and the full behavior contract for the scrollbar; the overflow page focuses on content clipping and scroll enablement. Both pages describe `scrollbar-size`, `scrollbar-gutter`, and `scrollbar-visibility` — apply one-source-of-truth by making one page the canonical source and having the other link to it. Writers should pick a single canonical page for these three properties (suggested: `styles_overflow.md`) and summarize briefly in the other with a link.
- Clarify repaint-only vs layout-refresh invalidation; this affects animation choices and performance expectations.
