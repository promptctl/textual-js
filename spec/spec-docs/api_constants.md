# textual.constants

Module containing constants derived from environment variables. These constants are evaluated at import time and are immutable (`Final`) for the lifetime of the process.

## Helper Functions (Internal)

- `_get_environ_bool(name: str) -> bool` -- Check an environment variable switch. Returns `True` if the env var equals `"1"`, otherwise `False`.
- `_get_environ_int(name: str, default: int, minimum: int | None = None, maximum: int | None = None) -> int` -- Retrieve an integer environment variable. Returns `default` if the variable is unset or not a valid integer. Clamps to `minimum` or `maximum` if provided.
- `_get_environ_port(name: str, default: int) -> int` -- Get a port number from an environment variable. Returns `default` if unset, not a valid integer, or outside the range 0-65535.
- `_is_valid_animation_level(value: str) -> TypeGuard[AnimationLevel]` -- Check if a string is a valid `AnimationLevel` value.
- `_get_textual_animations() -> AnimationLevel` -- Read `TEXTUAL_ANIMATIONS` env var (case-insensitive). Returns the value if valid, otherwise defaults to `"full"`.

## Constants

All constants are `Final` unless otherwise noted.

- `DEBUG: Final[bool]` -- Enable debug mode. Env var: `TEXTUAL_DEBUG` (set to `"1"` to enable).
- `DRIVER: Final[str | None]` -- Import path for a replacement driver. Env var: `TEXTUAL_DRIVER`. Default: `None`.
- `FILTERS: Final[str]` -- A list of filters to apply to renderables. Env var: `TEXTUAL_FILTERS`. Default: `""`.
- `LOG_FILE: Final[str | None]` -- A last-resort log file that appends all logs when devtools is not working. Env var: `TEXTUAL_LOG`. Default: `None`.
- `DEVTOOLS_HOST: Final[str]` -- The host where the textual console is running. Env var: `TEXTUAL_DEVTOOLS_HOST`. Default: `"127.0.0.1"`.
- `DEVTOOLS_PORT: Final[int]` -- The port that devtools will connect to. Env var: `TEXTUAL_DEVTOOLS_PORT`. Default: `8081`. Must be in range 0-65535.
- `SCREENSHOT_DELAY: Final[int]` -- Seconds delay before taking a screenshot; `-1` for no screenshot. Env var: `TEXTUAL_SCREENSHOT`. Default: `-1`. Minimum: `-1`.
- `SCREENSHOT_LOCATION: Final[str | None]` -- The location where screenshots should be written. Env var: `TEXTUAL_SCREENSHOT_LOCATION`. Default: `None`.
- `SCREENSHOT_FILENAME: Final[str | None]` -- The filename to use for the screenshot. Env var: `TEXTUAL_SCREENSHOT_FILENAME`. Default: `None`.
- `PRESS: Final[str]` -- Keys to automatically press. Env var: `TEXTUAL_PRESS`. Default: `""`.
- `SHOW_RETURN: Final[bool]` -- Write the return value on exit. Env var: `TEXTUAL_SHOW_RETURN` (set to `"1"` to enable).
- `MAX_FPS: Final[int]` -- Maximum frames per second for updates. Env var: `TEXTUAL_FPS`. Default: `60`. Minimum: `1`.
- `COLOR_SYSTEM: Final[str | None]` -- Force color system override. Env var: `TEXTUAL_COLOR_SYSTEM`. Default: `"auto"`.
- `TEXTUAL_ANIMATIONS: Final[AnimationLevel]` -- Determines whether animations run. Env var: `TEXTUAL_ANIMATIONS`. Default: `"full"`. Valid values are those defined by `AnimationLevel`.
- `ESCAPE_DELAY: Final[float]` -- The delay (in seconds) before reporting an escape key (not used if the extended key protocol is available). Env var: `ESCDELAY`. Default: `0.1` (100ms / 1000). Minimum: `1` (ms, before division).
- `SLOW_THRESHOLD: int` -- The time threshold (in milliseconds) after which a warning is logged if message processing exceeds this duration. Env var: `TEXTUAL_SLOW_THRESHOLD`. Default: `500`. Minimum: `100`. Note: this is not `Final`.
- `DEFAULT_THEME: Final[str]` -- Textual theme to make default. More than one theme may be specified in a comma-separated list; Textual will use the first theme that exists. Env var: `TEXTUAL_THEME`. Default: `"textual-dark"`.
- `SMOOTH_SCROLL: Final[bool]` -- Whether smooth scrolling is enabled. Set `TEXTUAL_SMOOTH_SCROLL=0` to disable. Default: `True` (value `1`).
- `DIM_FACTOR: Final[float]` -- Percentage (as a float 0.0-1.0) to use as opacity when converting ANSI "dim" attribute to RGB. Env var: `TEXTUAL_DIM_FACTOR`. Default: `0.66`. Range: 0-100 (integer, divided by 100).
