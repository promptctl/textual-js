# Textual-JS Specification: Overview and Scope

This specification set defines the behavioral contract for the textual-js framework — a rich-text terminal UI application framework built as a React component library on Ink.

## Source of Truth

- These spec files define intended behavior, not implementation.
- Implementation uses **React** + **Ink** for the component tree and terminal output, **Yoga** (via Ink) for layout, **MobX** for reactive state, **rich-js** for rich-text content / markup / renderables / cell measurement, **css-tree** for TCSS parsing, **uFuzzy** for command-palette search, **marked** for markdown parsing, and **Shiki** for syntax highlighting. The specs describe *what* the framework does, not *how* those libraries are used internally.

// [LAW:one-source-of-truth] These specs are the sole authority for intended behavior.

## Foundation Libraries

The framework is built on these libraries rather than reimplementing their concerns:

| Library | Role | What it replaces |
|---------|------|-----------------|
| **React** | Component model, tree reconciliation, rendering lifecycle | Custom DOMNode/NodeList tree management, manual refresh scheduling |
| **Ink** | Terminal rendering (ANSI), Yoga flexbox layout, stdin handling | Custom layout engine, compositor, driver, terminal I/O |
| **MobX** | Reactive state, dependency tracking, computed values, interceptors | Custom reactive descriptors, manual refresh propagation |
| **rich-js** | Rich text markup parsing, `Content`/`StyledText`/`Style`/`Segment` primitives, renderables (`Bar`, `Gradient`, `Sparkline`, etc.), color type (parse, blend, HSL/Lab conversion, contrast), wide-character-aware cell measurement | Custom markup parser, styled-content primitives, renderable library, cell-length helpers, Color type |
| **css-tree** | CSS tokenization, parsing, selector matching, specificity | Custom TCSS parser |
| **uFuzzy** | Fuzzy string matching for command palette search | Custom fuzzy matcher |
| **marked** | Markdown parsing to AST | Custom markdown parser |
| **Shiki** | Syntax highlighting via TextMate grammars | Custom syntax/highlighting system |

### What Ink provides

Ink is a React renderer for the terminal. It provides:

- **Yoga flexbox layout**: `<Box>` with `flexDirection`, `width`, `height`, `padding`, `margin`, `alignItems`, `justifyContent`, `flexGrow`, `flexShrink`, `flexBasis`, `minWidth`, `maxWidth`, etc.
- **Text rendering**: `<Text>` with a *single* set of style attributes (`color`, `backgroundColor`, `bold`, `italic`, `underline`, `strikethrough`, `dimColor`, `wrap`). Multi-style content within a single block is expressed by composing multiple `<Text>` elements — Ink does not parse markup.
- **Terminal I/O**: raw mode stdin/stdout, ANSI escape output, alternate screen buffer.
- **Input handling**: `useInput()` hook delivers key and mouse events with basic key name normalization.
- **Focus**: basic `useFocus()` hook for tab-order focus. The framework extends this with a richer focus chain.
- **Measurements**: `measureElement()` for getting rendered dimensions.
- **Testing**: `ink-testing-library` for rendering components in tests without a terminal.

### What rich-js provides

rich-js is the framework's rich-text authority. It provides what Ink does not:

- **`Content` / `StyledText`**: immutable styled-text value type with spans. The lingua franca between widget render code and final Ink output.
- **Markup parsing**: the `[bold red]...[/]` markup dialect. Widgets that accept markup strings (`Static`, `Label`, `Button` labels, `RichLog`, etc.) parse them with rich-js.
- **`Style`**: composable text styling (fg, bg, bold, italic, underline, reverse, blink, strike, link). Styles can be merged and diffed — essential for selection/cursor/bracket overlays on top of syntax-highlighted content.
- **`Segment`**: `(text, style)` tuple used when streaming a line of rendered content to Ink.
- **Renderables**: `Bar`, `Blank`, `Gradient`, `VerticalGradient`, `LinearGradient`, `Sparkline`, `Digits`, `Tint`, `TextOpacity` — composable visual primitives consumed by widgets like `ProgressBar`, `Sparkline`, `Header`.
- **`Color`**: canonical color value (RGB/A, HSL, HSV, Lab conversions, blend, parse, contrast, luminance, alpha compositing). Shared by CSS, TCSS themes, renderables, and filters — one color type for the whole stack.
- **Cell measurement**: `cellLength`, `columnIndex`, `cellIndex` — wide-character-aware measurement that correctly handles CJK (2 cells), emoji, combining characters (0 cells), tabs, and ANSI escapes (0 cells). Required by every layout/wrap/cursor calculation.
- **`Strip`**: immutable rendered-line primitive used by line-based widgets (TextArea, DataTable, Tree, OptionList, Log, RichLog) that manage their own per-line rendering.

### What the framework builds (not provided by any library)

- TCSS styling with cascade, specificity, selectors, pseudo-classes, and CSS variables (on top of css-tree)
- Screen stack with push/pop/switch and per-mode stacks
- Key binding system with action dispatch, keymap overrides, and namespace resolution
- Focus management with focus chains, focus groups, and disabled-state gating
- Command palette with async providers and fuzzy search (uFuzzy integration)
- Widget catalog (40+ interactive components)
- Message system with bubbling, coalescing, and convention-based handler resolution
- Notifications, themes, validation, suggestions
- Worker lifecycle management
- Text editing subsystem (Document model, Navigator, EditHistory, WrappedDocument)
- Animation system with CSS transitions
- Maximize/minimize, text selection, tooltips, loading overlays
- TCSS-driven border titles/subtitles, scrollbars, and chrome widgets

## Package Surface

The root module exports:

### Components

- `App` — root component, process coordinator, provides framework context
- `Screen` — view container, owns focus chain, composable via JSX
- Widget catalog: `Button`, `Input`, `TextArea`, `DataTable`, `Tree`, `Select`, `ListView`, `TabbedContent`, `Markdown`, etc.

### Hooks

- `useTextual()` — connects a widget to the framework context (registration, message dispatch, query API)
- `useStyles()` — returns the widget's TCSS-resolved styles translated to Ink props and a rich-js `Style`
- `useWorker(asyncFn, options?)` — creates a managed async task with lifecycle tracking
- `useFocusManager()` — access to focus chain navigation (focusNext, focusPrevious, setFocus)
- `useBindings()` — access to active bindings for the current focus context

### Conventions and decorators

- `on` — message-handler convention for selector-filtered event handling
- `work` — worker convention for managed async tasks
- `reactive(defaultValue, options?)` — creates a MobX-backed reactive property with validate/watch/compute conventions

### Types and messages

- `Message` — base class for all framework messages
- Event types: `Key`, `Click`, `MouseDown`, `MouseUp`, `MouseMove`, `ScrollEvent`, `Resize`, `Compose`, `Mount`, `Unmount`, `Focus`, `Blur`, `Idle`, `Paste`, `TextSelected`, ...
- `Binding` — key-to-action mapping declaration
- Re-exports from rich-js: `Content`, `Style`, `Segment`, `Strip`, `Color`, renderables (`Bar`, `Gradient`, `Sparkline`, ...) — the content vocabulary widgets produce and consume
- Geometry: `Size`, `Offset`, `Region`, `Spacing` — immutable value types

### Logging

- A framework logger is available to all widgets via context
- Log output is directed to a configurable sink (file, devtools connection, or console)
- When no sink is configured, structured log traffic is dropped
- Logger errors are caught and do not crash the application

The package-level contract is intentionally narrow: the root module provides convenience exports, while subsystem behavior lives in dedicated modules.

## Architectural Topology

The framework is layered as follows:

1. **App** is the root React component and process coordinator. It renders `<TextualProvider>` which provides framework context (MobX stores, services) to all descendants via React context.
2. **Screen** instances represent active/background view stacks per mode. Each screen owns its focus chain and is a React component rendered by the App.
3. **Widget** instances implement visual/interactive behavior as React function components wrapped in MobX `observer()`. Widgets produce styled content (rich-js `Content`) that the framework converts to Ink output.

### The widget tree is the React component tree

There is no separate DOM abstraction. React owns tree structure, reconciliation, and rendering. The framework layers onto the React tree:

- **Widget registry**: each widget registers on mount and deregisters on unmount (via `useEffect`). Registration includes CSS identity (id, classes, typeName) and a parent reference. The registry enables CSS selector matching and the query API without maintaining a parallel tree.
- **Message dispatch**: messages bubble upward through registered parent references, not through React's synthetic event system. React events and framework messages are separate systems — React events come from Ink (terminal input), framework messages are the Textual message protocol.
- **TCSS cascade**: resolved styles are MobX observables per widget. When the cascade recomputes (due to class change, theme change, or pseudo-class change), the observable updates, `observer()` triggers a re-render, and the widget receives new Ink props and a new rich-js `Style`.

// [LAW:one-source-of-truth] The widget registry is the sole index of "what widgets exist and their CSS identity." React owns the tree structure. The registry indexes it for framework queries.

### Two rendering modes for widgets

Widgets render in one of two modes. Every built-in widget uses one or the other; custom widgets choose whichever suits their content.

**1. Compose mode** — the widget is a container whose content is a tree of child widgets declared as JSX:

```tsx
<Container>
  <Header />
  <Button>Save</Button>
</Container>
```

Ink's React reconciler arranges children via Yoga. The widget itself produces no direct terminal output; its children do.

**2. Line API mode** — the widget produces styled content directly and renders it line-by-line. Used by `Input`, `TextArea`, `DataTable`, `Tree`, `OptionList`, `Log`, `RichLog`, `Markdown`, and similar widgets that manage their own content rather than composing children. Each line is a rich-js `Strip` (or equivalent) built from `Segment`s with `Style`s, written to Ink as `<Text>` elements.

The Line API is how cursor/selection/bracket overlays, syntax-highlighted code, table cells, and markdown blocks survive without a thousand tiny `<Text>` elements in the React tree.

### Widget implementation pattern

Every widget follows this pattern:

1. It is a React function component wrapped in `observer()` from mobx-react-lite.
2. It calls `useTextual()` to connect to the framework (registration, message dispatch, query).
3. It calls `useStyles()` to get TCSS-resolved styles (both Ink props for the outer `<Box>` and a rich-js `Style` for its content).
4. It builds its content:
   - **Compose mode**: declares child widgets as JSX.
   - **Line API mode**: produces rich-js `Content` / `Strip`s that the framework renders to `<Text>` elements.
5. Static properties declare framework behavior: `DEFAULT_CSS`, `BINDINGS`, `canFocus`, `canFocusChildren`, `COMPONENT_CLASSES`.

### How compose() works in React

In Python Textual, `compose()` yields child widgets. In textual-js, widget composition is JSX:

- Widgets that declare their own child structure do so by rendering JSX children in their React render function.
- The `App` component's children (or its `compose()` return) are the initial widget tree.
- Dynamic composition (mounting widgets at runtime) uses React state: adding a widget to a MobX observable list triggers a re-render that includes the new widget in JSX.

### Supporting systems

- **Reactive state**: MobX observables with `intercept()` for validation, `observe()` for watchers, `computed` for derived values. `observer()` from mobx-react-lite triggers React re-renders automatically.
- **Styling**: TCSS parsed by css-tree, cascade resolves styles per widget, output translated to Ink `<Box>`/`<Text>` props and to a rich-js `Style` for content rendering. TCSS is an authoring and cascade layer — the output is "what props/styles should this widget have."
- **Rich content**: rich-js is the authority for styled-content values (`Content`), markup parsing, renderables, and cell measurement. Text-oriented widget surfaces normalize to `Content`; visual-bearing surfaces normalize to a broader visual/renderable contract built on rich-js. Widget render output that is not a child-widget tree is never a raw string by the time it reaches the render boundary.
- **Layout and rendering**: Ink handles layout via Yoga flexbox. React handles rendering and diffing. The framework does not implement a layout engine or compositor.
- **Input and actions**: Ink handles terminal input via `useInput()`. The framework provides binding resolution (focused widget → ancestors → screen → app) and action dispatch (`action_<name>` method resolution).
- **Concurrency**: workers (managed async tasks with AbortController cancellation), timers (named, pausable), signals (typed pub/sub backed by MobX observables).

## Primary Runtime Flows

### Startup and lifecycle flow

1. App component mounts via React/Ink. Framework context initializes: MobX stores for screen stack, focus manager, binding resolver, notification store, theme engine, worker manager, signal registry.
2. CSS sources are aggregated: `DEFAULT_CSS` from all registered widget types, app-level `CSS`, user-provided stylesheets. Parsed by css-tree into a stylesheet AST.
3. Theme-derived CSS variables are registered. Colors resolve through rich-js `Color` for blending and contrast calculation.
4. Initial mode is resolved (`DEFAULT_MODE` or first entry in `MODES`). The mode's base screen component is rendered.
5. `Compose` then `Mount` messages are dispatched to each widget after React's `useEffect` fires (post-mount).
6. TCSS stylesheet is applied to all mounted widgets — cascade resolves styles, MobX observables update, `observer()` triggers initial renders with correct styles.
7. Reactive properties with `init: true` fire their watchers with `(currentValue, currentValue)` — the default is stored first, so both old and new equal the default (verified in original codebase).
8. App is marked as running. `Idle` messages begin dispatching.

// [LAW:dataflow-not-control-flow] The startup sequence is fixed. Every run executes: context init → CSS parse → theme init → mode resolve → screen mount → Compose → Mount → stylesheet apply → reactive init → running. Variation comes from data (CSS sources, composed widgets), not from skipping steps.

### Input and event flow

1. Ink receives terminal input (keypress, mouse, paste, resize) and delivers events via `useInput()` or equivalent hooks.
2. The framework translates Ink input events into framework `Key`, `Click`, `MouseDown`, `Paste`, `Resize`, etc. messages.
3. Key events enter the binding resolution chain: escape-to-minimize precedence, then priority bindings (app/screen first), then route to focused widget. Non-priority bindings are checked after the widget has had a chance to handle the key.
4. Mouse events are routed to the target widget based on position; click-chain detection attaches a `chain` counter (double/triple-click).
5. Widgets receive events via their `on<MessageType>` handlers. Unhandled messages with `bubble: true` propagate upward through registered parents.
6. Deferred callbacks (`callLater`) and MobX reactions run after the current message batch.

### Render flow

1. MobX observable state changes (reactive properties, style recalculation, focus changes, scroll offset) trigger `observer()` re-renders on affected widgets.
2. Widgets produce their content:
   - **Compose mode**: JSX child trees.
   - **Line API mode**: rich-js `Content`/`Strip`s built from `Segment`s with `Style`s, with measurement via rich-js cell-width helpers, and rendered as `<Text>` elements per style run.
3. TCSS-resolved Ink props (width, height, padding, margin, border, colors, display) are spread onto the outer `<Box>`.
4. Ink's React reconciler diffs the component tree and produces minimal terminal updates.
5. Ink renders to the terminal via Yoga layout calculation and ANSI escape sequence output.

This flow is entirely React/Ink/rich-js's responsibility. The framework does not implement a compositor, dirty-region tracker, or render cache. MobX's fine-grained reactivity ensures only affected widgets re-render.

### Style recalculation flow

1. A trigger occurs: class mutation (`.addClass()`, `.removeClass()`), theme change, pseudo-class change (`:focus`, `:disabled`), or inline style mutation.
2. The TCSS cascade re-resolves affected widgets: parse selectors, match against registry, compute specificity, merge rule declarations.
3. Resolved styles update MobX observables on each affected widget (both the Ink-props form and the rich-js `Style` form).
4. `observer()` picks up the observable change and triggers a React re-render.
5. The widget's `useStyles()` hook returns updated Ink-compatible props and rich-js `Style`.
6. Ink renders the update to the terminal.

// [LAW:single-enforcer] Style recalculation is the single path from "something changed" to "widget has new styles." Class mutations, theme changes, and pseudo-class changes all funnel through the cascade. No widget hand-computes its own styles.

## Content and Markup

Rich-text content is a first-class concept. Widgets accept and produce content through rich-js primitives rather than raw strings.

### Markup input

Text-oriented surfaces such as button labels, border titles, and footer/help strings normalize through the text seam:

- A **plain string** — rendered with the widget's current `Style`, no markup parsing.
- A **markup string** — parsed with rich-js's markup grammar, producing a `Content` with embedded styles. Example: `"[bold red]Error:[/] connection failed"` → content with "Error:" in bold red and "connection failed" in the ambient style.
- A **`Content`** — used directly without parsing. Useful when callers build content programmatically.

Visual-bearing surfaces such as `Static` content, tooltips, and command-palette displays normalize through a broader visual seam:

- A **plain string** — promoted to styled text via markup-aware parsing.
- A **`Content`** or **`RichText`** — used as text visuals directly.
- A **rich-js renderable** — wrapped as a visual without flattening it to `Content`.

// [LAW:one-source-of-truth] Text and visual surfaces each have one normalization boundary. Widgets do not invent per-surface unions once the seam is chosen.

### Cell-width truth

All width calculations in the framework (layout sizing, text wrap, cursor position, column alignment in `DataTable`, scrollbar thumb placement) use rich-js cell-width measurement, not JS string length. Wide characters (CJK) count as 2 cells; combining characters count as 0; tabs expand to tab stops; ANSI escapes count as 0. `str.length` is never the correct answer for display geometry.

### Color pipeline

Colors flow from theme → CSS variables → TCSS values → rich-js `Color` → Ink color prop:

1. The active theme defines palette colors (`primary`, `surface`, etc.) as rich-js `Color`s.
2. CSS variables (`$primary`, `$surface`) are bound to those `Color`s.
3. TCSS rules reference variables; the cascade resolves values as `Color` instances.
4. Derived colors (auto-contrast foreground, `$primary-lighten-2`, alpha compositing over background) use `Color` blend/HSL operations.
5. Final colors are converted to Ink's color format (hex / ANSI) at the render boundary.

There is one `Color` type for the whole stack. Widgets do not do their own color math.

## Error Handling

- **Widget render errors**: React error boundaries catch render failures. A widget that throws during render displays an error placeholder without crashing the app.
- **Message handler errors**: uncaught exceptions in `on<MessageType>` handlers are logged via the framework logger and do not crash the app. The message is considered handled (not bubbled further).
- **Worker errors**: uncaught worker exceptions transition the worker to `error` state and post a `Worker.StateChanged` message. The app does not crash.
- **CSS parse errors**: malformed TCSS is logged and skipped. Valid rules in the same stylesheet are still applied.
- **Markup parse errors**: malformed markup falls back to literal rendering of the source string. The error is logged; the widget does not crash.
- **Logger errors**: caught and discarded. The logger never crashes the app.

// [LAW:single-enforcer] Error isolation is enforced at each subsystem boundary. No error in one widget's render, handler, or worker propagates to crash another widget or the app.

## Canonical Behavior Constraints

- Message handling order is deterministic per queue order, with optional coalescing via `Message.canReplace`.
- Convention handlers (`on<MessageType>`) are resolved by naming convention on the widget.
- Style precedence is resolved by specificity + default/user rule origin + declaration order tie-breaker.
- Screen and mode transitions mutate screen stacks through explicit APIs (push/switch/pop, mode switch/add/remove).
- All reactive mutations happen inside MobX actions. Mutations outside actions are rejected by `enforceActions: "always"`.
- All text/content is treated as cell-width-aware. No framework code uses `str.length` for display geometry.

// [LAW:dataflow-not-control-flow] Event and style pipelines execute in fixed phases; variability is expressed via message/style values and selector matches.
// [LAW:single-enforcer] Each cross-cutting concern has one primary enforcement boundary: message dispatch in the message system, style application in the TCSS cascade, terminal I/O in Ink, reactive state in MobX, styled content in rich-js.
// [LAW:one-way-deps] Core direction is Ink/rich-js → App → Screen → Widget; bubbling propagates upward but does not invert module dependency direction.

## Scope of Remaining Spec Files

- `01`: app lifecycle, modes, screens, shutdown, maximize/minimize, batch updates, print capture.
- `02`: widget registry, query semantics, reactivity, data binding, CSS identity.
- `03`: message/event transport and dispatch semantics, event taxonomy, click chain.
- `04`: TCSS parser, selectors, stylesheet application, specificity, TCSS-to-Ink and TCSS-to-rich-js-`Style` translation.
- `05`: layout (Yoga/Ink integration), layout strategies (vertical / horizontal / grid / stream), dock, margin collapse, scroll, rendering pipeline.
- `06`: keys, bindings, actions, keymap overrides, command palette.
- `07`: workers/timers/signals.
- `08`: terminal I/O behavior (Ink integration, suspend/resume, CSS live reload).
- `09`: widget base contract (disabled, loading, focus, tooltip, pseudo-classes, text selection, scrollbar internals).
- `10`: built-in widget catalog.
- `11`: text editing / document subsystem (TextArea, Document, WrappedDocument, Navigator, EditHistory, Shiki integration, bracket matching, tab expansion).
- `12`: themes / notifications / validation / suggestions / animation / color / output filters / slug generation.
- `13`: testing surfaces and automation helpers.
- `14`: React/Ink integration architecture, hooks and context providers, public surfaces.
