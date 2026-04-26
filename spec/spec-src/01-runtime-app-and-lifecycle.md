# App Runtime and Lifecycle

## Core Type

`App` is the runtime root. It is a React component that provides framework context to all descendants and owns:

- per-mode screen stacks and installed-screen registry,
- global action dispatch and binding chain composition,
- CSS source aggregation and reparse,
- notifications, themes, command palette, suspend/resume, and shutdown sequencing,
- the animator, the output filter pipeline, and the rich-js color registry for theme-derived colors.

### How to define an App

An App is a React function component that wraps the framework's `TextualApp` provider:

```tsx
const MyApp = () => (
  <TextualApp>
    <MyScreen />
  </TextualApp>
);
```

Or for apps that need class-level configuration:

```tsx
const MyApp = () => (
  <TextualApp
    css={CSS}
    modes={MODES}
    bindings={BINDINGS}
    commands={COMMANDS}
    theme="dark"
  >
    <MyScreen />
  </TextualApp>
);
```

### How to run an App

Normal run (terminal):
```tsx
import { render } from 'ink';
render(<MyApp />);
```

Test harness:
```tsx
const { pilot, unmount } = await runTest(MyApp, { width: 80, height: 24 });
await pilot.press('enter');
unmount();
```

### App props

`TextualApp` accepts:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `css` | `string` | `""` | App-level TCSS stylesheet source |
| `cssPath` | `string \| string[]` | — | Path(s) to TCSS files; watched for live reload in dev mode (spec 08) |
| `theme` | `string` | `"default"` | Initial theme name |
| `modes` | `Record<string, ComponentType>` | `{}` | Named mode → Screen component mapping |
| `defaultMode` | `string` | `"_default"` | Initial active mode |
| `screens` | `Record<string, ComponentType>` | `{}` | Installed screens (pre-registered by name) |
| `bindings` | `Binding[]` | `[]` | App-level key bindings |
| `commands` | `Provider[]` | `[SystemCommands]` | Command palette providers |
| `commandPaletteBinding` | `string` | `"ctrl+p"` | Key to open command palette |
| `enableCommandPalette` | `boolean` | `true` | Whether the command palette is available |
| `autoFocus` | `string \| null` | `null` | CSS selector for initial focus target |
| `tooltipDelay` | `number` | `500` | Milliseconds before tooltip appears |
| `notificationTimeout` | `number` | `5000` | Default notification auto-dismiss (ms) |
| `title` | `string \| Content` | `""` | App title (markup string or rich-js `Content`). Displayed by `Header`. |
| `subTitle` | `string \| Content` | `""` | App subtitle (markup string or rich-js `Content`). |
| `filters` | `LineFilter[]` | `[]` | Output filters (accessibility / terminal compatibility; spec 12) |
| `onExit` | `(result?) => void` | — | Called when `exit()` completes |

## Reactive App State

These are MobX observables on the app context, accessible to all widgets via `useTextual()`:

| Property | Type | Description |
|----------|------|-------------|
| `title` | `Content` | App title as rich-js `Content`. Set from a markup string or `Content`; stored as `Content`. Header widget re-renders when it changes. |
| `subTitle` | `Content` | App subtitle as rich-js `Content`. Same rules as `title`. |
| `theme` | `string` | Active theme name. Setting it triggers theme change: rebuild rich-js `Color` bindings → rebuild CSS variables → reapply stylesheet → publish `theme_changed_signal`. |
| `dark` | `boolean` | Whether dark mode is active. Derived from the active theme's `dark` flag (MobX `computed`). |
| `isRunning` | `boolean` | Whether the app is running (true after startup, false after exit). |
| `activeMode` | `string` | Name of the currently active mode. |
| `activeScreen` | `Screen \| null` | The topmost screen on the active mode's stack. |
| `focusedWidget` | `Widget \| null` | The currently focused widget (delegated from the active screen's focus manager). |
| `terminalSize` | `Size` | Current terminal dimensions reported by Ink. Drives `vw`/`vh` TCSS units. |

// [LAW:one-source-of-truth] These observables are the sole authority for app-level state. Widgets read them via context; they do not maintain local copies.

## Class-Level Configuration Surface

For widgets defined as named components, static properties provide declarative configuration:

```tsx
const MyApp = () => <TextualApp css={MyApp.CSS} bindings={MyApp.BINDINGS}>...</TextualApp>;

MyApp.CSS = `
  Screen { background: $surface; }
  Button { min-width: 16; }
`;

MyApp.BINDINGS = [
  { key: 'ctrl+q', action: 'quit', description: 'Quit' },
  { key: 'ctrl+d', action: 'toggle_dark', description: 'Toggle dark mode' },
];

MyApp.COMMANDS = [MyCustomProvider];

MyApp.MODES = {
  dashboard: DashboardScreen,
  settings: SettingsScreen,
};
```

Configuration categories:

- **CSS and styling**: `CSS`, `DEFAULT_CSS`. Theme selection via the `theme` prop/reactive property.
- **Navigation**: `MODES`, `SCREENS`, `DEFAULT_MODE` (defaults to `"_default"`), `AUTO_FOCUS`.
- **Input/action**: `BINDINGS`, `COMMANDS`, `COMMAND_PALETTE_BINDING`, `COMMAND_PALETTE_DISPLAY`, `ENABLE_COMMAND_PALETTE`.
- **UX behavior**: `ALLOW_IN_MAXIMIZED_VIEW`, `ESCAPE_TO_MINIMIZE`, `TOOLTIP_DELAY`, `NOTIFICATION_TIMEOUT`, `ALLOW_SELECT`.

// [LAW:one-source-of-truth] These static properties are the sole declarative inputs consulted during initialization; runtime changes go through the reactive properties on the app context.

## Startup/Run Lifecycle

### Entry points

- **Normal run**: `render(<MyApp />)` via Ink. The `TextualApp` component initializes the framework on mount.
- **Test harness**: `runTest(MyApp, options?)` renders the App with `ink-testing-library` and returns a `Pilot` for programmatic interaction. Options include `width`, `height` for simulating terminal dimensions.

### Startup phases

Executed when the `TextualApp` component mounts (inside a `useEffect` with empty deps):

1. **Initialize framework context**: create MobX stores for screen stack, focus manager, binding resolver, notification store, theme engine, worker manager, signal registry, widget registry, animator, output filter pipeline. Provide them via React context.
2. **Aggregate CSS sources**: collect `DEFAULT_CSS` / `SCOPED_CSS` from all known widget types (registered via a static registry or import-time side effect), plus app-level `CSS` and any `cssPath` file contents. Parse with css-tree into a stylesheet AST.
3. **Initialize theme**: resolve the initial theme; parse its palette strings into rich-js `Color` instances; register them under theme-variable names; compute derived shorthands (`$primary-lighten-2`, `$surface-darken-1`, auto-contrast foreground); merge into the stylesheet as CSS variables.
4. **Resolve initial mode**: look up `DEFAULT_MODE` in `MODES`. Mount the mode's base screen component.
5. **Dispatch lifecycle messages**: post `Compose` then `Mount` to the app and each widget in the tree. These messages fire after React's initial render (`useEffect` timing).
6. **Apply TCSS stylesheet**: cascade resolves styles for all mounted widgets. Each widget's `ResolvedStyles` MobX observable is populated (Ink props + rich-js `Style`). `observer()` triggers re-renders with correct styles.
7. **Initialize reactive properties**: fire `init` watchers where `init: true` (the default) with `(currentValue, currentValue)` — default is stored first, so both arguments equal the default (verified in original codebase).
8. **Resolve auto-focus**: if `AUTO_FOCUS` is set, query the widget registry for a matching widget and set focus.
9. **Mark running**: set `isRunning = true`. Begin dispatching `Idle` messages on a timer.

// [LAW:dataflow-not-control-flow] The startup sequence is fixed: every run executes context init → CSS aggregate → theme init → mode resolve → screen mount → Compose → Mount → stylesheet apply → reactive init → auto-focus → running. Variation comes from data (CSS sources, composed widgets, mode configuration), not from skipping steps.

### CSS source aggregation

The TCSS engine needs `DEFAULT_CSS` / `SCOPED_CSS` from every widget type before any widget renders. This creates a sequencing requirement:

- Widget types register their `DEFAULT_CSS` at import time (module-level side effect). When a module exports `Button`, `Button.DEFAULT_CSS` is captured in a global style registry.
- The `TextualApp` component reads from this registry during startup (step 2).
- Dynamic widget types (imported after app mount) trigger a CSS reparse when their `DEFAULT_CSS` is registered.

// [LAW:single-enforcer] The style registry is the single collection point for DEFAULT_CSS. No widget applies its own DEFAULT_CSS independently.

### Input routing

App-level input routing handles messages that reach the app (via bubbling or direct targeting):

- **`Compose`**: triggers mode initialization before app-level composition runs, guaranteeing the mode's base screen exists.
- **Key events**: escape-to-minimize precedence (if a widget is maximized and `ESCAPE_TO_MINIMIZE` is on), then priority bindings on the full chain, then forward to the focused widget or screen; non-priority bindings bubble after.
- **Mouse events**: Ink delivers mouse events with position information. The framework routes to the widget under the pointer. Click-chain detection (`chain: number` on `Click`) is enforced at the screen's mouse-forwarding path.
- **Paste**: bracketed-paste content delivered as a `Paste` message with `text`.
- **Other input events**: forward to the current screen.

// [LAW:single-enforcer] Binding dispatch is enforced in one place — the binding resolution chain walks from focused widget through ancestors to screen to app.

## Screen

A Screen is a React component that serves as the compose root for a view. It owns its focus chain and can have its own CSS, bindings, and commands.

### Screen props and configuration

```tsx
const MyScreen = () => (
  <Screen css={MyScreen.CSS} bindings={MyScreen.BINDINGS}>
    <Header />
    <Container>
      <Button id="save">Save</Button>
    </Container>
    <Footer />
  </Screen>
);

MyScreen.CSS = `
  #save { background: $primary; }
`;

MyScreen.BINDINGS = [
  { key: 'ctrl+s', action: 'save', description: 'Save' },
];
```

Screens declare:
- `CSS` — screen-scoped TCSS (merged into the cascade when the screen is active)
- `BINDINGS` — screen-level key bindings (checked after widget bindings, before app bindings)
- `COMMANDS` — screen-level command providers (unioned with app providers)
- `AUTO_FOCUS` — CSS selector for initial focus target on this screen
- `ALLOW_IN_MAXIMIZED_VIEW` — CSS selector for widgets that remain visible alongside a maximized widget (overrides app default)

### Screen lifecycle messages

| Message | When |
|---------|------|
| `Compose` | After React mount, before Mount. Widget should set up its child structure. |
| `Mount` | After Compose. Widget is in the tree and styled. |
| `ScreenResume` | Screen becomes the active (topmost) screen. |
| `ScreenSuspend` | Screen is no longer the active screen (another was pushed on top). |
| `Unmount` | Screen is being removed from the stack and will be unmounted from React. |

## Maximize and Minimize

A Screen can promote a single widget to a maximized view, making it the prominent visible element while dimming or hiding its siblings. This is used for modal-style emphasis (e.g., expanding a chart to fill the screen) without changing the screen stack.

### Reactive state

| Property | Type | Where | Description |
|----------|------|-------|-------------|
| `maximized` | `Widget \| null` | Screen | MobX observable. `null` means no widget is maximized. Declared with `layout: true` — changes invalidate layout. |

The `maximized` observable is the sole authority for maximize state on a screen. Widgets and CSS both derive from it; no parallel "is maximized" flag exists elsewhere.

// [LAW:one-source-of-truth] `Screen.maximized` is the only authoritative representation of which widget is maximized. The CSS classes below are derived and synchronized from it.

### CSS class synchronization

Whenever `Screen.maximized` changes, a MobX `observe()` watcher toggles CSS classes:

| Class | Applied to | When |
|-------|------------|------|
| `-maximized-view` | Screen root | While `maximized !== null` |
| `-maximized` | The maximized widget | While that widget is the value of `maximized` |

Class toggling is unconditional (runs on every change); the data (`maximized`) decides which element receives which class.

// [LAW:dataflow-not-control-flow] The watcher always runs the same sync operation on `maximized` changes — it does not branch on "was already maximized." It computes the required class set from the current value and applies it.

### API

```tsx
screen.maximize(widget);                    // default: container=true
screen.maximize(widget, /* container */ false);
screen.minimize();
```

- **`maximize(widget, container = true)`**:
  - Consults `widget.ALLOW_MAXIMIZE` (static). If the value is `false`, the call is a no-op.
  - If `container` is `true` (the default), walks up the ancestor chain from `widget` and maximizes the nearest ancestor whose `ALLOW_MAXIMIZE` is `true`. If none is found, the call is a no-op.
  - If `container` is `false`, maximizes exactly the given widget (subject to its own `ALLOW_MAXIMIZE`).
  - Sets `Screen.maximized` to the chosen widget (a MobX action). CSS classes sync via the watcher; layout recomputes via the layout cache key (below).
- **`minimize()`**:
  - Clears `Screen.maximized` (sets it to `null`) as a MobX action.
  - After the next refresh, any currently focused widget is re-centered in the viewport. "After the next refresh" means the re-center is scheduled as a post-refresh callback (runs once layout has reflected `maximized = null`).

### Static configuration

| Property | Declared on | Default | Description |
|----------|-------------|---------|-------------|
| `ALLOW_MAXIMIZE` | Widget (static) | `true` if the widget type is focusable, `false` otherwise | Whether this widget type may be the target of `maximize()`. |
| `ALLOW_IN_MAXIMIZED_VIEW` | Screen (static) and App (static) | App default: `"Footer"`; Screen default: inherits from App | CSS selector matching widgets that remain visible around the maximized widget. |
| `ESCAPE_TO_MINIMIZE` | App (static) | `true` | When `true`, pressing Escape while `Screen.maximized !== null` calls `minimize()`. |

Selector resolution for `ALLOW_IN_MAXIMIZED_VIEW`: every non-maximized widget on the screen is tested against the selector (via the query engine). Widgets that match remain visible; widgets that do not match are hidden for the duration of the maximized view. Hiding is expressed by the `-maximized-view` class on the screen (which targets non-matching descendants in CSS) — it is not a separate mutation per widget.

// [LAW:single-enforcer] The Escape-to-minimize behavior is enforced in exactly one place: the app-level key handler checks `ESCAPE_TO_MINIMIZE` and `activeScreen.maximized` together. Screens do not each install their own Escape binding for this.

### Layout caching

`Screen.arrange()` caches its computed layout keyed by the tuple `(size, registryVersion, maximized)`:

- `size` — the screen's rendered size (Ink-reported width/height).
- `registryVersion` — a monotonically increasing version on the widget registry, bumped whenever widgets are added/removed.
- `maximized` — the current value of `Screen.maximized` (identity comparison).

A change to any tuple element invalidates the cache and forces re-arrangement. Because `maximized` is part of the key, maximize/minimize transitions always produce a correct re-layout rather than a stale reuse.

// [LAW:verifiable-goals] The maximize system is machine-checkable: after `maximize(w)` returns, `Screen.maximized === w` (or an ancestor with `ALLOW_MAXIMIZE`, when `container: true`), the screen root has class `-maximized-view`, `w` has class `-maximized`, and the arrangement cache entry for the current `(size, registryVersion, maximized)` tuple exists.

## Mode and Screen Stack Semantics

### Mode model

- Each mode owns an independent screen stack (MobX observable array).
- Exactly one mode is active at a time (MobX observable `activeMode` on app context).
- `switchMode(mode)` is a no-op when the target is already active; otherwise it:
  1. Posts `ScreenSuspend` to the current screen.
  2. Initializes the target mode's stack if absent (mounts the mode's base screen).
  3. Swaps the `activeMode` observable.
  4. Reapplies CSS if the new screen's styles are stale.
  5. Publishes `mode_change_signal` and `screen_change_signal`.
  6. Posts `ScreenResume` to the now-active screen.
- `addMode(name, ScreenComponent)` registers a mode. Rejects: the default mode name, duplicate names, passing a screen instance instead of a component type.
- `removeMode(name)` rejects the active mode. Unmounts and removes all screens in that mode's stack.

### Screen stack operations

All screen stack operations are MobX actions (mutations inside `runInAction`).

- **`pushScreen(screen, callback?, options?)`**: resolves the target mode's stack, posts `ScreenSuspend` to the previously active screen, loads screen-scoped CSS, appends to the stack, renders the new screen via React, posts `ScreenResume` to the new screen, and publishes `screen_change_signal`. If `callback` is provided, it is called with the screen's result when the screen is later popped.
- **`switchScreen(screen)`**: replaces the top of the current mode's stack. No-op if the target is already current; otherwise pops the top (unmounts from React), loads CSS for the new screen, appends it, renders it, posts `ScreenResume`, and publishes `screen_change_signal`.
- **`popScreen()`**: requires stack depth > 1 (throws otherwise). Pops the top screen, unmounts it from React, posts `ScreenResume` to the now-active screen, and publishes `screen_change_signal`. If a callback was registered during push, it is called with the popped screen's `dismiss()` result.
- **`installScreen(screen, name)`**: registers a retained screen component by name in the installed-screens registry. Throws on duplicate name or duplicate component.
- **`uninstallScreen(name)`**: no-op for unknown names. Throws if the screen is still on any mode stack. Otherwise removes it from the installed registry.

`ScreenResume` and `ScreenSuspend` messages notify screens of transitions; `screen_change_signal` and `mode_change_signal` broadcast state to subscribers.

// [LAW:one-source-of-truth] Screen lifetime authority is the per-mode screen stacks (MobX observable arrays) plus the installed-screens registry (MobX observable map); no secondary ownership store exists.

### Screen rendering in React

The `TextualApp` component renders only the active mode's screen stack. The topmost screen is visible; screens below it in the stack are mounted but hidden (they maintain their state). When a screen is popped, it is unmounted from React (React cleanup runs, `useEffect` cleanups fire, widgets deregister from the registry).

```tsx
// Conceptual — inside TextualApp
{activeStack.map((screen, i) => (
  <Box key={screen.id} display={i === activeStack.length - 1 ? 'flex' : 'none'}>
    {screen.component}
  </Box>
))}
```

## Theming and CSS Runtime

### Theme structure

A theme provides a palette of colors and optional extra variables:

```tsx
interface Theme {
  name: string;
  dark: boolean;                      // Whether this is a dark theme
  primary: string | Color;            // Parsed into rich-js Color at registration
  secondary: string | Color;
  accent: string | Color;
  background: string | Color;         // App background
  surface: string | Color;            // Default background
  panel: string | Color;              // Panel / card background
  foreground: string | Color;         // Default text color
  error: string | Color;
  warning: string | Color;
  success: string | Color;
  variables?: Record<string, string | Color>;  // Additional CSS variables
}
```

Color fields accept either a string (hex, rgb, hsl, named) or a rich-js `Color`. At theme registration, strings are parsed into `Color` instances. The framework stores `Color` instances internally — CSS variable resolution works with `Color`, not with raw strings.

### Built-in themes

`BUILTIN_THEMES` exposes the pre-registered themes. At minimum: `"default"` (light), `"dark"`, plus paired variants. `toggle_dark` switches between a theme and its paired opposite.

### Theme lifecycle

- Theme registry: `registerTheme(theme)` / `unregisterTheme(name)`. The currently-selected built-in default cannot be unregistered.
- `theme` reactive property (MobX observable) selects the current theme by name. The MobX `intercept()` validates the name (rejects unknown themes). The `observe()` watcher:
  1. Rebuilds the rich-js `Color` bindings for every theme variable.
  2. Regenerates derived variables (`$primary-lighten-2`, auto-contrast foreground, alpha variants) using `Color.lighten()` / `Color.darken()` / `Color.blend()`.
  3. Updates the stylesheet's CSS variable map.
  4. Clears the stylesheet parse cache and re-applies styles to all widgets on the active screen stack.
  5. Publishes `theme_changed_signal`.
- `dark` is a MobX `computed` derived from `themes[activeTheme].dark`.
- `getCssVariables()` returns the current CSS variable map (variable name → `Color`).
- `refreshCss(animate?)` reparses the stylesheet with css-tree and reapplies styles. When `animate: true`, color-valued property changes animate via the Animator, using rich-js `Color.blend()` for per-frame interpolation. Non-animatable properties snap.

### CSS variables from themes

Theme colors are exposed as CSS variables for use in TCSS:

```css
Screen {
  background: $surface;
  color: $foreground;
}

Button.-primary {
  background: $primary;
  color: auto;   /* auto-contrast from $primary, computed via rich-js Color */
}
```

The `$name` syntax is TCSS shorthand for `var(--theme-name)`. Cascade resolution yields a rich-js `Color` — the final Ink color prop is produced at the render boundary via `Color.toAnsi()` (respecting the active output filter pipeline).

// [LAW:one-source-of-truth] Every color in the app — theme palette, TCSS values, inline styles, widget-local overrides, and content styling — is a rich-js `Color` instance. String forms are parsed at boundaries; they are not a parallel representation.

## Actions and Binding Dispatch

- `runAction(action, defaultNamespace?)` parses the action string and resolves the target namespace. Supported namespaces: `"app"`, `"screen"`, `"focused"`. Falls back to the caller when no namespace is specified.
- Action availability is gated by `checkAction(actionName)`:
  - Returns `true` → action is enabled, binding shown normally.
  - Returns `false` → action is hidden, binding not shown.
  - Returns `null` → action is disabled but visible, binding shown grayed out.
- Dispatch prefers a private handler `_action_<name>` over the public `action_<name>`; the first one found is invoked.
- `SkipAction` thrown inside an action handler is treated as non-handling, allowing higher-level fallback (the binding resolution chain continues).
- Action arguments: action strings can include arguments — `"delete(confirm=true)"` calls `action_delete({ confirm: true })`.

### Built-in app actions

| Action | Description |
|--------|-------------|
| `quit` | Calls `exit()` |
| `toggle_dark` | Toggles `dark` mode by switching between paired light/dark themes |
| `command_palette` | Opens the command palette |
| `dismiss` | Pops the current screen (if stack depth > 1) |
| `focus_next` | Moves focus to the next focusable widget |
| `focus_previous` | Moves focus to the previous focusable widget |
| `bell` | Sound the terminal bell |

// [LAW:single-enforcer] All action invocation flows through `runAction` → `dispatchAction`; there is no parallel path that invokes `action_*` methods directly from input handling.

## Notifications

Notifications are styled, severity-tagged messages rendered as transient toasts by the screen-level `ToastRack`. They use rich-js for content and rich-js `Color` for severity styling.

### Notification model

```tsx
interface Notification {
  id: string;                                    // Unique identifier (auto-generated)
  message: string | Content;                     // Plain string, markup string, or rich-js Content
  title?: string | Content;                      // Optional title (markup-parsed like message)
  severity: 'information' | 'warning' | 'error';
  timeout: number;                               // Auto-dismiss timeout in ms (0 = no auto-dismiss)
  markup: boolean;                               // Parse message/title as rich-js markup (default: true)
  createdAt: number;                             // Timestamp (Date.now())
}
```

### Creating notifications

```tsx
const { notify } = useTextual();

notify('Saved.');                                             // plain
notify('[bold]Saved.[/]');                                    // markup
notify('Connection lost', { severity: 'error', timeout: 0 }); // persistent error
notify(contentValue);                                         // pre-built Content
```

### Notification behavior

- `notify(message, options?)` constructs a `Notification`, adds it to the app-level notification store (MobX observable array), and posts a `Notify` message.
- Markup parsing: when `markup: true` (default), string `message` / `title` are parsed by rich-js into `Content` at render time — not at `notify()` call time. Parse errors fall back to literal rendering and are logged.
- Severity-to-color mapping uses the active theme: information → `$primary`, warning → `$warning`, error → `$error`. These are rich-js `Color` values applied to the toast's `Content`.
- Adding a notification triggers a React re-render of the toast display area (the internal `ToastRack`, not a public widget).
- Notifications expire based on their timeout. Expiry is managed by a framework timer (spec 07) that removes expired entries from the store. Expired entries are dropped on next store access if the timer did not run yet.
- `clearNotifications()` removes all notifications.
- `dismissNotification(id)` removes a single notification by ID. **Known divergence**: upstream only exposes `clear_notifications()` publicly; single-notification removal is private (`_unnotify`). textual-js promotes this to a public API for better ergonomics.
- **Known divergence — units**: timeout values are in milliseconds (upstream uses seconds). This conforms to JS ecosystem conventions where timer APIs universally use ms.
- Notifications added inside a `batchUpdate` batch accumulate; toast re-render happens when the batch flushes.

## Batch Updates

`batchUpdate(fn)` groups multiple state changes into a single render cycle:

```tsx
const { batchUpdate } = useTextual();
batchUpdate(() => {
  store.title = 'New Title';
  store.theme = 'dark';
  // Only one React re-render for both changes
});
```

MobX's `runInAction` provides the primary batching mechanism — all observable mutations inside an action are batched and trigger a single reaction cycle. `batchUpdate` is a convenience wrapper that also defers `checkIdle()` until the batch completes.

### Nested batches

`batchUpdate` is a counted context. The framework maintains a batch counter (a MobX observable integer) on the app context; each call increments on entry and decrements on exit. Layout and repaint work is suppressed while the counter is greater than zero and runs only when the OUTERMOST batch completes (the counter returns to zero).

```tsx
batchUpdate(() => {          // counter: 0 -> 1
  store.a = 1;
  batchUpdate(() => {        // counter: 1 -> 2
    store.b = 2;
  });                        // counter: 2 -> 1  (no flush)
  store.c = 3;
});                          // counter: 1 -> 0  (single flush, all three mutations visible)
```

// [LAW:single-enforcer] The batch counter is the one place that decides whether layout/repaint runs; no callsite inspects "am I inside a batch" independently.

### Delayed update

`delayUpdate(delayMs)` opens a batch that is closed asynchronously:

```tsx
const { delayUpdate } = useTextual();
delayUpdate(250);            // counter: 0 -> 1, suppresses repaints for 250ms
store.title = 'Loading…';    // mutation is observed but not painted
// ... after delayMs: counter: 1 -> 0, screen refresh is forced
```

Contract:
- Increments the batch counter immediately.
- Schedules a timer (via the timer service) that, after `delayMs`, decrements the counter and — if the counter reaches zero — forces a screen refresh.
- Nests with `batchUpdate`: a synchronous outer `batchUpdate` wrapping a `delayUpdate` keeps the counter above zero until the timer fires.
- Cancellation on shutdown: the timer is cleared like any other app timer.

### Batching primitive

Internally all batching is implemented with MobX's `runInAction` plus a framework-level counter. The counter is a MobX observable so widgets can derive from it (e.g., a spinner that shows while a delayed update is pending).

### Shutdown batch

During shutdown, `batchUpdate` is opened and never closed — the counter stays above zero for the remainder of the process, suppressing all subsequent repaint/layout work.

// [LAW:dataflow-not-control-flow] Repaint/layout are unconditional operations driven by the counter's value (zero vs. non-zero). Callers never decide "should I paint?" — they mutate state, and whether paint runs is determined by the data (the counter).

## Print Capture

Widgets can opt in to receiving the process's stdout/stderr output — useful for widgets like `RichLog` that mirror console output inside the TUI. Captured chunks may contain ANSI escape sequences (typical of libraries that write colored output to stdout); rich-js's ANSI parser converts them into `Content` when the capturing widget chooses to preserve styling.

### API

```tsx
const { beginCapturePrint, endCapturePrint } = useTextual();
beginCapturePrint(widget);   // widget now receives Print messages
// ... later
endCapturePrint(widget);     // widget stops receiving Print messages
```

### Message contract

`Print` is a message posted to the capturing widget with:

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | The captured chunk as written (exactly what the caller passed to `process.stdout.write` / `process.stderr.write`). May contain ANSI escape sequences. |
| `stderr` | `boolean` | `true` if the chunk came from stderr; `false` if from stdout. |

One `Print` message is posted per `write` call. Text is not re-buffered or split by lines by the framework — the widget decides how to interpret the chunk (including whether to parse embedded ANSI via rich-js into styled `Content`).

### Capture routing

- The app maintains a MobX observable set of `(widget, streams)` capture registrations.
- `beginCapturePrint(widget)` adds the widget to the set. The first registration installs intercepts on `process.stdout.write` and `process.stderr.write`; subsequent registrations reuse the existing intercepts.
- `endCapturePrint(widget)` removes the widget from the set. When the set becomes empty, the intercepts are uninstalled and the original `write` functions are restored.
- Every `write` call, while the set is non-empty, is delivered to every registered widget as a `Print` message. There is no filtering — all registered widgets see all captured output.

// [LAW:single-enforcer] Stdout/stderr interception is installed at exactly one place (the app's capture registry). Widgets never patch `process.stdout` directly.

// [LAW:dataflow-not-control-flow] The interception code path is the same on every `write`: look up the registration set, post `Print` to each registered widget. Variation lives in the set's contents (empty → no-op delivery loop), not in whether interception runs.

### Widget-level convenience

Widgets typically expose their own `beginCapturePrint()` / `endCapturePrint()` methods as thin wrappers around the app-level API:

```tsx
class RichLog {
  beginCapturePrint() { this.app.beginCapturePrint(this); }
  endCapturePrint() { this.app.endCapturePrint(this); }
  onPrint(msg: Print) {
    // Parse any embedded ANSI into rich-js Content and append
    this.write(parseAnsi(msg.text));
  }
}
```

These wrappers exist for ergonomics; they hold no state of their own — the capture registry on the app is the sole source of truth.

// [LAW:one-source-of-truth] The set of capturing widgets lives only on the app's capture registry. Widget wrappers do not maintain a parallel "am I capturing" flag.

### Shutdown

During shutdown, the capture registry is cleared and the intercepts on `process.stdout.write` / `process.stderr.write` are uninstalled, restoring the originals before the React tree unmounts.

## Suspend and Resume

- `suspend()` publishes `app_suspend_signal`, calls Ink's suspend API to restore normal terminal state, yields control to the caller (for running external programs like editors), then resumes Ink's application mode, publishes `app_resume_signal`, and forces a full re-render.
- This enables patterns like: suspend the app, run `$EDITOR` for the user, resume the app with the edited content.
- While suspended, the animator is paused (no frames scheduled). It resumes on `app_resume_signal`.
- Environments without suspend support (e.g., CI, piped stdin) throw `SuspendNotSupported`.

## Shutdown

`exit(result?, returnCode?)` marks the app for exit, stores the return value, and posts an `ExitApp` message.

Shutdown runs deterministically:

1. Suppress further re-renders (begin a MobX batch/transaction that is never ended).
2. Set `isRunning = false`.
3. Stop the animator — all in-flight animations finalize to their target values; `onComplete` callbacks are scheduled for cleanup but will not fire new work after shutdown begins.
4. Cancel all active workers across all widgets (via WorkerManager cleanup).
5. Clear all timers (including notification expiry, delayUpdate timers, file monitor).
6. Tear down print capture: restore original `process.stdout.write` / `process.stderr.write`.
7. Close all screens: for every mode stack, dispatch `Unmount` to each screen's widgets, unmount from React, clear the stack. Clear installed screens and modes.
8. Dispatch `Unmount` to the app itself.
9. Drain the message queue (process any remaining messages).
10. Call `onExit(result)` callback if provided.
11. Unmount the React component tree (Ink cleanup) — restores terminal to normal mode.

// [LAW:verifiable-goals] Successful shutdown is machine-checkable: `isRunning` is false, every mode stack is empty, installed screens and modes are empty, all workers are cancelled, all timers are cleared, the animator is stopped, stdout/stderr are restored, and the message queue has been drained.

### Return values

`exit(result)` stores a result value that is delivered to:
- The `onExit` prop callback on `TextualApp`
- The `pushScreen` callback (if the screen being exited was pushed with a callback)
- The `runTest()` return value (in test context)

```tsx
// Pushing a screen with a callback
pushScreen(ConfirmDialog, (confirmed: boolean) => {
  if (confirmed) performAction();
});

// Inside ConfirmDialog:
const handleYes = () => dismiss(true);   // true is the result
const handleNo = () => dismiss(false);   // false is the result
```
