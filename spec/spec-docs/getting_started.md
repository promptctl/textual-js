# Getting Started and Tutorial

## Requirements

Textual requires Python 3.9 or later. It runs on Linux, macOS, and Windows.

### Platform Notes

- **Linux**: All distros include a terminal emulator capable of running Textual apps. The Linux console (outside a desktop environment) has limited support documented separately.
- **macOS**: The default Terminal.app is limited to 256 colors. Recommended alternatives: iTerm2, Ghostty, Kitty, WezTerm.
- **Windows**: Windows Terminal is the recommended terminal emulator.

## Installation

### From PyPI

```
pip install textual
```

Developer tools (provides the `textual` CLI command):

```
pip install textual-dev
```

Optional syntax highlighting for the TextArea widget:

```
pip install "textual[syntax]"
```

### From conda-forge

```
micromamba install -c conda-forge textual
micromamba install -c conda-forge textual-dev
```

### Textual CLI

The `textual-dev` package provides the `textual` command with subcommands for development tasks (devtools, live CSS editing, etc.). Run `textual --help` for available commands.

### Demo

```
python -m textual
```

Runs a built-in demo showcasing Textual capabilities.

## First App: Minimal Structure

The smallest Textual app requires subclassing `App` and calling `run()`:

```python
from textual.app import App, ComposeResult
from textual.widgets import Footer, Header

class StopwatchApp(App):
    BINDINGS = [("d", "toggle_dark", "Toggle dark mode")]

    def compose(self) -> ComposeResult:
        yield Header()
        yield Footer()

    def action_toggle_dark(self) -> None:
        self.theme = (
            "textual-dark" if self.theme == "textual-light" else "textual-light"
        )

if __name__ == "__main__":
    app = StopwatchApp()
    app.run()
```

### Key Elements

- **`App` subclass**: All Textual apps extend `App`. This class holds configuration, widget composition, key bindings, and action methods.
- **`compose()` method**: A generator that yields widget instances to build the UI. Widgets are added in yield order. This is the declarative entry point for the widget tree.
- **`BINDINGS` class variable**: A list of `(key, action_name, description)` tuples that map keyboard input to action methods. The description appears in the `Footer` widget.
- **Action methods**: Methods prefixed with `action_` that are dispatched by the binding system. The action name in `BINDINGS` maps to `action_<name>`.
- **`run()` method**: Enters application mode (takes over the terminal) and runs the app until exit. The app exits on `Ctrl+Q` by default.
- **`__name__ == "__main__"` guard**: Allows the app to be run directly or imported.

## Tutorial: Stopwatch Application

The tutorial builds a stopwatch application incrementally across six stages, introducing core Textual concepts at each step.

### Stage 1: App Skeleton

An empty app with `Header`, `Footer`, key binding for dark mode toggle, and the `action_toggle_dark` action. Demonstrates the minimal app structure described above.

### Stage 2: Custom Widgets and Composition

Introduces custom widget classes by composing built-in widgets:

- **`TimeDisplay`**: Extends `Digits` (a built-in widget for displaying large numeric text). Initially a plain subclass with no added behavior.
- **`Stopwatch`**: Extends `HorizontalGroup` (a container that arranges children in a horizontal row). Its `compose()` yields `Button("Start")`, `Button("Stop")`, `Button("Reset")`, and `TimeDisplay()`.
- **`VerticalScroll`**: A scrollable container used in the app's `compose()` to hold multiple `Stopwatch` instances. Accepts child widgets as positional arguments: `VerticalScroll(Stopwatch(), Stopwatch(), Stopwatch())`.

Key concepts introduced:

- **Containers**: Widgets from `textual.containers` that hold and arrange child widgets. `HorizontalGroup` lays out children horizontally; `VerticalScroll` lays out children vertically with scroll support.
- **`Button` widget**: Accepts a label string, optional `id` for identification, and optional `variant` for styling (`"success"` = green, `"error"` = red).
- **Widget IDs**: String identifiers set via the `id` parameter, used for CSS targeting and querying.

### Stage 3: Textual CSS

Introduces CSS styling via external `.tcss` files:

- **`CSS_PATH` class variable**: Set on the `App` subclass to specify the path to a CSS file loaded at startup.
- **File extension**: Textual CSS files use the `.tcss` extension.
- **Declaration blocks**: CSS rules target widgets by type name (e.g., `Stopwatch { ... }`), by ID with `#` prefix (e.g., `#start { ... }`), or by CSS class with `.` prefix.

CSS properties demonstrated:

| Property | Example | Effect |
|----------|---------|--------|
| `background` | `$boost` | Background color. `$` prefix references theme colors. |
| `height` | `5` | Height in lines of text. |
| `margin` | `1` | Margin in cells around the widget. |
| `min-width` | `50` | Minimum width in cells. |
| `padding` | `1` | Padding in cells around child widgets. |
| `text-align` | `center` | Horizontal text alignment. |
| `color` | `$foreground-muted` | Text color. |
| `width` | `16` | Width in cells. |
| `dock` | `left` / `right` | Aligns widget to an edge of its parent. |
| `display` | `none` | Hides the widget entirely. |

### Stage 4: Dynamic CSS with CSS Classes

Introduces CSS classes for dynamic styling:

- **CSS classes** (distinct from Python classes): Tags added to or removed from widgets at runtime to change their appearance.
- **CSS class selectors**: Prefixed with `.` in CSS (e.g., `.started`).
- **Combined selectors**: `.started #start { display: none }` matches `#start` only when it is inside a widget with the `started` CSS class.
- **`add_class(name)`**: Adds a CSS class to a widget, triggering CSS re-evaluation.
- **`remove_class(name)`**: Removes a CSS class from a widget, triggering CSS re-evaluation.

Event handling introduced:

- **`on_button_pressed` method**: An event handler named by convention: `on_` + event name (`button_pressed`). Textual calls this method when a `Button.Pressed` event is received.
- **`event.button.id`**: Identifies which button triggered the event.

### Stage 5: Reactive Attributes

Introduces the reactive system for automatic widget updates:

- **`reactive` descriptor**: Imported from `textual.reactive`. Declared at class scope: `time = reactive(0.0)`. The argument is either a default value or a callable that returns the default.
- **Attribute access**: Reactive attributes are accessed on `self` like normal attributes (e.g., `self.time = 5.0`).
- **Watch methods**: Methods named `watch_<attribute>` are called automatically when the reactive attribute changes. For example, `watch_time(self, time: float)` is called whenever `self.time` is assigned a new value.
- **Automatic refresh**: Assigning to a reactive attribute triggers the widget to update its display.

Timer system introduced:

- **`set_interval(interval, callback, pause=False)`**: Creates a repeating timer. Returns a `Timer` object. When `pause=True`, the timer starts paused and must be resumed with `timer.resume()`.
- **`Timer.resume()`**: Resumes a paused timer.
- **`Timer.pause()`**: Pauses a running timer.

Mount event:

- **`on_mount` method**: Event handler called when a widget is first added to the app (mounted). Used for initialization that requires the widget to be part of the DOM.

### Stage 6: Wiring Buttons to Behavior

Connects buttons to `TimeDisplay` methods (`start()`, `stop()`, `reset()`) using the event handler and `query_one()`:

- **`query_one(selector_or_type)`**: Returns exactly one widget matching the selector or type. Used to find a child widget: `self.query_one(TimeDisplay)`.
- **`total` reactive attribute**: Accumulates elapsed time across start/stop cycles.

### Final Stage: Dynamic Widgets

Adds the ability to create and destroy widgets at runtime:

- **`mount(widget)`**: Adds a widget to the DOM at runtime. Called on a container: `self.query_one("#timers").mount(new_stopwatch)`.
- **`remove()`**: Removes a widget from the DOM.
- **`query(selector)`**: Returns all widgets matching a CSS selector. Returns a `DOMQuery` object.
- **`DOMQuery.last()`**: Returns the last matching widget.
- **`scroll_visible()`**: Scrolls the nearest scrollable ancestor to make the widget visible.

Final app key bindings:

| Key | Action | Effect |
|-----|--------|--------|
| `d` | `toggle_dark` | Toggle light/dark theme |
| `a` | `add_stopwatch` | Mount a new `Stopwatch` widget |
| `r` | `remove_stopwatch` | Remove the last `Stopwatch` widget |

## Key Concepts Summary

The tutorial introduces the following core Textual concepts in order:

1. **App subclass and `run()`** -- Entry point for all Textual applications.
2. **`compose()` method** -- Declarative widget tree construction via generators.
3. **Key bindings (`BINDINGS`)** -- Mapping keyboard input to action methods.
4. **Action methods (`action_*`)** -- Named methods dispatched by the binding system.
5. **Built-in widgets** -- `Header`, `Footer`, `Button`, `Digits`.
6. **Containers** -- `HorizontalGroup`, `VerticalScroll` for layout.
7. **Widget IDs** -- String identifiers for CSS targeting and querying.
8. **Textual CSS (`CSS_PATH`, `.tcss` files)** -- External stylesheets with simplified CSS syntax.
9. **CSS selectors** -- Type selectors, ID selectors (`#`), class selectors (`.`), combined selectors.
10. **CSS classes** -- Runtime-toggled tags that trigger CSS re-evaluation (`add_class`, `remove_class`).
11. **Event handlers (`on_*`)** -- Convention-based methods called in response to events.
12. **Reactive attributes** -- Descriptors that trigger watch methods and automatic refresh on assignment.
13. **Watch methods (`watch_*`)** -- Callbacks invoked when reactive attributes change.
14. **Timers (`set_interval`)** -- Repeating callbacks with pause/resume support.
15. **`on_mount` lifecycle event** -- Initialization after a widget is added to the DOM.
16. **DOM queries (`query_one`, `query`)** -- Finding widgets by type or CSS selector.
17. **Dynamic widget management (`mount`, `remove`)** -- Adding and removing widgets at runtime.

## Examples Repository

The Textual repository contains example applications in the `/examples/` directory and documentation code listings in `/docs/examples/`. The tutorial source files are in `/docs/examples/tutorial/` with progressive filenames: `stopwatch01.py` through `stopwatch06.py`, plus the final `stopwatch.py` and `stopwatch.tcss`.
