# CSS: Nested Rules, Scoped CSS, Screen CSS, Hot Reloading, and Help Text

## Overview

Textual CSS (TCSS) supports nested rule blocks, scoped screen-level stylesheets, hot reloading of external CSS files, and contextualized help text for CSS property errors.

---

### Nested CSS Rules

Nested CSS allows rule blocks to be defined inside other rule blocks. The nesting implicitly scopes the inner selector to descendants of the outer selector.

- A rule block inside another rule block targets descendants of the outer selector. `Screen { Label { background: red; } }` applies `background: red` to all `Label` widgets that are descendants of `Screen`.
- The `&` combinator refers to the parent selector and can be used for refinement. `& > #foo` inside `Screen {}` means direct children of `Screen` matching `#foo`. `&.jessica` inside a block targeting `#foo` means "the element matching `#foo` that also has the class `jessica`".
- Nested selectors without `&` are treated as descendant selectors. `#egg` inside `& > #foo` matches `#egg` as a descendant of `#foo`. `.paul` inside `& > #foo` matches `.paul` as a descendant of `#foo`.
- Declarations and nested blocks can coexist in the same rule block. A parent block can have its own property declarations (`background: green`) alongside nested child blocks (`Label { background: red; }`). Both apply correctly.
- Declarations may be interleaved between nested blocks in any order within the same rule block. A rule block such as `Vertical { Button:light { ... } min-height: 3; #two, *:focus { ... } height: auto; Label { ... } }` correctly applies all declarations and nested rules regardless of their relative order.
- A nested block can itself contain both property declarations and further nested `&`-prefixed sub-blocks simultaneously. For example, `Label { background: yellow; &:light, &:dark { background: red; } &:hover { background: green !important; } }` applies the `background: yellow` declaration as a base and overrides it via the `&` sub-blocks when pseudo-classes match.
- Comma-separated selector lists work inside nested blocks. `&.foo, &.bar { background: red; }` inside `Label {}` applies to labels with class `foo` or class `bar`, but not to labels with other classes.
- Pseudo-classes work in nested CSS. `Button:light, Button:dark { background: red; }` inside `Vertical {}` correctly matches buttons with those pseudo-classes. `&:hover { background: green !important; }` inside a nested `Label` block applies on hover. The `!important` modifier is respected in nested contexts.
- The `*` universal selector and pseudo-classes can be combined in nested comma lists. `#two, *:focus { background: green !important; }` inside `Vertical {}` matches `#two` and any focused widget within the vertical.

### Nested CSS Parse Errors

The parser rejects malformed nested CSS with specific error types:

- `UnexpectedEnd` is raised for unclosed blocks: `Selector {`, `Selector{ Foo {`, `Selector{ Foo {}`, and `*{`.
- `TokenError` is raised for invalid bare selectors outside a block: `> {}`, `&`, `&&`, `&.foo`, `& .foo`, and `{`.

---

### Screen-Level CSS

Screens can declare their own CSS via the `CSS` class variable and/or a `CSS_PATH` pointing to an external `.tcss` file.

- Screen CSS is applied when the screen is pushed, switched to, or activated via mode switching. This works for `push_screen`, `switch_screen`, and `switch_mode`.
- Screen CSS is loaded regardless of how the screen is referenced: as a direct instance (`push_screen(ScreenWithCSS())`), by name from the `SCREENS` dict pointing to a class (`push_screen("screenwithcss")`), or by name from the `SCREENS` dict pointing to an instance.
- Screen CSS takes precedence over App CSS for the same selectors. If App CSS sets `#screen-css { background: green }` and Screen CSS sets `#screen-css { background: red }`, the screen's red wins when that screen is active.
- Screen CSS from `CSS_PATH` also overrides App CSS for matching selectors.
- After a screen with CSS is popped, its CSS contributions remain in the stylesheet (the stylesheet is not reparsed on pop).
- Pushing and popping the same screen multiple times only triggers one CSS reparse, not one per push. Repeated push/pop cycles of a `ScreenWithCSS` result in exactly 1 call to `stylesheet.reparse`.
- Mode switching applies screen CSS. `MODES = {"base": BaseScreen, "mode": ScreenWithCSS}` causes screen CSS to be loaded when switching to `"mode"`, whether the mode value is a screen class or a string name referencing the `SCREENS` dict.

### Scoped CSS

- Screens have a `SCOPED_CSS` class variable that controls whether their CSS is scoped. Setting `SCOPED_CSS = False` makes the screen's CSS apply globally (not limited to that screen's widget tree).

---

### CSS Hot Reloading

External CSS files referenced via `CSS_PATH` support hot reloading when the `TEXTUAL` environment variable is set to `"debug"`.

- When `TEXTUAL=debug`, the framework creates a file monitor for CSS files. Changes to the CSS file on disk are picked up via `_on_css_change()`.
- Reloading applies to all screens in the stack, not just the top screen. If a label on a non-top screen has `height: 5` from the CSS file, and the file is then cleared, the label's height falls back to its default value (1).
- If the CSS file is deleted (becomes temporarily unavailable), the reload does not crash. This handles environments where files may briefly disappear during save operations.

---

### CSS Error Help Text

When a CSS property receives an invalid value, the framework provides contextualized help text. Help text functions produce messages tailored to the styling context: either `"css"` or `"inline"`.

- **Context-sensitive examples**: In CSS context, help text shows CSS syntax (e.g., `padding:`). In inline context, help text shows Python attribute syntax (e.g., `widget.styles.padding`).
- **Property name adaptation**: Property names are formatted for their context. CSS context uses kebab-case (`max-width`, `text-style`). Inline context uses snake_case (`max_width`, `text_style`).
- **Spacing errors**: `spacing_wrong_number_of_values_help_text` reports "Invalid number of values" and includes the property name and the actual count received. `spacing_invalid_value_help_text` reports "Invalid value for" and includes the property name.
- **Scalar errors**: `scalar_help_text` reports "Invalid value for" with the property name adapted to the styling context.
- **String enum errors**: `string_enum_help_text` reports "Invalid value for" and lists all valid values for the property (e.g., `"none"`, `"hidden"` for `display`).
- **Color errors**: `color_property_help_text` reports "Invalid value for" with the property name.
- **Border errors**: `border_property_help_text` reports "Invalid value for" with the property name.
- **Layout errors**: `layout_property_help_text` reports "Invalid value for" with the property name.
- **Fractional errors**: `fractional_property_help_text` reports "Invalid value for" with the property name (e.g., `opacity`).
- **Offset errors**: `offset_property_help_text` reports "Invalid value for" and mentions `offset`. `offset_single_axis_help_text` reports for a single axis (e.g., `offset-x`).
- **Align errors**: `align_help_text` reports "Invalid value for" and mentions `align`.
- **Style flags errors**: `style_flags_property_help_text` reports "Invalid value" and includes the invalid token (e.g., `notavalue`). The property name is adapted to the styling context.

---

## Constraints

- Nested CSS blocks must be properly closed; unclosed blocks raise `UnexpectedEnd`.
- Bare `&` selectors, bare combinators (`>`), and bare opening braces outside a rule block raise `TokenError`.
- Screen CSS is parsed at most once per screen class, regardless of how many times the screen is pushed and popped.
- CSS hot reloading requires `TEXTUAL=debug` in the environment; without it, no file monitor is created.
- CSS hot reloading must not crash when a watched file is temporarily deleted.
- CSS hot reloading must apply changes to all screens in the stack, not only the top screen.
- Help text must be context-sensitive: CSS context shows CSS syntax with kebab-case property names; inline context shows Python attribute syntax with snake_case property names.
- Help text for invalid values must always include the property name and a description of what is wrong.
