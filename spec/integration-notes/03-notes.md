# Integration notes for spec-src/03-message-event-and-dispatch.md

## Critical context

- **Rich-js role**: certain messages carry rich-text content (`Notify`, `Print`, `Paste`, `TextSelected`). The message base model itself is content-agnostic, but the payload types of specific events should be updated.
- **Terminal-UI reality**: `Paste` and `Print` may carry ANSI escape sequences that downstream widgets will hand to rich-js for parsing into `Content`.

## Gaps to fix

### 1. Notify message payload type

**Where**: "Internal operational messages" table, or wherever `Notify` is referenced.
**Current state**: `Notify` is mentioned but its payload is vague.
**Why insufficient**: Notify carries a `Notification` object which has `message: string | Content` and `title?: string | Content`.
**Required change**: Add `Notify` to the event taxonomy with a note that its payload includes a `Notification` object (cross-reference spec 01's Notification model, spec 12's notification docs). Payload may contain rich-js `Content`.

### 2. Paste event — ANSI passthrough

**Where**: "Clipboard and paste events" subsection.
**Current state**: Notes `Paste` carries `text: string`.
**Why insufficient**: Doesn't mention that the text may contain ANSI escape sequences (pasted from a styled terminal source).
**Required change**: Add one sentence: "The `text` field may contain ANSI escape sequences (when pasting from another terminal or styled source). Consumers that want to preserve styling can parse via rich-js `parseAnsi()` into `Content`; consumers that want plain text can strip ANSI via `stripAnsi()` from rich-js."

### 3. Print message payload

**Where**: Any `Print` message reference.
**Current state**: Print is not prominently in the event taxonomy (it's in spec 01's print capture section).
**Why insufficient**: `Print` is a framework message like any other and belongs in the taxonomy.
**Required change**: Add `Print` to the "Internal operational messages" table (non-bubbling, verbose). Fields: `text: string`, `stderr: boolean`. Note ANSI may be embedded.

### 4. TextSelected payload

**Where**: Mouse events table or its own subsection.
**Current state**: `TextSelected` has `text: string`, `range`.
**Why insufficient**: `text` should be `string | Content` — selection across styled widgets preserves style. Also `range` isn't defined.
**Required change**: Change `text` to `text: Content` (always rich-js Content — selection across styled content preserves styles). Define `range` as `{ start: { widget, offset }, end: { widget, offset } }` or similar. Cross-reference spec 09's Text Selection section.

## Do not change

- Message base model (Message, bubble, canReplace, stop, preventDefault, sender, etc.)
- Dispatch pipeline (noDispatch → coalesce → hook → dispatch → flush → bubble → idle)
- Handler discovery (naming convention, `on()` selector handlers)
- Click chain detection — already correct
- Message signal broadcasting — already correct
- callNext/callLater/callAfterRefresh — already correct
- AppFocus/AppBlur, DescendantFocus/DescendantBlur — already correct
- Lifecycle event table (Compose, Mount, Unmount, etc.) — already correct
