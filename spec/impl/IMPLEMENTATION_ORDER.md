# Recommended Implementation Order

Audit date: 2026-04-16

This document proposes a dependency-first implementation order for textual-js. It does not change the spec files; it reorders execution so infrastructure lands before features that consume it.

// [LAW:one-source-of-truth] The ordering below is derived from the spec set and coverage matrix, not from the current seven phase file names.
// [LAW:one-way-deps] Each stage only depends on stages above it; later widget work should not backfill earlier infrastructure.
// [LAW:verifiable-goals] The test harness and conformance ledger move to the front so every later stage has executable gates.

## Why The Current Order Needs Adjustment

The current `spec/impl/phase-01-foundation.md` already treats testability as foundational, but the surrounding plan still makes several cross-cutting pieces feel end-loaded:

- `spec/spec-src/13-testability-and-automation-surfaces.md` is effectively a Stage 0 dependency, not a late-project concern.
- `spec/spec-src/14-renderer-integration-seams.md` and `spec/spec-src/08-drivers-io-and-platform-behavior.md` define the React/Ink boundary and input translation seam, so they must be settled before higher-level runtime behavior.
- Rich text/content primitives currently appear late through `spec/spec-tests/content_and_strip.md`, `markup.md`, and `renderables.md`, but core widgets such as `Static`, `Label`, `Header`, `Footer`, and `Markdown` depend on them conceptually.
- Command palette, validation, and suggestion work should not be bundled with lower-level worker/theme/notification infrastructure if they have different prerequisites.
- Conformance accounting should start with the first executable slice, then be updated continuously; only the final audit belongs at the end.

## How to read the stage table

The "Primary spec-tests" column lists every spec-tests file that must have behavioral test coverage for the stage to be considered complete.

When a spec-tests file is **shared across stages** (it appears in more than one stage), the "Behavioral scope" column in the stage details section below specifies exactly which sections or behaviors from that file belong to each stage. Only those behaviors must be tested — not the entire file.

When a spec-tests file appears in only one stage, the entire file's behaviors must be covered.

A stage is complete when every behavior assigned to it has a passing test. File existence is necessary but not sufficient.

## Recommended Order

| Stage | Name | Primary Specs | Primary spec-tests | Why it comes here |
|-------|------|---------------|--------------------|-------------------|
| 0 | Harness and Renderer Seams | `00`, `13`, `14`, `08` | `testing.md`, `geometry.md`, `app.md` (Stage 0 scope) | Establishes React/Ink/MobX bootstrapping, `runTest`, `Pilot`, and the terminal integration seam before framework logic starts depending on them. |
| 1 | Runtime Spine | `01`, `02`, `03` | `reactivity.md`, `events_and_messages.md`, `app.md` (Stage 1 scope) | Builds the app shell, widget registry, message dispatch, and MobX-backed reactive pipeline that every later subsystem sits on. |
| 2 | Style Values and Render Bridge | `04`, `05`, `12`, `14` | `color.md`, `css_scalars.md`, `css_parsing.md` | Separates scalar/color/value semantics from full cascade logic so TCSS, layout hints, and Ink translation share stable primitives. |
| 3 | Cascade, Selectors, and Query | `02`, `04`, `05` | `css_styles.md`, `css_nested.md`, `dom.md`, `borders.md` | Once widget identity and style values exist, selector matching, query traversal, and resolved-style computation can land without reworking the runtime spine. |
| 4 | Widget Base Contract and Interaction Shell | `01`, `03`, `05`, `06`, `09` | `widget.md`, `screens.md`, `bindings_and_actions.md`, `app.md` (Stage 4 scope), `input.md` (Stage 4 scope), `scrolling.md` (Stage 4 scope) | Focus, screen stack, actions, disabled/loading behavior, and scroll behavior are the interaction substrate for almost every real widget. |
| 5 | Background and App Services Core | `01`, `07`, `12` | `workers.md`, `concurrency.md`, `notifications.md`, `app.md` (Stage 5 scope) | Workers, timers, signals, notifications, and theming are reusable app services that other features consume but do not redefine. |
| 6 | Discovery and Input Support Services | `06`, `12` | `command_palette.md`, `input_validation.md`, `suggester.md` | Command discovery depends on screens/bindings plus worker-backed providers; validation and suggestions should exist before the first serious text-entry widget. |
| 7 | Core Text and Control Widgets | `10`, `12` | `content_and_strip.md`, `markup.md`, `renderables.md`, `static.md`, `rule.md`, `button.md`, `switch.md`, `toggles.md`, `progress_bar.md`, `input.md` (Stage 7 scope), `header_and_footer.md`, `links.md`, `selection.md` | This is the first point where the framework can support the basic application surface area without stubbing rich-text behavior or input support. |
| 8 | Containers, Lists, and Selection Surfaces | `05`, `10` | `containers.md`, `collapsible.md`, `tabs_and_tabbed_content.md`, `list_view.md`, `option_list.md`, `select.md`, `selection_list.md`, `scrolling.md` (Stage 8 scope) | These widgets depend on the interaction shell plus the simple controls, but they do not require the full document model. |
| 9 | Document Model and Data-Rich Widgets | `10`, `11` | `document.md`, `text_area.md`, `masked_input.md`, `data_table.md`, `tree.md`, `directory_tree.md`, `rich_log.md`, `sparkline.md` | The document model is a distinct subsystem and should be complete before `TextArea`; data-heavy widgets also rely on the container and worker foundations already being stable. |
| 10 | Markdown Composition and Final Widgets | `10`, `11`, `12` | `markdown.md` | Markdown sits late because it composes rich content primitives, basic widgets, tables, scrolling, and syntax highlighting rather than defining new infrastructure. |
| 11 | Animation and Final Conformance Audit | `12` plus all prior specs | `animations.md` plus full conformance pass | Animation should stay last because it cross-cuts styling and widget behavior; only the final audit belongs here, not the creation of the testing surface itself. |

## Stage Details

### Stage 0: Harness and Renderer Seams

Specs:
- `spec/spec-src/00-overview-and-scope.md`
- `spec/spec-src/13-testability-and-automation-surfaces.md`
- `spec/spec-src/14-renderer-integration-seams.md`
- `spec/spec-src/08-drivers-io-and-platform-behavior.md`

Deliverables:
- React/Ink/MobX project wiring
- `runTest()` and `Pilot`
- deterministic test bootstrapping
- explicit terminal input/output seam
- initial conformance ledger seeded from `spec/spec-src/99-source-coverage-matrix.md`: `spec/impl/STAGE_0_CONFORMANCE_LEDGER.md`

Behavioral scope for shared spec-tests files:

`app.md` — Stage 0 requires:
- Construction: instantiation, title/sub_title coercion
- Running: run_test harness yields Pilot
- Lifecycle: exit() terminates, return value propagation

`testing.md` — entire file (sole owner).

`geometry.md` — entire file (sole owner). All behaviors described for Offset, Size, Region (including `getScrollToVisible`, `split`, `splitVertical`, `splitHorizontal`, `translateInside`, `expand`, `inflect`, `constrain`, `getSpacingBetween`), Spacing, and clamp.

Why first:
- `testing.md` is a prerequisite for machine-verifiable progress on every later stage.
- `14` and `08` define the trust boundary between textual-js and Ink; they should be settled before runtime semantics accumulate on top of an unstable seam.

### Stage 1: Runtime Spine

Specs:
- `spec/spec-src/01-runtime-app-and-lifecycle.md`
- `spec/spec-src/02-dom-reactivity-and-query.md` (registry/reactivity portion)
- `spec/spec-src/03-message-event-and-dispatch.md`

Deliverables:
- `TextualApp` shell and lifecycle
- widget registration and parent linkage
- MobX validate/watch/compute pipeline
- message posting, bubbling, coalescing, handler resolution

Behavioral scope for shared spec-tests files:

`app.md` — Stage 1 requires:
- Widget Mounting: render only after mount
- Widget Disabled State: enabled/disabled pseudo-classes, container disabling propagates to children
- Widget Loading State: loading disables scrollbars, setting loading before mount
- Batch Update: nestable context manager with counter
- Shutdown: deadlock safety

`reactivity.md` — entire file (sole owner). All behaviors: reactive/var, init parameter, always_update, set_reactive, mutate_reactive, inheritance, watchers (naming, signatures, sync/async, private, external via self.watch()), validators (naming, private, execution order), compute methods (naming, startup evaluation, read-only, private, watch+compute), data binding (data_bind, binding rules, mutation propagation), signals (creating, publishing, subscribing, unsubscribing, lifecycle cleanup, typed signals).

`events_and_messages.md` — entire file (sole owner).

Why before styling:
- Query, focus, bindings, and service stores all assume a stable runtime object model.
- The registry is the single index of widget identity; cascade and query should consume it rather than inventing parallel structures.

### Stage 2: Style Values and Render Bridge

Specs:
- `spec/spec-src/04-styling-and-css-engine.md` (value/parsing portion)
- `spec/spec-src/05-layout-render-and-compositor.md` (Ink translation seam)
- `spec/spec-src/12-supporting-subsystems.md` (color/content primitives used by styling)
- `spec/spec-src/14-renderer-integration-seams.md`

Deliverables:
- TCSS scalar units and parsers
- color parsing and normalization
- stable `ResolvedStyles` value model
- TCSS-to-Ink prop translation primitives

`color.md` — entire file (sole owner).
`css_scalars.md` — entire file (sole owner).
`css_parsing.md` — entire file (sole owner).

Why before full cascade:
- Scalar/color bugs are cheaper to isolate before selector matching and pseudo-class invalidation are added.
- This stage defines the data types that the cascade will produce, which keeps style resolution data-driven.

### Stage 3: Cascade, Selectors, and Query

Specs:
- `spec/spec-src/02-dom-reactivity-and-query.md` (query portion)
- `spec/spec-src/04-styling-and-css-engine.md`
- `spec/spec-src/05-layout-render-and-compositor.md`

Deliverables:
- selector matching against the widget registry
- query traversal APIs
- specificity, variables, nested rules, inline overrides
- border/title handling and other render-adjacent style behavior

`css_styles.md` — entire file (sole owner).
`css_nested.md` — entire file (sole owner).
`dom.md` — entire file (sole owner).
`borders.md` — entire file (sole owner).

Why before focus and widgets:
- Widgets should consume `useStyles()` and query helpers, not force the styling model to be retrofitted after the catalog exists.

### Stage 4: Widget Base Contract and Interaction Shell

Specs:
- `spec/spec-src/01-runtime-app-and-lifecycle.md` (screen stack and modes)
- `spec/spec-src/03-message-event-and-dispatch.md` (routing portion)
- `spec/spec-src/05-layout-render-and-compositor.md` (scroll infrastructure)
- `spec/spec-src/06-input-bindings-actions-and-commands.md` (bindings/actions portion)
- `spec/spec-src/09-widget-base-contract.md`

Deliverables:
- focus manager
- screen stack and per-mode stacks
- binding normalization and action dispatch
- disabled/loading/tooltip behavior
- scroll geometry and infrastructure APIs

Behavioral scope for shared spec-tests files:

`app.md` — Stage 4 requires:
- Screen Stack: get_screen_stack, default screen
- Focus and Blur: AUTO_FOCUS, AppBlur clears focus, AppFocus restores focus, stale-widget handling, explicit-focus-while-blurred
- Hover and Pointer: hover pseudo-class, pointer shape
- Click Chain: multi-click detection, chain reset on target change, time threshold

`input.md` — Stage 4 requires only the key routing infrastructure, NOT the Input widget itself:
- Key Actions (Movement and Modification sections): the action dispatch pipeline that routes `action_cursor_left`, `action_delete_left`, etc. These are tested as action dispatch, not as Input widget behavior. The Input widget itself belongs to Stage 7.

`scrolling.md` — Stage 4 requires scroll **infrastructure** only:
- Scroll-to-Visible Geometry: `Region.getScrollToVisible` returning minimum scroll offset
- Scrollbar Sizing: `scrollbar-size` CSS property parsing with single and dual values
- Scrollbar Gutter: `scrollbar-gutter` CSS property parsing
- Scroll Animation Levels: animation level enum and its effect on scroll behavior

`scrolling.md` — Stage 4 does NOT include (deferred to Stage 8):
- Overflow Modes (requires container widgets)
- Container Scrollbar Defaults (requires Horizontal/Vertical/etc.)
- Scrollbar Visibility and Styling (requires scrollbar rendering)
- Scroll Navigation Methods (requires scroll position on mounted containers)
- Auto-Scroll on Content Append (requires RichLog)
- ScrollView and Virtual Size (requires ScrollView widget)
- Loading State and Scrollbars (requires scrollbar rendering)
- Compositor Scroll Placement (requires compositor)

`widget.md` — entire file (sole owner).
`screens.md` — entire file (sole owner).
`bindings_and_actions.md` — entire file (sole owner).

Why before app services and widgets:
- The command palette, input widgets, list widgets, and overlays all depend on the same focus/screen/binding substrate.

### Stage 5: Background and App Services Core

Specs:
- `spec/spec-src/01-runtime-app-and-lifecycle.md` (theme/notification integration)
- `spec/spec-src/07-workers-timers-and-signals.md`
- `spec/spec-src/12-supporting-subsystems.md`

Deliverables:
- worker manager
- timers and signals
- notifications
- theming and theme-change propagation

Behavioral scope for shared spec-tests files:

`app.md` — Stage 5 requires:
- Theming: ansi_theme, dark/light mode switching, theme_changed_signal
- Suspend: suspend context manager, driver support check, suspend/resume signals
- Command Search: search_commands opens palette with SimpleCommand list
- Features and Constants: TEXTUAL env var parsing, environment helpers

`workers.md` — entire file (sole owner).
`concurrency.md` — entire file (sole owner).
`notifications.md` — entire file (sole owner).

Why split from Stage 6:
- Workers/timers/signals/themes are reusable primitives.
- Command palette, validators, and suggesters are product-facing consumers of those primitives and can land immediately after them.

### Stage 6: Discovery and Input Support Services

Specs:
- `spec/spec-src/06-input-bindings-actions-and-commands.md` (command palette portion)
- `spec/spec-src/12-supporting-subsystems.md` (validation/suggester portion)

Deliverables:
- command palette
- command provider model
- validation framework
- suggestion framework

`command_palette.md` — entire file (sole owner).
`input_validation.md` — entire file (sole owner).
`suggester.md` — entire file (sole owner).

Why before core widgets:
- `Input` should be implemented once against real validation/suggestion services, not patched later.
- The command palette is a screen-level consumer of bindings, workers, and focus; it validates the interaction shell before the catalog grows.

### Stage 7: Core Text and Control Widgets

Specs:
- `spec/spec-src/10-widget-catalog.md`
- `spec/spec-src/12-supporting-subsystems.md` (rich content helpers consumed by widgets)

Deliverables:
- rich content/renderable bridge for simple widgets
- `Static`, `Label`, `Rule`, `Button`, `Input`, `Switch`, `Checkbox`, `RadioButton`, `RadioSet`, `ProgressBar`, `Header`, `Footer`
- links and text selection behavior where required by the widget surfaces

Behavioral scope for shared spec-tests files:

`input.md` — Stage 7 requires all behaviors NOT covered by Stage 4:
- Properties: value, password mode, highlighter, cursor, selection
- Messages: Changed, Submitted
- Mouse Interaction: click positioning, double-width characters, padding clicks
- Clipboard: cut, copy, paste
- Restrict Patterns: custom restrict, built-in types, validation, max_length
- Clear, Select on Focus, Terminal Cursor

`scrolling.md` deferred portions are NOT part of Stage 7. They belong to Stage 8.

`content_and_strip.md` — entire file (sole owner).
`markup.md` — entire file (sole owner).
`renderables.md` — entire file (sole owner).
`static.md` — entire file (sole owner).
`rule.md` — entire file (sole owner).
`button.md` — entire file (sole owner).
`switch.md` — entire file (sole owner).
`toggles.md` — entire file (sole owner).
`progress_bar.md` — entire file (sole owner).
`header_and_footer.md` — entire file (sole owner).
`links.md` — entire file (sole owner).
`selection.md` — entire file (sole owner).

Why this grouping:
- These are the smallest complete application-building blocks.
- Pulling `content_and_strip.md`, `markup.md`, and `renderables.md` forward prevents a false split where "simple" widgets exist before their text/rendering substrate.

### Stage 8: Containers, Lists, and Selection Surfaces

Specs:
- `spec/spec-src/05-layout-render-and-compositor.md`
- `spec/spec-src/10-widget-catalog.md`

Deliverables:
- `ScrollableContainer`, `Vertical`, `Horizontal`, `ContentSwitcher`, `Collapsible`
- `Tabs`, `TabbedContent`
- `ListView`, `OptionList`, `Select`, `SelectionList`

Behavioral scope for shared spec-tests files:

`scrolling.md` — Stage 8 requires all behaviors NOT covered by Stage 4:
- Overflow Modes: scroll/hidden/auto, runtime changes trigger virtual size recalculation
- Container Scrollbar Defaults: Horizontal, HorizontalScroll, Vertical, VerticalScroll defaults
- Scrollbar Visibility: scrollbar-visibility hidden hides chrome without disabling scroll
- Scrollbar Styling: scrollbar-background, scrollbar-color
- Scroll Navigation Methods: scroll_visible, scroll_to, scroll_to_center, scroll_end, scroll_page_down/up
- Auto-Scroll on Content Append: auto_scroll parameter, per-write override
- ScrollView and Virtual Size: virtual_size, render_line
- Loading State and Scrollbars: loading=True disables scrollbars
- Compositor Scroll Placement: scroll offset affects visible widget set

`containers.md` — entire file (sole owner).
`collapsible.md` — entire file (sole owner).
`tabs_and_tabbed_content.md` — entire file (sole owner).
`list_view.md` — entire file (sole owner).
`option_list.md` — entire file (sole owner).
`select.md` — entire file (sole owner).
`selection_list.md` — entire file (sole owner).

Why after Stage 7:
- These widgets are composition-heavy. They depend on stable focus, scrolling, overlay, and basic control behavior more than on new low-level infrastructure.

### Stage 9: Document Model and Data-Rich Widgets

Specs:
- `spec/spec-src/10-widget-catalog.md`
- `spec/spec-src/11-text-editing-and-document-model.md`

Deliverables:
- `Document`, `WrappedDocument`, navigator, history
- `TextArea`, `MaskedInput`
- `DataTable`, `Tree`, `DirectoryTree`, `RichLog`, `Sparkline`

`document.md` — entire file (sole owner).
`text_area.md` — entire file (sole owner).
`masked_input.md` — entire file (sole owner).
`data_table.md` — entire file (sole owner).
`tree.md` — entire file (sole owner).
`directory_tree.md` — entire file (sole owner).
`rich_log.md` — entire file (sole owner).
`sparkline.md` — entire file (sole owner).

Why here:
- `TextArea` deserves its own substrate rather than being mixed into earlier input work.
- `DataTable` and tree widgets need already-proven scrolling, selection, and worker behavior.

### Stage 10: Markdown Composition and Final Widgets

Specs:
- `spec/spec-src/10-widget-catalog.md`
- `spec/spec-src/11-text-editing-and-document-model.md` (syntax-highlighting integration)
- `spec/spec-src/12-supporting-subsystems.md`

Deliverables:
- `Markdown`
- `MarkdownViewer`

`markdown.md` — entire file (sole owner).

Why near the end:
- Markdown is a composition feature. It depends on rich content, tables or grid rendering, scrolling containers, links, and syntax highlighting.

### Stage 11: Animation and Final Conformance Audit

Specs:
- `spec/spec-src/12-supporting-subsystems.md` (animation portion)
- all prior specs as audit inputs

Deliverables:
- animator
- CSS transition support
- final `CONFORMANCE.md` audit

`animations.md` — entire file (sole owner).

Why last:
- Animation cross-cuts style changes on already-existing widgets.
- The final conformance audit should be a closure activity, but the coverage ledger itself should be updated from Stage 0 onward.

## Spec Placement Summary

This is the recommended first meaningful stage for each `spec-src` document.

| Spec | Recommended First Stage | Notes |
|------|-------------------------|-------|
| `00-overview-and-scope.md` | 0 | Governs the whole plan. |
| `01-runtime-app-and-lifecycle.md` | 1 | Shell first, screens in 4, theme/notifications integration in 5. |
| `02-dom-reactivity-and-query.md` | 1 | Registry/reactivity first, query/cascade in 3. |
| `03-message-event-and-dispatch.md` | 1 | Dispatch first, routing details continue in 4. |
| `04-styling-and-css-engine.md` | 2 | Values/parsing in 2, cascade/query in 3. |
| `05-layout-render-and-compositor.md` | 2 | Ink bridge early, scroll/container consumers later. |
| `06-input-bindings-actions-and-commands.md` | 4 | Bindings/actions first, command palette in 6. |
| `07-workers-timers-and-signals.md` | 5 | Pure service layer. |
| `08-drivers-io-and-platform-behavior.md` | 0 | Terminal trust boundary. |
| `09-widget-base-contract.md` | 4 | Base widget behavior should stabilize before the catalog. |
| `10-widget-catalog.md` | 7 | Split across 7, 8, 9, and 10 by dependency. |
| `11-text-editing-and-document-model.md` | 9 | Distinct editing/data model phase. |
| `12-supporting-subsystems.md` | 2 | Color/content primitives early, services in 5 and 6, animation in 11. |
| `13-testability-and-automation-surfaces.md` | 0 | Must be available before any meaningful implementation work. |
| `14-renderer-integration-seams.md` | 0 | React/Ink seam should not be deferred. |
| `99-source-coverage-matrix.md` | 0 | Use it to seed ownership tracking immediately. |

## Test Ownership Adjustments Worth Making

The current coverage documents mostly have the right instincts, but the implementation order should explicitly move or emphasize the following:

- `spec/spec-tests/testing.md` should be an explicit Stage 0 deliverable.
- `spec/spec-tests/content_and_strip.md`, `markup.md`, and `renderables.md` should move ahead of the advanced-widget bucket.
- `spec/spec-tests/screens.md` should remain coupled to the interaction shell, not treated as incidental app coverage.
- `spec/spec-tests/concurrency.md` should stay with workers, not as an afterthought to general services.
- `spec/spec-tests/links.md` and `selection.md` should be implemented with the first text-capable widgets that expose them.

## Practical Execution Rules

Use this order when creating or refining implementation phases:

1. Create or update the conformance tracker as soon as Stage 0 starts.
2. Do not start a stage until its listed spec-tests have a concrete execution path in the harness.
3. Split broad current phases where the dependencies differ, especially the current Phase 4, Phase 5, and Phase 6 buckets.
4. Keep animation last, but keep conformance tracking continuous.
5. Treat any spec-test replaced by Ink or React as an explicit seam review, not an ignored file.
6. Every stage that produces widget components must also produce paired visual fixtures in `visual-tests/fixtures/` (`.py` + `.tsx`). Run `bash visual-tests/run.sh` as part of the stage exit check. The harness uses `uv` to manage the Python Textual dependency — it must never be silently skipped.

## Suggested Mapping Back To The Existing Phase Files

If the current seven files stay in place, the cleanest interpretation is:

- Current Phase 1 should explicitly contain Stages 0 and 1.
- Current Phase 2 should split into Stages 2 and 3.
- Current Phase 3 is close to Stage 4.
- Current Phase 4 should split into Stages 5 and 6.
- Current Phase 5 should split into Stages 7 and 8.
- Current Phase 6 should split into Stages 9 and 10.
- Current Phase 7 should remain Stage 11, but only for animation and the final audit.

That keeps the existing documents recognizable while aligning execution with actual dependencies.
