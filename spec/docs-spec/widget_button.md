# Docs Spec: Button Widget

## Purpose
Describes the docs page for the `Button` widget -- a focusable, clickable control that emits a pressed message or runs a configured action when activated.

## Audience
App authors adding interactive controls to their UI; widget authors wanting a reference for Button's public surface.

## Required sections
1. Overview -- what a Button is, focusable, not a container.
2. Props/constructor parameters (label, variant, id, className, disabled, tooltip, action, compact, flat).
3. Reactive/observable properties exposed on the component instance (label, variant, compact, flat).
4. Variants -- the `ButtonVariant` union and how each variant styles the button; error behavior for invalid values.
5. Variant convenience constructors (`Button.success`, `Button.warning`, `Button.error`) and when to use them vs the `variant` prop.
6. Messages -- `Button.Pressed` shape, handler subscription, and the relationship with the `action` prop (mutually exclusive: action suppresses the message).
7. Bindings -- default `enter` triggers press.
8. Methods -- `press()` as a programmatic activation entry point.
9. Default styling summary -- width/min-width, height auto, text-align center, content-align center middle, pointer, two visual modes (default vs flat), disabled-state styling, compact-mode behavior.
10. Internal CSS classes the widget manages automatically.
11. Usage patterns -- basic button with handler, variant factories, buttons that invoke an action, flat buttons, compact buttons.
12. Spacing note -- that Button visual padding comes from tall border + min-width, not from padding; how to remove it.

## Key concepts
- Button is focusable and emits a pressed message on activation unless an action string is configured, in which case the action runs instead.
- Variants apply a CSS class (`-default`, `-primary`, `-success`, `-warning`, `-error`) that drives the color scheme via theme tokens.
- `flat` toggles between two visual modes; `compact` removes borders.
- Disabled buttons cannot be focused, clicked, or activated via Enter.
- The widget posts `Button.Pressed` with `button` and `control` attributes (both pointing to the same instance) so generic listeners that expect `.control` work.
- `action` and the `Pressed` message are mutually exclusive: action-configured buttons never post `Pressed`.
- Visible padding is achieved via `tall` top/bottom borders and a minimum width, not via the `padding` property.

## Behaviors and contracts
- Default variant: `"default"`.
- Invalid variant value must raise a clear validation error.
- `press()` is a no-op on disabled or non-displayed buttons.
- Pressing plays a brief active animation (approx 0.2s by default) during which re-triggering via `action_press` is suppressed.
- Activation paths (click, Enter keypress, programmatic `press()`) must all follow the same code path: either emit `Pressed` or run `action`, never both.
- When `action` is used, it is dispatched with the button's parent as the default namespace, matching the app's action-resolution rules.
- Internal CSS classes -- `-{variant}`, `-style-default`, `-style-flat`, `-active`, `-textual-compact` -- are managed by the widget; user code must not mutate these directly.

## Example requirements
All examples are JSX/TypeScript using the textual-js Button component. Examples must demonstrate:
- A basic labeled Button inside a composed widget, with a handler that responds to the `Pressed` message (using the textual-js on-handler convention).
- Variant factory usage (`Button.success("Save")`, etc.) and the `variant` prop form.
- A Button with `action="quit"` that runs the quit action instead of emitting a Pressed message.
- Flat and compact variants.
- Programmatic activation via `press()` from another widget's handler.
- Querying a Button by id and toggling its disabled state.

## Cross-references
- `spec/docs-spec/widget_checkbox.md` -- related toggle-style control.
- `spec/docs-spec/actions_and_bindings.md` -- the `action` prop hooks into the app's action system.
- `spec/docs-spec/api_on.md` -- message-handler conventions used to handle `Button.Pressed`.
- `spec/spec-src/10-widget-catalog.md` -- widget catalog entry.
- `spec/spec-src/09-widget-base-contract.md` -- base widget contract.

## Notes for writers
- Drop all Python-only type annotations (`ContentText | None`, `RenderableType`, `Self`, `ButtonVariant` as `Literal`). Present props as TypeScript interfaces; `variant` is a string union type.
- The `ContentText` type becomes whatever renderable node type textual-js uses for labels (likely `React.ReactNode` or a typed subset). Do not invent a new name.
- "Widget name" vs "DOM id" vs "CSS classes" all translate 1:1 from Python; rename snake_case props to camelCase where textual-js uses camelCase.
- "handler name `on_button_pressed`" should be rewritten per the textual-js handler convention (e.g., `onButtonPressed`, or subscribe via the message decorator/HOC used by textual-js). State the convention explicitly once.
- The active-press animation uses textual-js's animation system; note the duration but do not describe Python's task scheduling.
- Do not mention `InvalidButtonVariant` by name -- describe it as a validation error and let the behavioral spec name it if needed.
