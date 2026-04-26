# Docs Spec: Input Widget

## Purpose
Document the `Input` widget — a focusable, scrollable, single-line text input with optional masking, restrict patterns, typed validation, suggesters, and emit-on-change/submit/blur event semantics — so readers can build forms, command bars, and search fields in a textual-js app.

## Audience
Forms and command-bar authors; app authors implementing validation UX; widget authors extending or composing Input.

## Required sections
1. Overview — what `Input` is and when to use it vs. `TextArea`.
2. Importing and mounting.
3. Props / options — every constructor option, with default, type, and description. Includes `value`, `placeholder`, `password`, `restrict`, `type`, `maxLength`, `suggester`, `validators`, `validateOn`, `validEmpty`, `selectOnFocus`, `compact`, `highlighter`, `tooltip`, plus standard widget props.
4. Reactive attributes — `cursorBlink`, `value`, `selection`, `placeholder`, `password`, `compact`.
5. Selection model — `Selection` with `start` and `end`, cursor-only selections, `isEmpty`.
6. Input types — the `text` / `integer` / `number` modes, their built-in restrict patterns, and their default validators (only applied when no explicit validators are provided).
7. Messages / events — `Changed`, `Submitted`, `Blurred`, each with `value`, optional `validationResult`, and `control` alias.
8. Validation — how validators run per event, the `-invalid` and `-valid` TCSS classes, `validEmpty`, and the public `validate()` method.
9. Restrict behavior — the restrict regex is matched against the proposed full value, not just the new character; regex must accept intermediate states.
10. Max length — enforced on typing and paste (paste is truncated).
11. Suggester — displays dimmed suggestion after cursor; pressing Right at end of value accepts.
12. Key bindings — the full bindings table (cursor movement, word motions, selection, editing, cut/copy/paste, submit).
13. Component classes — `input--cursor`, `input--placeholder`, `input--suggestion`, `input--selection`.
14. Automatic CSS classes — `-invalid`, `-valid`, `-textual-compact`.
15. Public methods — `insertTextAtCursor`, `insert`, `clear`, `selectAll`, `validate`.
16. Styling — default TCSS for normal, focused, invalid, and compact states.
17. Examples — simple value binding, controlled input with React state, submit handler, validated input, restrict-based binary input, suggester usage, compact borderless input.

## Key concepts
- A single-line text input with scrolling for overflow.
- Validation is event-driven (`changed`, `submitted`, `blur`).
- `restrict` is a gating regex against the full proposed value — not a character filter.
- `type` is a convenience that sets a restrict pattern and a default validator simultaneously.
- Suggesters provide inline auto-complete rendered with a dimmed style.
- Selection is a named range `{ start, end }` and a zero-width selection represents the cursor.
- `valid` and `invalid` are TCSS states the app can style.

## Behaviors and contracts
- `value` is reactive; observers re-render on change.
- Validators run only for events included in `validateOn`.
- Validation fails if any validator fails (logical AND of success).
- `validEmpty = true` means an empty string bypasses all validators.
- The `-invalid` class is applied/removed automatically based on the latest validation result.
- Default validators for `integer` / `number` are only applied when `validators` is not provided.
- Setting `cursorPosition` produces a zero-width selection at that index.
- Pressing Right at end of value with an active suggestion accepts the suggestion.
- Pasting text that exceeds `maxLength` is truncated to fit.
- The `Changed`, `Submitted`, `Blurred` events carry the validation result only when validators are configured and the corresponding event is in `validateOn`.
- The compact style removes the border and collapses height to 1 row via the `-textual-compact` class.

## Example requirements
All examples are JSX/TypeScript using Ink primitives.
- Controlled input bound to MobX-observable state with a Submitted handler.
- Input with a custom validator array and an `onChanged` handler that inspects `validationResult`.
- Binary input using `restrict: "[01]*"` demonstrating that the regex must match intermediate values.
- Typed numeric input (`type: "integer"`) that relies on the built-in validator.
- Input with a password prop that masks characters.
- Input with a suggester providing auto-completion suggestions.
- Compact input without borders.

## Cross-references
- Related docs specs: `spec/docs-spec/widget_masked_input.md`, `spec/docs-spec/widget_text_area.md`, `spec/docs-spec/actions_and_bindings.md`, `spec/docs-spec/api_on.md`.
- Related behavioral specs: `spec/spec-src/09-widget-base-contract.md`, `spec/spec-src/10-widget-catalog.md`, `spec/spec-src/06-input-bindings-actions-and-commands.md`, `spec/spec-src/11-text-editing-and-document-model.md`, `spec/spec-src/03-message-event-and-dispatch.md`.

## Notes for writers
- Do not describe Python `Validator` classes with inheritance. Describe validators as objects/functions with a well-defined contract returning a result (see the validation portion of the widget-contract spec).
- `Suggester` should be framed as a pluggable object providing suggestions (sync or async) — not a Python class hierarchy.
- `InputType` is a union of string literals in TypeScript (`"text" | "integer" | "number"`), not a Python `Literal`.
- Do not refer to `strftime`, `NamedTuple`, or Python dataclasses. Describe `Selection` as an object/interface with two integer fields and an `isEmpty` helper.
- `Highlighter` comes from Rich; in textual-js, describe this as optional content highlighting (tie to the terminal rendering pipeline) — only document it if textual-js actually exposes an equivalent. If not, omit from the docs and note the absence.
- Clipboard bindings (`ctrl+x`, `ctrl+c`, `ctrl+v`) depend on the driver's clipboard integration; link to the drivers spec for capability notes.
- The bindings table is the authoritative list; be explicit that all bindings have standard semantics (no hidden ones).
- Do not mention Python decorators for handlers (`on_input_changed`). Describe event handling via the textual-js `on` mechanism or React-style event callbacks.
