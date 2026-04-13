# Actions and Key Bindings

## Action System

### Action Methods

Actions are allow-listed functions identified by the `action_` prefix on App, Screen, or Widget classes. They are regular methods (sync or async) that can be invoked directly, but are designed to be dispatched via action strings.

```python
class MyApp(App):
    def action_set_background(self, color: str) -> None:
        self.screen.styles.background = color
```

Action methods may be coroutines (defined with `async`).

### Action Strings

Action strings use a function-call-like syntax that Textual parses (without `eval`):

- **No parameters**: `"bell"` calls `action_bell()`.
- **With parameters**: `"set_background('red')"` calls `action_set_background('red')`. Parameters must be valid Python literals (numbers, strings, dicts, lists). Variables and symbol references are not allowed.
- **With namespace**: `"app.set_background('red')"` routes the action to the App instance.

Format: `[namespace.]action_name[(parameters)]`

### Running Actions

- `run_action(action_string)` parses and dispatches an action string. It is a coroutine.
- Actions are also dispatched automatically from markup links (`@click` tag) and key bindings.

### Actions in Markup Links

Actions may be embedded in content markup using the `@click` tag. When a user clicks such a link, Textual runs the specified action string.

```python
class MyWidget(Widget):
    def compose(self) -> ComposeResult:
        yield Static("Click [@click='set_background(\"red\")']here[/] for red.")

    def action_set_background(self, color: str) -> None:
        self.styles.background = color
```

This mechanism allows interactive text content without requiring separate widgets for each clickable element. The action string within `@click` follows the same syntax rules as all other action strings (namespace prefixes, literal parameters only).

### Namespaces

When an action string includes a namespace prefix, Textual routes the action to the corresponding object:

| Namespace | Target |
|-----------|--------|
| `app` | The `App` instance |
| `screen` | The current `Screen` |
| `focused` | The currently focused widget (if any) |

Without a namespace, Textual looks for the action method on the class where it is defined (the widget, screen, or app depending on context).

### Built-in Actions

The following built-in actions are defined on `App`:

- `action_add_class` -- Add a CSS class to a widget.
- `action_back` -- Go back to the previous screen.
- `action_bell` -- Ring the terminal bell.
- `action_focus_next` -- Move focus to the next focusable widget.
- `action_focus_previous` -- Move focus to the previous focusable widget.
- `action_focus` -- Focus a specific widget.
- `action_pop_screen` -- Pop the current screen from the stack.
- `action_push_screen` -- Push a screen onto the stack.
- `action_quit` -- Quit the application.
- `action_remove_class` -- Remove a CSS class from a widget.
- `action_screenshot` -- Save an SVG screenshot.
- `action_simulate_key` -- Simulate a key press.
- `action_suspend_process` -- Suspend the application process.
- `action_switch_screen` -- Switch to a different screen.
- `action_toggle_class` -- Toggle a CSS class on a widget.
- `action_toggle_dark` -- Toggle dark mode.

### Dynamic Actions

The `check_action(action, parameters)` method on `DOMNode` controls whether an action is available. It is called before running actions and when refreshing the footer. Return values:

| Return | Effect |
|--------|--------|
| `True` | Action runs normally; key shown in footer. |
| `False` | Action prevented; key hidden from footer. |
| `None` | Action prevented; key shown dimmed (disabled) in footer. |

To prompt the footer to re-evaluate action availability, call `refresh_bindings()` on the node. Alternatively, set `bindings=True` on a `reactive` attribute to automatically refresh bindings when that reactive value changes.

## Key Bindings

### BINDINGS Class Variable

Key bindings are declared as a `BINDINGS` class variable on App, Screen, or Widget subclasses. The variable is a list of `BindingType` entries, where each entry is one of:

- A `Binding` instance.
- A 2-tuple `(key, action)`.
- A 3-tuple `(key, action, description)`.

```python
class MyApp(App):
    BINDINGS = [
        Binding("ctrl+q", "quit", "Quit", priority=True, show=False),
        ("r", "set_background('red')", "Red"),
        ("g", "set_background('green')", "Green"),
    ]
```

### The Binding Class

`Binding` is a frozen dataclass with the following fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `key` | `str` | (required) | Key to bind. Comma-separated values bind multiple keys to one action. |
| `action` | `str` | (required) | Action string to invoke. |
| `description` | `str` | `""` | Human-readable description shown in footer. |
| `show` | `bool` | `True` | Whether to display in the Footer. Effective only when `description` is non-empty. |
| `key_display` | `str \| None` | `None` | Custom display text for the key in footer. `None` defers to `App.get_key_display`. Ignored when overridden by a keymap. |
| `priority` | `bool` | `False` | Priority binding; checked from App downward rather than from focused widget upward. |
| `tooltip` | `str` | `""` | Optional tooltip for the footer. |
| `id` | `str \| None` | `None` | Identifier for keymap overrides. Intended to be globally unique (not enforced). |
| `system` | `bool` | `False` | System binding; excluded from the key panel. |
| `group` | `Binding.Group \| None` | `None` | Groups related bindings under a single description in the footer. |

#### Binding.Group

A nested frozen dataclass for grouping bindings in the footer:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | `str` | `""` | Group description. |
| `compact` | `bool` | `False` | Show keys in compact form (no spaces). |

#### Compound Keys

A `key` value containing commas (e.g., `"j,down"`) is expanded into multiple `Binding` instances, one per key, all sharing the same action and configuration.

### Binding Inheritance

Bindings are merged from the class MRO (method resolution order) at class definition time (`__init_subclass__`). The merge walks the MRO in reverse (most general base first):

1. For each base class that is a `DOMNode` subclass, its `BINDINGS` are collected.
2. If a class sets `_inherit_bindings = False` (via `inherit_bindings=False` in the class definition), all previously collected bindings are discarded.
3. When the same key appears in both a base class and a subclass, the subclass binding replaces the base class binding for that key.

Opting out of inheritance:

```python
class MyWidget(Widget, inherit_bindings=False):
    BINDINGS = [...]  # Only these bindings apply; parent bindings are discarded.
```

### Priority Bindings

Normal bindings are resolved from the focused widget upward through the DOM to the screen and app. Priority bindings (`priority=True`) reverse this: they are checked from the App downward, giving them precedence over widget-level bindings for the same key.

### ActiveBinding

`ActiveBinding` is a `NamedTuple` returned from `Screen.active_bindings`:

| Field | Type | Description |
|-------|------|-------------|
| `node` | `DOMNode` | The node where the binding is defined. |
| `binding` | `Binding` | The binding configuration. |
| `enabled` | `bool` | Whether the binding is enabled (disabled bindings render dimmed). |
| `tooltip` | `str` | Optional tooltip for the footer. |

### BindingsMap

`BindingsMap` manages a set of bindings internally. Key behaviors:

- Stores bindings as `dict[str, list[Binding]]` (key string to list of bindings).
- `merge(bindings)` combines multiple `BindingsMap` instances.
- `bind(keys, action, ...)` adds bindings programmatically at runtime.
- `get_bindings_for_key(key)` returns bindings for a key or raises `NoBinding`.
- `shown_keys` property returns bindings where `show=True`.

### Keymaps

Keymaps allow end-user key remapping. A `Keymap` is a `Mapping[BindingIDString, KeyString]` that maps binding IDs to new key strings.

`BindingsMap.apply_keymap(keymap)` replaces keys for bindings whose `id` matches an entry in the keymap. Returns a `KeymapApplyResult` containing any clashed bindings (bindings displaced because their key was reassigned to a different binding).

When a keymap overrides a binding's key, the `key_display` is set to `None` (the framework determines display).

### Exceptions

| Exception | Description |
|-----------|-------------|
| `BindingError` | General binding-related error (e.g., invalid tuple in `BINDINGS`). |
| `NoBinding` | Raised when looking up a key that has no binding. |
| `InvalidBinding` | Raised when a binding key string is empty or malformed. |

## System Commands

### SystemCommandsProvider

`SystemCommandsProvider` is a `Provider` subclass that exposes system commands in the command palette. It is installed by default in `App.COMMANDS`.

- `discover()` yields `DiscoveryHit` entries for commands marked as discoverable (shown when the palette search is empty).
- `search(query)` uses Textual's built-in fuzzy matcher to find and yield `Hit` entries matching the query.

Both methods call `App.get_system_commands(screen)` to obtain the available commands.

### SystemCommand

`SystemCommand` is a `NamedTuple` yielded from `App.get_system_commands(screen)`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | `str` | (required) | Command title used for search matching. |
| `help` | `str` | (required) | Help text displayed below the title. |
| `callback` | `CommandCallback` | (required) | Callable invoked when the command is selected. |
| `discover` | `bool` | `True` | Whether the command appears in discovery (empty search). |

### Default System Commands

The base `App.get_system_commands` yields:

- **Theme** -- Change the current theme (only when `ansi_color` is `False`).
- **Quit** -- Quit the application.
- **Keys** -- Toggle the help/keys panel visibility.
- **Maximize / Minimize** -- Maximize the focused widget or minimize the currently maximized widget.
- **Screenshot** -- Save an SVG screenshot of the current screen.

### Extending System Commands

Override `get_system_commands` and yield from super, then yield additional `SystemCommand` instances:

```python
def get_system_commands(self, screen: Screen) -> Iterable[SystemCommand]:
    yield from super().get_system_commands(screen)
    yield SystemCommand("Bell", "Ring the bell", self.bell)
```

### App.COMMANDS

`App.COMMANDS` is a class variable listing command provider classes. `SystemCommandsProvider` is included by default. Adding custom providers extends the command palette.

## Type Aliases

| Alias | Definition | Description |
|-------|------------|-------------|
| `BindingType` | `Binding \| tuple[str, str] \| tuple[str, str, str]` | Accepted types in `BINDINGS`. |
| `BindingIDString` | `str` | The `id` field of a `Binding`. |
| `KeyString` | `str` | A key string like `"ctrl+shift+a"` or `"ctrl+j,space,x"`. |
| `Keymap` | `Mapping[BindingIDString, KeyString]` | Maps binding IDs to key strings for remapping. |
