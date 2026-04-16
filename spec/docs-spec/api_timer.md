# Docs Spec: Timer

## Purpose
Document timers in textual-js: how to schedule one-shot or repeating callbacks tied to a widget/screen/app lifetime, with pause/resume/reset semantics and catch-up behavior.

## Audience
Widget authors and application authors scheduling periodic work (animations, polling, delayed actions) that must respect lifecycle and avoid leaks.

## Required sections
1. Overview (what a `Timer` is, how it is created via `setInterval` / `setTimeout` helpers on a message pump/widget)
2. Creating timers (helper methods on widget/screen/app, never construct directly)
3. Options (interval, repeat count, skip-behind, start paused, name for debugging)
4. Delivery modes (callback vs. emitting a `Timer` event/message)
5. Control methods (stop, pause, resume, reset)
6. Skip-behind behavior when the runtime is busy
7. Lifecycle coupling (timers stop when their target unmounts or is garbage collected)
8. Interaction with app shutdown

## Key concepts
- Timers are scheduled via helpers on a widget/screen/app, not constructed standalone. This binds them to a target that receives events.
- Every tick does the same work: invoke the callback if given, otherwise post a `Timer` message to the target. The shape of the tick does not depend on runtime conditions.
- `repeat` controls finite vs. infinite schedules (a `setTimeout` is a one-shot timer with repeat of 1).
- `skip` on a busy event loop advances the tick counter rather than firing a queue of backed-up ticks.
- `pause` freezes ticking without losing state; `reset` restarts the clock from now.
- A stopped timer releases its target reference and cannot be restarted.

## Behaviors and contracts
- Calling `stop` multiple times is safe.
- Callback exceptions are routed to the app's exception handler; they do not silently disappear.
- Pausing does not reset the clock; resuming continues from the remaining interval.
- Resetting a paused timer also resumes it.
- When the target has been disposed (e.g., widget unmounted), the timer halts without throwing into user code.
- During app shutdown, timers no longer fire — callbacks registered while shutting down must not be relied on.
- The tick count is monotonic within a single timer lifetime.

## Example requirements
All examples are JSX/TypeScript. The doc must include:
- Scheduling a 1-second repeating tick on a widget that updates a MobX observable.
- Scheduling a one-shot timeout for a delayed side effect.
- A paused-on-create timer started later by a user action.
- Using `reset` to debounce activity.
- A callback that throws, showing that the error flows through the app's error handler.
- Stopping a timer in the widget's cleanup/unmount hook.

## Cross-references
- `spec/docs-spec/api_work.md` (long-running workers vs. short periodic timers)
- `spec/docs-spec/api_animation.md` (when to use animation API instead of raw timers)
- `spec/docs-spec/api_message_pump.md`
- `spec/spec-src/07-workers-timers-and-signals.md`

## Notes for writers
- Do not mention `asyncio`, `asyncio.Task`, `_exit`, or Python weak references. textual-js runs on the JS event loop and ties timer lifetime to its target via the framework's disposal machinery.
- Replace "awaitable" / `async def` callback language with plain "callback may return a Promise".
- Do not expose an `EventTargetGone` exception — in JS the framework simply stops the timer when the target is disposed.
- Keep examples using Ink-friendly components and hooks.
