# Stage 0 JS Divergences

Stage 0 follows JavaScript conventions where Python behavior cannot or should not be mirrored directly.

## Canonical API Names

- `runTest()` is the canonical harness method on `App`.
- `subTitle` and `returnValue` are the canonical JS property names.
- `run_test()`, `sub_title`, and `return_value` are supported Stage 0 aliases that delegate to the canonical camelCase surfaces.

## String Coercion

- `App.title` and `App.subTitle` use JavaScript `String(value)` coercion.
- This is an intentional divergence from Python `str(...)` formatting. Example: `null` becomes `"null"`, not `"None"`.

## Truthiness

- `Offset`, `Size`, `Region`, and `Spacing` use normal JavaScript object truthiness and are always truthy as objects.
- Code must use explicit predicates instead of truthiness:
  - `Offset.isOrigin`
  - `Spacing.isZero`
  - `Region.isEmpty`
  - `Size.equals(Size.ZERO)` or direct dimension checks

## Operator-Driven Python Behavior

- Python operator overloads are represented by explicit methods in JavaScript.
- Use `add()`, `subtract()`, `multiply()`, `contains()`, and `containsPoint()` instead of `+`, `-`, `*`, or `in`.
