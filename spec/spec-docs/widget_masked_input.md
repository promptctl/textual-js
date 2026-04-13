# MaskedInput Widget

Specification for the `MaskedInput` widget (`textual.widgets.MaskedInput`), a text input that restricts and guides user input via a template mask.

## Overview

Added in version 0.80.0.

`MaskedInput` extends `Input`. It constrains each character position to a pattern defined by a template string. The template also acts as an implicit validator: the input value is valid only when all required positions are filled with matching characters. Separators defined in the template are inserted automatically as the user types.

- Focusable: Yes
- Container: No

## Constructor

```python
MaskedInput(
    template: str,
    value: str | None = None,
    placeholder: str = "",
    *,
    validators: Validator | Iterable[Validator] | None = None,
    validate_on: Iterable[InputValidationOn] | None = None,
    valid_empty: bool = False,
    select_on_focus: bool = True,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
    tooltip: RenderableType | None = None,
    compact: bool = False,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `template` | `str` | (required) | Template mask string defining allowed characters per position. |
| `value` | `str \| None` | `None` | Optional default value. Must conform to the template. |
| `placeholder` | `str` | `""` | Placeholder text. Overrides the template's `;c` placeholder character. |
| `validators` | `Validator \| Iterable[Validator] \| None` | `None` | Additional validators beyond the implicit template validator. |
| `validate_on` | `Iterable[InputValidationOn] \| None` | `None` | When to validate: `"blur"`, `"changed"`, `"submitted"`. Default is all three. |
| `valid_empty` | `bool` | `False` | Whether an empty value passes validation. |
| `select_on_focus` | `bool` | `True` | Select all text when the widget gains focus. |
| `compact` | `bool` | `False` | Render without borders. |

## Template String Format

The template defines the maximum length of input. Each character is either a mask character (constraining user input at that position) or a literal separator (auto-inserted).

### Mask Characters

| Mask | Regex | Required |
|---|---|---|
| `A` | `[A-Za-z]` | Yes |
| `a` | `[A-Za-z]` | No |
| `N` | `[A-Za-z0-9]` | Yes |
| `n` | `[A-Za-z0-9]` | No |
| `X` | `[^ ]` | Yes |
| `x` | `[^ ]` | No |
| `9` | `[0-9]` | Yes |
| `0` | `[0-9]` | No |
| `D` | `[1-9]` | Yes |
| `d` | `[1-9]` | No |
| `#` | `[0-9+\-]` | No |
| `H` | `[A-Fa-f0-9]` | Yes |
| `h` | `[A-Fa-f0-9]` | No |
| `B` | `[0-1]` | Yes |
| `b` | `[0-1]` | No |

Uppercase mask characters denote required positions; lowercase (or `#`) denote optional positions. A required position must contain a matching character for the input to be considered valid.

### Case Conversion Directives

| Directive | Effect |
|---|---|
| `>` | Force all subsequent user input to uppercase. |
| `<` | Force all subsequent user input to lowercase. |
| `!` | Disable automatic case conversion. |

These directives do not occupy a character position; they affect all mask positions that follow until the next directive.

### Separators

Any character in the template that is not a mask character or directive is treated as a separator. Separators are auto-inserted when the cursor reaches their position. The user does not need to type them.

To use a mask character literally as a separator, escape it with `\` (e.g., `\9` inserts a literal `9`).

### Placeholder Suffix

The template can end with `;c` where `c` is the placeholder character displayed in unfilled positions. The default placeholder character is a space. The `placeholder` constructor parameter overrides this, allowing per-position placeholder characters.

### Examples

| Template | Purpose |
|---|---|
| `9999-9999-9999-9999;0` | Credit card number (16 required digits, `-` separators, `0` as placeholder) |
| `(999) 999-9999` | US phone number |
| `>Aaaaaaaaa` | Name field, first character uppercase |
| `HH:HH:HH:HH:HH:HH` | MAC address |

### Validation

A template with only separators and no mask positions raises `ValueError` at construction time.

## Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `template` | `str` | `""` | The template mask string. Changing it re-creates the internal template and revalidates the current value. |

All reactive attributes inherited from `Input` (e.g., `value`, `placeholder`, `password`, `cursor_position`) also apply.

## Validation Behavior

`MaskedInput` combines the template as an implicit validator with any user-supplied validators. The result is merged: if any validator fails, the combined result is invalid.

- The `-valid` and `-invalid` CSS pseudo-classes are set based on the combined validation result.
- Textual provides default styling for `-invalid` (red border). Apps can style `-valid` as needed.

Setting `value` programmatically also validates against the template; a `ValueError` is raised if the value does not match.

## Messages

`MaskedInput` inherits messages from `Input`:

| Message | When |
|---|---|
| `MaskedInput.Changed` | The value changes (by user input or programmatically). |
| `MaskedInput.Submitted` | The user presses Enter. |

Both messages carry the same attributes as `Input.Changed` and `Input.Submitted` respectively.

## Cursor Behavior

The cursor skips over separator positions automatically during all movement and editing operations:

- Clicking on a separator position advances the cursor to the next non-separator position.
- Left/right arrow movement skips separators.
- Word-level movement (`ctrl+left`, `ctrl+right`) jumps between separator boundaries.
- Home moves to the first non-separator position.

## Actions and Bindings

`MaskedInput` overrides several `Input` actions to respect the template:

| Action | Behavior |
|---|---|
| `action_cursor_left` | Move cursor left, skipping separators. |
| `action_cursor_right` | Move cursor right, skipping separators. |
| `action_home` | Move cursor to start of input. |
| `action_cursor_left_word` | Move cursor left to previous separator boundary. |
| `action_cursor_right_word` | Move cursor right to next separator boundary. |
| `action_delete_right` | Delete character at cursor (replaces with space; does not shift). |
| `action_delete_right_word` | Delete from cursor to next separator or end. |
| `action_delete_left` | Move cursor left then delete at that position. |
| `action_delete_left_word` | Delete from previous separator boundary to cursor. |
| `action_delete_left_all` | Delete all characters left of cursor (replaces with empty mask). |

Key bindings are inherited from `Input`.

## Editing Model

Unlike a free-form `Input`, `MaskedInput` uses a fixed-width replacement model:

- Characters are never shifted left or right; deleting a character replaces it with a space rather than collapsing the value.
- Trailing spaces and trailing separators are trimmed from the stored value.
- Inserting text that does not match the pattern at the current position triggers `restricted()` (visual feedback, no change to value).
- When the user types a separator character that matches the next expected separator, intervening positions are filled with spaces and the cursor advances past the separator.

## Methods

| Method | Description |
|---|---|
| `clear()` | Reset the value to empty (with leading separators re-inserted if applicable). |
| `insert_text_at_cursor(text)` | Insert text at the cursor position, respecting the template. Non-matching text triggers `restricted()`. |

## Component Classes

Inherits component classes from `Input`:

| Class | Purpose |
|---|---|
| `input--cursor` | Styles the cursor. |
| `input--placeholder` | Styles placeholder text and unfilled mask positions. |
| `input--suggestion` | Styles auto-complete suggestions. |

## CSS Classes

| Class | When Applied |
|---|---|
| `-valid` | The current value passes all validators (template + user-supplied). |
| `-invalid` | The current value fails any validator. |

## Usage Example

```python
from textual.app import App, ComposeResult
from textual.widgets import MaskedInput

class MyApp(App):
    CSS = """
    MaskedInput.-valid {
        border: tall $success 60%;
    }
    MaskedInput.-valid:focus {
        border: tall $success;
    }
    """

    def compose(self) -> ComposeResult:
        yield MaskedInput(template="9999-9999-9999-9999;0")
```
