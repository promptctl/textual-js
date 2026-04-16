# Docs Spec: Pretty Widget

## Purpose
Describes the `Pretty` widget — a display component that pretty-prints an arbitrary JavaScript value (object, array, Map, Set, primitive, etc.) for inspection in the TUI. Teaches readers how to mount a pretty-printed value and update it dynamically.

## Audience
Application authors building debuggers, REPL-style inspectors, and tooling surfaces that need to show data structures at a glance. Not intended for production-facing UI.

## Required sections
1. Overview (display a value, typical use as a debug/inspection surface)
2. Characteristics (not focusable, not a container)
3. Props (`value` — the thing to print, standard widget props)
4. Methods (`update(value)` — replaces the displayed value, invalidates cached dimensions, refreshes layout)
5. Messages (none)
6. Bindings (none)
7. Component classes (none)
8. Default TCSS
9. Usage patterns

## Key concepts
- `Pretty` wraps a pretty-printer implementation appropriate for the JS ecosystem (e.g., a library-provided formatter that produces syntax-highlighted, indented output for objects, arrays, Maps, Sets, Dates, and primitives, falling back to `String(value)` for custom types)
- `Pretty` sizes to content vertically — it does not scroll on its own; wrap it in a scrolling container for large values
- Shrink-to-fit is disabled (values are allowed to take up horizontal room rather than being compressed)

## Behaviors and contracts
- `update(value)` atomically replaces the current value, clears cached dimensions, and triggers re-layout (a new value may produce a different size)
- Rendering is deterministic for a given value (same input → same output); mutating the value in place without calling `update` will not re-render (single source of truth is the last value passed in)
- The widget accepts any JS value; `null`/`undefined`/primitives render as themselves

## Example requirements
All JSX/TypeScript using Ink primitives and React function components wrapped with `observer()`. Cover:
- Minimal mount with a plain object literal
- Updating the displayed value from a parent component
- Displaying an array, a Map, a Set, and a mixed nested structure
- Wrapping in a scrollable container for large output

## Cross-references
- `spec/docs-spec/widget_log.md` — for streaming plain text rather than values
- `spec/spec-src/10-widget-catalog.md` — widget catalog entry
- `spec/spec-src/05-layout-render-and-compositor.md` — content sizing

## Notes for writers
- Python's `rich.pretty.Pretty` does not translate directly; describe the widget in terms of whatever the port uses (a library formatter or a small in-house pretty-printer) without naming `Rich`
- Do not describe Python's `repr()` — describe the fallback as "a readable string form of the value" when the pretty-printer has no specific handling
- Python's `Any` type becomes simply "any value" in prose
- The Python source exposes a private `_pretty_renderable` attribute — do not document private state; describe the widget as holding "the last value passed in"
- Python's `RenderResult` / `render()` override is an implementation detail; the doc should not describe it as part of the widget contract
- Clarify that `Pretty` is read-only — there is no user interaction, no editing, no focus
