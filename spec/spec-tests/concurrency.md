# Concurrency

Textual provides concurrency primitives for coordinating async tasks, scheduling callbacks relative to the render cycle, and safely interacting with the app from background threads.

---

### Reentrant Lock (RLock)

`textual.rlock.RLock` is an async reentrant lock. The same task can acquire it multiple times without deadlocking; each acquisition must be balanced by a corresponding release.

- A freshly created `RLock` reports `is_locked` as `False`.
- After `await lock.acquire()`, `is_locked` is `True`.
- The same task can call `acquire()` again without blocking. Each call increments an internal count.
- Each `release()` decrements the count. The lock only becomes unlocked (`is_locked` is `False`) when the count reaches zero.
- Calling `release()` when the lock is already fully released raises `RuntimeError`.
- Supports the `async with` context-manager protocol for scoped acquisition.
- While one task holds the lock, other tasks that attempt to acquire it are suspended until it is fully released. Once released, waiting tasks proceed.

### Call Schedulers

Textual exposes scheduling methods on the `App` (and more generally on `MessagePump`) that enqueue a callback to run on the main event loop. They differ in *when* the callback executes relative to the render cycle.

#### `call_later`

- Schedules a callback to run on the event loop at the next opportunity.
- The callback runs asynchronously; it does not execute inline at the call site.
- Accepts a callable (and, by extension, its arguments).

#### `call_after_refresh`

- Schedules a callback to run after the next display refresh completes.
- At the time the callback executes, at least one full display pass has occurred since the call was made (the app's display count at callback time equals the app's display count observed from outside after the wait).
- The callback runs inside the context of the message pump that scheduled it (the `active_message_pump` context variable resolves to that pump).

#### `call_next` (referenced via scheduler family)

- Part of the same scheduling surface as `call_later` and `call_after_refresh`.
- Schedules a callback to run on the next iteration of the event loop, before the next message is processed.

### Thread Safety and `call_from_thread`

Textual apps run on an asyncio event loop. Direct mutation of app or widget state from a background thread is unsafe. `call_from_thread` bridges this gap.

- `call_from_thread(callback, *args)` marshals a callable onto the app's event loop so it executes on the correct thread.
- Calling `call_from_thread` when the app is **not running** raises `RuntimeError`.
- Calling `call_from_thread` from the **same thread** as the app (i.e., the event-loop thread) also raises `RuntimeError`. It is exclusively for use from foreign threads.
- From a background thread, the callback can safely query and mutate widgets (e.g., write to a `RichLog`, call `app.exit()`).
- The return value of the callback is marshaled back to the calling thread.

---

## Constraints

- `RLock` is per-task reentrant only. Acquiring from a different async task while another task holds it will block until fully released. It is not thread-safe; it is an asyncio primitive.
- Releasing an `RLock` more times than it was acquired is a `RuntimeError`.
- `call_from_thread` must only be called from a thread that is **not** the app's event-loop thread, and only while the app is running. Violating either condition raises `RuntimeError`.
- `call_after_refresh` guarantees at least one display refresh before the callback runs. Code that depends on render state must use this scheduler, not `call_later`.
- All scheduler callbacks execute on the main event loop thread. They must not perform blocking I/O; offload such work to threads or executors.
- The `active_message_pump` context variable is set correctly inside `call_after_refresh` callbacks, preserving the identity of the scheduling pump. Callbacks should not assume ambient context from other sources.
