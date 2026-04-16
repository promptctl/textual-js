# Integration notes for spec-src/14-renderer-integration-seams.md

## Critical context

- **Rich-js role**: rich-js is a layer in the integration stack (between Framework and Ink). Needs to appear in the layer diagram and in the hook/context tables.
- **Terminal-UI reality**: Content → Ink conversion is a concrete render-boundary step; output filter pipeline sits at the Ink→terminal boundary.

## Gaps to fix

### 1. Add rich-js to the integration stack diagram

**Where**: "Integration Stack" ASCII diagram.
**Current state**: Layers: User Code → Framework → MobX → React → Ink → Terminal.
**Why insufficient**: rich-js is a peer of MobX — the framework depends on it directly for content/color/renderables/measurement, and it's not transitive through React.
**Required change**: Update the stack diagram to include rich-js:

```
┌──────────────────────────────────────────────────────┐
│ User Code                                            │
│   App component, custom widgets, screen components   │
├──────────────────────────────────────────────────────┤
│ Framework (textual-js)                               │
│   Hooks: useTextual, useStyles, useWorker, etc.      │
│   Stores: FocusManager, ScreenStack, WidgetRegistry  │
│   Engines: TCSS cascade, Binding resolver, Animator  │
├──────────────────────┬───────────────────────────────┤
│ MobX                 │ rich-js                       │
│ Observable state     │ Content, Style, Color,        │
│ observer, reaction   │ Segment, Strip, markup,       │
│                      │ renderables, cell measure     │
├──────────────────────┴───────────────────────────────┤
│ React                                                │
│   Component tree, reconciler, hooks, context         │
├──────────────────────────────────────────────────────┤
│ Ink                                                  │
│   Yoga layout, ANSI output, stdin, raw mode          │
├──────────────────────────────────────────────────────┤
│ Terminal                                             │
└──────────────────────────────────────────────────────┘
```

Note: MobX and rich-js are peers under the framework; neither depends on the other. React depends on neither.

### 2. Content → Ink conversion section

**Where**: Add a new major subsection after "Reactivity → Re-render Bridge" (or near the render flow section).
**Current state**: Not discussed.
**Why insufficient**: The conversion from rich-js `Content`/`Strip` to Ink `<Text>` elements is a concrete integration seam — the "render boundary" where rich-js hands off to React/Ink.
**Required change**: Add section "Content → Ink Bridge":
  "Line API widgets produce rich-js `Strip`s (one per visible line). The framework converts a `Strip` to Ink JSX by emitting one `<Text>` element per consecutive style run within the Strip's segments:

  ```tsx
  // Conceptual — framework-internal
  function stripToInk(strip: Strip): ReactNode {
    return strip.mergedStyleRuns.map((run, i) => (
      <Text key={i} {...styleToInkProps(run.style)}>{run.text}</Text>
    ));
  }
  ```

  `styleToInkProps` maps a rich-js `Style` to Ink's `<Text>` props:
  - `style.fg` → `color` (via `Color.toAnsi(colorDepth)`)
  - `style.bg` → `backgroundColor`
  - `style.bold` → `bold`
  - `style.italic` → `italic`
  - `style.underline` → `underline`
  - `style.strike` → `strikethrough`
  - `style.dim` → `dimColor`

  This conversion is the single seam between rich-js content and Ink rendering. No widget does its own Strip-to-Ink conversion.

  // [LAW:single-enforcer] Content → Ink conversion is one function. Widgets hand a `Strip` (or a `Content` wrapped in a line) to the framework, which produces Ink JSX. There is no per-widget branching path."

### 3. Output filter pipeline placement

**Where**: New subsection after "Content → Ink Bridge" or in the render flow.
**Current state**: Not discussed in this file.
**Why insufficient**: The output filter pipeline is a framework seam at the Ink→terminal boundary.
**Required change**: Add subsection "Output Filter Pipeline (Ink → Terminal)":
  "After Ink's React reconciler produces the component tree and Yoga lays it out, Ink writes ANSI output to stdout. Before those bytes reach the terminal, the framework's `LineFilter` pipeline (spec 12) transforms the segment stream.

  Filters operate on rich-js `Segment[]` per line. They may strip colors (`Monochrome`), remove ANSI colors while keeping styles (`NoColor`, respecting `NO_COLOR` env), dim all colors (`DimFilter`), or downgrade truecolor to ANSI 16 (`ANSIToTruecolor` reverse, not typical). Filters compose in declaration order via `App.filters`.

  The pipeline runs unconditionally. An empty filter list is a no-op. Environment-driven filters (from `NO_COLOR`) are prepended to the app-configured list at startup."

### 4. useStyles() return shape — align with spec 02 and 09

**Where**: "Framework hooks" table.
**Current state**: "`useStyles()` | `{ box: InkBoxProps, text: InkTextProps }` | TCSS-resolved Ink props".
**Why insufficient**: Return shape is actually four fields — `box`, `text`, `style` (rich-js), `components` (map of component-class → Style).
**Required change**: Update the row:
  "`useStyles()` | `{ box: InkBoxProps, text: InkTextProps, style: richJsStyle, components: Map<string, richJsStyle> }` | Full TCSS-resolved output: Ink props for Box/Text and rich-js Style for content segments (plus component-class styles for Line API widgets)."

### 5. Public integration surfaces — re-exports from rich-js

**Where**: "User-facing types / types and messages" in the public surfaces section.
**Current state**: Lists `Message`, event types, `Binding`, geometry types.
**Why insufficient**: The framework re-exports rich-js types (`Content`, `Style`, `Color`, `Segment`, `Strip`, renderables) as part of its public surface.
**Required change**: Add a row or sub-bullet: "Re-exports from rich-js: `Content`, `StyledText`, `Style`, `Segment`, `Strip`, `Color`, `Bar`, `Gradient`, `Sparkline`, `Digits`, `Tint`, `TextOpacity`, `parseAnsi`, `stripAnsi`, `cellLength`, `columnIndex`, `cellIndex`. These are re-exported unchanged — the framework does not fork or wrap them."

## Do not change

- Context providers table (already good; may want to add a note that StyleContext includes rich-js-aware resolved styles, but not required)
- Framework hooks table (just update useStyles row)
- Layout integration (TCSS-to-Ink mapping, fr resolution, dock, layers)
- Style translation table
- Reactivity bridge section
- Event integration (input translation, message routing)
- Screen stack integration
- Focus integration
- Scroll integration
- Theme integration
- Animation integration
- Testing integration (spec 13 handles detail)
- "Not public" table
