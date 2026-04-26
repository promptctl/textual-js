# Docs Spec: Pointer (Mouse Cursor) Style Property

## Purpose
Describes the docs page that teaches readers how to control the shape of the mouse cursor when it hovers over a widget using the `pointer` TCSS property.

## Audience
Widget authors who want to give visual affordances for clickable, draggable, resizable, or otherwise interactive regions.

## Required sections
1. Overview (purpose and terminal support requirement)
2. Syntax and default
3. Full list of accepted pointer shape values
4. TCSS examples
5. Notes (automatic pointer assignment, scope of effect, terminal compatibility)

## Key concepts
- `pointer` requests a named cursor shape (e.g., `pointer`, `text`, `grab`, `crosshair`, resize variants, `zoom-in`, `zoom-out`, `not-allowed`, etc.).
- Default value is `default`.
- The pointer shape only changes while the mouse cursor is inside the widget's bounds.
- Many built-in widgets (buttons, scrollbars) set an appropriate pointer automatically.
- The feature depends on the Kitty pointer shapes terminal protocol; terminals without support ignore the property and keep the default cursor.

## Behaviors and contracts
- Setting an unsupported or unrecognized value should be treated as an invalid TCSS declaration (style engine error/warning, not a silent success).
- The cursor shape is a visual hint only — it does not affect event dispatch or hit testing.
- The complete accepted value set mirrors the CSS/Kitty cursor shape vocabulary and includes every entry from the source list (default, pointer, text, crosshair, help, wait, progress, move, grab, grabbing, cell, vertical-text, alias, copy, no-drop, not-allowed, 8 directional resize variants, ew-resize, ns-resize, nesw-resize, nwse-resize, zoom-in, zoom-out).

## Example requirements
- JSX/TypeScript example of a clickable custom widget with `pointer: pointer`.
- JSX/TypeScript example of a draggable region using `pointer: grab` / `grabbing` state.
- JSX/TypeScript example demonstrating a resize handle using an appropriate `*-resize` shape.
- TCSS snippets for each category (action, text, resize, zoom, status).

## Cross-references
- `spec/docs-spec/styles_scrollbar.md` — scrollbars automatically set pointer styles.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS value validation.
- `spec/spec-src/08-drivers-io-and-platform-behavior.md` — terminal capability detection and Kitty protocol support (or equivalent doc covering terminal capabilities).

## Notes for writers
- Clearly state the terminal-protocol dependency up front; users in unsupported terminals will see no change.
- Do not describe Python-only assignment. Use TCSS and the JS-side styles accessor.
- Applicability to textual-js: fully applicable. Ink forwards terminal control sequences, so the Kitty pointer shape protocol can be used from textual-js when the host terminal supports it.
- Do not describe Python `styles.pointer` attribute; avoid snake_case Python names.
