# Platform I/O Behavior

## Overview

Platform I/O — terminal rendering, input parsing, raw mode, ANSI output, mouse reporting — is handled entirely by **Ink**. The framework does not implement its own terminal driver, compositor, or ANSI encoder.

This spec documents the behavioral contracts that the framework layer expects from the platform, and how the framework integrates with Ink's I/O surface.

// [LAW:single-enforcer] Ink is the single enforcer of terminal I/O normalization. No framework code reads from stdin, writes ANSI sequences, or manages terminal modes.

// [LAW:one-way-deps] The framework depends on Ink's event delivery contract; Ink does not depend on framework internals.

## Platform Boundary

```
┌─────────────────────────────────────────────────────┐
│  Framework                                          │
│  (bindings, actions, TCSS, widgets, messages)       │
├─────────────────────────────────────────────────────┤
│  Ink                                                │
│  (React reconciler, Yoga layout, ANSI output,       │
│   stdin parsing, raw mode, alternate screen)        │
├─────────────────────────────────────────────────────┤
│  Terminal / OS                                      │
│  (stdin, stdout, SIGWINCH, pty)                     │
└─────────────────────────────────────────────────────┘
```

Ink provides:

| Capability | How |
|------------|-----|
| Terminal rendering | Yoga layout → ANSI escape sequences → stdout |
| Keyboard input | stdin → parsed key events via `useInput()` hook |
| Mouse input | stdin → parsed mouse events (when mouse reporting is enabled) |
| Resize detection | `SIGWINCH` signal → resize event with new dimensions |
| Raw mode | Enters raw mode and alternate screen buffer on start, restores on exit |
| Cursor control | Hides cursor during rendering, restores on exit |
| Focus management | Basic `useFocus()` / `useFocusManager()` hooks (framework extends these) |
| Testing | `ink-testing-library` renders without a terminal for testing |

## Input Events from Ink

### Key events

Ink delivers key events via its `useInput()` hook:

```tsx
// Ink's useInput delivers key events
useInput((input, key) => {
  // input: the character (e.g., 'a', '?', '')
  // key: { upArrow, downArrow, leftArrow, rightArrow, return, escape,
  //        ctrl, shift, tab, backspace, delete, meta }
});
```

The framework translates Ink's key representation into framework `Key` messages:

| Ink key info | Framework Key message |
|-------------|----------------------|
| `input: 'a'` | `Key { key: 'a', character: 'a' }` |
| `key.return: true` | `Key { key: 'enter', character: null }` |
| `key.escape: true` | `Key { key: 'escape', character: null }` |
| `key.ctrl: true, input: 'c'` | `Key { key: 'ctrl+c', character: null }` |
| `key.shift: true, key.tab: true` | `Key { key: 'shift+tab', character: null }` |
| `key.upArrow: true` | `Key { key: 'up', character: null }` |
| `key.backspace: true` | `Key { key: 'backspace', character: null }` |
| `key.delete: true` | `Key { key: 'delete', character: null }` |
| `input: '?'` | `Key { key: 'question_mark', character: '?' }` |

The framework normalizes key names to canonical forms (punctuation to long-form names, alias resolution) before the binding layer processes them. This normalization is a framework concern, not an Ink concern.

### Mouse events

When mouse reporting is enabled (Ink supports this via configuration):

| Terminal event | Framework message |
|----------------|-------------------|
| Mouse button press at (x, y) | `MouseDown { x, y, button }` |
| Mouse button release at (x, y) | `MouseUp { x, y, button }` |
| Mouse movement to (x, y) | `MouseMove { x, y }` |
| Scroll wheel up at (x, y) | `MouseScrollUp { x, y }` |
| Scroll wheel down at (x, y) | `MouseScrollDown { x, y }` |

Mouse coordinates are relative to the app's render area (0,0 = top-left of the app output).

### Mouse event processing

The framework layers additional behavior on top of raw mouse events:

| Behavior | Description |
|----------|-------------|
| **Button bookkeeping** | Track which buttons are currently pressed across down/up events |
| **Click synthesis** | Mouse-up on the same widget as the preceding mouse-down produces a `Click` message |
| **Hover tracking** | Mouse-move generates `Enter`/`Leave` messages when the widget under the pointer changes |
| **Mouse capture** | While captured, all mouse events route to the capturing widget regardless of position |
| **Drag detection** | Mouse-down followed by mouse-move with button held may generate drag events |

### Paste

Ink detects bracketed-paste sequences (`ESC [ 200 ~` ... `ESC [ 201 ~`) when the terminal supports them. The pasted text is delivered as a `Paste` message (see spec 03) with `text: string`.

The text may contain ANSI escape sequences if pasted from a styled source. The framework does not pre-process it; consumers such as `Input`, `TextArea`, and `RichLog` decide whether to call rich-js `stripAnsi()` for plain text or `parseAnsi()` to preserve styling as `Content`.

### Resize events

Ink detects terminal resize (via `SIGWINCH` on Unix, polling on Windows) and re-renders the component tree with new dimensions. The framework receives resize information via:

- Ink's `useStdout()` hook provides `stdout.columns` and `stdout.rows`.
- The `Resize` message is posted to the app when dimensions change.
- `Resize.canReplace` is true — resize storms coalesce.

## Rendering Output

The framework does not produce terminal output directly. The rendering path is:

1. Framework produces React component tree with Ink primitives and resolved TCSS styles.
2. Ink's React reconciler diffs the tree.
3. Ink runs Yoga layout on the updated tree.
4. Ink computes changed cells and writes ANSI escape sequences to stdout.

### Output filter pipeline

Between Ink's ANSI output and terminal stdout, the framework's `LineFilter` pipeline (spec 12) post-processes rendered lines. Built-in filters include `Monochrome` (strips all colors), `NoColor` (respects `NO_COLOR`), `DimFilter`, and `ANSIToTruecolor`. The pipeline is registered on the app (`App.filters`) and runs unconditionally; an empty filter list is a no-op. It is the final boundary where rich-js-originated styled output is flattened into the ANSI stream actually written to the terminal.

### What Ink renders

| Ink component | Terminal output |
|---------------|----------------|
| `<Box>` | Rectangular region with border, padding, background color |
| `<Text>` | Styled text with color, bold, italic, underline, strikethrough |
| `<Newline />` | Explicit line break |
| `<Spacer />` | Flexible empty space (flex-grow) |
| `<Static>` | Content that renders once and is not re-rendered on updates |

### Full-screen vs inline mode

Ink supports two rendering modes:

| Mode | Behavior | When to use |
|------|----------|-------------|
| **Full-screen** (alternate screen) | Enters alternate screen buffer. App owns the entire terminal. Exit restores previous terminal content. | Default for textual-js apps. |
| **Inline** | Renders below the cursor position. Previous terminal output preserved. | Not typical for textual-js but available. |

## Suspend and Resume

`suspend()` is an **app-level lifecycle primitive**, not a driver wrapper. The app owns the full suspend/resume orchestration — pausing timers, animations, and deferred UI work — while the driver (Ink) only provides the low-level "leave/re-enter terminal mode" capability. This is a deliberate separation: suspend coordination is enforced once at the app boundary, not split between app and driver.

// [LAW:single-enforcer] Timer/animation pause and resume are owned by the app's suspend boundary. The driver's only responsibility is entering/exiting raw mode and alternate screen.

// [LAW:one-source-of-truth] `suspend()` on the app context is the single public contract for suspend/resume. There is no separate driver-level suspend API exposed to widget authors.

`suspend()` temporarily exits the app's terminal mode to allow external programs to use the terminal:

```tsx
const { suspend } = useTextual();

const editFile = async (path: string) => {
  await suspend(async () => {
    // Terminal is in normal mode here — the user can interact with $EDITOR
    const { execSync } = await import('child_process');
    execSync(`${process.env.EDITOR || 'vi'} ${path}`, { stdio: 'inherit' });
  });
  // App terminal mode is restored, full refresh triggered
};
```

### Suspend behavior

1. Publish `app_suspend_signal`.
2. Ink exits raw mode and alternate screen (restoring normal terminal state).
3. The framework pauses the Animator (no frames scheduled) and pauses notification-expiry timers plus other deferred UI timers.
4. Call the suspend callback. The terminal is available for external use.
5. When the callback returns, Ink re-enters raw mode and alternate screen.
6. Animator and paused timers resume.
7. Publish `app_resume_signal`.
8. Trigger a full re-render (all widgets re-render to repaint the screen).

### Suspend support

- `canSuspend` capability property indicates whether suspend is supported.
- Environments without suspend support (piped stdin, CI, ink-testing-library) throw `SuspendNotSupported`.

## Capability Properties

The framework queries platform capabilities via the app context:

| Property | Type | Description |
|----------|------|-------------|
| `isHeadless` | `boolean` | Running in ink-testing-library (no real terminal) |
| `isInline` | `boolean` | Ink is in inline mode (not alternate screen) |
| `canSuspend` | `boolean` | Whether `suspend()` is available |
| `terminalSize` | `{ columns: number, rows: number }` | Current terminal dimensions (MobX observable — updates on resize) |
| `colorDepth` | `number` | Color support level (1 = none, 4 = 16 colors, 8 = 256 colors, 24 = true color). Read at startup from `TEXTUAL_COLOR_DEPTH` or terminal capability detection, then passed to rich-js `Color.toAnsi(depth)` at each render boundary so colors downgrade to the active terminal capability. Lower configured values force downgrade even on a higher-capability terminal. |

These are read-only MobX observables on the app context. `terminalSize` changes trigger `Resize` messages and TCSS recalculation (viewport units `vw`/`vh` may change).

## Testing Environment

`ink-testing-library` provides a headless Ink renderer for testing:

```tsx
import { render } from 'ink-testing-library';

const { lastFrame, stdin, unmount } = render(<MyApp />);

// Simulate input
stdin.write('h');           // Key event: 'h'
stdin.write('\x1b[A');      // Key event: up arrow
stdin.write('\r');           // Key event: enter

// Read rendered output
const output = lastFrame(); // ANSI string of the last rendered frame

unmount();
```

The framework's `runTest()` and `Pilot` wrap ink-testing-library with higher-level APIs:

| ink-testing-library | Framework Pilot |
|--------------------|-----------------|
| `stdin.write(rawBytes)` | `pilot.press('enter')` (normalized key name) |
| `lastFrame()` → raw ANSI string | `pilot.queryText('#label')` → widget content |
| Manual stdin encoding | `pilot.click(x, y)` → mouse event |
| No resize simulation | `pilot.resize(80, 24)` → resize event |

The Pilot abstracts away ANSI encoding and raw stdin bytes, letting tests work with framework-level concepts (key names, widget queries, messages).

## Development File Monitor (CSS Live Reload)

In development mode the framework runs a file monitor that watches TCSS source paths registered with the app and reloads them on change. This enables fast iteration on TCSS without restarting the app.

// [LAW:single-enforcer] The file monitor is the single enforcer of on-disk TCSS → in-memory stylesheet synchronization. Widgets never read TCSS files directly.

// [LAW:one-source-of-truth] The `.tcss` file on disk is the source of truth during development; the in-memory parsed stylesheet is a derived representation, re-synchronized whenever the file changes.

### Registered paths

The app registers TCSS source paths when it mounts. Any path supplied via `cssPath` (string or array) on the root `<App>` or on a `Screen` is added to the monitor's watch set.

| Source | Watched |
|--------|---------|
| `<App cssPath="app.tcss" />` | Yes |
| `<App cssPath={["base.tcss", "theme.tcss"]} />` | Yes (each path) |
| `Screen` subclass with `cssPath` | Yes, while the screen is mounted |
| Inline `DEFAULT_CSS` strings on widgets | No (not file-backed) |

When a `Screen` with its own `cssPath` is pushed, its paths are added to the watch set; when it is popped, its paths are removed (unless still referenced elsewhere).

### Change flow

When a watched file changes on disk, the framework runs the same steps every time — no conditionals on which file changed or which screen is active. The data (the set of registered paths and the active screen stack) determines what is reapplied.

1. Re-read the changed file from disk.
2. Call `app.refreshCss()` — reparse every registered stylesheet and reapply to all widgets on the active screen stack (triggering TCSS recomputation via the reactive pipeline).
3. Publish a dev-console message describing the reload (path, parse result, timing).

// [LAW:dataflow-not-control-flow] The reload pipeline is unconditional: read → reparse → reapply → publish. Parse errors flow through the same path as successful parses, emitted as a dev-console message with the error payload rather than skipping the reapply step.

### Platform implementation

| Concern | Choice |
|---------|--------|
| Watch API | Node.js `fs.watch` (recursive where supported; per-path otherwise) |
| Debounce | Coalesce bursts of filesystem events on the same path into a single reload |
| Encoding | UTF-8 |
| Missing file | Emit a dev-console error; keep the previous parsed stylesheet in place until the file reappears |

The monitor uses `fs.watch` — not Python's `watchfiles`, not Windows-specific APIs. Editors that write via rename (atomic replace) are handled by re-establishing the watch on the path when the inode changes.

### Enablement and lifecycle

| Mode | File monitor |
|------|--------------|
| Development (`TEXTUAL_DEVTOOLS` env var set, or equivalent dev flag) | Started on app mount; runs until app exit |
| Production | Not started; TCSS is loaded once at startup and never re-read |
| Testing (ink-testing-library) | Not started; tests drive CSS changes explicitly via Pilot / test APIs |

On app exit (normal unmount, `SIGINT`, or crash cleanup), the framework closes every `fs.watch` handle it opened. Watcher cleanup is part of the same teardown path as raw-mode restoration — there is no separate "maybe close watchers" branch.

// [LAW:one-way-deps] The file monitor depends on the app's CSS path registry and on `app.refreshCss()`. Neither the registry nor the CSS engine depends on the monitor — in production the monitor is simply absent.
