# Docs Spec: Integrating Standard Logger Output with Textual Devtools

## Purpose
Describes the docs page that explains how to route messages from the host environment's standard logging system (console-style loggers, third-party libraries that emit log events) through textual-js so they appear in the devtools console alongside first-party logs.

## Audience
Application authors integrating third-party libraries that already log through a standard mechanism, and teams that want a unified log view in the textual-js devtools console.

## Required sections
1. Overview — why you might want a bridge between a standard logger and textual-js.
2. `TextualHandler` (or the JS-equivalent bridge) — what it does.
3. Installation / wiring — how to attach the handler to a logger.
4. Fallback behavior — what happens when no app is active (stderr / stdout / no-op).
5. Mapping — how log levels map to textual-js log groups (info, warning, error, logging).
6. Limitations and caveats.

## Key concepts
- Bridge/handler: an adapter that forwards external log records into textual-js's `log.logging` (or equivalent) group so they share the devtools console with framework logs.
- Active-app fallback: when no textual-js app is running, the bridge falls back to configured stream outputs (stderr by default, optionally stdout).
- Routing: records are formatted via whatever formatter is attached to the external logger, then forwarded.
- Grouping: external records land in the `LOGGING` group in the devtools console, distinguishing them from first-party `log.info` calls.

## Behaviors and contracts
- When an active app exists, each external log record is forwarded through the app's logger under the `logging` group.
- When no active app exists, the bridge prints the formatted record to stderr (default) or stdout, depending on configuration.
- Attaching and detaching the handler is idempotent; re-attaching does not duplicate messages when installed correctly.
- The bridge does not mutate the external log record; it only reads and forwards.
- The bridge does not block; it is a synchronous forward to the app's logger.

## Example requirements
All examples are JSX/TypeScript using Ink primitives and textual-js widgets:
- Installing the bridge at app startup so library logs (for example from an HTTP client) show up in devtools.
- Configuring the fallback stream for development runs without devtools attached.
- Demonstrating the log group used for bridged messages in the devtools console.

## Cross-references
- `spec/docs-spec/api_logger.md` — the first-party logger.
- `spec/docs-spec/api_app.md` — active-app resolution.
- `spec/spec-src/12-supporting-subsystems.md` — logging subsystem.

## Notes for writers
- Python Textual ships `TextualHandler` as a `logging.Handler` subclass. In textual-js there is no `logging` standard library; describe the equivalent as a bridge adapter for whatever JS logging library the application uses (for example `debug`, `pino`, `winston`, or the built-in `console`). If textual-js ships only a specific integration, document that specifically; if the bridge is generic, describe the interface it expects.
- Do not use `logging.basicConfig` or Python `LogRecord` in examples. Use the JS ecosystem equivalents.
- Do not describe `emit(record)` as a method authors override; treat it as an internal detail.
- Applicability note: if textual-js does not currently ship a standard-logger bridge, say so and describe the manual pattern (call `log.logging(message)` from the external library's hook). Do not invent an API.
- Keep this page short — it is an integration recipe, not a full reference.
