# Testing

Textual provides a testing infrastructure centered around the `run_test()` context manager and the `Pilot` object. Together they allow headless, async-driven interaction with an app -- simulating key presses, mouse events, terminal resizing, and controlled shutdown -- without a real terminal.

## run_test Context Manager

### Basic Usage

- `app.run_test()` is an async context manager that yields a `Pilot` instance.
- The app is fully composed and mounted by the time the context body executes.
- `run_test()` accepts an optional `size` tuple `(width, height)` to set the simulated terminal dimensions (e.g., `app.run_test(size=(80, 24))`).
- `run_test()` accepts transient controls for timing-sensitive UI. In textual-js this is modeled as `transients={ notifications?: bool, tooltips?: bool }`, and both default to disabled.
- `run_test()` keeps tooltips disabled by default. Tests that need tooltip rendering must opt in explicitly.

### Return Value

- After the context manager exits, `app.return_value` holds whatever value was passed to `pilot.exit()`.

### Exception Propagation

- Exceptions raised inside `App.compose()` propagate out of the `run_test()` block and can be caught by the test framework.
- Exceptions raised inside a `Screen.compose()` that is pushed during mount also propagate out.
- Exceptions raised inside action handlers (triggered via key bindings) propagate out.
- Exceptions raised inside workers propagate out as `WorkerFailed`.
- Stylesheet errors (e.g., referencing a nonexistent `CSS_PATH`) raise `StylesheetError` immediately when the context manager is entered, before any pilot interaction.

## Pilot API

### String Representation

- `str(pilot)` produces a string of the form `<Pilot app=...>` showing the associated app's repr.

### Pressing Keys

- `await pilot.press(key)` sends a key event to the app. The key is specified as a string (e.g., `"tab"`, `"enter"`, `"b"`).
- `pilot.press()` accepts multiple keys as positional arguments: `await pilot.press("tab", *"foo")` sends `"tab"`, `"f"`, `"o"`, `"o"` in sequence.
- ASCII letters, digits, and all standard punctuation characters are valid key arguments.

### Clicking

- `await pilot.click()` with no arguments clicks the screen.
- `await pilot.click(selector)` clicks a widget matched by a CSS selector string (e.g., `"#label0"`).
- `await pilot.click(WidgetClass)` clicks a widget matched by its class (e.g., `Button`).
- `await pilot.click(widget_instance)` clicks a specific widget instance obtained from a query.
- `await pilot.click(offset=(x, y))` clicks at absolute screen coordinates.
- `await pilot.click(selector, times=N)` repeats the full click sequence (MouseDown, MouseUp, Click) N times.
- Returns `True` when the targeted widget is actually hit. Returns `False` when the targeted widget is obscured by another widget on top of it.
- When targeting the screen itself (no selector), always returns `True` for in-bounds coordinates.

### Hovering

- `await pilot.hover()` with no arguments hovers over the screen.
- `await pilot.hover(selector_or_class)` hovers over a widget matched by selector string or widget class.
- `await pilot.hover(offset=(x, y))` hovers at absolute screen coordinates.
- Returns `True` when the targeted widget is hit, `False` when it is obscured.

### Mouse Down and Mouse Up

- `await pilot.mouse_down(...)` and `await pilot.mouse_up(...)` accept the same arguments as `click` and `hover`: no arguments (targets screen), a selector string, a widget class, or an `offset` tuple.
- They follow the same return-value semantics: `True` if the target widget is hit, `False` if obscured.

### Coordinate System and Bounds Checking

- Coordinates use the screen's coordinate system: `(0, 0)` is the top-left corner, `(width-1, height-1)` is the bottom-right corner.
- All mouse methods (`click`, `hover`, `mouse_down`, `mouse_up`) raise `OutOfBounds` when the offset falls outside the screen boundaries (negative coordinates or coordinates beyond width/height).
- Targeting a widget that is not currently scrolled into view raises `OutOfBounds`. This applies to selector-based and class-based targeting.

### Resizing the Terminal

- `await pilot.resize_terminal(width, height)` changes the simulated terminal size.
- After resizing (and a `pause()`), both `app.size` and `app.screen.size` reflect the new dimensions.

### Pausing

- `await pilot.pause()` yields control so the app can process pending events (layout, scrolling, etc.). Typically called after programmatic mutations like `scroll_visible()` or `resize_terminal()`.
- `await pilot.pause(duration)` accepts an optional numeric duration in seconds; the pause lasts at least that long before resuming, allowing time-dependent behavior (e.g., incremental reveal) to advance by a controlled amount.

### Exiting

- `await pilot.exit(value)` triggers app shutdown. The provided value becomes `app.return_value` after the context manager closes.

## Test Utilities

### camel_to_snake

- `camel_to_snake(name)` converts a CamelCase string to snake_case.
- `camel_to_snake("FooBar")` returns `"foo_bar"`.

## Constraints

- `OutOfBounds` is raised -- not silently ignored -- for any mouse interaction targeting coordinates outside the screen. There is no silent clamping or fallback.
- Mouse methods return a boolean indicating whether the intended widget was actually hit, allowing tests to assert visibility and stacking order without inspecting internal layout state.
- Exceptions from compose, actions, and workers are never swallowed; they propagate through `run_test()` so standard test-framework assertion mechanisms (e.g., `pytest.raises`) work naturally.
- The `size` parameter on `run_test()` is the single authority for initial terminal dimensions within a test.
- Transient suppression is active before the first render. Notifications and tooltips emitted during initial mount are absent from test state unless the corresponding transient opt-in is enabled.
- `pilot.press()` treats each positional argument as a discrete key event; there is no batching or coalescing.
- `camel_to_snake` must insert underscores at CamelCase boundaries and lowercase the result.
