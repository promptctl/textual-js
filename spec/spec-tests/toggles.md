# Toggles: Checkbox, RadioButton, and RadioSet

## Overview

Toggle widgets provide boolean on/off controls. `Checkbox` and `RadioButton` are individual toggle buttons with a `value` property and a `toggle()` method. `RadioSet` groups `RadioButton` instances so that at most one button is selected at a time.

### Checkbox

A `Checkbox` holds a boolean `value` (default `False`) and an optional text label.

- Constructed with `Checkbox("label text")` or `Checkbox(value=True)`.
- `checkbox.value` reflects the current on/off state.
- `checkbox.toggle()` flips the value.
- The CSS class `-on` is present when `value` is `True` and absent when `False`.
- Setting `value` at construction does not emit a `Changed` message; only programmatic or user-driven changes after mount emit messages.

### RadioButton

A `RadioButton` has the same interface as `Checkbox`: a boolean `value`, a `toggle()` method, a `-on` CSS class, and an optional label.

- Constructed with `RadioButton("label text")` or `RadioButton(value=True)`.
- When used outside a `RadioSet`, multiple `RadioButton` instances are independent -- toggling one does not affect others.
- Initial state follows the `value` parameter without emitting messages.

### Labels

Both `Checkbox` and `RadioButton` expose a `label` property of type `Content`.

- Read the label: `widget.label` returns a `Content` instance (e.g., `Content("Before")`).
- Set the label: assigning a plain string (`widget.label = "After"`) updates the label and is reflected as `Content("After")` on the next read.
- Labels on `RadioButton` children inside a `RadioSet` are independently settable the same way.

### Messages

Both `Checkbox` and `RadioButton` post a `Changed` message when their value changes after mount.

- `Checkbox.Changed`: exposes `event.checkbox` (the widget) and `event.checkbox.value` (new value). `event.control` equals the originating checkbox.
- `RadioButton.Changed`: exposes `event.radio_button` (the widget) and `event.radio_button.value` (new value). `event.control` equals the originating radio button.
- Messages arrive in the order toggles were called, after an `await pilot.pause()` in tests.
- No message is emitted for initial state set during construction.

### RadioSet

A `RadioSet` enforces mutual exclusion: at most one contained `RadioButton` is on at any time.

- **Construction from RadioButtons**: compose `RadioButton` children inside a `with RadioSet():` block.
- **Construction from strings**: pass strings directly to `RadioSet("One", "Two", "Three")`, which creates `RadioButton` children automatically.
- `radio_set.pressed_index` returns the integer index of the currently-on button, or `-1` if none is selected.
- `radio_set.pressed_button` returns the currently-on `RadioButton` instance, or `None` if none is selected.
- Toggling a button inside a `RadioSet` turns off the previously-on button and turns on the new one. The set then posts a `RadioSet.Changed` message with `event.index` (integer index of the newly selected button), `event.radio_set` (the set itself), and `event.pressed` (the newly selected `RadioButton`). `event.control` equals the `RadioSet`.
- Toggling an already-on button inside a `RadioSet` is a no-op: the value stays on, no message is emitted, and `pressed_index` is unchanged.
- If multiple buttons are composed with `value=True`, only the first one remains on after mount.

### RadioSet Focus and Navigation

- Clicking any `RadioButton` inside a `RadioSet` focuses the `RadioSet` itself (not the individual button).
- Arrow keys (`up`, `down`, `left`, `right`) move the internal selection cursor between buttons within the set. Pressing `enter` activates the currently highlighted button.
- Navigation wraps: pressing `up` from the first button moves to the last, and `down` from the last moves to the first.
- When a `RadioSet` receives focus and no button is currently pressed, the internal cursor initializes to the first button (index 0) on the first key press.
- `tab` moves focus to the next focusable widget after the set; `shift+tab` moves to the previous one. The `RadioSet` is a single tab stop.
- Disabled buttons (`RadioButton(disabled=True)`) are skipped during keyboard navigation. Arrow keys jump over disabled buttons to the next enabled one in the direction of travel.
- Buttons mounted into an initially empty `RadioSet` after composition are navigable; the internal selection starts as `None` and is set on the first arrow key press.

## Constraints

- `Checkbox.value` and `RadioButton.value` are always `bool`. The `-on` CSS class is the single derived representation of `value` and stays synchronized.
- A `RadioSet` enforces that exactly zero or one child button has `value=True` at any time. Composing multiple `value=True` buttons collapses to only the first.
- `Changed` messages are never emitted for initial construction state -- only for post-mount changes.
- `RadioSet.Changed` is not emitted when the user toggles the already-selected button.
- Disabled buttons within a `RadioSet` are unreachable via keyboard navigation but do not break index tracking or wrap-around behavior.
- `label` assignment accepts plain strings and always reads back as `Content`.
