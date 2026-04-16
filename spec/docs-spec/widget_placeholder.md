# Docs Spec: Placeholder Widget

## Purpose
Describes the `Placeholder` widget — a visually distinct, auto-colored stand-in component used during layout prototyping. Teaches readers how to fill regions of a layout, cycle through its three display variants, and use it to iterate on structure before authoring real widgets.

## Audience
Application authors sketching screen layouts, widget authors prototyping compose trees, and newcomers exploring the framework's layout model without committing to final content.

## Required sections
1. Overview (prototyping stand-in, three variants, auto-assigned background color)
2. Characteristics (not focusable, not a container)
3. Props (`label`, `variant`, standard widget props)
4. Variants (`default`, `size`, `text`) and what each displays
5. Reactive attributes (`variant`) with validation
6. Methods (`cycleVariant`)
7. Automatic CSS classes (`-default`, `-size`, `-text`)
8. Automatic background coloring (palette cycle, per-app counter)
9. Click behavior (click to cycle)
10. Resize behavior (`size` variant updates with dimensions)
11. Default TCSS
12. Usage notes / gotchas

## Key concepts
- Three display variants give the placeholder different useful roles during prototyping: label, measurement, and overflow filler
- Label resolution order for the `default` variant: explicit `label` prop, then `#<id>` if an ID is set, then the literal string `"Placeholder"`
- The background color is assigned at mount from a 12-color cyclic palette at 50% opacity — consecutive placeholders inside one app get consecutive colors (a per-app counter seeds this)
- Clicking the placeholder cycles variants — the widget has no other interactive behavior
- Variant changes swap which CSS class (`-default`, `-size`, `-text`) is applied, so TCSS rules can target variants

## Behaviors and contracts
- Setting `variant` to an invalid value is an error (`InvalidPlaceholderVariant` or port-equivalent); the variant reactive validates on change
- `cycleVariant()` advances `default → size → text → default → ...` starting from whatever variant is currently set
- The widget's label is fixed at construction time and cannot be changed after mount — only the variant is reactive
- The `size` variant's rendered text updates whenever the widget's dimensions change; if `size` is the active variant, this triggers an immediate re-render
- The color counter is per-app instance: different apps or a restarted app start the counter again from the first palette entry
- Returning the widget instance from `cycleVariant` supports chaining

## Example requirements
All JSX/TypeScript using Ink primitives and React function components wrapped with `observer()`. Cover:
- Filling a layout with multiple placeholders to prototype structure
- Using the `size` variant to check rendered dimensions live
- Using the `text` variant to check overflow/scroll behavior
- Programmatic `cycleVariant` via a parent control or key binding
- Setting an explicit `label` vs. relying on the `#<id>` fallback

## Cross-references
- `spec/spec-src/05-layout-render-and-compositor.md` — layout engine (placeholder is a layout-testing aid)
- `spec/spec-src/10-widget-catalog.md` — widget catalog entry
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS and class-based variant styling

## Notes for writers
- Do not describe Python's `WeakKeyDictionary` — describe the color counter as "per-app" state without leaking the implementation mechanism; how the port scopes the counter (closure, React context, module-level Map keyed by app instance) is the port's concern, not the doc reader's
- `PlaceholderVariant` in Python is `Literal["default", "size", "text"]`; in TypeScript it is the equivalent string-literal union — document the three valid values, not Python's `Literal`
- Do not document a `disabled` visual style as a first-class feature; mention only that `disabled` is accepted as a standard widget prop and produces a 0.7-opacity look
- The Lorem Ipsum content for the `text` variant is built-in; writers should not promise it is configurable unless the port exposes a configuration
- Do not introduce `Self`-return syntax; simply say methods return the widget for chaining
