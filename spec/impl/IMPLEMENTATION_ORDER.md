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

## Recommended Order

| Stage | Name | Primary Specs | Primary spec-tests | Why it comes here |
|-------|------|---------------|--------------------|-------------------|
| 0 | Harness and Renderer Seams | `00`, `13`, `14`, `08` | `testing.md`, `geometry.md`, startup slice of `app.md` | Establishes React/Ink/MobX bootstrapping, `runTest`, `Pilot`, and the terminal integration seam before framework logic starts depending on them. |
| 1 | Runtime Spine | `01`, `02`, `03` | `reactivity.md`, `events_and_messages.md`, lifecycle slice of `app.md`, derived coverage for `auto_refresh.md` | Builds the app shell, widget registry, message dispatch, and MobX-backed reactive pipeline that every later subsystem sits on. |
| 2 | Style Values and Render Bridge | `04`, `05`, `12`, `14` | `color.md`, `css_scalars.md`, `css_parsing.md` | Separates scalar/color/value semantics from full cascade logic so TCSS, layout hints, and Ink translation share stable primitives. |
| 3 | Cascade, Selectors, and Query | `02`, `04`, `05` | `css_styles.md`, `css_nested.md`, `dom.md`, `borders.md` | Once widget identity and style values exist, selector matching, query traversal, and resolved-style computation can land without reworking the runtime spine. |
| 4 | Widget Base Contract and Interaction Shell | `01`, `03`, `05`, `06`, `09` | `widget.md`, `screens.md`, `bindings_and_actions.md`, screen/mode slice of `app.md`, routing slice of `input.md`, `scrolling.md` | Focus, screen stack, actions, disabled/loading behavior, and scroll behavior are the interaction substrate for almost every real widget. |
| 5 | Background and App Services Core | `01`, `07`, `12` | `workers.md`, `concurrency.md`, `notifications.md` | Workers, timers, signals, notifications, and theming are reusable app services that other features consume but do not redefine. |
| 6 | Discovery and Input Support Services | `06`, `12` | `command_palette.md`, `input_validation.md`, `suggester.md` | Command discovery depends on screens/bindings plus worker-backed providers; validation and suggestions should exist before the first serious text-entry widget. |
| 7 | Core Text and Control Widgets | `10`, `12` | `content_and_strip.md`, `markup.md`, `renderables.md`, `static.md`, `rule.md`, `button.md`, `switch.md`, `toggles.md`, `progress_bar.md`, `input.md`, `header_and_footer.md`, `links.md`, `selection.md` | This is the first point where the framework can support the basic application surface area without stubbing rich-text behavior or input support. |
| 8 | Containers, Lists, and Selection Surfaces | `05`, `10` | `containers.md`, `collapsible.md`, `tabs_and_tabbed_content.md`, `list_view.md`, `option_list.md`, `select.md`, `selection_list.md` | These widgets depend on the interaction shell plus the simple controls, but they do not require the full document model. |
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
- initial conformance ledger seeded from `spec/spec-src/99-source-coverage-matrix.md`

Why first:
- `testing.md` is a prerequisite for machine-verifiable progress on every later stage.
- `14` and `08` define the trust boundary between textual-js and Ink; they should be settled before runtime semantics accumulate on top of an unstable seam.

### Stage 1: Runtime Spine

Specs:
- `spec/spec-src/01-runtime-app-and-lifecycle.md`
- `spec/spec-src/02-dom-reactivity-and-query.md` (registry/reactivity slice)
- `spec/spec-src/03-message-event-and-dispatch.md`

Deliverables:
- `TextualApp` shell and lifecycle
- widget registration and parent linkage
- MobX validate/watch/compute pipeline
- message posting, bubbling, coalescing, handler resolution

Why before styling:
- Query, focus, bindings, and service stores all assume a stable runtime object model.
- The registry is the single index of widget identity; cascade and query should consume it rather than inventing parallel structures.

### Stage 2: Style Values and Render Bridge

Specs:
- `spec/spec-src/04-styling-and-css-engine.md` (value/parsing slice)
- `spec/spec-src/05-layout-render-and-compositor.md` (Ink translation seam)
- `spec/spec-src/12-supporting-subsystems.md` (color/content primitives used by styling)
- `spec/spec-src/14-renderer-integration-seams.md`

Deliverables:
- TCSS scalar units and parsers
- color parsing and normalization
- stable `ResolvedStyles` value model
- TCSS-to-Ink prop translation primitives

Why before full cascade:
- Scalar/color bugs are cheaper to isolate before selector matching and pseudo-class invalidation are added.
- This stage defines the data types that the cascade will produce, which keeps style resolution data-driven.

### Stage 3: Cascade, Selectors, and Query

Specs:
- `spec/spec-src/02-dom-reactivity-and-query.md` (query slice)
- `spec/spec-src/04-styling-and-css-engine.md`
- `spec/spec-src/05-layout-render-and-compositor.md`

Deliverables:
- selector matching against the widget registry
- query traversal APIs
- specificity, variables, nested rules, inline overrides
- border/title handling and other render-adjacent style behavior

Why before focus and widgets:
- Widgets should consume `useStyles()` and query helpers, not force the styling model to be retrofitted after the catalog exists.

### Stage 4: Widget Base Contract and Interaction Shell

Specs:
- `spec/spec-src/01-runtime-app-and-lifecycle.md` (screen stack and modes)
- `spec/spec-src/03-message-event-and-dispatch.md` (routing slice)
- `spec/spec-src/05-layout-render-and-compositor.md` (scroll slice)
- `spec/spec-src/06-input-bindings-actions-and-commands.md` (bindings/actions slice)
- `spec/spec-src/09-widget-base-contract.md`

Deliverables:
- focus manager
- screen stack and per-mode stacks
- binding normalization and action dispatch
- disabled/loading/tooltip behavior
- scroll APIs and input routing

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

Why split from Stage 6:
- Workers/timers/signals/themes are reusable primitives.
- Command palette, validators, and suggesters are product-facing consumers of those primitives and can land immediately after them.

### Stage 6: Discovery and Input Support Services

Specs:
- `spec/spec-src/06-input-bindings-actions-and-commands.md` (command palette slice)
- `spec/spec-src/12-supporting-subsystems.md` (validation/suggester slice)

Deliverables:
- command palette
- command provider model
- validation framework
- suggestion framework

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

Why this grouping:
- These are the smallest complete application-building blocks.
- Pulling `content_and_strip.md`, `markup.md`, and `renderables.md` forward prevents a false split where “simple” widgets exist before their text/rendering substrate.

### Stage 8: Containers, Lists, and Selection Surfaces

Specs:
- `spec/spec-src/05-layout-render-and-compositor.md`
- `spec/spec-src/10-widget-catalog.md`

Deliverables:
- `ScrollableContainer`, `Vertical`, `Horizontal`, `ContentSwitcher`, `Collapsible`
- `Tabs`, `TabbedContent`
- `ListView`, `OptionList`, `Select`, `SelectionList`

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

Why near the end:
- Markdown is a composition feature. It depends on rich content, tables or grid rendering, scrolling containers, links, and syntax highlighting.

### Stage 11: Animation and Final Conformance Audit

Specs:
- `spec/spec-src/12-supporting-subsystems.md` (animation slice)
- all prior specs as audit inputs

Deliverables:
- animator
- CSS transition support
- final `CONFORMANCE.md` audit

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
