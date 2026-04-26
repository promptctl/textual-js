# Docs Spec: Markdown Widget

## Purpose
Describes the `Markdown` widget — a block-rendering Markdown surface that parses a Markdown source into a tree of child block components (headings, paragraphs, lists, tables, fences, etc.), supports incremental streaming, and emits link and table-of-contents events. Teaches readers how to display, update, stream, and customize Markdown content.

## Audience
Application authors embedding Markdown content inside screens or widgets, and framework extenders who need to customize block rendering, add support for new token types, or integrate syntax highlighting.

## Required sections
1. Overview (block-based rendering, streaming support, relationship to `MarkdownViewer`)
2. Characteristics (not focusable by default, not a container, vertical layout, default padding)
3. Props (initial markdown, `parserFactory`, `openLinks`, standard widget props)
4. Properties (`source`, `tableOfContents`)
5. Messages (`TableOfContentsUpdated`, `TableOfContentsSelected`, `LinkClicked`) with payload shapes
6. Methods (`update`, `append`, `load`, `gotoAnchor`, `getStream`) — including awaitable-completion semantics
7. Block mapping (`BLOCKS` equivalent) — how token names map to block components
8. Bullet glyph cycling for nested unordered lists
9. Component classes (`code_inline`, `em`, `strong`, `s`) on block base
10. Block hierarchy overview (headers, fence, table family, blockquote, lists)
11. Header theming tokens (`$markdown-h{1-6}-color` etc.)
12. `MarkdownStream` — streaming content with batched appends
13. `MarkdownTableOfContents` sub-widget structure
14. CSS design tokens and default styling
15. Customization patterns (custom parser, custom block component, handling unrecognized tokens, intercepting links)

## Key concepts
- Each block element is its own child component — the Markdown widget is effectively a compiler from Markdown tokens into a flat list of block components
- Block map is data-driven: one map from token-name to component controls rendering — single source of truth for "how is X rendered"
- Streaming is a coalescing pattern: multiple `write` calls between event-loop turns fold into one `append` so render cost stays bounded
- `append` does a best-effort in-place extension of the last block when applicable (e.g., extending a paragraph) rather than always adding a new block
- Table of contents is derived data: computed lazily from headings, cached until invalidated, invalidated on `update`/`append` with heading changes
- Heading block IDs are deterministic so anchor navigation can resolve them
- Links have two modes: automatic (`openLinks: true` opens via the app's URL opener) or manual (`openLinks: false` emits `LinkClicked` only, caller handles it)

## Behaviors and contracts
- `update(markdown)` atomically replaces the document: removes existing blocks and mounts new ones; the returned awaitable completes when all children are mounted
- `append(fragment)` parses only lines past the last-parsed position and mounts resulting new blocks; emits `TableOfContentsUpdated` only if heading set changed
- `load(path)` reads source asynchronously, then calls `update`; supports `path#anchor` form by scrolling to the anchor after load
- `gotoAnchor(slug)` returns a success boolean; slugs use GitHub-style slugging
- `getStream(markdown)` returns a stream instance that batches writes; writing to a stopped stream is an error; empty writes are ignored; rapid writes coalesce into a single `append`
- `LinkClicked` is emitted on every link activation regardless of `openLinks`; the automatic opener fires on top of the event when `openLinks` is true
- `TableOfContentsUpdated` payload carries the new TOC data (a flat list of `{level, label, blockId}` triples)
- `TableOfContentsSelected` carries the block ID and is emitted by the TOC sub-widget when a heading is selected
- Unknown tokens fall through to an extensibility hook that returns either a block component or nothing (skip)
- Fenced code blocks are rendered with syntax highlighting via Shiki (JS equivalent of the upstream Rich-based highlighter) and are horizontally scrollable

## Example requirements
All JSX/TypeScript, using Ink primitives and React function components wrapped with `observer()`. Cover:
- Minimal inline-markdown mount
- Programmatic `update` to replace content
- Streaming content into a Markdown widget via a stream instance (e.g., fake async source yielding chunks)
- Intercepting link clicks with `openLinks={false}`
- Customizing a single block type (e.g., a custom fence component) by overriding the block map
- Handling unrecognized tokens through the extensibility hook
- Supplying a custom parser factory with extra plugins enabled

## Cross-references
- `spec/docs-spec/widget_markdown_viewer.md` — navigation wrapper around this widget
- `spec/docs-spec/api_await_complete.md` — awaitable-completion pattern
- `spec/spec-src/10-widget-catalog.md` — widget catalog entry
- `spec/spec-src/02-dom-reactivity-and-query.md` — mount lifecycle, reactive props
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS tokens and theming
- `spec/spec-src/11-text-editing-and-document-model.md` — related text/document surfaces

## Notes for writers
- Python's `markdown-it-py` is replaced by `markdown-it` (the JS original). The `gfm-like` preset concept carries over; document in JS terms
- Do not describe `asyncio.Task`, executors, or `aiofile` reads; describe loads as asynchronous and returning when done
- Do not describe Python `weakref.ref` on `MarkdownBlock` — that is an implementation detail. Block-to-parent linkage should be described behaviorally (a block knows its parent Markdown) without implying a specific JS memory model
- Do not port `unhandled_token` method name literally — use the port's exposed extensibility hook name; describe it as "called when the parser yields a token with no block mapping"
- Do not document Python's `staticmethod`/`classmethod` decorators; describe methods as static/instance as the JS API exposes them
- Replace `Callable[[], MarkdownIt]` with a JS function signature in prose; do not leak Python typing syntax
- Shiki (not Rich) is the syntax highlighter for fences — mention this specifically because users will ask how to configure languages and themes
- Roman-numeral prefixing in the TOC is a cosmetic detail from Python Textual; mention only if the port keeps it. If the port uses plain indentation, describe that instead (do not fabricate Roman-numeral behavior)
