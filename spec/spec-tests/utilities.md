# Utilities

Textual provides a collection of internal utility modules for caching, text processing, data structures, and other common operations.

## LRU Cache and FIFO Cache

The `textual.cache` module provides two cache implementations: `LRUCache` and `FIFOCache`.

### LRUCache

- `LRUCache(maxsize)` creates a cache that evicts the least-recently-used entry when full.
- Supports dict-like access: `cache[key] = value`, `cache[key]`, `key in cache`.
- `cache.set(key, value)` is equivalent to `cache[key] = value`.
- `cache.get(key)` returns the value or `None` if absent (does not raise).
- Accessing a key promotes it to most-recently-used. When the cache is full, the least-recently-used key is evicted on insert.
- `cache.discard(key)` removes a key if present; no error if absent. After discard, the freed slot is available for new inserts without incorrect eviction ordering.
- `cache.clear()` empties the cache.
- `len(cache)` returns the current number of entries.
- An empty cache is falsy; a non-empty cache is truthy.
- `cache.keys()` returns the current keys in insertion/access order.
- `cache.maxsize` reports the maximum capacity and can be set to resize the cache. Inserts beyond maxsize evict oldest entries to maintain the size limit.
- `cache.hits` and `cache.misses` track access statistics. A successful `__getitem__` or `get` that finds a key increments hits; a miss (KeyError from `__getitem__` or `None` from `get`) increments misses.
- `str(cache)` produces a representation including size, maxsize, hits, and misses.

### FIFOCache

- `FIFOCache(maxsize)` creates a cache that evicts the oldest-inserted entry when full (first-in, first-out).
- Supports the same dict-like interface as `LRUCache`: `__getitem__`, `__setitem__`, `__contains__`, `get`, `keys`, `clear`, `len`, truthiness.
- Unlike `LRUCache`, accessing a key does NOT promote it; eviction order is strictly insertion order.
- Tracks `hits` and `misses` the same way as `LRUCache`.
- `str(cache)` produces a representation including maxsize, hits, and misses.

## Freeze

The `test_freeze` file is a regression test for app lifecycle (issue #1608), not a standalone utility module. It verifies that exceptions propagate correctly when an app is running under `run_test`.

## Fuzzy Matching

The `textual.fuzzy` module provides a `Matcher` class for fuzzy string matching.

### Matcher

- `Matcher(query)` creates a matcher for the given query string.
- `matcher.match(candidate)` returns a numeric score. A score of `0` means no match.
- Contiguous matches score higher than scattered matches: matching `"abc"` against `"foo abc bar"` scores higher than against `"fooa barc"`.
- Matches at the start of words (first-word boost) score higher: matching `"ss"` against `"Save Screenshot"` scores higher than against `"Show Keys abcde"`.
- `matcher.highlight(candidate)` returns a content object whose `.spans` attribute contains `Span` entries marking the matched character positions with a `Style(reverse=True)`. The query `"foo.bar"` treats `.` as a matchable character, not a separator.

## Slug Generation

The `textual._slug` module provides functions for generating URL-safe slugs.

### slug

- `slug(text)` converts text to a lowercase, URL-safe slug.
- Spaces become hyphens; multiple spaces produce multiple hyphens.
- Leading/trailing whitespace is stripped.
- ASCII punctuation is removed except for hyphens and underscores.
- Non-ASCII characters are percent-encoded (e.g., `"e"` with diaeresis becomes `%C3%AB`).
- Emoji characters are stripped entirely.

### TrackedSlugs

- `TrackedSlugs()` creates a tracker that ensures unique slugs by appending `-N` suffixes for duplicates.
- First occurrence: `tracker.slug("test")` returns `"test"`.
- Subsequent occurrences: `tracker.slug("test")` returns `"test-1"`, `"test-2"`, etc.
- Uniqueness tracking applies across all generated slugs, including those that collide after normalization (e.g., emoji-stripped variants).

### slug_for_tcss_id

- `slug_for_tcss_id(text)` produces a slug valid as a TCSS identifier.
- Empty string becomes `"_"`. A single space becomes `"-"`.
- Leading digits are prefixed with `"_"` (e.g., `"5"` becomes `"_5"`).
- Emoji codepoints are converted to their hex representation (e.g., a smiley becomes `"_1f642"`).
- German eszett (`"ss"`) is case-folded to `"ss"`.
- The result always passes `check_identifiers` validation.

## Spatial Map

The `textual._spatial_map` module provides `SpatialMap`, a grid-based spatial index for fast region queries.

### SpatialMap

- `SpatialMap(grid_width, grid_height)` creates a spatial map with the given cell dimensions.
- `spatial_map.insert(entries)` adds entries. Each entry is a tuple of `(region, offset, fixed_x, fixed_y, value)`. Items marked as fixed appear in all queries along their fixed axis.
- `spatial_map.get_values_in_region(region)` returns all values whose regions overlap the query region, maintaining insertion order and without duplicates. Fixed items appear in results for any region that spans their non-fixed axis.

## Loop Helpers

The `textual._loop` module provides iteration utilities that yield position metadata alongside values.

### loop_first

- `loop_first(iterable)` yields `(is_first, value)` tuples. The first item has `is_first=True`; all others have `False`.
- Empty iterables yield nothing.

### loop_last

- `loop_last(iterable)` yields `(is_last, value)` tuples. The final item has `is_last=True`; all others have `False`.

### loop_first_last

- `loop_first_last(iterable)` yields `(is_first, is_last, value)` tuples. First and last flags are independent; a single-element iterable would have both `True`.

### loop_from_index

- `loop_from_index(sequence, index)` yields `(index, value)` pairs starting from the element after the given index, wrapping around to cover all elements.
- `direction=-1` iterates backward, starting from the element before the given index and wrapping.
- `wrap=False` stops at the end of the sequence instead of wrapping around; it does not revisit the starting element.

## Duration Parsing

The `textual._duration` module parses time duration strings into seconds.

### _duration_as_seconds

- Bare numbers are treated as seconds: `"30"` returns `30.0`.
- The `s` suffix denotes seconds: `"0.5s"` returns `0.5`.
- The `ms` suffix denotes milliseconds: `"500ms"` returns `0.5`, `"30000ms"` returns `30.0`.
- Unrecognized suffixes raise `DurationParseError`.

## ETA Estimation

The `textual.eta` module provides `ETA`, a class for estimating time remaining based on progress samples.

### ETA

- `ETA(estimation_period, extrapolate_period)` creates an estimator. Optional parameters control how far back to look for speed estimation and how far into the future to extrapolate.
- `eta.add_sample(time, progress)` records a progress observation. An implicit initial sample of `(0, 0)` is present by default.
- `eta.first_sample` and `eta.last_sample` return the earliest and latest recorded samples.
- `eta.speed` returns the current progress rate, or `None` if insufficient data (fewer than two samples) or if progress has gone backward.
- When progress goes backward (e.g., a reset to `0.0`), `speed` returns `None` until a new forward sample establishes a positive rate.
- `eta.get_eta(current_time)` returns the estimated seconds remaining to reach progress `1.0`. The estimate updates with time up to `extrapolate_period` seconds after the last sample, then holds steady.
- `eta.reset()` clears all samples and restores the initial `(0, 0)` state.
- `eta._get_progress_at(time)` interpolates between the initial sample and the last sample and returns a `(time, progress)` tuple for any intermediate time. For example, with a sample at `(1, 2)` (time=1, progress=2), `_get_progress_at(0.1)` returns `(0.1, 0.2)` and `_get_progress_at(0)` returns `(0, 0)`.

## Immutable Sequence View

The `textual._immutable_sequence_view` module provides `ImmutableSequenceView`, a read-only wrapper around a sequence.

### ImmutableSequenceView

- `ImmutableSequenceView(source)` wraps an existing sequence.
- Supports `len()`, `bool()`, iteration, `in` containment, and `reversed()`.
- Indexing with integers and slices works: `view[0]`, `view[0:2]`.
- `view.index(value)` returns the index of the first occurrence; raises `ValueError` if not found.
- Assignment (`view[0] = x`), slice assignment (`view[0:3] = x`), and deletion (`del view[0]`) all raise `TypeError`.

## Partitioning

The `textual._partition` module provides a `partition` function that splits a sequence by a predicate.

### partition

- `partition(predicate, iterable)` returns a tuple of two lists: `(false_matches, true_matches)`.
- Items for which the predicate returns `False` go into the first list; items for which it returns `True` go into the second.
- Empty iterables produce two empty lists.
- The relative order of items within each list matches the original iterable.

## Path Utilities

The `textual.app.App` class resolves `CSS_PATH` attributes to absolute paths.

### CSS_PATH Resolution

- A relative path (string or `Path` object) is resolved relative to the directory containing the app's source file.
- An absolute path (string or `Path` object) is used as-is.
- A list of paths resolves each element independently: relative paths resolve against the app directory, absolute paths stay absolute.

## Text Wrapping

The `textual._wrap` module provides utilities for word-wrapping text.

### chunks

- `chunks(text)` splits text into `(start, end, substring)` tuples representing wrappable segments.
- Whitespace-only text produces a single chunk.
- Words followed by trailing whitespace are grouped together as one chunk.
- Tab characters form their own chunk or group with adjacent whitespace.
- Empty string produces no chunks.
- Wide (multi-cell) characters such as CJK ideographs are handled correctly: offsets in the output tuples are character indices, and wide characters in a segment are grouped with any immediately following tab and whitespace just as single-width characters are.

### compute_wrap_offsets

- `compute_wrap_offsets(text, width, tab_size)` returns a list of character offsets where the text should break to fit within the given display width.
- Tabs are expanded to their display width (controlled by `tab_size`) for width calculation.
- Whitespace-only or empty text produces no wrap offsets.
- Trailing tabs do not generate extra wrap points.

## Line Splitting

The `textual._line_split` module provides a `line_split` function for splitting text while preserving line endings.

### line_split

- `line_split(text)` returns a list of `(line, ending)` tuples.
- Recognizes `\r\n`, `\r`, and `\n` as line endings.
- A line with no trailing line ending has `""` as its ending.
- Empty string returns an empty list.
- Lines are split in order; the ending is whichever line terminator immediately follows the line content.

## Binary Encoding

The `textual._binary_encode` module provides `dump` and `load` functions for a compact binary serialization format.

### Supported Types

- `None`, `bool` (`True`/`False`), integers (positive and negative), strings, byte strings, lists, tuples, and dicts.
- Nested structures are supported: lists/tuples/dicts containing any of the above types.

### dump

- `dump(data)` serializes a supported value to `bytes`.
- Raises `TypeError` for unsupported types: `set`, `float`, `type` objects, `Ellipsis`, or containers holding unsupported types.

### load

- `load(data)` deserializes bytes produced by `dump` back to the original value.
- Round-trip fidelity: `load(dump(x)) == x` for all supported types.
- Raises `DecodeError` for malformed or truncated input.
- Raises `TypeError` if the argument is not `bytes` (e.g., `None` or `str`).

## Unicode Data

The `textual` project includes a unicode data test file, but it is currently empty and defines no tested behavior.

## Tab Expansion

The `textual.expand_tabs` module provides functions for expanding tab characters to spaces with correct alignment.

### expand_tabs_inline

- `expand_tabs_inline(line)` returns a new string with tabs replaced by spaces, aligned to tab stops every 4 columns.
- Tab width depends on the current column position: a tab at column 0 expands to 4 spaces, at column 1 to 3 spaces, etc.
- Wide characters (e.g., emoji with display width 2) are accounted for in column calculation. A tab after a double-width character expands to fewer spaces accordingly.

### get_tab_widths

- `get_tab_widths(text)` returns a list of `(segment, tab_width)` tuples, splitting the text at each tab.
- The first tuple's segment is the text before the first tab; its tab_width is the display width the tab would expand to.
- The last segment has a tab_width of `0` if the text does not end with a tab; if the text ends with a tab, the last tuple is `("", tab_width)` where tab_width reflects the expansion of the final tab.
- Multiple consecutive tabs each produce their own tuple; the empty-string segment between them carries the tab_width of the tab that follows it.
- Wide characters in segments affect the computed tab width of the following tab.

## Two-Way Dict

The `textual._two_way_dict` module provides `TwoWayDict`, a bidirectional mapping.

### TwoWayDict

- `TwoWayDict(mapping)` constructs a bidirectional dictionary from an initial mapping.
- `twd.get(key)` retrieves the value for a key, or `None` if absent.
- `twd.get_key(value)` performs reverse lookup: retrieves the key for a value, or `None` if absent.
- `twd[key] = value` inserts or updates an entry, making both forward and reverse lookups work immediately.
- `del twd[key]` removes the entry from both directions; subsequent `get` and `get_key` for the removed pair return `None`.
- `len(twd)` returns the number of entries.
- `key in twd` tests forward membership only (keys, not values).

## Count Parameters

The `textual._callback` module provides `count_parameters`, a function that determines the number of parameters a callable accepts.

### count_parameters

- `count_parameters(func)` returns the number of user-facing parameters the callable accepts.
- For plain functions: a 0-arg function returns 0, a 1-arg function returns 1, a 2-arg function returns 2.
- For bound methods: `self` is excluded from the count. A method with only `self` returns 0; a method with `self, a, b` returns 2.
- For `functools.partial` objects: already-bound positional and keyword arguments are subtracted from the count. A method with 4 parameters where 1 positional arg is bound returns 3; where 2 keyword args are bound returns 2.
- Results are cached: calling `count_parameters` on the same callable multiple times returns the same result efficiently.

## Getter Descriptors

The `textual.getters` module provides descriptor classes that offer type-safe, declarative widget querying as class attributes.

### query_one

- `getters.query_one(selector, type)` creates a descriptor that queries the DOM for a single widget matching the CSS selector with the expected type.
- Accessing the descriptor on a mounted app performs a `query_one` call. If the widget is found and matches the type, it is returned.
- If the widget is found but is the wrong type, accessing the descriptor raises `WrongType`.
- If no widget matches the selector, accessing the descriptor raises `NoMatches`.

### child_by_id

- `getters.child_by_id(id, type)` creates a descriptor that finds an immediate child by ID with type checking.
- If the child exists and matches the type, it is returned.
- If the child exists but is the wrong type, raises `WrongType`.
- If no child with that ID exists, raises `NoMatches`.

### app

- `getters.app(app_type)` creates a descriptor that provides typed access to the app instance.
- Accessing the descriptor returns the app, typed as the specified class. The app is accessible even during `compose()`, before the widget is fully mounted.

## Suggestions

The `textual.suggestions` module provides functions for finding close textual matches (used for "did you mean?" suggestions).

### get_suggestion

- `get_suggestion(word, possible_words)` returns the closest match from `possible_words`, or `None` if no close match exists.
- Exact matches are returned. Near-matches (small edit distance) are returned. Distant words return `None`.
- When multiple candidates are close, the closest match is returned.

### get_suggestions

- `get_suggestions(word, possible_words, count)` returns a list of up to `count` closest matches, ordered by closeness.
- If fewer than `count` candidates are close enough, fewer results are returned.
- Only genuinely close matches are included; distant words are excluded regardless of `count`.

## Logging

### Log Widget Line Processing

- `Log._process_line(line)` processes a log line for display.
- Tab characters are expanded to spaces (8-space tab stops).
- Null characters (`\0`) are replaced with the Unicode replacement character (`�`).

### Log Widget Initialization

- `Log(disabled=True)` can be instantiated and mounted without raising `AttributeError`. The `disabled` attribute is accessible on the mounted widget and reflects the value passed at construction.

### Logger

- Log calls from threaded workers (decorated with `@work(thread=True)`) are routed to `app._log`. The message arrives with the same arguments passed to `self.log()` in the worker.
- Logging from workers requires devtools to be connected (`_is_devtools_connected` returns `True`).

## Version

- `textual.__version__` is a string conforming to PEP 440 version format.
- The version string matches the standard pattern: optional epoch, release segment (dot-separated numbers), optional pre-release, post-release, dev release, and local version suffixes.

## Garbage Collection

- After an app exits and `gc.collect()` is called, all `DOMNode` instances created by the app are freed. No DOM nodes remain referenced after shutdown and garbage collection.
- This is a known fragile property: test frameworks (e.g., pytest) may hold references that prevent collection, so the test is marked as expected to fail (`xfail`) in the test suite.

## Demo App

- The `DemoApp` from `textual.demo.demo_app` can be instantiated and run under `run_test()` without error. This serves as a smoke test to catch regressions across Python versions.

## Pipe (Deadlock Prevention)

- When an app reads from stdin via a pipe (e.g., `echo q | python app.py`), it must exit cleanly without deadlocking. The app processes the piped input and terminates with return code 0.
- This is a regression test for issue #4643 and is only tested on non-Windows platforms.

## Windows Timer Cancellation

- On Windows, when an app creates a `set_interval` timer and then exits, the asyncio event loop must shut down promptly. The timer must be properly cancelled so that it does not keep the event loop alive.
- Specifically, an app with a 10-second interval timer that exits immediately must complete in under 1 second total wall time.
- This is a regression test for issue #2711 and only applies to Windows platforms.

## Constraints

- `LRUCache` and `FIFOCache` must never exceed their `maxsize`. After any insert, `len(cache) <= maxsize`.
- `LRUCache.discard` must maintain correct eviction ordering; subsequent inserts and evictions must behave as if the discarded key was never present.
- `LRUCache` access via `__getitem__` or `get` must promote the key for eviction-ordering purposes. `FIFOCache` access must NOT change eviction order.
- `Matcher.match` must return `0` for non-matching candidates, a positive score for matches, and must rank contiguous matches above scattered matches and first-word matches above later-word matches.
- `TrackedSlugs` must never produce duplicate slugs, even across inputs that normalize to the same base slug.
- `slug_for_tcss_id` output must always pass `check_identifiers` validation.
- `SpatialMap.get_values_in_region` must return values in insertion order with no duplicates, and must include fixed items in all matching queries.
- `partition` must preserve relative ordering within each partition list.
- `ImmutableSequenceView` must raise `TypeError` on any mutation attempt (item assignment, slice assignment, deletion).
- `dump`/`load` must round-trip all supported types exactly. `load` must reject malformed input with `DecodeError` and non-bytes input with `TypeError`. `dump` must reject unsupported types with `TypeError`.
- `expand_tabs_inline` must account for wide (double-width) characters when computing tab stop alignment.
- `TwoWayDict` deletion must remove the entry from both forward and reverse directions atomically.
- `line_split` must correctly distinguish `\r\n` (one ending) from `\r` followed by `\n` (two separate endings) depending on adjacency.
- `loop_from_index` with `wrap=False` must not revisit elements before the starting index.
- `ETA.speed` must return `None` when progress has gone backward, until a new forward sample is recorded.
- `ETA.get_eta` must stop updating the estimate after `extrapolate_period` seconds past the last sample.
- `count_parameters` must exclude `self` from bound methods and must subtract bound arguments from `functools.partial` objects.
- Getter descriptors must raise `WrongType` for type mismatches and `NoMatches` for missing widgets; they must never return `None` or a wrong-typed widget.
- `get_suggestion` must return `None` for distant words, never a poor match.
- `textual.__version__` must conform to PEP 440 format.
- After app shutdown and `gc.collect()`, no `DOMNode` instances should remain referenced (modulo test framework reference retention).
- Piped stdin must not cause deadlocks on app shutdown.
- Windows interval timers must be properly cancelled on app exit to avoid blocking the event loop.
