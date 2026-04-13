# Suggester

## Overview

**Module:** `textual.suggester`

Provides the auto-completion suggestion system used by the `Input` widget. The module defines an abstract base class `Suggester` for implementing custom suggestion logic, a concrete `SuggestFromList` implementation, and the `SuggestionReady` message used to deliver results.

---

## `SuggestionReady`

A `Message` dataclass sent when a completion suggestion is ready.

### Fields

| Field | Type | Description |
|---|---|---|
| `value` | `str` | The input value that the suggestion was generated for. |
| `suggestion` | `str` | The suggested completion string. |

---

## `Suggester`

Abstract base class defining how widgets generate completion suggestions.

### Constructor

| Parameter | Type | Default | Description |
|---|---|---|---|
| `use_cache` | `bool` | `True` | Whether to cache suggestion results in an LRU cache (1024 entries). |
| `case_sensitive` | `bool` | `False` | Whether suggestions are case sensitive. When `False`, input values are casefolded before lookup. |

### Attributes

| Attribute | Type | Description |
|---|---|---|
| `cache` | `LRUCache[str, str \| None] \| None` | The suggestion cache. `None` if caching is disabled. |
| `case_sensitive` | `bool` | Whether matching is case sensitive. |

### Abstract Methods

#### `async get_suggestion(value) -> str | None`

Must be implemented by subclasses. Returns a completion suggestion for the given value, or `None` if no suggestion is available.

| Parameter | Type | Description |
|---|---|---|
| `value` | `str` | The current input value. Already casefolded if `case_sensitive` is `False`. |

**Returns:** `str | None`

**Notes:**
- Non-deterministic implementations should disable caching (`use_cache=False`).

### Internal Methods

#### `async _get_suggestion(requester, value)`

Called by widgets to obtain suggestions. Normalizes the value (casefolding if not case sensitive), checks the cache, calls `get_suggestion` if needed, caches the result, and posts a `SuggestionReady` message to the requester if a suggestion is found.

| Parameter | Type | Description |
|---|---|---|
| `requester` | `DOMNode` | The widget requesting the suggestion. Receives the `SuggestionReady` message. |
| `value` | `str` | The raw input value. |

---

## `SuggestFromList`

A concrete `Suggester` that provides completions from a fixed list of strings.

### Constructor

| Parameter | Type | Default | Description |
|---|---|---|---|
| `suggestions` | `Iterable[str]` | *(required)* | Valid suggestions sorted by decreasing priority. The first match wins. |
| `case_sensitive` | `bool` | `True` | Whether matching is case sensitive. Note: default differs from base class (`True` here vs `False` in `Suggester`). |

The suggestions are materialized to a list on construction. When case insensitive, a parallel list of casefolded values is created for comparison while preserving the original casing for the returned suggestion.

### Methods

#### `async get_suggestion(value) -> str | None`

Returns the first suggestion whose (possibly casefolded) text starts with the given value.

| Parameter | Type | Description |
|---|---|---|
| `value` | `str` | The current value to match against (already casefolded if case insensitive). |

**Returns:** The original-cased suggestion string, or `None` if no match.

---

## Usage Pattern

```
suggester = SuggestFromList(["Portugal", "Spain", "France"], case_sensitive=False)
input_widget = Input(suggester=suggester)
```

The `Input` widget calls `suggester._get_suggestion(self, current_value)`. If a match is found, a `SuggestionReady` message is posted back to the input widget.
