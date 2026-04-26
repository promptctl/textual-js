# Docs Spec: Link Style Properties

## Purpose
Describes the docs page covering TCSS properties that style inline action links within widget content: `link-color`, `link-background`, `link-style` and their `-hover` variants, plus the automatic contrast-color option.

## Audience
Widget authors who render text markup with embedded action links and want to control how those links appear and behave on hover.

## Required sections
1. Scope (action links vs regular hyperlinks; inline, not widgets)
2. Property table (all six properties with type, default, and description)
3. Syntax for color properties
4. Syntax for style properties
5. TCSS examples
6. Auto link color option
7. Default hover behavior
8. Rendering model (how the properties combine into a resolved link style)
9. Notes and caveats

## Key concepts
- Six properties in three pairs (normal state / hover state): foreground color, background color, and text style.
- These properties target only textual-js action links (links embedded in markup that trigger an action on click). They do NOT affect external/internet hyperlinks rendered by the terminal itself.
- Inline links are not widgets: they cannot be focused, and their styling is resolved per-span at render time.
- `link-color` and `link-background` default to `transparent`, meaning links inherit the widget's text/background colors unless overridden.
- `link-style` accepts one or more text-style tokens (`bold`, `italic`, `underline`, `reverse`, `strike`).
- Color properties accept a `<color>` plus optional `<percentage>` opacity.
- An auto-contrast mechanism computes the foreground color from the link background when enabled, producing readable text regardless of theme.
- Link styles are inherited through the DOM so container-level settings apply to links in descendant widgets.

## Behaviors and contracts
- Defaults: `link-color: transparent`, `link-color-hover: white`, `link-background: transparent`, `link-background-hover: $accent`, `link-style: underline`, `link-style-hover: bold`.
- When auto link color is enabled for a state, the resolved foreground is computed from the link background (ignoring the explicit `link-color`).
- Out-of-the-box behavior gives action links an underlined appearance and a visible hover effect with no additional CSS needed.
- Final resolved span style composes: background composited over widget background, foreground (explicit or auto-contrast), and text-style flags.
- Hover state resolution is independent of normal state (both must be set if full control is desired).

## Example requirements
- JSX/TypeScript showing a widget that renders text markup with an action link and a `press` action handler on click.
- TCSS snippets for each property with at least one color-with-opacity example and one multi-flag `link-style` example.
- TCSS snippet demonstrating container-level link styling inherited by child widgets.
- Example demonstrating auto contrast color in action, where the foreground adapts to a user-picked link background.

## Cross-references
- `spec/docs-spec/actions_and_bindings.md` — the action system that links invoke.
- `spec/spec-src/03-message-event-and-dispatch.md` — event dispatch behavior for link clicks.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS color and style parsing.
- Content/markup docs (link rendering inside content spans).

## Notes for writers
- Distinguish clearly: action links are a textual-js markup feature; terminal hyperlinks (e.g., OSC 8) are a separate concept.
- Do not reference Python `Color` objects, `Widget.link_style` / `link_style_hover` Python properties, or Rich `Style`. Describe resolution in terms of the textual-js styling pipeline.
- Remind readers that links are inline text spans — they are not focusable and do not receive key events.
- Do not describe underscored Python attribute names; use TCSS and the JS-side styles accessor if applicable.
