# Docs Spec: Built-in Events

## Purpose
Document every event the framework emits — lifecycle, resize, input (key/mouse), focus, and miscellaneous — so widget authors know exactly what they can listen for, whether it bubbles, what payload it carries, and when it fires.

## Audience
Widget authors writing event handlers and app authors wiring high-level event listeners.

## Required sections
1. Overview: events as messages reserved for the framework; custom app messages extend the plain `Message` base instead.
2. Event base types: `Event` (extends `Message`), `InputEvent` (base for key and mouse).
3. Lifecycle events: `Load`, `Compose`, `Mount`, `Unmount`, `Show`, `Hide`, `Ready`, `ScreenResume` (with `refreshStyles`), `ScreenSuspend`.
4. Geometry: `Resize` — `size`, `virtualSize`, `containerSize`, `pixelSize`; `fromDimensions` factory; message coalescing (a newer `Resize` replaces the older pending one).
5. Key events: `Key` with `key`, `character`, `aliases`; derived properties `name`, `nameAliases`, `isPrintable`.
6. Mouse events: `MouseEvent` base and the subclass family (`MouseMove`, `MouseDown`, `MouseUp`, `MouseScrollUp`/`Down`/`Left`/`Right`, `Click`). Document attributes (`widget`, `button`, modifier flags), integer cell coordinates, sub-cell pointer coordinates, deltas, screen vs. relative coordinates, and the style under the cursor. `Click` carries a `chain` count for double/triple clicks.
7. Focus events: `Focus` (with `fromAppFocus`), `Blur`, `AppFocus`, `AppBlur`, `DescendantFocus`, `DescendantBlur`, `Enter`, `Leave`. Explain `control` aliases and the bubbling implications for `Enter` / `Leave`.
8. Other events: `Idle`, `Callback` (wraps `callNext` / `callLater`), `Action`, `Timer`, `Paste`, `Print`, `MouseCapture`, `MouseRelease`, `DeliveryComplete`, `DeliveryFailed`, `CursorPosition`, `TextSelected`.
9. Bubbling and verbosity matrix — a table for every event listing: bubbles yes/no, verbose yes/no, extends what, primary attributes.
10. How to listen: naming conventions for handler methods / `@on` decorators in the JS port (decorator-style `on`/`onEvent` helpers or named handler methods, as the framework exposes).

## Key concepts
- Events vs. custom messages: use `Event` subclasses only when Textual is sourcing the signal; apps emit their own `Message` subclasses.
- Verbose events are suppressed by default in developer tooling/logging.
- Coalescing: `Resize.canReplace(msg)` lets a newer resize supersede a queued older resize.
- Coordinate spaces: widget-relative integers (`x`, `y`), screen-relative integers (`screenX`, `screenY`), sub-cell floats (`pointerX`, etc.).
- `Enter` / `Leave` bubble; inspect `node` for the true target.
- `Paste` is gated on bracketed paste support; Textual enables it at startup.
- `Print` only fires for widgets that opted in via `beginCapturePrint`.

## Behaviors and contracts
- Every event documents whether it bubbles and whether it is marked verbose.
- `Resize` always replaces an older queued `Resize` in the same message queue.
- `Key.character` defaults to `key` when `key` is a single printable character and the explicit `character` was not provided.
- `MouseEvent.getContentOffset(widget)` returns the widget-content-relative offset, or `null` when the pointer is in border/padding. `getContentOffsetCapture` returns an offset even outside content.
- `Click.chain` counts rapid successive clicks.
- `DescendantFocus` / `DescendantBlur` bubble so ancestors can react.
- `Hide` fires when the widget leaves the DOM, is scrolled/clipped off-screen, or has `display=false` / `display: none`.
- Delivery events carry the originating `key` returned by `deliverText` / `deliverBinary`.

## Example requirements
- JSX/TypeScript snippets showing:
  - Listening for `Mount` to initialize state.
  - Handling `Resize` and logging `size`, `virtualSize`, `containerSize`.
  - Listening for `Key` and branching on `event.key` / `event.isPrintable`.
  - Handling `Click` with `chain === 2` for double-click.
  - Responding to `Focus` with `fromAppFocus` to distinguish app-level focus.
  - Handling `Paste` to intercept clipboard text.
- A comprehensive bubbles/verbose/attributes table.

## Cross-references
- `spec/docs-spec/api_message.md` (base Message contract).
- `spec/docs-spec/api_message_pump.md` (delivery pipeline).
- `spec/docs-spec/api_on.md` (declarative event registration).
- `spec/docs-spec/api_binding.md` (key handling alternative).
- `spec/docs-spec/api_geometry.md` (`Offset`, `Size`).
- `spec/spec-src/03-message-event-and-dispatch.md`, `spec/spec-src/06-input-bindings-actions-and-commands.md`, `spec/spec-src/08-drivers-io-and-platform-behavior.md`.

## Notes for writers
- Do not document `@dataclass`; in TS these are plain classes/records with typed fields.
- Drop Python `from_event` classmethod syntax; describe as a factory (`MouseEvent.fromEvent(widget, event)`).
- Ink delivers raw input; explain that Ink-side terminal capability detection gates `AppFocus` / `AppBlur` / `Paste` / `CursorPosition`.
- Do not describe the Python `MouseEventT` type var; it is a generic relating the input type to the output type of the factory. Describe the factory's generic behavior in TS.
- `CursorPosition` is internal and is rarely needed by app code; mark it as such.
- For handler declarations, use the textual-js idiom (decorator `@on(Event)`, or method name convention) rather than Python's snake_case `on_click`.
