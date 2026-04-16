# Docs Spec: Frequently Asked Questions

## Purpose
Describes the FAQ doc page: a collection of short, question-driven answers to common issues, limitations, and patterns that new textual-js users run into, covering rendering, terminal compatibility, key handling, theming, centering, and passing arguments into apps.

## Audience
New and intermediate users who hit a confusing behavior or common "how do I do X" question and want a short answer without reading a full guide.

## Required sections
1. Image rendering support: textual-js does not render bitmap images in terminal cells; direct users to any third-party or documented workaround.
2. Version compatibility and upgrade notes (mirror the spirit of "ImportError" entries — errors that indicate an outdated install or a breaking change).
3. Workers declaration: the distinction between sync-threaded and async workers, and any error thrown when the wrong combination is used.
4. Text selection and clipboard: what textual-js supports natively for copying text; how to fall back to the terminal emulator's native selection and the per-terminal modifier keys.
5. Terminal compatibility notes: translucent backgrounds, macOS Terminal.app font/line-spacing workaround, recommended alternatives (iTerm2, Kitty, WezTerm, Ghostty).
6. Key combinations: which keys are reliably forwarded by terminals, which are generally not (Cmd/Option on macOS, Windows key), and the tool/process for testing which combos a given terminal forwards.
7. ANSI color themes: why the framework uses 24-bit colors by default, the rationale (blending, readability, accessibility), and any opt-in that enables ANSI passthrough.
8. Widget centering: single-widget and multiple-widget centering, with pointers to the centering section of the layout/how-to docs.
9. Passing arguments into an App: the idiomatic way to parameterize a TextualApp component (props) and how that differs from the Python pattern.

## Key concepts
- Terminal capability varies widely; the FAQ exists largely because users don't realize the limit is the terminal, not the framework.
- The framework uses 24-bit color and blended palettes to guarantee cross-platform readability; ANSI themes would break this contract.
- Centering has three mechanisms (align on parent, text-align on widget, content-align on widget) and users commonly apply the wrong one.
- The framework's public API for passing data into an app is React props + MobX stores, not subclass constructors.

## Behaviors and contracts
- Every entry must link to the authoritative deep-dive when one exists (layout, input, styling, workers).
- Terminal-specific advice must enumerate: which terminal, what the user sees, what to change.
- The ANSI color entry must explicitly state that transparency/translucency does not work, and describe the opt-in that trades transparency for ANSI passthrough.
- The key-combinations entry must name the categories of reliably-forwarded keys (letters, digits, F1–F10, arrows, Home/End, Page Up/Down, Enter, Space, Ctrl+ and Shift+ modifiers) and the unreliable categories.

## Example requirements
All examples JSX/TypeScript, using Ink primitives and the textual-js React API:
- Centering a single button inside a screen (parent uses an align helper/prop).
- Centering multiple widgets independently (each wrapped in its own Center container).
- Passing constructor-like arguments into an app via props (e.g., `<TextualApp greeting="Hello" toGreet="World" />` or equivalent).
- Running the app with different argument sets (shown in a CLI-invocation example).

## Cross-references
- `spec/docs-spec/layout.md` (centering, docking, fr units).
- `spec/docs-spec/how_to.md` (centering things in detail).
- `spec/docs-spec/input_handling.md` (key coverage).
- `spec/docs-spec/linux_console.md` (platform limitations).
- `spec/docs-spec/getting_started.md` (the minimal app shape).

## Notes for writers
- Drop Python-specific upgrade instructions (pip, pipx, micromamba). Replace with npm/yarn/pnpm upgrade guidance and the textual-js package name.
- Drop the `@work(thread=True)` FAQ entry as written — in textual-js there is no thread/async distinction analogous to Python's; document the workers API as it actually is (Promise-returning functions, cancellation tokens). If a common confusion exists there (e.g., returning a Promise vs. a value), capture that instead.
- Keep the terminal-compatibility and ANSI-theme entries essentially intact — they're terminal facts, not language facts.
- Do not mention `asyncio`, `pip install`, `pyproject.toml`, or Python class inheritance for passing arguments. The textual-js equivalent is props on the React app component.
- The macOS Terminal.app workaround is still useful; keep it.
- Keep the Discord/GitHub Discussions/GitHub Issues routing only if the help doc doesn't already cover it; otherwise cross-link.
