# Stage 0 JS Divergences

Stage 0 follows JavaScript conventions where Python behavior cannot or should not be mirrored directly.

## Canonical API Names

- `runTest()` is the canonical harness method on `App`.
- `subTitle` and `returnValue` are the canonical JS property names.
- `run_test()`, `sub_title`, and `return_value` are supported Stage 0 aliases that delegate to the canonical camelCase surfaces.

## String Coercion

- `App.title` and `App.subTitle` use JavaScript `String(value)` coercion.
- This is an intentional divergence from Python `str(...)` formatting. Example: `null` becomes `"null"`, not `"None"`.

## Screen Titles

- Python writes a screen's title as `app.screen.title = "..."`. Here that is `app.screenTitle` (and `app.screenSubTitle`), because `Screen` is a plain record held in a deliberately non-observable map: assigning the field directly would change the value and notify no observer. The accessors route the write through `ScreenStackService`, the single owner, which keeps the reactive marker in step.
- Both read back `null` when the screen defers to the app. `null` and `""` are distinct: `""` is a screen overriding the app's value with nothing, not a screen declining to answer.
- `App.title` resolves at construction as `options.title || static TITLE || the app class name` (Textual's `TITLE or self.__class__.__name__`), not to `""`. The guarantee holds at construction only: assigning `app.title = ""` later sets `""` and a `Header` paints a blank title region, in Textual too.
- The class-name fallback reads `this.constructor.name`, which minifiers mangle. Downstream consumers who bundle their app with default terser/esbuild settings (`keep_classnames` / `keepNames` off) will see a mangled name if they rely on that last fallback; set a `TITLE` or pass `options.title` rather than depending on it. This library itself ships unminified.

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
