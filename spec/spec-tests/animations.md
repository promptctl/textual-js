# Animations

## Overview

Textual provides an animation system that interpolates property values over time. The system comprises an animator that drives animations, a library of easing functions that control interpolation curves, and a three-level mechanism for disabling or limiting animations globally. Individual widget types define whether their animations are classified as "full" or "basic."

### Animator

The `Animator` is the central engine that manages running animations. It is accessible via `app.animator`.

- `animator.animate(obj, attribute, value, duration=..., easing=..., on_complete=..., delay=...)` starts an animation on an attribute of a target object.
- `animator.bind(obj)` returns a bound callable that animates attributes on `obj` without re-specifying the target each time. Calling `bound("foo", 100.0, duration=10)` is equivalent to `animator.animate(obj, "foo", 100.0, duration=10)`.
- `animator.is_being_animated(obj, attribute)` returns `True` if the given attribute on `obj` currently has an active animation.
- `animator.force_stop_animation(obj, attribute)` immediately completes an animation: sets the attribute to its final value, removes the animation, and schedules the `on_complete` callback.
- Animations are keyed by `(id(obj), attribute)`. Starting a new animation on the same attribute of the same object replaces the previous animation. The previous animation's `on_complete` callback is still scheduled (via `app.call_later`) before the new animation begins.
- When two animations target the same attribute and the second targets the same final value, both `on_complete` callbacks fire in order.
- When two animations target the same attribute but with different final values, both `on_complete` callbacks fire in order, and the attribute reaches the second animation's target.

### SimpleAnimation

`SimpleAnimation` interpolates a single attribute from a start value to an end value over a duration.

- Constructed with `SimpleAnimation(obj, attribute, start_time, duration, start_value=, end_value=, final_value=, easing=)`.
- Calling `animation(current_time)` updates the attribute and returns `True` when the animation is complete, `False` otherwise.
- At completion, the attribute is set to `final_value` (which may differ from `end_value` -- for example, it can be `None`).
- When `duration` is `0`, the animation completes immediately on the first call, setting the attribute to `final_value`.
- Supports reverse animations where `end_value < start_value`.
- Supports the animatable protocol: any object with a `blend(destination, factor)` method can be used as start/end values, enabling custom interpolation logic.

### Styles Animation

Style properties can be animated via `styles.animate(property, target, duration=..., easing=..., delay=...)`.

- Scalar properties such as `height` can be animated. For example, `styles.animate("height", 100, duration=0.5, easing="linear")` animates from the current height to 100.
- Color properties such as `background` can be animated. Intermediate frames produce blended color values.
- CSS transitions declared in TCSS (e.g., `transition: background 1s;`) trigger animations when a style change occurs (such as adding a class).

### Scheduling and Waiting

Animations support a `delay` parameter that defers the start of the animation.

- `styles.animate("background", "white", delay=0.1, duration=0)` schedules an animation to begin after 0.1 seconds. The property retains its original value until the delay elapses.
- `pilot.wait_for_animation()` waits for currently running animations to finish but does not wait for scheduled (delayed) animations that have not yet started.
- `pilot.wait_for_scheduled_animations()` waits for both running and scheduled animations to complete.
- When a short animation and a longer delayed animation are both active, `wait_for_animation()` returns after the short animation completes without waiting for the delayed one.

### Reverse Animations

Animations can reverse direction by targeting a value the property already had.

- Creating two animations in sequence on the same property (e.g., black to white, then white to black) results in the property returning to the original value.
- Scheduling overlapping reverse animations (one delayed longer than the other) results in the final animation's target winning.

### Cancelling Animations

Both `App` and `Widget` support cancelling running animations via `stop_animation(attribute)`.

- `app.stop_animation("counter")` cancels any running animation on the app's `counter` attribute.
- `widget.stop_animation("counter")` cancels any running animation on the widget's `counter` attribute.
- Calling `stop_animation` on an attribute that is not being animated is a no-op (no error raised).
- After cancellation, `animator.is_being_animated(obj, attribute)` returns `False`.

### on_complete Callback

The `on_complete` callback is scheduled via `app.call_later` when the animation finishes.

- The callback is not fired before the animation duration elapses.
- The callback is scheduled (not called directly) when the animation reaches its duration.
- When `force_stop_animation` is called, the `on_complete` callback is still scheduled.

### Easing Functions

The `EASING` dictionary maps string names to easing functions. Each easing function takes a float in `[0, 1]` and returns a float representing the interpolation factor.

- `DEFAULT_EASING` is the name of the default easing function applied when none is specified.
- Available easing functions: `none`, `round`, `linear`, `in_sine`, `out_sine`, `in_out_sine`, `in_quad`, `out_quad`, `in_out_quad`, `in_cubic`, `out_cubic`, `in_out_cubic`, `in_quart`, `out_quart`, `in_out_quart`, `in_quint`, `out_quint`, `in_out_quint`, `in_expo`, `out_expo`, `in_out_expo`, `in_circ`, `out_circ`, `in_out_circ`, `in_back`, `out_back`, `in_out_back`, `in_elastic`, `out_elastic`, `in_out_elastic`, `in_bounce`, `out_bounce`, `in_out_bounce`.
- `none` always returns `1` (instant jump to end value).
- `round` returns `0` for the first half of the range and `1` for the second half (step function at midpoint).
- `linear` returns the input unchanged.
- `in_*` variants start slow and accelerate. `out_*` variants start fast and decelerate. `in_out_*` variants combine both.
- `in_back` and `out_back` overshoot: values go below `0` or above `1` respectively before settling. `in_out_back` also overshoots in both directions.
- `in_elastic` and `out_elastic` oscillate, producing values outside `[0, 1]`. `in_out_elastic` also oscillates outside `[0, 1]`.
- `in_bounce` and `out_bounce` simulate a bouncing effect.

### Disabling Animations: Animation Levels

Textual supports three animation levels that control which animations play: `"full"`, `"basic"`, and `"none"`.

- `app.animation_level` holds the current level. It can be set programmatically.
- The default value is determined by the `TEXTUAL_ANIMATIONS` environment variable at startup.

### Environment Variable: TEXTUAL_ANIMATIONS

The `TEXTUAL_ANIMATIONS` environment variable sets the initial animation level.

- When unset or empty, the level defaults to `"full"`.
- `"FULL"` maps to `"full"`.
- `"BASIC"` maps to `"basic"`.
- `"NONE"` maps to `"none"`.
- Unrecognized values (e.g., `"garbanzo beans"`) fall back to `"full"`.
- The parsed value is available via `constants.TEXTUAL_ANIMATIONS` and initializes `app.animation_level`.

### Disabling Generic Style Animations

Style animations triggered by `styles.animate()` and CSS transitions behave differently at each level.

- At `"full"`: animations play over time. At the midpoint of a 1-second animation, the property holds an intermediate value (neither start nor end).
- At `"basic"`: style animations are disabled. The property jumps immediately to the final value on the next frame after the animation starts.
- At `"none"`: style animations are disabled, same as `"basic"`. The property jumps immediately to the final value.

This applies to both `styles.animate(property, value, duration=...)` calls and TCSS `transition:` declarations.

### Loading Indicator Animation

The loading indicator animation is classified as a "basic" animation.

- At `"full"`: the loading indicator renders an animated display (not the static `"Loading..."` text).
- At `"basic"`: the loading indicator renders an animated display (not the static text), because basic animations still play.
- At `"none"`: the loading indicator falls back to a static render producing the text `"Loading..."`.

### Progress Bar Animation

The indeterminate progress bar animation is classified as a "basic" animation.

- At `"full"`: the bar's highlight range does not span the full width (animation is in progress).
- At `"basic"`: the bar's highlight range does not span the full width (animation still plays).
- At `"none"`: the bar's highlight range spans the full widget width (start is `0`, end is the bar's width), showing a fully highlighted static bar.

### Scrolling Animation

Scrolling animation is classified as a "basic" animation.

- At `"full"`: calling `scroll_end(duration=...)` on a scrollable container starts an animated scroll. `animator.is_being_animated(container, "scroll_y")` returns `True` during the animation.
- At `"basic"`: scrolling animation still plays. `is_being_animated` returns `True`.
- At `"none"`: scrolling completes instantly. `is_being_animated` returns `False` after the next frame.

### Switch Animation

The switch toggle animation (slider position) is classified as a "basic" animation.

- At `"full"`: toggling a `Switch` starts an animation on its `_slider_position` attribute. `is_being_animated(switch, "_slider_position")` returns `True` during the animation.
- At `"basic"`: the switch animation still plays. `is_being_animated` returns `True`.
- At `"none"`: the switch jumps to its final position immediately. `is_being_animated` returns `False`.

### Tabs Underline Animation

The tabs underline animation (highlight position) is classified as a "basic" animation.

- At `"full"`: switching tabs triggers animations on `highlight_start` and `highlight_end` properties (recorded by the animator).
- At `"basic"`: the underline animation still plays. Both `highlight_start` and `highlight_end` animations are recorded.
- At `"none"`: no underline animations are recorded. The underline jumps directly to its final position.

## Constraints

- The animation level is one of exactly three values: `"full"`, `"basic"`, or `"none"`. No other values are accepted by the system.
- An unrecognized `TEXTUAL_ANIMATIONS` environment variable value always falls back to `"full"`, never to `"basic"` or `"none"`.
- Style animations (both `styles.animate()` and CSS `transition:`) are disabled at `"basic"` and `"none"`. They only play at `"full"`.
- "Basic" widget animations (loading indicator, progress bar, scrolling, switch, tabs underline) play at both `"full"` and `"basic"`. They are disabled only at `"none"`.
- The distinction between animation levels is: `"full"` plays all animations; `"basic"` plays only widget-level basic animations but disables style/transition animations; `"none"` disables all animations.
- `force_stop_animation` always sets the attribute to its final value and always schedules the `on_complete` callback.
- Animations are keyed by `(id(target), attribute_name)`. Starting a new animation on the same key replaces the old one but still fires the old animation's `on_complete`.
- `stop_animation` on a non-animated attribute is a safe no-op.
- Easing functions must accept a float in `[0, 1]` and return a float. Some easing functions (back, elastic) produce values outside `[0, 1]`.
- The set of easing function names in `EASING` is exactly: `none`, `round`, `linear`, `in_sine`, `out_sine`, `in_out_sine`, `in_quad`, `out_quad`, `in_out_quad`, `in_cubic`, `out_cubic`, `in_out_cubic`, `in_quart`, `out_quart`, `in_out_quart`, `in_quint`, `out_quint`, `in_out_quint`, `in_expo`, `out_expo`, `in_out_expo`, `in_circ`, `out_circ`, `in_out_circ`, `in_back`, `out_back`, `in_out_back`, `in_elastic`, `out_elastic`, `in_out_elastic`, `in_bounce`, `out_bounce`, `in_out_bounce`.
