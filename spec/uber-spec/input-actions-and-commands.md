# Input, Actions, Bindings, Workers, And Commands

## Input And Drivers

Driver behavior is the platform input/output boundary.

- normalized key and mouse delivery across drivers
- coordinate translation before events reach app logic
- driver-specific runtime modes such as headless or inline behavior
- XTerm parsing support for ordinary keys, modifier keys, escape handling, mouse input, and paste/capability sequences
- key names are canonicalized at the driver/parser boundary (punctuation and single printable characters promoted to long-form names) so binding and handler layers only ever see canonical key names

Cross-platform normalization belongs to driver processing, not to each widget or app callsite.

## Input Event Routing

Input events flow through a single ingress and fan out by event kind, not by per-callsite branching.

- the driver emits low-level input events into the app's event ingress
- mouse events update the app's tracked mouse position, drive click-chain detection, and are forwarded through the screen; click synthesis matches a mouse-up to the widget that received the original mouse-down and increments the click chain only while successive clicks fall inside a bounded time window
- a widget's disabled state suppresses mouse interactions except scroll-wheel pass-through, enforced inside the screen's forwarding path (single enforcer)
- key events run priority bindings first, then are forwarded to the focused widget (or screen if none), where non-priority bindings and widget key handlers run as the event bubbles
- paste events are forwarded directly to the focused widget or screen

## Bindings

Bindings map keys to actions and metadata. A binding is an immutable record carrying a key, an action string, a description, footer/key-panel display controls, a priority flag, a system-hidden flag, an optional globally-addressable id used for keymap overrides, and an optional group used for grouped footer rendering.

Behavioral guarantees:

- a bindings map stores multiple bindings per key; merging maps is list-preserving and precedence is determined by dispatch-time iteration order, never by merge order
- active bindings for presentation are derived from the app, screen, and focused-widget chain — they are not read from raw declarations
- footer visibility is forced off when a binding has no description, and system bindings are hidden from the key panel
- keymap overrides apply only to bindings that carry an id; unidentified bindings are never rewritten
- when a keymap override targets a key that is already bound, the pre-existing bindings are collected as clashes, removed, and reported to the app's clash handler for subclass observability (default is a no-op)
- footer and key-panel presentation derive from the active binding set produced by walking the modal-truncated chain, not from raw binding declarations

### Binding Chain And Dispatch Order

Binding resolution is a two-pass walk driven by the focused node and the active screen, using a single enforcer in the app.

- the full binding chain runs focused-first through ancestors up to the app; when nothing is focused it collapses to screen then app
- a modal-truncated chain stops at (and includes) the nearest modal ancestor so modal screens contain their own key bubble
- pass one runs on every key event at the app ingress and walks the full chain in reverse (app-first), firing only bindings whose priority flag is set
- pass two runs while the event bubbles through the focused widget's key handler, walks the modal-truncated chain, and fires non-priority bindings; if nothing claims the key, widget-level key handler dispatch runs as the final fallback
- a maximized widget with escape-to-minimize enabled consumes escape before pass one
- keymap application happens as the screen's binding chain is assembled, and clashes are reported once per namespace

Active bindings for presentation are built by walking the modal-truncated chain and de-duplicating by key: the first binding encountered wins unless a later binding is priority and the incumbent is not. Each candidate is then filtered through the owning node's action-state check.

## Actions

Action strings support:

- bare action names
- parameterized calls (arguments parsed as Python literals)
- dotted namespace prefixes that resolve to an action target

Action parsing is centralized (single enforcer) and cached; malformed argument lists raise a dedicated parse error.

### Action Targets

The set of legal action namespaces is owned by the app, not by widgets. The app exposes a fixed set of namespace names — `app`, `screen`, and `focused` — which are resolved against the app instance at dispatch time. An explicit per-call namespace mapping may add additional targets for one dispatch; any other namespace is an error.

### Action State

`check_action(...)` uses a three-state contract owned by the action target:

- true: enabled and visible
- none: disabled but still visible (grayed in the footer)
- false: disabled and hidden from active binding display

Action dispatch runs only for a truthy action state; a non-truthy state aborts before invocation.

### Action Dispatch

Action dispatch is centralized in the app:

- the action string (or pre-parsed tuple) is resolved to a target, a name, and parameters
- the target's `check_action` gates execution
- the dispatcher looks up the underscore-prefixed method first, then the public method, and invokes the first callable found; a dedicated skip exception raised inside an action method is caught and reported as not handled so bubbling bindings can continue

### Brokered Style-Meta Actions

Click and hover actions attached to styled content are dispatched through the same action pipeline: the app extracts the handler action from the event's style metadata, stops the event on success, and routes string actions through the standard run path while tuple forms re-parse the name and use externally supplied parameters. Malformed metadata is logged and ignored rather than allowed to crash dispatch.

## Widget-Level Key Handler Dispatch

Widget key handler dispatch is the fallback after binding resolution and follows a fixed data-driven shape:

- an empty key name short-circuits to not-handled
- the event's ordered alias list drives handler lookup; each alias is tried against the underscore-prefixed handler then the public handler
- more than one alias resolving to a handler on the same node is a hard error
- handlers are not invoked when the owning screen is no longer active
- an explicit false return means not handled and the event continues to bubble; any other return (including none) counts as handled
- widgets may also implement a raw consume-key hook that claims keys before binding dispatch, used by the screen's forwarding path to short-circuit input-capturing widgets

## Workers And Timers

Workers are managed background tasks bound to app, screen, or widget ownership.

- stable worker states
- optional exclusivity by worker group
- support for async work and thread work
- lifecycle cancellation when ownership ends

Timers are scheduled callbacks with explicit lifecycle, pause/resume, and cancellation behavior.

## Signals

Signals support:

- subscription
- unsubscribe/cleanup behavior
- weak-reference-aware listener lifecycle
- queued callback scheduling as the general model, with immediate delivery as an explicit opt-in

## Command Palette

The command palette presents commands from provider sets, using the app-level provider set and active-screen provider set by default.

- discovery hits make the results list visible immediately
- fuzzy search drives result ranking for typed queries
- selecting a command runs it by default
- click-away dismisses the palette
- no-result searches surface a disabled "No matches found" result after the countdown
- selection behavior is configurable through a run-on-select option
- results are gathered concurrently under an exclusive worker group and streamed into the list in time-bounded batches
- provider initialization and shutdown hooks are wrapped so exceptions are logged but do not take down the palette

## Command Palette Providers And Defaults

- default app behavior uses the system command provider, which drives both discovery and search from the app's system-commands list and honors each command's discover flag
- overriding the app-level command set defines the app-level provider set
- screen-level commands augment the active command palette by unioning with the app-level set
- an explicitly supplied provider set overrides the default app/screen provider discovery path
- the command palette is enabled by default
- the default launch binding is `ctrl+p`, registered as a priority binding during app init

## Command Palette Edge Cases

- no known calling screen means there is no default app/screen provider context
- provider failures do not take down the application; they are isolated from the rest of the command palette
