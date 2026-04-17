# Phase 1: React/Ink + MobX Foundation

## Preconditions

None. This is the first phase.

The codebase has 22 TypeScript source files under `src/` written for a renderer-agnostic architecture with custom tree management. Most of this will be replaced or reworked. Zero test files exist.

## Goal

Establish the React/Ink/MobX foundation, test harness, message system, and MobX reactive pipeline that every subsequent phase builds on.

## Architectural Rationale

// [LAW:single-enforcer] This phase establishes three enforcement boundaries simultaneously: React owns the component tree and rendering, Ink owns terminal I/O and layout, MobX owns reactive state and dependency tracking.

// [LAW:one-source-of-truth] The React component tree IS the widget tree. There is no parallel tree structure. CSS identity (id, classes, type name) and message dispatch are layered onto the React tree via context and registration, not by maintaining a second tree.

// [LAW:one-way-deps] Dependencies: Widgets → framework services (context) → MobX stores → React/Ink. No back-edges.

### Why React/Ink

Ink is a React renderer for the terminal. It provides Yoga flexbox layout, terminal I/O, ANSI output, and input handling. This eliminates the need for a custom layout engine, compositor, driver, and rendering pipeline. The application framework (screens, focus, bindings, widgets) is built on top of React/Ink.

### Why MobX

MobX's `intercept` → `observable` → `reaction` → `computed` pipeline maps 1:1 to the Textual spec's validate → store → watch → compute pipeline. `mobx-react-lite`'s `observer()` automatically triggers React re-renders when observed state changes — no manual `refresh()` calls.

## Current State (before this phase)

### Existing code to keep

**`src/geometry/`** — `Size`, `Offset`, `Region`, `Spacing`. Immutable value types with full operator sets. Keep as-is.

**`src/events/message.ts`** — `Message` base class with `messageId`, `bubble`, `canReplace`, `stop()`, `preventDefault()`, sender tracking. Keep and adapt.

**`src/events/events.ts`** — Built-in event types: `Compose`, `Mount`, `Unmount`, `Focus`, `Blur`, `Resize`, `Idle`, `Key`, `MouseDown`/`MouseUp`/`MouseMove`/`Click`/`ScrollEvent`. Keep and extend.

### Existing code to replace

**`src/dom-node.ts`**, **`src/node-list.ts`** — Manual tree linkage. Replaced by React component tree.

**`src/widget.ts`**, **`src/screen.ts`**, **`src/app.ts`** — Class-based hierarchy with manual tree ops. Replaced by React components.

**`src/reactive.ts`** — Function-based reactive. Replaced by MobX.

**`src/layout/`** — Custom layout strategies. Removed entirely (Yoga via Ink).

**`src/events/message-pump.ts`** — Message queue with dispatch. Reworked to integrate with React component tree.

### Configuration

**`package.json`**: Currently depends on `typescript`, `vitest`. Needs React, Ink, MobX, and their types added.

**`tsconfig.json`**: Has `experimentalDecorators: true`. Needs JSX configuration for React/Ink.

## Scope

### Project setup

- Add dependencies: `react`, `ink`, `mobx`, `mobx-react-lite`
- Add dev dependencies: `@types/react`, `ink-testing-library`, `@testing-library/react` (if useful)
- Configure `tsconfig.json` for JSX: `"jsx": "react-jsx"`, `"jsxImportSource": "react"`
- Update `package.json` description, keywords
- Verify `npm run build` and `npm run lint` pass with new dependencies

### TextualApp component

The root React component that provides framework context to the widget tree.

```tsx
// Conceptual — not prescriptive implementation
const TextualApp = observer(({ children }) => {
  return (
    <TextualProvider>
      <AppShell>
        {children}
      </AppShell>
    </TextualProvider>
  );
});
```

- `TextualProvider`: React context that provides framework services (message dispatch, widget registry, focus manager, screen stack) to all descendants
- Wraps the Ink `render()` call
- Manages app lifecycle: startup, shutdown

### Widget registry

Widgets need to be queryable by CSS selector (Phase 2) and targetable by messages. Since React owns the tree, we maintain a lightweight registry:

- Each widget registers on mount, deregisters on unmount (via `useEffect` or equivalent)
- Registration includes: CSS identity (id, classes, type name), React component ref, parent reference
- The registry is a MobX observable — changes trigger reactions where needed
- `NodeList._updates` equivalent: a version counter on the registry, bumped on every register/deregister

// [LAW:one-source-of-truth] The registry is the single source of truth for "what widgets exist." React owns the tree structure. The registry indexes it for framework queries.

### Widget base pattern

Define how textual-js widgets are built as React components:

- Each widget is a React function component wrapped in `observer()` (from mobx-react-lite)
- A `useTextual()` hook connects the widget to the framework context
- CSS identity: `id`, `classes`, `typeName` — provided via props or derived from component name
- `DEFAULT_CSS` static property on the component — consumed by the TCSS engine in Phase 2
- `compose()` pattern: for widgets that declare child structure, `compose()` returns JSX (or children are passed as props/children)

```tsx
// Conceptual widget pattern
const Button = observer(({ id, classes, variant = 'default', children, ...props }) => {
  const { register, postMessage } = useTextual();

  // Register with framework on mount
  useEffect(() => register({ id, classes, typeName: 'Button' }), []);

  return (
    <Box onClick={() => postMessage(new ButtonPressed())}>
      <Text>{children}</Text>
    </Box>
  );
});

Button.DEFAULT_CSS = `
  Button {
    background: $surface;
    min-width: 16;
  }
`;
```

### MobX reactive pipeline

Replace `src/reactive.ts` with MobX-backed reactivity:

- `configure({ enforceActions: "always" })` — mutations only in actions
- `reactive<T>(defaultValue, options?)` — creates a MobX `observable` property
- `intercept()` for `validate_<name>` convention: intercepts writes, can transform or reject
- `observe()` for `watch_<name>` convention: fires after value changes with old/new
- `computed` for `compute_<name>` convention: automatic dependency tracking
- `observable` with `equals: () => false` for `always_update`
- `init` dispatch: on mount, fire watchers with `(currentValue, currentValue)` when `init: true` (the default) — default is stored first, so both old and new equal the default (verified in original codebase)
- Watcher ordering: convention-based (`watch_<name>`) fires before explicit registrations
- Refresh integration: `observer()` from mobx-react-lite handles React re-renders automatically — no manual `refresh()` needed

### Message system

Adapt MessagePump for the React component tree:

- `Message` base class: keep as-is (messageId, bubble, canReplace, stop, preventDefault, sender)
- Event types: keep `Key`, `Click`, `MouseDown`, etc.
- Dispatch: messages posted to a widget travel up the React tree via context-based parent references
- Handler resolution: `on<MessageType>` naming convention on the widget (or handler props)
- Coalescing: if `canReplace`, newer messages of the same type replace queued ones
- Bubbling: messages with `bubble: true` propagate upward through registered parents

### Test harness

- Use `ink-testing-library` for rendering widgets in tests
- `runTest(AppComponent, options?)`: renders a TextualApp with ink-testing-library, returns a test handle
- `Pilot` for programmatic interaction:
  - `pilot.press(key)` — simulates key input via Ink's stdin
  - `pilot.click(x, y)` — posts click event
  - `pilot.resize(width, height)` — triggers resize
  - `pilot.pause()` — waits for async operations and MobX reactions to settle
- Vitest as the test runner (already configured)

### Test suites

Write Vitest suites covering:

- **Geometry**: Size, Offset, Region, Spacing — construction, operators, immutability
- **Message**: construction, messageId uniqueness, stop(), preventDefault(), sender tracking
- **Message dispatch**: handler resolution, coalescing, bubbling through component tree
- **MobX reactive pipeline**: validate → store → watch → compute flow, init dispatch, always_update, watcher ordering, computed dependency tracking
- **Widget registration**: mount registers, unmount deregisters, version counter bumps
- **TextualApp**: renders, provides context, children receive framework services
- **Integration**: runTest() + Pilot — render an app, interact, verify state

### Geometry

Keep `src/geometry/` as-is. These are pure value types with no dependencies on the tree model.

## Spec References

- `spec/spec-src/13-testability-and-automation-surfaces.md` — run_test() and Pilot contract
- `spec/spec-src/01-runtime-app-and-lifecycle.md` — app lifecycle
- `spec/spec-src/02-dom-reactivity-and-query.md` — reactive pipeline
- `spec/spec-tests/reactivity.md` — reactive test cases
- `spec/spec-tests/events_and_messages.md` — message dispatch test cases
- `spec/spec-tests/geometry.md` — geometry test cases
- `spec/spec-tests/app.md` — app lifecycle test cases

## Exit Criteria

1. `npm test` runs non-empty suites and passes.
2. A TextualApp component renders in ink-testing-library.
3. MobX reactive pipeline tests cover: validator ordering, watcher ordering, init dispatch, always_update, compute-backed values, mutation via actions.
4. Message dispatch tests cover: handler resolution, coalescing, bubbling through React tree.
5. Geometry tests cover: Size, Offset, Region, Spacing operators.
6. `runTest()` + Pilot can render an app, post a key event, and verify state change.
7. `configure({ enforceActions: "always" })` is set — mutations outside actions fail.
8. Old `src/layout/` directory removed. Old `src/dom-node.ts`, `src/node-list.ts` replaced.
9. `npm run build` and `npm run lint` pass.

## What the Next Phase Expects

Phase 2 (TCSS & Query) expects:
- Widget registry with CSS identity (id, classes, typeName) for selector matching
- MobX observables as the reactive foundation — style properties will be MobX observables
- TextualApp context providing framework services to all widgets
- Test harness working for writing TCSS and query tests
