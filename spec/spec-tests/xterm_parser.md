# XTerm Parser

## Overview

Textual includes a two-layer terminal input parser. The base `Parser` class is a generic streaming parser that reassembles arbitrarily chunked input into tokens via a coroutine-based `feed` interface. The `XTermParser` builds on this foundation to recognize XTerm-compatible escape sequences and convert raw terminal input into Textual events: key presses, mouse actions, paste operations, and terminal capability reports.

### Base Parser

The `Parser[T]` base class provides a `feed(data) -> Iterable[T]` method that accepts string chunks of any size and yields parsed tokens. Subclasses implement a `parse(on_token)` coroutine generator that uses `yield self.read1()` to consume input one unit at a time. The parser correctly reassembles data regardless of how it is chunked -- feeding the same logical input in chunks of 1, 2, 5, or any other size always produces identical output tokens in identical order.

### Key Recognition

Plain printable characters are emitted as individual `Key` events whose `key` attribute matches the character (e.g., feeding `"123abc"` produces six `Key` events with keys `"1"`, `"2"`, `"3"`, `"a"`, `"b"`, `"c"` in order).

Non-printable control characters are mapped to named keys. For example, `\x09` produces a `Key` with `key == "tab"`.

Known ANSI escape sequences are recognized and collapsed into a single `Key` event. For example, `\x1b[8~` produces `key == "end"`, and `\x1b[13~` produces `key == "f3"`. Interleaved plain characters and escape sequences are handled correctly: `"abc\x1b[13~123"` yields seven events (`a`, `b`, `c`, `f3`, `1`, `2`, `3`).

### Escape Key

A bare `\x1b` followed by no further escape-sequence characters is interpreted as a press of the Escape key. The parser requires a subsequent empty `feed("")` call (representing an input timeout) to confirm that no additional bytes are coming. A single `\x1b` yields one `Key` with `key == "escape"`. Two consecutive `\x1b\x1b` followed by a timeout yield two separate `"escape"` events.

### Modifier Keys and Extended Key Sequences

The parser recognizes modifier-prefixed keys using both the `ESC + character` convention and the CSI `u` extended key protocol:

- `\x1ba` (ESC followed by lowercase letter) produces `key == "alt+a"`.
- `\x1bA` (ESC followed by uppercase letter) produces `key == "alt+shift+a"`.
- `\x1b[97;3u` (CSI u with modifier parameter 3) produces `key == "alt+a"`.
- `\x1b[65;4u` (CSI u with modifier parameter 4) produces `key == "alt+shift+a"`.
- `\x1b[120;7u` (CSI u with modifier parameter 7) produces `key == "alt+ctrl+x"`.

### Unknown and Overlong Escape Sequences

When an escape sequence does not match any known pattern and exceeds the maximum sequence search length, the parser backtracks and emits each character as an individual `Key` event. The leading `\x1b` is translated to `key == "circumflex_accent"` (the `^` character), and each subsequent character becomes its own key press. This ensures no input is silently dropped.

When an unknown short sequence (e.g., `\x1b[?`) is immediately followed by a known sequence (e.g., `\x1b[8~` for End), the unknown portion is emitted as individual character keys and the known sequence is correctly recognized. This works regardless of how the combined input is chunked.

### Mouse Events

Mouse input uses the SGR extended mouse protocol (`\x1b[<...M` or `\x1b[<...m`). The parser extracts the button/modifier code and the 1-based column and row coordinates, then converts them to 0-based `x` and `y` attributes on the event (i.e., the reported coordinate minus 1).

#### Mouse Down and Mouse Up

- A trailing `M` indicates a button press (`MouseDown`); a trailing `m` indicates a button release (`MouseUp`).
- `\x1b[<0;50;25M` produces `MouseDown` at `x=49, y=24` with `shift=False, meta=False`.
- `\x1b[<0;50;25m` produces `MouseUp` at the same coordinates.
- Modifier flags are encoded in the button code: adding 4 sets `shift=True`, adding 8 sets `meta=True`, and adding 12 sets both.
- `screen_x` and `screen_y` are set equal to `x` and `y`.

#### Mouse Move

Movement events (button codes 32-43 and code 3) produce `MouseMove` events. The `button` attribute indicates which button is held during the drag (1 for a drag, 0 for unmodified movement). Modifier flags (shift, meta) follow the same bit-flag encoding as click events.

#### Mouse Scroll

Scroll events map specific button codes to directional scroll event types:

- Codes 64, 68, 72 produce `MouseScrollUp` (without modifiers, with shift, with meta respectively).
- Codes 65, 69, 73 produce `MouseScrollDown`.
- Codes 66, 70, 74 produce `MouseScrollLeft`.
- Codes 67, 71, 75 produce `MouseScrollRight`.

All scroll events carry `x`, `y`, `shift`, and `meta` attributes.

#### Malformed Mouse Sequences

If a mouse escape sequence is detected but cannot be fully parsed (e.g., it contains extra semicolons like `\x1b[<65;18;20;25M`), the parser silently discards it and emits zero events.

### Bracketed Paste

When the terminal has bracketed paste mode enabled, pasted text arrives wrapped between `\x1b[200~` (paste start) and `\x1b[201~` (paste end). The parser collects all content between these markers and emits a single `Paste` event whose `text` attribute contains the pasted content.

- Escape sequences embedded inside the pasted content are not interpreted. For example, pasting text containing `\x0f` does not produce additional key events; it is included verbatim in the `Paste.text`.
- Bracketed paste sequences can be preceded and followed by other escape sequences. For example, `\x1b[8~\x1b[200~PASTED\x1b[201~\x1b[8~` yields three events: `Key(end)`, `Paste("PASTED")`, `Key(end)`.

### Terminal Mode Reporting

The parser recognizes DECRPM (DEC Private Mode Report) responses for synchronized output capability (`\x1b[?2026;<parameter>$y`).

- Parameter values 1 through 4 indicate the terminal supports synchronized output and produce a `TerminalSupportsSynchronizedOutput` message.
- Parameter value 0 indicates no support; the parser emits no event.

### Chunked Input Resilience

The parser correctly handles input that arrives in arbitrarily sized chunks. Whether an escape sequence is delivered whole or split across multiple `feed` calls (at chunk boundaries of 2, 3, 4, 5, 6, or any size), the resulting events are identical. This applies to all event types: keys, mouse events, bracketed paste, and mode reports.

## Constraints

- The `feed` method is the single entry point for all terminal input. There is no separate method per event type.
- Escape sequences that exceed the maximum search length are never silently dropped; they are decomposed into individual character key events.
- The `\x1b` byte is translated to `circumflex_accent` only during backtracking from a failed sequence match, never during normal key processing.
- Mouse coordinates reported by the terminal are 1-based; the parser converts them to 0-based before populating event attributes.
- Bracketed paste content is opaque to the parser. No escape sequence recognition occurs between the paste start and paste end markers.
- A bare `\x1b` is only finalized as an escape key event after a subsequent `feed` call confirms no additional sequence bytes are pending.
- Terminal mode report parsing is limited to the synchronized output mode (2026). Parameter 0 is explicitly treated as "not supported" and produces no event.
