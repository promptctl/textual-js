# Docs Spec: Message — Base Type for Messages and Events

## Purpose
Describes the docs page that explains how to define custom messages (and events, which are messages), including handler-name derivation, bubbling, propagation control, default-action suppression, and selector-based `on` matching.

## Audience
Widget authors who emit custom messages from their widgets, application developers who receive messages from built-in widgets, and advanced authors who need to tune propagation, bubbling, or selector matching.

## Required sections
1. Overview — every event is a message; messages are the unit of dispatch.
2. Defining a custom message — class placement (inner class vs top-level), fields, constructor.
3. Subclass configuration — `bubble`, `verbose`, `noDispatch`, `namespace`.
4. Handler-name derivation — how the framework computes `onXxx` names from class structure, and how `namespace` influences this.
5. Properties — `control` (the widget associated with the message), `isForwarded`, `sender`.
6. Selector matching — the `ALLOW_SELECTOR_MATCH` set that lets `on` match CSS selectors against widget-valued attributes (beyond `control`).
7. Control methods — `stop()` to halt bubbling, `preventDefault()` to suppress default handlers.
8. Setting the sender — automatic via the active pump; `setSender()` for explicit override.
9. Message coalescing — `canReplace(other)`.
10. Bubbling semantics — how a message walks up to the parent pump.

## Key concepts
- Message: a data object describing something that happened. Events are messages with specific lifecycle semantics but use the same base.
- Handler-name derivation: by default the framework converts a message class name into an `onSnakeCase` handler method name, optionally namespaced by an enclosing widget class when defined as an inner class.
- Bubble flag: controls whether the framework re-posts the message to the parent pump after local dispatch.
- Verbose flag: excludes the message from the devtools console unless verbose logging is enabled.
- `noDispatch` flag: the message is enqueued (and seen by the message signal) but not routed to handlers — useful for framework-internal signaling.
- Namespace: disambiguates handler names when multiple messages would collide on `onXxx`. Auto-derived from the enclosing class for inner-class messages, overrideable explicitly.
- `control`: the widget that logically "owns" the message (for example, the `Input` that produced a `Changed`). `on` can filter by CSS selector against `control`.
- `ALLOW_SELECTOR_MATCH`: a per-message-class list of additional widget-valued attributes that `on` may also match against with selectors.
- Sender: the pump that posted the message. Auto-populated from the active pump during construction; can be overridden with `setSender`.
- `canReplace`: returns `true` if this message can supersede an earlier queued message (for coalescing). Default is `false`.

## Behaviors and contracts
- Constructing a message captures a timestamp and (by default) the active pump as the sender.
- `stop()` sets a propagation-stopped flag that prevents bubbling; `preventDefault()` suppresses default-action handlers (handlers inherited from base classes).
- `bubble = true` (default) causes the framework to re-post the message to the parent after local dispatch, unless `stop()` was called.
- Subclass configuration defaults are inherited when the corresponding option is not set.
- Handler-name derivation: CamelCase segments are converted to snake_case and joined; the result is prefixed with `on`; inner-class messages use at most the last two class segments (for backwards compatibility with deeply-nested cases).
- `ALLOW_SELECTOR_MATCH` attributes must resolve to widgets for selector matching to work.
- `control` defaults to `null`; subclasses override it to return the relevant widget.
- Sender is a non-owning reference; messages do not keep pumps alive.

## Example requirements
All examples are JSX/TypeScript using Ink primitives and textual-js widgets:
- Defining a custom message class with fields and a `control` getter that returns the emitting widget.
- Defining a message as an inner member of a widget class so its handler name is automatically namespaced (for example `Button.Pressed` → `onButtonPressed`).
- Overriding the namespace explicitly for an already-named message collision.
- Handling a message on the parent screen and calling `stop()` to prevent further bubbling.
- Calling `preventDefault()` to skip a base-class default handler.
- Using `ALLOW_SELECTOR_MATCH` to enable `@on(MyMessage, 'Input#name')` on a secondary widget attribute.
- Implementing `canReplace` for a high-frequency message (for example, a progress update) so only the latest queued instance is dispatched.

## Cross-references
- `spec/docs-spec/api_message_pump.md` — where messages are posted and dispatched.
- `spec/docs-spec/api_events.md` — built-in events and their `control` fields.
- `spec/docs-spec/api_on.md` — the `on` helper and selector matching.
- `spec/docs-spec/api_signal.md` — signals as a lighter-weight alternative.
- `spec/spec-src/03-message-event-and-dispatch.md` — dispatch spec.
- `spec/spec-src/09-widget-base-contract.md` — widget-level message handling.

## Notes for writers
- Python Textual configures subclasses via `__init_subclass__` keyword arguments and uses `@rich.repr.auto`. In textual-js, subclass configuration is expressed via static class fields or constructor options — describe it that way. Do not mention `__init_subclass__`, `__post_init__`, `__rich_repr__`, or dataclass semantics.
- Do not document internal slots (`_sender`, `_forwarded`, `_no_default_action`, `_stop_propagation`, `_prevent`) as a public API. Describe the observable behaviors instead (isForwarded, stop, preventDefault, setSender).
- Handler-name derivation maps CamelCase to snake_case in Python Textual. textual-js should use an equivalent convention — describe it as the name convention the framework actually uses (if the framework chose camelCase handlers, say so). Do not import the Python-specific snake_case behavior unless the JS port keeps it.
- Do not use Python keyword-arg subclass syntax in examples; show the textual-js declaration form (for example, static config on the class).
- Be explicit that messages are data, not commands — they are emitted and handled, not "executed".
- Clarify that `control` and `ALLOW_SELECTOR_MATCH` are the hooks that make CSS-selector-based `on` handlers work.
