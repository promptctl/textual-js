# Events and Messages

## Overview

Textual uses a message-based architecture where widgets communicate through messages that bubble up the DOM tree. Messages are dispatched through a message pump, can be handled via naming conventions or the `@on` decorator, and can be prevented, stopped, or filtered by CSS selectors.

### Message Declaration and Namespacing

Messages are declared as nested classes inheriting from `Message` inside a widget class. Each message is automatically namespaced to its declaring widget class. When a subclass of a widget re-declares a message (inheriting from the parent widget's message), the subclass message gets its own namespace.

- `BaseWidget.Fired` produces handler name `on_base_widget_fired`.
- If `Left(BaseWidget)` declares `class Fired(BaseWidget.Fired)`, it produces handler name `on_left_fired`.
- Referencing a message type in an unrelated class scope (e.g., `_event = Left.Fired`) does not alter the namespace.

### Message Bubbling

Messages bubble up the widget hierarchy from the widget that posted them toward the app. When a widget calls `post_message`, the message is placed on the message queue and eventually dispatched to handlers on the posting widget and its ancestors.

- `prevent_default()` on a message only affects the default handler on the current widget; it does not prevent the message from continuing to bubble to parent handlers. A parent's `on_button_pressed` handler still fires even if a child called `event.prevent_default()`.

### Message Pump

Every widget and app is a message pump with a message queue.

- `message_queue_size` returns the number of pending messages in the queue.
- Posting a message increments the queue size; processing (via `await pilot.pause()`) drains it back to zero.
- `post_message` is thread-safe and can be called from a background `threading.Thread`.

### Preventing Messages

The `prevent` context manager suppresses specific message types from being posted while active.

- `widget.prevent(MessageType)` suppresses that message type for the duration of the context.
- Changes made inside the context that would normally trigger the message do not emit it.
- Changes made outside the context (before or after) emit messages normally.
- `call_next` callbacks scheduled inside a `prevent` block also respect the prevention: the callback runs, but the prevented message type is not emitted.

### Key Events and Dispatch

Key events are dispatched to handler methods named `key_<keyname>` on widgets.

- A handler like `key_x` is invoked when the `x` key is pressed, and the dispatch returns `True`.
- Key aliases are resolved: pressing `tab` dispatches to `key_ctrl_i` if no `key_tab` exists, because `tab` and `ctrl+i` are the same in the terminal.
- If both `key_tab` and `key_ctrl_i` exist on the same widget, a `DuplicateKeyHandlers` error is raised to prevent ambiguity.
- Private handlers (prefixed with `_`, e.g., `_key_x`) also conflict with their public counterparts and raise `DuplicateKeyHandlers`.

### Key Names and Character Mapping

Characters are mapped to canonical key names for use in bindings and handlers.

- Alphanumeric characters map to themselves: `"a"` -> `"a"`, `"1"` -> `"1"`.
- Special characters map to descriptive names: `" "` -> `"space"`, `"_"` -> `"underscore"`, `"?"` -> `"question_mark"`, `","` -> `"comma"`, `"~"` -> `"tilde"`.
- Bindings accept both the character literal and the key name: `".,~,space"` binds the period, tilde, and space keys to a single action.
- `format_key` converts key names back to display form: `"minus"` -> `"-"`.
- `get_key_display` renders bindings for display: `"p"` -> `"p"`, `"ctrl+p"` -> `"^p"`, `"right_square_bracket"` -> `"]"`, `"delete"` -> `"del"`.
- `key_to_character` converts a key name back to a character, returning `None` for non-character keys like `"ctrl+space"` or unknown names.

### Paste Events

Paste events (`events.Paste`) carry a `text` attribute with the pasted content.

- A `Paste` event can be posted via `post_message(events.Paste(text="..."))` and handled with `on_paste`.
- Empty-string pastes are valid: `events.Paste("")` posts successfully and does not alter widget state (e.g., an `Input` remains empty).

### The `@on` Decorator

The `@on` decorator routes messages to handler methods with optional CSS selector filtering.

- `@on(MessageType, selector)` invokes the handler only when the message's `control` matches the CSS selector.
- Selectors support `#id`, `.class`, combined `.a.b`, and comma-separated lists `.a, .b`.
- `@on` handlers execute before `on_<message_name>` convention handlers.
- Multiple `@on` decorators on the same handler are supported, matching different message types or selectors. The handler fires once per matching decorator.
- A comma-separated CSS selector list (e.g., `".a, .b"`) on a single `@on` decorator is treated as one decorator. Even if multiple alternatives in the list match the control, the handler fires exactly once for that decorator (not once per matching alternative).
- A handler decorated with `@on(Parent)` fires for both `Parent` and `Child` messages (where `Child` inherits from `Parent`). A handler for `@on(Child)` fires only for `Child`.
- When both `@on(Parent)` and `@on(Child)` decorate the same method, the handler fires exactly once per message (not duplicated).
- Selectors that do not match any widget at dispatch time simply do not fire the handler.
- Mixins in the message class hierarchy do not interfere with handler resolution.

**`@on` with Enter/Leave events**: The decorator works with `Enter` and `Leave` events, using a widget type name as the selector (e.g., `@on(Enter, "Button")`).

**`@on` with attribute selectors**: Some messages support keyword argument selectors matching sub-properties. For example, `@on(TabbedContent.TabActivated, pane="#one")` matches when the event's `pane` attribute matches the selector `#one`. The attribute must be listed in the message's `ALLOW_SELECTOR_MATCH`.

**Inheritance with `@on`**: When a derived widget overrides a method that has `@on` in a base class, both the derived and base versions run, with the derived version first.

**Error conditions**:
- Invalid CSS selector (e.g., `"@"`) raises `OnDecoratorError`.
- Using a selector on a message that has no `control` property raises `OnDecoratorError`.
- Using a keyword attribute not in `ALLOW_SELECTOR_MATCH` raises `OnDecoratorError`.

### Handler Ordering with `@on` and Convention Handlers

When both `@on`-decorated handlers and `on_<name>` convention handlers exist for the same message type:

- `@on` handlers fire first, in declaration order.
- The `on_<name>` convention handler fires after all `@on` handlers.
- For inherited messages, `@on(Parent)` fires when a `Child` is posted, but `on_<parent_name>` does not fire for the child (the child has its own convention handler name).

## Constraints

- A widget must not declare both `key_tab` and `key_ctrl_i` (or any equivalent alias pair); doing so raises `DuplicateKeyHandlers`.
- A widget must not declare both `key_x` and `_key_x`; doing so raises `DuplicateKeyHandlers`.
- `@on` with a CSS selector requires the message class to expose a `control` property; otherwise `OnDecoratorError` is raised at decoration time.
- `@on` keyword attribute selectors require the attribute to be listed in the message's `ALLOW_SELECTOR_MATCH`; otherwise `OnDecoratorError` is raised at decoration time.
- `@on` CSS selectors must be syntactically valid; invalid selectors raise `OnDecoratorError` at decoration time.
- `prevent_default()` is scoped to the current handler's widget; it does not suppress the message for ancestors in the bubble chain.
- `prevent(MessageType)` only suppresses posting of new messages of that type within its context; it does not retroactively affect already-queued messages.
- `post_message` must be safe to call from non-async threads.
