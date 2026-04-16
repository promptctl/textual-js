# Docs Spec: Logger — Logging to the Textual Devtools Console

## Purpose
Describes the docs page that teaches developers how to log structured messages from widgets, screens, and the app to the textual-js devtools console, with groups, verbosity levels, and a convenient module-level `log` entry point.

## Audience
All application and widget authors who need runtime diagnostics. Also relevant to framework extenders writing custom widgets that emit their own log categories.

## Required sections
1. Overview — what the logger is and where messages go.
2. The module-level `log` — the default logger bound to the active app.
3. Log groups — event, debug, info, warning, error, system, logging, worker.
4. Verbosity — normal vs high (verbose), toggling via `.verbose` or a `.verbosity(flag)` call.
5. Getting a logger from a widget/screen/app instance (`this.log` or equivalent on a class, or a hook on function components).
6. Behavior when there is no active app or no devtools connection.
7. Optional log file output (environment variable-driven, if supported).
8. Error type — the error raised when logging fails.

## Key concepts
- Logger is callable — invoking it with arbitrary arguments records a message.
- Group-prefixed loggers: reading a property like `log.debug` returns a derived logger with a different log group; chainable with verbosity.
- Verbosity filter: verbose messages are hidden from the devtools console unless the user has enabled verbose mode.
- Active app binding: the global `log` resolves the active app at call time; if invoked outside an app context it is a no-op (or writes to stdout/log file in debug mode, when supported).
- Devtools connection: log messages only reach the devtools console when a devtools client is attached. Without devtools, messages are silently dropped unless fallback outputs are configured.
- Caller context capture: the logger records source-location hints (file / line / function) for diagnostic output in the devtools console.

## Behaviors and contracts
- Calling `log(value)` logs `value` at the info group and normal verbosity.
- `log.debug`, `log.info`, `log.warning`, `log.error`, `log.event`, `log.system`, `log.worker`, `log.logging` return loggers bound to the corresponding group.
- `log.verbose` returns a logger bound to high verbosity; `log.verbosity(flag)` returns a logger with verbosity controlled by the flag.
- Derived loggers preserve the underlying callable and app reference.
- When no app is active and no log file is configured, calling the global `log` is a silent no-op.
- Logging errors propagate as a documented error type that, in development mode, may fall back to printing on stdout.
- The logger holds the app via a weak reference so it never keeps the app alive.

## Example requirements
All examples are JSX/TypeScript using Ink primitives and textual-js widgets:
- Importing the module-level `log` and logging a value.
- Logging inside a widget method / effect using the per-instance logger (`this.log` or equivalent).
- Using `log.debug`, `log.warning`, `log.error` to categorize output.
- Toggling verbose output using `log.verbose(…)` or `log.verbosity(isVerbose)(…)`.
- Guarding expensive log payload construction behind a debug/verbose check.

## Cross-references
- `spec/docs-spec/api_logging.md` — routing standard logger output through textual-js.
- `spec/docs-spec/api_app.md` — the app instance and how it owns the devtools connection.
- `spec/docs-spec/api_constants.md` — environment variables that control log-file output and debug mode.
- `spec/spec-src/12-supporting-subsystems.md` — logging subsystem overview.
- `spec/spec-src/08-drivers-io-and-platform-behavior.md` — devtools transport.

## Notes for writers
- Python Textual uses `@rich.repr.auto` and `weakref.ref`; do not mention those. Describe rich repr as "the logger displays its group and verbosity when inspected" if relevant.
- Do not use Python snake_case method names (`set_sender`, `call_after_refresh`). Use the textual-js API names.
- Do not describe `LogGroup` / `LogVerbosity` as Python enums with specific import paths; describe them as string or enum-like values exposed from the framework.
- Be explicit that messages only render when devtools is attached — users often wonder why "nothing shows up".
- In textual-js, `observer()`-wrapped function components can access the logger via an app/screen hook rather than `self.log`. Show that path.
- Avoid Python f-strings and `locals()` in examples; use template literals and plain objects.
