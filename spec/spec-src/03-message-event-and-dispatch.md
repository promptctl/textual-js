# Message, Event, and Dispatch Semantics

## Message Base Model

`Message` is the base class for all framework messages and events. It carries transport metadata and propagation state. Messages are distinct from React synthetic events — they are the Textual framework's communication protocol, bubbling through the widget registry's parent chain.

### Class-level declarations

| Property | Default | Description |
|----------|---------|-------------|
| `bubble` | `true` | Message bubbles to parent after local dispatch |
| `verbose` | `false` | Excluded from log unless verbose logging is enabled |
| `noDispatch` | `false` | Dispatcher short-circuits before any handler invocation and before bubbling |
| `canReplace` | `false` | Whether newer messages of this type replace older queued ones (coalescing) |
| `namespace` | `""` | Prefix for the derived handler name |
| `handlerName` | derived | Derived from class name at creation time. `ButtonPressed` → `onButtonPressed`. When `namespace` is supplied: `on<Namespace><Name>` |
| `ALLOW_SELECTOR_MATCH` | `new Set()` | Additional attribute names that `on()` handlers may selector-match |

### Per-instance state

| Property | Description |
|----------|-------------|
| `sender` | The widget that created the message (set automatically at construction) |
| `time` | Timestamp at construction |
| `forwarded` | Whether this message has been forwarded from another widget |
| `stopped` | Whether `stop()` has been called (suppresses bubbling) |
| `prevented` | Whether `preventDefault()` has been called (suppresses base-class handlers) |

### Runtime controls

| Method | Effect |
|--------|--------|
| `preventDefault()` | Sets `prevented`. Base-class handlers are skipped; already-yielded derived handlers finish. |
| `stop()` | Sets `stopped`. Suppresses bubbling after local dispatch. |
| `setSender(sender)` | Override the automatically-captured sender. |

### Coalescing

`canReplace` is a static property on the Message subclass. When `true`, and a message of the same type is already in the queue, the newer message replaces the older one. This is data-driven — the message declares whether it coalesces, the dispatch system applies it uniformly.

Built-in coalescing messages:
- `Resize` — resize storms coalesce to the latest resize
- `MouseMove` — mouse move events coalesce
- `Idle` — idle ticks coalesce

## Message System Architecture

### Relationship to React events

The framework has two event systems that work together:

1. **Ink/React events**: terminal input (keypress, mouse) arrives via Ink's `useInput()` hook. These are translated into framework `Key`, `Click`, `MouseDown`, etc. messages by the App component.
2. **Framework messages**: `Message` instances that flow through the widget registry's parent chain. These include lifecycle events (`Compose`, `Mount`), user interaction events (translated from Ink), and widget-specific messages (`Button.Pressed`, `Input.Changed`).

Ink events are the *input*. Framework messages are the *transport*. The App translates one into the other.

### Message queue

The framework maintains a message queue per widget. Messages are processed sequentially within each widget.

- On mount, `Compose` then `Mount` messages are dispatched (via React `useEffect`) before normal processing begins.
- The queue processes until empty, then waits for new messages.
- On unmount, the queue is drained and closed.

In practice, most message processing is synchronous within a single microtask — a message is posted, its handler runs, side effects (MobX mutations) are batched, and React re-renders at the end of the batch. The queue exists to guarantee deterministic ordering when multiple messages are posted in rapid succession.

### Posting

`postMessage(message)` enqueues a message on the target widget's queue:

- Returns `false` when the widget is unmounting or when the message type is disabled.
- Otherwise enqueues the message and schedules processing (via `queueMicrotask` or equivalent).
- In textual-js, the meaningful safety contract is **event-loop re-entrancy safety**, not Python thread safety. Posting from handlers, timers, `callNext`, `callLater`, Promise continuations, and worker-completion callbacks must append deterministically to the same main-runtime queue.
- True cross-thread posting is out of scope for the current Node/Ink runtime. If future `worker_threads`, browser workers, or external processes participate, they must marshal data back to the main runtime and let that boundary call `postMessage`.

Widgets post messages via `useTextual()`:

```tsx
const { postMessage } = useTextual();
postMessage(new ButtonPressed());
```

### Message suppression

- `prevent(...types)` creates a scope where specified message types are suppressed for the duration. Useful for batch operations that should not trigger intermediate handlers.
- `disableMessages(...types)` / `enableMessages(...types)` toggle per-widget type suppression. The check is exact-type, not subclass-aware.

## Dispatch Pipeline

Message dispatch is the single enforcer of per-message handling. No widget reimplements dispatch — widgets extend behavior via handler methods.

### Pipeline steps

For each message dequeued:

1. **Check noDispatch**: if `message.noDispatch` is set, return immediately — no handlers, no bubbling.
2. **Coalesce**: peek the queue; while the next message satisfies `canReplace`, dequeue and replace current with pending.
3. **Invoke message hook**: if a message hook is registered (for debugging/logging), call it.
4. **Discover and invoke handlers**: walk handler discovery (see below), invoke each handler in order.
5. **Flush callNext**: if handler execution queued anything via `callNext`, run it before returning.
6. **Bubble**: if `message.bubble` is true, `stopped` is false, and a parent exists in the registry, post the message to the parent.

After all queued messages are processed:
7. **Idle pass**: invoke idle handlers directly (without re-entering the queue).
8. **Flush callNext callbacks**: run any remaining deferred callbacks.

// [LAW:dataflow-not-control-flow] The loop performs the same steps every iteration — dequeue, coalesce, hook, dispatch, flush, bubble, idle — variability lives in message flags (noDispatch, bubble, stopped, prevented, canReplace) rather than in conditional branches around dispatch.

// [LAW:single-enforcer] Handler resolution, noDispatch/preventDefault/stop semantics, coalescing, and bubbling all live in the dispatch pipeline. Widgets extend via handler methods; they do not reimplement dispatch.

### Handler discovery

Handlers are discovered by naming convention on the widget's handler object (store, component props, or registered handlers):

1. **Registered `on()` handlers**: handlers registered via the `on()` convention for this message type, with optional selector filtering. Each handler is invoked at most once (dedup set).
2. **Naming convention fallback**: `on<HandlerName>` method on the widget's store or handler object. Only invoked if it is not already a registered `on()` handler (no double-dispatch).

If `prevented` becomes true at any point, the discovery walk stops — `preventDefault()` stops remaining handlers from running but lets already-invoked handlers finish.

#### The `on()` handler convention

`on()` provides selector-filtered event handling. A handler registered with `on()` only fires when the message's declared selector target matches the specified selector:

```tsx
// Handle Button.Pressed only from buttons matching '#save'
const handlers = {
  onButtonPressed: on(ButtonPressed, '#save', (message) => {
    // Only fires for Button with id="save"
  }),
};

// Handle any Button.Pressed
const handlers = {
  onButtonPressed: (message: ButtonPressed) => {
    // Fires for all Button.Pressed messages
  },
};
```

Positional selector matching is explicit in textual-js:
- A message class that wants to support `on(MessageType, selector)` must declare a static `selectorAttribute` string naming the widget-valued instance field used for positional matching. The common case is `selectorAttribute = "control"`.
- If `selectorAttribute` is absent / `null`, supplying a positional selector is a registration-time error.
- For each selector-matched attribute:
  - If the attribute is `null`, the handler is skipped.
  - If the attribute is not a registered widget, the handler throws.
  - The handler is invoked only if all selectors match.

### Bubbling

After local dispatch, a message with `bubble: true` propagates upward through the widget registry's parent chain:

1. The message is posted to the parent widget (the nearest registered ancestor in the registry).
2. The parent dispatches the message through its own handler discovery.
3. This continues up the tree until: the message is stopped (`stop()`), there is no parent, or the sender IS the parent (one extra hop only, then stop).

Bubbling follows the widget registry parent chain, not the React component tree. These are usually the same, but the registry's parent is the nearest *registered* ancestor, which may skip intermediate React components that are not framework widgets.

### Message signal broadcasting

**Known divergence — signal scope**: upstream Textual gives each MessagePump its own `message_signal` (per-pump), published in the finally block of that pump's dispatch loop. textual-js consolidates this into a single framework-wide `messageSignal` for the running app. This is a deliberate simplification: in the React/Ink model there is one dispatch pipeline, not per-widget pumps, so a single signal is the natural observation point.

**Known divergence — messageHook timing**: upstream invokes `message_hook` from a context variable *before* dispatch begins (it is a pre-dispatch observation point). In textual-js, `messageHook` is built on top of `messageSignal` and therefore fires *after* dispatch completes. Tooling or tests that depend on observing messages before handler execution will see different timing.

The dispatch loop publishes to `messageSignal` in a `finally` block, so publication happens after each dispatch completes regardless of whether any handlers ran, whether the message was coalesced, or whether the message bubbled.

```ts
messageSignal.subscribe((message: Message) => {
  // Fires once per dispatched message, after dispatch completes.
});
```

// [LAW:one-source-of-truth] There is exactly one `messageSignal` for the running app. Devtools, logging, and test hooks (`messageHook`) all subscribe to this single signal rather than installing parallel observation hooks in the dispatch pipeline.

// [LAW:single-enforcer] Publication occurs at exactly one site — the `finally` block of the dispatch loop — so every processed message fires the signal on the same code path.

// [LAW:dataflow-not-control-flow] The signal fires unconditionally after dispatch; subscribers decide what (if anything) to do with each message. There is no "enable logging" branch in the dispatch loop.

Subscribers must be lightweight: every message in the system fires this signal, so expensive per-message work in a subscriber will dominate dispatch cost.

## Deferred Execution

### callNext / callLater / callAfterRefresh

| Method | Scheduling | Use case |
|--------|-----------|----------|
| `callNext(callback)` | Runs immediately after the current message finishes dispatching (not via the queue) | Side effects that must happen before the next message |
| `callLater(callback)` | Posts a `Callback` message through the normal queue | Deferred work that should respect message ordering |
| `callAfterRefresh(callback)` | Defers until the next React render cycle completes (via `useEffect` timing or `requestAnimationFrame`) | Work that depends on the rendered output |

- `callNext` callbacks are flushed in FIFO order after each message dispatch.
- `callLater` wraps the callback in a `Callback` message, so it is subject to queue ordering and can be suppressed.
- `callAfterRefresh` defers to after React has committed the current render — useful for measuring rendered elements or scrolling to newly mounted widgets.

## Event and Message Taxonomy

### Lifecycle events (non-bubbling)

| Message | When | canReplace |
|---------|------|------------|
| `Compose` | Widget should set up its child structure | No |
| `Mount` | Widget is in the tree and styled | No |
| `Unmount` | Widget is being removed from the tree | No |
| `Show` | Widget becomes visible | No |
| `Hide` | Widget becomes hidden | No |
| `Ready` | App has completed initial startup | No |
| `Idle` | Idle tick for deferred work | Yes |
| `Resize` | Terminal/viewport resized (carries width, height) | Yes |

### Focus events

| Message | Bubbles | Description |
|---------|---------|-------------|
| `Focus` | No | Widget received focus |
| `Blur` | No | Widget lost focus |
| `DescendantFocus` | Yes (verbose) | A descendant received focus; published upward from the focused widget so ancestors can observe focus changes in their subtree |
| `DescendantBlur` | Yes (verbose) | A descendant lost focus; counterpart to `DescendantFocus` |
| `AppFocus` | No | The app (terminal window) received focus |
| `AppBlur` | No | The app (terminal window) lost focus |

### Mouse events (all bubble)

| Message | Fields | canReplace |
|---------|--------|------------|
| `MouseMove` | `x`, `y` | Yes |
| `MouseDown` | `x`, `y`, `button` | No |
| `MouseUp` | `x`, `y`, `button` | No |
| `Click` | `x`, `y`, `chain: number` | No |
| `MouseScrollUp` | `x`, `y` | No |
| `MouseScrollDown` | `x`, `y` | No |
| `MouseScrollLeft` | `x`, `y` | No |
| `MouseScrollRight` | `x`, `y` | No |
| `Enter` | — (verbose) | No |
| `Leave` | — (verbose) | No |
| `TextSelected` | `text: Content`, `range: { start: { widget, offset }, end: { widget, offset } }` | No |

`Click` is synthesized by the framework when `MouseDown` and `MouseUp` occur on the same widget.

`TextSelected` bubbles when the user completes a text selection across one or more widgets with `ALLOW_SELECT: true` (via click+drag). The message carries the selected rich-js `Content` and a selection range describing the start/end widget and offset pair. See spec 09's text-selection contract for gesture ownership and range construction.

Mouse capture: `MouseCapture` and `MouseRelease` (non-bubbling) manage mouse capture state — while captured, all mouse events route to the capturing widget regardless of position.

#### Click chain detection (double/triple click)

The framework tracks a "click chain" counter that accompanies every `Click` message as `message.chain`. A `chain` of `1` is a single click, `2` is a double-click, `3` is a triple-click, and so on.

The chain increments when BOTH of the following hold for successive clicks:

1. The time between the previous `Click` and the current `MouseDown` is within a bounded window (default ~500ms).
2. The current click's `MouseUp` lands on the SAME widget as the preceding `MouseDown` (i.e., the chain's target widget has not changed).

When either condition fails, the chain resets to `1` and counting begins again for the new target.

// [LAW:single-enforcer] The time-window check and same-widget check are enforced in the screen's mouse-forwarding path — the single site that owns translation of Ink mouse events into framework `MouseDown`/`MouseUp`/`Click` messages. Widgets do not re-derive chain counts; they read `message.chain` and branch on the value.

// [LAW:dataflow-not-control-flow] Single, double, and triple clicks travel the same dispatch path — the chain count is a value carried on the message, not a different message type or a different code path.

### Keyboard events

| Message | Fields | Bubbles |
|---------|--------|---------|
| `Key` | `key` (normalized name), `character` (printable char or null) | Yes |

Key events are translated from Ink's input system. Key names are normalized: `"ctrl+c"`, `"shift+tab"`, `"escape"`, `"enter"`, `"f1"`–`"f12"`, `"backspace"`, `"delete"`, `"home"`, `"end"`, `"pageup"`, `"pagedown"`, `"up"`, `"down"`, `"left"`, `"right"`, `"tab"`, `"space"`, and printable characters.

### Clipboard and paste events

| Message | Fields | Bubbles |
|---------|--------|---------|
| `Paste` | `text: string` | Yes |

`Paste` is emitted when Ink detects a bracketed-paste sequence from the terminal. The `text` field carries the full pasted string as a single message — widgets must not treat a paste as a stream of individual `Key` events.
The `text` field may contain ANSI escape sequences (for example when pasting from another terminal or styled source). Consumers that want to preserve styling can parse it via rich-js `parseAnsi()` into `Content`; consumers that want plain text can strip ANSI via rich-js `stripAnsi()`.

### Cursor and terminal events (non-bubbling)

| Message | Fields | Description |
|---------|--------|-------------|
| `CursorPosition` | `x: number`, `y: number` | Reports the terminal's current cursor position (e.g., for inline-mode positioning or widgets that need to know where the cursor rendered) |

### Delivery events (non-bubbling)

| Message | Fields | Description |
|---------|--------|-------------|
| `DeliveryComplete` | `id` | A deferred delivery (e.g., clipboard write, file save) completed successfully |
| `DeliveryFailed` | `id`, `error` | A deferred delivery failed; `error` carries the failure cause |

### Screen lifecycle events (non-bubbling)

| Message | When |
|---------|------|
| `ScreenSuspend` | Screen is no longer the active (topmost) screen |
| `ScreenResume` | Screen becomes the active screen |

### Internal operational messages

| Message | Bubbles | canReplace | Description |
|---------|---------|------------|-------------|
| `Callback` | No (verbose) | No | Wraps a `callLater` callback |
| `Timer` | No (verbose) | No | Wraps a timer callback |
| `Notify` | No | No | Carries a `Notification` payload from `notify(message, options?)`; the notification's `message` and optional `title` may be `string | Content` (see specs 01 and 12) |
| `Print` | No (verbose) | No | Carries captured process output as `{ text: string, stderr: boolean }`; `text` may include ANSI escape sequences |
| `CloseMessages` | No | No | Signals the queue to shut down |
| `ExitApp` | No | No | Signals app exit |

## Timer and Callback Integration

### Timers

- `setTimer(delay, callback)` creates a one-shot timer that posts a `Timer` message after `delay` milliseconds.
- `setInterval(interval, callback)` creates a repeating timer.
- Timers are bound to the owning widget and automatically cancelled on unmount.
- The timer handler invokes the callback, calls `preventDefault()` and `stop()` on the timer event (preventing bubbling and base-class handling).
- Named timers: `setTimer(name, delay, callback)` — setting a timer with an existing name cancels the previous one.
- `pauseTimer(name)` / `resumeTimer(name)` suspend and resume named timers.

### Callbacks

- `onCallback` invokes the attached callable on receipt of a `Callback` message.
- Skipped if the app is closing (prevents stale callbacks from running during shutdown).
