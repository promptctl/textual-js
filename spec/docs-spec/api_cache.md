# Docs Spec: API — Cache Containers

## Purpose
Describes the API reference doc for the cache module, which provides dictionary-like cache containers used internally to memoize expensive operations (rendering, layout, measurement).

## Audience
Framework extenders and widget authors implementing their own expensive-to-compute state who want a bounded cache with a clear eviction policy.

## Required sections
1. Overview: what the cache module provides and when to reach for it.
2. Choosing between the two cache policies (least-recently-used vs. first-in-first-out) and the performance/usage tradeoffs.
3. LRU cache: construction, maxsize, hit/miss counters.
4. LRU cache operations: get with default, get-or-throw (bracket access), set (direct and bracket), contains, discard, clear, keys listing.
5. LRU cache sizing: growing the maxsize without shrinking.
6. LRU cache container semantics: length, truthiness, membership testing, bracket get/set.
7. FIFO cache: construction, maxsize, hit/miss counters, and the same container surface as the LRU cache.
8. Differences in eviction between the two caches (eviction chosen by recency vs. insertion order).

## Key concepts
- Both caches are bounded by a maximum size; exceeding the size evicts entries per the policy.
- Accessing an LRU cache entry promotes it to most-recently-used; accessing a FIFO cache entry does not change eviction order.
- Hit/miss counters are observable for instrumentation.
- Cache objects are container-like (support length, membership, bracket access) so they compose with JS patterns the same way a Map would.

## Behaviors and contracts
- A bracket-get for a missing key must throw (analogous to Python's `KeyError`); a `.get(key, default)` variant must return the default instead.
- Setting a key when the cache is full evicts exactly one entry, chosen by the cache's policy.
- An LRU `get` promotes the key; repeated gets keep a key warm.
- `grow(maxsize)` only increases capacity; it never shrinks.
- `discard` is a no-op when the key is absent.
- Clear empties the cache but does not reset hit/miss counters unless documented otherwise.

## Example requirements
All examples must be JSX/TypeScript using Ink primitives and textual-js APIs:
- Creating an LRU cache to memoize a render helper and warming it.
- Demonstrating the promotion effect (earlier keys surviving when later keys are read).
- Creating a FIFO cache and showing that the earliest inserted key is evicted on overflow.
- Growing the cache to handle a larger working set.
- Observing hit and miss counters.

## Cross-references
- `spec/spec-src/12-supporting-subsystems.md` (where caches are used by the framework).
- `spec/spec-src/05-layout-render-and-compositor.md` (render/measurement memoization).

## Notes for writers
- Python specifics to drop: `Generic[CacheKey, CacheValue]`, `functools.lru_cache`, `KeysView`. Use TS generics (`LRUCache<K, V>`) and return a `MapIterator<K>` or `Iterable<K>` for `keys()`.
- The Python guidance "prefer `functools.lru_cache` for fast ops" does not translate; substitute with JS guidance (e.g., "for very hot paths, a plain Map plus your own eviction may outperform"), or simply omit this guidance.
- Bracket-access semantics map to indexer-style TS API if implemented (proxy or `.get`/`.set` methods); document whichever the library actually exposes.
- Hit/miss counters are plain numbers in both languages; no translation needed.
