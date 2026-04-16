# Docs Spec: Validation

## Purpose
Document the string validation framework used by the `Input` widget and any code that needs to validate user input: the result type, the failure type, the validator contract, and the built-in validators.

## Audience
Application authors wiring validators onto inputs and forms; widget authors writing custom validators (regex, range, domain-specific rules).

## Required sections
1. Overview (what validation produces, where it plugs in, how `Input` consumes it)
2. `ValidationResult` (success vs. failure, reading failure descriptions, merging results)
3. `Failure` (fields, description resolution order)
4. `Validator` contract (writing a custom validator, using `success()` / `failure()` helpers)
5. Built-in validators: `Regex`, `Number`, `Integer`, `Length`, `Function`, `URL`
6. Composing multiple validators on an `Input`
7. When validation runs on `Input` (on change, on submit, both) and how that ties into the validator contract
8. Displaying failure descriptions in UI

## Key concepts
- A validator maps a string to a `ValidationResult`. That result is either successful (empty failures) or failed (one or more `Failure` records).
- Failure descriptions are resolved through a defined priority: explicit per-call description, validator-level default, then the validator's `describeFailure` override.
- Results from multiple validators compose: merged result is valid only if every component is valid; failures concatenate.
- Built-in validators cover the common cases (regex, numeric range, integer, length range, arbitrary predicate, URL).
- Validators are data contracts — the `Input` widget is a consumer, not the owner, of the validation logic.

## Behaviors and contracts
- A `ValidationResult` is immutable; merging produces a new result.
- `Failure` carries enough context (validator, value, description) to render a helpful message without the caller reconstructing state.
- `Regex` uses full-match semantics (the entire value must match, not a partial match).
- `Number` treats `NaN` and `Infinity` as invalid.
- `Integer` runs number validation first, then checks integer-ness.
- `Length` is inclusive on both bounds; unbounded sides accept any length.
- `Function` wraps a predicate returning true/false; the wrapped callable itself does not return a `ValidationResult`.
- `URL` requires both a scheme and a network location.
- A validator must not mutate the value it receives.

## Example requirements
All examples are JSX/TypeScript. The doc must include:
- Passing an array of validators to `<Input validators={[...]}>`.
- Writing a custom validator (e.g., palindrome) using the `Validator` base/contract and the helper methods.
- Providing a custom `failureDescription` on a validator.
- Merging results from two validators in user code.
- Rendering `failureDescriptions` next to the input in a MobX `observer()` component.
- Using `URL`, `Number`, and `Length` in combination.

## Cross-references
- Widget catalog entry for `Input` (in `spec/spec-src/10-widget-catalog.md`)
- `spec/docs-spec/api_widget.md`
- `spec/docs-spec/api_reactive.md`
- `spec/spec-src/12-supporting-subsystems.md`

## Notes for writers
- Drop Python `dataclass` and `__post_init__` language. Describe `ValidationResult` and `Failure` as plain TypeScript value objects with an optional constructor hook for description resolution.
- Replace `re.fullmatch` with JS regex behavior: a full match is enforced by anchoring (`^...$`) or by checking the match spans the whole string.
- Replace `urllib.parse.urlparse` with the JS equivalent (e.g., `URL` constructor) and describe the failure signal.
- Do not document Python-style nested exception classes (`Regex.NoResults`). Instead, describe failure categories as tagged variants / discriminated-union members on the `Failure` type.
