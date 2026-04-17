# Docs Spec: Fuzzy Matcher

## Purpose
Document the fuzzy search primitives used by the command palette (and available to app authors) for ranking and highlighting candidate strings against a query.

## Audience
Widget and app authors building search-like UIs (command palettes, filter boxes, pickers) and extenders customizing command palette scoring.

## Required sections
1. Overview: textual-js uses uFuzzy under the hood; this module exposes a thin wrapper with framework-specific conventions (score + match offsets + highlighted `Content`).
2. Low-level matcher (`FuzzySearch`):
   - Constructor options: `caseSensitive`, `cacheSize` (LRU).
   - `match(query, candidate)` returns `{ score, offsets }`; `score === 0` means no match.
   - `score(candidate, positions)` manual scoring for a known set of match positions.
   - `getFirstLetters(candidate)` helper returning word-start offsets (cached).
   - Documented scoring heuristics (direct substring bonus, word-boundary bonus, contiguous-group bonus, penalty for more groups).
3. High-level matcher (`Matcher`):
   - Constructor: `query`, `matchStyle` (default reverse), `caseSensitive`.
   - `match(candidate)` returns a score.
   - `highlight(candidate)` returns `Content` with matched (non-whitespace) positions styled.
   - Read-only properties: `query`, `matchStyle`, `caseSensitive`.
4. Integration with the command palette: why the palette uses `Matcher` and what behavior users can expect.
5. Performance: caching strategy and cache size tuning.

## Known divergence — fuzzy matching engine
Upstream Textual uses a custom Python fuzzy matcher with its own scoring heuristics. textual-js uses uFuzzy, a JS-native fuzzy search library. The scoring algorithms differ — matching behavior (which candidates match, relative ranking) will not be identical to upstream. This is a deliberate divergence: uFuzzy provides better JS ecosystem integration and performance characteristics. Tests should assert behavioral contracts (matches found, highlights applied, scores rank correctly) rather than expecting score-for-score parity with upstream.

## Key concepts
- Score magnitude is informational, not a fixed scale; rank by comparing scores, not by thresholding an absolute number.
- Direct substring hits are fast-pathed and get a meaningful bonus (exact vs. substring).
- Offsets are character indexes into the candidate string.
- Highlighting returns `Content` so callers can render styled results without additional work.
- uFuzzy (or the framework's replacement) handles the actual pattern matching; the thin wrapper normalizes inputs/outputs.

## Behaviors and contracts
- `match` returns `{ score: 0, offsets: [] }` for no match.
- `match` results are cached by `(query, candidate)`.
- `highlight` leaves content unstyled when there is no match.
- Whitespace characters within matched offsets are not styled (so long matches look clean).
- `Matcher` properties are read-only after construction.
- Case sensitivity applies uniformly to matching and highlighting.

## Example requirements
- A TS snippet scoring a list of candidates and sorting by score.
- A snippet rendering a list item that shows highlighted matches using the `Content` output from `Matcher.highlight`.
- A snippet demonstrating the command palette using `Matcher` to display results.

## Cross-references
- `spec/docs-spec/api_command.md` (command palette consumer).
- `spec/docs-spec/api_content.md` (`Content` output type of `highlight`).
- `spec/docs-spec/api_cache.md` (LRU cache used internally).
- `spec/spec-src/10-widget-catalog.md` (command palette widget).

## Notes for writers
- Do not document the Python recursive offset-combination algorithm as a user contract; it is implementation detail. Document the inputs/outputs and scoring factors only.
- Do not claim parity with any Python-only behavior that uFuzzy does not replicate — test and document what textual-js actually produces.
- The caching keyspace can grow if queries vary wildly; mention `cacheSize` tuning for large datasets.
- Do not reference Rich `Style`; use the framework's `Style` type.
