# Docs Spec: MaskedInput Widget

## Purpose
Describes the `MaskedInput` widget — a text input that constrains each character position to a template mask (e.g., credit cards, phone numbers, MAC addresses, license keys) with implicit validation based on the template. Teaches readers how to define templates, interpret validation state, and customize behavior beyond what `Input` already provides.

## Audience
Application authors needing structured text entry for fixed-format values (dates, payment info, identifiers). Assumes familiarity with the base `Input` widget.

## Required sections
1. Overview (relationship to `Input`, purpose of a mask, auto-inserted separators)
2. Characteristics (focusable, not a container)
3. Props (template, initial value, placeholder, validators, `validateOn`, `validEmpty`, `selectOnFocus`, `compact`, standard widget props)
4. Template string format (mask characters table, required vs. optional, case-conversion directives, separators, escaping, placeholder suffix)
5. Template examples (credit card, phone, MAC, uppercased name)
6. Reactive attributes (`template`, plus inherited from `Input`)
7. Validation behavior (implicit template validator, composition with user validators, `-valid`/`-invalid` CSS classes)
8. Messages (`Changed`, `Submitted`) — note these are inherited from `Input`
9. Cursor behavior (separator skipping across arrow/word/home movements, click-to-non-separator)
10. Editing model (fixed-width replacement, no shifting, trimming of trailing spaces/separators, `restricted` visual feedback for non-matching input, separator-typing advances cursor)
11. Actions and bindings (per-action behavior, inherited bindings)
12. Methods (`clear`, `insertTextAtCursor`)
13. Component classes (inherited: `input--cursor`, `input--placeholder`, `input--suggestion`)
14. CSS state classes (`-valid`, `-invalid`)
15. Usage example

## Key concepts
- Mask characters define per-position constraints (letter/digit/hex/binary/etc., required vs. optional)
- Case-conversion directives (`>`, `<`, `!`) shift input case from the directive onward — they are not positional
- Separators are literal template characters that auto-insert as the user crosses them
- Escape character `\` promotes a mask-character glyph to literal separator
- The template is itself a validator — the input is only valid when all required positions are filled
- `Input.validators` stacks with the template validator (all-must-pass)
- The editing model is fixed-width, not insert-shift: delete writes a space rather than collapsing — callers must understand this to avoid surprises when diffing values
- Separator auto-fill: typing a matching separator character fills intervening positions with spaces and jumps the cursor

## Behaviors and contracts
- Construction with a template that has no mask positions (only separators) is an error
- `value` set programmatically must conform to the template or the setter rejects it
- `-valid` and `-invalid` classes are mutually exclusive and reflect the combined validator result
- Cursor motion (`left`, `right`, `home`, word-left, word-right) never lands on a separator
- Clicking on a separator position advances the cursor to the next non-separator position
- `delete-right` replaces the character at cursor with a space (fixed-width model); `delete-right-word` clears up to the next separator or end
- `delete-left` moves cursor left then clears at the new position; `delete-left-word` clears back to the previous separator
- `delete-left-all` clears the entire prefix (resetting to empty mask) to the left of the cursor
- `insertTextAtCursor` advances through template positions; text that does not match triggers the restricted-input feedback hook (no value change)
- Trailing spaces and trailing separator runs are trimmed from the stored value (the visible placeholder or separator characters are not part of the value)

## Example requirements
All JSX/TypeScript using Ink primitives and React function components wrapped with `observer()`. Cover:
- Credit-card template with `-` separators and a digit placeholder suffix
- Phone-number template with parentheses as separators
- MAC-address template using hex mask characters
- Uppercase-forcing template using the `>` directive
- Composing the template validator with a user-supplied validator and reading `-valid`/`-invalid` state
- Styling `-valid`/`-invalid` via TCSS

## Cross-references
- `spec/docs-spec/widget_input.md` (when present) — base input widget
- `spec/docs-spec/api_validation.md` — validator composition
- `spec/spec-src/06-input-bindings-actions-and-commands.md` — actions and bindings pipeline
- `spec/spec-src/10-widget-catalog.md` — widget catalog entry
- `spec/spec-src/11-text-editing-and-document-model.md` — editing model

## Notes for writers
- Python's `Iterable[Validator]` becomes a JS array/iterable; do not leak Python type syntax
- Replace Python action-method names (`action_cursor_left`, etc.) with the action names registered in the port's action registry; describe behavior, not Python method naming
- Python's `ValueError` at construction-time with no mask positions becomes a thrown `Error` or validation result in the port — use the language the port uses
- `ContentText` in Python becomes whatever rich-text/plain-string union the port exposes for labels; do not introduce a fictional type
- Do not mention `Rich` or `RenderableType` — tooltips accept whatever the port's widget base exposes (likely string or React node)
- The restricted-input feedback (`restricted()`) should be described as a hook/event, not a Python method reference
- Make clear this widget does not behave like free-form `Input`: the fixed-width model is a frequent source of confusion and should be called out explicitly
