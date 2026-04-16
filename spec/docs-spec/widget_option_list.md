# Docs Spec: OptionList Widget

## Purpose
Describes the `OptionList` widget — a scrollable, focusable vertical list of selectable options with keyboard and mouse navigation, optional visual dividers, per-option disable, ID-based lookup, and support for plain text, markup, or rich content prompts. Teaches readers how to construct, mutate, query, and respond to selection in an option list.

## Audience
Application authors building menus, pickers, or any single-selection list UI. Also readers who want to understand the foundation used by `SelectionList` and similar list-derived widgets.

## Required sections
1. Overview (focusable scroll view of selectable options, single-highlight model)
2. Characteristics (focusable, not a container, scrollable)
3. Option content (plain string, markup, rich content; the `Option` type; separator via `null`/`None`)
4. Props / constructor (options-as-variadic, `markup`, `compact`, standard widget props)
5. Reactive attributes (`highlighted`, `compact`) with validation/clamping rules
6. Properties (`options`, `optionCount`, `highlightedOption`)
7. Messages (`OptionMessage` base, `OptionHighlighted`, `OptionSelected`) with payload shapes
8. Bindings (`up`/`down`/`home`/`end`/`pageUp`/`pageDown`/`enter`) and their actions
9. Component classes for styling option, disabled, highlighted, hover, separator (and priority order)
10. Methods — add/remove (`addOption`, `addOptions`, `setOptions`, `removeOption`, `removeOptionAtIndex`, `clearOptions`)
11. Methods — retrieve (`getOption`, `getOptionAtIndex`, `getOptionIndex`)
12. Methods — enable/disable (`enableOption`, `disableOption`, `enableOptionAtIndex`, `disableOptionAtIndex`)
13. Methods — replace prompt (`replaceOptionPrompt`, `replaceOptionPromptAtIndex`)
14. Methods — scrolling (`scrollToHighlight`)
15. Mouse interaction (click to select, hover tracking, leave-clear)
16. Errors (`OptionListError`, `DuplicateID`, `OptionDoesNotExist`)
17. Default TCSS and focus/blurred styling
18. Usage patterns

## Key concepts
- `Option` is the canonical representation of a list entry: prompt + optional id + disabled flag; options are identified by identity, not value equality — two options with the same prompt are still distinct
- A `null` entry in the options list is a purely visual divider and is not selectable
- The widget's `highlighted` reactive is the single source of truth for which option is active
- Navigation actions always skip disabled options — selection can never land on a disabled option
- Disabling the currently-highlighted option automatically advances the highlight to the next enabled option (invariant preservation)
- Options-as-data: content can be plain strings (parsed as markup if `markup=true`), rich content, or fully constructed `Option` instances
- IDs are optional; methods that accept an ID throw `OptionDoesNotExist` when the ID is not present
- Adding two options with the same ID throws `DuplicateID`

## Behaviors and contracts
- `highlighted` validation: values < 0 clamp to 0; values >= `optionCount` clamp to `optionCount - 1`; if there are no options, it becomes `null`
- Changing `highlighted` to a non-disabled option scrolls the new option into view and emits `OptionHighlighted`
- `OptionSelected` is emitted for Enter-key activation or mouse click on a non-disabled option (clicks on disabled options are ignored)
- Clicking an option sets `highlighted` and triggers the select action in the same gesture
- Mouse movement updates hover state; leaving the widget clears it
- Styling precedence when multiple states apply to one option: disabled > highlighted > hover
- Page-navigation actions scan in the movement direction when the target would land on a disabled option, preserving "navigation never lands on disabled"
- On construction, if any enabled options are provided, `highlighted` is set to the first enabled option
- All list-mutating methods return the widget instance to support chaining
- `compact` toggles a CSS class that removes border and padding (single source of truth for the visual variant)

## Example requirements
All JSX/TypeScript using Ink primitives and React function components wrapped with `observer()`. Cover:
- Minimal construction with plain strings
- Construction with `Option` instances, IDs, and a separator (`null`)
- Rich/marked-up prompt content
- Handling `OptionSelected` to read `option`, `optionIndex`, `optionId`
- Programmatic addition and removal via `addOption`/`removeOption`
- Disabling an option after mount
- Replacing an option's prompt dynamically
- Using `compact` for a chromeless variant

## Cross-references
- `spec/docs-spec/widget_selection_list.md` (when present) — multi-select variant
- `spec/docs-spec/widget_radioset.md` — another selection-style container
- `spec/docs-spec/api_content.md` — rich text / markup content type
- `spec/spec-src/02-dom-reactivity-and-query.md` — reactive attribute and lookup semantics
- `spec/spec-src/10-widget-catalog.md` — widget catalog entry
- `spec/spec-src/06-input-bindings-actions-and-commands.md` — bindings and actions

## Notes for writers
- Python's `VisualType` / `RenderableType` become whatever the port exposes for rich prompts (React node or the port's Content type); do not invent a name
- `on_option_list_option_selected`-style handler naming is Python-specific; in the port, document subscription via the message bus or `on()` equivalent
- Do not describe `Sequence[Option]` — use JS terms like "read-only array of options"
- `OptionListContent` as a TypeAlias should be documented as the union type accepted by the constructor and mutation APIs, phrased in TypeScript
- Identity-based hashing is not a JS idiom — describe simply that two `Option` instances are always distinct even when their prompts match, without invoking `id()`/identity hashing
- Do not reproduce Python action method names (`action_cursor_up`); describe action names as they are registered in the port
- The `-textual-compact` class name may or may not be the same in the port; check how compact mode is realized in the code and use the actual class name
