# Docs Spec: Static Widget

## Purpose
Describe the Static widget: a non-focusable, non-container display widget
that shows a fixed piece of content (string, markup, or an arbitrary React
node). It also serves as the base for higher-level display widgets such as
Label and Tab.

## Audience
Application authors adding simple labels, headers, or read-only blocks of
text; widget authors looking for a lightweight base for display-only widgets.

## Required sections
1. Overview (what Static is and is not)
2. Props / constructor parameters (`content`, `expand`, `shrink`, `markup`,
   standard widget props)
3. The content property (read/write; setting it replaces the display)
4. `update()` method, including the `layout` option
5. Markup control: when to parse strings as markup vs. treat them literally
6. Default TCSS (`height: auto`)
7. Relationship to other widgets (base for Label; contrast with Pretty and
   RichLog)
8. Examples

## Key concepts
- Content can be a string, a markup string, or a React node / renderable
- `markup: true` enables markup parsing on string content; `false` treats
  the string literally (including bracket characters)
- The widget auto-sizes its height to fit the content by default
- `expand` / `shrink` modify how content fits in an over/undersized container
- `update()` replaces content and, by default, triggers layout; callers can
  skip layout when content change is known not to affect size

## Behaviors and contracts
- Not focusable, not a container, posts no messages, defines no bindings
- Bindings are not inherited from the base widget
- Setting the `content` property is equivalent to calling `update()` with
  default layout behavior
- `update(content, { layout: false })` updates the visual without triggering
  a layout pass; it is the caller's responsibility to ensure sizing is
  unchanged
- The content pipeline is a single path: incoming value -> normalized
  renderable -> painted. Variability is in the input value, not in whether
  rendering runs.

## Example requirements
All examples JSX/TypeScript using Ink primitives:
- Plain text Static
- Static with markup enabled rendering styled text
- Static with markup disabled rendering literal bracket characters
- Updating Static content at runtime via a component ref or observable
- Using Static as a base for a custom display widget

## Cross-references
- spec/docs-spec/widget_rich_log.md (append-only rich content log)
- spec/docs-spec/api_content.md (content / markup pipeline)
- spec/spec-src/10-widget-catalog.md (catalog entry: Static, Label, Pretty)

## Notes for writers
- Do not describe Rich `Visual` / `Content` Python types. The JS version
  accepts strings (optionally with markup) or React nodes; describe
  normalization at that level.
- Do not reference `inherit_bindings=False`; simply state that Static has
  no bindings and does not inherit any.
- Do not import from `textual.widgets`; imports come from the textual-js
  package entry point.
- Label and Pretty should be referenced as related widgets, but this page
  should not document them - link out.
- The `expand` / `shrink` props are layout hints; keep the description
  brief and defer the layout semantics to the layout spec.
