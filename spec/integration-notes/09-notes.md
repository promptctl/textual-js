# Integration notes for spec-src/09-widget-base-contract.md

## Critical context

- **Rich-js role**: Border titles, tooltips, and rendered content all use rich-js `Content`. Line API widgets produce rich-js `Strip`s. Scrollbar internal widget uses rich-js block chars and resolved `Style`. Selection payload is rich-js `Content`.
- **Terminal-UI reality**: Line API mode is distinct from compose mode; widgets in Line API mode produce strips; scrollbars and border chrome are rich-js-rendered; text selection preserves style.

## Gaps to fix

### 1. Line API widget contract

**Where**: Add a new top-level subsection (after "Rendering Contract" or similar).
**Current state**: File doesn't explicitly discuss Line API.
**Why insufficient**: Line API widgets (the entire ScrollView family) have their own render contract — they produce rich-js `Strip`s per visible line, manage virtual size, and handle scrolling in-content. This is a core architectural distinction.
**Required change**: Add section "Line API widgets":
  "Widgets that manage their own per-line rendering (rather than composing child widgets) are called Line API widgets. Base types: `ScrollView`. Subclasses: `Input`, `TextArea`, `Log`, `RichLog`, `OptionList`, `Tree`, `DataTable`, `Markdown`.

  Line API widgets implement:
  - `renderLine(y: number): Strip` — return a rich-js `Strip` for visual row `y` (relative to scroll offset).
  - `renderLines(range: Region): Strip[]` (optional) — return multiple lines in one call for efficiency.
  - `getContentWidth()` / `getContentHeight()` — override to compute virtual size from content.
  - `virtualSize` — reactive; drives scrollbar position.
  - `refreshLine(y)` / `refreshLines(yStart, count)` — invalidate specific lines without full re-render.

  The framework:
  1. Reads `virtualSize` and `scrollOffset`.
  2. For each visible row, calls `renderLine(y)` or reads from `renderLines`.
  3. Converts each `Strip` to Ink `<Text>` elements (one per consecutive style run).
  4. Arranges the Ink elements as a column of rows inside the widget's `<Box>`.

  Line API widgets skip React-reconciler-based diffing for their content; they rely on `refreshLine` for invalidation granularity."

### 2. Border title and subtitle types

**Where**: "Border rendering" or static configuration table.
**Current state**: `BORDER_TITLE` / `BORDER_SUBTITLE` are mentioned as reactives.
**Why insufficient**: Types should be `string | Content` and the rendering mechanism (embedded in the top/bottom border row via rich-js segments) should be described.
**Required change**: Update the border rendering subsection:
  "`BORDER_TITLE` and `BORDER_SUBTITLE` are reactives of type `string | Content`. Plain strings render with the ambient border style; markup strings are parsed via rich-js. At render, the framework replaces a span of the top (or bottom) border row with the title `Content`, positioned per `border-title-align` / `border-subtitle-align` TCSS properties. Width measurement for placement uses rich-js `cellLength`."

### 3. Tooltip content type

**Where**: "Tooltip" section.
**Current state**: `tooltip` reactive (string or null).
**Why insufficient**: Tooltips can be styled.
**Required change**: Change type to `string | Content | null`. Rendering uses rich-js; the internal Tooltip widget displays the Content inside a styled overlay.

### 4. Scrollbar internal contract — rich-js rendering

**Where**: "Scrollbar widget internal contract" subsection.
**Current state**: Describes reactives (`windowVirtualSize`, `position`, etc.) and scroll messages.
**Why insufficient**: Doesn't describe how the scrollbar actually renders — it's a Line API widget that produces rich-js segments using block characters with a `Style` resolved from the parent's `scrollbar-*` TCSS tokens.
**Required change**: Add to the scrollbar subsection: "Scrollbar rendering: the scrollbar is a Line API widget that produces one-column-wide rich-js `Strip`s. Each visual row of the scrollbar is a `Segment` with a block character (▁▂▃▄▅▆▇█ or full-block) and a rich-js `Style` resolved from the parent widget's `scrollbar-color`, `scrollbar-background`, `scrollbar-color-hover`, `scrollbar-color-active` TCSS tokens (variant chosen from `grabbed`/`mouseHover` state). `ScrollBar.renderer` is pluggable via a static `ScrollBarRender` class for custom character sets."

### 5. Text selection payload

**Where**: "Text Selection" section.
**Current state**: `textSelectAll()` returns selection; details of payload not shown.
**Why insufficient**: The selected text, when it crosses widgets with styled content, must preserve styling (at least nominally — clipboard behavior may strip, but in-memory the selection is styled).
**Required change**: Add: "The selected text is represented as rich-js `Content` covering the selection range across widgets. `TextSelected` (spec 03) carries this `Content` plus a `range` object. Plain-text copy-to-clipboard flattens the `Content` via `Content.plainText`; rich copy (OSC 52 or other) preserves styles where the clipboard target supports them."

### 6. useStyles() return shape

**Where**: Widget anatomy / implementation pattern section.
**Current state**: `useStyles()` described as "Ink-compatible styles."
**Why insufficient**: Should list the three fields: `box`, `text`, `style` (rich-js Style), plus `components` (map of component-class → Style).
**Required change**: Update the `useStyles()` description: "Returns `{ box: InkBoxProps, text: InkTextProps, style: richJsStyle, components: Map<string, richJsStyle> }`. `style` is the widget's ambient content Style (used by Line API widgets as the baseline Style for segments). `components` maps declared component-class names to their resolved `Style`s (applied to segments via component-class overlays)."

### 7. Disabled / loading and rendered output

**Where**: Disabled State / Loading State sections.
**Current state**: Describe input suppression and CSS class toggles.
**Why insufficient**: Rendered output for disabled/loading widgets uses rich-js (dim/overlay). Currently implied but not stated.
**Required change**: Minor — add one sentence each:
  - Disabled: "Visual dimming is driven by TCSS rules targeting `.-disabled`; resolved `Style` includes reduced opacity or dim color applied via rich-js."
  - Loading: "The LoadingOverlay renders a rich-js animated renderable (pulsing dots / spinner chars) with `Style` from TCSS; it swallows all input while visible."

## Do not change

- Widget anatomy code example structure (just annotate useStyles return)
- Static configuration surface table
- Reactive widget state table
- Pseudo-class mapping table
- Lifecycle sequence (Compose → Mount → Unmount)
- Refresh and layout scheduling table
- Rendering contract (compose mode default)
- Geometry and size table
- Scroll API table
- Anchor (auto-scroll) semantics
- Focus management (canFocus, focus, blur, hasFocus)
- Key consumption (checkConsumeKey)
- Mouse capture table
- Event forwarding
- Action dispatch
- Container vs leaf
- Screen contract sections (focus chain, binding chain, modal screens)
- HelpPanel / KeyPanel internal widgets
- Screen internal composition (already added earlier)
- Layout caching for maximize (already added earlier)
