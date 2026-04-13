# Message, Event, and Dispatch Semantics

## Message Base Model

`textual.message.Message` is the base class for all messages and events. It carries transport metadata and propagation state.

- class-level declarations (set via `__init_subclass__` kwargs):
  - `bubble` (default `True`) — message bubbles to parent pump after local dispatch,
  - `verbose` (default `False`) — excluded from the console log unless verbose logging is enabled,
  - `no_dispatch` (default `False`) — dispatcher short-circuits before any handler invocation *and* before bubbling,
  - `namespace` (default `""`) — prefix for the derived `handler_name`,
  - `handler_name` — always derived at class creation time from the class qualname (last two dotted components, camel-to-snake), or from `f"{namespace}_{camel_to_snake(cls_name)}"` when `namespace` is supplied, and stored as `f"on_{name}"`,
  - `ALLOW_SELECTOR_MATCH` — set of additional attribute names that `@on` may selector-match; each such attribute must resolve to a `Widget` at dispatch time.
- per-instance state set in `__post_init__` (so dataclass subclasses work):
  - `_sender` — captured from `active_message_pump` context var at construction,
  - `time` — monotonic timestamp at construction,
  - `_forwarded`, `_no_default_action`, `_stop_propagation`, `_prevent` (set of prevented message types).
- runtime controls:
  - `prevent_default(prevent=True)` — sets `_no_default_action`; the dispatcher uses this to stop walking further classes in the MRO (i.e. base-class handlers are skipped),
  - `stop(stop=True)` — sets `_stop_propagation`; suppresses bubbling after local dispatch,
  - `set_sender(sender)` — override the automatically-captured sender,
  - `can_replace(other)` — default `False`; subclasses override to declare coalescing eligibility,
  - `control` — default `None`; subclasses override to expose the associated widget for `@on` selector matching,
  - `_bubble_to(parent)` — resets `_no_default_action` and re-posts the same instance to the parent pump.

## MessagePump Contract

`textual.message_pump.MessagePump` is the queue-driven dispatcher shared by App, Screen, and Widget.

### Queue and lifecycle

- each pump owns an `asyncio`-backed queue and a single processing task created by `_start_messages`,
- `_pre_process` dispatches `events.Compose` then `events.Mount` (the latter under a `prevent(...)` scope seeded from the enclosing `prevent_message_types_stack` snapshot captured at construction), then calls `_post_mount()`; the `_mounted_event` is set in a `finally` clause so waiters unblock even if mount raises,
- the main loop `_process_messages_loop` runs until the queue is closed (sentinel `None`) or a handler raises,
- `_close_messages` sets `_closing`, stops bound timers, resets reactives, and enqueues the `None` sentinel; `_close_messages_no_wait` enqueues a `CloseMessages` message instead.

### Posting and suppression

- `post_message(message)` returns `False` when the pump is closing/closed or when `type(message)` is in `_disabled_messages`; otherwise it stamps `message._prevent` with the caller's current prevented-types set and enqueues,
- when `post_message` is called from a thread other than the pump's owning thread, it enqueues via `loop.call_soon_threadsafe`,
- `prevent(*types)` is a context manager that pushes a superset onto a `ContextVar` stack; the top of that stack is what `post_message` stamps onto outgoing messages and what `_dispatch_message` re-applies locally before handler invocation,
- `disable_messages(...)`/`enable_messages(...)` toggle per-pump type suppression; the check is exact-type (`type(message) not in _disabled_messages`), not subclass-aware,
- `check_message_enabled(message)` exposes the disabled-type check.

### Coalescing and idle

- after dequeuing a message, the loop peeks the queue and, while `current.can_replace(pending)` is true, dequeues and replaces `current` with `pending` — coalescing is data-driven by `can_replace`,
- after each dispatch, an idle pass runs when the queue is empty or `_max_idle` has been exceeded: the loop directly walks `_get_dispatch_methods("on_idle", Idle())` and invokes matching handlers without re-entering `_dispatch_message` or the queue (`Idle` is a pseudo-event),
- after the idle pass, `_flush_next_callbacks` drains the local `_next_callbacks` list,
- `_dispatch_message` also flushes `_next_callbacks` immediately after the per-message handler work if any were queued during dispatch,
- `message_signal.publish(message)` fires for every processed message in the loop's `finally` block (before idle/flush).

### call_next / call_later / call_after_refresh

- `call_next(callback, ...)` wraps the callable in an `events.Callback`, copies the current prevented-types set onto the callback message, and appends it to the local `_next_callbacks` list (not the queue); `check_idle` is pinged so an empty-queue pump wakes,
- `call_later(...)` posts an `events.Callback` through the normal queue,
- `call_after_refresh(...)` posts a `messages.InvokeLater`; the base-class handler `_on_invoke_later` forwards the callback to `app.screen._invoke_later` using the original sender.

## Dispatch Pipeline

`_dispatch_message(message)` is the single enforcer of per-message handling:

1. if `message.no_dispatch` is set, return immediately — no handlers, no bubbling,
2. invoke the `message_hook` context var if one is registered,
3. enter `prevent(*message._prevent)` so handlers see the originator's prevented-types scope,
4. if `isinstance(message, Event)` call `on_event(message)`; otherwise call `_on_message(message)` directly. In debug mode the non-event branch times the call and logs a warning when it exceeds `SLOW_THRESHOLD`. `on_event` in the base class simply delegates to `_on_message` — the Event branch exists as a subclass hook (e.g. Widget/App) rather than a separate handler phase,
5. if handler execution queued anything into `_next_callbacks`, flush it before returning.

`_on_message(message)` drives handler discovery via `_get_dispatch_methods(handler_name, message)` and, after all discovered handlers have been awaited, bubbles the message when `message.bubble and self._parent and not message._stop_propagation`. If `message._sender is self._parent`, the message is stopped after the parent receives it (one extra hop only). Bubbling also requires `is_parent_active and is_attached`; otherwise the message is dropped silently.

### Handler discovery order

`_get_dispatch_methods` walks `self.__class__.__mro__` from most-derived to base. For each class it yields (in this order):

1. decorated `@on(...)` handlers registered on that class, iterated by walking the *message's* MRO so base-message handlers are found; each handler is yielded at most once across the whole walk (dedup set),
2. the naming-convention fallback: `cls.__dict__.get(f"_{handler_name}") or cls.__dict__.get(handler_name)`, yielded only if it does not itself carry `_textual_on` (decorated methods are not double-dispatched).

If `message._no_default_action` becomes true at any point, the outer MRO walk breaks — meaning `prevent_default()` stops base-class handlers from running but lets already-yielded derived handlers finish.

Selector-matched `@on` handlers require `message._sender` to be truthy; for each `(attribute, selector)` pair the handler is skipped when the attribute is `None`, raises `OnNoWidget` when the attribute is not a `Widget`, and is yielded only if all selectors match. The `control` attribute is special-cased: `@on` validates at decoration time that the message class overrides `Message.control`, and other attributes must be listed in `ALLOW_SELECTOR_MATCH`.

// [LAW:single-enforcer] Handler resolution, `no_dispatch`/`prevent_default`/`stop` semantics, coalescing, and bubbling all live in `MessagePump._dispatch_message` / `_on_message` / `_get_dispatch_methods`. Subclasses extend via `on_event` and handler methods; they do not reimplement dispatch.

// [LAW:dataflow-not-control-flow] The loop performs the same steps every iteration — dequeue, coalesce-by-`can_replace`, hook, dispatch, signal, idle pass, flush — and variability lives in message flags (`no_dispatch`, `bubble`, `_stop_propagation`, `_no_default_action`, `_prevent`, `can_replace`) rather than in conditional branches around dispatch.

## Event and Message Taxonomy

### Input/system events (`textual.events`)

- lifecycle / app scope: `Load`, `Idle`, `Compose`, `Mount`, `Unmount`, `Show`, `Hide`, `Ready`, `Resize` (all non-bubbling),
- focus: `Focus`, `Blur`, `AppFocus`, `AppBlur` (non-bubbling); `DescendantFocus`, `DescendantBlur` (bubbling, verbose),
- mouse: `MouseEvent` and subclasses `MouseMove`, `MouseDown`, `MouseUp`, `MouseScrollUp/Down/Left/Right`, `Click` — all bubbling; plus `MouseCapture`/`MouseRelease` (non-bubbling),
- mouse hover: `Enter`, `Leave` (bubbling, verbose),
- keyboard / paste: `Key` (bubbling), `Paste` (bubbling),
- screen lifecycle: `ScreenSuspend`, `ScreenResume` (non-bubbling),
- callback/timer transport: `Callback` (non-bubbling, verbose), `Timer` (non-bubbling, verbose),
- miscellaneous: `Action`, `Print`, `CursorPosition`, `DeliveryComplete`, `DeliveryFailed`, `TextSelected` (bubbling).

`Resize.can_replace` returns `True` for other `Resize` instances, so resize storms coalesce.

### Internal operational messages (`textual.messages`)

- queue/lifecycle control: `CloseMessages`, `Prune` (bubble=False), `ExitApp`,
- render/layout invalidation: `Update(widget)`, `Layout(widget)`, `UpdateScroll`,
- scheduling: `InvokeLater(callback)` (bubble=False), `ScrollToRegion(region)` (bubble=False), `Prompt` (no_dispatch=True),
- terminal capability signals: `TerminalSupportsSynchronizedOutput`, `InBandWindowResize(supported, enabled)`.

Coalescing (`can_replace`) is implemented by: `Update` (same widget), `Layout` (any other `Layout`), `UpdateScroll` (any other `UpdateScroll`), `Prompt` (any other `Prompt`), and `Resize` above. `Prompt` additionally sets `no_dispatch=True` so it serves purely as a "wake the loop" pulse and never runs a handler or bubbles.

## Brokered Style-Meta Actions

`textual._event_broker.extract_handler_actions(event_name, meta)` scans a Rich-style meta dict for `@<event-path>[.<modifier>...]` keys and returns a `HandlerArguments(modifiers, action)` when the event-path prefix matches, or raises `NoHandler` when none match. It is a pure extractor: it does not dispatch, does not log, and does not mutate the originating event. The decision to stop the originating event after a successful brokered action is made by the widget-level click/mouse handler that calls into this extractor.

## Timer and Callback Message Interaction

- `set_timer(delay, callback)` and `set_interval(interval, callback, repeat=...)` construct `Timer` objects bound to the pump and track them in a `WeakSet`; `set_timer` wraps the callback in `partial(self.call_next, callback)` so the callback runs on the pump's own task after the current message,
- the pump's base `on_timer` handler calls `prevent_default()` and `stop()` on the timer event and then invokes the embedded callback (if any) via `_callback.invoke`; timer callbacks are skipped (with a warning) when no screen is active,
- `on_callback` invokes the attached callable on receipt of an `events.Callback`, skipping if the app is closing or no screen is available,
- `InvokeLater` is routed through `_on_invoke_later` to `app.screen._invoke_later` so refresh-deferred callbacks always land on the active screen.
