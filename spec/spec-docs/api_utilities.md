# API Utilities Index

This file is an index for utility-oriented APIs.

It intentionally delegates behavioral contracts to dedicated API spec files so each API concept has one canonical definition.

## Canonical Utility API Specs

| Utility Area | Canonical Spec |
|---|---|
| Geometry (`textual.geometry`) | `spec/api_geometry.md` |
| Coordinate (`textual.coordinate`) | `spec/api_coordinate.md` |
| Map geometry (`textual.map_geometry`) | `spec/api_map_geometry.md` |
| Color (`textual.color`) | `spec/api_color.md` |
| Validation (`textual.validation`) | `spec/api_validation.md` |
| Cache (`textual.cache`) | `spec/api_cache.md` |
| Markup (`textual.markup`) | `spec/api_markup.md` |
| Highlighting (`textual.highlight`) | `spec/api_highlight.md` |
| Style object (`textual.style`) | `spec/api_style.md` |
| Fuzzy matching (`textual.fuzzy`) | `spec/api_fuzzy_matcher.md` |
| Suggesters (`textual.suggester`) | `spec/api_suggester.md` |
| Filters (`textual.filter`) | `spec/api_filter.md` |
| Logging (`textual.logging`, `textual.logger`) | `spec/api_logging.md`, `spec/api_logger.md` |
| Timer (`textual.timer`) | `spec/api_timer.md` |
| DOM walking (`textual.walk`) | `spec/api_walk.md` |
| Lazy mounting (`textual.lazy`) | `spec/api_lazy.md` |
| Async helpers (`textual.await_complete`, `textual.await_remove`) | `spec/api_await_complete.md`, `spec/api_await_remove.md` |
| Constants (`textual.constants`) | `spec/api_constants.md` |
| Error hierarchy (`textual.errors`) | `spec/api_errors.md` |
| Shared type exports (`textual.types`) | `spec/api_types.md` |

## Resolution Rule

For any utility API listed above:

1. Update only the canonical spec file(s).
2. Keep this file as a map/index.
3. Do not duplicate signatures, defaults, or behavior details here.
