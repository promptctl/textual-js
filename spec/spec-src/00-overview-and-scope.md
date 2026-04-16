# Textual-JS Specification: Overview and Scope

This specification set defines the behavioral contract for the textual-js framework — a terminal UI application framework built as a React component library on Ink.

## Source of Truth

- These spec files define intended behavior, not implementation.
- When the spec and `spec/uber-divergence.md` conflict, the uber-divergence resolution wins.
- Implementation uses React/Ink for rendering and layout, MobX for reactive state, and css-tree for CSS parsing. The specs describe *what* the framework does, not *how* those libraries are used internally.

// [LAW:one-source-of-truth] These specs are the sole authority for intended behavior.

## Foundation Libraries

The framework is built on these libraries rather than reimplementing their concerns:

| Library | Role | What it replaces |
|---------|------|-----------------|
| **React** | Component model, tree reconciliation, rendering lifecycle | Custom DOMNode/NodeList tree management, manual refresh scheduling |
| **Ink** | Terminal rendering (ANSI), Yoga flexbox layout, stdin handling | Custom layout engine, compositor, driver, terminal I/O |
| **MobX** | Reactive state, dependency tracking, computed values, interceptors | Custom reactive descriptors, manual refresh propagation |
| **css-tree** | CSS tokenization, parsing, selector matching, specificity | Custom TCSS parser |
| **uFuzzy** | Fuzzy string matching for command palette search | Custom fuzzy matcher |
| **marked** | Markdown parsing to AST | Custom markdown parser |
| **Shiki** | Syntax highlighting via TextMate grammars | Custom syntax/highlighting system |

### What Ink provides

Ink is a React renderer for the terminal. It provides:

- **Yoga flexbox layout**: `<Box>` with `flexDirection`, `width`, `height`, `padding`, `margin`, `alignItems`, `justifyContent`, `flexGrow`, `flexShrink`, `flexBasis`, `minWidth`, `maxWidth`, etc.
- **Text rendering**: `<Text>` with `color`, `backgroundColor`, `bold`, `italic`, `underline`, `strikethrough`, `dimColor`, `wrap`.
- **Terminal I/O**: raw mode stdin/stdout, ANSI escape output, alternate screen buffer.
- **Input handling**: `useInput()` hook delivers key and mouse events with key name normalization.
- **Focus**: basic `useFocus()` hook for tab-order focus. The framework extends this with a richer focus chain.
- **Measurements**: `measureElement()` for getting rendered dimensions.
- **Testing**: `ink-testing-library` for rendering components in tests without a terminal.

### What Ink does NOT provide (the framework's value)

- TCSS styling with cascade, specificity, selectors, pseudo-classes, and CSS variables
- Screen stack with push/pop/switch and per-mode stacks
- Key binding system with action dispatch and namespace resolution
- Focus management with focus chains, focus groups, and disabled-state gating
- Command palette with async providers and fuzzy search
- Widget catalog (30+ interactive components)
- Message system with bubbling, coalescing, and convention-based handler resolution
- Notifications, themes, validation, suggestions
- Worker lifecycle management
- Text editing subsystem (Document model, TextArea)
- Animation system with CSS transitions

## Package Surface

The root module exports:

### Components

- `App` — root component, process coordinator, provides framework context
- `Screen` — view container, owns focus chain, composable via JSX
- Widget catalog: `Button`, `Input`, `TextArea`, `DataTable`, `Tree`, `Select`, `ListView`, `TabbedContent`, `Markdown`, etc.

### Hooks

- `useTextual()` — connects a widget to the framework context (registration, message dispatch, query API)
- `useStyles()` — returns the widget's TCSS-resolved styles translated to Ink props
- `useWorker(asyncFn, options?)` — creates a managed async task with lifecycle tracking
- `useFocusManager()` — access to focus chain navigation (focusNext, focusPrevious, setFocus)
- `useBindings()` — access to active bindings for the current focus context

### Conventions and decorators

- `on` — message-handler convention for selector-filtered event handling
- `work` — worker convention for managed async tasks
- `reactive(defaultValue, options?)` — creates a MobX-backed reactive property with validate/watch/compute conventions

### Types and messages

- `Message` — base class for all framework messages
- Event types: `Key`, `Click`, `MouseDown`, `MouseUp`, `MouseMove`, `ScrollEvent`, `Resize`, `Compose`, `Mount`, `Unmount`, `Focus`, `Blur`, `Idle`
- `Binding` — key-to-action mapping declaration
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
3. **Widget** instances implement visual/interactive behavior as React function components wrapped in MobX `observer()`.

### The widget tree is the React component tree

There is no separate DOM abstraction. React owns tree structure, reconciliation, and rendering. The framework layers onto the React tree:

- **Widget registry**: each widget registers on mount and deregisters on unmount (via `useEffect`). Registration includes CSS identity (id, classes, typeName) and a parent reference. The registry enables CSS selector matching and the query API without maintaining a parallel tree.
- **Message dispatch**: messages bubble upward through registered parent references, not through React's synthetic event system. React events and framework messages are separate systems — React events come from Ink (terminal input), framework messages are the Textual message protocol.
- **TCSS cascade**: resolved styles are MobX observables per widget. When the cascade recomputes (due to class change, theme change, or pseudo-class change), the observable updates, `observer()` triggers a re-render, and the widget receives new Ink props.

// [LAW:one-source-of-truth] The widget registry is the sole index of "what widgets exist and their CSS identity." React owns the tree structure. The registry indexes it for framework queries.

### Widget implementation pattern

Every widget follows this pattern:

1. It is a React function component wrapped in `observer()` from mobx-react-lite.
2. It calls `useTextual()` to connect to the framework (registration, message dispatch, query).
3. It calls `useStyles()` to get TCSS-resolved styles as Ink props.
4. It renders Ink primitives (`<Box>`, `<Text>`) with the resolved styles.
5. Static properties declare framework behavior: `DEFAULT_CSS`, `BINDINGS`, `canFocus`, `canFocusChildren`.

### How compose() works in React

In Python Textual, `compose()` yields child widgets. In textual-js, widget composition is JSX:

- Widgets that declare their own child structure do so by rendering JSX children in their React render function.
- The `App` component's children (or its `compose()` return) are the initial widget tree.
- Dynamic composition (mounting widgets at runtime) uses React state: adding a widget to a MobX observable list triggers a re-render that includes the new widget in JSX.

### Supporting systems

- **Reactive state**: MobX observables with `intercept()` for validation, `observe()` for watchers, `computed` for derived values. `observer()` from mobx-react-lite triggers React re-renders automatically.
- **Styling**: TCSS parsed by css-tree, cascade resolves styles per widget, output translated to Ink `<Box>`/`<Text>` props. TCSS is an authoring and cascade layer — the output is "what Ink props should this widget have."
- **Layout and rendering**: Ink handles layout via Yoga flexbox. React handles rendering and diffing. The framework does not implement a layout engine or compositor.
- **Input and actions**: Ink handles terminal input via `useInput()`. The framework provides binding resolution (focused widget → ancestors → screen → app) and action dispatch (`action_<name>` method resolution).
- **Concurrency**: workers (managed async tasks with AbortController cancellation), timers (named, pausable), signals (typed pub/sub backed by MobX observables).

## Primary Runtime Flows

### Startup and lifecycle flow

1. App component mounts via React/Ink. Framework context initializes: MobX stores for screen stack, focus manager, binding resolver, notification store, theme engine, worker manager, signal registry.
2. CSS sources are aggregated: `DEFAULT_CSS` from all registered widget types, app-level `CSS`, user-provided stylesheets. Parsed by css-tree into a stylesheet AST.
3. Initial mode is resolved (`DEFAULT_MODE` or first entry in `MODES`). The mode's base screen component is rendered.
4. `Compose` then `Mount` messages are dispatched to each widget after React's `useEffect` fires (post-mount).
5. TCSS stylesheet is applied to all mounted widgets — cascade resolves styles, MobX observables update, `observer()` triggers initial renders with correct styles.
6. Reactive properties with `init: true` fire their watchers with `(undefined, currentValue)`.
7. App is marked as running. `Idle` messages begin dispatching.

// [LAW:dataflow-not-control-flow] The startup sequence is fixed. Every run executes: context init → CSS parse → mode resolve → screen mount → Compose → Mount → stylesheet apply → reactive init → running. Variation comes from data (CSS sources, composed widgets), not from skipping steps.

### Input and event flow

1. Ink receives terminal input (keypress, mouse) and delivers events via `useInput()` or equivalent hooks.
2. The framework translates Ink input events into framework `Key`, `Click`, `MouseDown`, etc. messages.
3. Key events enter the binding resolution chain: check priority bindings (app/screen first), then route to focused widget. Non-priority bindings are checked after the widget has had a chance to handle the key.
4. Mouse events are routed to the target widget based on position (Ink provides element positioning information).
5. Widgets receive events via their `on<MessageType>` handlers. Unhandled messages with `bubble: true` propagate upward through registered parents.
6. Deferred callbacks (`callLater`) and MobX reactions run after the current message batch.

### Render flow

1. MobX observable state changes (reactive properties, style recalculation, focus changes) trigger `observer()` re-renders on affected widgets.
2. Widgets produce Ink components (`<Box>`, `<Text>`) with styles from the TCSS cascade spread as props.
3. Ink's React reconciler diffs the component tree and produces minimal terminal updates.
4. Ink renders to the terminal via Yoga layout calculation and ANSI escape sequence output.

This flow is entirely React/Ink's responsibility. The framework does not implement a compositor, dirty-region tracker, or render cache. MobX's fine-grained reactivity ensures only affected widgets re-render.

### Style recalculation flow

1. A trigger occurs: class mutation (`.addClass()`, `.removeClass()`), theme change, pseudo-class change (`:focus`, `:disabled`), or inline style mutation.
2. The TCSS cascade re-resolves affected widgets: parse selectors, match against registry, compute specificity, merge rule declarations.
3. Resolved styles update MobX observables on each affected widget.
4. `observer()` picks up the observable change and triggers a React re-render.
5. The widget's `useStyles()` hook returns updated Ink-compatible props.
6. Ink renders the update to the terminal.

// [LAW:single-enforcer] Style recalculation is the single path from "something changed" to "widget has new styles." Class mutations, theme changes, and pseudo-class changes all funnel through the cascade. No widget hand-computes its own styles.

## Error Handling

- **Widget render errors**: React error boundaries catch render failures. A widget that throws during render displays an error placeholder without crashing the app.
- **Message handler errors**: uncaught exceptions in `on<MessageType>` handlers are logged via the framework logger and do not crash the app. The message is considered handled (not bubbled further).
- **Worker errors**: uncaught worker exceptions transition the worker to `error` state and post a `Worker.StateChanged` message. The app does not crash.
- **CSS parse errors**: malformed TCSS is logged and skipped. Valid rules in the same stylesheet are still applied.
- **Logger errors**: caught and discarded. The logger never crashes the app.

// [LAW:single-enforcer] Error isolation is enforced at each subsystem boundary. No error in one widget's render, handler, or worker propagates to crash another widget or the app.

## Canonical Behavior Constraints

- Message handling order is deterministic per queue order, with optional coalescing via `Message.canReplace`.
- Convention handlers (`on<MessageType>`) are resolved by naming convention on the widget.
- Style precedence is resolved by specificity + default/user rule origin + declaration order tie-breaker.
- Screen and mode transitions mutate screen stacks through explicit APIs (push/switch/pop, mode switch/add/remove).
- All reactive mutations happen inside MobX actions. Mutations outside actions are rejected by `enforceActions: "always"`.

// [LAW:dataflow-not-control-flow] Event and style pipelines execute in fixed phases; variability is expressed via message/style values and selector matches.
// [LAW:single-enforcer] Each cross-cutting concern has one primary enforcement boundary: message dispatch in the message system, style application in the TCSS cascade, terminal I/O in Ink, reactive state in MobX.
// [LAW:one-way-deps] Core direction is Ink → App → Screen → Widget; bubbling propagates upward but does not invert module dependency direction.

## Scope of Remaining Spec Files

- `01`: app lifecycle, modes, screens, shutdown.
- `02`: widget registry, query semantics, reactivity, data binding.
- `03`: message/event transport and dispatch semantics.
- `04`: CSS parser, selectors, stylesheet application, TCSS-to-Ink translation.
- `05`: layout (Yoga/Ink integration) and rendering (React render flow).
- `06`: keys, bindings, actions, command palette.
- `07`: workers/timers/signals.
- `08`: terminal I/O behavior (Ink integration, suspend/resume).
- `09`: widget base contract (disabled, loading, focus, tooltip, pseudo-classes).
- `10`: built-in widget catalog.
- `11`: text editing/document subsystem.
- `12`: themes/notifications/validation/suggestions and related helpers.
- `13`: testing surfaces and automation helpers.
