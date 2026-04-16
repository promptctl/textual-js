# Docs Spec: Label Widget

## Purpose
Document the `Label` widget — a simple, non-focusable, auto-sized display widget for static text or rich content with optional semantic color variants — so readers know when to use it instead of a raw `Static`/`Text` widget and how to apply variants.

## Audience
New users adding labels to forms, lists, and panels; theme authors styling variants.

## Required sections
1. Overview — what `Label` is, how it differs from `Static` (auto-width default), and when to use it.
2. Importing and mounting.
3. Props / options — `content`, `variant`, `expand`, `shrink`, `markup`, plus standard widget props.
4. Variants — the six available variants (`success`, `error`, `warning`, `primary`, `secondary`, `accent`), and the themed color tokens each applies.
5. Updating content — how to change the label text after mount (inherited from the text-display base).
6. Markup — whether markup is interpreted in string content (default) and how to disable it.
7. Expand / shrink — how these flags affect sizing in a flex container.
8. Styling — default TCSS (auto width, auto height, min-height 1) and how variants attach CSS classes.
9. Examples — basic label, variant label, updating content, rendering a rich/complex child.

## Key concepts
- Auto-sized by content (width: auto), which is the key difference from `Static`.
- Optional semantic variants attach a CSS class of the variant name and theme the colors.
- No `"default"` variant — absence of `variant` means no class added.
- Labels can contain either plain text, marked-up text, or a rich child node, depending on the content prop.

## Behaviors and contracts
- When `variant` is provided, the widget carries a CSS class matching the variant name (`success`, `error`, etc.).
- Variant-themed colors come from design tokens (`$text-success`, `$success-muted`, etc.).
- `markup: true` (default) parses textual-js markup in string content; `markup: false` renders literally.
- Updating the content prop re-renders the widget.
- The widget is not focusable and posts no messages.

## Example requirements
All examples are JSX/TypeScript using Ink primitives.
- Basic label: `<Label>Hello, world!</Label>` (or equivalent prop form).
- Variant labels demonstrating success / error / warning semantics.
- Label whose content is updated via observable state (MobX).
- Label rendering a rich child — show composition with another Ink-rendered element where supported.

## Cross-references
- Related docs specs: `spec/docs-spec/widget_link.md`, `spec/docs-spec/widget_static.md` (if present), `spec/docs-spec/widget_digits.md`.
- Related behavioral specs: `spec/spec-src/10-widget-catalog.md`, `spec/spec-src/04-styling-and-css-engine.md`, `spec/spec-src/09-widget-base-contract.md`.

## Notes for writers
- Do not describe `Label` as a Python subclass of `Static`. Describe it as a specialization of the text-display component family with auto-width defaults and variant support.
- `LabelVariant` is a TypeScript union of string literals, not a Python `Literal`.
- Do not describe `VisualType` or Rich renderables. Describe acceptable content as "a string, a markup string, or a renderable child node".
- If textual-js does not expose Textual markup syntax, document which markup (if any) is supported and reference the markup/styling spec — do not fabricate parity.
