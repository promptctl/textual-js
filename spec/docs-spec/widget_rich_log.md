# Docs Spec: RichLog Widget

## Purpose
Describe the RichLog widget: a focusable, scrollable log view that accepts
text and rich content (markup, tables, syntax-highlighted code, pretty-printed
objects) and appends it in real time, with optional line-limit trimming and
auto-scroll-to-end behavior.

## Audience
Application authors who need a live, append-only log panel: debugging output,
event streams, chat/command transcripts, worker progress, or any UI that
emits styled lines over time.

## Required sections
1. Overview (what RichLog is; contrast with a simpler plain Log widget)
2. When to use RichLog vs. other log/display widgets
3. Props / constructor parameters
4. Observable (reactive) state exposed by the widget
5. `write()` API (content types, width resolution, scroll-end behavior)
6. `clear()` API
7. Line trimming via `maxLines`
8. Deferred writes before the widget has a measured size
9. Auto-scroll semantics
10. Styling: default TCSS, focus variant, how to theme
11. Messages and bindings (this widget posts none; scrolling is inherited)
12. Performance notes (internal line cache, invalidation triggers)
13. Examples

## Key concepts
- Append-only, virtualized log of rendered lines
- Content can be plain strings, markup strings, React/Ink elements, or
  arbitrary JS values (non-renderable values should be auto-stringified or
  pretty-printed by the widget)
- Width resolution pipeline: natural width -> expand -> shrink -> minWidth
  floor (the data decides, never the control flow)
- `maxLines` as a trim policy; oldest lines are discarded first
- Auto-scroll as a prop; per-write override via a `scrollEnd` option
- Deferred writes buffered until the first measured size event, then replayed
  in order
- Line cache keyed by line index + scroll offset + width; invalidated on
  style changes and on clear

## Behaviors and contracts
- `write()` always appends; it never inserts in the middle
- `write()` before the widget knows its size queues the content; queue is
  replayed in order on first size
- `clear()` resets stored lines, the pending queue, and any cached layout
- When `maxLines` is set and exceeded, the oldest lines are removed until the
  count equals `maxLines` (single consistent rule, no conditional skip)
- Auto-scroll: when `autoScroll` is true (default), a successful `write()`
  scrolls the view to the end; an explicit `scrollEnd` option overrides that
  default per call
- Focusable; inherits scroll key bindings from the underlying scrollable
  container
- Posts no messages of its own
- Method chaining supported: `write()` and `clear()` return the widget

## Example requirements
All examples are JSX/TypeScript using Ink primitives and the textual-js
TextualApp shell:
- Minimal example mounting a RichLog and writing a string on mount
- Writing markup content (when the content parser is enabled)
- Writing a structured renderable (e.g., a table-like component or a
  syntax-highlighted code block via Shiki)
- Writing an arbitrary JS object and letting the widget pretty-print it
- Capping log length with `maxLines`
- Disabling auto-scroll and scrolling manually
- Forwarding key events into a RichLog from an app-level handler

## Cross-references
- spec/docs-spec/widget_static.md (simpler display widget)
- spec/docs-spec/api_highlight.md (highlighter customization hooks)
- spec/docs-spec/api_content.md (content/markup parsing)
- spec/spec-src/05-layout-render-and-compositor.md (measurement and
  deferred-render pipeline)
- spec/spec-src/10-widget-catalog.md (catalog entry)

## Notes for writers
- Do not describe a Python `Highlighter` / `ReprHighlighter` class hierarchy.
  In textual-js, highlighting and markup are handled by the content pipeline
  (marked + Shiki) and by user-supplied transforms; describe the extension
  point the widget actually exposes, not Python internals.
- Do not describe `Pretty()`/`Text.from_markup`. Instead describe how the
  widget normalizes inputs (string vs. element vs. arbitrary value).
- Do not describe `expand_tabs()` or Rich `Strip` objects.
- Width resolution is a single deterministic pipeline; avoid framing it as
  "if width is set, else if expand, else if shrink" - present it as one
  ordered computation where the inputs decide the result.
- Deferred-write replay is a single, unconditional code path once size is
  known - do not describe it as an "if the queue is not empty" branch.
- Do not claim a specific LRU size; reference the cache as an implementation
  detail the reader should not depend on.
