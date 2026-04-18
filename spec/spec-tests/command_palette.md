# Command Palette

The command palette is a modal screen overlay that provides a searchable interface for discovering and executing commands. It is opened via `action_command_palette()` and rendered as a `CommandPalette` screen pushed onto the screen stack.

## Provider Model

### Declaring Command Sources

Command sources are `Provider` subclasses declared via the `COMMANDS` class variable on `App` or `Screen`. The value is a set of provider classes.

- When no `COMMANDS` are declared on the app or screen, the command palette still opens and includes the built-in `SystemCommandsProvider`.
- When `COMMANDS` is declared on the app, those providers are used (replacing the default `SystemCommandsProvider`).
- When `COMMANDS` is declared on a screen, those providers are included alongside the app-level providers.
- App-level and screen-level sources combine via set union. If the app declares `{A}` and the active screen declares `{B}`, the palette uses `{A, B}`.
- A `CommandPalette` instantiated with no associated screen has an empty provider set.

### Provider Environment

Each `Provider` instance exposes the execution context through three properties:

- `self.app` -- the running `App` instance.
- `self.screen` -- the base screen beneath the command palette (not the palette screen itself).
- `self.focused` -- the widget that had focus on the base screen when the palette was opened, or `None`.

### Hit and DiscoveryHit

Providers yield results as `Hit` or `DiscoveryHit` objects.

A `Hit` is constructed with a score (numeric), a visual-bearing display value, a callable to invoke, plain-text search text, and an optional help string. Higher scores rank higher.

A `DiscoveryHit` is constructed with a visual-bearing display value, a callable, and optional plain-text search text. It has no score because discovery results are shown before any search occurs.

## Discovery Mode

### Discovery Results on Open

A provider may implement a `discover()` async generator method that yields `DiscoveryHit` items. When discovery hits exist, the results list is immediately visible upon opening the palette (before any user input), displaying the discovered items.

## Interaction

### Search and Result Display

- On open, the result list (`CommandList`) visibility depends on discovery: if providers yielded discovery hits, the list is immediately visible showing those hits (consistent with the Discovery Results on Open section above). If there are no discovery hits, the list stays hidden until the user types a query (verified in original codebase).
- Typing a character triggers a search across all providers. Results appear in the `CommandList`, and the first item is highlighted (index 0). Matching is performed against each hit's plain-text search text, not by flattening arbitrary renderables. If a typed query produces no matches, a "No matches found" indicator is shown.
- Pressing `down` advances the highlight to the next item.
- Pressing `enter` on a highlighted item selects it: the palette dismisses and the hit's callable is invoked.

### Run on Select

The `CommandPalette.run_on_select` class variable controls execution behavior:

- When `True` (default): selecting an item immediately runs its callable and dismisses the palette.
- When `False`: selecting an item populates the search input with the selection text instead of running it. A second `enter` press then executes the callable.

### No Results

When a search yields no matches, after a brief countdown delay (`_NO_MATCHES_COUNTDOWN`), the palette displays a single disabled option with the text "No matches found".

## Events

The command palette posts three event types to the app:

- `CommandPalette.Opened` -- posted when the palette is opened.
- `CommandPalette.Closed(option_selected: bool)` -- posted when the palette is closed. The boolean indicates whether a command was selected (`True`) or the palette was dismissed without selection (`False`).
- `CommandPalette.OptionHighlighted(...)` -- posted when the user highlights an option in the result list (e.g., by pressing `down`).

These events can be handled with `@on(CommandPalette.Opened)` and similar decorators.

### Event Ordering

The events fire in the following sequence during a typical interaction:

1. `Opened` fires when the palette first appears.
2. `OptionHighlighted` fires each time the user moves the highlight (e.g., pressing `down`).
3. `Closed` fires last when the palette is dismissed.

When a selection is made, the sequence is `[Opened, OptionHighlighted, Closed(True)]`. When the palette is dismissed without a selection (e.g., via `escape`), the sequence is `[Opened, Closed(False)]`.

## Dismissing the Palette

### Escape Key

Pressing `escape` when no result list is visible closes the command palette.

### Click Away

Clicking outside the command palette (on the overlay area) dismisses it.

### Command Selection

Selecting a command (pressing `enter` on a highlighted result with `run_on_select=True`) dismisses the palette after running the command. Commands that push modal screens (e.g., confirmation dialogs) work correctly after the palette dismisses.

## Checking Palette State

`CommandPalette.is_open(app)` is a class method that returns `True` if the command palette is currently the active screen on the given app, and `False` otherwise. It provides a single, unambiguous way to check palette visibility without inspecting the screen stack directly.

## System Commands

The app can provide additional system-level commands by overriding `get_system_commands(screen)`. This method yields `SystemCommand` named tuples with a title, help text, and callable. These are surfaced through the built-in `SystemCommandsProvider` and are searchable alongside other providers.

## Worker Management

### No Leftover Workers

The command palette must not leave any workers behind after it is dismissed. Opening the palette, searching, selecting a result, and closing must result in zero residual workers attributable to the palette.

### No Interference with App Workers

Using the command palette must not cancel or interfere with workers that the app started independently. If the app has running workers before the palette is opened, those workers must still be running after the palette is closed.

## Constraints

- A `CommandPalette` with no associated screen must have an empty provider class set.
- `SystemCommandsProvider` is included by default when no app-level `COMMANDS` override it; screen-level `COMMANDS` always add to (never replace) the system commands.
- Providers must have access to the correct app, base screen, and focused widget -- not the palette's own screen or widgets.
- Display values may be textual or renderable. Providers that return non-textual display values must also provide plain-text search text.
- Discovery hits must be visible immediately on open without requiring user input.
- The "No matches found" indicator must be a disabled option (not selectable).
- `CommandPalette.Closed` must accurately report whether a selection was made.
- The palette must be dismissible by escape, click-away, or command selection.
- `run_on_select=False` must require two enter presses: one to populate the input, one to execute.
- The palette must clean up its own workers on close and must not disturb unrelated app workers.
