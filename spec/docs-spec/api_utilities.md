# Docs Spec: Utilities Index

## Purpose
Serve as an index/map to the canonical utility API doc pages, so readers can find the right page by topic without duplicating behavioral content here.

## Audience
All readers browsing the docs site looking for a utility module (geometry, color, cache, markup, validation, fuzzy matching, logging, timers, walk, etc.).

## Required sections
1. Overview (this is an index; details live in the canonical pages)
2. Table mapping each utility area to its canonical docs page
3. Resolution rule (update only the canonical spec; this file stays a map)

## Key concepts
- Single source of truth: every utility has exactly one canonical page — this index never duplicates its contract.
- Grouping utilities in one place helps new users discover what is available.

## Behaviors and contracts
- This page is intentionally thin. No API signatures, no option tables, no examples.
- Adding a new utility area means adding a row here plus producing the canonical page.

## Example requirements
No code examples on this page. Only link targets and short one-line summaries of each utility's purpose.

## Cross-references
Every utility page in `spec/docs-spec/`:
- `api_geometry.md`, `api_coordinate.md`, `api_map_geometry.md`
- `api_color.md`, `api_validation.md`, `api_cache.md`
- `api_markup.md`, `api_highlight.md`, `api_style.md`
- `api_fuzzy_matcher.md`, `api_suggester.md`, `api_filter.md`
- `api_logging.md`, `api_logger.md`
- `api_timer.md`, `api_walk.md`, `api_lazy.md`
- `api_await_complete.md`, `api_await_remove.md`
- `api_constants.md`, `api_errors.md`, `api_types.md`

## Notes for writers
- Resist the temptation to add inline signatures; it always drifts.
- If a utility listed in Python's `textual.cache` or similar has no direct JS equivalent (e.g., Python's LRU cache semantics), the canonical page — not this index — explains the substitution.
- Python-only rows that do not apply to textual-js should be removed from the table rather than ported hollowly.
