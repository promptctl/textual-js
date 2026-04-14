# Phase 10: Text Editing, Advanced Widgets, Animation & Conformance Closure

## Preconditions

Phases 1–9 complete:
- Full infrastructure, full widget catalog, driver loop working
- HeadlessDriver with inspection API
- All prior tests pass

## Goal

Deliver the deepest subsystems (text editing, animation), the remaining complex widgets, and close out conformance tracking against the spec.

## Architectural Rationale

// [LAW:one-source-of-truth] The document model is the single source of truth for text content. `TextArea` renders from the document — it does not maintain a separate text buffer.

// [LAW:single-enforcer] The `Animator` is the single enforcer of timing for all animation. No widget runs its own `setInterval`-based animation outside the animator.

// [LAW:one-source-of-truth] The conformance tracker is the single source of truth for which spec-test areas are implemented. It maps every `spec/spec-tests/` file to a status.

Everything in this phase is "completeness and polish" — the framework is fully functional without it. Text editing is the most complex single subsystem. Animation is low priority but was missing from Plan 1 entirely. Advanced widgets depend on the full stack. Grouping them in a final phase keeps the serial plan focused on infrastructure first.

## Current State (before this phase)

**From Phase 8**: Basic widgets exist (Static, Label, Button, Input, Switch, Checkbox, RadioButton/RadioSet, ProgressBar, Rule, Header, Footer, containers, list widgets).

**From Phase 9**: Full driver loop — input → normalize → dispatch → render → write → HeadlessDriver captures output.

**What does NOT exist**:
- No `Document` model or `WrappedDocument`
- No `TextArea` widget
- No `Navigator` (cursor movement logic)
- No `History` (undo/redo)
- No `Animator` or CSS transitions
- No `DataTable`, `Tree`, `Markdown`, `RichLog`, `Sparkline`, `MaskedInput`, `Pretty`, `DirectoryTree`
- No conformance tracker

## Scope

### Document Model

- `Document` class: line-based text model
- Operations: insert, replace, delete with offset tracking
- Newline normalization (normalize `\r\n`, `\r` to `\n`)
- API edits while `read_only=true` — read-only prevents user edits but allows programmatic API edits
- `WrappedDocument`: word-wrap-aware document view, tracks wrap points per line

### Navigator

- Cursor movement: character, word, line, page, home, end
- Selection ranges: start/end locations, extend selection via shift+movement
- Word boundary detection
- Line-aware navigation that respects wrap points in `WrappedDocument`

### History

- Undo/redo stack with edit grouping
- Edit grouping: consecutive character inserts group into one undo step
- Explicit group boundaries for programmatic edits

### TextArea

- Multi-line text editor widget built on `Document` + `Navigator` + `History`
- Syntax-aware documents: pluggable language support via syntax highlighting
- Theme/language registration
- Selection, clipboard (copy/cut/paste)
- Key bindings for all navigation and editing operations (via Phase 5 binding system)
- Read-only mode
- Line numbers (optional)
- Scroll integration with compositor (Phase 4)

### MaskedInput

- Input with mask constraints (e.g., phone number, date format)
- Template-based character validation per position
- Cursor auto-advance through fixed characters

### Advanced Widgets

- **`DataTable`**: tabular data display with columns, rows, cells. Sorting. Row/column/cell cursors. Fixed rows/columns. Keyboard navigation. Virtualized rendering for large datasets.
- **`Tree` / `TreeNode`**: hierarchical data display. Lazy loading via workers (Phase 6). Expand/collapse. Posts `Tree.NodeSelected`, `Tree.NodeExpanded`, `Tree.NodeCollapsed`.
- **`DirectoryTree`**: `Tree` subclass for filesystem navigation. Platform-independent file listing.
- **`Markdown` / `MarkdownViewer`**: renders markdown content as styled widgets. Supports headings, lists, code blocks, links, tables.
- **`RichLog`**: append-only log display with auto-scroll. Rich text rendering. Max lines with pruning.
- **`Sparkline`**: inline data visualization. `width=null` uses available render width (per uber-divergence). Default reduction is `max` (per uber-divergence).
- **`Pretty`**: formatted display of data structures (objects, arrays).
- **`SelectionList`**: if not already implemented in Phase 8, complete it here.

### Animation

- `Animator` class: manages active animations. Single timing authority for all animation.
- Easing functions: linear, ease-in, ease-out, ease-in-out, and standard CSS easing curves
- `animate()` method on Widget: animate a style property from current value to target over duration
- CSS `transition` property: automatic animation on style changes
- `force_stop_animation()`: schedules `on_complete` via `call_later` (per uber-divergence), not direct invocation
- Duration, delay configuration

### Conformance Tracker

- Create `spec/plan3/CONFORMANCE.md` — a maintained mapping of `spec/spec-tests/` files to implementation status
- Categories: Implemented, In Progress, Intentionally Deferred, Not Yet Started
- Each "Implemented" entry links to the corresponding test file(s)
- Audit all `spec/spec-tests/` files against the test suite

## Spec References

- `spec/spec-src/11-text-editing-and-document-model.md` — document model and text area
- `spec/spec-src/12-supporting-subsystems.md` — animation
- `spec/spec-src/10-widget-catalog.md` — remaining widget catalog
- `spec/spec-tests/text_area.md` — text area test cases
- `spec/spec-tests/document.md` — document model test cases
- `spec/spec-tests/masked_input.md` — masked input test cases
- `spec/spec-tests/data_table.md` — data table test cases
- `spec/spec-tests/tree.md` — tree test cases
- `spec/spec-tests/directory_tree.md` — directory tree test cases
- `spec/spec-tests/markdown.md` — markdown test cases
- `spec/spec-tests/rich_log.md` — rich log test cases
- `spec/spec-tests/sparkline.md` — sparkline test cases
- `spec/spec-tests/animations.md` — animation test cases

## Uber-Divergence Resolutions

| Issue | Resolution |
|-------|-----------|
| Sparkline width/reduction | `width=null` uses render width; default reduction is `max` |
| `force_stop_animation` | Schedule `on_complete` via `call_later`, not direct invocation |

## Exit Criteria

1. Document model tests: insert, replace, delete, newline normalization, read-only API edits.
2. Navigator tests: cursor movement (char, word, line, page, home, end), selection ranges.
3. History tests: undo/redo, edit grouping, group boundaries.
4. TextArea tests: text entry, navigation, selection, undo/redo, syntax highlighting, read-only mode, scroll.
5. DataTable tests: data display, sorting, cursor modes, keyboard navigation.
6. Tree tests: expand/collapse, lazy loading, node selection.
7. Markdown tests: heading, list, code block, link, table rendering.
8. Animation tests: start/complete, easing, CSS transition triggers, `force_stop_animation` callback scheduling.
9. Conformance tracker (`CONFORMANCE.md`) exists and identifies status of every `spec/spec-tests/` file.
10. Remaining gap list is small enough to plan by widget/subsystem rather than by architecture layer.
11. All prior phase tests still pass.
12. `npm run build` and `npm run lint` pass.

## What Comes After

After Phase 10, the framework is feature-complete against the spec's highest-value surface. Remaining work is:
- Any spec-test areas marked "Intentionally Deferred" in the conformance tracker
- Platform-specific drivers beyond HeadlessDriver (terminal, browser)
- Performance optimization
- Documentation and examples
- Community widget ecosystem support
