# Textual-JS: Implementation Status & Phase Plan

This document evaluates what exists in `src/` against the behavior specified in `spec/`, identifies every gap, and lays out the remaining implementation as a sequence of phases.

## Current Implementation Status

### What Exists (Phase 0 — Complete)

The initial commit established the **structural skeleton**: the five-layer runtime topology (MessagePump → DOMNode → Widget → Screen → App), geometry primitives, layout strategies, and the reactive property system.

| Module | File(s) | Status | Notes |
|--------|---------|--------|-------|
| **MessagePump** | `events/message-pump.ts` | Core complete | Queue, coalescing, handler resolution (`_on`/`on` naming), bubbling, timers, `callLater` |
| **Message** | `events/message.ts` | Complete | `messageId`, `bubble`, `canReplace`, `stop`, `preventDefault`, `forwarded`, sender tracking |
| **Built-in Events** | `events/events.ts` | Stubs only | Types declared (`Compose`, `Mount`, `Unmount`, `Focus`, `Blur`, `Resize`, `Idle`, `Key`, `Mouse*`, `Click`, `ScrollEvent`) but no driver wiring |
| **DOMNode** | `dom-node.ts` | Core complete | Tree linkage, CSS identity (id, classes, typeName, cssPath), traversal (depth/breadth), class mutation, refresh seam |
| **NodeList** | `node-list.ts` | Core complete | Ordered children, ID fast-path lookup, update counter, duplicate-ID detection |
| **Widget** | `widget.ts` | Core complete | `compose()`, `render()`, `arrange()`, focus/display/visible state, scroll offset, virtual size, mount/remove |
| **Screen** | `screen.ts` | Core complete | Focus management (`setFocus`, `focusNext`, `focusPrevious`), focus chain |
| **App** | `app.ts` | Core complete | Screen stack (push/pop/switch), `run()`, `createDefaultScreen()`, `handleResize()`, `exit()` |
| **Geometry** | `geometry/*.ts` | Complete | `Size`, `Offset`, `Region`, `Spacing` — immutable, full operator set |
| **Reactive** | `reactive.ts` | Partial | `getReactive`, `setReactive`, `watchReactive` work; missing validators, computed properties, `init` watcher firing, decorator-based API |
| **Layout** | `layout/*.ts` | Partial | `VerticalLayout` (1-height stacks), `HorizontalLayout` (equal-width), `GridLayout` (2D cell-map with spanning); all use fixed sizing — no style-driven dimensions |
| **Tests** | — | None | Zero test files exist |

### What Is Specified But Not Implemented

Mapped from `spec/spec-src/` sections:

| Spec Area | Spec File(s) | Gap Summary |
|-----------|-------------|-------------|
| **CSS Engine** | `04-styling-and-css-engine.md` | No CSS parser, no selector matching, no stylesheet application, no `ResolvedStyles`, no cascade/specificity |
| **Query API** | `02-dom-reactivity-and-query.md` | No `query()`, `query_one()`, `query_ancestor()`, no `DOMQuery` chaining, no selector-based filtering |
| **Reactive Pipeline** | `02-dom-reactivity-and-query.md` | No validators, no computed properties, no `init` watcher dispatch, no decorator-based `@reactive` |
| **Compositor** | `05-layout-render-and-compositor.md` | No visibility map, no dirty-region tracking, no region-to-span conversion, no `CompositorUpdate` output |
| **Style-Driven Layout** | `05-layout-render-and-compositor.md` | Layouts hard-code sizes; no `fr`/`%`/`auto` sizing, no dock, no min/max constraints |
| **Input/Bindings/Actions** | `06-input-bindings-actions-and-commands.md` | No `Binding`, no action dispatch, no key normalization, no command palette |
| **Workers/Timers/Signals** | `07-workers-timers-and-signals.md` | No `Worker`, no `WorkerManager`, no `Signal` pub/sub (timers exist but are basic `setInterval` wrappers) |
| **Driver Interface** | `08-drivers-io-and-platform-behavior.md` | No `Driver` base class, no `process_message` normalization boundary, no headless driver |
| **Widget Base Contract** | `09-widget-base-contract.md` | No disabled-state event gating, no `_forward_event`, no loading state, no tooltip surface |
| **Built-in Widgets** | `10-widget-catalog.md` | No `Button`, `Input`, `Label`, `Static`, `ListView`, `DataTable`, `Tree`, `TextArea`, etc. |
| **Text Editing** | `11-text-editing-and-document-model.md` | No `Document`, no `WrappedDocument`, no navigator/history |
| **Supporting Subsystems** | `12-supporting-subsystems.md` | No themes, no notifications, no validation framework, no suggestions/completion |
| **Testing Surface** | `13-testability-and-automation-surfaces.md` | No `run_test()`, no `Pilot` automation harness |
| **Modes** | `01-runtime-app-and-lifecycle.md` | No mode stacks, no `MODES` declaration, no mode-specific screen management |
| **Notifications** | `01-runtime-app-and-lifecycle.md`, `12` | No `Notification` model, no `Notifications` collection, no `notify()` |
| **Animation** | `12-supporting-subsystems.md` | No `Animator`, no CSS transitions, no `animate()` |
| **Scrolling** | `05-layout-render-and-compositor.md` | Scroll offset exists as state but no scroll behavior, no scroll containers, no scroll-aware compositor |

---

## Phase Plan

Phases are ordered by dependency: each phase builds only on what prior phases deliver. No phase reaches backward.

### Phase 1 — Testing Foundation & Reactive Completion

**Goal**: Establish the test harness and complete the reactive pipeline so all subsequent phases can be verified mechanically.

**Why first**: Every subsequent phase needs tests. The reactive system underpins styling, widgets, and data binding — completing it now prevents rework.

**Deliverables**:
- **`run_test()` harness**: headless app runner that creates an App, composes, mounts, processes messages, and returns control to the test. No driver needed yet — this is purely in-process.
- **`Pilot` (minimal)**: programmatic API for `pilot.press()`, `pilot.click()`, `pilot.resize()` that post messages directly. No terminal I/O.
- **Reactive validators**: `validate_<name>` naming convention, called before storage, can reject or transform values.
- **Reactive computed properties**: `compute_<name>` naming convention, recalculated when dependencies change.
- **Reactive `init` dispatch**: watchers fire on first mount when `init: true`.
- **Tests**: Cover MessagePump dispatch, coalescing, bubbling, handler resolution; DOMNode tree operations; reactive get/set/watch/validate/compute; geometry operators; layout strategies; App lifecycle; Screen focus management.

**Spec coverage**: `spec-src/13`, `spec-src/02` (reactive sections), `spec-tests/reactivity.md`, `spec-tests/events_and_messages.md`.

---

### Phase 2 — CSS Engine & Query API

**Goal**: Parse TCSS, match selectors against the DOM, apply styles, and provide the query API.

**Why now**: Styles drive layout dimensions, widget appearance, and the cascade. Queries are the primary DOM traversal API for both user code and internal subsystems.

**Deliverables**:
- **CSS parser**: Tokenize and parse Textual CSS (subset of CSS with Textual extensions). Produce a stylesheet AST.
- **Selector matching**: Type, class, ID, pseudo-class, combinators (descendant, child, sibling). Match against `DOMNode.cssPath`.
- **`ResolvedStyles`**: Per-widget derived style snapshot — the single read-only output of the cascade. Properties for box model, colors, text style, layout hints (`dock`, `width`, `height`, `min-width`, `max-width`, `margin`, `padding`, etc.). The widget's `styles` field is the single writable input surface.
- **Stylesheet application**: Parse `DEFAULT_CSS` and `CSS` class variables, apply cascade with specificity + rule origin (including inline `widget.styles` at the highest precedence), produce `ResolvedStyles` per node.
- **`initial` reset**: Property-sensitive fallback (not blanket class-default reset — per uber-divergence resolution).
- **Query API**: `query(selector)`, `query_one(selector)`, `query_ancestor(selector)` on DOMNode. Return `DOMQuery` with `.first()`, `.last()`, `.filter()`, `.exclude()`, `.results()`. `InvalidQueryFormat` on malformed selectors.
- **Tests**: CSS parsing round-trips, selector matching, specificity ordering, query results, `InvalidQueryFormat` errors.

**Spec coverage**: `spec-src/04`, `spec-src/02` (query sections), `spec-tests/css_parsing.md`, `spec-tests/css_styles.md`, `spec-tests/dom.md`.

---

### Phase 3 — Style-Driven Layout & Compositor

**Goal**: Layouts read from `ResolvedStyles` instead of hard-coded sizes. The compositor converts placements to renderable output.

**Why now**: Depends on Phase 2 (styles exist). Required before any widget can render correctly.

**Deliverables**:
- **Style-driven sizing**: Layout strategies read `width`, `height`, `min-width`, `max-width`, `min-height`, `max-height` from `ResolvedStyles`. Support `fr`, `%`, `auto`, and fixed units.
- **Box model**: `margin` and `padding` from styles applied during layout. `border` reserves space.
- **Dock layout**: `dock: top | bottom | left | right` extracted from styles, widgets removed from flow and placed at edges.
- **Scroll containers**: Widgets with `overflow: scroll | auto` get virtual-size tracking, scroll offset application in placement.
- **Compositor**: Takes `WidgetPlacement[]` from layout, builds visibility map (which widget is visible at each cell), tracks dirty regions, produces `CompositorUpdate` segments for the renderer.
- **Region-to-span conversion**: Translate 2D regions into 1D line spans for terminal-style output.
- **Tests**: Style-driven sizing, dock placement, scroll offset, compositor visibility, dirty-region tracking.

**Spec coverage**: `spec-src/05`, `spec-tests/layouts.md`, `spec-tests/compositor.md`, `spec-tests/scrolling.md`.

---

### Phase 4 — Driver Interface & Input Pipeline

**Goal**: Define the driver boundary, normalize input, and wire key/mouse events from external sources into the message system.

**Why now**: Depends on Phase 3 (compositor produces output for drivers to consume). This phase closes the input→dispatch→render loop.

**Deliverables**:
- **`Driver` base class**: Abstract interface with `start()`, `stop()`, `write(updates)`, `process_message(event)` as the single input-normalization boundary.
- **`HeadlessDriver`**: In-memory driver for testing — captures output, provides programmatic input. Replaces the minimal `Pilot` from Phase 1 with full driver semantics.
- **Input normalization**: `process_message` converts raw input into normalized `Key`, `Mouse*`, `Click`, `ScrollEvent` messages. Key name normalization (e.g., `ctrl+c`, `escape`, `tab`).
- **Event routing**: `App.on_event` routes to screen → focused widget or mouse-target widget. Mouse hit-testing against compositor visibility map.
- **Focus/blur events**: `Focus` and `Blur` posted when `Screen.setFocus` changes target.
- **Tests**: Driver lifecycle, input normalization, event routing, focus transitions, mouse hit-testing.

**Spec coverage**: `spec-src/08`, `spec-src/03` (dispatch routing), `spec-tests/driver.md`, `spec-tests/input.md`.

---

### Phase 5 — Bindings, Actions & Widget Base Contract

**Goal**: Key bindings trigger named actions. The widget base contract gets disabled-state gating and loading state.

**Why now**: Depends on Phase 4 (input events exist). Required before built-in widgets can have interactive behavior.

**Deliverables**:
- **`Binding`**: Declarative key-to-action mapping. `BINDINGS` class variable on Widget/Screen/App. Priority resolution (widget → screen → app).
- **Action dispatch**: `action_<name>` method resolution. Namespace support (`app.action_name`, `screen.action_name`).
- **`check_action`**: `True` = enabled, `False` = hidden, `None` = disabled but visible (per uber-divergence resolution).
- **Disabled-state event gating**: Disabled widgets suppress pointer interactions except wheel scroll. `_forward_event` for event delegation.
- **Loading state**: `loading` reactive property, loading overlay suppresses interaction.
- **Tooltip surface**: `tooltip` reactive property, tooltip message posting.
- **Tests**: Binding resolution, action dispatch, `check_action` states, disabled-state gating, loading overlay.

**Spec coverage**: `spec-src/06` (bindings/actions), `spec-src/09`, `spec-tests/bindings_and_actions.md`, `spec-tests/widget.md`.

---

### Phase 6 — Core Built-in Widgets (Tier 1)

**Goal**: Deliver the foundational widget set that most applications need.

**Why now**: Depends on Phases 2–5 (styles, layout, input, bindings). These widgets are the building blocks for higher-level widgets.

**Deliverables**:
- **`Static`**: Non-interactive text display. Renders rich text content. Updates via `update()`.
- **`Label`**: Single-line text with markup support.
- **`Button`**: Focusable, clickable, posts `Button.Pressed` message. Supports `variant` (default, primary, success, warning, error).
- **`Input`**: Single-line text input. Cursor management, selection, clipboard placeholder. Posts `Input.Changed`, `Input.Submitted`.
- **`Switch`**: Toggle control. Posts `Switch.Changed`.
- **`Checkbox`**: Checkable control. Posts `Checkbox.Changed`.
- **`RadioButton` / `RadioSet`**: Mutually exclusive selection.
- **`ProgressBar`**: Determinate/indeterminate progress display.
- **Tests**: Each widget tested for compose, render, message posting, keyboard interaction, focus behavior.

**Spec coverage**: `spec-src/10` (catalog entries), `spec-tests/button.md`, `spec-tests/input.md`, `spec-tests/checkbox.md`, etc.

---

### Phase 7 — Container Widgets & Scrolling

**Goal**: Deliver container widgets that manage child visibility and scrolling.

**Why now**: Depends on Phase 6 (child widgets exist to contain). Scroll behavior depends on Phase 3 compositor.

**Deliverables**:
- **`ScrollableContainer`**: Vertical/horizontal scroll with scroll bars. Keyboard and mouse wheel scrolling.
- **`Vertical` / `Horizontal`**: Flow containers with CSS-driven sizing.
- **`ContentSwitcher`**: Shows one child at a time by ID. Constructor-time children without IDs are tolerated; `add_content` requires ID (per uber-divergence resolution).
- **`Collapsible`**: Expandable/collapsible content region.
- **`TabbedContent` / `Tabs` / `Tab` / `TabPane`**: Tabbed interface. `Tabs.hide()`/`show()` and `TabbedContent.hide_tab()`/`show_tab()` as layered APIs (per uber-divergence resolution).
- **Tests**: Scroll position, content switching, tab activation, collapsible toggle.

**Spec coverage**: `spec-src/10` (container entries), `spec-tests/containers.md`, `spec-tests/scrolling.md`, `spec-tests/tabs_and_tabbed_content.md`.

---

### Phase 8 — Workers, Signals & Timers

**Goal**: Async task management and pub/sub event coordination.

**Why now**: Depends on Phase 1 (MessagePump). Required before data-loading widgets (DataTable, Tree) and mode transitions.

**Deliverables**:
- **`Worker`**: Managed async task with lifecycle (pending → running → success/error/cancelled). `run_worker()` and `@work` decorator equivalent. Thread/process isolation via Web Workers or Node worker_threads.
- **`WorkerManager`**: Owns all workers for a widget. Lifecycle cleanup on unmount.
- **`Signal`**: Typed pub/sub. Weak-reference subscriber cleanup. `immediate` dispatch option. App-level signals: `theme_changed_signal`, `app_suspend_signal`, `app_resume_signal`, `mode_change_signal`, `screen_change_signal`.
- **Enhanced Timers**: Named timer management integrated with MessagePump lifecycle. Timer pause/resume.
- **Tests**: Worker lifecycle, cancellation, error propagation, signal subscribe/unsubscribe/publish, timer management.

**Spec coverage**: `spec-src/07`, `spec-tests/workers.md`, `spec-tests/reactivity.md` (signal sections).

---

### Phase 9 — Modes, Notifications & Themes

**Goal**: Multi-mode screen management, notification system, and theme engine.

**Why now**: Depends on Phase 8 (signals for mode/screen change notification). Themes depend on Phase 2 (CSS engine).

**Deliverables**:
- **Modes**: `MODES` class variable mapping mode names to Screen classes. `switch_mode()`, `add_mode()`, `remove_mode()`. Per-mode screen stacks.
- **Notifications**: `Notification` model with identity and severity. `Notifications` collection with pruning. `notify()` on DOMNode funnels to App. `clear_notifications()`, `_unnotify()`.
- **Toast presentation**: Internal toast widget for notification display (internal, not public API — per uber-divergence resolution).
- **Theme engine**: Named themes with color palettes. `theme_changed_signal`. `App.theme` reactive property. CSS variable resolution from theme.
- **Tests**: Mode switching, screen stack per mode, notification lifecycle, theme application, CSS variable resolution.

**Spec coverage**: `spec-src/01` (modes), `spec-src/12` (themes, notifications), `spec-tests/notifications.md`, `spec-tests/app.md`.

---

### Phase 10 — Validation, Suggestions & Command Palette

**Goal**: Input validation framework, autocomplete suggestions, and the command palette.

**Why now**: Depends on Phase 6 (`Input` widget), Phase 8 (workers for async validation), Phase 9 (themes for palette styling).

**Deliverables**:
- **Validation framework**: `Validator` base class. Built-in validators (`Number`, `Integer`, `URL`, `Regex`, `Length`, `Function`). `validate_on` control (blur, changed, submitted). `valid_empty` flag. CSS class toggling (`-valid`, `-invalid`).
- **Suggester**: Autocomplete provider. Cache with case-insensitive normalization. `SuggestionReady` message. Prefix-match completion.
- **Command palette**: `CommandPalette` screen. `Provider` base class. `COMMANDS` class variable on App/Screen. Provider replacement semantics (per uber-divergence). Discovery mode with immediate visibility (per uber-divergence). Search, fuzzy matching, result highlighting. Click-away dismissal.
- **Tests**: Validator lifecycle, `valid_empty`, CSS class toggling, suggester cache, command palette provider resolution, discovery visibility.

**Spec coverage**: `spec-src/06` (commands), `spec-src/12` (validation, suggestions), `spec-tests/input_validation.md`, `spec-tests/suggester.md`, `spec-tests/command_palette.md`.

---

### Phase 11 — Complex Built-in Widgets (Tier 2)

**Goal**: Data-rich and interactive widgets that build on the full framework.

**Why now**: Depends on Phases 6–10 (scrolling, workers, validation, themes).

**Deliverables**:
- **`ListView` / `ListItem`**: Virtualized vertical list. Keyboard navigation. Selection. Posts `ListView.Selected`, `ListView.Highlighted`.
- **`DataTable`**: Tabular data display with columns, rows, cells. Sorting. Row/column/cell cursors. Fixed rows/columns. Keyboard navigation.
- **`Tree` / `TreeNode`**: Hierarchical data display. Lazy loading via workers. Expand/collapse. Posts `Tree.NodeSelected`, `Tree.NodeExpanded`.
- **`Select` / `SelectionList`**: Dropdown selection. Multi-select. Overlay positioning.
- **`OptionList`**: Scrollable option list with separators and highlights.
- **`RichLog`**: Append-only log display with auto-scroll. Rich text rendering.
- **`Sparkline`**: Inline data visualization. `width=None` uses render width, default reduction is `max` (per uber-divergence).
- **Tests**: Virtualization, keyboard navigation, data binding, lazy loading, selection state.

**Spec coverage**: `spec-src/10` (catalog), `spec-tests/list_view.md`, `spec-tests/data_table.md`, `spec-tests/tree.md`, `spec-tests/option_list.md`.

---

### Phase 12 — Text Editing & Document Model

**Goal**: Full text editing subsystem with document abstraction, navigation, and history.

**Why now**: Depends on Phase 6 (Input), Phase 3 (scroll/compositor), Phase 5 (bindings). TextArea is one of the most complex widgets.

**Deliverables**:
- **`Document`**: Line-based text model. Insert, replace, delete operations with offset tracking. Newline normalization. API edits while `read_only=True`.
- **`WrappedDocument`**: Word-wrap aware document view.
- **Navigator**: Cursor movement (character, word, line, page, home, end). Selection ranges.
- **History**: Undo/redo stack with edit grouping.
- **`TextArea`**: Multi-line text editor widget. Syntax-aware documents. Theme/language registration. Selection, clipboard, find/replace.
- **Tests**: Document operations, cursor navigation, undo/redo, word wrap, syntax highlighting, read-only mode.

**Spec coverage**: `spec-src/11`, `spec-tests/text_area.md`, `spec-tests/document.md`.

---

### Phase 13 — Animation & CSS Transitions

**Goal**: Smooth property transitions and programmatic animation.

**Why now**: Depends on Phase 2 (styles), Phase 8 (timers for animation scheduling). Lower priority — the framework is fully functional without animation.

**Deliverables**:
- **`Animator`**: Manages active animations. Easing functions. Duration, delay. `animate()` API on Widget.
- **CSS transitions**: `transition` property in TCSS. Automatic animation on style changes.
- **`force_stop_animation`**: Schedules `on_complete` via `call_later` (per uber-divergence resolution), not direct invocation.
- **Timing authority**: Single source of timing truth for all animation.
- **Tests**: Animation start/complete, easing, CSS transition triggers, `force_stop_animation` callback scheduling.

**Spec coverage**: `spec-src/12` (animation), `spec-tests/animations.md`.

---

### Phase 14 — Platform Drivers

**Goal**: Concrete driver implementations for terminal and browser environments.

**Why now**: Depends on Phase 4 (driver interface). This is the last phase because textual-js is designed as a **headless** framework — real drivers are the outermost shell.

**Deliverables**:
- **Terminal driver** (Node.js): Raw mode stdin/stdout. ANSI escape sequence output. xterm-compatible input parsing. Resize detection via `SIGWINCH`.
- **Browser driver** (DOM): Canvas or DOM-based rendering target. Keyboard/mouse event translation. Resize via `ResizeObserver`.
- **Driver selection**: Platform detection and automatic driver selection.
- **Tests**: Driver-specific input normalization, output encoding, resize handling.

**Spec coverage**: `spec-src/08`, `spec-tests/driver.md`.

---

## Dependency Graph

```
Phase 1  (Tests + Reactive)
   │
   ▼
Phase 2  (CSS + Query)
   │
   ▼
Phase 3  (Style Layout + Compositor)
   │
   ▼
Phase 4  (Driver + Input)
   │
   ├─────────────────────────┐
   ▼                         ▼
Phase 5  (Bindings/Actions)  Phase 8  (Workers/Signals)
   │                         │
   ▼                         ▼
Phase 6  (Core Widgets)      Phase 9  (Modes/Notifications/Themes)
   │                         │
   ▼                         ▼
Phase 7  (Containers)        Phase 10 (Validation/Commands)
   │                         │
   └────────┬────────────────┘
            ▼
   Phase 11 (Complex Widgets)
            │
            ▼
   Phase 12 (Text Editing)
            │
            ▼
   Phase 13 (Animation)
            │
            ▼
   Phase 14 (Platform Drivers)
```

Phases 5–7 and 8–10 can proceed in parallel once their respective prerequisites (Phase 4) are complete.

## Spec Contradictions to Resolve During Implementation

These were identified in `spec/spec-consolidation-report.md` and resolved in `spec/uber-divergence.md`. During implementation, follow the uber-divergence resolutions:

| Issue | Resolution |
|-------|-----------|
| `reactive()` `init` default | Defaults to `init: true` |
| Reactive pipeline order | Validate → store → watch → compute dependents |
| Widget ID uniqueness | DOM/screen-wide (HTML semantics) |
| `check_action(None)` | Disabled but visible (not hidden) |
| App `COMMANDS` | Override replaces app providers; screen providers union in |
| Command palette initial results | Discovery hits visible immediately |
| CSS `initial` | Property-sensitive fallback |
| Sparkline width/reduction | `width=None` uses render width; default reduction is `max` |
| `ContentSwitcher` child IDs | Constructor tolerates ID-less; `add_content` requires ID |
| `Tabs`/`TabbedContent` APIs | Layered: `Tabs.hide()`/`show()` vs `TabbedContent.hide_tab()`/`show_tab()` |
| `force_stop_animation` | Schedule `on_complete` via `call_later` |
