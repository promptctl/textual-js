# textual.command

The `textual.command` module contains classes for working with Textual's command palette, including the `CommandPalette` screen, command `Provider` base class, and hit data types.

## Type Aliases

### `Hits`

```python
Hits: TypeAlias = AsyncIterator[DiscoveryHit | Hit]
```

Return type for the command provider's `search` and `discover` methods.

### `ProviderSource`

```python
ProviderSource: TypeAlias = Iterable[type[Provider] | Callable[[], type[Provider]]]
```

The type used to declare providers for a `CommandPalette`. Supports both direct `Provider` subclasses and lazy-loading callables that return `Provider` subclasses.

### `CommandListItem`

```python
CommandListItem: TypeAlias = (
    SimpleCommand
    | tuple[str, IgnoreReturnCallbackType, str | None]
    | tuple[str, IgnoreReturnCallbackType]
)
```

Accepted types for items in a `SimpleProvider` command list.

## `Hit` Dataclass

Holds the details of a single command search hit.

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `score` | `float` | -- | Match score between 0 (no match) and 1 (complete match). |
| `match_display` | `VisualType` | -- | A string or Rich renderable representation of the hit. |
| `command` | `IgnoreReturnCallbackType` | -- | The function to call when the command is chosen. |
| `text` | `str \| None` | `None` | Plain text of the command. Auto-populated from `match_display` if not provided. |
| `help` | `str \| None` | `None` | Optional help text for the command. |

### Properties

| Property | Type | Description |
|---|---|---|
| `prompt` | `VisualType` | The prompt to display in the command palette. Returns `match_display`. |

### Ordering

`Hit` instances are ordered by `score`. Supports `<` and `==` comparisons against other `Hit` instances.

## `DiscoveryHit` Dataclass

Holds the details of a single discovery command hit (shown before user input).

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `display` | `VisualType` | -- | A string or Rich renderable representation of the hit. |
| `command` | `IgnoreReturnCallbackType` | -- | The function to call when the command is chosen. |
| `text` | `str \| None` | `None` | Plain text of the command. Auto-populated from `display` if not provided. |
| `help` | `str \| None` | `None` | Optional help text for the command. |

### Properties

| Property | Type | Description |
|---|---|---|
| `prompt` | `VisualType` | The prompt to display. Returns `display`. |
| `score` | `float` | Always returns `0.0`. Display order is determined by yield order from the provider. |

### Ordering

`DiscoveryHit` instances are ordered by `text` (reverse alphabetical). Supports `<` comparison against other `DiscoveryHit` instances and `==` comparison against `Hit` instances (by `text`).

## `Provider` Class (ABC)

```python
class Provider(ABC)
```

Base class for command palette command providers. Subclass this and implement `search` to create a new provider.

### Constructor

```python
Provider(screen: Screen[Any], match_style: Style | None = None)
```

| Parameter | Type | Description |
|---|---|---|
| `screen` | `Screen[Any]` | A reference to the active screen. |
| `match_style` | `Style \| None` | Optional style for highlighting matching portions of hit text. Must be a `textual.style.Style` if provided. |

### Properties

| Property | Type | Description |
|---|---|---|
| `focused` | `Widget \| None` | The currently-focused widget in the active screen. `None` if no widget has focus. |
| `screen` | `Screen[object]` | The currently-active screen in the application. |
| `app` | `App[object]` | A reference to the application. |
| `match_style` | `Style \| None` | The preferred style for highlighting matching portions of hit text. |

### Methods

#### `matcher(user_input, case_sensitive=False) -> Matcher`

Create a fuzzy matcher for the given user input.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `user_input` | `str` | -- | The text that the user has input. |
| `case_sensitive` | `bool` | `False` | Whether matching should be case sensitive. |

Returns a `Matcher` object configured with the provider's `match_style`.

#### `async startup() -> None`

Called after the provider is initialized, but before any calls to `search`. Override to perform async initialization. Exceptions are caught and logged.

#### `async search(query: str) -> Hits` (abstract)

Search for commands relevant to the given query. Must be implemented by subclasses.

| Parameter | Type | Description |
|---|---|---|
| `query` | `str` | The user input to match against. |

Yields `Hit` instances.

#### `async discover() -> Hits`

Yield a default collection of hits shown before user input. Unlike `search`, this yields `DiscoveryHit` instances. Implementation is optional.

#### `async shutdown() -> None`

Called when the provider is shut down. Override to perform cleanup. Exceptions are caught and logged.

## `SimpleCommand` NamedTuple

A simple command definition.

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | `str` | -- | The name of the command. |
| `callback` | `IgnoreReturnCallbackType` | -- | The callback to invoke when selected. |
| `help_text` | `str \| None` | `None` | The description of the command. |

## `SimpleProvider` Class

```python
class SimpleProvider(Provider)
```

A provider that the caller can pass a list of commands to directly. Accepts `CommandListItem` entries: `SimpleCommand` instances or tuples of `(name, callback)` or `(name, callback, help_text)`.

### Constructor

```python
SimpleProvider(screen: Screen[Any], commands: list[CommandListItem])
```

| Parameter | Type | Description |
|---|---|---|
| `screen` | `Screen[Any]` | A reference to the active screen. |
| `commands` | `list[CommandListItem]` | The list of commands this provider serves. |

### Methods

#### `async search(query: str) -> Hits`

Searches the command list using fuzzy matching. Yields `Hit` instances for commands with a positive match score.

#### `async discover() -> Hits`

Yields all commands as `DiscoveryHit` instances.

## `Command` Class

```python
class Command(Option)
```

An `OptionList.Option` subclass that holds a `Hit` or `DiscoveryHit`. Used internally to populate the command list display.

### Constructor

```python
Command(prompt: VisualType, hit: DiscoveryHit | Hit, id: str | None = None, disabled: bool = False)
```

| Parameter | Type | Description |
|---|---|---|
| `prompt` | `VisualType` | The prompt to display for this option. |
| `hit` | `DiscoveryHit \| Hit` | The hit associated with this option. |
| `id` | `str \| None` | Optional ID for the option. |
| `disabled` | `bool` | Initial enabled/disabled state. Default: enabled. |

### Attributes

| Attribute | Type | Description |
|---|---|---|
| `hit` | `DiscoveryHit \| Hit` | The hit details associated with this option. |

Ordering delegates to the underlying `hit` object.

## `CommandList` Class

```python
class CommandList(OptionList, can_focus=False)
```

The internal option list widget used within the command palette. Cannot receive focus.

## `CommandInput` Class

```python
class CommandInput(Input)
```

The internal input widget used within the command palette.

## `SearchIcon` Class

```python
class SearchIcon(Static, inherit_css=False)
```

Widget for displaying a search icon before the command input.

### Reactives

| Reactive | Type | Default | Description |
|---|---|---|---|
| `icon` | `str` | `"🔎"` | The icon to display. |

## `CommandPalette` Class

```python
class CommandPalette(SystemModalScreen[None])
```

The Textual command palette screen. A modal screen that provides a searchable command interface.

### Class Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `AUTO_FOCUS` | `str` | `"CommandInput"` | Automatically focus the command input on mount. |
| `run_on_select` | `bool` | `True` | If `True`, run the command immediately when selected. If `False`, fill the input and require a second confirmation. |

### Component Classes

| Class | Description |
|---|---|
| `command-palette--help-text` | Targets the help text of a matched command. |
| `command-palette--highlight` | Targets the highlights of a matched command. |

### Bindings

| Key(s) | Action | Description |
|---|---|---|
| `ctrl+end`, `shift+end` | `command_list('last')` | Jump to last available command. |
| `ctrl+home`, `shift+home` | `command_list('first')` | Jump to first available command. |
| `down` | `cursor_down` | Navigate down through commands. |
| `escape` | `escape` | Exit the command palette. |
| `pagedown` | `command_list('page_down')` | Navigate down a page. |
| `pageup` | `command_list('page_up')` | Navigate up a page. |
| `up` | `command_list('cursor_up')` | Navigate up through commands. |

### Constructor

```python
CommandPalette(
    providers: ProviderSource | None = None,
    *,
    placeholder: str = "Search for commands\u2026",
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `providers` | `ProviderSource \| None` | `None` | Optional list of providers. If `None`, uses providers from `App.COMMANDS` and `Screen.COMMANDS`. |
| `placeholder` | `str` | `"Search for commands\u2026"` | Placeholder text for the command input. |

### Static Methods

#### `is_open(app) -> bool`

Test whether a command palette is currently open.

| Parameter | Type | Description |
|---|---|---|
| `app` | `App[object]` | The app to test. |

### Messages

#### `CommandPalette.OptionHighlighted`

Posted to `App` when an option is highlighted in the command palette.

| Attribute | Type | Description |
|---|---|---|
| `highlighted_event` | `OptionList.OptionHighlighted` | The underlying option highlighted event. |

#### `CommandPalette.Opened`

Posted to `App` when the command palette is opened.

#### `CommandPalette.Closed`

Posted to `App` when the command palette is closed.

| Attribute | Type | Description |
|---|---|---|
| `option_selected` | `bool` | `True` if an option was selected, `False` if the palette was closed without selecting. |

### Internal Constants

| Constant | Value | Description |
|---|---|---|
| `_BUSY_COUNTDOWN` | `0.5` | Seconds to wait before showing a busy indicator. |
| `_NO_MATCHES_COUNTDOWN` | `0.5` | Seconds to wait before showing "No matches found". |
| `_RESULT_BATCH_TIME` | `0.25` | Seconds to wait before batching command results into the list. |
