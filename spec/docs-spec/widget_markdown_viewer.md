# Docs Spec: MarkdownViewer Widget

## Purpose
Describes the `MarkdownViewer` widget — a scrollable Markdown reader with a sidebar table of contents and browser-style back/forward navigation. Teaches readers how to mount a Markdown document with navigation affordances and how to intercept or customize navigation.

## Audience
Application authors building documentation browsers, help screens, release-notes viewers, or anywhere a navigable Markdown document is needed. Readers who only need static Markdown rendering should be pointed to the `Markdown` widget.

## Required sections
1. Overview (what MarkdownViewer adds over Markdown)
2. Characteristics (focusable via inner document, not a container from the user's perspective, scrolls)
3. Props (initial markdown, `showTableOfContents`, parser factory, `openLinks`, standard widget props)
4. Composition (inner `Markdown` widget plus `MarkdownTableOfContents` sidebar)
5. Properties (`document`, `tableOfContents`)
6. Reactive attributes (`showTableOfContents`, `topBlock`)
7. Navigator model (history stack, `go` / `back` / `forward`, `location`, `start`, `end`)
8. Navigation methods on the viewer (`go`, `back`, `forward`) and anchor-only behavior
9. Messages (`NavigatorUpdated`)
10. Event interception (how `LinkClicked`, `TableOfContentsUpdated`, `TableOfContentsSelected` are consumed from the inner Markdown widget)
11. Default TCSS and the `-show-table-of-contents` class toggle
12. MarkdownTableOfContents sub-widget (tree-of-headings structure, level nesting, numeral prefixes, selection message)
13. Usage patterns

## Key concepts
- Composition over inheritance: `MarkdownViewer` owns a `Markdown` and a `MarkdownTableOfContents`
- Browser-like navigation: linear history with truncation on new `go`
- Anchor-only vs. file navigation: leading-`#` targets scroll within the current document; other targets load a new path
- Sidebar visibility is a CSS class toggled by a reactive attribute (single source of truth for visibility)
- Messages from the inner widget are stopped at the viewer — they do not bubble further
- `topBlock` reactive tracks which block is currently at the top of the viewport for scroll persistence across navigation

## Behaviors and contracts
- `go(location)` truncates forward history; `back`/`forward` move the cursor without modifying the stack
- `NavigatorUpdated` is emitted after any navigator operation that changes the loaded document (not for pure-anchor scrolls)
- `LinkClicked` from the inner `Markdown` is routed through `go()` automatically; authors who want custom link handling should use `Markdown` directly with `openLinks={false}` rather than subverting the viewer's interception
- `TableOfContentsUpdated` is forwarded into the TOC sidebar so the tree re-renders
- `TableOfContentsSelected` causes the viewer to scroll the target block to the top of the viewport
- The TOC sidebar is docked left and rendered conditionally via the `-show-table-of-contents` class — toggling the reactive attribute adds/removes the class

## Example requirements
All JSX/TypeScript using Ink primitives and React function components wrapped with `observer()`. Cover:
- Minimal mount: viewer with inline markdown string
- Loading documents from a URL or local source (describe via a `loadUrl`/`loadPath`-style API as exposed by the port; do not invent Python paths)
- Toggling the TOC sidebar with a key binding / action
- Handling `NavigatorUpdated` to update an external breadcrumb or title bar
- Programmatic navigation (`go`, `back`, `forward`) from parent components

## Cross-references
- `spec/docs-spec/widget_markdown.md` — the inner content widget
- `spec/docs-spec/api_binding.md` — for wiring key bindings to navigation actions
- `spec/spec-src/10-widget-catalog.md` — widget catalog entry
- `spec/spec-src/03-message-event-and-dispatch.md` — message interception / stop-propagation semantics
- `spec/spec-src/05-layout-render-and-compositor.md` — scroll / layout semantics

## Notes for writers
- Python's `Path` / `PurePath` do not translate — describe locations as strings (paths or URLs) as the port exposes them
- Avoid describing `VerticalScroll` as an inherited base; describe the viewer as a scrollable surface instead
- Do not document `SCOPED_CSS = False` — that is a Python-specific Textual-CSS loader detail. Describe the visibility mechanism (the `-show-table-of-contents` class) without referencing scoped-CSS semantics unless TCSS exposes an equivalent
- `markdown-it` stays as the parser library (this carries over); `parserFactory` should be documented as returning the parser instance the port uses
- Do not mention `asyncio.Task` or `executor` — async reads are described at the contract level (they do not block the UI)
- Do not describe `WeakReference` or Python identity hashing when talking about navigator state
