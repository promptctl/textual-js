# Phase 5: Core Widget Catalog

## Preconditions

Phases 1–4 complete:
- React/Ink/MobX foundation, TCSS engine, query API
- Focus, screen stack, modes, bindings, actions, widget base contract
- Workers, signals, notifications, themes, command palette, validation, suggestions
- All prior tests pass

## Goal

Deliver the widget catalog that most applications need — basic controls, containers, and list widgets — as React/Ink components.

## Architectural Rationale

// [LAW:one-type-per-behavior] Shared behaviors (disabled state, loading state, focus, TCSS styling) are consumed from Phases 1–3 via hooks and context. No widget reimplements them.

// [LAW:one-way-deps] Widgets consume framework services (TCSS, bindings, validation, focus). They do not modify framework internals. Each widget owns its own message types.

// [LAW:single-enforcer] Each widget is the single owner of its message types. `Button.Pressed` is posted only by Button. No other widget posts it.

### Widget Implementation Pattern

Use the canonical template in `src/widgets/README.md`.

// [LAW:one-source-of-truth] The widget implementation pattern has one authoritative template. Phase docs link to it instead of copying a second skeleton.

Every built-in widget component registers with `useWidget`, reads TCSS through `useStyles(widget.handle)`, wraps output in `WidgetScope`, owns its message types, wires bindings/actions through `useWidget`, and ships paired visual fixtures. Do not use older `useTextual()` / manual `register()` examples for built-in widgets.

Ink handles all rendering and layout via Yoga flexbox. Widgets compose Ink's `<Box>`, `<Text>`, and rich-js rendering helpers. TCSS resolved styles are spread onto Ink components or used to render rich-js content.

## Current State (before this phase)

**From Phases 1–4:** Full framework infrastructure:
- MobX reactive state, React/Ink rendering
- TCSS cascade with DEFAULT_CSS support
- Focus manager, binding/action system
- Disabled/loading/tooltip from widget base contract
- Validation framework and Suggester
- Notifications, themes

**No widgets exist** beyond the framework primitives.

## Scope

### Basic Controls

- **`Static`**: Non-interactive rich text display. `update(content)` to change. Renders `<Text>` with Ink styling from TCSS.
- **`Label`**: Single-line text with markup support. Thin wrapper.
- **`Button`**: Focusable, clickable. Posts `Button.Pressed`. Supports `variant` prop (default, primary, success, warning, error) which maps to TCSS classes. Bindings: Enter/Space to activate.
- **`Input`**: Single-line text input. Cursor management via MobX observables. Selection support. Posts `Input.Changed`, `Input.Submitted`. Integrates with validation framework (Phase 4) and suggester (Phase 4). Password mode. Placeholder text.
- **`Switch`**: Toggle control. Posts `Switch.Changed`. MobX observable `value`.
- **`Checkbox`**: Checkable control. Posts `Checkbox.Changed`. Tri-state (checked, unchecked, indeterminate).
- **`RadioButton` / `RadioSet`**: Mutually exclusive selection. RadioSet manages the group. Posts `RadioSet.Changed`.
- **`ProgressBar`**: Determinate (`update(progress)`) and indeterminate mode. MobX observable progress value.
- **`Rule`**: Horizontal or vertical separator.
- **`Header`**: App header bar. Reads `App.title` and `App.sub_title` from app context.
- **`Footer`**: Shows active key bindings for the focused widget. Reads from binding chain via context.

### Containers

- **`ScrollableContainer`**: Vertical/horizontal scroll. Keyboard (PageUp/Down, Home/End) and scroll bindings. Ink supports scrollable views — build on that.
- **`Vertical` / `Horizontal`**: Flow containers. Thin wrappers that set Ink's `<Box flexDirection="column">` / `<Box flexDirection="row">` with TCSS styling.
- **`ContentSwitcher`**: Shows one child at a time by ID. MobX observable `current`. Constructor tolerates ID-less children; `add_content()` requires ID.
- **`Collapsible`**: Expandable/collapsible region. Posts `Collapsible.Toggled`. Title bar with indicator. MobX observable `collapsed`.
- **`TabbedContent` / `Tabs` / `Tab` / `TabPane`**: Tabbed interface. `Tabs.hide()`/`show()` and `TabbedContent.hide_tab()`/`show_tab()` as layered APIs. Posts `Tabs.TabActivated`.

### List Widgets

- **`ListView` / `ListItem`**: Vertical list with keyboard navigation (Up/Down/Home/End). Selection. Posts `ListView.Selected`, `ListView.Highlighted`. Virtualized rendering for large lists (only render visible items).
- **`OptionList`**: Scrollable option list with separators and highlights. Keyboard navigation. Building block for Select.
- **`Select`**: Dropdown selection. Opens an OptionList overlay (pushed as a temporary screen or floating component). Single selection. Posts `Select.Changed`.
- **`SelectionList`**: Multi-select list. Checkable items. Posts `SelectionList.SelectedChanged`.

## Spec References

- `spec/spec-src/10-widget-catalog.md` — widget catalog specification
- `spec/spec-src/09-widget-base-contract.md` — base contract reference
- `spec/spec-tests/button.md`, `spec/spec-tests/input.md`, `spec/spec-tests/switch.md`, `spec/spec-tests/checkbox.md`
- `spec/spec-tests/progress_bar.md`, `spec/spec-tests/static.md`
- `spec/spec-tests/containers.md`, `spec/spec-tests/collapsible.md`
- `spec/spec-tests/tabs_and_tabbed_content.md`
- `spec/spec-tests/list_view.md`, `spec/spec-tests/option_list.md`
- `spec/spec-tests/select.md`, `spec/spec-tests/selection_list.md`
- `spec/spec-tests/header_and_footer.md`
- `spec/spec-tests/scrolling.md`

## Exit Criteria

1. Each widget has a test file covering: rendering, user interaction (via Pilot), message posting, keyboard behavior, focus behavior.
2. Button: press via Pilot click and key, variant styling via TCSS, `Button.Pressed` message.
3. Input: text entry, cursor movement, `Input.Changed`/`Input.Submitted`, validation integration, suggester integration.
4. Switch/Checkbox/RadioSet: toggle state, message posting, keyboard activation.
5. ScrollableContainer: scroll position changes via keyboard.
6. ContentSwitcher: switch by ID, constructor with/without IDs.
7. TabbedContent: tab activation, hide/show tabs via both APIs.
8. ListView: keyboard navigation, selection, `ListView.Selected`.
9. Select: open/close overlay, selection, `Select.Changed`.
10. All widgets use TCSS for styling — no hardcoded Ink style props (styles come from DEFAULT_CSS through the cascade).
11. All prior phase tests still pass.
12. `npm run build` and `npm run lint` pass.
13. Each widget component has a paired visual fixture in `visual-tests/fixtures/` (`.py` + `.tsx`). `bash visual-tests/run.sh` runs to completion with no text-content divergence (border/slider character differences from Ink vs Textual renderers are acceptable).

## What the Next Phase Expects

Phase 6 (Advanced Widgets) expects:
- Core widget catalog available for composition — advanced widgets build on these (e.g., DataTable uses ScrollableContainer)
- Widget implementation pattern established and proven
- All framework services exercised by real widgets
