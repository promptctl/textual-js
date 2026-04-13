# Renderer Integration Seams

This spec defines the API boundaries between textual-js (headless widget
framework) and external renderers. The first renderer is textual-js-ink
(React/Ink), where every Textual widget is a React component. A traditional
compositor-based renderer (direct terminal output, like Python Textual) will
be added later as a second backend.

textual-js MUST NOT import from any renderer package. The renderer depends on
textual-js, never the reverse.

// [LAW:one-way-deps] textual-js → rich-js. Renderer → textual-js + rich-js.
// No back-edges.

---

## Design Principle: Widgets Are React Components

In textual-js-ink, each Textual widget maps to a React component. The
renderer does not receive a pre-composed screen buffer. Instead, it builds a
React component tree that mirrors the textual-js widget tree, where each
component:

1. Reads its placement from textual-js's layout engine
2. Reads its computed styles from textual-js's TCSS engine
3. Calls `widget.render()` to get rich-js `Renderable` content
4. Renders as a positioned Ink `<Box>` with styled content

This means Ink's React reconciler does real work — granular updates, React
DevTools, component-level re-renders. The compositor (z-ordering, clipping,
dirty tracking) lives in the React rendering layer, not in textual-js.

```
textual-js (headless)              textual-js-ink (React renderer)
─────────────────────              ────────────────────────────────
Widget tree                   →    React component tree
TCSS engine → ComputedStyles  →    Box props + style application
Layout engine → Placements    →    Absolute positioning in <Box>
widget.render() → Renderable  →    renderToString() → <Text>
Message pump ← events         ←    useInput / mouse handlers
Screen stack                  →    Conditional rendering
Reactivity → refresh()        →    React state updates → re-render
```

---

## What textual-js Owns (Headless Core)

textual-js is a headless widget framework. It has no terminal I/O, no
render loop, and no compositor. It provides:

### Widget tree and lifecycle

```ts
abstract class Widget extends DOMNode {
  // Identity
  readonly id: string | undefined;
  readonly cssClasses: Set<string>;
  readonly cssTypeName: string;

  // Tree
  readonly parent: Widget | null;
  readonly children: ReadonlyArray<Widget>;

  // Lifecycle
  compose(): Iterable<Widget>;
  mount(...widgets: Widget[]): void;
  remove(): void;

  // Content — returns what this widget displays.
  // The renderer decides HOW to display it.
  render(): Renderable;

  // Styles — computed by the TCSS engine, read by the renderer.
  readonly styles: ComputedStyles;

  // Scroll state
  scrollOffset: Offset;
  virtualSize: Size;

  // Focus
  readonly canFocus: boolean;
  readonly hasFocus: boolean;

  // Signals the framework that this widget needs visual update.
  // The renderer observes this and re-renders the corresponding component.
  refresh(options?: { repaint?: boolean; layout?: boolean }): void;
}
```

### TCSS engine

Parsing, selectors, cascade, specificity, `!important`, variables, themes.
Produces `ComputedStyles` per widget. The renderer reads these — it never
parses TCSS or resolves specificity.

### Layout engine

Produces `WidgetPlacement[]` per container. The renderer positions its
components according to these placements.

```ts
interface WidgetPlacement {
  widget: Widget;
  region: Region;       // { x, y, width, height } in character cells
  order: number;        // painting z-order (back-to-front)
  fixed: boolean;       // exempt from scrolling (docked/split widgets)
  overlay: boolean;     // escapes parent clip (modals, tooltips)
}

interface LayoutStrategy {
  arrange(
    parent: Widget,
    children: Widget[],
    size: Size,
    greedy: boolean,
  ): WidgetPlacement[];
}
```

Layout strategies: `VerticalLayout`, `HorizontalLayout`, `GridLayout`,
`StreamLayout`. The global arrange pipeline (layers → splits → docks →
strategy → alignment → absolute positioning) runs above the strategies.

The renderer calls `widget.arrange(size)` — never layout strategies directly.

### Reactivity

Reactive attributes, watchers, validators, computes, data binding. When a
reactive changes, `widget.refresh()` fires. The renderer observes refresh
signals to trigger React re-renders.

### Message system

`MessagePump`, typed messages, dispatch, bubbling, handler resolution. The
renderer posts platform events (key, mouse, resize) into the message pump.
textual-js routes them to the correct widget.

### Screen stack

`push_screen`, `pop_screen`, `switch_screen`, modes, modal behavior. The
renderer observes the active screen to know which component tree to render.

### Animation

The `Animator` interpolates style transitions over time, updating
`widget.styles` and calling `widget.refresh()` each frame. The renderer
just re-renders when refresh fires — it doesn't need to know about
animation.

### Focus management

Focus chain, `set_focus`, `focus_next`/`focus_previous`, binding chain
construction. The renderer reads `widget.hasFocus` for visual focus
indicators and may use Ink's `useFocus` to integrate with Ink's focus
system if appropriate.

---

## What textual-js Does NOT Own

These live in the renderer, not in textual-js:

- **Compositor / composition** — z-ordering rendered widgets, clipping
  scroll viewports, merging overlapping regions. In textual-js-ink, React's
  reconciler and Ink's rendering handle this.
- **Dirty tracking** — React handles granular updates. When
  `widget.refresh()` fires, the corresponding React component re-renders.
- **Strip/line caching** — `_styles_cache` from Python Textual is not
  needed. React's reconciler handles caching via virtual DOM diffing.
- **Terminal I/O** — raw mode, alternate screen, mouse protocol, ANSI
  output. Ink owns this.
- **Border/padding chrome rendering** — the renderer draws borders and
  applies padding based on `widget.styles`. textual-js computes the styles;
  the renderer draws them.

---

## Seam 1: Layout

### textual-js provides

`widget.arrange(size) → ArrangeResult` — the full placement pipeline.

### Renderer consumes

Placements tell the renderer where to position each widget component.

```tsx
// textual-js-ink: each widget is a <Box> positioned by its placement
function WidgetComponent({ widget, placement }: Props) {
  const content = useWidgetContent(widget);
  const boxStyles = useComputedBoxStyles(widget);

  return (
    <Box
      position="absolute"
      left={placement.region.x}
      top={placement.region.y}
      width={placement.region.width}
      height={placement.region.height}
      {...boxStyles}
    >
      <Text>{content}</Text>
    </Box>
  );
}
```

### Renderer MUST NOT

- Call layout strategies directly. Always go through `widget.arrange()`.
- Interpret TCSS layout properties (`grid-size`, `dock`, etc.). The layout
  engine handles those.
- Use Yoga/flexbox as an alternative to textual-js's layout for widget
  positioning. Ink's `<Box>` uses absolute positioning from placements.
  Yoga is NOT used for Textual widget layout.

---

## Seam 2: Styles

### textual-js provides

`widget.styles: ComputedStyles` — the merged result of TCSS cascade +
inline styles.

### Renderer consumes

The renderer translates `ComputedStyles` into visual presentation:

```ts
function useComputedBoxStyles(widget: Widget) {
  const s = widget.styles;
  return {
    // Border → box-drawing characters
    borderStyle: s.border,
    borderColor: s.border.color,

    // Padding → inset
    paddingTop: s.padding.top,
    paddingRight: s.padding.right,
    paddingBottom: s.padding.bottom,
    paddingLeft: s.padding.left,

    // Visual
    opacity: s.opacity,
    // ... etc
  };
}
```

Color, background, text style, opacity, tint → applied to content rendering.
Border/outline → drawn as box-drawing characters.
Scrollbar theming → applied to renderer-managed scrollbar components.

### Renderer MUST NOT

- Parse TCSS. Style computation is textual-js's job.
- Resolve scalar units (`fr`, `%`, `vw`). The layout engine does this.

---

## Seam 3: Widget Content

### textual-js provides

`widget.render() → Renderable` — a rich-js renderable representing the
widget's content (text, table, tree, etc.).

### Renderer consumes

The renderer serializes the renderable to visual output. In textual-js-ink,
this means `renderToString()` from rich-js-ink (or directly via rich-js's
segment pipeline).

```ts
function useWidgetContent(widget: Widget): string {
  const renderable = widget.render();
  const { width, height } = widget.contentSize;
  return renderToString(renderable, { width });
}
```

### Renderer MUST NOT

- Call `widget.render()` and cache the result independently of React's
  lifecycle. React's re-render cycle is the cache.

---

## Seam 4: Refresh / Re-render Bridge

This is the critical integration point between textual-js's reactivity and
React's rendering.

### textual-js provides

`widget.refresh()` — signals that a widget needs visual update. This fires
when:
- A reactive attribute changes
- Styles are recomputed
- Layout changes
- User code calls `refresh()` explicitly

### Renderer implements

The renderer subscribes to refresh signals and triggers React re-renders:

```ts
// Conceptual — the renderer bridges textual-js refresh to React state
function useWidgetRefresh(widget: Widget) {
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    const unsub = widget.onRefresh(() => forceUpdate());
    return unsub;
  }, [widget]);
}
```

textual-js needs to expose a subscription mechanism on `Widget.refresh()`.
This is the primary seam — the hook point where the headless framework
meets the renderer.

```ts
// textual-js exposes:
class Widget {
  // Called by the framework when this widget needs re-render.
  // Renderer subscribes to this.
  onRefresh(callback: () => void): () => void;  // returns unsubscribe

  // Called by the framework when layout changed for this container.
  onLayoutChange(callback: () => void): () => void;
}
```

---

## Seam 5: Events

### textual-js provides

`MessagePump` — the event dispatch system. `postMessage()` is the
ingress for external events.

### Renderer provides

The renderer translates platform input into textual-js events:

```ts
// In textual-js-ink, Ink's useInput drives keyboard events
useInput((input, key) => {
  app.postMessage(new KeyEvent({ key: input, ...key }));
});

// Mouse events from Ink's mouse handling
app.postMessage(new MouseEvent({ x, y, button }));

// Resize from Ink's useWindowSize
app.postMessage(new ResizeEvent({ width, height }));
```

### Renderer MUST NOT

- Implement event bubbling. textual-js's `MessagePump` handles dispatch.
- Route events to specific widgets. textual-js's `Screen._forward_event`
  handles hit-testing using layout placements.

---

## Seam 6: Screen Stack

### textual-js provides

```ts
app.screenStack: ReadonlyArray<Screen>;
app.activeScreen: Screen;
```

Plus `ScreenMount`/`ScreenUnmount` messages.

### Renderer consumes

The renderer conditionally renders based on the active screen:

```tsx
function AppShell({ app }: { app: App }) {
  const screen = useActiveScreen(app);
  return <ScreenComponent screen={screen} />;
}
```

Modal screens render on top of the previous screen. Non-modal background
screens may or may not render depending on the renderer's capabilities.

---

## Seam 7: Scrolling

### textual-js provides

```ts
widget.scrollOffset: Offset;    // current scroll position
widget.virtualSize: Size;       // total scrollable content size
widget.size: Size;              // visible viewport size
```

Scroll state is reactive — changes trigger `widget.refresh()`.

### Renderer consumes

The renderer uses scroll offset to translate child positions within a
scrollable container:

```tsx
function ScrollableWidget({ widget }: Props) {
  const { scrollOffset, virtualSize } = widget;
  // Children are offset by -scrollOffset within the viewport
  // Clipping is handled by the renderer (overflow: hidden on the container)
}
```

### Renderer provides

Scroll input events (wheel, scroll gestures) are posted as textual-js
events. textual-js's scroll handling updates `scrollOffset`, which triggers
refresh, which triggers React re-render.

---

## Seam 8: Focus

### textual-js provides

```ts
widget.hasFocus: boolean;
widget.canFocus: boolean;
screen.focusedWidget: Widget | null;
screen.focusNext(): void;
screen.focusPrevious(): void;
```

### Renderer consumes

The renderer reads focus state for visual indicators (focus ring, cursor
position). It may also integrate with Ink's focus system for tab
navigation, bridging Ink's `useFocus` to textual-js's `screen.setFocus()`.

---

## Seam 9: Composition / Z-ordering

In the React renderer model, composition is the renderer's responsibility.

### textual-js provides

`WidgetPlacement.order` — the painting z-order for each widget.

### Renderer implements

The renderer sorts children by `order` and renders them back-to-front.
In React, this means rendering in order within a container, with later
elements painting over earlier ones (CSS `position: absolute` stacking).

For overlays (modals, tooltips), the renderer uses `overlay: true` from
the placement to render the widget outside its parent's clipping boundary
— typically via a portal or a top-level overlay container.

For clipping (scroll viewports), the renderer applies `overflow: hidden`
on scrollable container components.

---

## Seam 10: Border and Chrome Rendering

### textual-js provides

`widget.styles.border` — per-side border type and color.
`widget.styles.padding` — per-side padding.
`widget.borderTitle` / `widget.borderSubtitle` — optional title text.

### Renderer implements

The renderer draws borders using rich-js `Box` characters and positions
content within the padding inset. This is renderer work because different
renderers may draw borders differently (e.g., box-drawing characters for
terminal, HTML/CSS borders for a web renderer).

---

## Summary: What Lives Where

| Concern | textual-js (headless) | Renderer (textual-js-ink) |
|---|---|---|
| Widget tree + lifecycle | owns | mirrors as React components |
| TCSS parsing + cascade | owns | — |
| Style computation | owns | reads `widget.styles` |
| Layout algorithms | owns | reads placements |
| Grid cell-map | owns | — |
| Compositor / z-ordering | — | owns (React rendering order) |
| Clipping / overflow | — | owns (`overflow: hidden`) |
| Dirty tracking | signals via `refresh()` | React reconciler |
| Border/chrome rendering | provides specs | draws characters |
| Scroll state | owns | reads offsets, posts scroll events |
| Event dispatch + bubbling | owns | posts platform events |
| Screen stack | owns | conditional rendering |
| Animation | owns (Animator) | re-renders on refresh |
| Focus management | owns | reads state, bridges to Ink focus |
| Reactivity | owns | subscribes to refresh signals |
| Terminal I/O | — | owns (Ink) |
| Raw mode / alt screen | — | owns (Ink) |
| Mouse protocol | — | owns (Ink) |
| Keyboard input | — | translates to textual-js events |
| Resize detection | — | posts resize events |

---

## Future: Traditional Compositor Renderer

After textual-js-ink validates the seam design, a second renderer
(textual-js-terminal or similar) can be added that works like Python
Textual:

- Owns a compositor that takes placements + rendered content → strips
- Owns dirty region tracking and incremental updates
- Writes directly to stdout via ANSI escape sequences
- No React, no Ink — pure terminal output

This renderer uses the exact same textual-js APIs (widget tree, styles,
placements, refresh signals, events). The seam interfaces are
renderer-agnostic by design.

```
textual-js (headless core)
├── textual-js-ink        (React/Ink renderer — widgets as components)
└── textual-js-terminal   (compositor renderer — strips to stdout)
```

Both renderers consume the same headless core. The seam proves itself when
the second renderer works without changes to textual-js.
