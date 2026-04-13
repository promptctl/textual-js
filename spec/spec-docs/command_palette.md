# Command Palette

## Overview

Textual apps include a built-in command palette that provides quick access to app functionality through a searchable command interface. The palette is opened with `ctrl+p` (configurable), presents a single input widget, and suggests commands as the user types using fuzzy matching.

## Launching and Interaction

- Press `ctrl+p` to open the command palette (a `SystemModalScreen`).
- Type to filter commands; results update on each keystroke.
- Press `Up`/`Down` to navigate the result list, `Enter` to invoke the selected command.
- Commands are matched via fuzzy search: characters must appear in order but need not be contiguous. For example, typing "th" matches "Change **th**eme".
- The fuzzy matcher returns a score between 0 (no match) and 1 (exact match). Hits with score 0 are discarded; remaining hits are ordered by score.

## Command Providers (Provider Class)

Custom commands are added by subclassing `textual.command.Provider`. This is an abstract base class requiring at minimum the `search` method.

### Provider Lifecycle Methods

All methods are async coroutines (`async def`).

| Method | Required | Called When | Purpose |
|---|---|---|---|
| `startup` | No | Command palette opens | One-time initialization before any search calls (e.g., loading file lists). |
| `search(query)` | Yes | Each keystroke (non-empty input) | Yield `Hit` instances matching the query. |
| `discover` | No | Palette opens with empty input | Yield `DiscoveryHit` instances for default/discoverable commands. |
| `shutdown` | No | Command palette closes | Cleanup resources created in `startup`. |

### Provider Properties

- `app` -- Reference to the running `App` instance.
- `screen` -- The screen that was active when the palette was invoked.
- `focused` -- The currently-focused widget (or `None`).
- `match_style` -- The style used for highlighting matched characters.

### Provider.matcher

`matcher(user_input, case_sensitive=False)` returns a `textual.fuzzy.Matcher` instance. The matcher provides:

- `match(candidate) -> float` -- Returns a score (0 = no match, 1 = exact match).
- `highlight(candidate) -> Text` -- Returns a Rich `Text` with matched characters highlighted.

### Internal Dispatch

When the search query is empty, `Provider` internally calls `discover()` instead of `search()`. This is transparent to the implementor; implement both methods and the framework routes appropriately.

### Error Handling

Errors raised inside command providers are logged but do not crash the app. This prevents a single broken provider from making the entire command palette unusable.

## Hit and DiscoveryHit

### Hit

A dataclass representing a single search result, yielded from `Provider.search`.

| Field | Type | Description |
|---|---|---|
| `score` | `float` | Match confidence, 0 to 1. |
| `match_display` | `VisualType` | Display representation (string or Rich renderable), typically from `matcher.highlight()`. |
| `command` | `IgnoreReturnCallbackType` | Callback invoked when the user selects this hit. |
| `text` | `str \| None` | Plain-text form of the command. Auto-populated from `match_display` if omitted. |
| `help` | `str \| None` | Optional help text displayed beneath the command. |

Hits are ordered by `score` (higher scores appear first).

### DiscoveryHit

A dataclass representing a discoverable command, yielded from `Provider.discover`.

| Field | Type | Description |
|---|---|---|
| `display` | `VisualType` | Display representation (string or Rich renderable). |
| `command` | `IgnoreReturnCallbackType` | Callback invoked when the user selects this hit. |
| `text` | `str \| None` | Plain-text form. Auto-populated from `display` if omitted. |
| `help` | `str \| None` | Optional help text. |

Discovery hits always have a score of 0. Their display order is determined by yield order from the provider.

### Hits Type Alias

`Hits` is defined as `AsyncIterator[DiscoveryHit | Hit]` and is the return type for `search` and `discover`.

## Registering Command Providers (COMMANDS)

### App.COMMANDS

A class variable on `App` (type: `set[type[Provider] | Callable[[], type[Provider]]]`). Defaults to a set containing the system commands provider.

To add a custom provider while keeping defaults:

```python
class MyApp(App):
    COMMANDS = App.COMMANDS | {MyCustomProvider}
```

### Screen.COMMANDS

Screens also have a `COMMANDS` class variable (defaults to an empty set). Providers declared on a screen are only active when that screen is the current screen. Use this for screen-specific commands.

## System Commands

System commands are the default commands provided by every Textual app, managed by `SystemCommandsProvider` (included in `App.COMMANDS` by default).

### App.get_system_commands

Override this method to add custom system commands. It receives the active `screen` and should yield `SystemCommand` instances.

Always call `super().get_system_commands(screen)` to preserve built-in commands:

```python
def get_system_commands(self, screen: Screen) -> Iterable[SystemCommand]:
    yield from super().get_system_commands(screen)
    yield SystemCommand("Bell", "Ring the bell", self.bell)
```

### SystemCommand

A `NamedTuple` with the following fields:

| Field | Type | Default | Description |
|---|---|---|---|
| `title` | `str` | (required) | Command title shown in the palette and used for search matching. |
| `help` | `str` | (required) | Help text shown beneath the title. |
| `callback` | `CommandCallback` | (required) | Callable invoked when the command is selected. |
| `discover` | `bool` | `True` | If `True`, the command appears when the search input is empty. If `False`, it only appears when the user has typed something. |

### Built-in System Commands

The base `App.get_system_commands` yields commands conditionally based on app/screen state:

- **Theme** -- Change the current theme (only when `ansi_color` is `False`).
- **Quit** -- Quit the application.
- **Keys** -- Show or hide the help panel (label changes based on current state).
- **Minimize** -- Minimize a maximized widget (only when a widget is maximized).

## Discovery Commands

Discovery commands are shown when the command palette is opened before the user types anything. Two mechanisms produce discovery commands:

1. **SystemCommand with `discover=True`** -- System commands with `discover=True` (the default) appear in the empty-input list.
2. **Provider.discover method** -- Custom providers can yield `DiscoveryHit` instances to populate the initial list.

Discovery hits should be fast to generate since they are displayed immediately when the palette opens. Expensive lookups belong in `search`.

## Disabling the Command Palette

Set `ENABLE_COMMAND_PALETTE = False` on the `App` class:

```python
class NoPaletteApp(App):
    ENABLE_COMMAND_PALETTE = False
```

This causes `action_command_palette` to be ignored. The instance attribute `app.use_command_palette` can also be set at runtime.

## Changing the Palette Key Binding

Set `COMMAND_PALETTE_BINDING` on the `App` class (default: `"ctrl+p"`):

```python
class MyApp(App):
    COMMAND_PALETTE_BINDING = "ctrl+backslash"
```

`COMMAND_PALETTE_DISPLAY` (default: `None`) controls how the key is displayed in the footer.
