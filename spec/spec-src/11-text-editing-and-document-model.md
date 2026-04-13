# Text Editing and Document Model

## Subsystem Components

Primary modules (all under `src/textual/`):

- widget surface: `widgets._text_area.TextArea` (plus `TextAreaLanguage` dataclass and the `BUILTIN_LANGUAGES` list).
- theme: `_text_area_theme.TextAreaTheme` (dataclass with base/gutter/cursor/selection/bracket styles plus a `syntax_styles` dict mapping capture names to `rich.style.Style`).
- data model: `document._document` — `DocumentBase` (abstract), `Document` (concrete), `Selection` (NamedTuple), `EditResult`, `Location` (row/column tuple), and `Newline` literal.
- syntax-aware extension: `document._syntax_aware_document.SyntaxAwareDocument` + `SyntaxAwareDocumentError`.
- navigation model: `document._document_navigator.DocumentNavigator`.
- edit operations/history: `document._edit.Edit`, `document._history.EditHistory` + `HistoryException`.
- wrapping projection: `document._wrapped_document.WrappedDocument`.
- tree-sitter bridge: `_tree_sitter.get_language` (lazy import of `tree_sitter_<name>`, per-process cache, `xml` calls `language_xml()` rather than `language()`) and the `TREE_SITTER` availability flag.
- tab expansion: `expand_tabs.get_tab_widths` / `expand_tabs_inline` / `expand_text_tabs_from_widths`.
- wrap computation: `_wrap.compute_wrap_offsets` (consumed by `WrappedDocument`).
- highlight queries: `tree-sitter/highlights/*.scm` bundled for every built-in language.

Note: `src/textual/selection.py` defines a separate `Selection` for screen-text selection overlay and is unrelated to `TextArea` editing. The editing `Selection` lives in `document._document`.

## TextArea Contract

`TextArea` extends `ScrollView` and hosts a `DocumentBase`, a `WrappedDocument`, a `DocumentNavigator`, and an `EditHistory`.

### Reactives and construction

- content/language: `language` (str or `None`, `always_update=True`), default theme is `"css"`.
- selection: `selection: Selection` with `always_update=True`; `Selection.end` is always the cursor.
- presentation toggles: `soft_wrap` (default `True`), `show_line_numbers` (default `False`), `line_number_start` (default `1`), `compact` (toggles the `-textual-compact` CSS class), `highlight_cursor_line` (default `True`), `match_cursor_bracket`, `cursor_blink`.
- editing policy: `read_only` (toggles the `-read-only` class; programmatic edits still allowed), `tab_behavior` (`"focus"` default, or `"indent"`), `indent_width` (default `4`; also used as tab display width by `WrappedDocument`).
- read-only cursor visibility: `show_cursor`.
- suggestion/placeholder: `suggestion`, `hide_suggestion_on_blur`, `placeholder` (`str | Content`).
- blink state: private `_cursor_visible`.
- constructor extras: `max_checkpoints` (forwarded to `EditHistory`), `tooltip`, standard widget kwargs. A `TextArea.code_editor(...)` classmethod returns a preset with `soft_wrap=False`, `tab_behavior="indent"`, `show_line_numbers=True`.

### Interaction and editing

- `BINDINGS` covers cursor motion (arrows, word, line start/end, page up/down), shifted variants for selection, `f6` select line, `f7` select all, deletion (`backspace`, `ctrl+w`, `delete`/`ctrl+d`, `ctrl+f`, `ctrl+u`, `ctrl+k`, `ctrl+shift+k`), clipboard (`ctrl+x`/`ctrl+c`/`ctrl+v`), `ctrl+z`/`ctrl+y` undo/redo.
- Actions map to `action_cursor_*`, `action_select_*`, `action_delete_*`, `action_undo`, `action_redo`, `action_cut`, `action_copy`, `action_paste`.
- `edit(edit: Edit)` applies an `Edit`, updates the wrapped document, records history, posts `TextArea.Changed`.
- `load_text` / `text=` replaces content, rebuilds the document (via `_set_document`), clears `history`, moves cursor to `(0, 0)`, and posts `TextArea.Changed`.
- Tab key only inserts when `tab_behavior == "indent"`; in `read_only` keystrokes that would mutate are dropped.

### Messaging

- `TextArea.Changed`: content changed (has `text_area` and `.control`).
- `TextArea.SelectionChanged`: cursor/selection changed (has `selection`, `text_area`, `.control`).

### Styling surface

- component classes: `text-area--cursor`, `text-area--gutter`, `text-area--cursor-gutter`, `text-area--cursor-line`, `text-area--selection`, `text-area--matching-bracket`, `text-area--suggestion`, `text-area--placeholder`.
- `register_theme(theme: TextAreaTheme)` and `register_language(name, language=None, highlight_query=...)` add entries to per-instance dictionaries; `available_themes` unions built-ins with registered names; using an unknown theme/language raises `ThemeDoesNotExist` / `LanguageDoesNotExist`.
- `_text_area_theme.TextAreaTheme` carries base/gutter/cursor/cursor-line/cursor-gutter/bracket/selection styles plus a `syntax_styles: dict[str, Style]` mapping tree-sitter capture names to Rich styles.

## Document Model

`DocumentBase` (abstract) defines the contract consumed by `TextArea`, `WrappedDocument`, and `DocumentNavigator`:

- mutation: `replace_range(start, end, text) -> EditResult` (the only mutation API).
- text access: `text`, `lines`, `get_line(index)`, `get_text_range(start, end)`, `__getitem__` (int or slice).
- newline handling: `newline` property (`"\n"`, `"\r\n"`, or `"\r"`).
- structure: `line_count`, `start`, `end`, `get_size(indent_width) -> Size`.
- syntax hooks (default no-ops returning `{}` / `None`): `prepare_query(query_str)`, `query_syntax_tree(query, start_point, end_point)`.

`Document` is the default implementation:

- stores text as a newline-stripped `list[str]`. If the source text ends with a newline (or is empty), an extra empty line is appended so trailing newlines round-trip.
- detects newline style via `_detect_newline_style` (preference order `\r\n`, `\n`, `\r`, fallback `\n`).
- `replace_range` is the single mutation primitive for line/column edits; handles multi-line replacements, single newline insertion, and returns an `EditResult(end_location, replaced_text)`.
- `get_text_range` returns `""` when `start == end`, and joins lines with the detected newline.
- `get_size(tab_width)` computes document width using tab-expanded cell widths.
- location/index helpers: `get_index_from_location(location)` and `get_location_from_index(index)` for codepoint-based indexing (not byte-based); `get_location_from_index` raises `ValueError` out of range.

`EditResult` is a dataclass carrying the `end_location` after the edit and the `replaced_text` that was removed. `Location` is `Tuple[int, int]` (row, column, codepoint-indexed).

`Selection` (from `document._document`) is a `NamedTuple(start, end)` with both defaulting to `(0, 0)`. `Selection.cursor(location)` builds a zero-width selection, `is_empty` reports zero width, `contains_line(y)` checks row membership. There is no separate `EditableDocument` type — `Document`/`SyntaxAwareDocument` are the only concrete documents.

## Syntax-Aware Extension

`SyntaxAwareDocument` subclasses `Document` and maintains a tree-sitter parse tree alongside the line list.

- Requires tree-sitter at import time; constructing one without `tree_sitter` raises `RuntimeError`.
- Holds a `Parser` bound to a `tree_sitter.Language` and a `Tree` produced from a read callback over the line list.
- `replace_range` first captures old byte/point coordinates, delegates to `Document.replace_range`, then calls `self._syntax_tree.edit(...)` with old/new byte and point spans and reparses incrementally using the retained tree.
- `_read_callable` serves tree-sitter byte ranges line-by-line, appending the document newline; handles `\r\n` split correctly.
- `prepare_query(query_str)` compiles a `tree_sitter.Query`; `query_syntax_tree(query, start_point, end_point)` runs it through a `QueryCursor`, optionally scoped to a byte/point range (defaults span the whole tree), and returns a dict of capture name → list of `Node`.

### Language/document selection in `TextArea._set_document`

Behavior (not a graceful-fall-through on every branch):

- tree-sitter available AND `language` provided:
  - if the language is registered on the instance, use that `TextAreaLanguage`'s `language` (falling back to `get_language(name)` if the registration left `language=None`) and its `highlight_query`.
  - otherwise look up a built-in language via `_tree_sitter.get_language` and load the bundled `highlights/<name>.scm` as the query.
  - if `get_language` returned `None` (language not installed) the call raises `LanguageDoesNotExist` — this is a loud failure, not a silent fallback.
  - if `SyntaxAwareDocument` construction raises `SyntaxAwareDocumentError`, fall back to plain `Document` and log a warning.
- tree-sitter NOT available AND `language` provided: log a warning, construct a plain `Document`.
- `language` is `None`/`""`: construct a plain `Document`.
- After choosing the document, `_set_document` always rebuilds `wrapped_document` and `navigator`, rebuilds the highlight map, moves the cursor to `(0, 0)`, and refreshes the virtual size.

## Navigation Semantics

`DocumentNavigator` wraps a `WrappedDocument` plus its source `DocumentBase` and provides wrapping-aware cursor movement.

- translates between document-space `Location` and visual `Offset` via the wrapped document.
- handles wrapped-line boundaries for home/end/up/down/page/word motion; "smart home" treats the first non-whitespace column as an intermediate home target.
- word boundaries use a compiled regex `(?<=\W)(?=\w)|(?<=\w)(?=\W)`.
- retains `last_x_offset` (visual cell column) so vertical movement preserves horizontal intent across lines of differing widths and across wrapped sections.

## Edit and Edit History

`Edit` is a dataclass describing a single `replace_range` invocation:

- fields: `text`, `from_location`, `to_location`, `maintain_selection_offset`, and private `_original_selection`, `_updated_selection`, `_edit_result`.
- `top`/`bottom` derive the sorted span.
- `do(text_area, record_selection=True)` records the current selection, applies `document.replace_range(top, bottom, text)`, and computes the post-edit selection:
  - if `maintain_selection_offset`, shift the existing selection rows/columns by the edit's row/column delta when the edit lies at or before the selection endpoints on the same row.
  - otherwise collapse the selection to a cursor at `edit_result.end_location`.
- `undo(text_area)` replays `replace_range` over the edit's new span with the saved `replaced_text` and restores `_original_selection`.
- `after(text_area)` runs after re-wrap/refresh: applies `_updated_selection` and calls `record_cursor_width()` so the navigator's `last_x_offset` matches the post-wrap cursor.

`EditHistory` manages batched undo/redo with deterministic checkpoint rules:

- fields: `max_checkpoints`, `checkpoint_timer` (seconds since last edit), `checkpoint_max_characters`; internal `_undo_stack: deque[list[Edit]]` (bounded by `max_checkpoints`), `_redo_stack: deque[list[Edit]]` (unbounded), `_last_edit_time`, `_character_count`, `_force_end_batch`, `_previously_replaced`.
- `record(edit)` raises `HistoryException` if the edit has not been `do()`-ed yet; no-ops when both `edit.text` and `replaced_text` are empty.
- A new batch is forced when any of the following is true: the undo stack is empty; `_force_end_batch` is set (via `checkpoint()`); the edit inserts more than one character (paste); the edit text or replaced text contains `\n`; the edit's "is replacement" flag differs from the previous edit; the elapsed time since the last edit exceeds `checkpoint_timer`; adding the edit would exceed `checkpoint_max_characters`.
- After recording, the redo stack is cleared. Edits that contain a newline or are longer than one character additionally force a checkpoint so the *next* edit starts a fresh batch (paste isolation).
- `_pop_undo` / `_pop_redo` move whole batches between stacks; a redo pops into the undo stack and immediately forces a checkpoint so subsequent typing cannot append to the redone batch.
- `clear()` empties both stacks and resets batching state (used by `load_text`). `checkpoint()` is a public API that the TextArea calls on blur, explicit cursor placement via mouse, and non-edit keyboard motion.

// [LAW:dataflow-not-control-flow] Editing is modeled as deterministic transformations over document state with explicit edit records and batch checkpoints, not ad hoc UI-only mutation branches.

## Wrapping Projection

`WrappedDocument` wraps a `DocumentBase` at a given width and indent/tab width and projects it into visual lines:

- state: `_wrap_offsets[line]` (codepoint indices where each line breaks), `_offset_to_line_info[y_offset]` (maps visual y to `(line_index, section_offset)`), `_line_index_to_offsets[line]` (the reverse), `_tab_width_cache[line]` (per-tab expansion widths).
- `wrap(width, tab_width=None)` rebuilds all caches; `width=0` disables wrapping.
- `wrap_range(start, old_end, new_end)` performs incremental rewrap after an edit: rewraps only the affected line span, splices the new visual lines into the caches, and shifts y-offsets / line indices below the edit region.
- `offset_to_location(offset)` and `location_to_offset(location)` translate between visual `Offset` and document `Location`, honoring tab expansion via `expand_tabs_inline` and `cell_width_to_column_index`.
- `get_sections(line_index)` exposes the wrapped sections for a raw line; `get_offsets(line_index)` exposes its wrap offsets; `get_tab_widths(line_index)` exposes the cached tab expansions.
- `height` is the total number of visual rows; `wrapped` reports whether any line actually wrapped at the current width.

Tab expansion is computed by `expand_tabs.get_tab_widths`, which walks the line advancing the cell position and computing `tab_size - (cell_position % tab_size)` for each tab (accounting for double-width characters). `expand_tabs_inline` materializes a tab-expanded string; `expand_text_tabs_from_widths` applies precomputed widths to a Rich `Text` so highlighting spans survive expansion.

## Syntax Highlighting Pipeline

`TextArea` highlight flow:

1. Pick a language (built-in via `_tree_sitter.get_language`, or user-registered) and load the matching `.scm` highlight query (bundled queries under `src/textual/tree-sitter/highlights/`).
2. `SyntaxAwareDocument.prepare_query` compiles the query; `TextArea._build_highlight_map` calls `query_syntax_tree` and builds a per-line list of `(start_column, end_column, capture_name)` highlights.
3. During rendering each line is tab-expanded, styled from the current `TextAreaTheme` (`base_style` + `syntax_styles[name]`), and overlaid with selection, cursor-line, cursor, and matching-bracket styles.
4. Matching brackets are located by `find_matching_bracket`, which scans forward or backward from the cursor using a bracket stack keyed off `_OPENING_BRACKETS` / `_CLOSING_BRACKETS` (`{}`, `[]`, `()`).

Built-in languages (each with a bundled `tree-sitter/highlights/*.scm`): `python`, `markdown`, `json`, `toml`, `yaml`, `html`, `css`, `javascript`, `rust`, `go`, `regex`, `sql`, `java`, `bash`, `xml`. The `xml` language is special-cased in `get_language` because its tree-sitter module exposes `language_xml()` instead of `language()`.

## Verifiable Behavior Expectations

- `load_text` / setting `text`: clears `EditHistory`, rebuilds `document`/`wrapped_document`/`navigator`, resets the cursor to `(0, 0)`, and posts `TextArea.Changed`.
- Edits round-trip through `Edit.do` / `Edit.undo` / `Edit.after`, producing identical document text and cursor state (`_original_selection` restored on undo).
- Cursor/selection changes emit `SelectionChanged`, update `last_x_offset` at appropriate points, and scroll the cursor into view.
- Assigning `language` or `theme` re-runs `_set_document` / theme resolution and invalidates the line cache so rendering reflects the new configuration.
- Requesting a language that is not installed or registered raises `LanguageDoesNotExist`; requesting an unknown theme raises `ThemeDoesNotExist`.
- `EditHistory` batching rules are observable through `undo_stack` / `redo_stack` snapshots after scripted edit sequences (e.g. paste, newline, timed gaps).

// [LAW:verifiable-goals] Editor correctness is checkable through deterministic document text/selection/history state after scripted edit operations.
