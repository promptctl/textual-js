# Phase 7: Animation & Conformance Closure

## Preconditions

Phases 1–6 complete:
- Full framework infrastructure
- Full widget catalog (basic controls, containers, lists, data-rich, text editing)
- All prior tests pass

## Goal

Deliver smooth property animation and CSS transitions, then close out the conformance tracker against the full spec-tests suite.

## Architectural Rationale

// [LAW:one-source-of-truth] The Animator is the single timing authority for all animation. No widget runs its own animation loop.

// [LAW:single-enforcer] CSS transitions are the single mechanism for automatic style-change animation. If a property has a `transition` declaration, the animator handles it. Widgets do not implement custom animation logic.

// [LAW:dataflow-not-control-flow] Animation is a data transformation: current value + target value + easing + elapsed time → interpolated value. The animator always updates the observable; the interpolation function controls what value it produces. The render path is unchanged — `observer()` picks up the new value and re-renders.

### How animation works with MobX + React

1. `animate(property, targetValue, duration, easing)` is called on a widget
2. The Animator creates an animation entry: current value, target, start time, duration, easing function
3. On each animation frame (`requestAnimationFrame` or `setInterval` in terminal context), the Animator:
   - Computes the interpolated value for each active animation
   - Updates the MobX observable for the animated property (via `runInAction`)
   - MobX notifies React → `observer()` triggers re-render → Ink updates terminal
4. When the animation completes, the observable is set to the target value and the animation entry is removed

This is clean because:
- The animation system only touches MobX observables — it doesn't know about React or Ink
- React re-rendering is automatic via `observer()` — no manual refresh
- Multiple animations batch naturally via MobX's transaction system

## Current State (before this phase)

**From Phases 1–6:** Complete framework with full widget catalog. TCSS cascade produces resolved styles as MobX observables. Widgets re-render automatically when style observables change.

**What does NOT exist:**
- No Animator
- No CSS `transition` property support in TCSS
- No `animate()` method on widgets
- No easing functions
- No conformance tracker document

## Scope

### Animator

- `Animator` class (MobX store, provided via app context)
- Manages active animations: `Map<widgetId + property, AnimationEntry>`
- `AnimationEntry`: `{ startValue, targetValue, startTime, duration, easingFn, onComplete? }`
- Animation loop: uses `setInterval` (terminal has no `requestAnimationFrame`) at ~60fps or configurable rate
- Each tick: compute interpolated values, update MobX observables in a single `runInAction` batch
- Completion: when elapsed >= duration, set final value, remove entry, schedule `onComplete`
- `force_stop_animation(widget, property)`: immediately set target value, schedule `onComplete` via message system's `callLater` — NOT direct invocation

### Easing Functions

- Linear
- Ease-in (cubic)
- Ease-out (cubic)
- Ease-in-out (cubic)
- Standard CSS easing curves: `ease`, `ease-in`, `ease-out`, `ease-in-out`
- Custom cubic-bezier support

### animate() API

- `animate(property, targetValue, options?)` method available to widgets (via hook or method)
- Options: `duration` (ms), `easing` (function or named string), `delay` (ms), `onComplete` (callback)
- Returns an animation handle for cancellation
- Multiple calls to animate the same property: latest wins, previous animation is stopped

### CSS Transitions

- `transition` property in TCSS: `transition: background 500ms ease-in-out`
- When a style property with a transition declaration changes (via class mutation, theme change, pseudo-class change), the Animator automatically animates from old value to new value
- Implementation:
  1. TCSS cascade detects a property change on a widget
  2. If the property has a `transition` declaration, instead of setting the new value directly, register an animation with the Animator
  3. The Animator interpolates from old → new over the specified duration

### Animatable Properties

- Numeric properties: width, height, margin, padding, opacity
- Color properties: background, color, border-color (interpolate RGB components)
- Properties that cannot be interpolated (e.g., display, border-style) snap immediately — no transition

### Conformance Tracker

- Create `spec/impl/CONFORMANCE.md`
- Audit all files in `spec/spec-tests/` against the implemented test suite
- For each spec-tests file:
  - **Implemented**: test file exists and covers the spec behaviors → link to test file
  - **Partial**: some behaviors covered, gaps identified → list gaps
  - **Not Implemented**: no coverage → note which phase should have covered it
  - **Intentionally Deferred**: behavior out of scope for this version → reason
- This is the final accounting of what the project covers vs what remains

## Spec References

- `spec/spec-src/12-supporting-subsystems.md` — animation section
- `spec/spec-tests/animations.md` — animation test cases
- All `spec/spec-tests/*.md` files — for conformance audit

## Exit Criteria

1. Animation tests: animate a numeric property, verify interpolated values over time.
2. Easing tests: each easing function produces correct curve (test known input/output pairs).
3. CSS transition tests: class change on a widget with `transition` declaration produces animated value change.
4. `force_stop_animation` test: stops animation, sets target value, `onComplete` is scheduled (not called synchronously).
5. Multiple animation test: animating the same property twice cancels the first.
6. Animator batching: multiple simultaneous animations produce a single MobX transaction per tick.
7. `spec/impl/CONFORMANCE.md` exists and accounts for every `spec/spec-tests/` file.
8. All prior phase tests still pass.
9. `npm run build` and `npm run lint` pass.
10. `bash visual-tests/run.sh` runs to completion. The final conformance audit must include visual comparison results — all widget fixtures must be present and text-content divergence must be zero.

## What Comes After

After Phase 7, the framework is feature-complete. Remaining work:
- Any spec-test areas marked "Not Implemented" or "Partial" in the conformance tracker
- Performance optimization (virtualization, render batching)
- Developer experience (HMR support, debugging tools, error messages)
- Documentation and examples
- npm publish
