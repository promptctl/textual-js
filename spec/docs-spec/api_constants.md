# Docs Spec: Framework Constants and Environment Configuration

## Purpose
Describe the set of runtime constants exposed by textual-js that are derived from environment variables, and teach readers how to configure the framework without code changes.

## Audience
App developers who need to tune framework behavior per-environment (CI, debug builds, screenshot capture, smooth scrolling, animation levels, FPS caps, theme defaults), and framework extenders who need to know which knobs are already exposed.

## Required sections
1. Overview of how constants are resolved (evaluated once at module load from `process.env`, treated as immutable for the process lifetime).
2. Conventions for environment variable names (`TEXTUAL_*` prefix) and the boolean/integer/port parsing rules.
3. Catalog of every user-facing constant, grouped by role: debug and devtools, logging, screenshots, animation, theming, scroll/render, slow-threshold warning.
4. How to override values in tests vs. production.
5. Notes on values that are mutable at runtime (e.g. slow threshold) vs. those that are frozen.

## Key concepts
- Environment-derived configuration as the single source of truth for framework tuning.
- Parsing rules: `"1"` as truthy for booleans, integer clamping with min/max, port-range validation (0-65535).
- Animation level as a discriminated string union (`"none" | "basic" | "full"`), case-insensitive with a default.
- Default theme list: comma-separated, first-match-exists wins.
- Devtools host/port wiring (for external console integration if/when added).
- Screenshot capture mode (delay, location, filename) and "auto-press" key sequence for scripted startup.
- FPS cap, dim factor, escape delay, smooth scroll toggle.

## Behaviors and contracts
- Constants are read once at startup; mutating `process.env` afterwards has no effect unless the doc explicitly says so.
- Invalid values fall back to the documented default — invalid values must not throw at import time.
- Numeric clamping is applied exactly once, using the documented min/max bounds.
- `SLOW_THRESHOLD` is the documented exception: it is writable at runtime for test harnesses.
- `DEFAULT_THEME` accepts a prioritized list and picks the first registered theme.
- Boolean-style envs accept only `"1"`/`"0"` (document this explicitly — truthy-string heuristics are not used).

## Example requirements
- A table mapping every environment variable to its constant name, type, default, and valid range.
- A JSX/TypeScript snippet showing how to read a constant from the framework module.
- A shell example showing how to launch an app with `TEXTUAL_DEBUG=1` and `TEXTUAL_FPS=30`.
- A Vitest setup example that sets env vars before importing the framework (and a note that imports are cached).

## Cross-references
- `spec/docs-spec/api_logging.md` (for `LOG_FILE` / logger wiring).
- `spec/docs-spec/animation.md` and `spec/docs-spec/api_app.md` (for `TEXTUAL_ANIMATIONS` effects).
- `spec/spec-src/01-runtime-app-and-lifecycle.md` (startup and env parsing behavior).
- `spec/spec-src/08-drivers-io-and-platform-behavior.md` (Ink driver honoring FPS, smooth scroll, dim factor).
- `spec/spec-src/13-testability-and-automation-surfaces.md` (screenshot and auto-press constants).

## Notes for writers
- Do not document the Python helper functions (`_get_environ_bool`, `_get_environ_int`, `_get_environ_port`, `_is_valid_animation_level`); they are private implementation details. Describe the parsing contract instead.
- The `DRIVER` constant (Python import path for a replacement driver) does not apply: textual-js always uses the Ink driver. Either omit it or note it as "not applicable — Ink is the driver."
- `DIM_FACTOR` source is documented in Python as "0-100 integer divided by 100"; document the final value (0.0-1.0 float) and let users set it directly — do not replicate the integer-divide quirk unless it exists in the JS port.
- Do not mention Python `Final`; call out immutability by contract instead.
- If a constant maps to a feature not yet implemented in textual-js (e.g. devtools host/port), mark it "reserved" rather than omitting it.
