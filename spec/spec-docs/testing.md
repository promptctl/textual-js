# Testing

Textual provides a testing infrastructure centered around the `run_test()` context manager and the `Pilot` object. Together they allow headless, async-driven interaction with an app -- simulating key presses, mouse events, terminal resizing, and controlled shutdown -- without a real terminal.

## Testing Approach and Philosophy

- Textual is an async framework powered by Python's asyncio library. Tests must support async execution.
- The recommended test stack is pytest with the pytest-asyncio plugin. Setting `asyncio_mode = auto` in pytest configuration avoids needing `@pytest.mark.asyncio` on every test.
- The `run_test()` method replaces the usual `run()` call and operates the app in headless mode: no terminal output, but otherwise identical behavior.
- Tests follow a pattern of: construct the app, enter `run_test()`, simulate user interactions via the `Pilot`, and assert state changes.

## run_test Context Manager

### Basic Usage

- `app.run_test()` is an async context manager that yields a `Pilot` instance.
- The app is fully composed and mounted by the time the context body executes.
- Because `run_test()` is async, test functions must use the `async` keyword.

```python
async with app.run_test() as pilot:
    await pilot.press("r")
    assert app.screen.styles.background == Color.parse("red")
```

### Parameters

- `headless` (bool, default `True`): Run in headless mode with no output or input.
- `size` (tuple[int, int] | None, default `(80, 24)`): Force terminal size to `(WIDTH, HEIGHT)`, or `None` to auto-detect. This is the single authority for initial terminal dimensions within a test.
- `tooltips` (bool, default `False`): Enable tooltips when testing.
- `notifications` (bool, default `False`): Enable notifications when testing.
- `message_hook` (Callable[[Message], None] | None, default `None`): An optional callback invoked each time any message arrives at any message pump in the app.

### Return Value

- After the context manager exits, `app.return_value` holds whatever value was passed to `pilot.exit()`.

### Exception Propagation

- Exceptions raised inside `App.compose()` propagate out of the `run_test()` block and can be caught by the test framework.
- Exceptions raised inside a `Screen.compose()` that is pushed during mount also propagate out.
- Exceptions raised inside action handlers (triggered via key bindings) propagate out.
- Exceptions raised inside workers propagate out as `WorkerFailed`.
- Stylesheet errors (e.g., referencing a nonexistent `CSS_PATH`) raise `StylesheetError` immediately when the context manager is entered, before any pilot interaction.

## Pilot API

The `Pilot` class (`textual.pilot.Pilot`) drives the app programmatically. It is generic over `ReturnType`, matching the app's return type.

### Properties

- `pilot.app`: A reference to the application instance.

### String Representation

- `str(pilot)` produces a string of the form `<Pilot app=...>` showing the associated app's repr.

### Pressing Keys

- `await pilot.press(*keys)` sends key events to the app. Each positional argument is a discrete key event; there is no batching or coalescing.
- Single printable characters are passed directly: `await pilot.press("h", "e", "l", "l", "o")`.
- Non-printable keys use their name: `"enter"`, `"tab"`, `"escape"`, `"up"`, `"down"`, etc.
- Modifier combinations use the `ctrl+` prefix: `"ctrl+c"`, `"ctrl+s"`.
- Key identifiers match those used by Textual key events (discoverable via `textual keys`).

### Clicking

- `await pilot.click()` with no arguments clicks the screen at `(0, 0)`.
- `await pilot.click(selector)` clicks a widget matched by a CSS selector string (e.g., `"#my-button"`).
- `await pilot.click(WidgetClass)` clicks a widget matched by its class (e.g., `Button`).
- `await pilot.click(widget_instance)` clicks a specific widget instance.
- `await pilot.click(offset=(x, y))` clicks at coordinates relative to the screen or, if combined with a selector, relative to the matched widget.
- `await pilot.click(selector, times=N)` repeats the full click sequence (MouseDown, MouseUp, Click) N times for double/triple click simulation.
- `button` parameter (int, default `1`): The mouse button to use.
- Modifier key parameters: `shift`, `meta`, `control` (all bool, default `False`).
- Returns `True` when the targeted widget is actually hit. Returns `False` when the targeted widget is obscured by another widget on top of it.
- When targeting the screen itself (no selector), always returns `True` for in-bounds coordinates.
- Internally emits MouseDown, MouseUp, and Click events, bypassing `App.on_event` but updating `App.mouse_position`.

### Double and Triple Click

- `await pilot.double_click(...)` is an alias for `pilot.click(..., times=2)`.
- `await pilot.triple_click(...)` is an alias for `pilot.click(..., times=3)`.
- Both accept the same parameters as `click` (except `times`).

### Hovering

- `await pilot.hover()` with no arguments hovers over the screen.
- `await pilot.hover(selector_or_class)` hovers over a widget matched by selector string or widget class.
- `await pilot.hover(offset=(x, y))` hovers at coordinates relative to screen or widget.
- Internally calls `pause()` first to let the mouse "settle", then emits a MouseMove event.
- Returns `True` when the targeted widget is hit, `False` when it is obscured.

### Mouse Down and Mouse Up

- `await pilot.mouse_down(...)` simulates a MouseDown event (preceded by MouseMove).
- `await pilot.mouse_up(...)` simulates a MouseUp event (preceded by MouseMove).
- Both accept the same selector/offset/modifier arguments as `click` and `hover`.
- `mouse_down` accepts an additional `button` parameter (int, default `1`).
- They follow the same return-value semantics: `True` if the target widget is hit, `False` if obscured.

### Coordinate System and Bounds Checking

- Coordinates use the screen's coordinate system: `(0, 0)` is the top-left corner, `(width-1, height-1)` is the bottom-right corner.
- All mouse methods (`click`, `hover`, `mouse_down`, `mouse_up`) raise `OutOfBounds` when the offset falls outside the screen boundaries (negative coordinates or coordinates beyond width/height).
- Targeting a widget that is not currently scrolled into view raises `OutOfBounds`. This applies to selector-based and class-based targeting.

### Resizing the Terminal

- `await pilot.resize_terminal(width, height)` changes the simulated terminal size.
- Posts a `Resize` event and calls `pause()`.
- After resizing, both `app.size` and `app.screen.size` reflect the new dimensions.
- When running with `HeadlessDriver`, the driver's internal size is also updated.

### Pausing

- `await pilot.pause()` waits for all pending messages to be processed across the app and its screen's widget tree. Uses an internal counter mechanism that calls `call_later` on every child widget and waits for all callbacks to fire.
- `await pilot.pause(delay)` accepts an optional numeric duration in seconds; the pause lasts at least that long before resuming, allowing time-dependent behavior to advance by a controlled amount.
- When no delay is specified, waits for CPU idle via `wait_for_idle`.
- Always calls `screen._on_timer_update()` after waiting.
- Essential after programmatic mutations (e.g., `scroll_visible()`, posting messages) to ensure state has settled before assertions.

### Waiting for Animations

- `await pilot.wait_for_animation()` waits for any currently running animation to complete.
- `await pilot.wait_for_scheduled_animations()` waits for both current and scheduled animations to complete, including a full screen wait and idle wait.

### Exiting

- `await pilot.exit(result)` triggers app shutdown. The provided value becomes `app.return_value` after the context manager closes.
- Waits for the screen and idle state before calling `app.exit()`.

## Exceptions

- `OutOfBounds`: Raised when a pilot mouse target is outside of the visible screen. Never silently ignored; there is no clamping or fallback.
- `WaitForScreenTimeout`: Raised if messages are not being processed quickly enough during `_wait_for_screen()`. The most likely cause is a deadlock in app code. Default timeout is 30 seconds.

## Simulating User Interactions

### Key Interaction Patterns

```python
# Single key
await pilot.press("enter")

# Multiple keys in sequence
await pilot.press("h", "e", "l", "l", "o")

# Modifier keys
await pilot.press("ctrl+c")
```

### Click Interaction Patterns

```python
# Click at screen origin
await pilot.click()

# Click at specific screen coordinates
await pilot.click(offset=(10, 5))

# Click a widget by selector
await pilot.click("#my-button")

# Click relative to a widget (one line above a button)
await pilot.click(Button, offset=(0, -1))

# Double click
await pilot.click(Button, times=2)

# Ctrl+click
await pilot.click("#slider", control=True)
```

### Changing Screen Size

```python
async with app.run_test(size=(100, 50)) as pilot:
    ...  # App runs at 100x50

# Or resize dynamically during the test
await pilot.resize_terminal(120, 40)
```

## Snapshot Testing

Textual provides the `pytest-textual-snapshot` plugin for visual regression testing via SVG screenshots.

### Installation

```
pip install pytest-textual-snapshot
```

### The snap_compare Fixture

- `snap_compare(path)` takes the path to a Python file containing a Textual app (relative to the test file location).
- Returns `True` if the current screenshot matches the stored snapshot, `False` otherwise.
- First run always fails because there is no previous snapshot to compare against.

### Workflow

1. Write the test: `assert snap_compare("path/to/app.py")`
2. Run `pytest` -- the test fails on first run and generates an HTML snapshot report.
3. Visually inspect the report to confirm the output is correct.
4. Run `pytest --snapshot-update` to save the snapshot as ground truth.
5. On subsequent runs, `pytest` compares new screenshots against the saved snapshot.

### snap_compare Parameters

- `press`: List of keys to simulate before capturing the snapshot.
  ```python
  assert snap_compare("calculator.py", press=["1", "2", "3"])
  ```
- `terminal_size`: Tuple `(width, height)` to set a custom terminal size for capture.
  ```python
  assert snap_compare("calculator.py", terminal_size=(50, 100))
  ```
- `run_before`: Async callable receiving a `Pilot` instance, executed before capture.
  ```python
  async def run_before(pilot) -> None:
      await pilot.hover("#number-5")

  assert snap_compare("calculator.py", run_before=run_before)
  ```

### Snapshot Reports

- The report is an HTML file that can be exported as a CI build artifact.
- Shows side-by-side comparison of current vs. historical snapshots.
- Includes a "Show difference" overlay toggle to highlight pixel-level changes.
- Works in CI on all supported operating systems.

## Async Testing Patterns

- All pilot methods are coroutines and must be awaited.
- Tests using `run_test()` must be async functions.
- With pytest-asyncio, either decorate each test with `@pytest.mark.asyncio` or set `asyncio_mode = auto` in pytest config.
- After simulating interactions, call `await pilot.pause()` if state changes are not yet reflected, as messages may still be in flight.
- Use `assert` statements after interactions to verify state changes; pytest records assertion failures as test failures.

## Constraints

- `OutOfBounds` is raised -- not silently ignored -- for any mouse interaction targeting coordinates outside the screen.
- Mouse methods return a boolean indicating whether the intended widget was actually hit, allowing tests to assert visibility and stacking order without inspecting internal layout state.
- Exceptions from compose, actions, and workers are never swallowed; they propagate through `run_test()` so standard test-framework assertion mechanisms (e.g., `pytest.raises`) work naturally.
- The `size` parameter on `run_test()` is the single authority for initial terminal dimensions within a test.
- `pilot.press()` treats each positional argument as a discrete key event; there is no batching or coalescing.
- Tooltips and notifications are disabled by default in test mode; opt in via `run_test()` parameters.
