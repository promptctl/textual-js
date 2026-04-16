# Docs Spec: Animation

## Purpose
Describes the doc page that teaches users how to animate widget properties and style values over time in textual-js, covering duration/speed, easing, delay, completion callbacks, animation levels, and custom animatable types.

## Audience
Widget authors and app authors who want to add transitions and visual motion (opacity fades, offset moves, color blends) to their UI.

## Required sections
1. Overview of the animation system (what it animates, how often it ticks).
2. The animation entry points: animating on the app, on a widget, and on a widget's styles.
3. Parameters of the `animate` call (attribute, value, final value, duration, speed, delay, easing, on-complete, level).
4. What values are animatable (numeric values, objects implementing the animatable protocol, strings that a styles parser can convert).
5. Duration vs. speed: how speed computes duration, and the default speed fallback.
6. Easing functions: the catalog and how to pass them (by name or by function).
7. Delay semantics: when the clock starts, and replacement of delayed animations.
8. Completion callbacks: when they run, and how cancellation/replacement interacts with them.
9. Animation levels ("full", "basic", "none") and how they gate individual animations.
10. How to globally set or override the animation level (env var / app attribute).
11. Animation keying and replacement (one active animation per object/attribute pair).
12. Implementing a custom animatable object (blend protocol, distance protocol).
13. Stopping animations and awaiting the animator.

## Key concepts
- Each animation is uniquely keyed by (object identity, attribute name); starting a new one cancels the previous.
- Easing functions map normalized time to progress; the default is an in-out cubic curve.
- A target value can be supplied as a string when the style property knows how to parse it (e.g., colors, scalars).
- The animation level is a system-wide throttle that may skip straight to the final value.
- Completion callbacks fire even when an animation is replaced or force-stopped.

## Behaviors and contracts
- Exactly one of duration or speed must be provided; supplying both or neither is an error.
- Speed-based animations compute duration from distance; when distance is zero, a documented default speed applies.
- Delayed animations are replaceable by later animations on the same key before they ever run; the replaced animation's callback still fires.
- When the animation level disallows an animation, the target value must be set immediately and the completion callback still fires.
- The animator exposes an API to await all running animations (excluding delayed) and another to await running plus scheduled.
- Animation timing is driven by Ink/React render cadence in textual-js; describe a single timing authority and avoid mixing ad-hoc timers.

## Example requirements
All examples must be JSX/TypeScript using Ink primitives and textual-js APIs:
- Animating a widget's opacity over a fixed duration with a chosen easing.
- Animating a color style to a new color using a string target that the styles engine parses.
- Using speed instead of duration to animate an offset across a known distance.
- A scheduled animation with a delay plus a completion callback.
- Defining a custom animatable class with a blend implementation, and animating it.
- Setting the animation level at app construction and at runtime.

## Cross-references
- `spec/docs-spec/api_color.md` (Color implements the animatable protocol).
- `spec/docs-spec/api_app.md` (app-level animation level reactive attribute).
- `spec/spec-src/07-workers-timers-and-signals.md` (timing authority).
- `spec/spec-src/05-layout-render-and-compositor.md` (how animated values feed layout/paint).

## Notes for writers
- Python version mentions `asyncio.Task`, `call_later`, and a `__textual_animation__` dunder hook; none of those Python mechanics translate. Describe the JS equivalents: a central animator tied to the render loop, a method-name or symbol-based hook for custom animation objects, and a scheduling queue backed by timers.
- Do not mention the `textual easing` CLI preview; textual-js may offer its own preview but that is a separate doc.
- Avoid referencing Python's `Literal` type, `Protocol` base, or `Self` type hint; describe the animatable contract as "an object with a `blend(destination, factor)` method returning the same type".
- Keep the full easing catalog, including which is the default and which is default for scroll animations.
