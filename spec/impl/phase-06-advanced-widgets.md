# Phase 6: Advanced Widgets & Text Editing

## Preconditions

Phases 1–5 complete:
- Full framework infrastructure
- Core widget catalog (controls, containers, list widgets)
- All prior tests pass

## Goal

Deliver data-rich interactive widgets, the text editing subsystem, and markdown rendering — leveraging marked for markdown parsing and Shiki for syntax highlighting.

## Architectural Rationale

// [LAW:one-source-of-truth] The Document model is the single source of truth for text content. TextArea renders from the Document — no separate text buffer.

// [LAW:one-way-deps] marked produces an AST → Markdown widget walks it → creates textual-js widgets. marked does not know about textual-js. Shiki produces tokenized output → TextArea renders it. Shiki does not know about textual-js.

// [LAW:single-enforcer] The Document model is the single enforcer of text mutations. All edits (user and programmatic) go through Document methods. TextArea reads from it.

### Libraries

**marked** — Fast, lightweight markdown parser. Produces a token AST that we walk to create textual-js widget trees. We don't render HTML — we render terminal UI widgets (Header → `<Text bold>`, code block → styled `<Box>`, list → `<Box>` with bullet prefixes, etc.).

**Shiki** — VS Code-grade syntax highlighting using TextMate grammars. Produces tokenized/colored output. TextArea uses it to render syntax-highlighted code. Shiki works in Node and supports hundreds of languages.

## Current State (before this phase)

**From Phase 5:** Core widgets available for composition:
- `Static`, `Label`, `Button`, `Input` — building blocks for complex widgets
- `ScrollableContainer` — used by DataTable, Tree, RichLog
- `ListView` / `OptionList` — patterns for list-based widgets

**What does NOT exist:**
- No DataTable, Tree, Markdown, RichLog, Sparkline
- No Document model, no TextArea
- No syntax highlighting integration

## Scope

### Install libraries

- Add `marked` as a runtime dependency
- Add `shiki` as a runtime dependency (or `shiki/core` for smaller bundle with manual language loading)

### Document Model

- `Document` class (MobX observable state):
  - Line-based text model — array of lines
  - Operations: `insert(location, text)`, `replace(range, text)`, `delete(range)`
  - All operations update the observable state → MobX reactions trigger re-renders
  - Newline normalization (`\r\n`, `\r` → `\n`)
  - API edits while `readOnly: true` — read-only prevents user keystrokes but allows programmatic edits
- `WrappedDocument`: word-wrap-aware view over a Document
  - Tracks wrap points per line based on available width
  - Width is a MobX observable — changes trigger rewrap
  - Cursor positions map between document coordinates and wrapped coordinates

### Navigator

- Cursor movement: character, word, line, page, home, end
- Selection ranges: start/end locations, extend via shift+movement
- Word boundary detection
- Line-aware navigation respecting wrap points

### History

- Undo/redo stack
- Edit grouping: consecutive character inserts group into one undo step
- Explicit group boundaries for programmatic edits
- `undo()` / `redo()` methods on Document

### TextArea Widget

- Multi-line text editor React component
- Renders from Document (reads observable state) + Navigator (cursor position)
- Syntax highlighting via Shiki:
  - `language` prop selects Shiki grammar
  - `theme` prop selects Shiki theme
  - Shiki tokenizes the document content → produces colored spans
  - TextArea renders the colored output using Ink `<Text>` with color props
- Key bindings for navigation and editing (via Phase 3 binding system)
- Selection rendering (highlighted background)
- Read-only mode
- Line numbers (optional)
- Scroll integration (wraps in scrollable container)
- Posts `TextArea.Changed`

### MaskedInput Widget

- Input with mask constraints (e.g., `"999-999-9999"` for phone)
- Template-based character validation per position
- Cursor auto-advance through fixed characters
- Built on Input (Phase 5) with mask layer

### DataTable Widget

- Tabular data display with columns, rows, cells
- Column definitions with header, key, width
- Data as MobX observable array — changes trigger re-render
- Sorting: click column header to sort
- Cursor modes: row, column, cell
- Fixed rows/columns (headers that don't scroll)
- Keyboard navigation: arrows, Home/End, Page Up/Down
- Virtualized rendering: only render visible rows
- Posts `DataTable.RowSelected`, `DataTable.CellSelected`
- Scrollable via ScrollableContainer

### Tree / DirectoryTree Widgets

- `Tree<T>` — hierarchical data display
  - `TreeNode` with label, data, expandable flag
  - Expand/collapse nodes
  - Lazy loading via workers (Phase 4) — load children on expand
  - Keyboard navigation: arrows, Enter to expand/collapse
  - Posts `Tree.NodeSelected`, `Tree.NodeExpanded`, `Tree.NodeCollapsed`
  - MobX observable tree state
- `DirectoryTree` — Tree subclass for filesystem
  - Loads directory contents via `fs.readdir` (Node API)
  - File/folder icons
  - Lazy loading on expand

### Markdown / MarkdownViewer Widgets

- `Markdown` component:
  - Accepts markdown string as prop
  - Parses with `marked.lexer()` to get token array
  - Walks tokens and creates textual-js widgets:
    - Heading → `<Text bold>` with size-based styling
    - Paragraph → `<Text>`
    - Code block → styled `<Box>` with syntax highlighting via Shiki
    - Inline code → `<Text>` with background
    - List → `<Box>` with bullet/number prefixes
    - Link → `<Text>` with URL (underlined)
    - Table → DataTable or simple grid
    - Blockquote → indented `<Box>` with border
    - Horizontal rule → `<Rule>`
  - MobX observable content — updates re-parse and re-render
- `MarkdownViewer` — Markdown inside a ScrollableContainer with navigation

### RichLog Widget

- Append-only log display
- `write(content)` appends to the log
- Auto-scroll to bottom on new content
- Rich text rendering (styled text, not just plain strings)
- Max lines with pruning (oldest lines removed)
- MobX observable log entries
- Scrollable

### Sparkline Widget

- Inline data visualization
- `data` prop: array of numbers
- `width=null` uses available render width
- Default reduction is `max`
- Renders using block characters (▁▂▃▄▅▆▇█)

### Pretty Widget

- Formatted display of data structures
- Accepts any JS value, renders a formatted representation
- Collapsible nested objects/arrays
- Syntax-colored output

## Spec References

- `spec/spec-src/11-text-editing-and-document-model.md` — document model, TextArea
- `spec/spec-src/10-widget-catalog.md` — remaining widget catalog
- `spec/spec-tests/text_area.md`, `spec/spec-tests/document.md`
- `spec/spec-tests/masked_input.md`
- `spec/spec-tests/data_table.md`
- `spec/spec-tests/tree.md`, `spec/spec-tests/directory_tree.md`
- `spec/spec-tests/markdown.md`
- `spec/spec-tests/rich_log.md`
- `spec/spec-tests/sparkline.md`

## Exit Criteria

1. Document tests: insert, replace, delete, newline normalization, read-only API edits, undo/redo.
2. Navigator tests: cursor movement (char, word, line, page, home, end), selection ranges.
3. TextArea tests: text entry, navigation, selection, undo/redo, syntax highlighting (Shiki produces colored output), read-only mode.
4. DataTable tests: data display, sorting, cursor modes, keyboard navigation, virtualized rendering.
5. Tree tests: expand/collapse, lazy loading, node selection.
6. Markdown tests: heading, paragraph, code block (with Shiki highlighting), list, link, table rendering.
7. RichLog tests: append, auto-scroll, max lines pruning.
8. Sparkline tests: correct block character rendering, width=null, max reduction.
9. All prior phase tests still pass.
10. `npm run build` and `npm run lint` pass.
11. Each widget component has a paired visual fixture in `visual-tests/fixtures/` (`.py` + `.tsx`). `bash visual-tests/run.sh` runs to completion with no text-content divergence.

## What the Next Phase Expects

Phase 7 (Animation & Conformance) expects:
- Full widget catalog complete — animation applies to all widgets' style properties
- TCSS cascade working with all widgets — CSS transitions are style changes that animate
- MobX observable style properties — animator updates them over time
