# Docs Spec: Message Handler Registration (`on`)

## Purpose
Describe the API for declaring message handlers with optional CSS-selector filtering so widget authors know how to attach responses to framework messages (button presses, tab changes, etc.) and how to narrow handlers to a specific source widget.

## Audience
Widget authors and app authors wiring up event/message handling on components — anyone who wants a method to run only when a message arrives from a particular child or matches a particular selector.

## Required sections
1. Overview — why `on`-style registration exists and when to prefer it over naming-convention handlers.
2. The registration API signature — target message type, positional selector, keyword-attribute selectors.
3. Selector matching rules — how the positional selector matches the message class's declared selector target (commonly `control`) and how keyword selectors match additional message-exposed widgets.
4. Validation and errors — what is checked at registration time vs. runtime.
5. Stacking multiple registrations on the same handler.
6. Comparison with naming-convention handlers (e.g. `onButtonPressed`-style).
7. Usage examples.

## Key concepts
- Message handler registration as metadata attached to a method, not a wrapper that alters behavior.
- Explicit selector-target declaration on a message class for positional selectors (commonly the `control` field in the textual-js port).
- Opt-in set of additional message attributes that may be selector-matched (the framework's equivalent of `ALLOW_SELECTOR_MATCH`).
- Selector parsing happens at registration time, so invalid selectors fail fast.
- A single handler can be registered against multiple `(messageType, selectors)` pairs.

## Behaviors and contracts
- Registration must not wrap or rename the underlying method; calling the method directly behaves identically to an unregistered method.
- Registration stores metadata that the dispatch pipeline consults when routing messages.
- Selectors are parsed once at registration; invalid selector strings surface a registration-time error (the JS analogue of `OnDecoratorError`).
- Supplying a selector for a message type that does not declare a positional selector target is a registration-time error.
- Supplying a keyword selector that names an attribute not declared as selector-matchable on the message class is a registration-time error.
- At runtime, if a selector is resolved against an attribute whose value is not a widget, that is an error (the analogue of `OnNoWidget`).
- Multiple registrations on the same handler compose with OR semantics across `(messageType, selectors)` entries.
- Per-entry, the positional selector and all keyword selectors must ALL match (AND semantics).

## Example requirements
All examples in JSX/TypeScript using Ink primitives. Include at minimum:
- A handler registered for a button-press message filtered by an `id` selector, where the message class declares its positional selector target.
- A handler registered for a tabbed-content "tab activated" message using both the control selector and an additional named-attribute selector.
- A handler stacked against two distinct message types with different selectors.
- An example showing a registration-time failure (selector supplied when message has no control, or attribute not selector-matchable) and the resulting error.

## Cross-references
- `api_message.md` and `api_events.md` in `spec/docs-spec/` — message class contract and event dispatch.
- `api_widget.md` and `api_dom_node.md` in `spec/docs-spec/` — where handlers live.
- `api_query.md` in `spec/docs-spec/` — CSS selector grammar and semantics.
- `spec/spec-src/03-message-event-and-dispatch.md` — dispatch pipeline behavior.
- `spec/spec-src/04-styling-and-css-engine.md` — selector parsing/matching.

## Notes for writers
- Python decorators have no direct equivalent in TypeScript as defined in the source; describe registration as "attach handler metadata" without implying decorator syntax. The implementation may use a registration helper, a class-field, or an explicit `registerHandler` call — this spec does not prescribe the surface, but the doc must describe the semantics.
- Do not imply that the framework can infer selector support from a Python-style instance property at registration time. In textual-js, positional selector support must be declared explicitly on the message class.
- Do not mention `@on`, `self`, `async def`, or Python-exception class names. Use the framework's JS error names (documented in the errors section).
- Emphasize that this is complementary to, not a replacement for, message-subscription/`useMessage`-style hooks if the framework exposes them.
- The doc must clarify that selectors are matched against widget targets, not against React components; TCSS selectors operate on the widget DOM, not the React element tree.
