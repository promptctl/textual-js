# CSS Parsing Spec

This spec describes the tokenization, parsing, variable resolution, stylesheet application, selector syntax, and mega stylesheet validation for Textual's CSS (TCSS) subsystem. All behavior described here is derived from existing test coverage.

---

## Overview

Textual CSS processing is a multi-stage pipeline:

1. **Tokenization** -- raw CSS text becomes a stream of `Token` objects.
2. **Variable reference substitution** -- `$variable` references are replaced with their declared values.
3. **Parsing** -- the token stream is consumed into rulesets with selectors, declarations, and styles.
4. **Stylesheet application** -- parsed rules are matched against DOM nodes using specificity ordering.

---

## Tokenization

### Token Structure

Each token carries: `name`, `value`, `read_from` (source identifier tuple), `code` (the full CSS source string), `location` (row, column tuple), and an optional `referenced_by` field for variable tracing.

### Token Types

The tokenizer produces the following named token types:

- `variable_name` -- a variable declaration like `$x:`. The `$` prefix and trailing `:` are part of the value.
- `variable_value_end` -- the terminator of a variable value, either `;` or `\n`.
- `variable_ref` -- a reference to a variable in a declaration value, e.g. `$warning`.
- `selector_start_class` -- a class selector like `.thing`.
- `selector_start_id` -- an ID selector like `#foo`.
- `selector_start_universal` -- the universal selector `*`.
- `declaration_set_start` / `declaration_set_end` -- `{` and `}`.
- `declaration_name` -- a property name including the colon, e.g. `color:`, `border:`.
- `declaration_end` -- the `;` terminating a declaration value.
- `token` -- a generic unclassified identifier (e.g. color names like `red`, `on`).
- `number` -- a bare numeric value like `1`, `0`, `123`.
- `scalar` -- a number with a unit suffix like `2vw`, `4%`.
- `duration` -- a time value like `6s`.
- `whitespace` -- spaces, tabs, and newlines (each preserved as-is).

### Variable Name Rules

Valid variable names support: hyphens, underscores, alphanumerics, and may start with any of these characters (including digits, hyphens, and underscores). Examples: `warning-text`, `_warningtext`, `-warningtext`, `1warningtext`.

### Variable Declaration Syntax

- Form: `$name: value;` or `$name: value\n` (newline acts as terminator when semicolon is absent).
- Multiple values in a single declaration are individually tokenized: `$x: 2vw 4% 6s red;` produces separate `scalar`, `scalar`, `duration`, and `token` tokens.
- Variables can reference other variables: `$x: $y;` produces a `variable_ref` token for `$y`.
- Multiple variable references in a single declaration are supported: `$x: $y $z\n`.
- Variables can be declared at EOF without a terminator: `$x: 1` (no `;` or `\n`).
- Invalid characters in variable values (e.g. `$x:(@$12x)`) raise `TokenError`.
- Variables can be interspersed with rulesets: `$x:1; .thing{text:red;} $y:2;`.

### Variable References in Declarations

Variable references (`$name`) appearing in declaration values produce `variable_ref` tokens. Multiple references are supported in a single value: `.card{padding: $pad-y $pad-x;}`.

### Comments

- Single-line comments use `#` at the start of a line or after whitespace. Content after `#` until end of line is stripped, producing no tokens. A `#` at the start of a selector (e.g. `#foo`) is an ID selector, not a comment.
- Block comments use `/* ... */` syntax. They are stripped during tokenization and produce no tokens. Block comments can appear within variable declarations, within rulesets, and can split tokens (e.g. `re/* comment */d` becomes two separate `token` values `re` and `d`).

### Newlines in Declaration Values

Newlines within a declaration block (between `{` and `}`) are treated as whitespace, not as declaration terminators. Example: `.foo{margin: 1\n1 0 0}` parses as a single margin declaration with four values.

### Pseudo-Class Validation with Suggestions

When the tokenizer encounters an unknown pseudo-class, it raises a `TokenError` with:
- The message `"unknown pseudo-class '<name>'"`.
- A suggestion `"did you mean '<closest_match>'"` using fuzzy matching against known pseudo-classes.
- Known pseudo-classes include: `blur`, `can-focus`, `dark`, `disabled`, `enabled`, `focus-within`, `focus`, `hover`, `light`.
- This error reporting works in both flat CSS and nested CSS contexts.

### Nested CSS Tokenization

The tokenizer supports nested rulesets (e.g. `Screen { Button:hover { ... } }`). Pseudo-class validation and error reporting function identically in nested contexts.

---

## Variable Reference Substitution

### Substitution Mechanics

The `substitute_references` function consumes a token stream and replaces `variable_ref` tokens with the tokens from the corresponding variable declaration.

- Substituted tokens retain their original `location` from the variable definition, but gain a `referenced_by` field (`ReferencedBy`) recording the reference site's name, location, length, and source code.
- Leading whitespace in variable values is preserved as-is in the definition but only the value tokens are injected at the reference site (whitespace between `$name:` and the first value token is part of the definition, not the substitution).

### Transitive References

Variables can reference other variables: `$x: 1; $y: $x;`. The substitution resolves transitively, so `$y` expands to the value tokens of `$x`. The `referenced_by` field at the final usage site records the immediate reference (`$y`), not the transitive chain.

### Multi-Value Variable Expansion

A variable holding multiple values expands to all of its tokens: `$x: 2 4; $y: 6 $x 2;` causes `$y` to expand to `6 2 4 2` (including the intermediate whitespace tokens from `$x`).

### Empty Variables

A variable declared with no value (`$x:\n`) resolves to nothing -- the reference is simply removed from the token stream.

### Undefined Variable References

Referencing an undefined variable (`$not-defined`) raises `UnresolvedVariableError`.

### Whitespace Trimming

When substituting a variable reference, leading whitespace between `$name:` and the first value token is not included in the substitution. Only the value tokens themselves are injected.

---

## Parsing

### Ruleset Structure

A parsed ruleset consists of selectors and a styles object. The `Stylesheet` class holds a list of rules after parsing.

### Selector Types

Selectors can be:
- **Type selectors**: `TestType`, `Widget`, `Button` -- must start with a letter (starting with a digit raises `TokenError`). May contain digits after the first character (`TestType1` is valid).
- **Class selectors**: `.classname`.
- **ID selectors**: `#idname`.
- **Universal selector**: `*`.
- **Compound selectors**: combinations like `.A.B`, `A1.A1#A1`.
- **Descendant combinators**: `A B` (space-separated).
- **Child combinators**: `A > B`.
- **Selector lists**: `A, B, C` (comma-separated, with flexible whitespace).

### The `is_id_selector` Utility

Returns `True` only for simple ID selectors: `#foo`, `#bar`, `#f`. Returns `False` for bare `#`, type selectors, class selectors, IDs starting with digits (`#5foo`), or any compound/combined selector (`#foo .bar`, `#foo>.bar`, `#foo.bar`, `#foo #bar`).

### Pseudo-Classes in Selectors

Pseudo-classes are appended with `:` -- e.g. `A:focus`, `.A:focus:hover`, `#A:enabled`. They can be on separate lines from the selector and can be chained. Compound selectors with pseudo-classes are supported: `A1:focus.A1:focus#A1:focus`.

### Layout Parsing

`layout: vertical` parses to a `VerticalLayout` instance. Invalid layout names raise `StylesheetParseError`.

### Color Parsing

Supported color formats:
- Named colors: `red`, `lime`, `coral`, `aqua`, `deepskyblue`, `rebeccapurple`, `transparent`.
- ANSI colors: `ansi_red`, `ansi_bright_magenta` (but not fabricated names like `ansi_dark_cyan`).
- Hex: `#ffcc00` (6-digit), `#ffcc0033` (8-digit with alpha).
- RGB/RGBA functions: `rgb(200,90,30)`, `rgba(200,90,30,0.3)` -- whitespace around arguments is tolerated.
- HSL/HSLA functions: `hsl(180,50%,50%)`, `hsla(180,50%,50%,0.25)` -- whitespace around arguments is tolerated.
- Alpha values are clamped to 0.0..1.0.
- Invalid color names and malformed values raise `StylesheetParseError` or `TokenError`.

### Color Name Suggestions

Misspelled color names produce a "Did you mean" suggestion via fuzzy matching (e.g. `blu` suggests `blue`, `chartruse` suggests `chartreuse`).

### Property Name Suggestions

Misspelled property names produce a "Did you mean" suggestion (e.g. `colr` suggests `color`, `ofset-x` suggests `offset-x`). Underscores in property names are normalized to hyphens in error messages. Very short or unrecognizable names (e.g. `wh`, `xkcd`) produce no suggestion. This works in both flat and nested CSS.

### Offset Parsing

- Composite form: `offset: 5% 40%;` sets both x and y.
- Separate forms: `offset-x: 5%;` and `offset-y: 40%;`.
- Units: `%` maps to `Unit.PERCENT`, bare numbers map to `Unit.CELLS`. Orientation context is `Unit.WIDTH` for x, `Unit.HEIGHT` for y.
- Negative values are supported.

### Overflow Parsing

`overflow: hidden auto;` sets `overflow_x` to `"hidden"` and `overflow_y` to `"auto"`.

### Transition Parsing

- Full form: `transition: <property> <duration> <easing> <delay>;`.
- Duration formats: `5.57s`, `0.5s`, `1200ms`, `0.5ms`, bare numbers (treated as seconds).
- Delay is optional (defaults to 0).
- Unknown easing functions raise `StylesheetParseError`.

### Opacity Parsing

- Accepts bare numbers and percentages.
- Values are clamped: negative becomes 0.0, values above 1.0 (or 100%) become 1.0.
- Invalid formats (e.g. `123x`) raise `StylesheetParseError`.

### Margin and Padding Parsing

Shorthand and individual forms can be combined. Individual properties override the corresponding edge from the shorthand: `margin: 1; margin-top: 2; margin-right: 3; margin-bottom: -1;` produces `Spacing(2, 3, -1, 1)`. Negative values are allowed.

### Text Align Parsing

Valid values: `left`, `start`, `center`, `right`, `end`, `justify`. Invalid values raise `StylesheetParseError`.

### Bad Pseudo-Selector Error Positions

When an unknown pseudo-class is encountered, the `TokenError` includes a `start` attribute with the exact (row, col) position of the pseudo-class in the source.

---

## Stylesheet Application

### Specificity Rules

- ID selectors have higher specificity than class selectors: `#id {color: red;}` wins over `.class {color: blue;}` for a node with both.
- Multiple classes in a selector increase specificity: `.b.c` beats `.a`.
- ID specificity strictly outranks class specificity regardless of class count: `#id` beats `.a.b.c.d`.

### Declaration Order Tiebreaking

When specificity is equal, the last-declared rule wins. For `.a {background: red;} .b {background: blue;}` applied to a node with both classes, background is blue.

### Duplicate Property in Same Ruleset

The last value wins: `#id {color: red; color: blue;}` results in blue.

### Duplicate Selectors Merge

When the same selector appears in multiple rulesets, their declarations merge. Later declarations for the same property override earlier ones, but non-overlapping properties from earlier rulesets are preserved.

### Default Styles Preservation

Applying a stylesheet does not override properties not mentioned in the CSS. Default values (e.g. `margin: 0`, `box-sizing: border-box`) remain intact.

### User CSS vs Widget DEFAULT_CSS

User-authored CSS takes priority over `Widget.DEFAULT_CSS` (even when `DEFAULT_CSS` uses `!important`). Non-overlapping properties from both sources are merged.

### Empty Rulesets

Empty rulesets (`.a {} .b {}`) are valid and do not cause errors when applied.

---

## CSS Reloading

### Hot-Reload on File Change

When the `TEXTUAL` environment variable includes `"debug"`, Textual creates a file monitor for `CSS_PATH` files. When the CSS file changes on disk, `_on_css_change()` is called and all screens in the screen stack (including non-top screens) have their styles re-applied.

- After removing all rules from the CSS file, a widget whose `height` was explicitly set (e.g. `5`) falls back to its default value (e.g. `1`).
- The re-application applies to widgets on non-top screens, not only the currently visible screen.

### Tolerance for Temporarily Missing Files

If `_on_css_change()` is called and the CSS file no longer exists on disk (e.g. temporarily removed during a save), no crash or exception is raised. The application continues running with its existing styles.

---

## Help Text (Error Message System)

Error messages for invalid CSS property values are generated by named help-text functions and are context-sensitive, adapting their output based on whether the error occurred in a CSS file (`"css"`) or via inline styles (`"inline"`).

### Context Sensitivity

The property name used in the message is adapted:
- In `"css"` context: uses the CSS hyphenated form (e.g. `max-width:`).
- In `"inline"` context: uses the Python underscore form (e.g. `widget.styles.max_width`).

### Help Text Functions

Each error type has a dedicated generator:
- `spacing_invalid_value_help_text(property, context)` -- invalid value for a spacing property (e.g. `padding`). Includes the property name.
- `spacing_wrong_number_of_values_help_text(property, count, context)` -- wrong number of values for a spacing property. Includes property name and count.
- `scalar_help_text(property, context)` -- invalid scalar value. Includes the property name in context-appropriate form.
- `string_enum_help_text(property, valid_values, context)` -- invalid string value for an enum property. Includes the property name and all valid values.
- `color_property_help_text(property, context)` -- invalid color value. Includes the property name.
- `border_property_help_text(property, context)` -- invalid border value. Includes the property name.
- `layout_property_help_text(property, context)` -- invalid layout value. Includes the property name.
- `fractional_property_help_text(property, context)` -- invalid fractional value (e.g. `opacity`). Includes the property name.
- `offset_property_help_text(context)` -- invalid offset value. Mentions `"offset"`.
- `offset_single_axis_help_text(property)` -- invalid single-axis offset (e.g. `offset-x`). Mentions the property name.
- `align_help_text()` -- invalid align value. Mentions `"align"`.
- `style_flags_property_help_text(property, invalid_token, context)` -- invalid style flag. Includes the invalid token value and the property name in context-appropriate form.

All help text begins with `"Invalid value"` or `"Invalid value for"`.

---

## Mega Stylesheet

### Purpose

The mega stylesheet (`test_mega_stylesheet.tcss`) is a comprehensive validity test. It contains as many syntactically valid TCSS constructs as possible in a single file, exercising the parser's ability to handle:

- Universal, type, class, and ID selectors in all combinations.
- Descendant and child combinators with varying nesting depth.
- Compound selectors (multiple classes, mixed class/ID/type).
- Selector lists with commas (with and without whitespace, including multi-line).
- Pseudo-classes (`:focus`, `:hover`, `:enabled`) on all selector types, chained and on separate lines.
- Variable declarations with diverse name patterns (hyphens, underscores, digits, long sequences of dashes/underscores).
- Empty variable values.
- Various brace/whitespace formatting styles (compact, multi-line, no-whitespace).
- Unicode content in comments.

### Validation Method

The test loads the `.tcss` file via `Stylesheet.read()`, calls `parse()`, and asserts that the final rendered CSS contains the sentinel class `.---we-made-it-to-the-end---`. This confirms the entire file parsed without error.

---

## Constraints

- Variable names must follow the pattern: `$` followed by one or more characters from `[a-zA-Z0-9_-]`, terminated by `:`. Invalid characters in variable values raise `TokenError`.
- Type selector names must not start with a digit. `1TestType` raises `TokenError`.
- Pseudo-classes must be from the known set. Unknown pseudo-classes raise `TokenError` with a fuzzy-match suggestion when a close match exists.
- Undefined variable references raise `UnresolvedVariableError`, not a silent fallback.
- Opacity values are clamped to [0.0, 1.0]. Alpha channel values in colors are clamped to [0.0, 1.0].
- `StylesheetParseError` is raised for invalid property names, invalid property values, unknown layout names, unknown easing functions, and invalid color values. The error object carries structured error information including per-rule error lists.
- Specificity ordering is strict: ID > class (regardless of count) > type. Equal specificity is broken by source order (last wins).
- User CSS always overrides Widget DEFAULT_CSS for the same property, even when DEFAULT_CSS uses `!important`.
- The mega stylesheet must parse end-to-end without error; the sentinel class `.---we-made-it-to-the-end---` at the bottom of the file serves as proof of complete parsing.
