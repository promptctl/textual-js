# Text Editing and Document Model

## Overview

The text editing subsystem provides a multi-line code editor widget (`TextArea`) backed by a document model, navigation engine, edit history, and syntax highlighting. The widget surface is defined in spec 10; this spec defines the engine underneath.

### Subsystem components

| Component | Responsibility |
|-----------|---------------|
| `Document` | Line-based text storage, single mutation primitive (`replaceRange`) |
| `WrappedDocument` | Word-wrap projection over a Document |
| `DocumentNavigator` | Cursor movement with wrap awareness |
| `EditHistory` | Undo/redo stack with batch checkpointing |
| `Edit` | Single edit operation (do/undo/after) |
| `Selection` | Cursor position and selection range |
| `TextAreaTheme` | Syntax and UI styling for the editor |
| **Shiki** | Syntax highlighting via TextMate grammars |

// [LAW:one-source-of-truth] The Document is the single source of truth for text content. TextArea renders from it. WrappedDocument projects it. Navigator reads it. No secondary text buffer exists.

// [LAW:single-enforcer] `Document.replaceRange` is the single mutation primitive. All edits — user keystrokes, paste, programmatic API — flow through `replaceRange`. No other method mutates the document's text.

## TextArea Contract

`TextArea` hosts a `Document`, a `WrappedDocument`, a `DocumentNavigator`, and an `EditHistory`. It is a React component wrapped in `observer()` that renders the document as styled text using Ink primitives.

### Reactive properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `language` | `string \| null` | `null` | Shiki language grammar name (e.g., `"typescript"`, `"python"`) |
| `theme` | `string` | `"default"` | TextArea theme name |
| `selection` | `Selection` | `{ start: [0,0], end: [0,0] }` | Cursor and selection range. `Selection.end` is always the cursor. `alwaysUpdate: true`. |
| `softWrap` | `boolean` | `true` | Whether to wrap long lines |
| `showLineNumbers` | `boolean` | `false` | Whether to display line numbers in the gutter |
| `lineNumberStart` | `number` | `1` | Starting line number for display |
| `indentWidth` | `number` | `4` | Number of spaces per indent level |
| `readOnly` | `boolean` | `false` | Prevent user edits (programmatic edits via API still allowed). Toggles the `-read-only` CSS class on the root. See "Read-only state class". |
| `tabBehavior` | `"focus" \| "indent"` | `"focus"` | Whether Tab moves focus or inserts indent |
| `compact` | `boolean` | `false` | Compact display mode |
| `highlightCursorLine` | `boolean` | `true` | Highlight the line containing the cursor |
| `matchCursorBracket` | `boolean` | `true` | Highlight matching bracket at cursor. See "Matching Bracket Highlighting". |
| `cursorBlink` | `boolean` | `true` | Whether cursor blinks |
| `showCursor` | `boolean` | `true` | Whether cursor is visible |
| `suggestion` | `string \| null` | `null` | Autocomplete suggestion displayed at cursor |
| `hideSuggestionOnBlur` | `boolean` | `true` | Hide suggestion when widget loses focus |
| `placeholder` | `string \| Content` | `""` | Placeholder text when document is empty |

### Key bindings

| Category | Bindings |
|----------|----------|
| **Cursor motion** | `left`, `right`, `up`, `down`, `home`, `end`, `ctrl+home`, `ctrl+end`, `pageup`, `pagedown` |
| **Word motion** | `ctrl+left`, `ctrl+right` |
| **Selection** | `shift+` any motion key (extends selection), `f6` → `action_selectLine` (select the line containing the cursor), `f7` → `action_selectAll` (select the entire document) |
| **Deletion** | `backspace`, `delete`, `ctrl+backspace` (delete word left), `ctrl+delete` (delete word right), `ctrl+w` (delete word), `ctrl+u` (delete to line start), `ctrl+k` (delete to line end), `ctrl+f` (delete to end of line), `ctrl+shift+k` (delete line) |
| **Clipboard** | `ctrl+c` (copy), `ctrl+x` (cut), `ctrl+v` (paste) |
| **Undo/redo** | `ctrl+z` (undo), `ctrl+y` / `ctrl+shift+z` (redo) |
| **Indent** | `tab` (indent, when `tabBehavior === "indent"`), `shift+tab` (dedent) |

Selection actions (`action_selectLine`, `action_selectAll`) set `selection.start` and `selection.end` to span the target range and post `TextArea.SelectionChanged`. They do not mutate the document, so they work in `readOnly` mode.

In `readOnly` mode, keystrokes that would mutate the document are dropped. Navigation and selection (including `f6` and `f7`) still work.

### Editing API

| Method | Description |
|--------|-------------|
| `edit(edit: Edit)` | Apply an Edit, update wrapped document, record in history, post `TextArea.Changed` |
| `loadText(text)` | Replace entire content: rebuild document, clear history, cursor to (0,0), post `TextArea.Changed` |
| `text` (setter) | Same as `loadText` |
| `text` (getter) | Returns the full document text |
| `insertTextAtCursor(text)` | Insert text at the current cursor position |

### Messages

| Message | When |
|---------|------|
| `TextArea.Changed(textArea)` | Content changed (edit, load, paste) |
| `TextArea.SelectionChanged(textArea, selection)` | Cursor or selection changed (navigation, click, selection extension) |

### Component classes (for TCSS theming)

| Class | Target |
|-------|--------|
| `text-area--cursor` | Cursor element |
| `text-area--gutter` | Line number gutter |
| `text-area--cursor-gutter` | Gutter cell for the cursor's line |
| `text-area--cursor-line` | Full line containing the cursor |
| `text-area--selection` | Selected text region |
| `text-area--matching-bracket` | Bracket matching highlight (applied to both brackets of a matched pair) |
| `text-area--suggestion` | Autocomplete suggestion overlay |
| `text-area--placeholder` | Placeholder text |

### Read-only state class

Setting `readOnly: true` toggles the CSS class `-read-only` on the TextArea root element. TCSS can target this class to visually distinguish read-only editors (e.g., dimmed cursor, alternate background, hidden gutter):

```tcss
TextArea.-read-only {
  background: $surface-darken-1;
}
TextArea.-read-only > .text-area--cursor {
  opacity: 50%;
}
```

`readOnly` interaction rules:

| Surface | Behavior when `readOnly: true` |
|---------|-------------------------------|
| Mutating keystrokes (typing, paste, delete, indent) | Dropped — key handler returns without calling `replaceRange`. |
| Navigation keys (arrows, home, end, word motion, pageup/pagedown) | Work normally. |
| Selection keys (`shift+` motion, `f6`, `f7`) | Work normally — selection is not a document mutation. |
| Programmatic `edit()`, `loadText()`, `insertTextAtCursor()` | Apply regardless of `readOnly`. The flag blocks user input only. |
| `-read-only` CSS class | Present on root while `readOnly === true`, absent otherwise. |

// [LAW:single-enforcer] The `readOnly` check lives at the key-handler boundary. Programmatic mutation paths do not re-check the flag, keeping API edits unconditional.

### Theme and language registration

| Method | Description |
|--------|-------------|
| `registerTheme(theme: TextAreaTheme)` | Register a theme for this TextArea instance |
| `registerLanguage(name, options?)` | Register a Shiki language grammar for this instance |

- Unknown theme → throws `ThemeDoesNotExist`.
- Unknown language → throws `LanguageDoesNotExist`.
- Registrations are per-instance, not global.

## Line Rendering Pipeline

For each visible row `y` after scroll translation, `TextArea` produces a rich-js `Strip`:

1. **Base style**: start with `theme.base` applied to the full line.
2. **Tab expansion**: expand tabs using rich-js-aware cell-width measurement so visual columns match render width.
3. **Syntax tokens**: when `language` is set, Shiki tokenizes the line. Each token maps to a rich-js `Style` via `theme.syntaxStyles`, overriding the base style for that token's range.
4. **Cursor-line highlight**: when `highlightCursorLine` is true and the cursor is on this row, merge `theme.cursorLine` over the full line.
5. **Selection overlay**: when the row intersects the selection range, merge `theme.selection` over the selected columns.
6. **Matching bracket overlay**: when bracket matching returns a pair on this row, merge `theme.matchingBracket` over those character positions.
7. **Cursor overlay**: when the cursor is on this row, merge `theme.cursor` over the cursor cell.
8. **Suggestion overlay**: when `suggestion` is set and the cursor is at end-of-line on this row, append the suggestion text as a `Segment` with `theme.suggestion`. Suggestion text is not part of the document; accepting it inserts new document text through `edit()`.
9. **Placeholder**: when the document is empty, placeholder is set, and this is row 0, render placeholder content with `theme.placeholder`.
10. **Gutter**: when `showLineNumbers` is enabled, prepend gutter segments styled with `theme.gutter` (or the cursor-line gutter style for the active row).

Each overlay is applied via rich-js `Style` merge, with later overlays winning. The final rendered row is a `Strip` of `Segment`s, which the framework converts to Ink `<Text>` elements grouped by consecutive style run.

## Document Model

`Document` is the data model consumed by TextArea, WrappedDocument, and DocumentNavigator. It stores text as a newline-stripped array of strings (MobX observable array).

### Storage format

- Text is split into lines and stored without newline characters.
- If the source text ends with a newline (or is empty), an extra empty line is appended so trailing newlines round-trip correctly.
- Newline style is auto-detected (preference order: `\r\n` → `\n` → `\r` → fallback `\n`).
- The `newline` property reports the detected style.

### Mutation

`replaceRange(start: Location, end: Location, text: string): EditResult`

This is the **single mutation primitive**. All edits flow through it.

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | `Location` `[row, col]` | Start of the range to replace |
| `end` | `Location` `[row, col]` | End of the range to replace |
| `text` | `string` | Replacement text (may be empty for deletion, multi-line for paste) |

Returns `EditResult { endLocation: Location, replacedText: string }`.

Examples:

| Operation | replaceRange call |
|-----------|-------------------|
| Insert "hello" at row 3, col 5 | `replaceRange([3,5], [3,5], "hello")` |
| Delete character at row 0, col 10 | `replaceRange([0,10], [0,11], "")` |
| Replace selection with paste | `replaceRange(selection.start, selection.end, clipboardText)` |
| Delete line 5 | `replaceRange([5,0], [6,0], "")` |

### Read access

| Property / Method | Description |
|-------------------|-------------|
| `text` | Full document text (lines joined with `newline`) |
| `lines` | Array of line strings (observable) |
| `lineCount` | Number of lines |
| `getLine(index)` | Single line string |
| `getTextRange(start, end)` | Text between two locations. Returns `""` when `start === end`. |
| `start` | Location `[0, 0]` |
| `end` | Location of the end of the document |
| `getSize(indentWidth)` | `Size` of the document in visual cells |
| `getIndexFromLocation(loc)` | Codepoint-based index from location |
| `getLocationFromIndex(idx)` | Location from codepoint-based index |

### Read-only mode and API edits

When `TextArea.readOnly` is true:
- User keystrokes that would call `replaceRange` are dropped.
- Programmatic calls to `edit()`, `loadText()`, and `insertTextAtCursor()` **still work**. Read-only prevents user input, not API mutations.

## Selection

`Selection` is `{ start: Location, end: Location }`.

| Property / Method | Description |
|-------------------|-------------|
| `start` | Start of selection `[row, col]` |
| `end` | End of selection (always the cursor position) `[row, col]` |
| `isEmpty` | Whether start === end (zero-width, cursor only) |
| `Selection.cursor(location)` | Factory: builds a zero-width selection at the given location |

Default: both start and end at `[0, 0]`.

## Syntax Highlighting via Shiki

textual-js uses **Shiki** for syntax highlighting instead of tree-sitter (Python Textual's approach).

### Why Shiki

- Uses TextMate grammars — same as VS Code.
- Supports hundreds of languages out of the box.
- Works in Node.js (terminal context).
- Produces tokenized output with color/style information.
- No native compilation needed (unlike tree-sitter WASM).

### Highlight pipeline

```
Document text
    │
    ▼
Shiki tokenizer (TextMate grammar for the language)
    │
    ▼
Token array: [{ content: "const", color: "#569CD6" }, { content: " ", color: "#D4D4D4" }, ...]
    │
    ▼
TextArea renders each token as <Text color={token.color}>{token.content}</Text>
    │
    ▼
Ink outputs styled text to terminal
```

1. When `language` is set, Shiki loads the corresponding TextMate grammar.
2. Shiki tokenizes the document content line by line.
3. Each token carries a color/style from the active Shiki theme.
4. The token stream feeds the TextArea line-rendering pipeline, which converts tokens into rich-js `Style` overlays before the final `Strip` is translated to Ink `<Text>`.
5. When the document changes, affected lines are re-tokenized.

### Theme mapping

Shiki themes provide color values for token types. `TextAreaTheme.syntaxStyles` maps Shiki token types to framework styles:

```tsx
interface TextAreaTheme {
  name: string;
  base: Style;               // rich-js Style — default text style
  gutter: Style;             // rich-js Style — line number gutter
  cursor: Style;             // rich-js Style — cursor element
  cursorLine: Style;         // rich-js Style — highlighted cursor line
  selection: Style;          // rich-js Style — selected text overlay
  matchingBracket: Style;    // rich-js Style — matching-bracket overlay
  suggestion: Style;         // rich-js Style — autocomplete suggestion
  placeholder: Style;        // rich-js Style — placeholder text
  syntaxStyles: Map<string, Style>; // Shiki token scope → rich-js Style
}
```

All `TextAreaTheme` style fields are rich-js `Style` instances, including `syntaxStyles`.

### Language and theme registration

```tsx
// Register a language
textArea.registerLanguage('typescript');
textArea.registerLanguage('python');
textArea.registerLanguage('rust');

// Register a custom theme
textArea.registerTheme({
  name: 'my-theme',
  base: { color: '#d4d4d4', background: '#1e1e1e' },
  gutter: { color: '#858585' },
  cursor: { color: '#ffffff', background: '#007acc' },
  // ...
});

// Use them
<TextArea language="typescript" theme="my-theme" />
```

Shiki owns syntax-token identification (keywords, strings, comments, etc.). Tab expansion and bracket matching below are framework concerns applied during rendering, independent of the Shiki token stream.

## Matching Bracket Highlighting

When `matchCursorBracket: true` and the cursor is adjacent to a bracket character, the framework scans the document for the matching pair and applies the `-matching-bracket` component class (`text-area--matching-bracket`) to both bracket positions.

### Bracket pairs

| Open | Close |
|------|-------|
| `{` | `}` |
| `[` | `]` |
| `(` | `)` |

### Algorithm

```
findMatchingBracket(document, cursorLocation):
  char = character at or adjacent to cursor
  if char not in bracket pairs: return null

  direction = forward if char is an opening bracket else backward
  target   = matching counterpart of char
  depth    = 1

  scan characters in `direction` from cursor:
    if char === same-kind opening: depth += 1
    if char === same-kind closing: depth -= 1
    if depth === 0: return current location

  return null   // unbalanced — no highlight, no error
```

### Behavior contract

| Condition | Result |
|-----------|--------|
| Cursor adjacent to opening bracket with balanced pair | Both bracket positions receive `theme.matchingBracket` as a rich-js `Style` overlay. |
| Cursor adjacent to closing bracket with balanced pair | Both bracket positions receive the overlay. Scan runs backward. |
| Cursor not adjacent to any bracket | No highlight. |
| Unbalanced document (no match found) | No highlight, no error, no log. |
| `matchCursorBracket: false` | Bracket scan never runs. |
| Bracket inside a string or comment | Still matched by this algorithm — language-aware matching is **not** a base contract. Widgets can override by subclassing and consulting the Shiki token stream. |

Scan complexity is O(N) in the worst case over unbalanced documents. The framework may bound scan distance for performance; unbounded documents that do not contain a match within the bound are treated as unmatched.
The match result is `{ start: Location, end: Location } | null`. When non-null, the line renderer overlays `theme.matchingBracket` at those two character positions during `Strip` construction. There is no separate render path for matched brackets; the match result is just another input to the line pipeline.

// [LAW:dataflow-not-control-flow] Bracket matching always runs when `matchCursorBracket: true` — the output is either a pair of locations or `null`. Rendering applies the class unconditionally based on that value; there is no "skip bracket matching" branch.

## Tab Expansion

Tab characters are stored verbatim in the `Document`. Tab expansion happens **during rendering only** — it is never baked into the document.

### Tab stop algorithm

Tabs advance the cursor to the next tab stop. The width of a given tab depends on its column:

```
cellsToNextTabStop = indentWidth - (currentColumn % indentWidth)
```

When computing `currentColumn`, double-width characters (CJK, emoji) count as two cells. The same algorithm feeds width calculation, wrapping, and cursor placement so all three agree on visual geometry.

### Framework helpers

These are implementation-level utilities used by the TextArea renderer. They are not part of the user-facing API surface.

| Helper | Description |
|--------|-------------|
| `expandTabsInline(text, indentWidth)` | Returns a tab-expanded string. Used for width calculation and for plain (non-syntax-highlighted) rendering. |
| `expandTextTabsFromWidths(text, widths)` | Applies pre-computed per-tab widths to styled text so Shiki highlighting spans survive the expansion. Used by syntax-highlighted rendering. |

The two-stage form (`expandTextTabsFromWidths`) exists because Shiki-tokenized output carries style spans that must be preserved when tab characters are replaced with variable-width whitespace. A naive string replacement would desynchronize span boundaries from character positions.

### Contract

| Expectation | Verification |
|-------------|-------------|
| Document storage | `document.text` contains raw `\t` characters, never spaces. |
| Width agreement | `expandTabsInline` and `expandTextTabsFromWidths` produce identical visible widths for identical input. |
| Cursor placement | Cursor column after a tab equals `currentColumn + cellsToNextTabStop`. |
| Wrap boundary | `WrappedDocument` wrap decisions use the same expanded width. |

// [LAW:one-source-of-truth] Tab widths are computed from `indentWidth` and column position. No second representation (e.g., a parallel expanded-text buffer) is stored; expansion is derived on demand during rendering.

## Navigation Semantics

`DocumentNavigator` provides wrapping-aware cursor movement. It wraps a `WrappedDocument` and its source `Document`.
All column and width math uses rich-js cell-width helpers (`cellLength`, `columnIndex`, `cellIndex`), not JavaScript `str.length`. Wrap boundaries, cursor placement, `lastXOffset`, and click-to-position hit-testing all measure terminal cells, so CJK, emoji, tabs, ANSI escapes, and combining characters behave correctly.

### Position translation

| Method | Description |
|--------|-------------|
| `offsetToLocation(offset)` | Visual offset (row, col in wrapped space) → document Location |
| `locationToOffset(location)` | Document Location → visual offset |

### Movement operations

| Movement | Behavior |
|----------|----------|
| **Left / Right** | Move one character. At line boundaries, wraps to previous/next line. |
| **Up / Down** | Move one visual row (respects wrapping). Preserves `lastXOffset` — vertical movement retains horizontal intent across lines of differing widths. |
| **Home** | "Smart home": first press goes to first non-whitespace column, second press goes to column 0. |
| **End** | End of the current visual line (wrap-aware). |
| **Ctrl+Home / Ctrl+End** | Document start / document end. |
| **Page Up / Page Down** | Move by one visible page (scrollport height). |
| **Word left / Word right** | Move to word boundary. Word boundaries use a regex pattern matching word/non-word transitions. |

### lastXOffset

When moving vertically, the navigator retains the visual column position (`lastXOffset`) so the cursor returns to the same column when moving through lines of varying length:

```
Line 1: "Hello, world!"        cursor at col 10
Line 2: "Hi"                   cursor at col 2 (line is short) but lastXOffset = 10
Line 3: "This is a longer line" cursor returns to col 10 (lastXOffset preserved)
```

`lastXOffset` is reset when the cursor moves horizontally.

## Edit and Edit History

### Edit

`Edit` describes a single `replaceRange` invocation with undo support.

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | Replacement text |
| `fromLocation` | `Location` | Start of the range to replace |
| `toLocation` | `Location` | End of the range to replace |
| `maintainSelectionOffset` | `boolean` | Whether to shift the existing selection by the edit's delta (vs. collapsing to cursor at end) |

#### Edit lifecycle

| Method | Description |
|--------|-------------|
| `do(textArea, recordSelection?)` | Record current selection, apply `document.replaceRange(top, bottom, text)`, compute post-edit selection. |
| `undo(textArea)` | Replay `replaceRange` over the edit's new span with the saved `replacedText`. Restore `originalSelection`. |
| `after(textArea)` | Runs after re-wrap/refresh: apply `updatedSelection`, call `recordCursorWidth()`. |

Post-edit selection behavior:
- If `maintainSelectionOffset`: shift the existing selection rows/columns by the edit's row/column delta (used for indent/dedent of selected blocks).
- Otherwise: collapse the selection to a cursor at `editResult.endLocation` (used for normal typing, paste, delete).

### EditHistory

Manages batched undo/redo with deterministic checkpoint rules.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxCheckpoints` | `number` | `50` | Maximum undo stack depth |
| `checkpointTimer` | `number` | `2` | Seconds of inactivity before forcing a new batch |
| `checkpointMaxCharacters` | `number` | `100` | Characters typed before forcing a new batch |

#### Batching rules

`record(edit)` adds an edit to the current batch. A **new batch is forced** when:

| Condition | Rationale |
|-----------|-----------|
| Undo stack is empty | First edit starts a new batch |
| Explicit checkpoint requested | `checkpoint()` called |
| Edit inserts more than one character | Paste should be one undo step |
| Edit contains `\n` | Newline inserts are discrete actions |
| "Is replacement" flag differs from previous edit | Delete vs insert are separate actions |
| Elapsed time exceeds `checkpointTimer` | Pause in typing starts a new batch |
| Character count exceeds `checkpointMaxCharacters` | Long unbroken typing is chunked |

After recording, the redo stack is cleared (new edits invalidate the redo future).

#### Undo / Redo

| Method | Description |
|--------|-------------|
| `undo()` | Undo the entire current batch (all edits in the batch are reversed in LIFO order) |
| `redo()` | Redo the entire next batch |
| `clear()` | Empty both stacks (called by `loadText`) |
| `checkpoint()` | Force a batch boundary. Called on: blur, mouse click (explicit cursor placement), non-edit keyboard motion. |

Undo/redo move whole batches between stacks — the unit of undo is a batch, not a single character.

## Wrapping Projection

`WrappedDocument` projects a `Document` into visual lines at a given width.

### API

| Method / Property | Description |
|-------------------|-------------|
| `wrap(width, tabWidth?)` | Rebuild all wrapping caches. `width === 0` disables wrapping. |
| `wrapRange(start, oldEnd, newEnd)` | Incremental rewrap after an edit (only recomputes affected lines). |
| `offsetToLocation(offset)` | Visual offset `[visualRow, visualCol]` → document `Location [docRow, docCol]` |
| `locationToOffset(location)` | Document `Location` → visual offset |
| `height` | Total number of visual rows (including wrapped continuations) |
| `wrapped` | Whether any line actually wrapped (boolean) |
| `getLine(visualRow)` | Content of a visual row |

### Wrap algorithm

1. For each document line, compute break points based on the available width and tab expansion.
2. A line that fits within the width produces one visual row.
3. A line that exceeds the width is broken at word boundaries (or at the width boundary if no word boundary exists).
4. Each visual row tracks its corresponding document line index and column offset.
5. Tab characters are expanded to `tabWidth` spaces for width calculation but stored as tabs in the document.

Incremental rewrap (`wrapRange`) recomputes only the affected document lines, preserving visual rows for unmodified lines.

## Verifiable Behavior Expectations

These are the deterministic properties tests should verify:

| Expectation | Verification |
|-------------|-------------|
| `loadText` / setting `text` | Clears EditHistory, rebuilds document/wrappedDocument/navigator, resets cursor to (0,0), posts `TextArea.Changed`. |
| Edit round-trip | `edit.do()` followed by `edit.undo()` produces identical document text and cursor state. |
| Selection changes | Emit `SelectionChanged`, update `lastXOffset`, scroll cursor into view. |
| Language assignment | Re-runs Shiki tokenization and invalidates rendering. |
| Theme assignment | Re-applies theme styles and invalidates rendering. |
| Unknown language | Throws `LanguageDoesNotExist`. |
| Unknown theme | Throws `ThemeDoesNotExist`. |
| EditHistory batching | Observable through undo/redo stack depth after scripted edit sequences. |
| Read-only + API edit | `readOnly: true` blocks keystrokes but `edit()` and `loadText()` still work. |
| Read-only CSS class | `readOnly: true` adds `-read-only` to the root; `readOnly: false` removes it. |
| Select line / select all | `f6` collapses selection to cover the cursor's line; `f7` covers the entire document. |
| Delete to end of line / delete line | `ctrl+f` removes `[cursor..lineEnd]`; `ctrl+shift+k` removes the full line (including its newline). |
| Bracket match | With balanced input, cursor adjacent to a bracket yields both bracket positions in the matching-bracket set; unbalanced input yields an empty set without error. |
| Tab expansion width | Rendered cell width of a tab at column `c` equals `indentWidth - (c % indentWidth)`. |
| Newline round-trip | `document.text` after `loadText(text)` produces identical text (including trailing newline preservation). |

// [LAW:dataflow-not-control-flow] Editing is modeled as deterministic transformations over document state with explicit edit records and batch checkpoints, not ad-hoc mutation.
// [LAW:verifiable-goals] Editor correctness is checkable through deterministic document text/selection/history state after scripted edit operations.
