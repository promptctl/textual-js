# System Commands

## Overview

**Module:** `textual.system_commands`

Provides `SystemCommandsProvider`, a command palette command provider for built-in application-wide actions. This provider is installed by default in `App.COMMANDS` and surfaces system commands (such as toggling dark mode, quitting, etc.) in the command palette.

---

## `SystemCommandsProvider`

Subclass of `textual.command.Provider`.

### Methods

#### `async discover() -> Hits`

Yields `DiscoveryHit` objects for all system commands that are marked as discoverable.

**Behavior:**
1. Calls `self.app.get_system_commands(self.screen)` to retrieve available commands.
2. Sorts commands alphabetically by name.
3. Yields a `DiscoveryHit` for each command where the `discover` flag is `True`.

Each `DiscoveryHit` contains:
- The command name.
- The callback to invoke.
- Help text.

#### `async search(query) -> Hits`

Yields `Hit` objects for system commands matching the user's query.

| Parameter | Type | Description |
|---|---|---|
| `query` | `str` | The user's search input. |

**Behavior:**
1. Creates a fuzzy matcher via `self.matcher(query)`.
2. Calls `self.app.get_system_commands(self.screen)` to retrieve available commands.
3. For each command, computes a match score against the command name.
4. Yields a `Hit` for commands with a positive match score, including:
   - The match score.
   - The highlighted command name (with matched characters emphasized).
   - The callback to invoke.
   - Help text.

---

## Integration

- The `App` base class includes `SystemCommandsProvider` in its `COMMANDS` class variable by default.
- System commands are retrieved from `App.get_system_commands(screen)`, which returns tuples of `(name, help_text, callback, discover)`.
- The command palette uses both `discover()` (for browsable commands) and `search()` (for filtered results).
