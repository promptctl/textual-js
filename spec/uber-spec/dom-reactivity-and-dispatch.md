# DOM, Reactivity, And Dispatch

## DOM Model

Widgets live in a tree rooted at the active app/screen structure. `DOMNode` extends `MessagePump` and supplies shared behavior to apps, screens, and widgets.

- every node owns a single `NodeList` of direct children; this is the one place child-tree mutation happens
- every node carries CSS-facing identity: `id`, classes, type names, pseudo-classes
- stylesheet-derived styles (`_css_styles`) and inline overrides (`_inline_styles`) are distinct; a merged `RenderStyles` surface is exposed as `styles`
- class-level metadata (reactive descriptors, compute names, CSS type names, merged bindings) is derived once in `__init_subclass__` and read from class-level tables at runtime; it is never rebuilt per instance
- `DEFAULT_CSS`, `SCOPED_CSS`, and `inherit_css` / `inherit_bindings` / `inherit_component_classes` govern how default styling, bindings, and component classes propagate through the class hierarchy

## DOM Identity

- `id` is assigned at most once; subsequent assignment raises. `id` and class names are identifier-validated on entry
- `id` is selector-facing identity; it should be unique within the scope where `#id` lookup is used, but global uniqueness across unrelated branches is not an architectural requirement
- `display` and `visible` are stored as style rules; writing the Python attribute maps to the corresponding rule and triggers layout refresh

## Query Behavior

Query entrypoints on `DOMNode`:

- `query(selector)` — deep subtree query; `None` matches all widgets
- `query_children(selector)` — immediate children only
- `query_one(selector, expect_type=None)` — first breadth-first match; raises `NoMatches`, `WrongType`, or `InvalidQueryFormat`. Does not raise on multiple matches
- `query_one_optional(...)` — `query_one` that returns `None` instead of raising `NoMatches`
- `query_exactly_one(...)` — like `query_one` but additionally raises `TooManyMatches`
- `query_ancestor(selector, expect_type=None)` — walks ancestors upward; does not include `self`; raises `NoMatches` when nothing matches

Selector arguments may be a CSS string or a widget class (converted to its `__name__` before parsing). Parse failures raise `InvalidQueryFormat`. Matching is delegated to the CSS match module against `css_path_nodes`.

Error taxonomy (all `QueryError` subclasses): `InvalidQueryFormat`, `NoMatches`, `TooManyMatches`, `WrongType`.

### Singleton fast paths and caching

- singleton queries consult `base_node._query_one_cache`, an LRU keyed on `(NodeList._updates, selector, expect_type)`
- a bare `#id` selector skips parsing entirely via a breadth-first id walk
- "simple" parsed selector sets use the cache; non-simple selectors execute uncached
- the cache invalidates implicitly because `NodeList.updated()` bumps `_updates` on itself and every ancestor, so any mutation under a cached root changes the key

### DOMQuery

`DOMQuery` is a lazy, immutable view over `(root, filter_selectors, exclude_selectors, deep)`:

- chained `filter(...)` / `exclude(...)` copy the parent's selector lists so chains produce independent queries
- nodes are materialized on first access to `.nodes`; the base iterable is `root.walk_children(Widget)` for deep queries or `root._nodes` for shallow ones; every filter set must match and no exclude set may
- iteration, `len`, `bool`, indexing, and reversal all funnel through the materialized list
- retrieval: `first`, `last`, `only_one` (raises `TooManyMatches` on second match), `results(filter_type=None)`
- bulk operations apply uniformly: class mutation (`add_class`/`remove_class`/`toggle_class`/`set_class`/`set_classes`), `set_styles(css=..., **updates)` (css parsed once, merged into each node's inline styles, refreshed with `layout=True`), `refresh`, `focus`/`blur`, `remove()` (delegates to `app._prune`, returns `AwaitRemove`), and `set(display, visible, disabled, loading)`

### Tree traversal

`walk_children(filter_type=None, *, with_self=False, method="depth", reverse=False)` dispatches to depth- or breadth-first walkers, drains the generator into a list before returning so callers see a stable snapshot under concurrent mutation, and reverses the list when `reverse=True`.

## NodeList Semantics

`NodeList` is the single container for a node's direct children and the single source of truth for child-tree versioning.

- backed by a `list`, a `set` for O(1) membership, and a `dict` keyed on widget id
- append/insert reject duplicate instances silently via set membership and raise `DuplicateIds` on id collisions
- every mutation (`_append`, `_insert`, `_remove`, `_clear`, `_sort`) funnels through `updated()`, which bumps `_updates` on self and walks up the parent chain to bump ancestors
- `displayed` and `displayed_and_visible` are memoized against `_updates`; reading them after a mutation rebuilds the filtered sequence exactly once
- the mutating list API (`append`, `insert`, `remove`, `pop`, `extend`, `clear`) is blocked with `ReadOnlyError`, forcing all mutation through `Widget.mount(...)` / `Widget.remove(...)`

// [LAW:one-source-of-truth] `NodeList._updates` is the one version counter consumed by derived view caches (`displayed`, `displayed_and_visible`) and singleton query caches.

## Reactivity

`Reactive` is a data descriptor storing per-owner metadata and per-instance values under `_reactive_<name>`. Construction flags: `layout`, `repaint`, `init`, `always_update`, `compute`, `recompose`, `bindings`, `toggle_class`.

- `reactive(...)` is `Reactive` with `init=True`
- `var(...)` is `Reactive` with `init=True`, `layout=False`, `repaint=False` (no auto-refresh)

Default resolution, in order: `Initialize(callback)` called with the owner, any other callable called with no arguments, literal used as-is. If a `compute_<name>` exists and `init=True`, the initial value is the compute result instead of the declared default.

### The set pipeline

The same pipeline runs on every successful set (value changed, or `always_update`, or `_Mutated` sentinel). Variability lives in descriptor flags and the value, not in whether steps execute:

1. toggle classes driven by `toggle_class` based on the new value's truthiness
2. run private validator `_validate_<name>`, then public `validate_<name>`; each returns the possibly-coerced value that gets stored
3. store the new value
4. invoke watchers — private `_watch_<name>`, then public `watch_<name>`, then externally registered watchers from `DOMNode.watch(...)`
5. when `compute=True`, re-run `_compute` across all computes on the object
6. when `bindings=True`, call `refresh_bindings()`
7. when any of `layout`/`repaint`/`recompose` is set, call `refresh(repaint, layout, recompose)`

Watcher invocation adapts to callback arity (zero-arg, one-arg new, or two-arg old/new). Watchers may be sync or async; async returns are scheduled via `call_next` and, on completion, post a `Callback` that re-runs computes so chained derivations settle.

`toggle_class` also fires during initialization so initial state matches the default.

// [LAW:dataflow-not-control-flow] The set pipeline is fixed; descriptor flags and the value drive variability, not conditional skipping.

// [LAW:single-enforcer] `Reactive._set` is the single enforcer of validation, watcher invocation, compute propagation, and refresh scheduling for reactive writes.

### Compute-backed reactives

A class may define either `compute_<name>` or `_compute_<name>`, not both. Presence of either makes the reactive read-only via `__set__` (direct assignment raises `AttributeError`); the getter re-runs the compute on each access, stores the new value, and fires watchers if it changed.

### DOMNode reactivity integration

- `set_reactive(descriptor, value)` — writes `_reactive_<name>` directly, bypassing validators, watchers, computes, and refresh; requires the reactive to already be registered on the instance's class
- `mutate_reactive(descriptor)` — re-runs the full set pipeline against the current stored value using a `_Mutated` sentinel, forcing watchers/computes even when equality would suppress them
- `watch(obj, attribute_name, callback, init=True)` — registers a global watcher tuple on `obj.__watchers[attribute_name]`; duplicates are ignored; when `init=True`, the callback is invoked immediately with the current value for both old and new; watchers whose owning node is `_closing` are pruned on the next dispatch
- `_post_mount` materializes defaults for every declared reactive and fires initial watchers for descriptors with `init=True`

### Data binding

`data_bind(*reactives, **named)` wires reactives on a child to reactives or literal values from the node currently executing compose (the `active_message_pump` context var).

- reactive sources subscribe via `self.watch(parent, name, setter, init=True)`; the setter wraps incoming values in `_Mutated` so the child's pipeline fires even when values compare equal
- literal sources are delivered once via `call_later`
- if the child is already mounted, binding becomes active immediately; otherwise initialization is deferred to `call_later` so mount ordering does not change the observable contract
- binding a name that is not a reactive on the child, or binding a source reactive whose owner does not match the compose parent's class, raises `ReactiveError`

## Dynamic Class And Inline Style Mutation

Node-level mutation APIs validate identifiers, short-circuit no-op changes, and hand off to the stylesheet pipeline:

- class mutation: `add_class`/`remove_class`/`toggle_class`/`set_class`/`set_classes`; when `update=True`, calls `update_node_styles()`
- inline style mutation: `set_styles(css=None, **rule_updates)` merges parsed declarations into `_inline_styles` and refreshes with `layout=True`; keyword updates assign directly through the `styles` descriptor
- `reset_styles()` resets `_css_styles` across the subtree and marks widgets dirty/layout-required
- `update_node_styles(animate=True)` requests stylesheet re-application via `app.update_styles(self, ...)`; absence of an active app is silently tolerated so detached nodes remain usable

// [LAW:single-enforcer] Cascade resolution lives in the stylesheet pipeline; `update_node_styles` is the one hand-off from nodes into that pipeline.

## Message Base Model

`Message` is the base class for all messages and events. It carries transport metadata and propagation state.

Class-level declarations (set via `__init_subclass__` kwargs):

- `bubble` (default `True`) — message bubbles to parent pump after local dispatch
- `verbose` (default `False`) — excluded from console log unless verbose logging is enabled
- `no_dispatch` (default `False`) — dispatcher short-circuits before any handler invocation and before bubbling
- `namespace` (default `""`) — prefix for the derived handler name
- `handler_name` — derived at class creation from the qualname (last two dotted components, camel-to-snake), or from `f"{namespace}_{camel_to_snake(cls_name)}"` when `namespace` is supplied; stored as `f"on_{name}"`
- `ALLOW_SELECTOR_MATCH` — set of additional attribute names that `@on` may selector-match; each such attribute must resolve to a `Widget` at dispatch time

Per-instance state is set in `__post_init__` so dataclass subclasses work: `_sender` captured from the `active_message_pump` context var, `time` monotonic, `_forwarded`, `_no_default_action`, `_stop_propagation`, `_prevent` (set of prevented message types).

Runtime controls:

- `prevent_default(prevent=True)` — sets `_no_default_action`; the dispatcher stops walking further classes in the MRO, so base-class handlers are skipped (already-yielded derived handlers still run)
- `stop(stop=True)` — sets `_stop_propagation`; suppresses bubbling after local dispatch
- `set_sender(sender)` — override the automatically captured sender
- `can_replace(other)` — default `False`; subclasses override to declare coalescing eligibility
- `control` — default `None`; subclasses override to expose the associated widget for `@on` selector matching
- `_bubble_to(parent)` — resets `_no_default_action` and re-posts the same instance to the parent pump

## MessagePump Contract

`MessagePump` is the queue-driven dispatcher shared by App, Screen, and Widget. Each pump owns an `asyncio` queue and a single processing task created by `_start_messages`.

### Lifecycle

- `_pre_process` dispatches `events.Compose`, then `events.Mount` (the latter under a `prevent(...)` scope seeded from the enclosing `prevent_message_types_stack` snapshot captured at construction), then calls `_post_mount()`; the `_mounted_event` is set in a `finally` so waiters unblock even if mount raises
- `_process_messages_loop` runs until the queue is closed (sentinel `None`) or a handler raises
- `_close_messages` sets `_closing`, stops bound timers, resets reactives, and enqueues the `None` sentinel; `_close_messages_no_wait` enqueues a `CloseMessages` instead

### Posting and suppression

- `post_message(message)` returns `False` when the pump is closing/closed or when `type(message)` is in `_disabled_messages`; otherwise it stamps `message._prevent` with the caller's current prevented-types set and enqueues
- cross-thread posts are routed through `loop.call_soon_threadsafe`
- `prevent(*types)` is a context manager that pushes a superset onto a `ContextVar` stack; the top of that stack is what `post_message` stamps onto outgoing messages and what `_dispatch_message` re-applies locally before handler invocation
- `disable_messages(...)` / `enable_messages(...)` toggle per-pump type suppression; the check is exact-type (not subclass-aware)

### Coalescing and idle

- after dequeuing a message, the loop peeks the queue and while `current.can_replace(pending)` is true dequeues and replaces `current` with `pending` — coalescing is data-driven by `can_replace`
- after each dispatch, an idle pass runs when the queue is empty or `_max_idle` has been exceeded: the loop directly walks `_get_dispatch_methods("on_idle", Idle())` and invokes matching handlers without re-entering `_dispatch_message` or the queue (`Idle` is a pseudo-event)
- after the idle pass, `_flush_next_callbacks` drains the local `_next_callbacks` list
- `_dispatch_message` also flushes `_next_callbacks` immediately after per-message handler work if any were queued during dispatch
- `message_signal.publish(message)` fires for every processed message in the loop's `finally` block, before idle/flush

### call_next / call_later / call_after_refresh

- `call_next(callback, ...)` wraps the callable in an `events.Callback`, copies the current prevented-types set onto it, and appends it to `_next_callbacks` (not the queue); `check_idle` is pinged so an empty-queue pump wakes
- `call_later(...)` posts an `events.Callback` through the normal queue
- `call_after_refresh(...)` posts a `messages.InvokeLater`; the base handler forwards the callback to `app.screen._invoke_later` using the original sender

## Dispatch Pipeline

`_dispatch_message(message)` is the single enforcer of per-message handling:

1. if `message.no_dispatch` is set, return immediately — no handlers, no bubbling
2. invoke the `message_hook` context var if one is registered
3. enter `prevent(*message._prevent)` so handlers see the originator's prevented-types scope
4. if `isinstance(message, Event)` call `on_event(message)`; otherwise call `_on_message(message)` directly. In debug mode the non-event branch times the call and warns when it exceeds `SLOW_THRESHOLD`. The base `on_event` simply delegates to `_on_message` — the Event branch exists as a subclass hook (e.g. Widget/App)
5. if handler execution queued anything into `_next_callbacks`, flush it before returning

`_on_message(message)` drives handler discovery via `_get_dispatch_methods(handler_name, message)`. After all handlers have been awaited, the message bubbles when `message.bubble and self._parent and not message._stop_propagation`. If `message._sender is self._parent`, the message is stopped after the parent receives it (one extra hop only). Bubbling additionally requires the parent pump to be active and attached; otherwise the message is dropped silently.

### Handler discovery order

`_get_dispatch_methods` walks `self.__class__.__mro__` from most-derived to base. For each class it yields, in order:

1. decorated `@on(...)` handlers registered on that class, iterated by walking the *message's* MRO so base-message handlers are found; each handler is yielded at most once across the whole walk (dedup set)
2. the naming-convention fallback: `cls.__dict__.get(f"_{handler_name}") or cls.__dict__.get(handler_name)`, yielded only if it does not itself carry `_textual_on` (so decorated methods are not double-dispatched)

If `message._no_default_action` becomes true at any point, the outer MRO walk breaks — so `prevent_default()` stops base-class handlers from running but lets already-yielded derived handlers finish.

Selector-matched `@on` handlers require `message._sender` to be truthy; for each `(attribute, selector)` pair the handler is skipped when the attribute is `None`, raises `OnNoWidget` when the attribute is not a `Widget`, and is yielded only if all selectors match. The `control` attribute is special-cased: `@on` validates at decoration time that the message class overrides `Message.control`, and other attributes must be listed in `ALLOW_SELECTOR_MATCH`.

// [LAW:single-enforcer] Handler resolution, `no_dispatch`/`prevent_default`/`stop` semantics, coalescing, and bubbling all live in `MessagePump._dispatch_message` / `_on_message` / `_get_dispatch_methods`. Subclasses extend via `on_event` and handler methods; they do not reimplement dispatch.

// [LAW:dataflow-not-control-flow] The loop performs the same steps every iteration — dequeue, coalesce-by-`can_replace`, hook, dispatch, signal, idle pass, flush — and variability lives in message flags rather than conditional branches around dispatch.

## Event And Message Taxonomy

Input/system events (`textual.events`):

- lifecycle / app scope: `Load`, `Idle`, `Compose`, `Mount`, `Unmount`, `Show`, `Hide`, `Ready`, `Resize` — all non-bubbling
- focus: `Focus`, `Blur`, `AppFocus`, `AppBlur` (non-bubbling); `DescendantFocus`, `DescendantBlur` (bubbling, verbose)
- mouse: `MouseEvent` and subclasses (`MouseMove`, `MouseDown`, `MouseUp`, `MouseScrollUp/Down/Left/Right`, `Click`) — all bubbling; plus `MouseCapture` / `MouseRelease` (non-bubbling)
- mouse hover: `Enter`, `Leave` (bubbling, verbose)
- keyboard / paste: `Key` (bubbling), `Paste` (bubbling)
- screen lifecycle: `ScreenSuspend`, `ScreenResume` (non-bubbling)
- callback/timer transport: `Callback`, `Timer` (non-bubbling, verbose)
- miscellaneous: `Action`, `Print`, `CursorPosition`, `DeliveryComplete`, `DeliveryFailed`, `TextSelected` (bubbling)

`Resize.can_replace` returns `True` for other `Resize` instances, so resize storms coalesce.

Internal operational messages (`textual.messages`):

- queue/lifecycle control: `CloseMessages`, `Prune` (non-bubbling), `ExitApp`
- render/layout invalidation: `Update(widget)`, `Layout(widget)`, `UpdateScroll`
- scheduling: `InvokeLater(callback)` (non-bubbling), `ScrollToRegion(region)` (non-bubbling), `Prompt` (`no_dispatch=True`)
- terminal capability signals: `TerminalSupportsSynchronizedOutput`, `InBandWindowResize(supported, enabled)`

Coalescing (`can_replace`) is implemented by: `Update` (same widget), `Layout` (any other `Layout`), `UpdateScroll` (any other `UpdateScroll`), `Prompt` (any other `Prompt`), and `Resize` above. `Prompt` additionally sets `no_dispatch=True`, so it serves purely as a "wake the loop" pulse and never runs a handler or bubbles.

## Brokered Style-Meta Actions

`_event_broker.extract_handler_actions(event_name, meta)` scans a Rich-style meta dict for `@<event-path>[.<modifier>...]` keys and returns a `HandlerArguments(modifiers, action)` when the event-path prefix matches, or raises `NoHandler` when none match. It is a pure extractor: it does not dispatch, log, or mutate the originating event. The decision to stop the originating event after a successful brokered action is made by the widget-level click/mouse handler that calls into this extractor.

## Timer And Callback Message Interaction

- `set_timer(delay, callback)` and `set_interval(interval, callback, repeat=...)` construct `Timer` objects bound to the pump and track them in a `WeakSet`; `set_timer` wraps the callback in `partial(self.call_next, callback)` so the callback runs on the pump's own task after the current message
- the base `on_timer` handler calls `prevent_default()` and `stop()` on the timer event, then invokes the embedded callback via `_callback.invoke`; timer callbacks are skipped (with a warning) when no screen is active
- `on_callback` invokes the attached callable on receipt of an `events.Callback`, skipping if the app is closing or no screen is available
- `InvokeLater` is routed through `_on_invoke_later` to `app.screen._invoke_later` so refresh-deferred callbacks always land on the active screen
