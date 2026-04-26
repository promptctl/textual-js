# Docs Spec: Input Handling

## Purpose
Describes the doc page that teaches how textual-js receives and routes keyboard and mouse input: key events, the focus system, key bindings, mouse events (including capture, enter/leave, click, scroll), and event propagation rules.

## Audience
Widget authors and application authors who need to handle user input — either by listening for events directly, by declaring bindings, or by participating in the focus system.

## Required sections
1. Keyboard input: Key events, key attributes (`key`, `character`, `name`, `isPrintable`, `aliases`).
2. Key methods / key-specific handlers: convenience path for experimentation, with a note that bindings + actions are preferred in production.
3. Focus system: one focused widget at a time, `canFocus` semantics, disabled widgets cannot focus.
4. Focus navigation: Tab / Shift+Tab; the `:focus` CSS pseudo-selector.
5. Programmatic focus: calling `focus()` on a widget; startup default focus behavior.
6. Focus events: Focus and Blur.
7. Key bindings: the `BINDINGS` declaration and what each entry maps.
8. Binding entries: tuple shorthand `(key, action, description)` vs. full Binding objects for advanced options.
9. Multi-key bindings: comma-separated key lists share one action.
10. Binding resolution order: focused widget first, walking up the DOM to the App.
11. Priority bindings: reverse order, App-first; the default quit binding uses this.
12. Show bindings: the Footer displays bindings with `show: true`; some defaults opt out.
13. Dynamic binding behavior: bindings are static at declaration; use dynamic actions (check-action) to conditionally enable/disable.
14. Mouse input: coordinate system (x, y cell-based; screen- vs. widget-relative).
15. Mouse movement: MouseMove, coordinates, modifier state.
16. Mouse capture and release: `captureMouse()` / `releaseMouse()`; captured events may report negative coordinates.
17. Enter / Leave: bubbling, distinguishing originating widget via `event.node`.
18. Click lifecycle: MouseDown -> MouseUp -> Click; guidance to prefer Click.
19. Scroll events: MouseScrollUp/Down/Left/Right; scrollable containers handle them automatically.
20. Event propagation summary: focused-widget path for keys, cursor path (or capturing widget) for mouse, bubble behavior for Enter/Leave.

## Key concepts
- Key events are delivered to the focused widget and then walk up the DOM looking for a matching binding.
- `can_focus` + not disabled is the gate for focusability; the framework only focuses widgets passing both.
- Bindings are declarative; changing them at runtime is not supported — the right tool for dynamic behavior is a check-action hook that reports available/disabled/hidden per binding.
- Priority bindings let top-level elements reserve shortcuts that child widgets cannot shadow.
- Mouse capture routes all mouse events to one widget regardless of cursor position.
- Enter/Leave bubble; use `event.node` (or equivalent) to check whether the event originated on `this` widget versus a descendant.
- The Click event is the intended handler for "was clicked" logic; MouseDown/MouseUp are lower-level and may not exist on future pointer devices.

## Behaviors and contracts
- Exactly one widget holds focus at a time; focus transitions emit Blur on the old widget then Focus on the new.
- A disabled widget that was focused must lose focus automatically.
- Binding resolution starts at the focused widget and walks strictly up the parent chain until App; the first matching binding consumes the key.
- Priority bindings short-circuit that walk: they are checked App-first before the focused widget's bindings.
- Multi-key bindings expand into multiple logical bindings sharing an action and description; the description appears once in the Footer.
- Captured mouse delivers all mouse events to the capturing widget; coordinates can be negative when the cursor is above/left of the widget.
- Scroll events on a scrollable ancestor are consumed by that ancestor for scrolling; non-scrollable widgets see them pass through.
- `Enter`/`Leave` with `event.node === self` means the cursor actually entered/left this widget; otherwise the event is bubbling from a descendant.

## Example requirements
All examples JSX/TypeScript, using Ink primitives and the textual-js React API:
- A widget that handles a Key event directly (key-method style) for prototyping.
- A widget/app declaring BINDINGS with a tuple and with a full Binding object (priority=true, show=false).
- A multi-key binding that maps multiple letters to the same action.
- A widget overriding an ancestor's binding by declaring the same key locally.
- Programmatic focus: calling `widget.focus()` after an action.
- Mouse-capture example: a draggable widget that captures on MouseDown and releases on MouseUp.
- Enter/Leave example: a parent that highlights itself only when the cursor enters it directly (not a child).
- Click handler that uses `event.chain` to distinguish single vs. double click.

## Cross-references
- `spec/docs-spec/events_reference.md` (full event catalog).
- `spec/docs-spec/events.md` (messages/events system).
- `spec/docs-spec/actions_and_bindings.md` (actions and bindings in depth).
- `spec/docs-spec/api_binding.md`.
- `spec/spec-src/06-input-bindings-actions-and-commands.md` (behavioral spec).

## Notes for writers
- Do not document Python snake_case handler methods (`on_key`, `key_space`) as the primary API. In textual-js, event handling is done via the framework's handler registration (hook, prop, or subscription). Reflect that idiom, not Python's.
- `BINDINGS` as a class variable stays as a concept but describe how it's attached in TypeScript (static const on the component, or a `useBindings(...)` hook, or a registration call).
- The `@on` decorator is not the input-handling entry point; refer readers to the events doc for selector-filtered handling.
- Drop references to `textual.events.Key` module paths — name events by their logical type.
- Coordinate naming should be camelCase (`screenX`, `deltaY`) in TypeScript, not Python's `screen_x`, `delta_y`.
- Keep the "prefer Click over MouseDown/MouseUp" guidance; it applies regardless of language.
- Do not invent async input handlers; describe Promise-returning handlers if applicable.
- Mention Ink's input handling boundary only if it's user-facing; otherwise the user never sees Ink's low-level useInput.
