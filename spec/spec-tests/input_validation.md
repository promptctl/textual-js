## Input Validation

Textual provides a validation framework for `Input` widgets. Validators are passed to `Input` via the `validators` parameter, and validation triggers are controlled via the `validate_on` parameter.

### ValidationResult

`ValidationResult` represents the outcome of validating a value. It has two factory methods:

- `ValidationResult.success()` -- indicates the value is valid.
- `ValidationResult.failure(failures)` -- indicates the value is invalid, taking a list of `Failure` objects.

`ValidationResult` exposes:

- `is_valid` -- boolean indicating success or failure.
- `failures` -- list of `Failure` objects when invalid.
- `failure_descriptions` -- list of human-readable description strings extracted from each `Failure`.
- `ValidationResult.merge(results)` -- combines multiple `ValidationResult` instances into one. If all are successes, the merge is a success. If any contain failures, all failures are collected into a single failed result.

### Failure

A `Failure` is created with a reference to the `Validator` that produced it and an optional `description` string. The description is resolved with the following priority (highest first):

1. `failure_description` parameter passed to the `Validator` constructor at instantiation time.
2. The string returned by the validator's `describe_failure` method (if overridden).
3. The `description` keyword passed directly to `self.failure()` inside the `validate` method.

### Built-in Validators

#### Number

Validates that a string is a finite numeric value (integers, floats, negative numbers, scientific notation). `inf`, `-inf`, and `nan` are rejected.

- `Number(minimum=None, maximum=None)` -- optionally constrains the value to an inclusive range.
- When the value is a valid number but outside the range, the failure description reads `"Must be between {minimum} and {maximum}."`.
- The failure type is `Number.NotInRange`.

#### Integer

Validates that a string is a valid integer. Floats, scientific notation, trailing periods, and leading underscores are all rejected. Underscores within the number (e.g. `"123_456"`) are accepted as valid Python integer literals. Negative integers are supported.

- `Integer(minimum=None, maximum=None)` -- optionally constrains the value to an inclusive range.
- When the value is not parseable as an integer at all, the failure description is `"Must be a valid integer."`.

#### Length

Validates the length of a string.

- `Length(minimum=None, maximum=None)` -- constrains the character count. An empty string with no constraints is valid.

#### Regex

Validates that a string matches a regular expression pattern.

- `Regex(regex)` -- the pattern is a string. The match must succeed for the value to be considered valid. A full match is expected (e.g. `r"\d+"` matches `"123"` but not `"abc"`).

#### URL

Validates that a string is a well-formed URL with both a scheme and a netloc.

- `URL()` -- takes no parameters.
- Values missing a scheme (e.g. `"www.example.com"`), missing a netloc (e.g. `"https:///path"`), empty strings, and URLs with invalid characters are all rejected.

#### Function

Wraps an arbitrary callable as a validator.

- `Function(function, failure_description=None)` -- `function` is a callable that takes a string value and returns `True` (valid) or `False` (invalid). The optional `failure_description` is used when the function returns `False`.

### Custom Validators

To create a custom validator, subclass `Validator` and override:

- `validate(self, value: str) -> ValidationResult` -- perform validation and return a result. Call `self.failure()` to produce a failed result (optionally passing `value` and `description`).
- `describe_failure(self, failure: Failure) -> str | None` -- optionally override to provide a description for failures. This is used when no `failure_description` was provided to the constructor and no `description` was passed to `self.failure()`.

A custom `failure_description` passed to the `Validator` constructor always takes priority over both `describe_failure` and any description passed inside `validate`.

### Validation Events

Both `Input.Changed` and `Input.Submitted` messages carry a `validation_result` attribute:

- When validation is active for the triggering event, `validation_result` is a `ValidationResult` (success or failure).
- When validation is not active for the triggering event (due to `validate_on` configuration), `validation_result` is `None`.

### validate_on

The `validate_on` parameter on `Input` controls which events trigger validation. It accepts an iterable of strings. Recognized values are `"changed"`, `"submitted"`, and `"blur"`.

- `validate_on=None` (the default) -- validation runs on all events: changed, submitted, and blur. CSS classes `-valid` and `-invalid` are applied to the input accordingly.
- `validate_on=["changed"]` -- validation runs only when the value changes.
- `validate_on=["submitted"]` -- validation runs only on submit.
- `validate_on=["blur"]` -- validation runs only when the input loses focus.
- Combinations are supported (e.g. `["changed", "submitted"]`).
- An empty iterable (`[]` or `set()`) disables all validation -- `validation_result` is `None` on every event and no CSS classes are applied.
- Unrecognized strings (e.g. `"fried"`, `"garbage"`) are ignored; they do not enable any validation.

### valid_empty

The `Input` widget has a `valid_empty` reactive property. When set to `True`, an empty input value is treated as valid regardless of the validators. This causes the `-valid` CSS class to be applied and `-invalid` to be removed, even if validators would otherwise reject the empty string.

### CSS Classes

The `Input` widget applies CSS classes based on validation state:

- `-valid` is added when the input value passes validation.
- `-invalid` is added when the input value fails validation.
- Neither class is present before any validation has run or when `validate_on` excludes the triggering event.

## Constraints

- `ValidationResult.success()` and `ValidationResult.failure(failures)` are the only ways to construct a `ValidationResult`. The `failure` factory requires a list of `Failure` objects.
- `ValidationResult.merge` preserves all individual failures from every result in the input list.
- `failure_descriptions` always reflects the resolved description for each failure, respecting the priority order (constructor parameter > `describe_failure` > inline description).
- `Number` rejects `inf`, `-inf`, and `nan` unconditionally, regardless of range settings.
- `Integer` rejects any string containing a decimal point or scientific notation, even if the numeric value is mathematically an integer (e.g. `"1.23e4"` is rejected).
- `validate_on=None` means all validations are active. An empty collection means no validations are active. These are distinct behaviors.
- Unrecognized `validate_on` values are silently ignored; they do not cause errors or enable any validation.
- When validation is not active for an event, the event's `validation_result` is `None` and no CSS classes are toggled.
- `valid_empty=True` overrides validator results for empty input values, forcing the widget to the valid state.
