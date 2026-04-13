# Tutorial: Stopwatch Application

This spec documents all functionality, APIs, patterns, and behaviors demonstrated in the Textual tutorial, which builds a stopwatch application incrementally.

## App Class

### Subclassing

All Textual applications are defined by subclassing `textual.app.App`. The `App` subclass is the central unit of a Textual application: it holds configuration, widget composition, key bindings, and action methods.

### `compose()` Method

- Signature: `def compose(self) -> ComposeResult`
- A generator method that yields widget instances to build the UI.
- Widgets are added to the widget tree in yield order.
- The return type `ComposeResult` is imported from `textual.app`.

### `run()` Method

- Called on an `App` instance to enter application mode (takes over the terminal).
- Runs the app until exit.
- The app exits on `Ctrl+Q` by default.
- Standard usage pattern:

```python
if __name__ == "__main__":
    app = MyApp()
    app.run()
```

### `BINDINGS` Class Variable

- A list of tuples: `(key, action_name, description)`.
- `key`: The keyboard key that triggers the action.
- `action_name`: Maps to an `action_<name>` method on the app or widget.
- `description`: Short text displayed in the `Footer` widget.

Example:

```python
BINDINGS = [
    ("d", "toggle_dark", "Toggle dark mode"),
    ("a", "add_stopwatch", "Add"),
    ("r", "remove_stopwatch", "Remove"),
]
```

### `CSS_PATH` Class Variable

- A string specifying the path to an external Textual CSS file (`.tcss` extension).
- The file is loaded when the app starts.
- Path is relative to the Python file containing the `App` subclass.

### Action Methods

- Methods prefixed with `action_` are dispatched by the binding system.
- The action name in `BINDINGS` maps to `action_<name>()`.
- Example: `"toggle_dark"` in BINDINGS dispatches to `action_toggle_dark()`.

### Theme Toggling

- The `App.theme` attribute controls the current theme.
- Built-in theme names include `"textual-dark"` and `"textual-light"`.

## Built-in Widgets

### Header

- Import: `from textual.widgets import Header`
- Displays a title bar at the top of the screen.
- Yielded from `compose()`: `yield Header()`

### Footer

- Import: `from textual.widgets import Footer`
- Displays a bar at the bottom of the screen showing bound keys and their descriptions.
- Yielded from `compose()`: `yield Footer()`

### Button

- Import: `from textual.widgets import Button`
- Constructor: `Button(label, id=None, variant=None)`
  - `label`: String displayed on the button.
  - `id`: String identifier for CSS targeting and querying.
  - `variant`: Styling preset. `"success"` renders green; `"error"` renders red.

### Digits

- Import: `from textual.widgets import Digits`
- Displays large numeric text.
- Accepts a string argument for initial content.
- Content is updated via the `update(value)` method.

## Containers

Containers are widgets from `textual.containers` that hold and arrange child widgets.

### HorizontalGroup

- Import: `from textual.containers import HorizontalGroup`
- Arranges child widgets in a horizontal row.
- Custom widgets can extend `HorizontalGroup` and override `compose()` to yield child widgets.

### VerticalScroll

- Import: `from textual.containers import VerticalScroll`
- Arranges child widgets vertically with automatic scroll support.
- Handles scroll-related key bindings: Up, Down, Page Up, Page Down, Home, End.
- Accepts child widgets as positional constructor arguments: `VerticalScroll(Widget1(), Widget2())`.

## Custom Widget Construction

### Extending Existing Widgets

- Custom widgets are created by subclassing built-in widgets or containers.
- Each custom widget implements `compose()` to yield its child widgets.

### Widget Composition Hierarchy

The tutorial demonstrates this composition pattern:

- `StopwatchApp` (extends `App`)
  - `Header()`
  - `Footer()`
  - `VerticalScroll` (container with id `"timers"`)
    - `Stopwatch` (extends `HorizontalGroup`)
      - `Button("Start", id="start", variant="success")`
      - `Button("Stop", id="stop", variant="error")`
      - `Button("Reset", id="reset")`
      - `TimeDisplay` (extends `Digits`)

## Textual CSS

### File Format

- Textual CSS files use the `.tcss` extension.
- CSS syntax is a simplified dialect of web CSS.
- Supports live editing: CSS changes take effect without restarting the app.

### Selectors

| Selector Type | Syntax | Example | Matches |
|---------------|--------|---------|---------|
| Type selector | `WidgetName` | `Stopwatch { ... }` | All widgets of that type |
| ID selector | `#id` | `#start { ... }` | Widget with `id="start"` |
| Class selector | `.classname` | `.started { ... }` | Widgets with CSS class `"started"` |
| Combined selector | `.class #id` | `.started #start { ... }` | `#start` inside a widget with class `"started"` |
| Combined selector | `.class WidgetType` | `.started TimeDisplay { ... }` | `TimeDisplay` inside a widget with class `"started"` |

### CSS Properties

| Property | Values | Description |
|----------|--------|-------------|
| `background` | Color value (e.g., `$boost`, `$success-muted`, `blue`, `rgb(r,g,b)`) | Background color. `$` prefix references theme colors. |
| `color` | Color value (e.g., `$foreground-muted`, `$text`, `$foreground`) | Text color. |
| `height` | Integer (lines) | Widget height. |
| `width` | Integer (cells) | Widget width. |
| `min-width` | Integer (cells) | Minimum widget width. |
| `margin` | Integer (cells) | Margin around the widget. |
| `padding` | Integer (cells) | Padding inside the widget around children. |
| `text-align` | `center`, `left`, `right` | Horizontal text alignment. |
| `dock` | `left`, `right` | Aligns widget to an edge of its parent. |
| `display` | `none`, `block` | `none` hides the widget entirely; `block` shows it. |
| `visibility` | `hidden`, `visible` | `hidden` hides the widget but preserves its layout space. |
| `layout` | `horizontal` | Layout direction for children. |

### Dynamic CSS via CSS Classes

- CSS classes (distinct from Python classes) are tags added to or removed from widgets at runtime.
- Adding or removing a CSS class triggers CSS re-evaluation, updating the widget's appearance.
- A widget may have any number of CSS classes simultaneously.

Methods for manipulating CSS classes:

- `widget.add_class(name)`: Adds a CSS class to the widget.
- `widget.remove_class(name)`: Removes a CSS class from the widget.

The tutorial uses the `"started"` CSS class to toggle between default state (Start + Reset buttons visible) and started state (Stop button visible, green background).

### Display vs Visibility

- `display: none` removes the widget from the layout entirely (takes no space).
- `visibility: hidden` hides the widget but preserves its space in the layout.

## Event Handling

### Event Handler Naming Convention

- Event handlers are methods named `on_` followed by the event name.
- Example: `on_button_pressed` handles the `Button.Pressed` event.
- Textual calls these methods automatically when the corresponding event occurs.

### Button.Pressed Event

- Event type: `Button.Pressed`
- Handler signature: `def on_button_pressed(self, event: Button.Pressed) -> None`
- `event.button`: Reference to the `Button` widget that was pressed.
- `event.button.id`: The string ID of the pressed button.

### on_mount Lifecycle Event

- Handler: `def on_mount(self) -> None`
- Called when a widget is first added to the application (mounted).
- Used for initialization that requires the widget to be part of the DOM (e.g., creating timers).

## Reactive Attributes

### Declaration

- Import: `from textual.reactive import reactive`
- Declared at class scope as descriptors:

```python
class TimeDisplay(Digits):
    start_time = reactive(monotonic)  # callable default
    time = reactive(0.0)             # value default
    total = reactive(0.0)            # value default
```

- The argument to `reactive()` is either:
  - A default value (used directly), or
  - A callable (called to produce the default when the widget is instantiated).

### Access

- Reactive attributes are accessed on `self` like normal attributes: `self.time`, `self.total`.
- Assigning to a reactive attribute triggers the widget to update its display automatically.

### Watch Methods

- Methods named `watch_<attribute>` are called automatically when the corresponding reactive attribute is modified.
- Signature: `def watch_<attribute>(self, value) -> None`
- Example: `watch_time(self, time: float)` is called whenever `self.time` changes.
- Watch methods enable automatic UI updates without explicit `refresh()` calls.

## Timers

### set_interval

- Method: `self.set_interval(interval, callback, pause=False)`
- Creates a repeating timer that calls `callback` at the specified `interval` (in seconds).
- Returns a `Timer` object.
- `pause=True` starts the timer in paused state (does not fire until resumed).
- Example: `self.set_interval(1 / 60, self.update_time, pause=True)` creates a 60 Hz timer, initially paused.

### Timer Object

- `timer.resume()`: Resumes a paused timer.
- `timer.pause()`: Pauses a running timer.

## DOM Queries

### query_one

- Method: `self.query_one(selector_or_type)`
- Returns exactly one widget matching the selector or type.
- Accepts a CSS selector string (e.g., `"#timers"`) or a widget class (e.g., `TimeDisplay`).
- Raises an exception if zero or multiple widgets match.

### query

- Method: `self.query(selector)`
- Returns all widgets matching a CSS selector string (e.g., `"Stopwatch"`).
- Returns a `DOMQuery` object.
- The `DOMQuery` is truthy if it contains results, falsy if empty.
- `DOMQuery.last()`: Returns the last matching widget.

## Dynamic Widget Management

### mount

- Method: `container.mount(widget)`
- Adds a widget to the DOM at runtime.
- The widget is appended to the container's children.
- Called on the target container: `self.query_one("#timers").mount(new_stopwatch)`.

### remove

- Method: `widget.remove()`
- Removes a widget from the DOM at runtime.
- The widget is destroyed and its space is reclaimed.

### scroll_visible

- Method: `widget.scroll_visible()`
- Scrolls the nearest scrollable ancestor so that the widget is visible.
- Used after mounting a new widget to ensure it appears on screen.

## Stopwatch Application: Final Key Bindings

| Key | Action Name | Method | Behavior |
|-----|-------------|--------|----------|
| `d` | `toggle_dark` | `action_toggle_dark()` | Toggles between `"textual-dark"` and `"textual-light"` themes |
| `a` | `add_stopwatch` | `action_add_stopwatch()` | Creates and mounts a new `Stopwatch` widget in the `#timers` container |
| `r` | `remove_stopwatch` | `action_remove_stopwatch()` | Removes the last `Stopwatch` widget, if any exist |

## TimeDisplay State Machine

The `TimeDisplay` widget manages three reactive attributes to track elapsed time:

- `start_time`: The `monotonic()` timestamp when the stopwatch was last started.
- `time`: The currently displayed elapsed time in seconds.
- `total`: Accumulated elapsed time from previous start/stop cycles.

### States and Transitions

- **Stopped (initial)**: Timer is paused. `time` and `total` are `0.0`.
- **Running**: `start()` records `start_time = monotonic()` and resumes the timer. The `update_time` callback computes `self.time = self.total + (monotonic() - self.start_time)` at 60 Hz.
- **Stopped (with accumulated time)**: `stop()` pauses the timer, adds the elapsed interval to `total`, and sets `time = total`.
- **Reset**: `reset()` sets both `total` and `time` to `0`.

### Display Format

The `watch_time` method formats elapsed time as `HH:MM:SS.cc` (hours, minutes, seconds with centiseconds) and updates the `Digits` widget via `self.update()`.

## Command Palette

- The app displays a `^p palette` indicator in the bottom right corner.
- This is the Command Palette, accessible via `Ctrl+P`.
- Functions as a dedicated command prompt for the app.

## Source File Organization

The tutorial source files are located in `docs/examples/tutorial/`:

- `stopwatch01.py` -- Minimal app skeleton with Header, Footer, dark mode toggle.
- `stopwatch02.py` -- Custom widget composition (TimeDisplay, Stopwatch, VerticalScroll).
- `stopwatch03.py` -- External CSS styling via `CSS_PATH` and `stopwatch03.tcss`.
- `stopwatch04.py` -- Dynamic CSS classes for started/stopped states, with `stopwatch04.tcss`.
- `stopwatch05.py` -- Reactive attributes and timer-based updates.
- `stopwatch06.py` -- Wiring buttons to TimeDisplay start/stop/reset methods.
- `stopwatch.py` -- Final app with dynamic widget mounting/removal, with `stopwatch.tcss`.
