# textual.fuzzy

Fuzzy matcher used by the command palette to match search terms.

## FuzzySearch

`FuzzySearch` (`textual.fuzzy`) performs a fuzzy search. Unlike a regex solution, it finds all possible matches.

### Constructor

- `__init__(case_sensitive: bool = False, *, cache_size: int = 4096)` -- Initialize fuzzy search. `case_sensitive` controls whether matching is case-sensitive. `cache_size` sets the number of query results to cache.

### Instance Attributes

- `case_sensitive: bool` -- Whether matching is case-sensitive.
- `cache: LRUCache[tuple[str, str], tuple[float, Sequence[int]]]` -- LRU cache mapping `(query, candidate)` pairs to `(score, offsets)` results.

### Methods

- `match(query: str, candidate: str) -> tuple[float, Sequence[int]]` -- Match a candidate against a query. Returns a `(score, offsets)` tuple where `score` is a float (0 means no match) and `offsets` is a sequence of character positions that matched. Results are cached.
- `score(candidate: str, positions: Sequence[int]) -> float` -- Score a match based on the positions of matched characters. Boosts first-letter matches and contiguous groups. Uses a heuristic that favors fewer groups and word-boundary matches.

### Class Methods

- `get_first_letters(candidate: str) -> frozenset[int]` -- Return a frozenset of offsets where words start in the candidate string. Cached (LRU, 1024 entries).

### Match Algorithm

1. If the query is a direct substring of the candidate, the match is scored with a 2.0x bonus (exact match) or 1.5x bonus (substring match) and returned immediately.
2. Otherwise, for each character in the query, all positions in the candidate are found.
3. All valid ordered combinations of positions are generated recursively.
4. The combination with the highest score is returned.

## Matcher

`Matcher` (`textual.fuzzy`) is a higher-level fuzzy matcher that wraps `FuzzySearch` and provides highlighting.

### Constructor

- `__init__(query: str, *, match_style: Style | None = None, case_sensitive: bool = False)` -- Initialize the matcher. `query` is the search string. `match_style` is the style used to highlight matched portions (defaults to `Style(reverse=True)`). `case_sensitive` controls case sensitivity.

### Instance Attributes

- `fuzzy_search: FuzzySearch` -- The underlying `FuzzySearch` instance.

### Properties

- `query -> str` -- The query string to look for (read-only).
- `match_style -> Style` -- The style used to highlight hits in matched text (read-only).
- `case_sensitive -> bool` -- Whether matching is case-sensitive (read-only).

### Methods

- `match(candidate: str) -> float` -- Match a candidate string against the query. Returns a score from 0 (no match) upward; higher values indicate stronger matches.
- `highlight(candidate: str) -> Content` -- Highlight the candidate with the fuzzy match. Returns a `Content` instance with matched (non-whitespace) characters styled using `match_style`. If there is no match (score is 0), the content is returned unstyled.
