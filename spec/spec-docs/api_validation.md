# Validation

The `textual.validation` module provides a framework for validating string values. It is commonly used with the `Input` widget, which accepts a list of validators via its constructor. The framework can also validate any string values independently.

## ValidationResult

A dataclass representing the outcome of a validation operation.

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `failures` | `Sequence[Failure]` | `[]` | List of reasons why the value was invalid. Empty when validation succeeded |

### Properties

| Property | Type | Description |
|---|---|---|
| `is_valid` | `bool` | `True` if `failures` is empty |
| `failure_descriptions` | `list[str]` | List of string descriptions from each `Failure` that has a non-`None` description |

### Static Methods

#### success()

Construct a successful `ValidationResult` (empty failures list).

#### failure(failures)

Construct a failed `ValidationResult` with the given list of `Failure` objects.

| Parameter | Type | Description |
|---|---|---|
| `failures` | `Sequence[Failure]` | The failure objects |

#### merge(results)

Merge multiple `ValidationResult` objects into one. The merged result is valid only if all input results are valid. All failures are concatenated.

| Parameter | Type | Description |
|---|---|---|
| `results` | `Sequence[ValidationResult]` | Results to merge |

## Failure

A dataclass containing information about a single validation failure.

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `validator` | `Validator` | required | The Validator which produced the failure |
| `value` | `str \| None` | `None` | The value which caused validation to fail |
| `description` | `str \| None` | `None` | Human-readable description of the failure |

### Description Resolution

During `__post_init__`, if `description` is `None`:
1. Use `validator.failure_description` if it is not `None`.
2. Otherwise, call `validator.describe_failure(self)`.

This means the description priority order is:
1. Explicit description passed to the `Failure` constructor.
2. The `failure_description` set on the `Validator` instance.
3. The `describe_failure()` method override on the `Validator` subclass.

## Validator (Abstract Base Class)

Base class for string validation. Subclass this to implement custom validators.

```python
class Palindrome(Validator):
    def validate(self, value: str) -> ValidationResult:
        if value == value[::-1]:
            return self.success()
        else:
            return self.failure("Not a palindrome!")
```

### Constructor

| Parameter | Type | Default | Description |
|---|---|---|---|
| `failure_description` | `str \| None` | `None` | Default description attached to failures when no more specific description is provided |

### Abstract Methods

#### validate(value)

Validate the given string value. Must be implemented by subclasses.

| Parameter | Type | Description |
|---|---|---|
| `value` | `str` | The value to validate |

Returns a `ValidationResult` (use `self.success()` or `self.failure(...)` helpers).

### Methods

#### success()

Shorthand to create a successful `ValidationResult`. Returns `ValidationResult()`.

#### failure(description=None, value=None, failures=None)

Shorthand to create a failed `ValidationResult`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `description` | `str \| None` | `None` | Failure description text |
| `value` | `str \| None` | `None` | The invalid value (optional metadata) |
| `failures` | `Failure \| Sequence[Failure] \| None` | `None` | Explicit failure objects. If `None`, a generic `Failure` is created with the given description and value |

If `failures` is a single `Failure`, it is wrapped in a list.

#### describe_failure(failure)

Override in subclasses to provide context-specific failure descriptions. Only called when no other description was supplied (via constructor or `self.failure()` call).

| Parameter | Type | Description |
|---|---|---|
| `failure` | `Failure` | Information about the failure |

Returns `str | None`. Default implementation returns `self.failure_description`.

## Built-in Validators

### Regex

Validates that a string matches a regular expression using `re.fullmatch`.

#### Constructor

| Parameter | Type | Default | Description |
|---|---|---|---|
| `regex` | `str \| Pattern[str]` | required | The regular expression pattern |
| `flags` | `int \| re.RegexFlag` | `0` | Flags passed to `re.fullmatch` |
| `failure_description` | `str \| None` | `None` | Custom failure description |

#### Failure Types

| Failure Class | Description |
|---|---|
| `Regex.NoResults` | The regex did not match the value |

#### describe_failure Output

`"Must match regular expression {regex!r} (flags={flags})."`

### Number

Validates that a string represents a valid number (decimal, integer, or scientific notation), optionally within a range.

#### Constructor

| Parameter | Type | Default | Description |
|---|---|---|---|
| `minimum` | `float \| None` | `None` | Inclusive minimum value, or unbounded if `None` |
| `maximum` | `float \| None` | `None` | Inclusive maximum value, or unbounded if `None` |
| `failure_description` | `str \| None` | `None` | Custom failure description |

#### Failure Types

| Failure Class | Description |
|---|---|
| `Number.NotANumber` | Value cannot be parsed as a float, or is `NaN`/`Inf` |
| `Number.NotInRange` | Value is outside `[minimum, maximum]` |

#### describe_failure Output

- Not a number: `"Must be a valid number."`
- Below minimum only: `"Must be greater than or equal to {minimum}."`
- Above maximum only: `"Must be less than or equal to {maximum}."`
- Out of range: `"Must be between {minimum} and {maximum}."`

### Integer

Extends `Number` to additionally validate that the value is an integer (no decimal point).

#### Failure Types

| Failure Class | Base | Description |
|---|---|---|
| `Integer.NotAnInteger` | `Failure` | Value is a valid number but not an integer |

Inherits `Number.NotANumber` and `Number.NotInRange`.

#### Validation Order

1. Runs `Number.validate()` first (checks valid number and range).
2. If that passes, checks that `int(value)` succeeds.

#### describe_failure Output

- Not a number or not an integer: `"Must be a valid integer."`
- Range errors: Same as `Number`.

### Length

Validates that a string's length falls within an inclusive range.

#### Constructor

| Parameter | Type | Default | Description |
|---|---|---|---|
| `minimum` | `int \| None` | `None` | Inclusive minimum length, or unbounded if `None` |
| `maximum` | `int \| None` | `None` | Inclusive maximum length, or unbounded if `None` |
| `failure_description` | `str \| None` | `None` | Custom failure description |

#### Failure Types

| Failure Class | Description |
|---|---|
| `Length.Incorrect` | Length is outside the specified range |

#### describe_failure Output

- Maximum only: `"Must be shorter than {maximum} characters."`
- Minimum only: `"Must be longer than {minimum} characters."`
- Both: `"Must be between {minimum} and {maximum} characters."`

### Function

A flexible validator that delegates to a user-provided callable.

#### Constructor

| Parameter | Type | Default | Description |
|---|---|---|---|
| `function` | `Callable[[str], bool]` | required | Function that returns `True` if valid, `False` otherwise |
| `failure_description` | `str \| None` | `None` | Custom failure description |

#### Failure Types

| Failure Class | Description |
|---|---|
| `Function.ReturnedFalse` | The supplied function returned `False` |

### URL

Validates that a string is a valid URL with a scheme and netloc (network location) present.

#### Failure Types

| Failure Class | Description |
|---|---|
| `URL.InvalidURL` | The URL is missing a scheme or netloc, or cannot be parsed |

#### describe_failure Output

`"Must be a valid URL."`

#### Validation Logic

Uses `urllib.parse.urlparse` and checks that both `scheme` and `netloc` are non-empty. Catches `ValueError` from malformed URLs.
