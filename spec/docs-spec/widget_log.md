# Docs Spec: Log Widget

## Purpose
Describes the `Log` widget — a lightweight, high-performance, scrollable, append-only display of plain text lines used for console output, streaming logs, and real-time textual feeds. Teaches readers how to write, clear, bound memory, and stream data into a Log.

## Audience
Application authors who need a simple scrolling text surface (CLI log tail, streaming process output, live diagnostic feed). Not for authors needing rich markup, renderables, or syntax-highlighted content — those readers should be pointed at RichLog.

## Required sections
1. Overview (what Log is, when to use it vs. RichLog)
2. Characteristics (focusable, container, scroll behavior)
3. Props / constructor options (`highlight`, `maxLines`, `autoScroll`, standard widget props)
4. Reactive attributes (`maxLines`, `autoScroll`)
5. Instance attributes / read-only properties (`lines`, `lineCount`, `highlight`, `highlighter`)
6. Writing data (`write`, `writeLine`, `writeLines`) — including partial-line buffering semantics
7. Clearing data (`clear`)
8. Auto-scroll contract (when it applies, scrollbar-grab suppression, already-at-end requirement, per-call override via `scrollEnd`)
9. Line processing rules (tab expansion, control character replacement with replacement char)
10. Max lines pruning (top-prune when exceeded, cache re-keying)
11. Text selection support
12. Messages (none)
13. Bindings (none)
14. Component classes (none)
15. Default TCSS
16. Usage patterns

## Key concepts
- Append-only text surface built on the framework's scroll view abstraction
- Plain-string content only; no markup, no renderables
- Partial-line buffering: strings without trailing newline accumulate on the tail line
- Auto-scroll semantics: sticky-to-end only when already at end and user is not grabbing the scrollbar
- Memory bounding via `maxLines`
- Optional per-line highlighter hook (pluggable function that returns styled output)
- Text selection surface (selection styling delegated to the screen's selection class)

## Behaviors and contracts
- `write(data)` splits on newlines; trailing partial segments are buffered and extended by subsequent writes
- `writeLine(line)` and `writeLines(lines)` always terminate their lines; embedded newlines inside an entry produce multiple lines
- Returning `this` from write/clear methods supports method chaining
- `autoScroll` and `scrollEnd` parameter compose: explicit `scrollEnd` (true/false) overrides the reactive default; omitted uses reactive default
- When `maxLines` is set, exceeding the limit prunes from the top; the render cache must remain consistent (cache keys shift with the new line indices)
- Tabs are expanded to spaces before render; control characters in the U+0000–U+0014 range are replaced with the replacement character
- `clear` resets virtual size to zero and drops the partial-line buffer
- `lines` is a read-only view: mutating it does not update the display (this is a surface contract, not just a convention)

## Example requirements
All examples JSX/TypeScript using Ink primitives, wrapped with `observer()` where state is read. Cover:
- Minimal mount and `writeLine` from a parent effect / handler
- Streaming chunks via `write` (showing that partial lines buffer)
- Capping memory with `maxLines`
- Supplying a custom highlighter (function signature as exposed by the port)
- Chained `clear().writeLine(...)` reset pattern
- Binding a Log to an async source (e.g., an Ink-safe subprocess stream) without blocking render

## Cross-references
- `spec/docs-spec/widget_rich_log.md` (when present) — for rich/renderable content
- `spec/docs-spec/api_scroll_view.md` (when present) — underlying scroll behavior
- `spec/spec-src/10-widget-catalog.md` — widget catalog entry
- `spec/spec-src/05-layout-render-and-compositor.md` — render pipeline, strip/line rendering
- `spec/spec-src/02-dom-reactivity-and-query.md` — reactive attribute semantics

## Notes for writers
- Do not describe Python's `Rich` highlighter ecosystem; the port uses a pluggable function or pipeline (describe the JS interface only)
- Do not document `Self`-return as a Python idiom; present it as method chaining
- The source note about docs/source `auto_scroll` default disagreement is a Python-docs artifact — pick one canonical default for textual-js (`true`) and document it without mentioning the upstream conflict
- Python's `Iterable[str]` becomes `Iterable<string>` / `string[]`; do not leak Python type syntax
- Do not document `render_line` or internal strip machinery as user API — these are renderer seams, not public widget methods
- Highlighting in textual-js is not tied to Rich's `ReprHighlighter`; if no default highlighter ships, document `highlight` as a no-op flag whose hook the user supplies, rather than fabricating a replacement
