# Switch

## Overview

A `Switch` is a toggle widget that slides between on and off states. It holds a boolean `value` and provides an animated slider transition when toggled.

### Value and Toggling

- Default `value` is `False` (off).
- `switch.value = True` or `switch.value = False` sets the state programmatically.
- `switch.action_toggle_switch()` flips the value from its current state.
- Clicking the switch toggles its value.

### Click Event Handling

- When a `Switch` is clicked, the click event does not bubble up to parent widgets. The switch consumes the click internally so that ancestor `on_click` handlers are never triggered by a switch interaction.

### Animation

The switch toggle is classified as a **basic animation** -- it plays at both `"full"` and `"basic"` animation levels.

- When `app.animation_level` is `"full"`, toggling animates the internal `_slider_position` property over time.
- When `app.animation_level` is `"basic"`, the same slider animation plays.
- When `app.animation_level` is `"none"`, no animation occurs; the slider position updates instantly.

### Focus and Interaction

- `Switch` is focusable and participates in the normal tab-order focus cycle.
- A `Switch` can be disabled, which removes it from focus and prevents interaction.

## Constraints

- `Switch.value` is always `bool`.
- Clicking a `Switch` must never propagate a click event to ancestor widgets.
- The slider animation plays at animation levels `"full"` and `"basic"`, and is suppressed at `"none"`. Animation level is the single control point for whether the transition animates.
- The animated property is `_slider_position`; it is an internal detail driven by `value`, not an independent source of truth.
