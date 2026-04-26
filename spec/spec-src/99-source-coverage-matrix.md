# Spec Coverage Matrix

This matrix maps each spec file to the implementation phases that consume it, and each `spec-tests/` file to the phase that must implement its test cases. This is the authoritative source for "who owns what" during phase execution.

// [LAW:one-source-of-truth] Coverage ownership is defined from behavioral specs, not from source modules. Every `spec-tests/` file has exactly one owning phase.

## Phase Overview

| Phase | Title | Focus |
|-------|-------|-------|
| 1 | Foundation | React/Ink + MobX + test harness + message system + reactive pipeline |
| 2 | TCSS & Query | css-tree integration, selector matching, query API |
| 3 | Focus, Screens, Bindings | Focus manager, screen stack, modes, bindings, actions, widget base contract |
| 4 | App Services | Workers, signals, notifications, themes, command palette, validation, suggestions |
| 5 | Core Widgets | Basic controls, containers, list widgets |
| 6 | Advanced Widgets & Text Editing | DataTable, Tree, Markdown, TextArea (Shiki) |
| 7 | Animation & Conformance | Animator, CSS transitions, conformance closure |

## Spec to Phase Mapping

Each spec file (`spec-src/NN-*.md`) is consumed by one or more phases. Phases reference specs for behavioral requirements.

| Spec File | Key Concerns | Consumed by Phase(s) |
|-----------|-------------|---------------------|
| `00-overview-and-scope.md` | Architecture overview, foundation libraries, enforcement boundaries, runtime flows | All |
| `01-runtime-app-and-lifecycle.md` | App lifecycle, TextualApp props, modes, screen stack, theming, notifications, shutdown | 1, 3, 4 |
| `02-dom-reactivity-and-query.md` | Widget registration, MobX reactivity (validate/watch/compute), query API, data binding | 1, 2 |
| `03-message-event-and-dispatch.md` | Message dispatch, bubbling, coalescing, handler resolution, event taxonomy | 1 |
| `04-styling-and-css-engine.md` | TCSS parsing via css-tree, selectors, cascade, specificity, variables, rich-js `Color` resolution, rich-js `Style` output, TCSS-to-Ink translation | 2 |
| `05-layout-render-and-compositor.md` | Layout (Ink/Yoga), fr unit resolution, dock, scroll, render flow, Line API mode, rich-js `Strip` → Ink conversion, output-filter pipeline | 2, 3 |
| `06-input-bindings-actions-and-commands.md` | Bindings, actions, key normalization, command palette (uFuzzy), built-in actions | 3, 4 |
| `07-workers-timers-and-signals.md` | Workers (AbortController), timers, signals (pub/sub), MobX integration | 4 |
| `08-drivers-io-and-platform-behavior.md` | Ink integration, input translation, mouse processing, suspend/resume | 1 |
| `09-widget-base-contract.md` | Widget anatomy, lifecycle, Line API widget contract, rich-js rendering, focus, scroll, disabled/loading, tooltip, screen contract | 3 |
| `10-widget-catalog.md` | Built-in widgets, markup-accepting content types, rich-js renderable wrapping, markdown token/widget mapping | 5, 6 |
| `11-text-editing-and-document-model.md` | Document, WrappedDocument, Navigator, EditHistory, TextArea, Shiki highlighting, rich-js `Style` overlays | 6 |
| `12-supporting-subsystems.md` | Themes, notifications, validation, suggestions, rich-js as content/color/renderable provider, geometry, Animator, logger, errors | 1, 4, 7 |
| `13-testability-and-automation-surfaces.md` | runTest, Pilot, ink-testing-library, query helpers, Vitest integration | 1 |
| `14-renderer-integration-seams.md` | React/Ink integration stack, MobX observer bridge, hooks, context providers, Content → Ink bridge, output-filter boundary | 1 |

### Why some specs span multiple phases

Some specs span phases because their subsystems are introduced incrementally:

| Spec | Why it spans phases |
|------|---------------------|
| `01` | App shell in Phase 1, modes/screens in Phase 3, notifications/themes/commands in Phase 4 |
| `02` | MobX reactive pipeline in Phase 1, selector-based query API in Phase 2 (needs TCSS) |
| `05` | Rendering bridge in Phase 2 (TCSS → Ink props and rich-js `Strip` → Ink conversion), scroll UX in Phase 3 (needs widget base contract) |
| `06` | Bindings/actions in Phase 3, command palette in Phase 4 (needs workers for async providers) |
| `10` | Core widgets in Phase 5, advanced/data-rich widgets in Phase 6 |
| `12` | Color/geometry/errors in Phase 1, notifications/themes/validation/suggestions in Phase 4, Animator in Phase 7; all three rely on the same rich-js `Color` / content primitives |

## Spec-Tests to Phase Mapping

Each `spec-tests/NN.md` file is owned by exactly one phase. That phase's exit criteria include "tests covering the behaviors in this file pass."

### Phase 1 — Foundation

| spec-tests File | Focus |
|----------------|-------|
| `geometry.md` | Size, Offset, Region, Spacing value types |
| `events_and_messages.md` | Message dispatch, bubbling, coalescing, handler resolution |
| `reactivity.md` | MobX-backed reactive pipeline: validate/watch/compute, init, always_update |
| `testing.md` | runTest harness, Pilot interface, test determinism |
| `app.md` (startup/shutdown portions) | App mount/unmount lifecycle, exit() |

### Phase 2 — TCSS & Query

| spec-tests File | Focus |
|----------------|-------|
| `css_parsing.md` | TCSS tokenization, AST, variables, nesting |
| `css_styles.md` | Cascade, specificity, `!important`, origin ordering |
| `css_scalars.md` | Length units (`fr`, `%`, `vw`, `vh`), color values, resolution |
| `css_nested.md` | Nested rule expansion, `&` merging |
| `dom.md` | Query API (query, queryOne, etc.), DOMQuery chaining, traversal |
| `borders.md` | Border rendering, border titles |
| `color.md` | Color type: parse, blend, conversion, opacity — via rich-js `Color` |

### Phase 3 — Focus, Screens, Bindings

| spec-tests File | Focus |
|----------------|-------|
| `app.md` (mode/screen portions) | Modes, screen stack operations, screen lifecycle |
| `screens.md` | Screen push/pop/switch, modal screens, dismiss/callback |
| `widget.md` | Widget base contract: display/visible, classes, disabled, loading, focus |
| `bindings_and_actions.md` | Binding resolution chain, action dispatch, check_action |
| `input.md` (non-widget portions) | Key input routing, event bubbling |
| `scrolling.md` | Scroll API, anchor behavior, scroll input handling |

### Phase 4 — App Services

| spec-tests File | Focus |
|----------------|-------|
| `workers.md` | Worker lifecycle, AbortController cancellation, WorkerManager |
| `concurrency.md` | Concurrent worker patterns, exclusive groups |
| `notifications.md` | Notification model, auto-dismiss, severity, toast rendering |
| `command_palette.md` | Provider resolution, uFuzzy search, discovery mode |
| `input_validation.md` | Validator framework, validEmpty, valid/invalid CSS classes |
| `suggester.md` | Suggester base, SuggestFromList, SuggestionReady message |

### Phase 5 — Core Widgets

| spec-tests File | Focus |
|----------------|-------|
| `button.md` | Button widget, variants, Pressed message |
| `input.md` (widget portions) | Input widget, cursor, selection, validation integration |
| `switch.md` | Switch widget, toggle behavior |
| `toggles.md` | Checkbox, RadioButton, RadioSet shared behavior |
| `progress_bar.md` | ProgressBar determinate/indeterminate modes, ETA |
| `static.md` | Static widget, Label, content update |
| `rule.md` | Rule widget, orientation/line style validation |
| `containers.md` | ScrollableContainer, Vertical, Horizontal, ContentSwitcher |
| `collapsible.md` | Collapsible widget, toggle, title |
| `tabs_and_tabbed_content.md` | Tabs, TabbedContent, layered hide/show APIs |
| `list_view.md` | ListView, ListItem, keyboard navigation |
| `option_list.md` | OptionList, separators, highlighting |
| `select.md` | Select widget, overlay, NoSelection sentinel |
| `selection_list.md` | SelectionList multi-select, toggle |
| `header_and_footer.md` | Header (title/subtitle/clock), Footer (active bindings) |
| `links.md` | Link widget, open_link action |
| `selection.md` | Text selection within widgets |

### Phase 6 — Advanced Widgets & Text Editing

| spec-tests File | Focus |
|----------------|-------|
| `data_table.md` | DataTable, cursor types, sorting, fixed rows/columns, virtualization |
| `tree.md` | Tree, TreeNode, expand/collapse, lazy loading |
| `directory_tree.md` | DirectoryTree, filesystem browsing |
| `text_area.md` | TextArea widget, bindings, reactives, language/theme |
| `document.md` | Document model, replaceRange, newline handling, read-only |
| `masked_input.md` | MaskedInput template, character classes |
| `markdown.md` | Markdown widget, marked parsing, token → widget mapping |
| `rich_log.md` | RichLog, append, auto-scroll, maxLines |
| `sparkline.md` | Sparkline, width=null, max reduction, block characters |
| `content_and_strip.md` | rich-js `Content` / `Segment` / `Strip` primitives and strip rendering helpers |
| `markup.md` | rich-js markup parsing for content-bearing widgets |
| `renderables.md` | rich-js renderables (`Bar`, `Gradient`, `Sparkline`, `Digits`, styled text) |

### Phase 7 — Animation & Conformance

| spec-tests File | Focus |
|----------------|-------|
| `animations.md` | Animator, easing, CSS transitions, force_stop_animation |

## Unmapped Test Files

The following `spec-tests/` files do not map to a specific phase in the current 7-phase plan. Each is either (a) subsumed by another test file, (b) internal-only behavior covered implicitly, or (c) not applicable given the React/Ink foundation. They remain in the tree for reference.

| spec-tests File | Status | Reason |
|----------------|--------|--------|
| `auto_refresh.md` | Covered by `reactivity.md` (Phase 1) | MobX observer handles auto-refresh; no separate test needed |
| `compositor.md` | **Behavioral — Ink-delegated** | Upstream Textual has a first-class Compositor subsystem. In textual-js, Ink handles compositing, but the behavioral contracts (paint order, layer stacking, visibility, clipping) remain conformance targets. Covered by `css_styles.md` (Phase 2) and layout tests (Phase 5). |
| `driver.md` | **Behavioral — Ink-delegated** | Upstream Textual writes terminal output through a Driver subsystem. In textual-js, Ink is the driver, but the behavioral contracts (output encoding, suspend/resume, headless mode) remain conformance targets. Covered by `app.md` (Phase 1) for suspend/resume and headless testing. |
| `xterm_parser.md` | **Behavioral — Ink-delegated** | Upstream Textual has a first-class xterm parser for input sequences. In textual-js, Ink handles input parsing, but the behavioral contracts (key event shape, mouse event shape, paste bracketing) remain conformance targets. Covered by `events.md` and `bindings_and_actions.md`. |
| `file_monitor.md` | Covered by `workers.md` (Phase 4) | File watching is a worker pattern, not a separate subsystem |
| `filters.md` | Covered by `dom.md` (Phase 2) | Query filter/exclude is part of DOMQuery |
| `lazy.md` | Covered by `workers.md` + `tree.md` | Lazy loading is a worker pattern used by Tree |
| `layouts.md` | Covered by `css_styles.md` (Phase 2) + `containers.md` (Phase 5) | Layout is Ink/Yoga — framework only tests TCSS-to-Ink translation |
| `utilities.md` | Internal helper coverage, not phase-owned | Utility functions are tested implicitly by consumers |

// [LAW:verifiable-goals] Every phase has a concrete test ownership list. At the end of a phase, the tests listed for that phase must pass. The presence of these files in `spec-tests/` is the backlog; this matrix assigns ownership.

## Conformance Tracking

The `spec/impl/INDEX.md` file maintains a conformance tracker that is updated at each phase boundary. For each `spec-tests/` file, the tracker records:

- **Implemented**: test file exists and covers the spec behaviors → link to test file
- **Partial**: some behaviors covered, gaps identified → list gaps
- **Not Yet Started**: no coverage
- **Not Applicable**: listed in "Unmapped Test Files" above — intentionally not implemented
- **Deferred**: postponed to a future milestone — reason documented

The conformance tracker is the single source of truth for "what percentage of the spec is implemented." This matrix is the input; the tracker is the output.

## Summary Counts

| Phase | Spec-Tests Owned | Notes |
|-------|------------------|-------|
| 1 | 5 | Foundation + test harness |
| 2 | 7 | TCSS engine + query + color |
| 3 | 6 | Focus/screens/bindings/scroll |
| 4 | 6 | App services |
| 5 | 17 | Core widget catalog |
| 6 | 12 | Advanced widgets + text editing |
| 7 | 1 | Animation |
| — | 9 unmapped | See table above |
| **Total** | **54 owned + 9 unmapped = 63** | matches `spec-tests/` file count |
