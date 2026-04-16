# React/Ink Integration Architecture

## Overview

textual-js is built directly on React/Ink. There is no separate "headless core" and "renderer" — React/Ink is the foundation, and the framework layer (TCSS, focus, bindings, screen stack, widgets) sits on top of it.

This spec documents the integration points between the framework and its React/Ink foundation, the internal subsystem boundaries, and the public integration surfaces available to user code.

// [LAW:one-way-deps] The framework depends on React/Ink APIs. React/Ink do not depend on the framework.
// [LAW:single-enforcer] MobX `observer()` is the single bridge between framework state and React rendering. No manual forceUpdate, no custom subscription system.

## Integration Stack

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
│ Observable state,    │ Content, Style, Color,        │
│ observer(),          │ Segment, Strip, markup,       │
│ reaction(), computed │ renderables, cell measurement │
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

Each layer depends only on the layers below it. User code depends on the framework. The framework depends on MobX, rich-js, and React/Ink. MobX and rich-js are peer dependencies under the framework; neither depends on the other.

## Widgets Are React Components

Every textual-js widget is a React function component wrapped in MobX's `observer()`. Widgets render using Ink primitives (`<Box>`, `<Text>`) with TCSS-resolved styles translated to Ink props.

```tsx
const MyWidget = observer(({ id, classes, children }) => {
  const { register, postMessage } = useTextual();
  const styles = useStyles();

  useEffect(() => register({
    id,
    classes,
    typeName: 'MyWidget',
    canFocus: true,
  }), []);

  return (
    <Box {...styles.box} onClick={() => postMessage(new MyWidget.Pressed())}>
      <Text {...styles.text}>{children}</Text>
    </Box>
  );
});

MyWidget.DEFAULT_CSS = `MyWidget { padding: 1 2; }`;
```

React's reconciler handles rendering, diffing, and updates. MobX's `observer()` triggers re-renders when observed state changes. There is no custom compositor, dirty tracking, or strip-based rendering.

## Subsystem Integration Points

Each framework subsystem integrates with React/Ink through specific hooks and context values.

### Context providers

The App component installs a tree of React context providers that expose framework services to all descendants:

| Context | Provides | Consumed by |
|---------|----------|-------------|
| `TextualContext` | Core framework handle (messagePump, widget registry, query) | `useTextual()` |
| `StyleContext` | TCSS engine, resolved styles per widget | `useStyles()` |
| `FocusContext` | FocusManager | `useFocusManager()`, focus chain logic |
| `BindingContext` | Binding resolver, active bindings | `useBindings()`, Footer widget |
| `ScreenContext` | Screen stack, active mode | `useScreen()`, screen-aware widgets |
| `AppContext` | App-level services (theme, notifications, workers, signals, logger) | `useApp()`, most hooks |
| `ParentContext` | Parent widget registration handle | Widget registration (parent chain derivation) |

### Framework hooks

Public hooks that widget authors use:

| Hook | Returns | Purpose |
|------|---------|---------|
| `useTextual()` | `{ register, postMessage, query, queryOne, runAction, log, ... }` | Primary widget API |
| `useStyles()` | `{ box: InkBoxProps, text: InkTextProps, style: Style, components: Map<string, Style> }` | Full TCSS-resolved output: Ink props plus rich-js styles for content segments and component classes |
| `useApp()` | App context (theme, notifications, signals, suspend) | App-level services |
| `useScreen()` | Active screen reference + stack operations | Screen navigation |
| `useWorker(fn, options?)` | `{ worker, start, cancel }` | Managed async tasks |
| `useFocusManager()` | `{ setFocus, focusNext, focusPrevious, focusedWidget }` | Focus control |
| `useBindings()` | `{ activeBindings, bindingChain }` | Binding inspection (Footer) |
| `useTimer(name, delay, callback)` | — | Registered timer with auto-cleanup |
| `useSignal(signal, callback)` | — | Subscribe to a signal with auto-cleanup |

## Layout Integration

Ink provides Yoga flexbox layout via `<Box>` component props. The framework translates TCSS properties to Ink layout props during style resolution (see spec 04 and 05).

Widgets do not position children manually. Ink/Yoga handles all positioning.

TCSS features that require framework layering above Yoga:

| TCSS feature | How it integrates with Ink |
|--------------|----------------------------|
| `fr` units | Framework resolves to cells before passing to Ink (Yoga doesn't understand `fr`) |
| `dock` | Framework wraps docked children in a flex layout structure (see spec 05) |
| `layers` | Framework renders layered widgets as stacked `<Box position="absolute">` |
| `overlay: screen` | Framework uses React portal to the app's root overlay container |
| Pseudo-class selectors | Framework's TCSS cascade updates styles; Ink receives the resolved props |

## Style Translation

The TCSS engine produces resolved styles per widget. These are translated to Ink-compatible props:

| TCSS category | Ink props |
|---------------|-----------|
| Dimensions (`width`, `height`, `min-*`, `max-*`) | `width`, `height`, `minWidth`, `minHeight`, etc. |
| Spacing (`margin`, `padding`) | `marginTop`, `paddingTop`, etc. |
| Border (`border`, `border-color`) | `borderStyle`, `borderColor` |
| Colors (`background`, `color`) | `backgroundColor`, `color` |
| Text (`text-style`, `text-align`) | `bold`, `italic`, `underline`, text alignment |
| Display (`display: none`) | `display="none"` |
| Flex (`align`, `content-align`) | `alignItems`, `justifyContent`, `alignSelf` |

Properties with no direct Ink equivalent (e.g., `dock`, `layers`, `hatch`) are stored on the resolved styles for the framework to interpret.

`useStyles()` returns `{ box, text, style, components }`. `box` and `text` are ready to spread onto Ink primitives; `style` and `components` feed Line API widgets that render rich-js content.

## Reactivity → Re-render Bridge

MobX observables are the bridge between framework state and React rendering. This is the single most important integration point in the framework.

```
Framework state change
      │
      ▼
MobX observable update (inside runInAction)
      │
      ▼
MobX notifies observer() wrappers that read this observable
      │
      ▼
observer() triggers React re-render on affected widgets only
      │
      ▼
Widget function body runs, reads MobX observables (fresh values)
      │
      ▼
Ink's React reconciler diffs the output
      │
      ▼
Ink writes ANSI escape sequences for changed cells
```

### Why this works

| Property | Explanation |
|----------|-------------|
| **Fine-grained** | Only widgets that read the changed observable re-render — not the whole app |
| **Automatic** | No manual `forceUpdate` or subscription management |
| **Batched** | `runInAction` batches multiple mutations into one render cycle |
| **Glitch-free** | MobX's reaction scheduler prevents intermediate inconsistent states |

// [LAW:single-enforcer] `observer()` is the single bridge. Framework state changes never directly call React APIs — they mutate observables and let MobX handle the rest.

## Content → Ink Bridge

Line API widgets produce rich-js `Strip`s, one per visible row. The framework converts a `Strip` to Ink JSX by emitting one `<Text>` element per consecutive style run:

```tsx
// Conceptual — framework-internal
function stripToInk(strip: Strip): ReactNode {
  return strip.mergedStyleRuns.map((run, i) => (
    <Text key={i} {...styleToInkProps(run.style)}>
      {run.text}
    </Text>
  ));
}
```

`styleToInkProps` maps a rich-js `Style` to Ink `<Text>` props:

- `style.fg` → `color` (via `Color.toAnsi(colorDepth)`)
- `style.bg` → `backgroundColor`
- `style.bold` → `bold`
- `style.italic` → `italic`
- `style.underline` → `underline`
- `style.strike` → `strikethrough`
- `style.dim` → `dimColor`

This is the single seam between rich-js content and Ink rendering. No widget performs its own `Strip`-to-Ink conversion.

// [LAW:single-enforcer] Content → Ink conversion is centralized in one bridge function. Widgets hand the framework `Strip` or `Content` values; the framework produces Ink JSX.

## Output Filter Pipeline (Ink → Terminal)

After Ink's reconciler produces the component tree and Yoga lays it out, Ink prepares ANSI output for stdout. Before those bytes reach the terminal, the framework's `LineFilter` pipeline transforms the per-line rich-js `Segment[]` stream.

Filters operate on rendered segments rather than on widgets. They may strip colors (`Monochrome`), remove color while preserving bold/italic (`NoColor`), dim styles (`DimFilter`), or normalize color output. Filters compose in declaration order through `App.filters`, and environment-driven filters such as `NO_COLOR` are prepended during app startup. The pipeline always runs; an empty filter list is a no-op.

## Event Integration

Ink receives terminal input and delivers it via `useInput()` and mouse event handlers. The framework translates these into framework messages and routes them through the message system.

### Input translation (Ink → framework)

| Ink source | Framework translation |
|-----------|----------------------|
| `useInput((input, key) => ...)` | Translated to `Key` messages with canonical key names |
| Mouse event handlers | Translated to `MouseDown`/`MouseUp`/`MouseMove`/`Click` messages |
| `useStdout().columns/rows` change | `Resize` message with new dimensions |

### Message routing (framework)

- Key events: priority binding check → focused widget → bubble up checking non-priority bindings
- Mouse events: routed to target widget via hit-testing
- Resize events: trigger layout recomputation (Ink handles this natively, framework posts message for subscribers)

The framework owns event routing, bubbling, and handler resolution. Ink owns terminal input parsing.

## Screen Stack Integration

The `TextualApp` component conditionally renders based on the active screen:

```tsx
// Conceptual — inside TextualApp
const TextualApp = observer(({ children }) => {
  const { activeStack } = useScreen();

  return (
    <>
      {activeStack.map((screen, i) => (
        <Box
          key={screen.id}
          display={i === activeStack.length - 1 ? 'flex' : 'none'}
          flexDirection="column"
          width="100%"
          height="100%"
        >
          {screen.component}
        </Box>
      ))}
      <OverlayContainer />
    </>
  );
});
```

- Each screen in the stack is rendered, but only the topmost is visible (`display="flex"` vs `display="none"`).
- Background screens retain their React state (hooks, MobX observables) — pushing and popping does not re-initialize them.
- Modal screens render with the previous screen visible underneath (different display logic).
- `OverlayContainer` is a React portal target for `overlay: screen` widgets (notifications, tooltips).

## Focus Integration

The framework extends Ink's basic focus model with the focus chain, focus groups, and pseudo-class integration.

| Framework concern | Ink support | Framework addition |
|-------------------|------------|---------------------|
| Focus state | `useFocus()` hook | MobX observable per widget, integrated with `:focus` pseudo-class |
| Tab navigation | `useFocusManager().focusNext()` | Framework focus chain (considers `canFocus`, `disabled`, `display`) |
| Focus trap (modals) | — | Framework truncates chain at modal boundary |
| Auto-focus | — | `AUTO_FOCUS` selector resolved on screen mount |

Ink's `useFocus()` tracks focus at the component level. The framework maintains its own focus manager (MobX store) that:
- Decides which widget should receive focus based on the focus chain.
- Toggles the `:focus` pseudo-class on focus change.
- Posts `Focus`/`Blur` messages to widgets.
- Bubbles `DescendantFocus`/`DescendantBlur` to ancestors.

The framework's focus manager drives Ink's focus, not the other way around.

## Scroll Integration

Scrollable widgets manage scroll state as MobX observables.

| State | Type | Description |
|-------|------|-------------|
| `scrollOffset` | observable `Offset` | Current scroll position |
| `virtualSize` | observable `Size` | Total scrollable content size |
| `showVerticalScrollbar` | observable `boolean` | Whether vertical scrollbar is rendered |
| `showHorizontalScrollbar` | observable `boolean` | Whether horizontal scrollbar is rendered |

Scroll flow:

1. Scroll input (wheel, keys, scrollbar click) triggers a scroll API call (`scrollTo`, `scrollBy`, etc.).
2. The call updates `scrollOffset` inside a `runInAction`.
3. `observer()` re-renders the scrollable widget with the new offset.
4. Content is rendered with a translation based on the offset (implemented via Ink `<Box>` positioning).

Scrollbars are rendered as framework widgets positioned at the edges of the scrollable area.

## Theme Integration

Themes integrate through the TCSS cascade:

1. `App.theme` is a MobX observable.
2. Changing the theme triggers `setVariables` on the TCSS stylesheet (clears parse cache).
3. Next TCSS resolution uses the new theme's CSS variables.
4. All widgets with theme-dependent styles re-render automatically (observables updated → observer() re-runs).

`theme_changed_signal` is published for subscribers that need explicit notification (rather than just re-rendering on the observable change).

## Animation Integration

The Animator integrates via MobX observables and Ink's render loop.

| Step | Mechanism |
|------|-----------|
| Start animation | `animate(widget, property, target, duration)` creates animation entry |
| Animation tick | `setInterval` callback computes interpolated value, updates observable in `runInAction` |
| Render | `observer()` picks up observable change, React re-renders, Ink renders to terminal |
| Complete | Final value set, entry removed, `onComplete` scheduled via `callLater` |

Animation runs at approximately 60fps via `setInterval`. Each tick batches all active animations into a single `runInAction` for glitch-free rendering.

## Testing Integration

`ink-testing-library` provides the test rendering environment. The framework's `runTest()` uses it to render apps and returns a `Pilot` for programmatic interaction.

See spec 13 for the full test harness API.

## Public Integration Surfaces

These are the stable APIs that user code may depend on:

### User-facing component API

| Export | Description |
|--------|-------------|
| `<TextualApp>` | Root application component |
| `<Screen>` | Screen container component |
| Built-in widgets | `<Button>`, `<Input>`, `<DataTable>`, etc. (see spec 10) |

### User-facing hooks

| Hook | Use case |
|------|----------|
| `useTextual()` | Connect a custom widget to the framework |
| `useStyles()` | Apply TCSS-resolved styles to Ink components |
| `useWorker()` | Managed async task |
| `useFocusManager()` | Programmatic focus control |

### Re-exported rich-js surface

The framework re-exports rich-js types and helpers unchanged as part of its public integration surface:

- `Content`, `StyledText`, `Style`, `Segment`, `Strip`, `Color`
- Renderables: `Bar`, `Gradient`, `LinearGradient`, `VerticalGradient`, `Sparkline`, `Digits`, `Tint`, `TextOpacity`
- Helpers: `parseAnsi`, `stripAnsi`, `cellLength`, `columnIndex`, `cellIndex`

### User-facing conventions

| Convention | Purpose |
|-----------|---------|
| `<WidgetName>.DEFAULT_CSS` | Default TCSS for a widget type |
| `<WidgetName>.BINDINGS` | Key bindings for a widget type |
| `<WidgetName>.canFocus` | Whether the widget can receive focus |
| Handler methods: `onMessage`, `action_<name>`, `validate_<name>`, `watch_<name>`, `compute_<name>` | Convention-based method discovery |

### Not public

| Internal | Reason |
|----------|--------|
| MobX stores (FocusManager, ScreenStack, etc.) | Access via hooks only |
| Widget registry | Access via query API |
| TCSS AST | Framework internal |
| Message pump internals | Widgets post/handle messages; dispatch is framework-owned |

// [LAW:one-way-deps] Framework internals (stores, registry, AST, pump) are not part of the public surface. Extensions happen through documented hooks, conventions, and public components.
