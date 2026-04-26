# Docs Spec: Rule Widget

## Purpose
Describe the Rule widget, a non-focusable visual separator analogous to an
HTML `<hr>`, drawn in either horizontal or vertical orientation using a
configurable line style and the current foreground color.

## Audience
Application and widget authors placing dividers in forms, lists, dashboards,
or any layout that needs a clean visual break between regions.

## Required sections
1. Overview and intended use
2. Props / constructor parameters (`orientation`, `lineStyle`, standard
   widget props)
3. Orientation values and what each means for sizing
4. Line style values and the character each resolves to (table: horizontal
   character vs. vertical character)
5. Convenience factories for horizontal and vertical rules
6. Observable attributes (orientation and lineStyle are reactive; automatic
   `-horizontal` / `-vertical` class toggling)
7. Default TCSS (color, sizing, margin for each orientation)
8. Sizing contract (horizontal rule: full available width, 1 cell tall;
   vertical rule: 1 cell wide, full available height)
9. Validation behavior (invalid orientation or line style)
10. Examples

## Key concepts
- Two orientations: `horizontal` and `vertical`
- A fixed enumeration of line styles: `ascii`, `blank`, `dashed`, `double`,
  `heavy`, `hidden`, `none`, `solid`, `thick`
- Per-orientation character table: each style maps to exactly one character
  for horizontal and one for vertical
- The rule draws across the entire available axis; the cross-axis dimension
  is always 1
- Color is driven by the `color` CSS property (default `$secondary`)
- Automatic CSS classes (`-horizontal`, `-vertical`) let stylesheets target
  the variant
- `blank`, `hidden`, and `none` all render as a space; they are named
  separately for stylistic intent but produce the same character

## Behaviors and contracts
- Not focusable, not a container, posts no messages, defines no bindings
- Default orientation is horizontal, default line style is solid
- Changing `orientation` at runtime swaps the automatic class atomically
- Changing `lineStyle` at runtime re-renders the line character
- An invalid orientation or line style value is a validation error; the
  widget surfaces it via its reactive validator rather than silently falling
  back to a default
- Sizing is fixed per orientation (single code path driven by data, not a
  conditional skip): horizontal is `height: 1; width: 1fr`, vertical is
  `width: 1; height: 1fr`
- `blank`, `hidden`, and `none` are documented as functionally equivalent

## Example requirements
All examples JSX/TypeScript using Ink primitives:
- Minimal horizontal rule in a vertical layout
- Vertical rule separating two side-by-side columns
- Rule with a non-default line style (e.g., `double` or `heavy`)
- Recoloring a rule via CSS (`color` property)
- Dynamically swapping orientation in response to layout state

## Cross-references
- spec/docs-spec/styles_dock_offset.md (layout context for where rules sit)
- spec/spec-src/04-styling-and-css-engine.md (color tokens like `$secondary`)
- spec/spec-src/10-widget-catalog.md (catalog entry)

## Notes for writers
- Do not reference Python `Literal` type aliases or Rich renderable classes
  (`HorizontalRuleRenderable` / `VerticalRuleRenderable`). In textual-js, the
  rendering is an internal Ink component; the writer only needs to describe
  the output characters.
- Do not reference Python exception classes (`InvalidRuleOrientation`,
  `InvalidLineStyle`); describe validation as a failure surfaced through the
  reactive validator, phrased in framework-neutral terms.
- The character tables are still accurate and should be preserved verbatim
  since they are behavioral contract, not implementation detail.
- `expand: true` is a Python widget attribute; in textual-js the equivalent
  is simply that the rule fills its available axis via `1fr`. Don't name
  `expand` as a prop unless the JS API actually exposes it.
