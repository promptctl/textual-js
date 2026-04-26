# Docs Spec: Line Filters

## Purpose
Document the line-filter pipeline that transforms rendered terminal output (color/style) before it reaches the terminal — used primarily for monochrome, no-color, dim-rewrite, and ANSI-to-truecolor conversions.

## Audience
Framework extenders and advanced app authors. Most app authors will not use this API directly; the framework activates filters automatically based on environment (e.g., `NO_COLOR`).

## Required sections
1. Overview: filters receive the rendered segment stream and an inherited background color, and return a transformed segment stream. They run after rendering, before terminal write-out.
2. Applicability note: most users should rely on the framework's built-in filter activation rather than instantiating filters themselves.
3. `LineFilter` base: `enabled` flag, abstract `apply(segments, background)` contract.
4. Built-in filters:
   - `Monochrome` — replaces all colors with monochrome equivalents.
   - `NoColor` — removes all color information, leaving default foreground/background.
   - `DimFilter` — replaces the dim style attribute with a blended foreground color; `dimFactor` controls blend (0 = invisible, 1.0 = no change).
   - `ANSIToTruecolor` — resolves ANSI color indexes to truecolor using a terminal theme; handles dim by blending; caches results.
5. Module-level helpers and cached utilities: `monochromeStyle(style)`, `dimColor(background, color, factor)`, `dimStyle(style, background, factor)`.
6. Module-level constants: `NO_DIM` (a `Style` that strips dim), `DEFAULT_COLOR` fallback.
7. How filters are composed in the render pipeline.

## Key concepts
- Filters operate on segments (the framework's internal Ink-compatible cell runs), not on widget state.
- Filter `enabled` is a runtime toggle so filters can stay in the pipeline but no-op.
- `NO_COLOR` env var → `NoColor` filter activated automatically.
- Caching (LRU) is used for hot paths (style conversions).
- `ANSIToTruecolor` needs a terminal theme because ANSI indexes have no fixed RGB mapping.

## Behaviors and contracts
- `apply` returns a new segment list; filters do not mutate the input.
- Disabled filters pass segments through unchanged (guaranteed).
- `Monochrome` replaces both foreground and background color info.
- `NoColor` forces foreground and background to terminal defaults.
- `DimFilter` only touches segments whose style has `dim=true`; all others pass through unchanged.
- `ANSIToTruecolor` converts dim by blending, also handling system color references.

## Example requirements
- A TS snippet for an advanced extender installing a custom filter.
- A snippet demonstrating env-gated activation of `NoColor`.
- A note about how to run the test suite with monochrome output for snapshot stability.

## Cross-references
- `spec/docs-spec/api_constants.md` (`NO_COLOR` env semantics; `DIM_FACTOR` constant).
- `spec/docs-spec/api_color.md` (color model filters operate on).
- `spec/docs-spec/api_strip.md` (strip/segment abstraction filters consume).
- `spec/spec-src/08-drivers-io-and-platform-behavior.md` (driver pipeline / Ink output).
- `spec/spec-src/14-renderer-integration-seams.md` (where filters plug in).

## Notes for writers
- Do not describe Rich `Segment`, Rich `Style`, or Rich `TerminalTheme` as public types; refer to the textual-js equivalents passed through to Ink.
- Do not show Python ABC (`abstractmethod`) syntax; describe the contract as "subclasses must implement `apply`."
- The Python LRU cache decorator is an implementation detail; users only need to know that conversions are fast/cached.
- Many app authors will not touch this API directly — keep the doc utilitarian; highlight the "NO_COLOR just works" path first.
- Ink handles most color-capability detection; note that filters complement (not replace) that detection.
