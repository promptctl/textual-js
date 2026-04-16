# Docs Spec: RadioButton Widget

## Purpose
Describes the `RadioButton` widget — a labeled, focusable toggle with a circular on/off indicator, almost always used inside a `RadioSet` for mutually exclusive selection. Teaches readers how to construct, bind, handle changes, and style a radio button.

## Audience
Application authors building forms, settings panels, and any single-choice selection UI. Readers looking for independent boolean toggles should be pointed at `Checkbox`.

## Required sections
1. Overview (boolean toggle with radio-button glyph, relationship to `RadioSet`)
2. Characteristics (focusable, not a container)
3. Props (`label`, `value`, `buttonFirst`, `tooltip`, `compact`, standard widget props)
4. Reactive attributes (`value`, `compact`)
5. Properties (`label`)
6. Methods (`toggle`)
7. Messages (`Changed`) with payload shape
8. Bindings (`enter`, `space` → toggle)
9. Component classes (`toggle--button`, `toggle--label`)
10. CSS state classes (`-on`, compact-mode class)
11. Visual representation (left/inner/right glyph composition and `-on` color)
12. Relationship to RadioSet (mutual exclusion, behavior outside a RadioSet)
13. Usage patterns

## Key concepts
- `RadioButton` stores a boolean value and emits a `Changed` message when it changes
- The widget is three glyphs wide: left bracket glyph, inner fill glyph, right bracket glyph. The inner glyph is a filled circle (overriding the `X` used by `ToggleButton`/`Checkbox`)
- The `-on` class is toggled automatically when `value` changes — it is not set manually
- `buttonFirst` controls whether the indicator renders before or after the label (layout data, not conditional logic)
- Outside a `RadioSet`, multiple radio buttons operate independently — but this is not the intended usage pattern; authors who want independent booleans should use `Checkbox`

## Behaviors and contracts
- Setting `value` (programmatically or via `toggle()`) emits `Changed` and updates the `-on` class
- `toggle()` inverts `value` and returns the widget for chaining
- `Changed` carries the new `value`, a reference to the radio button, and a `control` alias for the radio button (used by the port's `on()`-style selector matching)
- `enter` and `space` key events invoke the toggle action when the widget has focus
- `compact` toggles a CSS class that removes border and padding

## Example requirements
All JSX/TypeScript using Ink primitives and React function components wrapped with `observer()`. Cover:
- Standalone radio button (to demonstrate that it works outside a set, though this is not recommended)
- Radio buttons inside a `RadioSet` for mutually exclusive selection
- Handling `Changed` to react to state changes
- Rich-text label (e.g., a label with inline emphasis via the port's content/markup type)
- Using `buttonFirst={false}` for label-first layout
- Styling via the `toggle--button`, `toggle--label`, and `-on` classes

## Cross-references
- `spec/docs-spec/widget_radioset.md` — the enclosing container that provides mutual exclusion
- `spec/docs-spec/widget_checkbox.md` (when present) — independent boolean toggle
- `spec/spec-src/10-widget-catalog.md` — widget catalog entry
- `spec/spec-src/06-input-bindings-actions-and-commands.md` — bindings and actions
- `spec/spec-src/04-styling-and-css-engine.md` — component-class styling

## Notes for writers
- Python's `ContentText` / `RenderableType` becomes the port's label/tooltip type (string or the port's content value); do not introduce Python names
- Do not describe the Python inheritance chain (`RadioButton → ToggleButton → Static → Widget`) — describe the widget's behavior, not the Python MRO; authors do not subclass in the React-component model
- Event handler naming (`on_radio_button_changed`) is Python-specific; describe subscription via the port's message API or `on()` equivalent
- Visual glyphs (`▐`, `●`, `▌`) are shipped defaults — mention them but note they may be overridable via component-class styling in the port
- Do not document `ToggleButton` as a user-facing API unless the port exposes it as such; describe the behavior directly on `RadioButton`
- The Python docs describe `BUTTON_INNER` as overriding `ToggleButton`'s `"X"` — this is an inheritance-ordering detail that does not need to be documented in the port
