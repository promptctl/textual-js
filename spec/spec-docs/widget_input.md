# Input Widget Spec

Single-line text input widget. Extends `ScrollView`. Focusable, not a container.

## Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `value` | `str \| None` | `None` | Initial value |
| `placeholder` | `str` | `""` | Placeholder text shown when empty |
| `highlighter` | `Highlighter \| None` | `None` | Rich highlighter for input text |
| `password` | `bool` | `False` | Mask input characters |
| `restrict` | `str \| None` | `None` | Regex to restrict valid characters (keyword-only) |
| `type` | `InputType` | `"text"` | Input type: `"text"`, `"integer"`, or `"number"` (keyword-only) |
| `max_length` | `int` | `0` | Maximum character length; 0 means unlimited (keyword-only) |
| `suggester` | `Suggester \| None` | `None` | Auto-completion suggester (keyword-only) |
| `validators` | `Validator \| Iterable[Validator] \| None` | `None` | Validators for the input value (keyword-only) |
| `validate_on` | `Iterable[InputValidationOn] \| None` | `None` | When to validate: subset of `{"blur", "changed", "submitted"}`; `None` means all three (keyword-only) |
| `valid_empty` | `bool` | `False` | Empty values bypass validation (keyword-only) |
| `select_on_focus` | `bool` | `True` | Select all text when focused (keyword-only) |
| `compact` | `bool` | `False` | Compact style without borders (keyword-only) |
| `name` | `str \| None` | `None` | Widget name (keyword-only) |
| `id` | `str \| None` | `None` | Widget ID (keyword-only) |
| `classes` | `str \| None` | `None` | CSS classes (keyword-only) |
| `disabled` | `bool` | `False` | Whether disabled (keyword-only) |
| `tooltip` | `RenderableType \| None` | `None` | Tooltip text (keyword-only) |

## Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `cursor_blink` | `bool` | `True` | Whether cursor blinks |
| `value` | `str` | `""` | Current text value |
| `selection` | `Selection` | `Selection.cursor(0)` | Current selection range (start, end) |
| `placeholder` | `str` | `""` | Placeholder text when input is empty |
| `password` | `bool` | `False` | Mask input content |
| `compact` | `bool` | `False` | Compact style (toggles `-textual-compact` class) |

## Non-Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `restrict` | `str \| None` | `None` | Regex to restrict input; applied to full value |
| `type` | `InputType` | `"text"` | Input type (`"text"`, `"integer"`, `"number"`) |
| `max_length` | `int \| None` | `None` | Maximum input length |
| `valid_empty` | `bool` | `False` | Empty values pass validation |
| `suggester` | `Suggester \| None` | - | Auto-completion suggester |
| `validators` | `list[Validator]` | `[]` | List of validators |
| `validate_on` | `set[str]` | `{"blur", "changed", "submitted"}` | Events that trigger validation |

## Properties

| Name | Type | Description |
|---|---|---|
| `cursor_position` | `int` (get/set) | Index of cursor in value string; setter creates a cursor-only selection |

## Selection

`Selection` is a `NamedTuple` with fields `start: int` and `end: int`.

- `Selection.cursor(pos)` -- class method creating a zero-width selection (cursor) at `pos`.
- `Selection.is_empty` -- property, `True` when `start == end`.

## Input Types

Setting `type` applies a built-in `restrict` regex and a default validator:

| `type` | Restrict Pattern | Auto Validator |
|---|---|---|
| `"text"` | None | None |
| `"integer"` | `r"[-+]?(?:\d*\|\d+_)*"` | `Integer()` |
| `"number"` | `r"[-+]?(?:\d*\|\d+_)*\.?(?:\d*\|\d+_)*(?:\d[eE]?[-+]?(?:\d*\|\d+_)*)?"` | `Number()` |

Auto validators are only added when no explicit validators are supplied.

## Messages

All messages are dataclasses with attributes `input: Input`, `value: str`, `validation_result: ValidationResult | None`, and a `control` property aliasing `input`.

### Input.Changed

Posted when the value changes. Handler: `on_input_changed`. Validation result is present only if `"changed"` is in `validate_on` and validators are configured.

### Input.Submitted

Posted when Enter is pressed. Handler: `on_input_submitted`. Validation result is present only if `"submitted"` is in `validate_on` and validators are configured.

### Input.Blurred

Posted when the input loses focus. Handler: `on_input_blurred`. Validation result is present only if `"blur"` is in `validate_on` and validators are configured.

## Validation

- Validators run when the corresponding event is in `validate_on`.
- Validation fails if **any** validator fails.
- When `valid_empty=True`, an empty string bypasses all validators and is considered valid.
- The `-invalid` CSS class is automatically applied/removed based on validation state.
- The `validate(value)` method runs all validators and returns a `ValidationResult` or `None`.

## Key Bindings

| Key(s) | Action | Description |
|---|---|---|
| `left` | `cursor_left` | Move cursor left |
| `shift+left` | `cursor_left(True)` | Move cursor left and select |
| `ctrl+left` | `cursor_left_word` | Move cursor left one word |
| `ctrl+shift+left` | `cursor_left_word(True)` | Move cursor left one word and select |
| `right` | `cursor_right` | Move cursor right or accept completion suggestion |
| `shift+right` | `cursor_right(True)` | Move cursor right and select |
| `ctrl+right` | `cursor_right_word` | Move cursor right one word |
| `ctrl+shift+right` | `cursor_right_word(True)` | Move cursor right one word and select |
| `backspace` | `delete_left` | Delete character left of cursor |
| `delete`, `ctrl+d` | `delete_right` | Delete character right of cursor |
| `ctrl+shift+a` | `select_all` | Select all text |
| `home`, `ctrl+a` | `home` | Move cursor to start |
| `end`, `ctrl+e` | `end` | Move cursor to end |
| `shift+home` | `home(True)` | Select from cursor to start |
| `shift+end` | `end(True)` | Select from cursor to end |
| `enter` | `submit` | Submit the input value |
| `ctrl+w` | `delete_left_word` | Delete word left of cursor |
| `ctrl+u` | `delete_left_all` | Delete all left of cursor |
| `ctrl+f` | `delete_right_word` | Delete word right of cursor |
| `ctrl+k` | `delete_right_all` | Delete all right of cursor |
| `ctrl+x` | `cut` | Cut selected text |
| `ctrl+c`, `super+c` | `copy` | Copy selected text |
| `ctrl+v` | `paste` | Paste from clipboard |

## Component Classes

| Class | Description |
|---|---|
| `input--cursor` | Targets the cursor |
| `input--placeholder` | Targets placeholder text |
| `input--suggestion` | Targets auto-completion suggestion |
| `input--selection` | Targets selected text |

## CSS Classes (Auto-Applied)

| Class | Condition |
|---|---|
| `-invalid` | Applied when validation fails |
| `-valid` | Available for user styling when validation passes |
| `-textual-compact` | Applied when `compact=True` |

## Default CSS

- `background: $surface`, `color: $foreground`
- `padding: 0 2`, `border: tall $border-blurred`, `width: 100%`, `height: 3`
- On focus: `border: tall $border`, `background-tint: $foreground 5%`
- When invalid: `border: tall $error 60%` (unfocused), `border: tall $error` (focused)
- Compact mode: `border: none`, `height: 1`, `padding: 0`; invalid uses `background-tint: $error 20%`

## Public Methods

| Method | Signature | Description |
|---|---|---|
| `insert_text_at_cursor` | `(text: str) -> None` | Insert text at the current cursor position |
| `insert` | `(text: str, index: int) -> None` | Insert text at a specific index |
| `clear` | `() -> None` | Clear the input value |
| `select_all` | `() -> None` | Select all text |
| `validate` | `(value: str) -> ValidationResult \| None` | Run validators against a value |

## Restrict Behavior

The `restrict` regex is tested against the **full value** after a proposed edit, not just the new character. If the new value would not match the regex, the edit is rejected. This means the regex must match partial/intermediate states (e.g., `r"[01]*"` for binary input allows empty string and any combination of 0s and 1s).

## Max Length Behavior

When `max_length` is set to a value greater than zero, additional character input is blocked once the value reaches that length. Pasted text is truncated to fit.

## Suggester Integration

When a `Suggester` is provided, the input displays auto-completion suggestions as dimmed text after the cursor. Pressing `right` when the cursor is at the end of the value accepts the suggestion.
