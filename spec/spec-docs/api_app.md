# API: App

API specification for the `textual.app` module.

## Module Exports

### `ComposeResult`

Type alias: `Iterable[Widget]`. The return type of `compose()` methods.

### `RenderResult`

Type alias: `RenderableType | Visual | SupportsVisual`. The return type of `Widget.render()`.

### `AutopilotCallbackType`

Type alias for callbacks that drive the app programmatically via a `Pilot`.

### `CommandCallback`

Type alias for callbacks used in `get_system_commands`. Accepts synchronous or async callables returning any type.

### `SystemCommand`

A `NamedTuple` yielded from `get_system_commands` defining a command palette entry.

| Field | Type | Description |
|---|---|---|
| `title` | `str` | The title of the command (used in search). |
| `help` | `str` | Additional help text shown under the title. |
| `callback` | `CommandCallback` | Callable invoked when the command is selected. |
| `discover` | `bool` | Whether the command shows when search is empty (default `True`). |

## Exceptions

| Exception | Description |
|---|---|
| `AppError` | Base class for general App-related exceptions. |
| `ScreenStackError` | Raised on invalid screen stack operations. |
| `ScreenError` | Raised on screen-related errors. |
| `InvalidThemeError` | Raised when setting `theme` to an unregistered name. |
| `CssPathError` | Raised when supplied CSS paths are invalid. |
| `SuspendNotSupported` | Raised when suspension is attempted in an environment that does not support it. |

## `App` Class

```python
class App(Generic[ReturnType], DOMNode):
```

Base class for all Textual applications. Generic over `ReturnType`, the type returned by `run()` via `exit()`.

### Construction

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
| `driver_class` | Driver class or `None` for auto-detection. |
| `css_path` | Path to CSS file(s), or `None` to use `CSS_PATH` class variable. |
| `watch_css` | Live-reload CSS when files change. |
| `ansi_color` | Preserve the terminal's 16 ANSI theme colors when `True`. |

Raises `CssPathError` if supplied CSS paths are invalid.

### Class Variables

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
| `AUTO_FOCUS` | `str \| None` | `"*"` | CSS selector for auto-focus target. |
| `ALLOW_SELECT` | `bool` | `True` | Enable arbitrary text selection. |
| `ENABLE_COMMAND_PALETTE` | `bool` | `True` | Enable the command palette. |
| `COMMAND_PALETTE_BINDING` | `str` | `"ctrl+p"` | Key to open the command palette. |
| `COMMANDS` | `set[type[Provider]]` | `{SystemCommandsProvider}` | Command providers. |
| `NOTIFICATION_TIMEOUT` | `float` | `5` | Seconds before auto-dismissing notifications. |
| `BINDINGS` | `list[BindingType]` | `[ctrl+q, ctrl+c]` | Default key bindings. |
| `CLOSE_TIMEOUT` | `float \| None` | `5.0` | Timeout for widget close. |
| `TOOLTIP_DELAY` | `float` | `0.5` | Seconds before showing tooltips. |
| `ESCAPE_TO_MINIMIZE` | `bool` | `True` | Use Escape to minimize maximized widgets. |
| `INLINE_PADDING` | `int` | `1` | Blank lines above an inline app. |
| `CLICK_CHAIN_TIME_THRESHOLD` | `float` | `0.5` | Max seconds between clicks for chaining. |
| `ALLOW_IN_MAXIMIZED_VIEW` | `str` | `"Footer"` | Widgets allowed when a widget is maximized. |
| `HORIZONTAL_BREAKPOINTS` | `list[tuple[int, str]]` | `[]` | Width-based responsive CSS classes. |
| `VERTICAL_BREAKPOINTS` | `list[tuple[int, str]]` | `[]` | Height-based responsive CSS classes. |
| `SUSPENDED_SCREEN_CLASS` | `str` | `""` | CSS class applied to suspended screens. |
| `PAUSE_GC_ON_SCROLL` | `bool` | `False` | Pause garbage collection during scrolling. |

### Reactive Attributes

| Attribute | Type | Description |
|---|---|---|
| `title` | `str` | App title (displayed in Header). Coerced to `str`. |
| `sub_title` | `str` | App subtitle (displayed in Header). Coerced to `str`. |
| `theme` | `str` | Name of the active theme. |
| `app_focus` | `bool` | Whether the app has focus. |
| `ansi_color` | `bool` | Whether ANSI colors are preserved. |
| `ansi_theme_dark` | `TerminalTheme` | ANSI-to-hex mapping for dark themes. |
| `ansi_theme_light` | `TerminalTheme` | ANSI-to-hex mapping for light themes. |

### Properties

| Property | Type | Description |
|---|---|---|
| `return_value` | `ReturnType \| None` | Value passed to `exit()`. |
| `return_code` | `int \| None` | Return code passed to `exit()`, or `None`. |
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
| `ansi_theme` | `TerminalTheme` | ANSI theme for the current light/dark mode. |
| `active_bindings` | `dict[str, ActiveBinding]` | Currently active key bindings. |
| `scroll_sensitivity_x` | `float` | Columns scrolled per event (default `4.0`). |
| `scroll_sensitivity_y` | `float` | Lines scrolled per event (default `2.0`). |

### CSS Pseudo-Classes

| Pseudo-Class | Matches When |
|---|---|
| `:focus` | App has focus. |
| `:blur` | App does not have focus. |
| `:dark` | Current theme is dark. |
| `:light` | Current theme is light. |
| `:inline` | App is running in inline mode. |
| `:ansi` | ANSI color mode is enabled. |
| `:nocolor` | `NO_COLOR` environment variable is set. |

### Lifecycle Methods

#### `compose()`

Override to yield `Widget` instances that form the initial UI. Widgets are mounted onto the default screen.

```python
def compose(self) -> ComposeResult
```

#### `on_mount`

Handle the `Mount` event for setup that requires the app to be running. Handlers may be sync or async.

#### `recompose()`

Remove all children from the current screen and re-run `compose`.

### Running

#### `run()`

```python
def run(
    headless: bool = False,
    inline: bool = False,
    inline_no_clear: bool = False,
    mouse: bool = True,
    size: tuple[int, int] | None = None,
    auto_pilot: AutopilotCallbackType | None = None,
    loop: AbstractEventLoop | None = None,
) -> ReturnType | None
```

Enter application mode, take over the terminal, and block until exit. Returns the value passed to `exit()`.

#### `run_async()`

Async equivalent of `run()`. Use when already inside an asyncio event loop. Same parameters except `loop`.

#### `run_test()`

Async context manager for headless testing.

```python
async with app.run_test(
    headless: bool = True,
    size: tuple[int, int] = (80, 24),
    tooltips: bool = False,
    notifications: bool = False,
    message_hook: Callable | None = None,
) as pilot:
    ...
```

### Exiting

#### `exit()`

```python
def exit(
    result: ReturnType | None = None,
    return_code: int = 0,
    message: RenderableType | None = None,
) -> None
```

Exit the app. `result` becomes the return value of `run()`. Optional `message` is printed after exit.

### Screen Management

| Method | Description |
|---|---|
| `push_screen(screen, callback=None, wait_for_dismiss=False)` | Push a screen onto the stack. |
| `pop_screen()` | Remove the topmost screen. |
| `switch_screen(screen)` | Replace the topmost screen. |
| `install_screen(screen, name)` | Register a screen by name. |

### Mode Management

| Method | Description |
|---|---|
| `switch_mode(mode)` | Activate a mode, initializing its stack if needed. |
| `add_mode(mode, base_screen)` | Add a mode at runtime. |

### Theme Management

| Method | Description |
|---|---|
| `register_theme(theme)` | Register or override a theme. |
| `unregister_theme(name)` | Remove a registered theme. |

Setting `theme` to an unregistered name raises `InvalidThemeError`.

### Suspend and Resume

#### `suspend()`

Context manager that temporarily leaves application mode.

```python
with self.suspend():
    os.system("vim myfile.txt")
```

Raises `SuspendNotSupported` if the environment does not support suspension.

#### `action_suspend_process`

Sends `SIGTSTP` to the process (Unix/macOS only). Disabled by default.

#### Signals

| Signal | Published When |
|---|---|
| `app_suspend_signal` | Just before the app suspends. |
| `app_resume_signal` | When the app resumes after suspension. |
| `theme_changed_signal` | When the theme changes. |

### Notifications

```python
def notify(
    message: str,
    title: str = "",
    severity: "information" | "warning" | "error" = "information",
    timeout: float | None = None,
    markup: bool = True,
) -> None
```

Thread-safe toast notification.

`clear_notifications()` removes all active notifications.

### Mounting Widgets

```python
def mount(
    *widgets: Widget,
    before: int | str | Widget | None = None,
    after: int | str | Widget | None = None,
) -> AwaitMount
```

Mount widgets at runtime. Returns an awaitable. `await` the result to interact with mounted widgets immediately.

### Focus

`set_focus(widget, scroll_visible=True)` sets focus programmatically.

### Built-in Actions

| Action | Behavior |
|---|---|
| `action_quit` | Exit the app. |
| `action_bell` | Terminal bell. |
| `action_focus(widget_id)` | Focus by ID. |
| `action_focus_next` | Focus next widget. |
| `action_focus_previous` | Focus previous widget. |
| `action_toggle_dark` | Toggle between dark and light themes. |
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

### Default Bindings

| Key | Action | Description |
|---|---|---|
| `ctrl+q` | `quit` | Quit the app (priority binding). |
| `ctrl+c` | `help_quit` | System binding. |

### Command Palette

Override `get_system_commands(screen)` to add custom commands to the built-in provider.

### Responsive Breakpoints

`HORIZONTAL_BREAKPOINTS` and `VERTICAL_BREAKPOINTS` apply CSS classes based on terminal dimensions. Each entry is `(min_size, class_name)`. Only the largest matching class is active per axis.

### Inline Mode

Pass `inline=True` to `run()` for inline display beneath the prompt.

- `inline_no_clear=True` preserves output after exit.
- `:inline` CSS pseudo-class matches when running inline.
- `INLINE_PADDING` controls blank lines above.
- Not supported on Windows.

### `get_system_commands_provider()`

Module-level callable that lazily loads and returns the `SystemCommandsProvider` class.
