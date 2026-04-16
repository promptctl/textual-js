# Docs Spec: Toast Widget

## Purpose
Describes the Toast widget doc page — the internal, short-lived notification component that backs `App.notify()` — covering its structural role, severity classes, rendering, styling seams, and the container widgets (`ToastRack`, `ToastHolder`) that position toasts on screen.

## Audience
App authors customizing notification appearance and placement via TCSS; framework extenders swapping or theming the toast surface. The Toast component itself is not intended for direct mounting.

## Required sections
1. Overview — Toast as the visual surface for notifications, owned by the app's notification service and mounted into `ToastRack`; not a user-facing widget.
2. Characteristics — non-focusable, non-container, derived from the static/text widget primitive, carries a system class that excludes it from normal DOM queries by default.
3. Construction contract — accepts a notification descriptor (message, title, markup flag, severity, time-to-live); consumers do not construct Toast directly.
4. Rendering — how `message` and optional `title` are combined, how `markup` toggles the markup parser vs plain text, how title occupies its own line above the message.
5. Severity levels — information, warning, error — and the CSS class each applies on the Toast.
6. Auto-expiry and dismissal — timer-based expiry when the notification's time-to-live elapses, click-to-dismiss as the same handler; on removal, notifies the app's notification service so the notification is dropped from the active list.
7. Component-class styling seams — specifically `toast--title` and its default style, plus guidance on the Line API component-class convention for widget sub-parts.
8. Default styling — width, max-width, height-auto, top margin, padding, background, border, link styling and hover treatment.
9. `ToastRack` — the container docked to the screen edge that stacks all active toasts, with its alignment, layer, overflow, and visibility toggle based on whether any notifications are active.
10. `ToastHolder` — the per-toast wrapper used to control per-toast alignment and visibility.
11. Styling examples — targeting all toasts, targeting by severity class, targeting `toast--title` within a severity, repositioning `ToastRack`.

## Key concepts
- Toast is a system widget: it carries a system class (e.g. `-textual-system`) and is not exposed for direct composition.
- Severity maps one-to-one onto a CSS class on the Toast, not onto a theme color directly; styling flows through TCSS.
- Auto-expiry is timer-driven and coalesces with click-dismiss through a single path.
- `ToastRack` is the positional authority for toasts; altering where toasts appear is done by restyling `ToastRack`, not by reconfiguring Toast instances.
- `ToastHolder` exists so per-toast alignment is independent of the rack's overall alignment.

## Behaviors and contracts
- Creating a Toast starts its expiry timer on mount; the timer's callback and the click handler share a single dismiss path.
- Dismissal removes the Toast from the tree and tells the notification service to drop the corresponding notification (single source of truth for active notifications lives on the service, not on the rack).
- `ToastRack`'s visibility is derived from whether any notifications are active — it should not be toggled imperatively.
- Toast content obeys the markup flag on the notification; when markup is off, all content is plain text regardless of brackets.
- Title, if present, renders above the message with the `toast--title` component style.
- Severity classes carry the convention `-information`, `-warning`, `-error` — authors style by targeting these.

## Example requirements
All examples JSX/TypeScript, using Ink primitives and textual-js APIs. Describe (do not inline) examples for:
- Showing a notification with severity and timeout via the notification service (the user-facing API; Toast is not constructed directly).
- Restyling all toasts uniformly (padding, border).
- Per-severity overrides using `Toast.-information`, `Toast.-warning`, `Toast.-error`.
- Styling the title sub-part via `toast--title`, including scoped to a single severity.
- Repositioning toasts by targeting `ToastRack` (e.g., top-right instead of bottom-right).

## Cross-references
- `spec/docs-spec/api_app.md` — the app-level notification service that creates/clears toasts.
- `spec/docs-spec/widgets_overview.md` — widget base contract, component-class convention.
- `spec/spec-src/01-runtime-app-and-lifecycle.md` — where the notification service lives.
- `spec/spec-src/10-widget-catalog.md` — catalog entry for Toast/ToastRack/ToastHolder.
- `spec/spec-src/04-styling-and-css-engine.md` — TCSS and component-class styling semantics.

## Notes for writers
- Do not describe Toast as something applications mount directly. The single entry point is the notification service.
- The original Python doc calls out `inherit_css=False`; in textual-js, describe the equivalent: default CSS does not inherit from the base text widget's defaults. Do not use the Python parameter name.
- "Version added" notes from the Python docs do not apply; omit.
- Do not mention Rich `Style` or `Content.from_markup`; describe the markup flag behaviorally (parsed content-markup vs plain text).
- Avoid Python identifiers such as `notification.time_left`, `app._unnotify`, etc. Describe the behavior using neutral terms (time-to-live, notification service).
- The `DEFAULT_CLASSES = "-textual-system"` convention translates directly — describe it as the system-class marker that excludes the widget from general DOM queries.
