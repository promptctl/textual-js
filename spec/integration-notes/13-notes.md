# Integration notes for spec-src/13-testability-and-automation-surfaces.md

## Critical context

- **Rich-js role**: test query helpers need to distinguish plain-text queries (`queryText`) from content queries (`queryContent`). `getStyles` returns both Ink props and rich-js Style. `lastFrame` already produces ANSI-encoded output (rich-js rendered through Ink).
- **Terminal-UI reality**: snapshot tests compare ANSI output; content assertions need rich-js-aware helpers.

## Gaps to fix

### 1. queryText vs queryContent

**Where**: "Query Helpers" table on TestHandle.
**Current state**: `queryText(selector) → string | null`.
**Why insufficient**: A styled widget's "text" can be queried either as plain text (for simple assertions) or as rich-js `Content` (for style assertions).
**Required change**: Add a companion helper:
  - `queryText(selector): string | null` — returns plain text (rich-js `Content.plainText` equivalent; ANSI/styles stripped).
  - `queryContent(selector): Content | null` — returns the widget's rendered rich-js `Content` (preserves styles; useful for asserting specific spans are bold/colored).

### 2. getStyles return shape

**Where**: `getStyles(selector)` in the Query Helpers table.
**Current state**: "Returns the resolved TCSS styles for a widget."
**Why insufficient**: Should specify the shape — `{ box, text, style, components }` — matching spec 04's `ResolvedStyles`.
**Required change**: Update: "Returns the widget's `ResolvedStyles`: `{ box: InkBoxProps, text: InkTextProps, style: richJsStyle, components: Map<string, richJsStyle> }`. Tests can assert on any field — e.g., `expect(styles.style.bold).toBe(true)` for text styling, or `expect(styles.components.get('text-area--cursor').backgroundColor).toEqual(Color.parse('#fff'))`."

### 3. Snapshot tests and ANSI

**Where**: Usage section / `lastFrame()` description.
**Current state**: "Returns the raw ANSI-encoded last rendered frame."
**Why insufficient**: Tests may want to snapshot only structure or only text. Additional helper suggestion.
**Required change**: Note: "Snapshot tests using `lastFrame()` capture the exact ANSI output, which is sensitive to rich-js `Color.toAnsi()` and the active output filter pipeline. For stable snapshots across environments, set `colorDepth` explicitly via `runTest({ colorDepth: 24 })` or install `NoColor` in `filters` for ASCII-only snapshots. Alternatively, use `queryContent` / `queryStyles` for structural assertions that don't depend on exact ANSI bytes."

### 4. Pilot interactions with Content

**Where**: Pilot interface section.
**Current state**: Pilot sends raw key/mouse/resize events.
**Why insufficient**: Might be useful to mention that text typed via `pilot.type()` is plain-text (no markup parsing) — it flows as individual Key events to the focused Input/TextArea.
**Required change**: Add note to `pilot.type(text)`: "Types the string as a sequence of Key events. No markup parsing — the characters reach the focused widget's `checkConsumeKey` and are inserted as-is. To insert styled content into a widget programmatically, use the widget's API (e.g., `textArea.insertTextAtCursor` or `richLog.write(content)`)."

### 5. mockClipboard and rich-js

**Where**: `runTest` options table.
**Current state**: `mockClipboard: boolean` — in-memory mock.
**Why insufficient**: The clipboard mock should handle rich content vs plain text.
**Required change**: Expand: "When `true` (default), clipboard operations (cut/copy/paste) use an in-memory mock that stores both plain text and rich-js `Content` representations. Paste events deliver whichever representation matches the consuming widget (Input takes plain text via `Content.plainText`; RichLog takes rich `Content`)."

## Do not change

- Test stack diagram
- runTest contract, TestHandle shape, guarantees
- Pilot keyboard / pointer / terminal / settling sections (only add the type note)
- Pointer options interface
- Error types (OutOfBounds, WaitForScreenTimeout, PilotTargetNotFound)
- Message observation (messageHook)
- AwaitComplete / AwaitRemove
- Vitest integration section
- Common test patterns
- Determinism expectations table
- "Not a Browser Testing Library" section
