# Text Editing And Supporting Subsystems

## Text Editing

`TextArea` (in `widgets._text_area`) is the public editor widget. It extends
`ScrollView` and hosts four collaborating objects: a `DocumentBase` (the text
model), a `WrappedDocument` (visual projection), a `DocumentNavigator`
(cursor motion), and an `EditHistory` (undo/redo batching).

Observable editor behavior:

- multi-line editing over a line-structured document.
- cursor and selection behavior through `Selection` (from
  `document._document`), a `NamedTuple(start, end)` where `end` is always the
  cursor. `Selection.cursor(location)` builds a zero-width selection;
  `is_empty` and `contains_line(y)` are observable helpers.
- undo/redo history through `EditHistory` with deterministic batching rules
  (see Edit History below).
- optional language and theme integration via `language` / `theme` reactives
  and per-instance `register_language` / `register_theme`.
- soft wrap and line-number behavior through `soft_wrap`, `show_line_numbers`,
  `line_number_start`, `compact`, `highlight_cursor_line`,
  `match_cursor_bracket`, `cursor_blink`.
- programmatic edit APIs: `insert`, `replace`, `delete`, `clear`, and the
  lower-level `edit(edit: Edit)`.
- `TextArea.code_editor(...)` classmethod preset: `soft_wrap=False`,
  `tab_behavior="indent"`, `show_line_numbers=True`.

Programmatic editing behavior:

- newline normalization to `\n` on input; the document's detected `newline`
  property round-trips the original style on `text` read.
- predictable edit result reporting via `EditResult(end_location,
  replaced_text)`.
- selection is maintained by `Edit.do`: if the edit carries
  `maintain_selection_offset`, the existing selection is shifted by the
  edit's row/column delta; otherwise it collapses to a cursor at
  `end_location`.
- keyboard editing is blocked by `read_only=True` (the reactive toggles the
  `-read-only` CSS class and mutating keystrokes are dropped), but
  programmatic edits still apply.
- `tab_behavior` (`"focus"` default, or `"indent"`) gates whether the Tab key
  inserts; `indent_width` (default `4`) doubles as the `WrappedDocument` tab
  display width.
- `load_text` / assigning `text` replaces content via `_set_document`, clears
  `EditHistory`, resets the cursor to `(0, 0)`, and posts `TextArea.Changed`.

Bindings cover cursor motion (arrows, word, line start/end, page up/down),
shifted variants for selection, `f6` select line, `f7` select all, deletion
(`backspace`, `ctrl+w`, `delete`/`ctrl+d`, `ctrl+f`, `ctrl+u`, `ctrl+k`,
`ctrl+shift+k`), clipboard (`ctrl+x`/`ctrl+c`/`ctrl+v`), and `ctrl+z`/`ctrl+y`
undo/redo, mapped to `action_cursor_*`, `action_select_*`, `action_delete_*`,
`action_undo`, `action_redo`, `action_cut`, `action_copy`, `action_paste`.

Messaging:

- `TextArea.Changed` when content changes.
- `TextArea.SelectionChanged` when cursor/selection changes; both carry
  `text_area` and `.control`.

Styling surface exposes component classes `text-area--cursor`,
`text-area--gutter`, `text-area--cursor-gutter`, `text-area--cursor-line`,
`text-area--selection`, `text-area--matching-bracket`, `text-area--suggestion`,
`text-area--placeholder`. `TextAreaTheme` (`_text_area_theme`) carries
base/gutter/cursor/cursor-line/cursor-gutter/bracket/selection styles plus a
`syntax_styles: dict[str, Style]` mapping tree-sitter capture names to Rich
styles. `available_themes` unions built-ins with registered names; unknown
theme/language raises `ThemeDoesNotExist` / `LanguageDoesNotExist`.

## Editor State And Document Behavior

The observable editor state is the composition of:

- document text and line structure through `DocumentBase` / `Document`.
- selection state through `Selection`.
- edit result reporting through `EditResult`.
- wrapped-document projection through `WrappedDocument`.
- document navigation through `DocumentNavigator`.
- edit history through `EditHistory`.
- optional syntax-aware document behavior through `SyntaxAwareDocument`.

### Document contract

`DocumentBase` (abstract) defines the contract consumed by `TextArea`,
`WrappedDocument`, and `DocumentNavigator`:

- mutation: `replace_range(start, end, text) -> EditResult` is the *only*
  mutation API. Line/column edits, multi-line replacement, and single
  newline insertion all route through it.
- text access: `text`, `lines`, `get_line(index)`, `get_text_range(start,
  end)`, `__getitem__` (int or slice). `get_text_range` returns `""` when
  `start == end` and joins lines with the detected newline.
- newline handling: `newline` property returning `"\n"`, `"\r\n"`, or `"\r"`.
- structure: `line_count`, `start`, `end`, `get_size(indent_width) -> Size`.
- syntax hooks (default no-ops returning `{}` / `None`): `prepare_query`,
  `query_syntax_tree`.

`Document` is the default concrete implementation. It stores text as a
newline-stripped `list[str]`; if the source text ends with a newline (or is
empty), an extra empty line is appended so trailing newlines round-trip.
Newline style is detected by `_detect_newline_style` with preference order
`\r\n`, `\n`, `\r`, fallback `\n`. `get_size(tab_width)` computes document
width using tab-expanded cell widths. Location/index helpers
`get_index_from_location` and `get_location_from_index` are codepoint-based
(not byte-based); `get_location_from_index` raises `ValueError` out of range.

`EditResult` is a dataclass carrying `end_location` and `replaced_text`.
`Location` is `Tuple[int, int]` (row, column, codepoint-indexed). There is
no separate `EditableDocument` type — `Document` and `SyntaxAwareDocument`
are the only concrete documents. Note: `src/textual/selection.py` defines a
separate `Selection` for screen-text selection overlay, unrelated to
`TextArea` editing.

### Syntax-aware document

`SyntaxAwareDocument` subclasses `Document` and maintains a tree-sitter
parse tree alongside the line list.

- Requires `tree_sitter` at import time; constructing without it raises
  `RuntimeError`.
- Holds a `Parser` bound to a `tree_sitter.Language` and a `Tree` produced
  from a read callback (`_read_callable`) that serves tree-sitter byte
  ranges line-by-line and appends the document newline, handling `\r\n`
  splits correctly.
- `replace_range` captures old byte/point coordinates, delegates to
  `Document.replace_range`, then calls `self._syntax_tree.edit(...)` with
  old/new byte and point spans and reparses incrementally from the retained
  tree.
- `prepare_query(query_str)` compiles a `tree_sitter.Query`;
  `query_syntax_tree(query, start_point, end_point)` runs it through a
  `QueryCursor`, optionally scoped to a byte/point range (defaults span the
  whole tree), and returns a dict of capture name to list of `Node`.

### Language/document selection in `_set_document`

`TextArea._set_document` resolves which document class to instantiate from
the current `language` reactive and tree-sitter availability. It is *not* a
graceful fall-through at every branch:

- tree-sitter available AND `language` provided:
  - if the language is registered on the instance, use that
    `TextAreaLanguage`'s `language` (falling back to `get_language(name)`
    when the registration left `language=None`) and its `highlight_query`.
  - otherwise look up a built-in via `_tree_sitter.get_language` and load
    the bundled `highlights/<name>.scm` as the query.
  - if `get_language` returned `None` (module not installed) the call
    raises `LanguageDoesNotExist` — loud failure, not silent fallback.
  - if `SyntaxAwareDocument` construction raises
    `SyntaxAwareDocumentError`, fall back to plain `Document` and log a
    warning.
- tree-sitter NOT available AND `language` provided: log a warning and
  construct a plain `Document`.
- `language` is `None`/`""`: construct a plain `Document`.

After choosing the document, `_set_document` always rebuilds
`wrapped_document` and `navigator`, rebuilds the highlight map, moves the
cursor to `(0, 0)`, and refreshes the virtual size.

### Navigation

`DocumentNavigator` wraps a `WrappedDocument` plus its source `DocumentBase`:

- translates between document-space `Location` and visual `Offset` via the
  wrapped document.
- handles wrapped-line boundaries for home/end/up/down/page/word motion;
  "smart home" treats the first non-whitespace column as an intermediate
  home target.
- word boundaries use the compiled regex `(?<=\W)(?=\w)|(?<=\w)(?=\W)`.
- retains `last_x_offset` (visual cell column) so vertical movement
  preserves horizontal intent across lines of differing widths and across
  wrapped sections.

### Edit and EditHistory

`Edit` is a dataclass describing a single `replace_range` invocation with
fields `text`, `from_location`, `to_location`, `maintain_selection_offset`,
and private `_original_selection`, `_updated_selection`, `_edit_result`.
`top` / `bottom` derive the sorted span.

- `do(text_area, record_selection=True)` records the current selection,
  applies `document.replace_range(top, bottom, text)`, then computes the
  post-edit selection: if `maintain_selection_offset`, shift the existing
  selection rows/columns by the edit's row/column delta when the edit lies
  at or before the selection endpoints on the same row; otherwise collapse
  to a cursor at `edit_result.end_location`.
- `undo(text_area)` replays `replace_range` over the edit's new span with
  the saved `replaced_text` and restores `_original_selection`.
- `after(text_area)` runs after re-wrap/refresh, applies
  `_updated_selection`, and calls `record_cursor_width()` so the
  navigator's `last_x_offset` matches the post-wrap cursor.

`EditHistory` manages batched undo/redo with deterministic checkpoint rules:

- fields: `max_checkpoints`, `checkpoint_timer` (seconds since last edit),
  `checkpoint_max_characters`; internal `_undo_stack: deque[list[Edit]]`
  (bounded by `max_checkpoints`), `_redo_stack: deque[list[Edit]]`
  (unbounded), plus `_last_edit_time`, `_character_count`,
  `_force_end_batch`, `_previously_replaced`.
- `record(edit)` raises `HistoryException` if the edit has not been
  `do()`-ed yet; no-ops when both `edit.text` and `replaced_text` are empty.
- A new batch is forced when any of: the undo stack is empty;
  `_force_end_batch` is set (via `checkpoint()`); the edit inserts more
  than one character (paste); the edit's text or replaced text contains
  `\n`; the edit's "is replacement" flag differs from the previous edit;
  the elapsed time since the last edit exceeds `checkpoint_timer`; adding
  the edit would exceed `checkpoint_max_characters`.
- After recording, the redo stack is cleared. Edits containing a newline or
  longer than one character additionally force a checkpoint so the *next*
  edit starts a fresh batch (paste isolation).
- `_pop_undo` / `_pop_redo` move whole batches between stacks; a redo pops
  into the undo stack and immediately forces a checkpoint so subsequent
  typing cannot append to the redone batch.
- `clear()` empties both stacks and resets batching state (used by
  `load_text`). `checkpoint()` is the public API that `TextArea` calls on
  blur, explicit cursor placement via mouse, and non-edit keyboard motion.

// [LAW:dataflow-not-control-flow] Editing is modeled as deterministic
transformations over document state with explicit edit records and batch
checkpoints, not ad hoc UI-only mutation branches.

### Wrapping projection

`WrappedDocument` wraps a `DocumentBase` at a given width and indent/tab
width and projects it into visual lines:

- state: `_wrap_offsets[line]` (codepoint indices where each line breaks),
  `_offset_to_line_info[y_offset]` mapping visual y to `(line_index,
  section_offset)`, `_line_index_to_offsets[line]` (reverse),
  `_tab_width_cache[line]` (per-tab expansion widths).
- `wrap(width, tab_width=None)` rebuilds all caches; `width=0` disables
  wrapping.
- `wrap_range(start, old_end, new_end)` performs incremental rewrap after
  an edit: rewraps only the affected line span, splices new visual lines
  into the caches, and shifts y-offsets and line indices below the edit
  region. This is the hot path after every `Edit.do`.
- `offset_to_location(offset)` and `location_to_offset(location)` translate
  between visual `Offset` and document `Location`, honoring tab expansion
  via `expand_tabs_inline` and `cell_width_to_column_index`.
- `get_sections(line_index)`, `get_offsets(line_index)`,
  `get_tab_widths(line_index)` expose wrapped sections, wrap offsets, and
  cached tab expansions.
- `height` is the total number of visual rows; `wrapped` reports whether
  any line actually wrapped at the current width.

Tab expansion is computed by `expand_tabs.get_tab_widths`, which walks the
line advancing the cell position and computing `tab_size - (cell_position %
tab_size)` per tab (accounting for double-width characters).
`expand_tabs_inline` materializes a tab-expanded string;
`expand_text_tabs_from_widths` applies precomputed widths to a Rich `Text`
so highlighting spans survive expansion. `_wrap.compute_wrap_offsets` is
the underlying wrap primitive `WrappedDocument` consumes.

### Syntax highlighting pipeline

1. Pick a language (built-in via `_tree_sitter.get_language` or
   user-registered) and load the matching `.scm` query (bundled under
   `tree-sitter/highlights/`). Built-in languages: `python`, `markdown`,
   `json`, `toml`, `yaml`, `html`, `css`, `javascript`, `rust`, `go`,
   `regex`, `sql`, `java`, `bash`, `xml`. `xml` is special-cased in
   `get_language` because its tree-sitter module exposes `language_xml()`
   instead of `language()`. `_tree_sitter` lazily imports
   `tree_sitter_<name>` and maintains a per-process cache; `TREE_SITTER` is
   the availability flag.
2. `SyntaxAwareDocument.prepare_query` compiles the query;
   `TextArea._build_highlight_map` calls `query_syntax_tree` and builds a
   per-line list of `(start_column, end_column, capture_name)` highlights.
3. During rendering each line is tab-expanded, styled from the current
   `TextAreaTheme` (`base_style` + `syntax_styles[name]`), and overlaid
   with selection, cursor-line, cursor, and matching-bracket styles.
4. Matching brackets are located by `find_matching_bracket`, which scans
   forward or backward from the cursor using a bracket stack keyed off
   `_OPENING_BRACKETS` / `_CLOSING_BRACKETS` (`{}`, `[]`, `()`).

### Verifiable behavior expectations

- `load_text` / setting `text`: clears `EditHistory`, rebuilds
  `document`/`wrapped_document`/`navigator`, resets cursor to `(0, 0)`,
  and posts `TextArea.Changed`.
- Edits round-trip through `Edit.do` / `Edit.undo` / `Edit.after`,
  producing identical document text and cursor state
  (`_original_selection` restored on undo).
- Cursor/selection changes emit `SelectionChanged`, update `last_x_offset`
  at appropriate points, and scroll the cursor into view.
- Assigning `language` or `theme` re-runs `_set_document` / theme
  resolution and invalidates the line cache.
- Requesting a language not installed or registered raises
  `LanguageDoesNotExist`; an unknown theme raises `ThemeDoesNotExist`.
- `EditHistory` batching rules are observable through `undo_stack` /
  `redo_stack` snapshots after scripted edit sequences (paste, newline,
  timed gaps).

// [LAW:verifiable-goals] Editor correctness is checkable through
deterministic document text/selection/history state after scripted edit
operations.

## Validation

`validation` module.

- `Validator` base class defines `validate` plus success/failure helpers.
- `ValidationResult` aggregates failures and supports merge across a
  configured validator list, so combined results are a single value.
- Built-in validators: `Regex`, `Number`, `Integer`, `Length`, `Function`,
  `URL`.
- Consumed directly by `Input`, reusable at any string input boundary.
- `Input` controls validation timing, empty-input handling, and
  validation-related styling state changes.

## Suggestions

Modules: `suggester`, `suggestions`, `fuzzy`.

- `Suggester` defines the async `get_suggestion` contract with an optional
  cache; `SuggestionReady` delivers results to requester nodes.
- `SuggestFromList` provides prefix completion over ordered candidates.
  Cache behavior and case-sensitivity behavior are part of its contract.
- `suggestions.get_suggestion(s)` wraps `difflib.get_close_matches` for
  "did you mean" hints (used by DOM/CSS error messages).
- `fuzzy.FuzzySearch` powers command palette ranked matching with LRU
  caching and `Content`-aware highlighting.

## Notifications

Module: `notifications`. Separate from toast rendering (the UI projection).

- `Notification` carries message/title/severity/timeout/markup metadata.
  Severity is constrained to `information`, `warning`, `error`.
- `Notify` message transports notifications into the app event pipeline.
- `Notifications` collection manages active notifications and reaps
  expired entries lazily on access.
- App-level `App.notify(...)` is the entry point; toast rendering is the
  UI projection, not part of the notification contract.

## Themes And Design

Modules: `theme`, `design`, `color`, `_ansi_theme`, `_color_constants`.

- `Theme` dataclass defines app palette and optional variables; built-ins
  exposed via `BUILTIN_THEMES`.
- `Theme.to_color_system()` maps a theme into the `ColorSystem` generation
  pipeline feeding CSS variables.
- `color` owns the canonical `Color` value (RGB/A, HSL, blending, parsing)
  shared by CSS, styles, filters, renderables.
  // [LAW:one-source-of-truth] single color type for the whole stack.
- `_ansi_theme` holds ANSI 16-color palette mappings used when translating
  themed colors to terminal ANSI.
- `_color_constants` exposes the named CSS color table.
- Subsystem-specific theme registries exist where a widget family owns its
  own theme set (notably `TextAreaTheme` for `TextArea`).

## Content And Renderable Helpers

Content primitives: `content`, `markup`, `style`, `visual`, `render`.

- `render.measure` wraps Rich measurement with a console fallback.
- `markup` parses the Textual markup dialect into `Content` spans.
- `_markup_playground` is a developer tool app for experimenting with
  markup.

Renderables: `renderables/*` — `bar`, `blank`, `digits`, `gradient`,
`sparkline`, `text_opacity`, `tint`, `background_screen`, `styled`,
`_blend_colors`.

Line, segment, and text utilities: `strip`, `_segment_tools`, `expand_tabs`,
`_line_split`, `_wrap`, `pad` (`HorizontalPad`), `_cells` (cell-length and
column-index helpers backed by Rich's cached `cell_len`), `_opacity`
(segment-stream alpha blending), `highlight` (Pygments-backed syntax
highlighting into `Content`).

## Geometry, Coordinates, And Types

- `geometry` — `Offset`, `Size`, `Region`, `Spacing`, `Shape`.
- `coordinate` — `(row, column)` pair used by tables/text area.
- `map_geometry` — `MapGeometry` absolute placement record used by the
  compositor.
- `box_model` — computed content/padding/border/margin box used by layout.
- `_extrema` — `Extrema` min/max dimensional clamp applied during resolve.
- `types` (public aliases), `_types` (internal protocols including
  `MessageTarget` / `EventTarget` and `UnusedParameter` sentinel),
  `_keyboard_protocol` (kitty keyboard protocol functional-key table).

## Animation And Timing

Modules: `_animator`, `_easing`, `_duration`, `clock`, `_time`, `_sleep`,
`_win_sleep`, `_wait`, `eta`.

- `_animator` owns app animation scheduling, the `Animatable` protocol,
  `AnimationError`, and integrates with `Timer`.
- `_easing` provides the named easing function table (`EASING`,
  `DEFAULT_EASING`).
- `_duration` parses CSS durations (`"1s"`, `"500ms"`) with
  `DurationParseError`.
- `clock.Clock` / `MockClock` are the single timing authority for
  scheduling; tests inject `MockClock`.
  // [LAW:one-source-of-truth] one clock.
- `_time` centralizes `monotonic` / `sleep` imports so the rest of the
  codebase shares a single timing seam.
- `_sleep` + `_win_sleep` provide a high-resolution sleeper thread
  (Windows needs a dedicated path).
- `_wait.wait_for_idle` yields until the event loop is quiescent (test
  support).
- `eta.ETA` computes progress ETAs from sampled progress series (used by
  `ProgressBar`).

## Async Coordination

Modules: `await_complete`, `await_remove`, `rlock`, `_callback`, `_loop`.

- `AwaitComplete` / `AwaitRemove` are optionally-awaitable handles
  returned from mount/remove APIs; both capture caller file/line via
  `_debug` for diagnostics.
- `rlock.RLock` is a re-entrant asyncio lock keyed on `current_task`.
- `_callback.invoke` adapts sync/async callables with variable arity and
  slow-callback logging.
- `_loop` supplies `loop_first` / `loop_last` / `loop_first_last` /
  `loop_from_index` iteration helpers.

## Collections, Caches, And Data Structures

Modules: `cache`, `_queue`, `_spatial_map`, `_immutable_sequence_view`,
`_two_way_dict`, `_partition`, `_binary_encode`.

- `cache.LRUCache` / `FIFOCache` are the canonical bounded-cache types
  used across rendering and matching.
- `_queue` is an async queue variant tuned for message-pump usage.
- `_spatial_map` indexes regions for fast compositor hit-testing.
- `_immutable_sequence_view` wraps a list with a read-only facade.
- `_two_way_dict.TwoWayDict` maintains a bidirectional key↔value map.
- `_partition.partition` splits an iterable into two lists by predicate.
- `_binary_encode` is a bencode-derived serializer for structured binary
  payloads (used by devtools/driver transport).

## DOM And Widget Helpers

Modules: `walk`, `_widget_navigation`, `getters`, `compose`, `containers`,
`case`, `_slug`.

- `walk.walk_depth_first` / `walk_breadth_first` drive DOM traversal
  (`DOMNode.query` is built on these).
- `_widget_navigation` handles index navigation over sequences with
  disabled entries (used by `OptionList`, `RadioSet`, etc.).
- `getters` exposes descriptors (`getters.app`, `getters.query_one`) that
  bind widget/app lookups as class-level properties.
- `compose.compose` implements the generator/function composition helper
  used by `App` / `Widget.compose`.
- `containers` defines the public container widgets.
- `case.camel_to_snake` normalizes class names to CSS/message identifiers.
- `_slug.slug` / `TrackedSlugs` generate Markdown-style anchor slugs with
  disambiguation.

## Environment, Feature, And I/O Helpers

Modules: `constants`, `features`, `_path`, `_files`, `lazy`,
`file_monitor`, `_context`, `_compat`.

- `constants` holds environment-sourced configuration, all env-var reads
  centralized here. // [LAW:single-enforcer] one place parses env vars.
- `features` parses `TEXTUAL_FEATURES` into feature flags.
- `_path` resolves CSS/asset paths relative to app modules.
- `_files.generate_datetime_filename` builds timestamped filenames.
- `lazy.Lazy` defers widget instantiation until first mount.
- `file_monitor` watches CSS files for live reload.
- `_context` owns the `active_app` / `active_message_pump` `ContextVar`s
  and `NoActiveAppError`. // [LAW:one-source-of-truth] context access is
  centralized.
- `_compat` backports `cached_property` generics for older Pythons.

## Logging And Diagnostics

Modules: `_log`, `logging`, `_profile`, `_debug`, `errors`.

- `_log` defines internal log group constants.
- `logging.TextualHandler` bridges stdlib logging into Textual's devtools
  sink.
- `_profile.timer` provides a lightweight timing context manager.
- `_debug.get_caller_file_and_line` captures call sites for async handles.
- `errors` defines `TextualError` and subclasses — the canonical exception
  taxonomy.

## Filters

Module: `filter`. `LineFilter` ABC plus concrete filters (`Monochrome`,
`NoColor`, `DimFilter`, `ANSIToTruecolor`) post-process segment streams for
accessibility/terminal compatibility. Applied as a single pipeline at the
compositor boundary. // [LAW:single-enforcer] filters apply at one seam.

## CLI, Import, And Documentation Surfaces

- `_import_app` resolves `module:App` specifiers into an `App` instance
  for the CLI/pilot.
- `__main__` is the package entrypoint running demo/playground apps.
- `_doc` drives Markdown SVG screenshot generation for the documentation
  build (runs apps under `Pilot`).

// [LAW:one-way-deps] Supporting modules expose reusable primitives
consumed by runtime/DOM/CSS/widget layers without inverting core
dependency direction.
