# Supporting Subsystems

This chapter surveys support modules used across runtime, DOM, CSS, widget, and I/O subsystems. Entries are terse by design — each module group states purpose and key invariants only.

## Themes and Design Tokens

Modules: `theme`, `design`, `color`, `_ansi_theme`, `_color_constants`.

- `Theme` dataclass defines app palette and optional variables; built-ins exposed via `BUILTIN_THEMES`.
- `Theme.to_color_system()` maps theme to `ColorSystem` generation pipeline feeding CSS variables.
- `color` owns the canonical `Color` value (RGB/A, HSL, blending, parsing); shared by CSS, styles, filters, renderables. // [LAW:one-source-of-truth] single color type for the whole stack.
- `_ansi_theme` holds ANSI 16-color palette mappings used when translating themed colors to terminal ANSI.
- `_color_constants` exposes the named CSS color table.

## Notifications

Module: `notifications`.

- `Notification` carries message/title/severity/timeout/markup metadata.
- `Notify` message transports notifications into the app event pipeline.
- `Notifications` collection manages active notifications and reaps expired entries lazily on access.
- Severity is constrained to `information`, `warning`, `error`.

## Validation Framework

Module: `validation`.

- `Validator` base class defines `validate` contract plus success/failure helpers.
- `ValidationResult` aggregates failures and supports merge.
- Built-ins: `Regex`, `Number`, `Integer`, `Length`, `Function`, `URL`.
- Consumed directly by `Input` and reusable at any string input boundary.

## Suggestions and Completion

Modules: `suggester`, `suggestions`, `fuzzy`.

- `Suggester` defines async `get_suggestion` contract with optional cache; `SuggestionReady` delivers results to requester nodes.
- `SuggestFromList` provides prefix completion over ordered candidates.
- `suggestions.get_suggestion(s)` wraps `difflib.get_close_matches` for "did you mean" style hints (used by DOM/CSS error messages).
- `fuzzy.FuzzySearch` powers command palette ranked matching with LRU caching and `Content`-aware highlighting.

## Content and Rendering Helpers

- Content primitives: `content`, `markup`, `style`, `visual`, `render`.
  - `render.measure` wraps Rich measurement with a console fallback.
  - `markup` parses the Textual markup dialect into `Content` spans.
  - `_markup_playground` is a developer tool app (demoable via `__main__`) for experimenting with markup.
- Renderables: `renderables/*` — `bar`, `blank`, `digits`, `gradient`, `sparkline`, `text_opacity`, `tint`, `background_screen`, `styled`, `_blend_colors`. Each is a Rich renderable used by widgets/compositor.
- Line, segment, and text utilities: `strip`, `_segment_tools`, `expand_tabs`, `_line_split`, `_wrap`, `pad` (`HorizontalPad` for aligned line padding), `_cells` (cell-length + column-index helpers backed by Rich's cached cell_len), `_opacity` (applies alpha blending to a segment stream), `highlight` (Pygments-backed syntax highlighting into `Content`).

## Geometry, Coordinates, and Types

Value modules:

- `geometry` — `Offset`, `Size`, `Region`, `Spacing`, `Shape`.
- `coordinate` — `(row, column)` pair used by tables/text area.
- `map_geometry` — `MapGeometry` absolute placement record used by the compositor.
- `box_model` — computed content/padding/border/margin box used by layout.
- `_extrema` — `Extrema` min/max dimensional clamp applied during resolve.
- `types` (public aliases), `_types` (internal protocols including `MessageTarget`/`EventTarget` and `UnusedParameter` sentinel), `_keyboard_protocol` (kitty keyboard protocol functional-key table).

## Animation and Timing

Modules: `_animator`, `_easing`, `_duration`, `clock`, `_time`, `_sleep`, `_win_sleep`, `_wait`.

- `_animator` owns app animation scheduling, `Animatable` protocol, `AnimationError`, and integrates with `Timer`.
- `_easing` provides the named easing function table (`EASING`, `DEFAULT_EASING`).
- `_duration` parses CSS durations (`"1s"`, `"500ms"`) with `DurationParseError`.
- `clock.Clock`/`MockClock` are the single timing authority for scheduling; tests inject `MockClock`. // [LAW:one-source-of-truth] one clock.
- `_time` centralizes `monotonic`/`sleep` imports so the rest of the codebase shares a single timing seam.
- `_sleep` + `_win_sleep` provide a high-resolution sleeper thread (Windows needs a dedicated path).
- `_wait.wait_for_idle` yields until the event loop is quiescent (test support).
- `eta.ETA` computes progress ETAs from sampled progress series (used by `ProgressBar`).

## Async Coordination

Modules: `await_complete`, `await_remove`, `rlock`, `_callback`, `_loop`.

- `AwaitComplete` / `AwaitRemove` are optionally-awaitable handles returned from mount/remove APIs so callers can `await` or fire-and-forget. Both capture caller file/line via `_debug` for diagnostics.
- `rlock.RLock` is a re-entrant asyncio lock keyed on `current_task`.
- `_callback.invoke` adapts sync/async callables with variable arity and slow-callback logging.
- `_loop` supplies `loop_first` / `loop_last` / `loop_first_last` / `loop_from_index` iteration helpers.

## Collections, Caches, and Data Structures

Modules: `cache`, `_node_list` (covered in DOM chapter — skipped), `_queue`, `_spatial_map`, `_immutable_sequence_view`, `_two_way_dict`, `_partition`, `_binary_encode`.

- `cache.LRUCache` / `FIFOCache` are the canonical bounded-cache types used across rendering and matching.
- `_queue` is an async queue variant tuned for message-pump usage.
- `_spatial_map` indexes regions for fast compositor hit-testing.
- `_immutable_sequence_view` wraps a list with a read-only facade.
- `_two_way_dict.TwoWayDict` maintains a bidirectional key↔value map.
- `_partition.partition` splits an iterable into two lists by predicate.
- `_binary_encode` is a bencode-derived serializer for structured binary payloads (used by devtools/driver transport).

## DOM and Widget Helpers

Modules: `walk`, `_widget_navigation`, `getters`, `compose`, `containers`, `case`, `_slug`.

- `walk.walk_depth_first` / `walk_breadth_first` drive DOM traversal (`DOMNode.query` is built on these).
- `_widget_navigation` handles index navigation over sequences with disabled entries (used by `OptionList`, `RadioSet`, etc.) where `%` wrapping is insufficient.
- `getters` exposes descriptors (`getters.app`, `getters.query_one`) that bind widget/app lookups as class-level properties.
- `compose.compose` implements the generator/function composition helper used by `App`/`Widget.compose`.
- `containers` defines the public container widgets (`Container`, `ScrollableContainer`, `Horizontal`, `Vertical`, `Grid`, `Center`, `Middle`, …).
- `case.camel_to_snake` normalizes class names to CSS/message identifiers.
- `_slug.slug` / `TrackedSlugs` generate Markdown-style anchor slugs with disambiguation.

## Environment, Feature, and I/O Helpers

Modules: `constants`, `features`, `_path`, `_files`, `lazy`, `file_monitor`, `_context`, `_compat`.

- `constants` holds environment-sourced configuration (all reads centralized here). // [LAW:single-enforcer] one place parses env vars.
- `features` parses `TEXTUAL_FEATURES` into feature flags (debug, devtools, …).
- `_path` resolves CSS/asset paths relative to app modules.
- `_files.generate_datetime_filename` builds timestamped filenames (screenshots/exports).
- `lazy.Lazy` defers widget instantiation until first mount.
- `file_monitor` watches CSS files for live reload.
- `_context` owns the `active_app` / `active_message_pump` `ContextVar`s and `NoActiveAppError`. // [LAW:one-source-of-truth] context access is centralized.
- `_compat` backports `cached_property` generics for older Pythons.

## Logging and Diagnostics

Modules: `_log`, `logging`, `_profile`, `_debug`, `errors`.

- `_log` defines internal log group constants.
- `logging.TextualHandler` bridges stdlib logging into Textual's devtools sink.
- `_profile.timer` provides a lightweight timing context manager.
- `_debug.get_caller_file_and_line` captures call sites for async handles.
- `errors` defines `TextualError` and subclasses (`NoWidget`, `RenderError`, `DuplicateKeyHandlers`, …) — the canonical exception taxonomy.

## Filters

Module: `filter`.

- `LineFilter` ABC plus concrete filters (`Monochrome`, `NoColor`, `DimFilter`, `ANSIToTruecolor`) post-process segment streams for accessibility/terminal compatibility. Applied as a single pipeline at the compositor boundary. // [LAW:single-enforcer] filters apply at one seam.

## CLI, Import, and Documentation Surfaces

- `_import_app` resolves `module:App` specifiers into an `App` instance for the CLI/pilot.
- `__main__` is the package entrypoint running demo/playground apps.
- `_doc` drives Markdown SVG screenshot generation used by the documentation build (runs apps under `Pilot`).
- Test-driving APIs are documented in `13-testability-and-automation-surfaces.md`.

// [LAW:one-way-deps] Supporting modules expose reusable primitives consumed by runtime/DOM/CSS/widget layers without inverting core dependency direction.
