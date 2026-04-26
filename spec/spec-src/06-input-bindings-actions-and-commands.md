# Input, Bindings, Actions, and Command System

## Overview

Input arrives from Ink's terminal stdin handling. The framework provides three layers on top:

1. **Bindings**: declarative key-to-action mappings resolved through a priority chain.
2. **Actions**: named methods (`action_<name>`) dispatched by the binding system.
3. **Command palette**: fuzzy-searchable command discovery and execution (powered by uFuzzy).

Ink handles input parsing and key normalization. The framework handles binding resolution, action dispatch, and the command palette.

## Input Flow

```
Terminal stdin
    │
    ▼
Ink useInput() / stdin parser
    │
    ▼
Normalized Key/Mouse event
    │
    ▼
App input router
    ├── Priority bindings check (app → screen → ... → focused)
    │   └── Match found → dispatch action → done
    ├── Forward to focused widget (Key) or target widget (Mouse)
    │   └── Widget handlers → bubble upward
    │       └── At each node: check non-priority bindings
    └── Fallback: key_<name> handler dispatch
```

// [LAW:single-enforcer] Binding evaluation is centralized in `checkBindings` and `activeBindings`. Action dispatch is centralized in `runAction` / `dispatchAction`. No other code path invokes `action_*` methods from input handling.

## Binding Model

### Binding declaration

`Binding` maps a key to an action string with metadata:

```tsx
interface Binding {
  key: string;              // Key name or comma-separated list: "ctrl+s", "f1,question_mark"
  action: string;           // Action string: "save", "app.quit", "focus('input')"
  description?: string | Content; // Human-readable description (shown in Footer)
  show?: boolean;           // Whether to show in Footer (default: true, forced false if description empty)
  priority?: boolean;       // Priority bindings are checked before the event reaches widgets
  system?: boolean;         // System bindings are hidden from the key panel
  keyDisplay?: string;      // Override display text (e.g., "?" instead of "question_mark")
  tooltip?: string | Content; // Tooltip text for the binding
  id?: string;              // Optional ID for keymap overrides
  group?: string;           // Group name for grouped Footer rendering
}
```

Plain `description` / `tooltip` strings render with the ambient Footer or tooltip style. Markup strings are parsed by rich-js at render time, and pre-built `Content` is used directly.

### Declaring bindings

Bindings are declared as static properties on widget, screen, or app components:

```tsx
const MyScreen = observer(() => {
  // ...
});

MyScreen.BINDINGS = [
  { key: 'ctrl+s', action: 'save', description: 'Save' },
  { key: 'ctrl+z', action: 'undo', description: 'Undo' },
  { key: 'escape', action: 'dismiss', description: 'Close' },
  { key: 'f1,question_mark', action: 'help', description: 'Help' }, // Two keys, same action
  { key: 'ctrl+q', action: 'app.quit', description: 'Quit', priority: true },
];
```

Shorthand tuple form is also accepted: `['ctrl+s', 'save', 'Save']` expands to a full Binding.

### Binding expansion

`makeBindings(iterable)` processes binding declarations:

- Accepts `Binding` objects or `[key, action]` / `[key, action, description]` tuples.
- Expands comma-separated key lists into one `Binding` per key: `"f1,question_mark"` → two bindings.
- Strips whitespace from keys.
- Throws `InvalidBinding` on empty keys.
- Promotes single printable characters to their canonical key name: `"?"` → `"question_mark"`.

### BindingsMap

`BindingsMap` stores `keyToBindings: Map<string, Binding[]>` — the same key may have multiple bindings (from different levels of the chain).

| Method | Description |
|--------|-------------|
| `bind(keys, action, ...)` | Programmatic addition |
| `getBindingsForKey(key)` | Returns bindings for a key. Throws `NoBinding` when absent. |
| `shownKeys` | Bindings with `show: true` (for Footer rendering) |
| `merge(maps)` | Flat concatenation of per-key lists across maps. Precedence is determined by iteration order at dispatch time, not by merge. |

## Binding Chain and Dispatch Order

Binding resolution happens on every `Key` event delivered to the App. It follows a hard-coded precedence step followed by a two-phase process:

### Phase 0: Escape-to-minimize (hard-coded precedence)

// [LAW:single-enforcer] Maximize/minimize is owned by the app; Escape's minimize behavior is handled here, not duplicated as a user-defined binding.

Before priority bindings run, the App checks a single hard-coded condition:

- If a widget is currently maximized **and** `ESCAPE_TO_MINIMIZE` is enabled on the app, an `escape` key event is consumed to call `minimize()` on the maximized widget.
- This precedence is fixed — it runs before Phase 1 and takes precedence over user-defined priority bindings for `escape`.
- When no widget is maximized (or `ESCAPE_TO_MINIMIZE` is disabled), Escape flows through the normal binding pipeline unchanged.

This is not a regular binding and cannot be overridden via `App.keymap`. It is the single authoritative exit from the maximized state.

### Phase 1: Priority bindings

Walk the binding chain from App → Screen → ... → focused widget. Check only bindings with `priority: true`. First match fires the action. If no priority binding matches, proceed to Phase 2.

### Phase 2: Normal bindings (during bubble)

The key event is forwarded to the focused widget (or screen if nothing is focused). As the event bubbles upward through the widget tree, non-priority bindings are checked at each node. The binding chain is truncated at the nearest ancestor with `isModal: true` (inclusive), so modal screens contain their key handling.

### Binding chain construction

| Scenario | Chain (first checked to last) |
|----------|-------------------------------|
| Widget focused | focused → parent → ... → screen → app |
| No widget focused | screen → app |
| Modal screen | focused → parent → ... → modal screen (stops here) |

### Keymap overrides

// [LAW:one-source-of-truth] `App.keymap` is the single authoritative source of user-facing key rebindings. Bindings themselves declare intent via `id`; the keymap is applied uniformly as the chain is assembled.

The keymap mechanism allows user/app configuration to rewrite which key triggers a given binding without editing the binding declaration:

- Only bindings declared with an `id` field are eligible for keymap overrides. Bindings without an `id` are never rewritten.
- `App.keymap` (or equivalent configuration) is a `Map<string, string>` (or plain record) mapping binding IDs to replacement key strings (same grammar as `Binding.key`, e.g. `"ctrl+s"`, `"f2,alt+s"`).
- When the screen's binding chain is assembled, every `BindingsMap` in the chain is run through the keymap: any binding whose `id` matches a keymap entry has its `key` rewritten to the replacement. Expansion of comma-separated keys happens after rewriting, identical to the normal `makeBindings` path.
- If a keymap override targets a key that already has bindings on the same namespace (the same `BindingsMap`), the pre-existing bindings on that key are collected as **clashes**. Clashes are removed from the map (the new override wins) and reported to `app.handleBindingsClash(clashes, namespace)`.
- `handleBindingsClash` has a default implementation that is a no-op. Subclasses may observe and surface warnings.
- Clashes are reported **once per namespace per chain assembly** — re-assembling the chain (e.g., focus change) is a new reporting cycle, but within one assembly each namespace reports at most one clash batch.

```tsx
// [LAW:one-source-of-truth] `id` is the stable handle; `key` is a derived/configurable surface.
MyScreen.BINDINGS = [
  { id: 'save', key: 'ctrl+s', action: 'save', description: 'Save' },
  { id: 'help', key: 'f1', action: 'help', description: 'Help' },
  { key: 'ctrl+q', action: 'app.quit' }, // No id — cannot be keymap-overridden
];

// In app configuration:
App.keymap = new Map([
  ['save', 'ctrl+shift+s'], // Rewrite save to a new key
  ['help', '?'],            // Promoted to question_mark
]);
```

### Active bindings (for Footer display)

`activeBindings` walks the modal binding chain and produces the de-duplicated binding map used by the Footer widget:

- Within a key, the first binding encountered wins unless a later binding has `priority: true` and the incumbent does not.
- Each binding is filtered through `checkAction(action, params)`:

| Return value | Effect |
|-------------|--------|
| `true` | Binding included and enabled |
| `null` | Binding included but disabled (grayed-out in Footer) |
| `false` | Binding omitted entirely |

`null` means disabled but visible, `false` means hidden.

## Action Parsing and Dispatch

### Action string format

`parseAction(action)` returns `{ namespace, actionName, params }`:

| Input | Parsed result |
|-------|---------------|
| `"quit"` | `{ namespace: "", actionName: "quit", params: [] }` |
| `"focus('input')"` | `{ namespace: "", actionName: "focus", params: ["input"] }` |
| `"app.quit"` | `{ namespace: "app", actionName: "quit", params: [] }` |
| `"screen.dismiss()"` | `{ namespace: "screen", actionName: "dismiss", params: [] }` |
| `"delete(confirm=true)"` | `{ namespace: "", actionName: "delete", params: [{ confirm: true }] }` |

- Malformed argument lists throw `ActionError`.
- Unknown namespace names throw `ActionError`. Valid namespaces: `"app"`, `"screen"`, `"focused"`.

### Dispatch flow

`runAction(action, defaultNamespace?)`:

1. **Parse**: extract `{ target, actionName, params }`. Target resolved by:
   - Named namespace (`"app"`, `"screen"`, `"focused"`) → the corresponding object.
   - No namespace → `defaultNamespace`, or the caller if unspecified.
2. **Gate**: `target.checkAction(actionName, params)`. Falsy/null return aborts — `runAction` returns `false`.
3. **Invoke**: look up `_action_<name>` first, then `action_<name>` on the target. Invoke the first found with `...params`. Returns `true` on success, `false` if neither exists.

`SkipAction` thrown inside an action method is caught and treated as "not handled" — allows higher-level bindings to run.

### Defining actions

Actions are methods on a widget's handler object or store:

```tsx
const MyScreen = observer(() => {
  const { postMessage } = useTextual();

  const handlers = {
    action_save() {
      // Perform save
      postMessage(new SaveCompleted());
    },

    action_focus(selector: string) {
      // Focus a widget by selector
      const target = queryOne(selector);
      if (target) setFocus(target);
    },

    checkAction(name: string): boolean | null {
      if (name === 'save') {
        return hasUnsavedChanges ? true : null; // Disabled when nothing to save
      }
      return true;
    },
  };

  return <Screen handlers={handlers}>...</Screen>;
});
```

## Key Name Normalization and Aliases

### Normalization

Ink's stdin parser delivers key names. The framework normalizes them to canonical forms before the binding layer sees them:

| Raw input | Canonical name |
|-----------|----------------|
| `?` | `question_mark` |
| `!` | `exclamation_mark` |
| `@` | `at` |
| `/` | `forward_slash` |
| `\` | `backslash` |
| `Return` | `enter` |
| `Esc` | `escape` |
| Ctrl+C | `ctrl+c` |
| Shift+Tab | `shift+tab` |

Single printable characters in binding declarations are promoted to their canonical name, so `["?", "help"]` and `["question_mark", "help"]` are equivalent.

### Key aliases

Key names may have aliases — ordered lists of handler method suffixes that `dispatchKey` tries:

| Key | Aliases tried |
|-----|---------------|
| `ctrl+c` | `ctrl_c` |
| `f1` | `f1` |
| `enter` | `enter`, `return` |
| `escape` | `escape`, `esc` |

## Widget-Level Key Handler Dispatch

`dispatchKey(widget, event)` is the fallback after binding resolution fails — it checks for a `key_<name>` handler method directly on the widget:

1. Returns `false` immediately if `event.name` is empty.
2. Iterates `event.nameAliases` and for each alias looks up `key_<alias>` on the widget's handler object.
3. If more than one alias resolves to a handler, throws `DuplicateKeyHandlers`.
4. A handler returning `false` explicitly is treated as not handled (event continues to bubble). Any other return value (including `undefined`) counts as handled.

```tsx
// Direct key handler — bypasses the binding system
const handlers = {
  key_enter() {
    // Handle Enter key directly
    activateCurrentItem();
  },

  key_escape() {
    return false; // Explicitly not handled — let it bubble
  },
};
```

## Command Palette

The command palette provides fuzzy-searchable command discovery and execution. It is opened by a key binding (default: `ctrl+p`) and displayed as a pushed screen.

### Provider contract

Command providers supply commands to the palette:

```tsx
interface Provider {
  // Called when the palette opens
  startup?(): Promise<void>;

  // Called when the palette closes
  shutdown?(): Promise<void>;

  // Return commands matching the query (async iterable)
  search(query: string): AsyncIterable<Hit>;

  // Return commands to show when query is empty (discovery mode)
  discover?(): AsyncIterable<DiscoveryHit>;
}

interface Hit {
  score: number;             // Match quality (higher = better)
  matchDisplay: VisualInput; // Display value shown in the palette
  text?: string;             // Plain-text search key; required for non-text displays
  command: () => void;       // Callback to execute when selected
  helpText?: string;         // Additional description
}

interface DiscoveryHit {
  display: VisualInput;   // Display value shown in the palette
  text?: string;          // Plain-text search/display key when display is non-textual
  command: () => void;    // Callback to execute
  helpText?: string;      // Additional description
}
```

- When the query is empty, `discover()` is called for default/recent commands.
- When the query has text, `search()` is called with fuzzy matching via **uFuzzy**.

### Provider resolution

- Provider set: `Screen.COMMANDS` union with `App.COMMANDS`.
- Overriding app-level `COMMANDS` replaces the app's default provider set. Screen-level providers are added by union.
- `ENABLE_COMMAND_PALETTE` gates availability.
- `COMMAND_PALETTE_BINDING` (default: `ctrl+p`) defines the launch key.

### Palette options

| Option | Default | Effect |
|--------|---------|--------|
| `runOnSelect` | `true` | When `true`, selecting a command immediately executes it and dismisses the palette. When `false`, selection only highlights the result; a separate confirmation step (pressing Enter again, or a second click) is required to execute. Useful for preview-then-confirm palettes. |
| `noMatchesTimeout` | ~250ms | Delay before the "No matches found" entry appears after a query returns zero results (see below). **Intentional divergence**: this timeout value is a textual-js UX choice; upstream Textual does not have this specific debounce behavior. |

// [LAW:dataflow-not-control-flow] `runOnSelect` selects between two fixed dispatch paths — single-step or two-step — rather than branching in event handlers. The same "select" event fires either way; the option decides whether "execute" follows.

### Runtime behavior

- Discovery hits are visible immediately when the palette opens.
- Results are gathered concurrently from all providers and streamed into the result list in batches.
- Fuzzy matching uses **uFuzzy** against the hit's plain-text `text` value. If a hit's display value is not directly textual, the provider must supply `text`; the framework does not flatten arbitrary renderables for search.
- uFuzzy returns match ranges as `[start, end]` pairs per command. The framework may convert those ranges into styled text for textual displays, or keep the provider's display visual intact and use `text` solely for ranking/matching.
- Keyboard navigation: Up/Down to select, Enter to execute (or Enter to confirm when `runOnSelect` is `false`), Escape or click-away to dismiss.
- Executing a command closes the palette and invokes the hit's callback (subject to `runOnSelect`).

### "No matches" countdown

// [LAW:dataflow-not-control-flow] The countdown is a fixed data-driven transition (`pending` → `shown`/`cleared`), not a conditional skip of the empty-state UI. The timer always starts; the arriving data always cancels or commits it.

When a typed query returns zero results, the palette does **not** immediately show "No matches found." A short countdown timer (`noMatchesTimeout`, default ~250ms) gates the message so fast typing does not flash it:

- On every query change that yields zero results, the countdown (re)starts.
- If any result arrives during the countdown, the countdown is canceled and the message is never shown for that query.
- If the countdown completes with the result set still empty, a disabled **"No matches found"** entry is appended to the result list.
- This entry is non-selectable: keyboard selection skips over it, and clicking / pressing Enter on it is a no-op. It carries no `command` callback.
- The entry's display is rich-js `Content` using a component class such as `command-palette--no-matches`, allowing TCSS to theme it as dimmed, italic, or otherwise visually distinct.
- Typing a new query clears the entry and resets the cycle.

### System commands provider

The built-in system commands provider drives both `discover()` and `search()` from `App.getSystemCommands(screen)`:

```tsx
interface SystemCommand {
  name: VisualInput;      // Command display value
  text?: string;          // Plain-text matching key when name is non-textual
  helpText: string | Content; // Description
  callback: () => void;   // What to execute
  discover: boolean;      // Whether to show in discovery (empty query) mode
}
```

Strings without markup syntax render as plain text; markup strings are parsed via rich-js at render time; `Content` is used directly; rich-js renderables remain renderables. Discovery yields only commands with `discover: true`. Search fuzzy-matches the resolved `text` value for each command.

## Built-in App-Level Actions

| Action | Description | Default binding |
|--------|-------------|-----------------|
| `action_quit` | Exit the app | `ctrl+q` |
| `action_bell` | Terminal bell | — |
| `action_focus(selector)` | Focus widget matching selector | — |
| `action_focus_next` | Focus next widget in chain | `tab` |
| `action_focus_previous` | Focus previous widget in chain | `shift+tab` |
| `action_switch_screen(name)` | Switch to named screen | — |
| `action_push_screen(name)` | Push named screen | — |
| `action_pop_screen` | Pop current screen | — |
| `action_switch_mode(name)` | Switch to named mode | — |
| `action_back` | Pop screen or switch to previous mode | — |
| `action_add_class(selector, class)` | Add CSS class to matching widgets | — |
| `action_remove_class(selector, class)` | Remove CSS class from matching widgets | — |
| `action_toggle_class(selector, class)` | Toggle CSS class on matching widgets | — |
| `action_toggle_dark` | Toggle dark/light theme | `ctrl+d` |
| `action_notify(message)` | Show a notification | — |
| `action_command_palette` | Open the command palette | `ctrl+p` |
| `action_dismiss` | Dismiss (pop) the current screen | `escape` |

## Input Event Routing Summary

### Key events

1. Ink delivers normalized key event to the App.
2. App checks priority bindings (walking the full binding chain). If a priority binding matches and its action succeeds, the event is consumed.
3. If not consumed, the event is forwarded to the focused widget.
4. The widget's `on<Key>` handler runs (if defined). If it calls `stop()`, processing ends.
5. If not stopped, the event bubbles upward. At each ancestor, non-priority bindings are checked.
6. If still not consumed after bubbling, `dispatchKey` tries `key_<name>` handlers.
7. If nothing handled the key, it is ignored.

### Mouse events

1. Ink delivers mouse event with position to the App.
2. App updates internal mouse position tracking.
3. Mouse event is forwarded to the active screen for routing to the target widget (based on position).
4. `MouseDown` / `MouseUp` on the same widget synthesizes a `Click` message.
5. Widget `disabled` state suppresses most mouse interactions except scroll-wheel pass-through.
6. Mouse capture: while a widget has capture, all mouse events route to it regardless of position.

### Focus events

1. When `setFocus(widget)` is called on the focus manager:
2. Previous widget receives `Blur` message. Its `:focus` pseudo-class is cleared.
3. New widget receives `Focus` message. Its `:focus` pseudo-class is set.
4. `DescendantBlur` bubbles from the old widget upward. `DescendantFocus` bubbles from the new widget upward.
5. TCSS recalculation runs for widgets affected by `:focus` / `:focus-within` selectors.

// [LAW:dataflow-not-control-flow] The input routing pipeline is fixed: normalize → priority check → forward → bubble → fallback. The data (key name, binding declarations, handler methods) determines outcomes, not conditional branches in the routing logic.
