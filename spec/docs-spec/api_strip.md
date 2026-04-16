# Docs Spec: Strip (Rendered-Line Primitive)

## Purpose
Document the Strip data structure — the immutable, cacheable representation of a single rendered line of widget output — plus the helper renderable that renders a sequence of strips and the module-level line-length helper. This is the core primitive that Line API widgets produce and that the compositor composes.

## Audience
Authors of custom Line API widgets (log views, text areas, tables) who must produce per-line rendered output; framework maintainers working on the compositor.

## Required sections
1. Overview — what a strip is, why it is immutable, how caching works.
2. `getLineLength(segments)` helper — total cell width of a segment sequence, excluding control segments.
3. `StripRenderable` — wraps a list of strips as a multi-line renderable; measurement.
4. `Strip` constructor — segments + optional precomputed cell length.
5. Properties — `cellLength`, `cellCount`, `text`, `linkIds`.
6. Iteration and equality operators — truthiness, iteration forward/reverse, length (segment count), equality, indexing (integer and slice), concatenation.
7. Static constructors — `Strip.blank(cellLength, style?)`, `Strip.fromLines(lines, cellLength?)`, `Strip.join(strips)`, `Strip.align(strips, style, width, height, horizontal, vertical)`.
8. ANSI rendering helpers — `Strip.renderAnsi(style, colorSystem)`, `Strip.renderStyle(style, text, colorSystem)`.
9. Instance methods — `indexToCellPosition`, `extendCellLength`, `adjustCellLength`, `simplify`, `discardMeta`, `applyFilter`, `styleLinks`, `cropExtend`, `crop`, `divide`, `applyStyle`, `applyMeta`, `render`, `cropPad`, `textAlign`, `applyOffsets`.
10. Caching strategy — per-instance FIFO caches, class-level LRU caches, and what keys each caches on.

## Key concepts
- A strip is immutable; methods return new strips rather than mutating.
- Segments combine text and a style; a strip's `text` is the raw text, `cellLength` is terminal cell width (respecting wide characters), and `cellCount` is the raw character count.
- Strips can carry meta (per-segment arbitrary data) used for click routing (via actions) and text-selection offsets.
- `Strip.blank(n, style)` returns an n-wide space-filled strip; heavily LRU-cached.
- `Strip.align` produces blank-padded strips for horizontal alignment within a width and optionally vertical alignment within a height.
- `cropPad` and `textAlign` are convenience operations for common widget-rendering shapes.
- `applyOffsets(x, y)` tags every segment with `(x + segmentTextOffset, y)` meta used by the framework for text-selection and coordinate lookup.
- Caching is aggressive: each instance owns independent FIFO caches for common operations (divide, crop, style, filter, line-length extension, crop-extend, offsets) and class-level LRU caches for blanks and ANSI rendering.

## Behaviors and contracts
- Constructing a strip materializes the segment iterable into a list; subsequent iteration is over the materialized list.
- `cellLength` is computed lazily on first access and cached on the instance.
- Index access (`strip[i]`, `strip[a:b]`) delegates to `crop` and returns a new strip.
- `strip + other` delegates to `Strip.join`.
- `Strip.join(strips)` filters out nulls and empty strips; if every joined strip has a cached render, the joined strip preserves the render cache.
- `Strip.blank` is LRU-cached up to 1024 entries keyed by `(cellLength, style)`.
- `Strip.align` yields strips padded for horizontal alignment and blank-line-padded for vertical alignment when a height is provided.
- `renderAnsi` is LRU-cached up to 16384 entries, producing the SGR parameter string for a given style and color system.
- `renderStyle` produces styled text including hyperlink-escape encoding where `_link_id` meta is present.
- `indexToCellPosition(i)` sums cell widths of the first `i` characters.
- `extendCellLength(n, style?)` returns self if already ≥ n, otherwise pads with styled spaces.
- `adjustCellLength(n, style?)` pads or truncates to exactly `n` cells (FIFO-cached).
- `simplify()` merges adjacent same-styled segments.
- `discardMeta()` strips per-segment meta.
- `applyFilter(filter, background)` runs every segment through a line-filter (FIFO-cached by filter+background).
- `styleLinks(linkId, style)` restyles segments whose link id matches; no-op if absent.
- `cropExtend(start, end, style)` crops, auto-extending the strip first if needed; FIFO-cached.
- `crop(start, end?)` crops by cell range; returns self if the range is the full strip; returns empty if `end <= start`; FIFO-cached.
- `divide(cuts)` returns a sequence of strips split at the given cell positions; FIFO-cached.
- `applyStyle(style)` applies a style to every segment; FIFO-cached.
- `applyMeta(meta)` converts meta into a style and applies it.
- `render(console)` returns the terminal escape sequence string; cached on the instance.
- `cropPad(cellLength, left, right, style)` adjusts length then adds padding segments.
- `textAlign(width, align)` aligns via left/center/right padding using null-style spaces.
- `applyOffsets(x, y)` tags each segment's meta with its absolute offset; preserves the existing render cache; FIFO-cached.

## Example requirements
JSX/TypeScript examples. Include at minimum:
- Building a Line API widget's `renderLine(y)` that returns a Strip composed of segments.
- Using `Strip.blank` to pad empty lines.
- Using `crop` / `cropPad` to produce a viewport-sized line from a larger logical line.
- Using `Strip.join` to concatenate a gutter and content portion.
- Using `Strip.align` to center a block of strips in a larger region.
- Applying a style to an existing strip with `applyStyle`.
- Adding click-target meta to segments via `applyMeta` so clicks route to an action.

## Cross-references
- `api_widget.md` in `spec/docs-spec/` — the widget-level per-line render hook that returns strips.
- `api_scroll_view.md` in `spec/docs-spec/` — Line API base class that orchestrates strip production.
- `api_style.md` / `api_color.md` in `spec/docs-spec/` — style and color types used in segments.
- `api_filter.md` in `spec/docs-spec/` — the filter types consumed by `applyFilter`.
- `api_renderables.md` in `spec/docs-spec/` — higher-level visual primitives whose output is ultimately realized as strips.
- `spec/spec-src/05-layout-render-and-compositor.md` — compositor's use of strips.
- `spec/spec-src/14-renderer-integration-seams.md` — how strips are translated for Ink output.

## Notes for writers
- Do not mention Rich `Segment` by that name as a user-facing type. The JS port uses a segment concept (text + style + optional meta); describe it as "the framework's segment type" and reference the types module. The source's `get_line_length` / "control segments" detail refers to Rich's no-cell-width segments; the JS equivalent is described as "non-visible control segments" without naming the Python library.
- Do not document `__rich_console__` / `__rich_measure__` as user-facing; describe `StripRenderable` as the canonical renderable that emits strips and provides a measurement.
- Caching details are important for performance-conscious authors but should not be surfaced as a stable API. Document the caches in a single "performance notes" subsection so authors understand that repeated identical operations are cheap but should not rely on specific cache sizes.
- "Color system" (used by `renderAnsi` / `renderStyle`) maps to the terminal capability level (truecolor / 256 / 16). The JS port exposes this via the driver; describe it as "the terminal's color capability" and link to the driver docs.
- `Segments` (plural, from Rich) does not exist in the JS port. The scrollbar and other internal renderables produce strips or the framework's segment sequences directly.
- Emphasize immutability throughout — many strip methods read like mutators but all return new instances.
