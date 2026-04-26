# Docs Spec: Devtools

## Purpose
Describes the Devtools page — the developer tooling that supports running, serving, debugging, and live-editing textual-js applications.

## Audience
Developers actively building or debugging a textual-js app, particularly those who need log output, live CSS reload, or a browser-hosted preview.

## Required sections
1. Overview — textual-js ships (or may ship) a companion CLI — describe the command name used by the project (for example `textual-js` or the npm binary exposed by the dev package). Keep phrasing conditional on the actual tool that ships.
2. Running an App — how to launch an app from the CLI: direct node invocation, a dev wrapper that enables live reload and the developer console, and flags like `--dev` and `--port`.
3. Serving in a Browser — if the project supports a browser-hosted renderer, describe the serve command (file path or command-string input, refresh-to-reload behavior). If not supported yet, note "not currently supported" rather than inventing.
4. Development Mode and Live CSS Editing — what `--dev` enables: file-watching of `.tcss` files with sub-second reapplication to the running app.
5. Developer Console — why `console.log` alone is not sufficient inside a TUI (the terminal is owned by the app), and how the dev console attaches a separate channel for log output.
   - Setup — two-terminal workflow: run `console` in one terminal, run the app with `--dev` in another.
   - Verbosity control — `-v` for verbose and `-x GROUP` to exclude groups. List the groups: `EVENT`, `DEBUG`, `INFO`, `WARNING`, `ERROR`, `PRINT`, `SYSTEM`, `LOGGING`, `WORKER`.
   - Custom port — `--port` on both sides to avoid conflicts.
6. Debug Logging
   - The `log` function — prints structured data and styled content to the dev console.
   - `this.log` / `app.log` / `widget.log` shortcuts — convenience wrappers that route through the same channel.
   - Bridging standard logging — if the runtime exposes a handler that routes Node `console`/a logger library to the dev console, describe how to install it.

## Key concepts
- The TUI owns stdout; logs must go through a side-channel to avoid corrupting the display.
- Live CSS reload edits styling without restarting the app.
- The dev console is an out-of-process terminal (a second `node` process) that receives structured log messages.
- Message groups categorize log output so developers can filter noise.

## Behaviors and contracts
- The dev console only shows messages when the app is launched with dev mode enabled.
- Verbosity filters are applied per-group; excluding `SYSTEM` still surfaces user-facing warnings and errors.
- `log()` accepts strings, data structures, and styled content (textual-js Content); its shortcuts on App/Widget are equivalent to calling the free function.
- Errors thrown during logging are suppressed in the app process so logging does not crash the app.
- Live reload applies CSS changes without remounting widgets; state is preserved.

## Example requirements
Describe (do not inline) shell and JS examples covering:
- Running an app through the dev harness (`textual-js run --dev app.ts` or the project's equivalent).
- Running the dev console in a second terminal and piping verbose event output into it.
- Excluding the `SYSTEM` and `EVENT` groups to show only warnings/errors.
- Using `log()` and `this.log()` from inside an `onMount` handler to inspect data.
- Bridging `console.*` or a logging library into the dev console (if applicable to textual-js).
All examples are shell + JSX/TypeScript; no Python.

## Cross-references
- `spec/docs-spec/app.md` — `watchCss`, inline vs. full-screen modes.
- `spec/docs-spec/css_overview.md` — live CSS reload and TCSS file layout.
- `spec/spec-src/13-testability-and-automation-surfaces.md` — testing surfaces separate from dev console.
- `spec/spec-src/12-supporting-subsystems.md` — the dev-console and logging subsystems.

## Notes for writers
- Do not use Python examples (`from textual import log`, `python -m textual`, `textual run my_app.py`). Use Node/CLI syntax appropriate for textual-js.
- Do not reference `TextualHandler` or the Python `logging` module. If textual-js provides a bridge for a JS logging library, name the actual bridge; otherwise omit.
- `print()` has no direct equivalent; use `console.log` or the framework's `log()` function.
- Do not describe `textual-dev` as a Python package. The tooling is delivered through the textual-js npm package (or a sibling devtools package if one ships). Be explicit about whatever is actually published.
- `textual serve` may or may not ship — do not assume a browser renderer. If textual-js targets only the terminal via Ink, call that out and omit the serve section.
- Rich renderables are not a textual-js concept; `log()` accepts strings, plain data, and Content — not Rich objects.
