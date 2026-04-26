# Layout and Rendering

## Overview

Layout and rendering are handled by **Ink** (Yoga flexbox) and **React's reconciler**. The framework does not implement its own layout engine, compositor, or terminal renderer. This spec describes the behavioral contracts that the framework layer enforces on top of Ink's layout, and how the TCSS cascade feeds into Ink's rendering pipeline.

// [LAW:single-enforcer] Ink and React own rendering, layout, and tree diffing. The framework layer produces style props and observable state; it does not directly write to the terminal.

## Rendering Modes

Widgets render through one of two modes:

- **Compose mode**: the widget returns a JSX child tree. Ink/Yoga arranges the children directly. This is the default for containers and chrome widgets such as `Button`, `Switch`, and general layout containers.
- **Line API mode**: the widget renders line-by-line. Each visible line is a rich-js `Strip` composed of `Segment`s carrying rich-js `Style`. The framework converts each `Strip` to Ink `<Text>` runs inside a one-line `<Box>`. This mode is used by widgets such as `TextArea`, `Input`, `DataTable`, `Tree`, `OptionList`, `Log`, `RichLog`, and `Markdown`.

See spec 09 for the shared base contract line-based widgets implement.

## Layout Model

Ink provides Yoga flexbox layout via `<Box>` component props. The framework's TCSS engine resolves styles per widget (see spec 04), translates them to Ink layout props, and the widget passes them to `<Box>`:

```tsx
const MyWidget = observer(() => {
  const styles = useStyles();
  return (
    <Box {...styles.box}>
      <Text {...styles.text}>Content</Text>
    </Box>
  );
});
```

Yoga handles all dimension calculation, flex distribution, margin/padding, and alignment. The framework does not second-guess Yoga's results.

### TCSS-to-Ink Layout Mapping

| TCSS property | Ink/Yoga prop | Notes |
|---------------|---------------|-------|
| `width` | `width` | Supports cells, `fr`, `%`, `auto`. `fr` resolved by framework before passing to Ink. |
| `height` | `height` | Same as width |
| `min-width` | `minWidth` | — |
| `max-width` | `maxWidth` | — |
| `min-height` | `minHeight` | — |
| `max-height` | `maxHeight` | — |
| `padding` | `paddingTop/Right/Bottom/Left` | All four sides |
| `margin` | `marginTop/Right/Bottom/Left` | All four sides |
| `border` | `borderStyle`, `borderColor` | Border reserves 1 cell per side |
| `display: none` | `display="none"` | Widget does not render or occupy space |
| `align` | `alignItems`, `justifyContent` | Flex alignment |
| `content-align` | `alignSelf` | Individual widget alignment within parent |

### Flex properties

Ink's `<Box>` supports full Yoga flexbox:

| Ink prop | Description | Default |
|----------|-------------|---------|
| `flexDirection` | `'row'` or `'column'` | `'column'` (vertical stacking) |
| `flexGrow` | How much the widget grows to fill space | `0` |
| `flexShrink` | How much the widget shrinks when space is tight | `1` |
| `flexBasis` | Initial size before flex distribution | `'auto'` |
| `flexWrap` | `'wrap'` or `'nowrap'` | `'nowrap'` |
| `alignItems` | Cross-axis alignment of children | `'stretch'` |
| `justifyContent` | Main-axis alignment of children | `'flex-start'` |
| `alignSelf` | Override parent's `alignItems` for this widget | `'auto'` |

### Fractional units (`fr`)

TCSS supports `fr` units (like CSS Grid). Since Yoga does not natively understand `fr`, the framework resolves `fr` values before passing to Ink:

1. Query the available space (parent's content area minus any fixed-size children).
2. Sum all `fr` values among siblings.
3. Compute each child's pixel (cell) size: `childFr / totalFr * availableSpace`.
4. Pass the computed cell value to Ink as a fixed width/height.

This resolution runs during style application, before React renders. The computed values are stored on `ResolvedStyles` and translated to Ink props.

### Cell-width-aware measurement

All display-width calculations use rich-js `cellLength(text)`, not JavaScript `str.length`. Wide characters (CJK, emoji) count as 2 cells; combining characters count as 0; tabs expand per `indentWidth`; ANSI escape sequences count as 0. This rule applies to content width in `fr` resolution, scrollport width, scroll offset clamping, cursor column tracking, and line-wrap break points.

### Percentage units (`%`)

Percentage values resolve relative to the parent's content area. Ink/Yoga handles `%` natively for width and height — the framework passes the percentage string directly to Ink.

## Layout Strategies

The TCSS `layout` property selects the strategy a container uses to arrange its flow children. Every container resolves to exactly one strategy — there is no "no strategy" state. The framework maps the chosen strategy to Ink/Yoga props (and, where Yoga cannot express the semantics directly, pre-computes placements before passing them to Ink).

// [LAW:one-type-per-behavior] All four strategies are instances of a single `LayoutStrategy` interface (`plan(container, children, styles) -> Placement[]`). They differ only in their placement function, not in the pipeline around them.

| `layout` value | Behavior | Ink/Yoga mapping |
|----------------|----------|------------------|
| `vertical` (default) | Children stack top-to-bottom along the main axis. | `flexDirection="column"` on the container's `<Box>`. |
| `horizontal` | Children flow left-to-right along the main axis. | `flexDirection="row"` on the container's `<Box>`. |
| `grid` | Children are placed into named rows/columns with optional `column-span` / `row-span`. Grid tracks are sized per TCSS `grid-columns` / `grid-rows` (supporting cells, `fr`, `%`, `auto`). | Framework resolves the grid into a two-level `<Box>` tree (rows of row-`<Box>`es containing cell-`<Box>`es) with resolved sizes, because Yoga has no native grid. |
| `stream` | Optimized fast path for long vertical lists of full-width, auto-height children (log views, chat transcripts, scrollable feeds). | `flexDirection="column"` with cached, pre-resolved per-child heights; `fr`, percentage main-axis sizes, absolute positioning, overlay, and layers are ignored inside a stream. |

### Stream semantics

Stream is deliberately narrower than `vertical` to enable caching and avoid per-frame Yoga work on long lists:

- Every child is treated as full cross-axis width. `width`, `min-width`, and cross-axis alignment on children are ignored.
- Main-axis extrema are honored only as `max-height` (and the implied clamp to `min-height: 0`). Other `min-*` / `max-*` values on stream children are ignored for performance.
- `dock`, `overlay: screen`, absolute positioning, and `layers` on stream children are ignored — a stream is a flat list. Docks/overlays declared on the stream container itself still apply at the container boundary.
- Child placements (offset + height) are cached, keyed by container width. A width change invalidates the cache; content changes invalidate only the affected suffix.
- Stream children participate in scrolling via the container's `scrollOffset`; the framework slices the cached placement list against `scrollportSize` before handing Ink the visible range.
- Appropriate for log views, chat transcripts, and long scrollable lists. Inappropriate for heterogeneous layouts that need dock/overlay/layer semantics — use `vertical` there.

### Margin collapse between siblings

In `vertical` and `horizontal` layouts, adjacent flow siblings collapse their adjacent margins (matching CSS block-level margin-collapse semantics). The framework computes collapsed margins before passing them to Ink, because Yoga sums sibling margins by default.

| Layout | Adjacent pair | Collapsed value |
|--------|---------------|-----------------|
| `vertical` | sibling A above B | `max(A.marginBottom, B.marginTop)` — not the sum |
| `horizontal` | sibling A left of B | `max(A.marginRight, B.marginLeft)` — not the sum |

Rules:

- Collapse applies only between flow siblings in the same container. A container's own margin does not collapse with its children's margins.
- `overlay: screen` children are positioned out-of-flow and do not participate in margin collapse — they neither advance the main axis nor consume the collapsed gap between their neighbors.
- Absolutely positioned children (including docked children, which the framework lifts out of flow) do not participate in margin collapse.
- `grid` and `stream` layouts do **not** collapse margins. Grid gaps are governed by `grid-gutter-*`; stream children use their own `margin-top` / `margin-bottom` verbatim (fast path: no pairwise comparison).
- Collapse is resolved during style application: the framework walks the flow-child list, computes the collapsed gap for each adjacent pair, and emits `marginTop: 0` on the second sibling while setting `marginTop: collapsedGap` on it (or equivalently zeroes the first's `marginBottom`). One sibling owns the gap so Yoga sees it exactly once.

// [LAW:single-enforcer] Margin collapse is computed in exactly one place — the layout-strategy planner — before Ink sees any margin values. Downstream code (widgets, Ink, Yoga) never re-derives collapsed margins.

## Dock Behavior

`dock` is a framework layout concern. Yoga does not have a `dock` concept, so the framework implements it by controlling the rendering order and flex configuration:

### How dock works

A docked widget is removed from normal flow and positioned at an edge of its parent:

| Dock value | Effect |
|------------|--------|
| `top` | Widget spans the full width at the top of the parent. Rendered before flow children. |
| `bottom` | Widget spans the full width at the bottom of the parent. Rendered after flow children. |
| `left` | Widget spans the full height at the left edge. Rendered before flow children. |
| `right` | Widget spans the full height at the right edge. Rendered after flow children. |

### Implementation strategy

The screen or container widget that renders docked children wraps them in a layout structure:

```tsx
// Conceptual — framework renders docked children around flow children
<Box flexDirection="column" width="100%" height="100%">
  {/* Top-docked widgets */}
  {dockedTop.map(w => <Box key={w.id} width="100%">{w}</Box>)}

  <Box flexDirection="row" flexGrow={1}>
    {/* Left-docked widgets */}
    {dockedLeft.map(w => <Box key={w.id} height="100%">{w}</Box>)}

    {/* Flow children in remaining space */}
    <Box flexDirection="column" flexGrow={1}>
      {flowChildren}
    </Box>

    {/* Right-docked widgets */}
    {dockedRight.map(w => <Box key={w.id} height="100%">{w}</Box>)}
  </Box>

  {/* Bottom-docked widgets */}
  {dockedBottom.map(w => <Box key={w.id} width="100%">{w}</Box>)}
</Box>
```

- Multiple widgets can dock to the same edge; they stack in DOM order.
- Docked widgets reduce the available space for remaining (flow) children.
- Dock is resolved from TCSS styles during the rendering phase — the `dock` value on `ResolvedStyles` tells the container how to position the child.

## Layers and Ordering

- `layers` property on a container declares named layers in painting order (first = bottom, last = top).
- `layer` property on a child assigns it to a named layer.
- Widgets within a layer are painted in DOM order.
- `overlay: screen` positions a widget above all layers, escaping the parent's layout flow. Used for modals, tooltips, and notification toasts.

Implementation: layers are rendered as stacked `<Box>` elements with `position="absolute"` (Ink supports this). `overlay: screen` renders via a React portal to the App's root overlay container.

## Scroll Behavior

Scrollable widgets (`overflow: scroll | auto`) provide scrolling within their content area.

### Scroll model

| State | Type | Description |
|-------|------|-------------|
| `scrollOffset` | MobX observable `{ x, y }` | Current scroll position |
| `virtualSize` | MobX observable `{ width, height }` | Total scrollable content size |
| `scrollportSize` | derived | Widget's content area minus scrollbar chrome |
| `maxScroll` | derived | `virtualSize - scrollportSize` (clamped to 0) |
| `scrollPercentage` | derived | `scrollOffset / maxScroll` (0–1) |

### Scroll behavior

- Scroll offset changes update the MobX observable → `observer()` triggers re-render → content is rendered at the new offset.
- Scroll is implemented by rendering content in a container with `overflow: hidden` and translating the content position by the scroll offset.
- Virtual size is computed from the content's natural size. When content changes, virtual size is recalculated.
- Scrollbars are rendered as framework widgets (not Ink built-ins) positioned at the right edge (vertical) and bottom edge (horizontal) of the scrollport. Scrollbar chrome is drawn as rich-js `Segment`s using scrollbar block characters (`▔▁▂▃▄▅▆▇█` and full-block variants); segment styles are resolved from the parent widget's `scrollbar-color`, `scrollbar-background`, and active/hover variants.

### Scroll input handling

| Input | Effect |
|-------|--------|
| Mouse wheel up/down | Scroll vertically by `scrollStep` (default: 1 line) |
| Mouse wheel left/right | Scroll horizontally |
| Page Up / Page Down | Scroll by one scrollport height |
| Home / End | Scroll to top / bottom |
| Click on scrollbar track | Scroll to the clicked position |
| Drag scrollbar thumb | Scroll proportionally |

### Anchored scrolling

When `auto_scroll` is enabled on a scrollable widget:
- If the user is scrolled to the bottom (within a threshold), new content additions automatically scroll to keep the bottom visible.
- If the user has scrolled away from the bottom, new content does not auto-scroll (preserving their position).

## Rendering

React's reconciler handles all rendering. The framework's role is to produce the right MobX observable state and let `observer()` drive re-renders.

### Render pipeline

1. **State change**: a MobX observable changes (reactive property, TCSS style recalculation, focus change, scroll offset, etc.).
2. **observer() detection**: `mobx-react-lite`'s `observer()` wrapper detects which observables were read during the last render and re-renders only affected widgets.
3. **Widget render**: the widget's function body runs, calling `useStyles()` for TCSS-resolved Ink props and reading any other MobX observables for content.
4. **Compose mode**: the widget returns a JSX child tree directly.
5. **Line API mode**: the widget produces rich-js `Strip`s (one per visible line). The framework converts each `Strip` to a sequence of Ink `<Text>` elements, one per consecutive style run, wrapped in a `<Box>` representing that line. Each `<Text>` receives Ink color/style props translated from the segment's rich-js `Style`.
6. **Ink diffing**: Ink's React reconciler diffs the component tree against the previous render.
7. **Yoga layout**: Ink runs Yoga layout on the updated tree, computing positions and dimensions.
8. **Terminal output**: Ink writes ANSI escape sequences for changed cells only.

When widget content is a rich-js `Content` built from an ANSI-containing string (via `parseAnsi()`), the embedded styles are preserved in the `Segment` stream. The framework does not double-interpret ANSI: raw ANSI at string level becomes structured rich-js `Style` values first, then Ink re-emits terminal escape sequences from those styles.

### Border titles and subtitles

`BORDER_TITLE` and `BORDER_SUBTITLE` are reactive widget properties with type `string | Content`. At render time, the framework draws the border row so title and subtitle content can be embedded at positions controlled by `border-title-align` and `border-subtitle-align`. The behavioral contract is that the visible border row is a rich-js `Strip` combining border characters and title/subtitle `Content`, even if the implementation uses Ink border props plus an overlay to achieve that result.

### Output filter pipeline

After Ink converts widget JSX to terminal output, the framework's `LineFilter` pipeline (spec 12) post-processes each rendered line at the Ink-to-terminal boundary. Filters operate on the rendered segment stream, not on individual widgets. Built-in filters such as `Monochrome`, `NoColor`, `DimFilter`, and `ANSIToTruecolor` are applied in declaration order. The pipeline is always evaluated; an empty filter list is a no-op.

### What the framework does NOT do

- **No custom compositor**: Ink handles visibility, stacking, and output.
- **No dirty-region tracking**: React's reconciler tracks which components changed.
- **No strip/span-based rendering**: Ink handles line-by-line terminal output.
- **No render cache**: React memoization (`React.memo`, `useMemo`) provides caching where needed.

## Refresh Semantics

The Python Textual concept of `refresh(repaint=True, layout=True)` maps to MobX observable mutations:

| Textual concept | textual-js equivalent |
|----------------|----------------------|
| `refresh(repaint=True)` | MobX observable change → `observer()` triggers re-render |
| `refresh(layout=True)` | Style observable change → Ink/Yoga recomputes layout |
| `refresh(recompose=True)` | MobX observable list change → React re-renders with new children |

MobX's `runInAction` batches multiple changes into a single React render cycle:

```tsx
const { batchUpdate } = useTextual();
batchUpdate(() => {
  // All these changes produce ONE React re-render
  store.title = 'Updated';
  store.count += 1;
  addClass('modified');
});
```

## Widget Content Rendering

### render() equivalent

In Python Textual, `Widget.render()` returns a renderable. In textual-js, the React component's return value IS the render output:

```tsx
// Python Textual:
// def render(self) -> RenderableType:
//     return Text(f"Count: {self.count}")

// textual-js:
const Counter = observer(() => {
  const store = useStore();
  const styles = useStyles();
  return (
    <Box {...styles.box}>
      <Text {...styles.text}>Count: {store.count}</Text>
    </Box>
  );
});
```

### compose() equivalent

In Python Textual, `compose()` yields child widgets. In textual-js, children are JSX:

```tsx
// Python Textual:
// def compose(self) -> ComposeResult:
//     yield Header()
//     yield Container(
//         Button("Save", id="save"),
//         Button("Cancel", id="cancel"),
//     )
//     yield Footer()

// textual-js:
const MyScreen = observer(() => (
  <Screen>
    <Header />
    <Container>
      <Button id="save">Save</Button>
      <Button id="cancel">Cancel</Button>
    </Container>
    <Footer />
  </Screen>
));
```

Dynamic composition (mounting widgets at runtime) uses MobX observable arrays:

```tsx
const DynamicContainer = observer(() => {
  const store = useLocalStore(() => ({
    items: observable<string>([]),
  }));

  return (
    <Box flexDirection="column">
      {store.items.map((item, i) => (
        <Label key={i}>{item}</Label>
      ))}
    </Box>
  );
});

// Adding an item triggers a React re-render that includes the new Label
runInAction(() => store.items.push('New item'));
```

// [LAW:dataflow-not-control-flow] Layout is a fixed transform applied by Yoga: TCSS style values vary the outputs, not the stage order. Every widget goes through the same path: resolve styles → translate to Ink props → Yoga layout → terminal output.
