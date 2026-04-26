# Spec Integration Notes — Index

`spec/spec-src/00-overview-and-scope.md` and `01-runtime-app-and-lifecycle.md` and `02-dom-reactivity-and-query.md` have been audited and updated to properly reflect rich-js (rich text, markup, renderables, Color, cell-width measurement) and terminal-UI realities. This directory contains per-spec instructions for finishing the same audit on `03` through `14` plus `99`.

## Execution order

Process files in numeric order:

1. `03-notes.md` → `spec-src/03-message-event-and-dispatch.md`
2. `04-notes.md` → `spec-src/04-styling-and-css-engine.md`
3. `05-notes.md` → `spec-src/05-layout-render-and-compositor.md`
4. `06-notes.md` → `spec-src/06-input-bindings-actions-and-commands.md`
5. `07-notes.md` → `spec-src/07-workers-timers-and-signals.md`
6. `08-notes.md` → `spec-src/08-drivers-io-and-platform-behavior.md`
7. `09-notes.md` → `spec-src/09-widget-base-contract.md`
8. `10-notes.md` → `spec-src/10-widget-catalog.md`
9. `11-notes.md` → `spec-src/11-text-editing-and-document-model.md`
10. `12-notes.md` → `spec-src/12-supporting-subsystems.md`
11. `13-notes.md` → `spec-src/13-testability-and-automation-surfaces.md`
12. `14-notes.md` → `spec-src/14-renderer-integration-seams.md`
13. `99-notes.md` → `spec-src/99-source-coverage-matrix.md`

## Standard workflow per file

1. **Read the notes file** (`integration-notes/NN-notes.md`).
2. **Read the target spec-src file** in full.
3. **Cross-check against `spec-src/00-overview-and-scope.md`** — that file is the current source of truth for library roles (rich-js, Ink, MobX, css-tree, uFuzzy, marked, Shiki).
4. **Apply the prescribed edits** in the notes file. Do not invent scope beyond what's listed.
5. **Verify** — grep the target file for terms that should now appear (`rich-js`, `Content`, `Style`, `Color`, etc.) based on the notes.
6. **Move to next file.**

Each notes file uses this shape:

```
# Integration notes for spec-src/NN-*.md

## Critical context
- Rich-js role in this spec
- Terminal-UI realities this spec must address

## Gaps to fix
### 1. [Concern name]
Where: [section/heading]
Current state: [what the file says]
Why insufficient: [what's missing/wrong]
Required change: [specific edit]

## Do not change
- Things already correct
```

## Recurring patterns to watch for

These concerns recur across multiple specs. A gap in one file usually has a parallel gap in adjacent files.

| Concern | Specs affected | How it appears |
|---------|---------------|---------------|
| **rich-js `Content` / `StyledText`** | 03, 05, 09, 10, 11, 12 | Anywhere a widget accepts or produces text. Type is `string \| Content`, not plain `string`. Strings are markup-parsed via rich-js at render time. |
| **rich-js `Style`** | 02 (done), 04, 05, 09, 11 | TCSS resolution produces both Ink props AND a rich-js `Style` for content segments. Line API widgets read this from `ResolvedStyles.style` and `ResolvedStyles.components[name]`. |
| **rich-js `Color`** | 04, 12 | `<color>` TCSS values resolve to rich-js `Color` instances. `$primary` is a `Color`, not a string. Auto-contrast, lightening, blending all go through `Color`. |
| **rich-js `Segment` / `Strip`** | 05, 09, 11 | Line API rendering produces segments/strips. One rendered line = one `Strip` = many `Segment`s. |
| **rich-js renderables** (Bar, Gradient, Sparkline, Digits, Tint) | 10, 12 | Used by widgets: `Sparkline` IS the renderable; `ProgressBar` composes `Bar`; `Header` may use `Gradient`; `Digits` widget uses the `Digits` renderable. |
| **Cell-width measurement** (`cellLength`, `columnIndex`) | 04, 05, 09, 11 | Wide chars = 2, combining = 0, tabs = expanded, ANSI = 0. `str.length` is never correct for display geometry. |
| **Line API vs compose mode** | 05, 09, 10, 11 | TextArea, Input, DataTable, Tree, OptionList, Log, RichLog, Markdown render line-by-line via Strip. Button, Container, etc. compose children. |
| **Markup input** | 09, 10, 12 | Any "text" prop accepts `string \| Content`. Plain string → rendered with ambient Style. Markup string → parsed via rich-js. Content → used directly. |
| **Theme-derived color pipeline** | 04, 12 | Theme palette strings parsed into rich-js `Color`. Derived variables (`$primary-lighten-2`) use `Color.lighten/darken/blend`. CSS variable map is `string → Color`. |
| **ANSI passthrough** | 05, 08, 10 | Captured stdout/stderr may contain ANSI. `RichLog.write()` may receive ANSI strings → rich-js `parseAnsi()` → `Content`. |
| **Output filter pipeline** | 05, 08, 12, 14 | `LineFilter`s apply at Ink→terminal boundary. Operates on rendered segments AFTER rich-js `Content` → Ink `<Text>` conversion. |
| **Animator Color interpolation** | 12, 04 | Animated color-valued TCSS properties use `Color.blend()` per frame. Animator ticks drive rich-js color interpolation. |
| **Shiki integration** | 11 | Shiki tokenizes code → tokens with color/style. Framework maps each token to a rich-js `Style` (via `TextAreaTheme.syntaxStyles`). Overlays (cursor, selection, matched bracket) are rich-js `Style`s applied on top at specific spans. |
| **marked integration** | 10 | marked produces markdown AST tokens. `Markdown` widget walks tokens and produces rich-js `Content` blocks per token type. Fenced code blocks use Shiki for highlighting inside rich-js `Content`. |
| **uFuzzy integration** | 06, 12 | uFuzzy returns match ranges. Command palette result display converts ranges → rich-js `Content` with highlighted segments (emphasized via a component class + rich-js `Style`). |

## Source of truth

When in doubt about library roles, read `spec/spec-src/00-overview-and-scope.md`. It has been updated and now contains the authoritative Foundation Libraries table, "What rich-js provides" section, and the rendering pipeline description.

## What NOT to change

- Phase files under `spec/impl/` — the integration updates are to `spec-src/`, not to `impl/`.
- `spec/docs-spec/` — already produced from Python docs; separate work.
- `spec/spec-tests/` — test case inventory, not edited here.
- Library choice itself — rich-js is the markup/content/Color/renderable layer. Don't propose alternatives.
