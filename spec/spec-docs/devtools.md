# Devtools

Textual ships a companion CLI tool called `textual` (provided by the `textual-dev` package) that supports running, serving, debugging, and live-editing Textual applications.

## `textual run`

Runs a Textual application. Accepts three invocation forms:

| Form | Example | Notes |
|---|---|---|
| File path | `textual run my_app.py` | Equivalent to `python my_app.py` but supports devtools switches |
| Python import | `textual run music.play` | Imports the module and runs the `app` instance found there |
| Import with name | `textual run music.play:MusicPlayerApp` | Specifies an explicit app instance or class after the colon |
| Command (`-c`) | `textual run -c textual colors` | Runs an installed CLI command through the devtools harness |

Key switches:

- `--dev` — enables development mode (live CSS editing, console connection).
- `--port PORT` — connect to the developer console on a custom port.

## `textual serve`

Serves a Textual application in a browser, turning a terminal app into a web application. Supports multiple simultaneous instances.

| Form | Example |
|---|---|
| File path | `textual serve my_app.py` |
| Command string | `textual serve "textual keys"` |
| Module via python | `textual serve "python -m textual"` |

Refreshing the browser after a code change reloads the application.

## Development Mode and Live CSS Editing

Running with `textual run --dev` activates development mode. In this mode, any changes saved to CSS files referenced by the application are detected and applied to the running app within milliseconds, without restarting. This enables a workflow where the CSS file is open in an editor alongside a terminal running the app.

## Developer Console (`textual console`)

Terminal applications cannot use `print` for debugging because stdout is consumed by the TUI. The developer console solves this by providing a separate terminal window that receives debug output.

### Setup

1. In terminal A: `textual console`
2. In terminal B: `textual run --dev my_app.py`

All `print()` calls and Textual log messages from the app appear in terminal A.

### Verbosity Control

| Flag | Effect |
|---|---|
| `-v` | Include verbose messages (events such as key presses and mouse clicks that are excluded by default) |
| `-x GROUP` | Exclude an entire message group. May be repeated. |

Message groups: `EVENT`, `DEBUG`, `INFO`, `WARNING`, `ERROR`, `PRINT`, `SYSTEM`, `LOGGING`, `WORKER`.

Example — show only warnings, errors, and print output:

```bash
textual console -x SYSTEM -x EVENT -x DEBUG -x INFO
```

### Custom Port

Both `console` and `run` accept `--port` to use a non-default port:

```bash
textual console --port 7342
textual run --dev --port 7342 my_app.py
```

## Debug Logging

### `log` Function

`textual.log` pretty-prints data structures and Rich renderables to the developer console.

```python
from textual import log

log("Hello, World")          # simple string
log(locals())                # dict / data structure
log(children=self.children)  # keyword arguments
log(self.tree)               # Rich renderable
```

### `self.log` Shortcut

`App` and `Widget` both expose a `log` method as a convenience shortcut:

```python
class MyApp(App):
    def on_mount(self):
        self.log("Mounted", pi=3.14)
        self.log(self.tree)
```

### `TextualHandler` for the `logging` Module

`textual.logging.TextualHandler` bridges Python's built-in `logging` module to the developer console. This is useful for surfacing logs from third-party libraries that use `logging`.

```python
import logging
from textual.logging import TextualHandler

logging.basicConfig(level="NOTSET", handlers=[TextualHandler()])
```

Note: the standard `logging` module only supports strings, so Rich renderables cannot be logged through `TextualHandler`.
