# Integration notes for spec-src/11-text-editing-and-document-model.md

## Critical context

- **Rich-js role**: TextArea produces rich-js `Strip` per visible line. Each line composes: base Style from theme + Shiki-tokenized segments + selection/cursor/bracket overlays. `TextAreaTheme` fields are rich-js `Style`s. Bracket matching results are applied as rich-js `Style` overlays.
- **Terminal-UI reality**: Shiki produces token streams; framework maps tokens → rich-js `Style` via `syntaxStyles`; wrap/cursor/selection use cell-width via rich-js.

## Gaps to fix

### 1. TextAreaTheme uses rich-js Style

**Where**: `TextAreaTheme` interface.
**Current state**: Fields are typed abstractly (`Style`).
**Why insufficient**: Should be explicit that these are rich-js `Style` instances.
**Required change**: Update the interface and surrounding prose to say "rich-js `Style`":
  ```
  interface TextAreaTheme {
    name: string;
    base: Style;               // rich-js Style — default text style
    gutter: Style;             // rich-js Style — line number gutter
    cursor: Style;             // rich-js Style — cursor cell
    cursorLine: Style;         // rich-js Style — highlighted cursor line
    selection: Style;          // rich-js Style — selected text (applied as overlay)
    matchingBracket: Style;    // rich-js Style — applied to both matched bracket positions
    suggestion: Style;         // rich-js Style — autocomplete suggestion overlay
    placeholder: Style;        // rich-js Style — placeholder text when document empty
    syntaxStyles: Map<string, Style>; // Shiki token scope name → rich-js Style
  }
  ```

### 2. Line rendering pipeline

**Where**: Add a top-level section after "TextArea Contract" (or integrate into Syntax Highlighting via Shiki).
**Current state**: Spec describes Shiki tokenization and overlays but doesn't show the full pipeline.
**Why insufficient**: The pipeline from Document text → visible Strip per line has multiple stages involving rich-js; stating it explicitly makes contract clear.
**Required change**: Add section "Line rendering pipeline":
  "For each visible row `y` (after scroll translation), TextArea produces a rich-js `Strip`:

  1. **Base style**: start with `theme.base` applied to the full line.
  2. **Tab expansion**: expand tabs using rich-js-aware cell-width measurement, producing positioned characters.
  3. **Syntax tokens (if `language` set)**: Shiki tokenizes the line; each token maps to a `Style` via `theme.syntaxStyles`; base Style is overridden for each token range.
  4. **Cursor line highlight** (if `highlightCursorLine` and cursor is on this row): merge `theme.cursorLine` over the entire line.
  5. **Selection overlay** (if the row intersects the selection range): merge `theme.selection` over the selected columns.
  6. **Matched bracket** (if bracket matching is active and brackets fall on this row): merge `theme.matchingBracket` over the two bracket positions.
  7. **Cursor** (if cursor is on this row): merge `theme.cursor` over the cursor column only.
  8. **Placeholder** (if document empty and placeholder is set and this is row 0): render placeholder as `Content` with `theme.placeholder`.
  9. **Gutter** (if `showLineNumbers`): prepend a gutter `Segment` sequence with `theme.gutter` (or `theme.cursorGutter` on the cursor's row).

  Each overlay is applied via rich-js `Style` merge (later overlays win). The result is a `Strip` of `Segment`s — the line's final rendered form. The framework converts the Strip to Ink `<Text>` elements (one per consecutive style run)."

### 3. Cell-width for wrap and cursor

**Where**: Navigation Semantics / WrappedDocument sections.
**Current state**: Describes soft-wrap mechanics and cursor movement.
**Why insufficient**: Width calculations must use rich-js `cellLength` / `columnIndex` / `cellIndex` — wide characters (CJK, emoji) are 2 cells, tabs expand, combining characters are 0.
**Required change**: Add to Navigation Semantics: "All column/width math uses rich-js cell-width helpers (`cellLength`, `columnIndex`, `cellIndex`), not JavaScript `str.length`. Wrap boundaries, cursor placement, `lastXOffset`, and click-to-position hit-testing all measure in cells. This ensures correct behavior for documents containing CJK, emoji, or other wide/combining characters."

### 4. Bracket matching result as Style overlay

**Where**: "Matching Bracket Highlighting" section.
**Current state**: Describes scan algorithm; says "both brackets styled with `text-area--matching-bracket`".
**Why insufficient**: Doesn't say that the application mechanism is a rich-js `Style` overlay at the exact character positions.
**Required change**: Add: "The match result is `{ start: Location, end: Location } | null`. When non-null, the line renderer overlays `theme.matchingBracket` (a rich-js `Style`) at those two character positions during Strip construction. No separate rendering path — the match is data consumed by the line pipeline."

### 5. Suggestion rendering

**Where**: TextArea reactives / rendering.
**Current state**: `suggestion: string | null` mentioned.
**Why insufficient**: Suggestion rendering uses rich-js — dimmed inline text after the cursor, styled via `theme.suggestion`.
**Required change**: Add to the line rendering pipeline (step 7.5 or after cursor): "Suggestion (if `suggestion` is set and cursor is at end-of-line on this row): append the suggestion text as a `Segment` with `theme.suggestion` (typically dim/italic) after the cursor position. Suggestion text does not participate in document content; accepting moves the suggestion into the document via `edit()`."

### 6. Read-only CSS class timing

**Where**: Read-only state class section.
**Current state**: Accurate.
**Why insufficient**: No issue — already correct.
**Required change**: None (keep as-is). Noting it here for completeness.

## Do not change

- TextArea reactive properties table (just verify types align with spec 10 — e.g., placeholder should be `string | Content`)
- Key bindings table
- Editing API (edit, loadText, insertTextAtCursor)
- Component classes table
- Document model (storage, mutation via replaceRange, newline handling)
- Document mutation examples
- Selection interface
- DocumentNavigator contract (movement ops, lastXOffset semantics)
- Edit and EditHistory (lifecycle, batching rules)
- WrappedDocument (wrap, wrapRange, offsets)
- Wrap algorithm (do augment with cell-width note above)
- Tab expansion helpers (`expandTabsInline`, `expandTextTabsFromWidths`)
- Tab stop algorithm
- Verifiable behavior expectations
- Shiki integration at the level of "language + grammar registration" (add the pipeline description above)
