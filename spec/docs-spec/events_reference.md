# Docs Spec: Events Reference

## Purpose
Describes the doc page that provides a complete, lookup-style reference for every built-in event type that textual-js widgets can receive, including attributes, bubbling behavior, and the handler name associated with each.

## Audience
Widget authors and application authors who need an exhaustive reference for built-in event semantics — what each event carries, whether it bubbles, and the idiomatic way to listen for it on a React/Ink widget.

## Required sections
1. Inheritance hierarchy overview (Message -> Event -> concrete event types).
2. Lifecycle events: Load, Mount, Unmount, Show, Hide, Ready, Compose.
3. Screen events: ScreenResume, ScreenSuspend.
4. Focus events: Focus, Blur, AppFocus, AppBlur, DescendantFocus, DescendantBlur.
5. Keyboard events: Key (with all attributes and derived names).
6. Mouse events: MouseEvent base, Click (with `chain`), MouseDown, MouseUp, MouseMove, MouseScrollDown/Up/Left/Right, Enter, Leave, MouseCapture, MouseRelease.
7. Clipboard events: Paste (bracketed-paste requirement).
8. Resize event: attributes, coalescing rules.
9. Print event: used with capture-print API.
10. Internal / low-level events: Idle, Callback, Action, Timer, DeliveryComplete, DeliveryFailed (clearly flagged as internal).
11. Quick reference table: event name, bubbles, verbose, handler name.

## Key concepts
- Every event has: a stable name, a set of attributes (a plain data object), a bubble flag, a verbose flag, and an associated handler name.
- Bubbling determines whether an event continues up the DOM after being handled by the originating widget.
- Verbose events are noisy and are excluded from developer-console output unless verbose logging is enabled.
- Some events (Resize) support coalescing: a newer event supersedes an older pending one of the same type.
- MouseEvent carries both cell-level coordinates (x, y, screen_x, screen_y) and sub-cell pointer coordinates.
- `Enter`/`Leave` carry a `node` that is the DOM node directly under the mouse, not necessarily the receiver of the bubbled event.
- `control` (or equivalent) aliases the primary target widget on several events, enabling selector-style filtering in the handler dispatcher.

## Behaviors and contracts
- The full list of concrete event types in this reference must match the catalog implemented in the framework exactly; any additions or removals require a reference update.
- For each event, the page must state: attribute shape, bubble flag, handler-name convention, and any related APIs (e.g. `capture_mouse` / `release_mouse` for MouseCapture/MouseRelease).
- Resize event coalescing must be called out: callers must assume only the latest Resize observation is delivered when events arrive in bursts.
- Paste is only delivered when the terminal advertises bracketed-paste support; otherwise pasted text arrives as individual Key events.
- AppFocus/AppBlur depend on terminal focus-reporting support; the doc must note that they may never fire in some terminals.
- Timer events are internal: user code subscribes to timer callbacks rather than handling Timer events directly.

## Example requirements
All examples JSX/TypeScript, using Ink primitives and the textual-js React API:
- A widget component that listens for a Mount event to perform initialization.
- A widget that handles a Key event and selectively stops propagation (prevents bubbling) based on the key.
- A widget that handles a Click event and differentiates single-click vs. double-click using `chain`.
- A widget that handles Enter/Leave and checks `event.node === this` (or equivalent) to detect whether the event originated on it versus a descendant.
- A widget that reacts to Resize and reads the `size`, `virtual_size`, and `container_size` fields.

## Cross-references
- `spec/docs-spec/events.md` (how events/messages work conceptually: queue, bubbling, handler dispatch).
- `spec/docs-spec/input_handling.md` (keyboard/mouse semantics at a guide level).
- `spec/docs-spec/api_events.md` (API-level event type reference, if present).
- `spec/docs-spec/api_message.md` (base Message class).
- `spec/spec-src/03-message-event-and-dispatch.md` (behavioral spec for events and dispatch).

## Notes for writers
- Drop Python-specific detail: no dataclass annotations, no `textual.events` module path, no `Path` from pathlib for DeliveryComplete — describe attribute types in TypeScript terms (string, number, boolean, object shapes).
- Handler naming in textual-js is not the Python `on_<name>` convention. Describe the idiomatic React+MobX listener registration (typically a prop, or subscription via an `on(...)` helper). Do not invent a parallel `on_*` method convention where none exists.
- Focus-from-app-focus distinction (`from_app_focus`) should be preserved: it tells the widget whether focus was triggered by the whole app regaining terminal focus vs. an in-app focus change.
- `Print` event integrates with the app's print-capture API; keep it but describe it against stdout/stderr capture in Node, not Python `print`.
- Internal events (Idle, Callback, Action, Timer, DeliveryComplete, DeliveryFailed) should be listed but clearly marked "internal — not typically handled directly".
- Avoid mentioning `asyncio`, Python exceptions, or `MRO` — dispatch ordering belongs in the events overview doc, not this reference.
