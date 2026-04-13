# App

Specification for the `App` class (`textual.app.App`), the base class for all Textual applications.

## Overview

Every Textual application is a subclass of `App`. The `App` class is generic: `App[ReturnType]` declares the type that `run()` may return. If no return type is needed, use `App` (equivalent to `App[None]`).

`App` inherits from `DOMNode` and serves as the root of the DOM tree.

## Construction

```python
App(
    driver_class: Type[Driver] | None = None,
    css_path: CSSPathType | None = None,
    watch_css: bool = False,
    ansi_color: bool = False,
)
```

| Parameter | Description |
|---|---|
| `driver_class` | Driver class or `None` for auto-detection. Used by tooling. |
| `css_path` | Path to CSS file(s), or `None` to use the `CSS_PATH` class variable. Accepts a single path or list of paths. |
| `watch_css` | Live-reload CSS when files change. Automatically enabled by `textual run --dev`. |
| `ansi_color` | When `True`, preserve the terminal's 16 ANSI theme colors. When `False` (default), map ANSI colors to Textual's own palette. |

Raises `CssPathError` if supplied CSS paths are invalid.

## Lifecycle

### Compose

Override `compose()` to yield `Widget` instances that form the initial UI. This is a generator method:

```python
def compose(self) -> ComposeResult:
    yield Header()
    yield Footer()
```

Widgets yielded from `compose` are mounted onto the default screen.

### Mount

After the app enters application mode, it receives a `Mount` event. Handle it with `on_mount` to perform setup that requires the app to be running (e.g., setting styles, starting workers).

Event handlers may be synchronous or `async` (coroutines). Textual awaits coroutine handlers automatically.

### Recompose

Call `recompose()` to remove all children from the current screen and re-run `compose`. This rebuilds the UI from scratch.

### Shutdown

The app shuts down when `exit()` is called or an unhandled exception occurs. Textual restores the terminal to its original state and returns control to the caller of `run()`.

## Running the App

### `run()`

Create an app instance and call `run()` to start it:

```python
app = MyApp()
result = app.run()
```

`run()` enters application mode, takes over the terminal (no echo, full screen), and blocks until the app exits. Returns the value passed to `exit()`, or `None`.

| Parameter | Description |
|---|---|
| `headless` | Run with no output (used internally for testing). |
| `inline` | Run inline beneath the prompt instead of full-screen. |
| `inline_no_clear` | Keep inline app output visible after exit. |
| `mouse` | Enable mouse support (default `True`). |
| `size` | Force terminal size as `(width, height)`, or `None` to auto-detect. |
| `auto_pilot` | Coroutine that drives the app programmatically via a `Pilot`. |
| `loop` | Explicit asyncio event loop, or `None` for the default. |

### `run_async()`

Async equivalent of `run()`. Use when the app is already running inside an asyncio event loop. Same parameters as `run()` except `loop`.

### Inline Mode

Pass `inline=True` to `run()` to display the app beneath the terminal prompt rather than entering full-screen application mode. Inline apps integrate with the normal terminal workflow.

- Use `inline_no_clear=True` to preserve the app's output after exit.
- Not currently supported on Windows.
- The `:inline` CSS pseudo-class matches when running inline.
- `INLINE_PADDING` class variable controls blank lines above an inline app (default `1`).

### Testing with `run_test()`

`run_test()` is an async context manager that runs the app in headless mode and yields a `Pilot` for programmatic interaction:

```python
async with app.run_test() as pilot:
    await pilot.click("#ok-button")
```

| Parameter | Default | Description |
|---|---|---|
| `headless` | `True` | Suppress output. |
| `size` | `(80, 24)` | Terminal dimensions. |
| `tooltips` | `False` | Enable tooltips. |
| `notifications` | `False` | Enable notifications. |
| `message_hook` | `None` | Callback invoked for every message at every pump. |

## CSS

### External CSS (`CSS_PATH`)

Set the `CSS_PATH` class variable to one or more `.tcss` file paths. Relative paths are resolved relative to the file where the `App` subclass is defined.

```python
class MyApp(App):
    CSS_PATH = "my_app.tcss"
```

Multiple paths may be provided as a list; they are loaded in order.

### Inline CSS (`CSS`)

Set the `CSS` class variable to a string of CSS. This is loaded after `CSS_PATH` and takes priority on specificity ties.

```python
class MyApp(App):
    CSS = """
    Screen {
        background: blue;
    }
    """
```

### Default CSS (`DEFAULT_CSS`)

Lowest-priority CSS defined on the class. Provides base styling. App's default CSS sets the background and foreground from theme variables.

### CSS Live Reload

When `watch_css=True` (or running via `textual run --dev`), Textual monitors CSS files and reloads them on change.

## Title and Subtitle

`App` has reactive `title` and `sub_title` attributes displayed by the built-in `Header` widget.

### Defaults

| Class Variable | Attribute | Default |
|---|---|---|
| `TITLE` | `title` | Name of the App subclass |
| `SUB_TITLE` | `sub_title` | Empty string |

### Dynamic Updates

Assign to `self.title` or `self.sub_title` at any time. These are reactive attributes; the Header updates automatically without an explicit refresh.

Values are always coerced to `str`.

## Exiting

### `exit()`

```python
def exit(
    result: ReturnType | None = None,
    return_code: int = 0,
    message: RenderableType | None = None,
) -> None
```

Exits the app. The `result` value becomes the return value of `run()`. An optional `message` is rendered to the terminal after exit.

### Return Value

`run()` returns the value passed to `exit(result=...)`, or `None` if `exit()` was called without a result. Use `App[str]` (or other type) to declare the expected return type for type checkers.

Access after exit via `app.return_value`.

### Return Code

`exit()` accepts a `return_code` integer (default `0`). Access after exit via `app.return_code`.

| Condition | Return Code |
|---|---|
| Normal exit | `0` |
| Unhandled exception | `1` |
| Custom error | Application-defined non-zero value |

Textual does not call `sys.exit()` itself. To propagate the return code to the OS:

```python
app.run()
sys.exit(app.return_code or 0)
```

## Suspend and Resume

### `suspend()` Context Manager

Temporarily leaves application mode so another terminal program can run:

```python
with self.suspend():
    os.system("vim myfile.txt")
```

While suspended, the app stops reading input and emitting output. On exit from the `with` block, application mode resumes and the display refreshes.

Raises `SuspendNotSupported` if the environment does not support suspension (e.g., Textual Web).

### `action_suspend_process`

Sends `SIGTSTP` to the process (Unix/macOS only), suspending it to the background as if the user pressed Ctrl+Z. This is disabled by default; bind it to a key to enable:

```python
BINDINGS = [("ctrl+z", "suspend_process")]
```

Ignored on Windows and under Textual Web.

### Signals

| Signal | Published When |
|---|---|
| `app_suspend_signal` | Just before the app suspends. |
| `app_resume_signal` | When the app resumes after suspension. |

## Themes

### Active Theme

The `theme` reactive attribute holds the name of the active theme (default from `constants.DEFAULT_THEME`). Assign a theme name to switch:

```python
self.theme = "textual-light"
```

Setting `theme` triggers CSS re-evaluation, applies `-dark-mode` / `-light-mode` classes, and publishes `theme_changed_signal`.

### Registering Themes

```python
app.register_theme(theme)    # Register or override a theme
app.unregister_theme(name)   # Remove a registered theme
```

`available_themes` property returns all themes (built-in plus registered).

`current_theme` property returns the active `Theme` object.

Setting `theme` to an unregistered name raises `InvalidThemeError`.

### Dark / Light Mode

The `:dark` and `:light` CSS pseudo-classes match based on the current theme's `dark` attribute. `action_toggle_dark` switches between `textual-dark` and `textual-light`.

### ANSI Color

When `ansi_color` is `True`, Textual preserves the terminal's native 16 ANSI colors. The `:ansi` pseudo-class matches in this mode. The `textual-ansi` theme automatically enables ANSI color mode.

ANSI-to-truecolor mapping uses `ansi_theme_dark` and `ansi_theme_light` reactive attributes (Rich `TerminalTheme` objects).

### `NO_COLOR`

If the `NO_COLOR` environment variable is set, Textual applies a monochrome or no-color filter. The `:nocolor` pseudo-class matches.

## Screens and Modes

### Screen Stack

Each mode maintains its own screen stack. The topmost screen is the active (visible) screen.

| Method | Behavior |
|---|---|
| `push_screen(screen, callback=None)` | Push a screen onto the stack. Optional callback receives the dismiss result. With `wait_for_dismiss=True` (workers only), returns a Future for the dismiss value. |
| `pop_screen()` | Remove the topmost screen. |
| `switch_screen(screen)` | Replace the topmost screen. |
| `install_screen(screen, name)` | Register a screen by name to prevent destruction when off-stack. |

`screen_stack` property returns a snapshot (copy) of the current mode's stack.

### Modes

Modes provide independent screen stacks. Define modes via the `MODES` class variable mapping mode names to base screen references (screen names, Screen subclasses, or callables returning screens).

```python
MODES = {
    "default": MainScreen,
    "help": HelpScreen,
}
```

`DEFAULT_MODE` class variable names the initial mode (default `"_default"`).

| Method | Behavior |
|---|---|
| `switch_mode(mode)` | Activate a mode, initializing its stack if needed. |
| `add_mode(mode, base_screen)` | Add a mode at runtime. |
| `current_mode` | Property returning the active mode name. |

### Installed Screens (`SCREENS`)

The `SCREENS` class variable maps names to Screen callables, available for the app's lifetime:

```python
SCREENS = {"settings": SettingsScreen}
```

## Command Palette

The command palette provides a searchable command launcher.

| Class Variable | Default | Description |
|---|---|---|
| `ENABLE_COMMAND_PALETTE` | `True` | Enable/disable the command palette. |
| `COMMAND_PALETTE_BINDING` | `"ctrl+p"` | Key to open the palette. |
| `COMMANDS` | `{get_system_commands_provider}` | Set of `Provider` classes for command discovery. |

Override `get_system_commands(screen)` to add custom commands to the built-in system command provider.

`action_command_palette` opens the palette programmatically.

## Notifications

```python
app.notify(
    message: str,
    title: str = "",
    severity: "information" | "warning" | "error" = "information",
    timeout: float | None = None,
    markup: bool = True,
)
```

Displays a toast notification. Thread-safe.

`NOTIFICATION_TIMEOUT` class variable sets the default display duration (default `5` seconds).

`clear_notifications()` removes all active notifications.

## Bindings and Actions

### Default Bindings

| Key | Action | Description |
|---|---|---|
| `ctrl+q` | `quit` | Quit the app (priority binding). |
| `ctrl+c` | `help_quit` | System binding. |

### Built-in Actions

| Action | Behavior |
|---|---|
| `action_quit` | Exit the app. |
| `action_bell` | Play the terminal bell. |
| `action_focus(widget_id)` | Focus a widget by ID. |
| `action_focus_next` | Focus the next widget. |
| `action_focus_previous` | Focus the previous widget. |
| `action_toggle_dark` | Toggle between `textual-dark` and `textual-light`. |
| `action_switch_screen(name)` | Switch screens. |
| `action_push_screen(name)` | Push a screen. |
| `action_pop_screen` | Pop the current screen. |
| `action_switch_mode(mode)` | Switch modes. |
| `action_back` | Pop the current screen (alias). |
| `action_suspend_process` | Suspend the process (Unix only). |
| `action_screenshot` | Save an SVG screenshot. |
| `action_command_palette` | Open the command palette. |
| `action_show_help_panel` | Show the keys/help panel. |
| `action_hide_help_panel` | Hide the keys/help panel. |

## Focus

`focused` property returns the currently focused widget on the active screen, or `None`.

`AUTO_FOCUS` class variable (default `"*"`) is a CSS selector determining which widget receives initial focus when a screen activates. Set to `None` or `""` to disable auto-focus.

`set_focus(widget, scroll_visible=True)` sets focus programmatically.

## Configuration Class Variables

Summary of all `App` class variables that configure behavior:

| Variable | Type | Default | Description |
|---|---|---|---|
| `CSS` | `str` | `""` | Inline CSS string. |
| `CSS_PATH` | `CSSPathType \| None` | `None` | Path(s) to external CSS files. |
| `DEFAULT_CSS` | `str` | *(base styles)* | Lowest-priority default CSS. |
| `TITLE` | `str \| None` | `None` | Default app title (falls back to class name). |
| `SUB_TITLE` | `str \| None` | `None` | Default app subtitle. |
| `SCREENS` | `dict[str, Callable]` | `{}` | Named screen factories. |
| `MODES` | `dict[str, str \| Callable]` | `{}` | Mode-to-base-screen mapping. |
| `DEFAULT_MODE` | `str` | `"_default"` | Initial mode name. |
| `AUTO_FOCUS` | `str \| None` | `"*"` | Selector for auto-focus target. |
| `ALLOW_SELECT` | `bool` | `True` | Enable arbitrary text selection. |
| `ENABLE_COMMAND_PALETTE` | `bool` | `True` | Enable the command palette. |
| `COMMAND_PALETTE_BINDING` | `str` | `"ctrl+p"` | Key to launch the command palette. |
| `COMMANDS` | `set[type[Provider]]` | `{SystemCommandsProvider}` | Command providers. |
| `NOTIFICATION_TIMEOUT` | `float` | `5` | Seconds before auto-dismissing notifications. |
| `BINDINGS` | `list[BindingType]` | `[ctrl+q, ctrl+c]` | Default key bindings. |
| `CLOSE_TIMEOUT` | `float \| None` | `5.0` | Timeout for widget close, `None` for no timeout. |
| `TOOLTIP_DELAY` | `float` | `0.5` | Seconds before showing tooltips. |
| `ESCAPE_TO_MINIMIZE` | `bool` | `True` | Use Escape to minimize maximized widgets. |
| `INLINE_PADDING` | `int` | `1` | Blank lines above an inline app. |
| `CLICK_CHAIN_TIME_THRESHOLD` | `float` | `0.5` | Max seconds between clicks for chaining (double/triple click). |
| `ALLOW_IN_MAXIMIZED_VIEW` | `str` | `"Footer"` | Widgets allowed when a widget is maximized. |
| `HORIZONTAL_BREAKPOINTS` | `list[tuple[int, str]]` | `[]` | Width-based responsive CSS classes. |
| `VERTICAL_BREAKPOINTS` | `list[tuple[int, str]]` | `[]` | Height-based responsive CSS classes. |
| `SUSPENDED_SCREEN_CLASS` | `str` | `""` | CSS class applied to suspended screens. |
| `PAUSE_GC_ON_SCROLL` | `bool` | `False` | Pause garbage collection during scrolling (experimental). |

## Reactive Attributes

| Attribute | Type | Description |
|---|---|---|
| `title` | `str` | App title (displayed in Header). |
| `sub_title` | `str` | App subtitle (displayed in Header). |
| `theme` | `str` | Name of the active theme. |
| `app_focus` | `bool` | Whether the app has focus (always `True` in terminal; may vary in web). |
| `ansi_color` | `bool` | Whether ANSI colors are preserved. |
| `ansi_theme_dark` | `TerminalTheme` | ANSI-to-hex mapping for dark themes. |
| `ansi_theme_light` | `TerminalTheme` | ANSI-to-hex mapping for light themes. |

## CSS Pseudo-Classes

| Pseudo-Class | Matches When |
|---|---|
| `:focus` | App has focus. |
| `:blur` | App does not have focus. |
| `:dark` | Current theme is dark. |
| `:light` | Current theme is light. |
| `:inline` | App is running in inline mode. |
| `:ansi` | ANSI color mode is enabled. |
| `:nocolor` | `NO_COLOR` environment variable is set. |

## Properties

| Property | Type | Description |
|---|---|---|
| `return_value` | `ReturnType \| None` | Value passed to `exit()`. |
| `return_code` | `int \| None` | Return code passed to `exit()`, or `None` if not yet set. |
| `focused` | `Widget \| None` | Currently focused widget. |
| `screen` | `Screen` | The active (topmost) screen. |
| `screen_stack` | `list[Screen]` | Snapshot of the current mode's screen stack. |
| `current_mode` | `str` | Name of the active mode. |
| `workers` | `WorkerManager` | The worker manager. |
| `is_headless` | `bool` | Running in headless mode. |
| `is_inline` | `bool` | Running in inline mode. |
| `is_web` | `bool` | Running in a web browser. |
| `debug` | `bool` | Debug mode enabled. |
| `current_theme` | `Theme` | The active theme object. |
| `available_themes` | `dict[str, Theme]` | All registered themes. |
| `ansi_theme` | `TerminalTheme` | The ANSI theme for the current light/dark mode. |
| `active_bindings` | `dict[str, ActiveBinding]` | Currently active key bindings. |

## Responsive Breakpoints

`HORIZONTAL_BREAKPOINTS` and `VERTICAL_BREAKPOINTS` enable responsive styling by applying CSS classes based on terminal dimensions.

Each entry is a `(min_size, class_name)` tuple. Only one class is active at a time per axis: the one with the largest `min_size` that does not exceed the current dimension.

```python
HORIZONTAL_BREAKPOINTS = [
    (0, "-normal"),
    (80, "-wide"),
    (120, "-very-wide"),
]
```

## Scroll Sensitivity

`scroll_sensitivity_x` (default `4.0`) and `scroll_sensitivity_y` (default `2.0`) control how many columns/lines to scroll per wheel or trackpad event. X sensitivity is doubled relative to Y to account for cells being approximately twice as tall as wide.

## Mounting Widgets at Runtime

Call `mount(widget)` to add widgets after compose. Mounting is asynchronous; the widget is guaranteed to be available by the next message handler. To interact with a mounted widget immediately, `await` the mount:

```python
await self.mount(Welcome())
self.query_one(Button).label = "YES!"
```

Without `await`, querying the newly mounted widget in the same handler raises `NoMatches`.
