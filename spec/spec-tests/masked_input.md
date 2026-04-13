# MaskedInput Widget

`MaskedInput` is a text input widget that constrains user input to a defined template pattern. It extends the standard input widget with template-based validation, automatic separator insertion, and case conversion.

## Construction

A `MaskedInput` is created with a `template` string and an optional `placeholder` string:

```python
MaskedInput(template=">9999-99-99", placeholder="YYYY-MM-DD")
```

### Template Syntax

A template string has the form `<directives><mask>[;<separator_char>]`.

The optional `;` suffix sets the character used to display unfilled positions (e.g., `;_` uses underscore).

#### Mask Characters

| Character | Meaning |
|-----------|---------|
| `9`       | Required digit (0-9). Non-digit keystrokes are rejected. |
| `0`       | Optional digit (0-9). Non-digit keystrokes are rejected. Validation passes even when unfilled. |
| `N`       | Required alphanumeric character (letter or digit). |

Any other character in the mask that is not a directive or escaped is treated as a **literal separator**. Separators are automatically inserted into the value as the user types past them and are not editable.

#### Directives (Case Conversion)

Directives appear in the template and control letter casing for subsequent mask characters:

| Directive | Effect |
|-----------|--------|
| `>`       | Convert following input to uppercase. |
| `<`       | Convert following input to lowercase. |
| `!`       | Cancel any active case conversion; input is left as-is. |

Directives apply to all characters that follow until another directive overrides them. A directive placed before the first mask character sets the initial conversion mode for the entire input.

#### Escaping

A backslash `\` before any character inserts that character as a literal separator. This allows mask characters and directives to appear as literal text: `N\aN\N\cN` produces a pattern where `a`, `N`, and `c` are literal separators between three alphanumeric slots.

### Separator Auto-insertion

When the user types a character that fills the position immediately before a separator, the separator is automatically appended to the value and the cursor advances past it. Backspacing from the position after a separator removes both the separator and the preceding character.

### Navigation

`MaskedInput` supports the standard cursor movement actions, with word-based movement respecting separator boundaries:

- **cursor_right_word**: Advances the cursor to the position just after the next separator (i.e., the start of the next "word" segment). If no separator exists ahead of the cursor, the cursor advances to the end of the value.
- **cursor_left_word**: Moves the cursor back to the start of the current or previous segment boundary.
- **cursor_right / cursor_left**: Move one position at a time, skipping over separator positions that are not user-editable.
- **home / end**: Move to the beginning or end of the value.

When the input is fully filled and valid, pressing additional characters at the end has no effect (the cursor does not advance and the character is discarded).

When the widget regains focus with a complete value, the cursor is placed at the end of the value.

### Editing Actions

Deletion operations clear the affected editable positions but preserve the separator structure:

- **delete_right**: Replaces the character at the cursor with a space (blank).
- **delete_left**: Removes the character before the cursor. If the cursor is immediately after a separator, the character before the separator is removed and the separator collapses.
- **delete_left_word / delete_right_word**: Clears characters from the cursor to the next segment boundary. Trailing separators are removed when all editable positions after them are empty.
- **delete_left_all / delete_right_all**: Clears all editable characters to the left or right of the cursor.
- **clear()**: Resets the value to the empty string.

### Validation

`MaskedInput` validates its value against the template automatically:

- A value that does not fill all **required** positions (`9`, `N`) is invalid. The widget's `is_valid` property returns `False`, and `Changed`/`Submitted` events carry a `ValidationResult` with a `Failure` whose description is `"Value does not match template!"`.
- A value where all required positions are filled (optional positions may be empty) is valid. Events carry `ValidationResult.success()`.
- Keystrokes that do not match the expected character class for the current position are silently rejected (the value does not change).

### Events

`MaskedInput` emits the same event types as the standard `Input` widget:

- **MaskedInput.Changed**: Fired when the value changes. Carries `validation_result`.
- **MaskedInput.Submitted**: Fired on submit. Carries `validation_result`.

## Constraints

- A template containing only separators and no editable mask characters raises `ValueError`.
- The `template` parameter is required; there is no default template.
- Literal separators in the value are part of `input.value` but do not count as user-editable positions.
- Case conversion directives affect only letter input; digits pass through unmodified.
- Optional positions (`0`) allow validation to pass when unfilled, but still reject non-digit input.
