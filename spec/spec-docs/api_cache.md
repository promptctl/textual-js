# textual.cache

The `textual.cache` module provides dict-like cache containers used to avoid recalculating expensive operations such as rendering. Two cache classes are exported: `LRUCache` and `FIFOCache`.

## `LRUCache` Class

```python
class LRUCache(Generic[CacheKey, CacheValue])
```

A dictionary-like container with a maximum size that evicts the **least recently used** key when full. Implemented as a doubly linked list to track access order.

Use `LRUCache` when you want flexibility and are caching slow operations where cache overhead is a small fraction of total processing time. For caching fast operations called many times, prefer `functools.lru_cache` (implemented in C, faster overhead).

### Constructor

```python
LRUCache(maxsize: int)
```

| Parameter | Type | Description |
|---|---|---|
| `maxsize` | `int` | Maximum number of entries before old items are evicted. |

### Properties

| Property | Type | Description |
|---|---|---|
| `maxsize` | `int` | Maximum size of the cache. Readable and writable. |

### Attributes

| Attribute | Type | Description |
|---|---|---|
| `hits` | `int` | Number of cache hits. |
| `misses` | `int` | Number of cache misses. |

### Methods

#### `set(key, value) -> None`

Set a value in the cache. Also available via `cache[key] = value`.

| Parameter | Type | Description |
|---|---|---|
| `key` | `CacheKey` | The cache key. |
| `value` | `CacheValue` | The value to store. |

If the cache is full, the least recently used entry is evicted.

#### `get(key, default=None) -> CacheValue | DefaultValue | None`

Get a value from the cache. Returns `default` if the key is not present. Accessing a key promotes it to most-recently-used.

| Parameter | Type | Description |
|---|---|---|
| `key` | `CacheKey` | The cache key. |
| `default` | `DefaultValue \| None` | Value to return if key is absent. Default: `None`. |

#### `__getitem__(key) -> CacheValue`

Get a value by key. Raises `KeyError` if not present. Promotes the key to most-recently-used on access.

#### `__contains__(key) -> bool`

Test whether a key is in the cache.

#### `grow(maxsize) -> None`

Grow the maximum size to at least `maxsize` elements. Only increases the size; never shrinks.

| Parameter | Type | Description |
|---|---|---|
| `maxsize` | `int` | New minimum maximum size. |

#### `clear() -> None`

Clear all entries from the cache.

#### `keys() -> KeysView[CacheKey]`

Return the cache keys as a `KeysView`.

#### `discard(key) -> None`

Remove an item from the cache by key. No-op if the key is not present.

| Parameter | Type | Description |
|---|---|---|
| `key` | `CacheKey` | The key to discard. |

### Container Protocol

| Operation | Description |
|---|---|
| `len(cache)` | Returns the number of entries in the cache. |
| `bool(cache)` | Returns `True` if the cache is non-empty. |
| `key in cache` | Tests whether a key exists in the cache. |
| `cache[key]` | Gets a value; raises `KeyError` if absent. |
| `cache[key] = value` | Sets a value (alias for `set`). |

---

## `FIFOCache` Class

```python
class FIFOCache(Generic[CacheKey, CacheValue])
```

A simple cache that evicts the **first added** key when full (First In, First Out). Lower overhead than `LRUCache` but does not manage a working set as efficiently. Most suitable for caches with a relatively low maximum size that do not perform many lookups.

### Constructor

```python
FIFOCache(maxsize: int)
```

| Parameter | Type | Description |
|---|---|---|
| `maxsize` | `int` | Maximum number of entries before the oldest is discarded. |

### Attributes

| Attribute | Type | Description |
|---|---|---|
| `hits` | `int` | Number of cache hits. |
| `misses` | `int` | Number of cache misses. |

### Methods

#### `set(key, value) -> None`

Set a value in the cache. Also available via `cache[key] = value`.

| Parameter | Type | Description |
|---|---|---|
| `key` | `CacheKey` | The cache key. |
| `value` | `CacheValue` | The value to store. |

If the cache is at capacity and the key is new, the oldest entry is evicted.

#### `get(key, default=None) -> CacheValue | DefaultValue | None`

Get a value from the cache. Returns `default` if the key is not present.

| Parameter | Type | Description |
|---|---|---|
| `key` | `CacheKey` | The cache key. |
| `default` | `DefaultValue \| None` | Value to return if key is absent. Default: `None`. |

#### `__getitem__(key) -> CacheValue`

Get a value by key. Raises `KeyError` if not present.

#### `__contains__(key) -> bool`

Test whether a key is in the cache.

#### `clear() -> None`

Clear all entries from the cache.

#### `keys() -> KeysView[CacheKey]`

Return the cache keys as a `KeysView`.

### Container Protocol

| Operation | Description |
|---|---|
| `len(cache)` | Returns the number of entries in the cache. |
| `bool(cache)` | Returns `True` if the cache is non-empty. |
| `key in cache` | Tests whether a key exists in the cache. |
| `cache[key]` | Gets a value; raises `KeyError` if absent. |
| `cache[key] = value` | Sets a value (alias for `set`). |
