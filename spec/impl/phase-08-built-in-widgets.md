# Phase 8: Built-in Widgets

## Preconditions

Phases 1–7 complete:
- Full infrastructure: test harness, reactive pipeline, CSS engine, query API, compositor, layout, event routing, bindings, actions, widget base contract, workers, signals, timers, modes, notifications, themes, command palette, validation, suggestions
- All prior tests pass

## Goal

Deliver the widget catalog that most applications need, from simple controls through containers and list widgets.

## Architectural Rationale

// [LAW:one-type-per-behavior] Shared widget behaviors (disabled state, loading state, focus management, pseudo-classes) were implemented once in Phase 5. Every widget here is an instance that consumes those behaviors — none reimplements them.

// [LAW:one-way-deps] Widgets consume the infrastructure (CSS, bindings, compositor, validation, signals). They do not reach backward to modify it. A widget that needs a framework service uses the service's public API.

// [LAW:single-enforcer] Each widget owns its own message types (e.g., `Button.Pressed`, `Input.Changed`). No widget posts another widget's messages.

These widgets are grouped in one phase because in a serial plan, containers have no dependency that basic controls lack — both depend on the same Phases 1–7 infrastructure. Splitting them (as Plan 2 did with Phases 6 and 7) was justified by parallel execution, which we do not have.

## Current State (before this phase)

**`src/widgets/`** is empty.

**`src/widget.ts`** provides the base class with:
- `compose()`, `render()`, `arrange()`
- Focus, display, visible state
- Disabled/loading state, pseudo-classes (Phase 5)
- Binding/action support (Phase 5)
- Reactive properties (Phase 2)
- Style-backed attributes via RenderStyles (Phase 3)

**Framework services available**:
- CSS engine with `DEFAULT_CSS` support
- Validation framework and Suggester (Phase 7)
- Notifications (Phase 7)
- Themes with CSS variables (Phase 7)
- Workers for async operations (Phase 6)
- Signals for coordination (Phase 6)

## Scope

### Basic Controls

- **`Static`**: Non-interactive text display. Renders rich text content. Updates via `update()`. Has `DEFAULT_CSS`.
- **`Label`**: Single-line text with markup support. Thin wrapper over Static with label-specific styling.
- **`Button`**: Focusable, clickable. Posts `Button.Pressed` message. Supports `variant` (default, primary, success, warning, error). Key binding: Enter/Space when focused.
- **`Input`**: Single-line text input. Cursor management, selection. Posts `Input.Changed`, `Input.Submitted`. Integrates with validation framework and suggester from Phase 7. `password` mode.
- **`Switch`**: Toggle control. Posts `Switch.Changed`. Animated toggle (if animation exists, otherwise static).
- **`Checkbox`**: Checkable control. Posts `Checkbox.Changed`. Tri-state support (checked, unchecked, indeterminate).
- **`RadioButton` / `RadioSet`**: Mutually exclusive selection within a group. Posts `RadioSet.Changed`.
- **`ProgressBar`**: Determinate/indeterminate progress display. `update(progress)` or `update(total=None)` for indeterminate.
- **`Rule`**: Horizontal or vertical separator line.
- **`Header`**: App header bar with title and optional clock. Reads `App.title` and `App.sub_title`.
- **`Footer`**: Shows active key bindings for the focused widget. Reads bindings from the binding chain (Phase 5).

### Containers

- **`ScrollableContainer`**: Vertical/horizontal scroll with scroll bars. Keyboard (Page Up/Down, Home/End) and mouse wheel scrolling. Uses compositor scroll integration from Phase 4.
- **`Vertical` / `Horizontal`**: Flow containers with CSS-driven sizing. Thin wrappers that set the layout strategy.
- **`ContentSwitcher`**: Shows one child at a time by ID. Constructor tolerates ID-less children; `add_content()` requires ID (per uber-divergence).
- **`Collapsible`**: Expandable/collapsible content region. Posts `Collapsible.Toggled`. Title bar with expand/collapse indicator.
- **`TabbedContent` / `Tabs` / `Tab` / `TabPane`**: Tabbed interface. `Tabs.hide()`/`show()` and `TabbedContent.hide_tab()`/`show_tab()` as layered APIs (per uber-divergence). Posts `Tabs.TabActivated`, `TabbedContent.TabActivated`.

### List Widgets

- **`ListView` / `ListItem`**: Vertical list with keyboard navigation (Up/Down/Home/End). Selection. Posts `ListView.Selected`, `ListView.Highlighted`. Virtualized rendering for large lists.
- **`OptionList`**: Scrollable option list with separators and highlights. Keyboard navigation. Used as a building block for Select.
- **`Select`**: Dropdown selection. Opens an `OptionList` overlay. Single selection. Posts `Select.Changed`.
- **`SelectionList`**: Multi-select list. Checkable items. Posts `SelectionList.SelectedChanged`.

### Content Helpers

- Strip/renderable helpers required by these widgets (e.g., rendering rich text content within widgets)
- Any shared content formatting utilities

## Spec References

- `spec/spec-src/10-widget-catalog.md` — widget catalog specification
- `spec/spec-src/09-widget-base-contract.md` — base contract (already implemented in Phase 5, but useful reference)
- `spec/spec-tests/button.md`, `spec/spec-tests/input.md`, `spec/spec-tests/switch.md`, `spec/spec-tests/checkbox.md`
- `spec/spec-tests/progress_bar.md`, `spec/spec-tests/static.md`
- `spec/spec-tests/containers.md`, `spec/spec-tests/collapsible.md`
- `spec/spec-tests/tabs_and_tabbed_content.md`
- `spec/spec-tests/list_view.md`, `spec/spec-tests/option_list.md`
- `spec/spec-tests/select.md`, `spec/spec-tests/selection_list.md`
- `spec/spec-tests/header_and_footer.md`
- `spec/spec-tests/scrolling.md` (widget integration)

## Uber-Divergence Resolutions

| Issue | Resolution |
|-------|-----------|
| `ContentSwitcher` child IDs | Constructor tolerates ID-less children; `add_content` requires ID |
| `Tabs`/`TabbedContent` APIs | Layered: `Tabs.hide()`/`show()` vs `TabbedContent.hide_tab()`/`show_tab()` |

## Exit Criteria

1. Each widget has a test file covering: compose, render, message posting, keyboard interaction, focus behavior.
2. `Button`: press via click and keyboard, variant styling, `Button.Pressed` message.
3. `Input`: text entry, cursor movement, selection, `Input.Changed`/`Input.Submitted`, validation integration, suggester integration.
4. `Switch`/`Checkbox`/`RadioSet`: toggle state, message posting, keyboard activation.
5. `ScrollableContainer`: scroll position via keyboard and Pilot, content overflow.
6. `ContentSwitcher`: switch by ID, constructor with/without IDs.
7. `TabbedContent`: tab activation, hide/show tabs, layered APIs.
8. `ListView`: keyboard navigation, selection, `ListView.Selected`.
9. `Select`: open/close overlay, selection, `Select.Changed`.
10. Shared behaviors tested once at the widget-base layer, not duplicated per widget.
11. All prior phase tests still pass.
12. `npm run build` and `npm run lint` pass.

## What the Next Phase Expects

Phase 9 (Driver) expects:
- A full widget catalog exercising the compositor, layout, styles, bindings, and event routing
- Widgets that produce renderable content the driver will consume
- The full interaction loop (key → binding → action → state change → render) working end-to-end through Pilot
