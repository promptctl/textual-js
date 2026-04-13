# Suggester

The Suggester system provides type-ahead suggestions for text input. A `Suggester` is an async object that, given a partial input value, returns a completion string. Suggesters integrate with the `Input` widget to display and accept suggestions as the user types.

## Suggester Base Class

### `get_suggestion` Method

Custom suggesters subclass `Suggester` and implement the async `get_suggestion(value: str)` method. The method receives the current input value and returns either a suggestion string or `None` if no suggestion applies.

```python
class FillSuggester(Suggester):
    async def get_suggestion(self, value: str):
        if len(value) <= 10:
            return f"{value:x<10}"
```

When `get_suggestion` returns `None`, no `SuggestionReady` message is posted.

### `SuggestionReady` Message

When a suggestion is produced, the suggester posts a `SuggestionReady` message containing both the `suggestion` string and the original `value` that triggered it. This message is posted on every successful suggestion lookup, including cache hits.

### Caching (`use_cache`)

Suggesters accept a `use_cache` parameter (default behavior is cache-enabled). When `use_cache=True`, calling `get_suggestion` with the same value a second time returns the cached result without invoking the subclass method again. When `use_cache=False`, the subclass method is called on every request, even for repeated values.

Cache hits still produce a `SuggestionReady` message -- caching affects only whether the subclass `get_suggestion` method is re-invoked, not whether downstream consumers are notified.

### Case Sensitivity (`case_sensitive`)

Suggesters accept a `case_sensitive` parameter. When `case_sensitive=False`, the value is lowercased before being passed to `get_suggestion`. This also means cache lookups are case-insensitive: `"hello"`, `"HELLO"`, and `"HeLlO"` all resolve to a single cache entry and only invoke `get_suggestion` once.

## SuggestFromList

`SuggestFromList` is a built-in suggester that matches against a fixed list of strings.

### Basic Matching

Given a list of candidate strings, `SuggestFromList` returns the first candidate that starts with the current input value. The match is prefix-based: typing `"d"` against `["dog", "dad"]` returns `"dog"` (the first match), while typing `"da"` returns `"dad"`.

### Priority

When multiple candidates match, the first one in the original list order wins. This holds for both case-sensitive and case-insensitive modes. For example, given `["England", "Portugal", "Scotland", "portugal", "PORTUGAL"]`, the prefix `"P"` always resolves to `"Portugal"` regardless of input casing when case-insensitive.

### Case-Insensitive Mode

`SuggestFromList(items, case_sensitive=False)` performs case-insensitive prefix matching. All case variants of the input (`"s"`, `"S"`, `"sc"`, `"sC"`, `"Sc"`, `"SC"`) match against the same candidates. The returned suggestion preserves the original casing from the candidate list, not the user's input.

## Integration with Input Widget

### Attaching a Suggester

An `Input` widget accepts a `suggester` parameter at construction time:

```python
Input(suggester=SuggestFromList(["hello", "world"]))
```

### Suggestion Display

As the user types, the `Input` widget's internal `_suggestion` attribute reflects the current suggestion. When the input value is empty (either initially or after deleting all characters), `_suggestion` is always the empty string -- suggesters are never consulted for empty input.

### Accepting a Suggestion

Pressing the right arrow key accepts the current suggestion, replacing the input's `value` with the full suggestion string.

### Suggestion Lifecycle

Suggestions update dynamically as the user types:

- Each keystroke that changes the value triggers a new suggestion lookup.
- If the current value no longer matches any candidate, `_suggestion` becomes empty.
- Deleting characters can restore a suggestion. Typing `"help"` against `["hello"]` produces no suggestion, but pressing backspace to get `"hel"` restores the `"hello"` suggestion.
- Editing in the middle of the value (e.g., moving the cursor left, deleting a character) also triggers re-evaluation.

### Special Characters

Suggestions work with non-ASCII characters (accented letters, Unicode), punctuation sequences, and other special characters. The matching is purely prefix-based on the string value with no special treatment of character classes.

## Constraints

- A suggester never produces a suggestion for an empty input value.
- `SuggestFromList` returns the first matching candidate in list order; there is no ranking or scoring.
- When `case_sensitive=False`, the suggestion string preserves the candidate's original casing, not the user's typed casing.
- Cache behavior is transparent to message consumers: `SuggestionReady` is posted on every successful lookup whether cached or not.
- `get_suggestion` returning `None` suppresses the `SuggestionReady` message entirely; no empty-string suggestion is sent.
- The right arrow key is the mechanism for accepting a suggestion into the input value.
