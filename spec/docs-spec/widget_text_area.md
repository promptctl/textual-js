# Docs Spec: TextArea Widget

## Purpose
Describe the TextArea widget: a focusable multi-line text editor with
selection, soft wrapping, optional syntax highlighting, undo/redo, themes,
and configurable key bindings. Covers both a general-purpose multi-line
input and a code-editor preset.

## Audience
Application authors embedding multi-line input (notes, comments, messages),
and code-editing experiences (REPLs, config editors, script editors). Also
widget authors extending TextArea with domain-specific behavior.

## Required sections
1. Overview and when to use (vs. single-line Input)
2. Two constructor entry points: the default multi-line editor and the
   code-editor preset (soft wrap off, line numbers on, tab inserts `\t`,
   default syntax-highlight theme)
3. Props / constructor parameters
4. Observable (reactive) state
5. Reading content (`text`, `selectedText`, `getTextRange`)
6. Mutating content (`replace`, `insert`, `delete`, `clear`)
7. Selection model (start/end locations, either direction, `end` equals
   cursor; `moveCursor`, `moveCursorRelative`, `selectLine`, `selectAll`;
   cursor-location preview helpers)
8. Messages: `TextArea.Changed`, `TextArea.SelectionChanged`
9. Key bindings: cursor movement, selection (Shift modifiers), editing,
   clipboard, undo/redo (present as tables by category)
10. Tab and Escape behavior (`tabBehavior: "focus"` vs `"indent"`;
    interaction with `indentType` and `indentWidth`)
11. Undo/redo model (checkpoints, `maxCheckpoints`, manual checkpoint API)
12. Read-only mode (keyboard edits blocked; programmatic edits allowed;
    `-read-only` state class)
13. Themes (built-in themes; `"css"` theme derives from TCSS; custom
    theme objects; registration and activation; precedence vs. component
    class styles)
14. Component classes (cursor, gutter, cursor-gutter, cursor-line,
    selection, matching-bracket, suggestion, placeholder)
15. Syntax highlighting (language registration; tree-sitter-style
    highlight queries; mapping capture names to styles via the theme)
16. Line separator handling (detected on load; used for reads and paste
    normalization; no mixed line-endings on export)
17. Navigation and wrapping internals (briefly: a document + wrapped
    document abstraction; mostly opaque to end users)
18. Extending TextArea (hooking key events to implement auto-close brackets
    and similar customizations)
19. Examples

## Key concepts
- Document is the single source of truth for content; selection and cursor
  are always in-bounds with respect to the document
- Selection's `end` is always the cursor; either end can be lexicographically
  before the other
- Soft wrap is a display concern; logical positions remain (row, col) in
  the underlying document
- Syntax highlighting is driven by a tree-sitter-style parse of the
  document and a highlight query; styles are supplied by the active theme
  (or the `"css"` theme, which falls back to component class styles)
- Undo history is a stack of checkpoints; checkpoints are heuristic but
  can be added manually
- Read-only disables only keyboard edits; programmatic edits are always
  permitted
- Tab can either move focus or insert indentation; indentation can be
  tabs or a run of spaces aligned to the next tab stop

## Behaviors and contracts
- `text` read returns the full document; writing `text` replaces all
  content
- `replace(text, start, end)`, `insert(text, location)`, `delete(start, end)`
  all operate in document coordinates
- `Changed` fires on any content change; `SelectionChanged` fires on any
  cursor/selection change
- Cursor movement methods accept a `select` option to extend the selection
  rather than collapse it
- `moveCursorRelative(rows, columns, { select })` uses signed offsets
- Tab behavior is a single rule: the same code path runs on every Tab key
  press; whether it moves focus or inserts indentation is decided by the
  `tabBehavior` value (data, not control flow)
- Indent-type and indent-width interact: when indenting with spaces, Tab
  inserts enough spaces to reach the next indent-width-aligned column
- Undo stack is capped by `maxCheckpoints`; oldest checkpoints are dropped
- Read-only mode adds the `-read-only` class for styling
- The `"css"` theme intentionally delegates everything to TCSS / component
  classes so dark/light themes work without theme switching
- When both a `TextAreaTheme` value and a component class style apply to
  the same visual, the theme value takes priority (theme is the single
  enforcer for explicit styling; component classes are the fallback)
- On paste, newlines are normalized to the document's detected line
  separator

## Example requirements
All examples JSX/TypeScript using Ink primitives:
- A basic multi-line TextArea with a `Changed` handler persisting content
- The code-editor preset with line numbers and a chosen language
- Programmatic edits: `insert`, `replace`, `delete`, `clear`
- Reading selection and cursor
- Switching themes at runtime (built-in and then a custom theme)
- Registering a custom language for syntax highlighting
- Read-only mode
- Overriding Tab behavior to insert indentation
- Intercepting key presses to auto-close brackets (extension pattern)
- Styling via component classes (gutter, cursor-line, selection)

## Cross-references
- spec/docs-spec/widget_rich_log.md (log/output counterpart)
- spec/docs-spec/api_content.md (content pipeline shared with markup widgets)
- spec/docs-spec/api_highlight.md (highlighting pipeline)
- spec/docs-spec/animation.md (cursor blink)
- spec/spec-src/11-text-editing-and-document-model.md (the document,
  wrapped document, and edit/history model)
- spec/spec-src/10-widget-catalog.md (catalog entry)

## Notes for writers
- Do not reference the Python `textual[syntax]` extra or py-tree-sitter
  packaging. In textual-js, syntax highlighting is powered by Shiki in
  the standard TextArea bundle; defer specifics to the TextArea
  implementation spec rather than listing Python dependencies.
- Do not reference `EditHistory` / `DocumentNavigator` / `WrappedDocument`
  as importable Python classes. Mention them only as internal concepts,
  and only briefly, in the "navigation and wrapping internals" section.
- Do not describe Rich `Style` objects as the theme target; in textual-js
  themes expose style objects compatible with the TCSS/Ink styling
  pipeline.
- Do not describe `_on_key` as an override hook; in textual-js the
  extension pattern is component-level key handling (documented by the
  bindings/actions spec). Describe the capability, not the Python method.
- The key-binding tables are behavior contracts; keep them verbatim by
  category but drop Python-specific action names (e.g., don't name
  `action_cursor_word_left`; describe what the key does).
- Keep the "cursor movement accepts a `select` option" rule prominent:
  one code path, two outcomes driven by a flag on the call site - not two
  separate APIs.
- `"css"` theme vs. explicit themes: describe precedence as a single
  ordered rule (theme value wins if present, else component class style).
