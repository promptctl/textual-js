# Drivers, I/O, and Platform Behavior

## Driver Abstraction

`textual.driver.Driver` is the platform I/O boundary. It owns the asyncio loop
reference captured at construction and translates between low-level terminal
bytes and app-level messages.

Constructor parameters are fixed: `app`, `debug`, `mouse`, and an optional
initial `size`. Drivers must not introduce additional required parameters;
the base class and `App.get_driver_class()` assume this shape.

Abstract backend methods every driver must implement:

- `write(data: str)` — enqueue raw output for the terminal.
- `start_application_mode()` — enter the interactive terminal mode and begin
  producing input events.
- `disable_input()` — stop producing input events; must be idempotent.
- `stop_application_mode()` — restore the terminal to its pre-start state.

Non-abstract base behaviors drivers inherit (and may extend, but not replace):

- `flush()` — no-op by default; overridden where buffering matters.
- `suspend_application_mode()` / `resume_application_mode()` — default
  implementations call `stop_application_mode() + close()` and
  `start_application_mode()` respectively.
- `close()` — final cleanup hook, called after suspend/stop.
- `no_automatic_restart()` context manager — toggles `_auto_restart` so signal
  handlers skip auto suspend/resume while a caller manages lifecycle manually.
- `open_url(url, new_tab=True)` — default opens via Python's `webbrowser`;
  `WebDriver` overrides to emit an `open_url` meta packet.
- `deliver_binary(...)` — default streams a file-like object to `save_path` on
  a background thread in 64 KiB chunks, posting `DeliveryComplete` /
  `DeliveryFailed` events; `WebDriver` overrides to stream chunks to the host.

Capability/mode properties (all default `False` on the base class):

- `is_headless`, `is_inline`, `is_web` — mutually exclusive mode flags.
- `can_suspend` — whether the driver honors suspend/resume.

`Driver.SignalResume` is a nested `Event` subclass that drivers post after a
SIGTSTP/SIGCONT round trip so the app can publish its own resume signal.

## Input Normalization in Base Driver

`Driver.process_message` runs on the driver's input thread and performs shared
normalization before forwarding to the app via `send_message` (which bounces
the message back onto the captured asyncio loop with
`run_coroutine_threadsafe`). Because it runs off-loop, it must not call into
the app directly.

Unconditional steps, in order:

1. `message.set_sender(self._app)`.
2. For any `MouseEvent`, translate `x`, `y`, `screen_x`, `screen_y` by the
   current `cursor_origin` offset (origin defaults to `(0, 0)`).
3. Mouse button bookkeeping: push button on `MouseDown`, remove on `MouseUp`.
4. On `MouseMove` with no button pressed but outstanding `_down_buttons`,
   synthesize one `MouseUp` per stuck button at the previous move's
   coordinates before recording the new move. This repairs drag streams when
   the terminal drops the terminating release.
5. Forward the (possibly rewritten) message via `send_message`.

// [LAW:single-enforcer] Cross-platform input normalization is enforced once
in `Driver.process_message`; backend subclasses extend it but do not
reimplement sender assignment, coordinate translation, or stuck-button repair.

## Implementations

### HeadlessDriver

- `is_headless = True`; `write` is a no-op so no ANSI ever leaves the process.
- `start_application_mode` posts exactly one `Resize` derived from the
  configured `size` (if provided) or `shutil.get_terminal_size()`.
- `disable_input` / `stop_application_mode` are no-ops; there is no input
  thread, so tests drive the app deterministically by posting messages
  directly.

### LinuxDriver (Linux / macOS full-screen)

Output goes through a background `WriterThread` writing to `sys.__stderr__`;
input is read from `sys.__stdin__` on a dedicated `textual-input` thread using
a `SelectSelector` with a 100 ms timeout and an incremental UTF-8 decoder,
feeding an `XTermParser`.

Start sequence (`start_application_mode`):

1. Install transient `SIGTTOU` / `SIGTTIN` handlers that re-SIGSTOP the
   process, perform a no-op `tcsetattr` round-trip to detect that the process
   is actually foregrounded, then restore the handlers. If the round-trip
   fails, start aborts without entering application mode.
2. Start the `WriterThread`.
3. Install a `SIGWINCH` handler that posts a `Resize` event unless in-band
   window-resize reporting is active.
4. Write `ESC[?1049h` (alt screen) and enable mouse reporting
   (`?1000h ?1003h ?1015h ?1006h`).
5. Capture `termios` attrs via `tcgetattr`, then patch `LFLAG` to clear
   `ECHO | ICANON | IEXTEN | ISIG` (ISIG is preserved when `TEXTUAL_ALLOW_SIGNALS`
   is set, letting the shell keep Ctrl+C) and `IFLAG` to clear
   `IXON | IXOFF | ICRNL | INLCR | IGNCR`. `VMIN` is forced to 1.
6. Hide cursor (`?25l`), enable focus events (`?1004h`), and enable the Kitty
   keyboard protocol progressive enhancement (`ESC[>1u`).
7. Start the input thread and post an initial `Resize`.
8. Query synchronized-output support (`ESC[?2026$p`), suppressed for
   `TERM_PROGRAM=Apple_Terminal` and when stdin is not a tty.
9. Query in-band window-resize support (`ESC[?2048$p`), enable bracketed
   paste (`?2004h`), disable line wrap (`?7l`).
10. Re-issue mouse enable sequences (workaround for iTerm 3.5.0).
11. If a prior `SIGTSTP` marked the process for resume notification, post
    `Driver.SignalResume`.

Teardown (`stop_application_mode` → `disable_input`):

- Disable bracketed paste, re-enable line wrap, disable in-band window
  resize if it was activated.
- `disable_input` clears the `SIGWINCH` handler, disables mouse reporting,
  signals the input thread via `exit_event`, joins it, and flushes pending
  stdin with `tcflush(TCIFLUSH)`. The routine swallows errors and is safe to
  call multiple times.
- Restore the captured termios state, then write `ESC[<u` (disable Kitty
  protocol) **before** leaving the alt screen (`?1049l`), followed by show
  cursor (`?25h`) and disable focus events (`?1004l`).
- `close()` stops the `WriterThread`.

Suspend/resume:

- `can_suspend = True`.
- A `SIGTSTP` handler calls `suspend_application_mode()` (when
  `_auto_restart`), sets a flag to remember that a resume signal is owed,
  then re-raises via `SIGSTOP` on the process. A `SIGCONT` handler calls
  `resume_application_mode()`.

In-band window resize override: `LinuxDriver.process_message` intercepts
`InBandWindowResize` messages from the parser. On first observation the
driver flips an internal flag, optionally writes `ESC[?2048h` to enable the
feature if the terminal reports support-but-not-enabled, and opportunistically
switches mouse reporting to pixel mode (`ESC[?1016h`).

### LinuxInlineDriver

Same termios/parser machinery as `LinuxDriver` but:

- `is_inline = True`; no alt screen is ever entered.
- `write` goes straight to `sys.__stderr__` (no writer thread).
- Start sequence writes the initial focus/kitty/mouse enables, then emits
  `\n * App.INLINE_PADDING` to reserve the inline region.
- `SIGWINCH` triggers a resize event that is paired with `ESC[2J` to clear
  the scrollback before the app redraws.
- The input loop treats `CursorPosition` events as metadata: they update
  `self.cursor_origin` and are *not* forwarded to the app. All other events
  flow through `process_message` as normal, so coordinate translation happens
  relative to the detected inline origin.
- Teardown writes `ESC[<u` (disable Kitty), `ESC[J` to clear the inline
  region, restores termios, then shows the cursor and disables focus
  reporting.

### WindowsDriver

- `can_suspend = True`, inherits the base `suspend_application_mode`
  semantics (no SIGTSTP analog).
- `start_application_mode` calls `win32.enable_application_mode()` and
  stashes the restore callback, starts a `WriterThread` against
  `sys.__stdout__`, then emits alt screen, mouse, cursor hide, focus-in/out,
  Kitty progressive-enhancement (`ESC[>1u`), and bracketed-paste sequences.
- Input is produced by `win32.EventMonitor`, a thread that reads from the
  console and feeds parsed messages into `self.process_message` directly.
- Teardown disables bracketed paste, calls `disable_input` (which joins the
  event monitor thread via `exit_event`), writes `ESC[<u` to disable the
  Kitty protocol **before** leaving the alt screen, then restores alt screen,
  cursor, and focus reporting. `close()` stops the writer thread and calls
  the stored `_restore_console` callback.

### WebDriver

`WebDriver` is the remote/browser backend used by textual-web and
textual-serve. It speaks a length-prefixed framed protocol on stdout:

- Frame layout: 1 byte packet type, 4 bytes big-endian payload length,
  payload.
- `D` — raw terminal output bytes (the normal ANSI stream from `write`).
- `M` — JSON meta payload produced by `write_meta`.
- `P` — binary-packed payload produced by `write_binary_encoded`, used for
  file-delivery chunks.

Before any frames, the driver emits the literal line `__GANGLION__\n` as a
handshake marker. `flush` is a no-op because writes go directly via
`os.write` on the stdout file descriptor.

`is_web = True`. Initial size comes from `COLUMNS`/`ROWS` environment
variables when `size` is not provided, falling back to 80x24.

Start sequence: install `SIGINT`/`SIGTERM` asyncio signal handlers (non-Windows
only) that post `ExitApp`; emit the handshake; enable alt screen, mouse,
cursor hide, any-event mouse (`?1003h`), sync-mode query, and bracketed
paste; post the initial `Resize`; start the input thread; and queue an
initial `AppBlur` so the app starts unfocused until the host reports focus.

Input thread: reads from an `InputReader` (abstracted over
`_input_reader_linux` / `_input_reader_windows`), routes bytes through a
`ByteStream` framer, feeds `D` payloads through `XTermParser`, and hands
`M` payloads to `_on_meta`.

`on_meta` dispatches host-originated events:

- `resize` — update `_size` and post `events.Resize`.
- `focus` / `blur` — post `events.AppFocus` / `events.AppBlur`.
- `quit` — post `messages.ExitApp`.
- `exit` — raises an internal `_ExitInput` to tear down the input loop.
- `deliver_chunk_request` — server-pulled file delivery: look up the
  registered delivery key, read `size` bytes from the file-like, emit a
  `("deliver_chunk", key, chunk)` binary-encoded frame, and on EOF close
  the file, drop the entry, and post `DeliveryComplete`. Errors post
  `DeliveryFailed`.

`disable_input` is a no-op; shutdown runs via `stop_application_mode`, which
sets `exit_event`, closes the `InputReader`, and writes a final
`{"type": "exit"}` meta frame.

`deliver_binary` does not write to disk; it registers the file-like in
`_deliveries` and emits a `deliver_file_start` meta frame carrying the
resolved path, open method, encoding, mime type, and user name. The host
then pulls chunks via `deliver_chunk_request`.

`open_url` is overridden to emit an `open_url` meta frame rather than calling
Python's `webbrowser`.

## Driver Selection

`App.get_driver_class()` chooses backend based on environment, platform, and
runtime mode unless an explicit driver class is supplied to the `App`.

## Output Path

`App._display` writes compositor render sequences through the active driver.
Drivers expose `write` as the single output entry point; batching happens in
the `WriterThread` on Linux/Windows (a bounded `Queue` with
`MAX_QUEUED_WRITES = 30`, flushing only when the queue empties). Synchronized
output sequences (`ESC[?2026h` / `ESC[?2026l`) are emitted by the app layer
when the terminal has advertised support via the `?2026$p` query.

## File Delivery Path

Base `Driver.deliver_binary` streams a file-like to `save_path` on a background
thread in 64 KiB chunks. On success it posts `DeliveryComplete`; on any
exception it logs the traceback and posts `DeliveryFailed`. `WebDriver`
overrides this to register the file and drive chunked transfer through the
host protocol instead.

// [LAW:one-way-deps] Drivers depend on app/event/message contracts; app code
does not depend on concrete backend internals.
