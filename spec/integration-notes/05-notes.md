# Integration notes for spec-src/05-layout-render-and-compositor.md

## Critical context

- **Rich-js role**: Line API rendering produces rich-js `Strip` (one per line) composed of `Segment`s with `Style`s. Ink renders these as `<Text>` elements with ANSI output. All width calculations use rich-js `cellLength`.
- **Terminal-UI reality**: Two rendering modes (compose vs Line API); output filter pipeline at Ink→terminal boundary; ANSI passthrough for captured/logged content; `fr` unit framework-resolution before Ink.

## Gaps to fix

### 1. Two rendering modes — make explicit

**Where**: Top of the file, after the Overview paragraph (or as a new subsection under Overview).
**Current state**: File dives into TCSS-to-Ink mapping without distinguishing render modes.
**Why insufficient**: Line API widgets (TextArea, Input, DataTable, Tree, OptionList, Log, RichLog, Markdown) don't render compose-mode children; they produce rich-js `Strip`s line-by-line. This is a fundamental distinction.
**Required change**: Add a new subsection "Rendering Modes" near the top. Two modes:
  - **Compose mode**: widget renders JSX children. Ink/Yoga arranges children. Used by containers, Button, Switch, etc.
  - **Line API mode**: widget renders content line-by-line. Each line is a rich-js `Strip` of `Segment`s with `Style`s. The framework converts the `Strip` to Ink `<Text>` elements (one per style run) inside a `<Box>` with `height: 1` per line. Used by TextArea, Input, DataTable, Tree, OptionList, Log, RichLog, Markdown.
Cross-reference spec 09 for Line API widget base contract.

### 2. Rich-js Strip conversion to Ink

**Where**: "Rendering" section.
**Current state**: "React's reconciler handles all rendering. When MobX observable state changes: ..." — flow goes MobX → observer → render → Ink.
**Why insufficient**: Missing the rich-js Content/Strip conversion step for Line API widgets.
**Required change**: Update the render pipeline to show the rich-js step:
  1. State change → MobX observable
  2. `observer()` triggers re-render
  3. Widget function body runs
  4. **For compose mode**: returns JSX child tree.
  5. **For Line API mode**: produces rich-js `Strip`s (list, one per visible line). The framework converts each `Strip` to a sequence of Ink `<Text>` elements (one per consecutive style run) wrapped in a `<Box>` with the line's height. Each `<Text>` receives Ink color/style props translated from the `Segment`'s rich-js `Style`.
  6. Ink reconciler diffs, Yoga lays out, Ink writes ANSI.

### 3. Cell-width-aware measurement

**Where**: Fractional unit resolution, scroll calculations, anywhere widths are measured.
**Current state**: No mention of cell vs char distinction.
**Why insufficient**: All measurements (fr resolution, scrollport sizing, scroll delta math) must use rich-js `cellLength` for any content that contains text.
**Required change**: Add a standalone subsection "Cell-width-aware measurement":
  "All display-width calculations use rich-js `cellLength(text)`, not JavaScript `str.length`. Wide characters (CJK, emoji) count as 2 cells; combining characters count as 0; tabs expand per `indentWidth`; ANSI escapes count as 0. This applies to: content width in `fr` resolution, scrollport width, scroll offset clamping, cursor column tracking, and line-wrap break points."
Reference this rule in the fr-unit section and scroll-model section.

### 4. Border titles/subtitles

**Where**: Layout Model or a new Chrome subsection.
**Current state**: Not discussed in this spec.
**Why insufficient**: Widgets can declare `BORDER_TITLE` / `BORDER_SUBTITLE` which are rendered inside the border chars. Ink doesn't support border titles; the framework draws them by replacing border characters with rich-js `Content` segments.
**Required change**: Add a subsection "Border titles and subtitles":
  "`BORDER_TITLE` and `BORDER_SUBTITLE` are reactive properties on widgets. Types are `string | Content`. At render time, the framework draws the widget's border manually (not via Ink's `borderStyle` prop alone) so that title/subtitle `Content` can be embedded at positions controlled by `border-title-align` / `border-subtitle-align` TCSS properties. The border is drawn as a single-row `Strip` of rich-js `Segment`s combining border chars with the title/subtitle content."
Note: implementation may use Ink's border plus overlay; the behavioral contract is that title text renders within the border row.

### 5. Output filter pipeline placement

**Where**: "Rendering" or "Platform Integration" section.
**Current state**: File says Ink handles terminal output; doesn't mention the LineFilter pipeline.
**Why insufficient**: The output filter pipeline (spec 12) applies at the Ink→terminal boundary, after rich-js `Content` has been converted to Ink `<Text>` props but before ANSI reaches the terminal.
**Required change**: Add a short subsection "Output filter pipeline":
  "After Ink converts widget JSX to ANSI output, the framework's `LineFilter` pipeline (spec 12) post-processes each rendered line. Filters operate on the segment stream, not on individual widgets. Built-in filters (`Monochrome`, `NoColor`, `DimFilter`, `ANSIToTruecolor`) are applied in declaration order. The pipeline is always evaluated; an empty filter list is a no-op."

### 6. ANSI passthrough in content

**Where**: Rendering section.
**Current state**: Not mentioned.
**Why insufficient**: Widgets like `RichLog` may receive content strings that already contain ANSI escape sequences. The framework must preserve these.
**Required change**: Add one sentence: "When widget content is a rich-js `Content` built from an ANSI-containing string (via `parseAnsi()`), the embedded styles are preserved in the `Segment` stream. The framework does not double-interpret ANSI — raw ANSI at string level becomes structured `Style` values at rich-js level, then is re-emitted as ANSI by Ink."

### 7. Scrollbar rendering

**Where**: Scroll Behavior section.
**Current state**: Mentions scrollbars are rendered as framework widgets.
**Why insufficient**: Scrollbar rendering uses rich-js segment/style (scrollbar thumb chars are specific Unicode chars with a specific `Style` tinted from `scrollbar-*` TCSS tokens).
**Required change**: Add one sentence to the scrollbar paragraph: "Scrollbar chrome is drawn as rich-js `Segment`s using scrollbar block characters (▔▁▂▃▄▅▆▇█ and full-block variants); segment styles are resolved from the parent widget's `scrollbar-color`, `scrollbar-background`, and variant (`-active`, `-hover`) TCSS tokens."

## Do not change

- Ink/Yoga mapping tables — accurate
- Flex property tables — accurate
- `fr` unit resolution algorithm — accurate (but cross-reference the cell-width rule)
- Dock behavior — accurate
- Layers and overlay — accurate
- Stream layout — accurate
- Margin collapse — accurate
- Scroll model (scrollOffset, virtualSize, etc.) — accurate
- Refresh semantics — accurate
- Widget content rendering examples (`compose()`, dynamic composition) — accurate
