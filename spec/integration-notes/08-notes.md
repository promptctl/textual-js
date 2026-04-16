# Integration notes for spec-src/08-drivers-io-and-platform-behavior.md

## Critical context

- **Rich-js role**: Ink produces ANSI output; the framework's output filter pipeline (rich-js-aware) sits between Ink and the terminal. Color depth detection affects rich-js `Color.toAnsi()` output.
- **Terminal-UI reality**: Bracketed-paste text may contain ANSI; color depth determines which rich-js Color representation reaches the terminal.

## Gaps to fix

### 1. Output filter pipeline placement

**Where**: "Rendering Output" section (or add a new subsection at the end).
**Current state**: File describes Ink rendering; doesn't mention the LineFilter pipeline.
**Why insufficient**: The `LineFilter` pipeline (spec 12) applies at the Ink→terminal boundary — after Ink produces ANSI output, filters post-process it.
**Required change**: Add subsection "Output filter pipeline":
  "Between Ink's ANSI output and the terminal stdout, the framework's `LineFilter` pipeline (spec 12) post-processes rendered lines. Built-in filters include `Monochrome` (strips all colors), `NoColor` (respects `NO_COLOR` env var), `DimFilter`, and `ANSIToTruecolor`. The pipeline is registered on the app (`App.filters`). It runs unconditionally; an empty filter list is a no-op. The filter pipeline can transform any rich-js-originated styled output into its flattened ANSI-stream form for terminal compatibility."

### 2. Color depth detection → rich-js Color rendering

**Where**: "Capability Properties" table (`colorDepth` row).
**Current state**: Describes `colorDepth: number` values (1/4/8/24).
**Why insufficient**: Doesn't say that this value feeds rich-js `Color.toAnsi()` to choose the correct ANSI encoding.
**Required change**: Expand the `colorDepth` row description: "Color support level (1 = none, 4 = 16 colors, 8 = 256 colors, 24 = true color). Read at startup from `TEXTUAL_COLOR_DEPTH` env var or terminal capability detection. Passed to rich-js `Color.toAnsi(depth)` at every render boundary so colors downgrade appropriately for the active terminal. Setting this lower forces color downgrade regardless of terminal capability."

### 3. Bracketed paste — ANSI-carrying text

**Where**: "Input Events from Ink" / "Paste events" (if present) or add to mouse events section.
**Current state**: Not explicitly mentioned.
**Why insufficient**: When a user pastes from a styled terminal source, the pasted text may contain ANSI escape sequences. The framework delivers the raw text; consumers decide whether to parse.
**Required change**: Add a "Paste" subsection under "Input Events from Ink":
  "Ink detects bracketed-paste sequences (`ESC [ 200 ~` ... `ESC [ 201 ~`) when the terminal supports them. The pasted text is delivered as a `Paste` message (see spec 03) with `text: string`. The text MAY contain ANSI escape sequences if pasted from a styled source. The framework does not pre-process; consumers (typically `Input`, `TextArea`, `RichLog`) decide whether to `stripAnsi()` or `parseAnsi()` via rich-js."

### 4. Suspend pauses animator and deferred work

**Where**: "Suspend and Resume" section.
**Current state**: Step 3 calls the suspend callback; the framework doesn't specify what happens to animator/notifications during suspend.
**Why insufficient**: While suspended, the animator cannot be driving ticks (the terminal is owned by another process), and notification expiry timers should also pause.
**Required change**: Expand the numbered "Suspend behavior" list:
  - After step 2 (Ink exits raw mode) add: "The framework pauses the Animator (no frames scheduled) and pauses expiry timers for notifications and other deferred UI work."
  - In step 4 (Ink re-enters raw mode) add: "Animator and paused timers are resumed."
Reference: these are already mentioned in spec 01 Suspend/Resume; this is consistency.

## Do not change

- Platform boundary diagram (stack layers)
- Ink capability table
- Key event translation table (Ink → framework mapping)
- Mouse event translation table
- Mouse event processing behaviors (button bookkeeping, click synthesis, etc.)
- Resize event handling
- Ink component → terminal output table
- Full-screen vs inline mode
- Suspend code example and contract structure
- Testing environment section (ink-testing-library integration)
- CSS live reload (file monitor) section
