# Animation

Textual's animation system transitions attribute values from one state to another over time, producing visual effects such as movement, fading, and blending.

## Overview

The animator changes an attribute in fixed increments over a configurable duration. Animatable properties include CSS styles such as `offset` (for spatial movement) and `opacity` (for fading). The animator runs at 60 frames per second by default.

Three objects expose an `animate` method:

- `App.animate` -- animates properties on the app.
- `Widget.animate` -- animates properties on a widget.
- `Styles.animate` -- animates individual style properties.

All three share the same parameter signature.

## The `animate` Method

```python
def animate(
    attribute: str,
    value: float | Animatable,
    *,
    final_value: object = ...,
    duration: float | None = None,
    speed: float | None = None,
    delay: float = 0.0,
    easing: EasingFunction | str = DEFAULT_EASING,
    on_complete: CallbackType | None = None,
    level: AnimationLevel = "full",
) -> None
```

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `attribute` | `str` | required | Name of the attribute to animate. |
| `value` | `float \| Animatable` | required | Target value for the animation. |
| `final_value` | `object` | `...` (same as `value`) | The value set on the attribute when the animation completes. Useful when the interpolated end value differs from the desired resting value. |
| `duration` | `float \| None` | `None` | Total animation time in seconds. Mutually exclusive with `speed`. |
| `speed` | `float \| None` | `None` | Units of change per second. Mutually exclusive with `duration`. |
| `delay` | `float` | `0.0` | Seconds to wait before the animation begins. |
| `easing` | `EasingFunction \| str` | `"in_out_cubic"` | Easing function or its string name. |
| `on_complete` | `CallbackType \| None` | `None` | Callable invoked when the animation finishes. |
| `level` | `AnimationLevel` | `"full"` | Minimum animation level required for this animation to run. |

Exactly one of `duration` or `speed` must be provided.

## Animatable Values

The animator can transition:

- **Numeric values** (`int`, `float`) -- interpolated linearly then shaped by the easing function.
- **`Animatable` protocol objects** -- any object implementing `blend(destination, factor) -> Self`. The `Color` class satisfies this protocol, enabling smooth color transitions.

If a styles object has a `parse` method on the current attribute value (e.g., `Color`, `Scalar`), the target value may be passed as a string and will be parsed automatically.

## Duration and Speed

- **`duration`**: Fixed time in seconds for the entire animation regardless of distance.
- **`speed`**: Units per second. The duration is calculated as `abs(end - start) / speed`. For `Animatable` objects that implement `get_distance_to`, that method is used to compute distance; otherwise simple subtraction is used. If speed is provided but resolves to zero distance, default speed of 50 units/second is used.

Example: animating a value from 0 to 10 at `speed=2` completes in 5 seconds.

## Easing Functions

An easing function maps the normalized time interval `[0, 1]` to a progress interval `[0, 1]`, controlling the rate of change throughout the animation. The default is `"in_out_cubic"`, which accelerates then decelerates for organic-feeling motion. The default for scroll animations is `"out_cubic"`.

### Available Easing Functions

| Name | Family | Description |
|---|---|---|
| `none` | -- | Jumps immediately to 1.0. |
| `round` | -- | Stays at 0.0 until halfway, then jumps to 1.0. |
| `linear` | -- | Constant rate of change. |
| `in_sine` | Sine | Slow start. |
| `in_out_sine` | Sine | Slow start and end. |
| `out_sine` | Sine | Slow end. |
| `in_quad` | Quadratic | Accelerating start. |
| `in_out_quad` | Quadratic | Accelerating start, decelerating end. |
| `out_quad` | Quadratic | Decelerating end. |
| `in_cubic` | Cubic | Accelerating start. |
| `in_out_cubic` | Cubic | Accelerating start, decelerating end. **(default)** |
| `out_cubic` | Cubic | Decelerating end. **(default for scrolling)** |
| `in_quart` | Quartic | Accelerating start. |
| `in_out_quart` | Quartic | Accelerating start, decelerating end. |
| `out_quart` | Quartic | Decelerating end. |
| `in_quint` | Quintic | Accelerating start. |
| `in_out_quint` | Quintic | Accelerating start, decelerating end. |
| `out_quint` | Quintic | Decelerating end. |
| `in_expo` | Exponential | Accelerating start. |
| `in_out_expo` | Exponential | Accelerating start, decelerating end. |
| `out_expo` | Exponential | Decelerating end. |
| `in_circ` | Circular | Accelerating start. |
| `in_out_circ` | Circular | Accelerating start, decelerating end. |
| `out_circ` | Circular | Decelerating end. |
| `in_back` | Back | Pulls back before advancing. |
| `in_out_back` | Back | Pulls back at start and overshoots at end. |
| `out_back` | Back | Overshoots then settles. |
| `in_elastic` | Elastic | Spring-like windup. |
| `in_out_elastic` | Elastic | Spring at both ends. |
| `out_elastic` | Elastic | Spring-like settlement. |
| `in_bounce` | Bounce | Bouncing at start. |
| `in_out_bounce` | Bounce | Bouncing at both ends. |
| `out_bounce` | Bounce | Bouncing at end. |

Easing functions can be passed by string name or as a callable `(float) -> float`.

You can preview all easing functions with: `textual easing` (requires `textual-dev`).

## Delay

The `delay` parameter (float, seconds) postpones the start of an animation. The animation duration begins *after* the delay elapses. For example, `delay=5.0, duration=2.0` means the animation starts at 5 seconds and completes at 7 seconds.

Delayed animations are tracked separately from running animations. A new animation on the same object/attribute pair cancels any previously scheduled (delayed) animation for that pair.

## Completion Callbacks

The `on_complete` parameter accepts a callable that is invoked when the animation finishes. The callback is scheduled via `app.call_later`, so it runs in the app's async context.

If an animation is replaced by a new animation on the same object/attribute pair, the replaced animation's `on_complete` callback is still invoked.

When `stop_animation` is called, the `on_complete` callback fires regardless of whether the `complete` flag is `True` or `False`.

## Animation Levels

Animation levels provide a mechanism to disable or reduce animations globally. The `AnimationLevel` type is a literal union of three values:

| Level | Meaning |
|---|---|
| `"full"` | All animations play. |
| `"basic"` | Only animations with `level="basic"` play; `level="full"` animations skip to their final value instantly. |
| `"none"` | All animations skip to their final value instantly. |

### Setting the Animation Level

- **Environment variable**: Set `TEXTUAL_ANIMATIONS` to `"full"`, `"basic"`, or `"none"` (case-insensitive). Defaults to `"full"` if unset or invalid.
- **App attribute**: `app.animation_level` can be set programmatically at runtime.

### Per-Animation Level

Each `animate` call accepts a `level` parameter. The animation only plays if `app.animation_level` permits it:

- `app.animation_level="full"` -- all animations play.
- `app.animation_level="basic"` -- only `level="basic"` animations play.
- `app.animation_level="none"` -- no animations play.

Most widget scroll methods default to `level="basic"`, meaning they still animate under the `"basic"` app level but are suppressed under `"none"`.

## Animation Keys and Replacement

Animations are keyed by `(id(obj), attribute)`. Starting a new animation on the same key stops the previous animation. This means only one animation can be active per object/attribute pair at any time.

## Custom Animatable Objects

Any object can participate in animation by implementing the `Animatable` protocol:

```python
class Animatable(Protocol):
    def blend(self, destination: Self, factor: float) -> Self:
        """Interpolate between self and destination.

        Args:
            destination: The target value.
            factor: 0.0 = self, 1.0 = destination.

        Returns:
            The interpolated value.
        """
        ...
```

Objects may also implement `get_distance_to(other)` to support speed-based duration calculation.

## The `__textual_animation__` Hook

Objects that define a `__textual_animation__` method can produce custom `Animation` subclasses. The animator checks for this method before falling back to `SimpleAnimation`. This allows styles objects (e.g., CSS scalar values) to provide specialized animation behavior.

## Stopping Animations

- `animator.stop_animation(obj, attribute, complete=True)` -- stops a running or scheduled animation. If `complete=True`, the attribute is set to its final value.
- `animator.force_stop_animation(obj, attribute)` -- immediately sets the attribute to the end value and invokes the callback, without awaiting.

## Waiting for Animations

- `animator.wait_for_idle()` -- awaits until all currently running animations finish (does not wait for scheduled/delayed animations).
- `animator.wait_until_complete()` -- awaits until all running *and* scheduled animations finish.
