# Textual Specification Consolidation Report

## Scope

This report compares these spec sets only:

- `spec/spec-docs`
- `spec/spec-src`
- `spec/spec-tests`

Each finding is evidence-based and cites the specific spec sets and files involved.

## Finding Types

- **Direct contradiction**: two spec sets assert incompatible behavior.
- **Scope difference**: two spec sets describe different slices of the same area without direct conflict.
- **Missing coverage**: one spec set omits behavior documented in another.
- **Likely factual error**: a claim appears incorrect relative to the surrounding spec evidence.
- **Wording-only difference**: phrasing differs without changing meaning.

## Findings

### Runtime, Lifecycle, Screens, Notifications, Devtools, and Testing

- **Direct contradiction: app-level `COMMANDS` semantics disagree on whether custom providers replace or extend the system provider.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/command_palette.md`, `spec/spec-docs/actions_and_bindings.md`, `spec/spec-tests/command_palette.md`, `spec/spec-src/06-input-bindings-actions-and-commands.md`
  - Discrepancy: the docs say custom app providers are added by extending `App.COMMANDS` and present `SystemCommandsProvider` as the default baseline to keep, while the tests say that once `COMMANDS` is declared on the app, those providers are used instead of the built-in `SystemCommandsProvider`. The source-oriented spec says the palette chooses providers from the app/screen `COMMANDS` sets, but does not restate the replacement rule.
  - Why it matters: this changes which commands appear in the palette and whether overriding `COMMANDS` silently removes system commands.
  - Best interpretation: `spec-tests/command_palette.md` is the most precise behavioral contract here, so the docs look stale or underspecified rather than additive.

- **Direct contradiction: command-palette discovery visibility conflicts with “results hidden until typing.”**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/command_palette.md`, `spec/spec-tests/command_palette.md`, `spec/spec-src/06-input-bindings-actions-and-commands.md`
  - Discrepancy: both the docs and the tests say discovery hits should appear immediately on open, but the same test spec also says the result list is hidden until the user types a query.
  - Why it matters: this changes the initial visible UI state and the event sequence for automation.
  - Best interpretation: the “hidden until typing” sentence in `spec/spec-tests/command_palette.md` is the likely stale clause, because it conflicts with that file’s own discovery section and with the docs’ explicit discovery behavior.

- **Missing coverage: notification model and collection behavior are specified in tests and source specs but only partially documented in the docs spec set.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/app.md`, `spec/spec-docs/api_app.md`, `spec/spec-docs/widget_toast.md`, `spec/spec-tests/notifications.md`, `spec/spec-src/01-runtime-app-and-lifecycle.md`, `spec/spec-src/12-supporting-subsystems.md`
  - Discrepancy: the tests and source specs define `Notification` identity, `Notifications` collection pruning semantics, DOM-wide `notify()` funneling, and `clear_notifications()` / `_unnotify()` behavior; the docs focus on `App.notify()` and toast presentation, with much less detail on the underlying collection contract.
  - Why it matters: consumers reading only the docs set do not get the lifecycle and collection semantics that the tests treat as stable behavior.
  - Best interpretation: the docs set is UI-oriented here and under-documents the backing notification model.

- **Missing coverage: source specs define more app-level signals than the docs or tests surface.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/app.md`, `spec/spec-docs/api_app.md`, `spec/spec-tests/reactivity.md`, `spec/spec-src/01-runtime-app-and-lifecycle.md`, `spec/spec-src/07-workers-timers-and-signals.md`
  - Discrepancy: the source specs list `theme_changed_signal`, `app_suspend_signal`, `app_resume_signal`, `mode_change_signal`, and `screen_change_signal`; the docs mention only the first three, and the tests discuss signals generically rather than these app-level signals.
  - Why it matters: mode and screen transition observers are part of the published automation surface in the source spec, but that contract is largely invisible elsewhere.
  - Best interpretation: docs/tests are incomplete rather than contradictory.

- **Missing coverage: testing surfaces are underspecified in docs relative to source and tests.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/testing.md`, `spec/spec-src/13-testability-and-automation-surfaces.md`, `spec/spec-tests/testing.md`
  - Discrepancy: the source and test specs define concrete `run_test()` and `Pilot` behavior such as exception propagation, synthetic input semantics, and idle/wait coordination, while the docs set is much thinner.
  - Why it matters: high-value harness behavior is effectively test-only knowledge if readers start from the docs set.
  - Best interpretation: the docs set under-documents the testing contract.

### DOM, Reactivity, Queries, Messages, and Events

- **Direct contradiction: reactive `init` defaults disagree.**
  - Spec sets: `spec-docs`, `spec-tests`
  - Files: `spec/spec-docs/reactivity.md`, `spec/spec-tests/reactivity.md`
  - Discrepancy: the docs say `reactive()` defaults to `init=True`, while the tests say `reactive` defaults to `init=False` and contrast that with `var` defaulting to `init=True`.
  - Why it matters: this determines whether startup watchers fire without an explicit assignment.
  - Best interpretation: the test spec is behavior-focused and more specific; the docs set likely contains the stale default.

- **Direct contradiction: the reactive execution pipeline order is reversed between docs and tests.**
  - Spec sets: `spec-docs`, `spec-tests`
  - Files: `spec/spec-docs/reactivity.md`, `spec/spec-tests/reactivity.md`
  - Discrepancy: the docs say assignment runs compute methods before validation and then watchers; the tests say private/public validators run first, then private/public watchers, then compute methods for dependent reactives.
  - Why it matters: validators, watchers, and computed values can all have side effects, so the order is part of the observable contract.
  - Best interpretation: the two specs cannot both be true; the tests read like the intended behavioral contract, while the docs read like an outdated implementation description.

- **Direct contradiction: widget/DOM ID uniqueness scope is “within the DOM/screen” in docs but “among siblings” in tests.**
  - Spec sets: `spec-docs`, `spec-tests`
  - Files: `spec/spec-docs/dom_and_queries.md`, `spec/spec-docs/widgets_overview.md`, `spec/spec-tests/widget.md`
  - Discrepancy: the docs say IDs should be unique within the DOM and describe widget IDs as unique within a screen, but the widget tests say mounting duplicate IDs is illegal among siblings.
  - Why it matters: this changes whether two widgets in different branches of the same screen may legally share an ID.
  - Best interpretation: the test spec is the sharper runtime contract; the docs overstate the uniqueness boundary.

- **Missing coverage: malformed selector behavior is specified in tests but only partially documented in the docs.**
  - Spec sets: `spec-docs`, `spec-tests`
  - Files: `spec/spec-docs/dom_and_queries.md`, `spec/spec-tests/dom.md`
  - Discrepancy: the tests explicitly say malformed selectors raise `InvalidQueryFormat` from `query`, `query_one`, and chained operations like `exclude`; the docs mention `InvalidQueryFormat` and `query_ancestor`, but do not give the same explicit error contract for `query` or `DOMQuery.exclude`.
  - Why it matters: selector failure mode is part of API ergonomics and affects defensive code.
  - Best interpretation: docs are incomplete rather than inconsistent.

- **Scope difference: the source spec formalizes dispatch-layer responsibilities that the docs and tests spread across multiple topics.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/events.md`, `spec/spec-tests/events_and_messages.md`, `spec/spec-src/03-message-event-and-dispatch.md`
  - Discrepancy: the source spec centralizes queue lifecycle, suppression, coalescing, and handler ordering in one dispatcher contract, while the docs and tests cover the same space from API and example angles without a single canonical dispatch narrative.
  - Why it matters: this is not a behavioral conflict, but it makes it harder to identify the single dispatch authority from the non-source spec sets.
  - Best interpretation: organization difference, not semantic disagreement.

### Styling, CSS Engine, Animation, Layout, Rendering, Compositor, and Scrolling

- **Direct contradiction: `force_stop_animation` callback timing differs between docs and tests.**
  - Spec sets: `spec-docs`, `spec-tests`
  - Files: `spec/spec-docs/animation.md`, `spec/spec-tests/animations.md`
  - Discrepancy: the docs say `force_stop_animation(...)` invokes `on_complete`, while the tests say the callback is scheduled via `app.call_later`, including for forced stops.
  - Why it matters: callback timing changes observable ordering and re-entrancy.
  - Best interpretation: the tests are more precise and the docs likely compress “scheduled soon” into “invoked.”

- **Direct contradiction: CSS `initial` behavior is over-generalized in the docs overview.**
  - Spec sets: `spec-docs`, `spec-tests`
  - Files: `spec/spec-docs/css_overview.md`, `spec/spec-tests/css_styles.md`
  - Discrepancy: the docs say `initial` resets properties to whatever the widget `DEFAULT_CSS` defines, while the tests show `background: initial` resetting to transparent black even when inherited `DEFAULT_CSS` sets red.
  - Why it matters: reset semantics affect cascade reasoning and author expectations.
  - Best interpretation: `initial` is property-sensitive and the docs overview rule is too broad.

- **Direct contradiction: Sparkline constructor and reduction behavior diverge between docs and tests.**
  - Spec sets: `spec-docs`, `spec-tests`
  - Files: `spec/spec-docs/api_renderables.md`, `spec/spec-docs/widget_sparkline.md`, `spec/spec-tests/renderables.md`
  - Discrepancy: the docs allow `Sparkline(width=None)` and say the default reduction uses `max`, while the tests say explicit width is required and bucket downsampling averages values.
  - Why it matters: this changes both constructor validity and rendered output.
  - Best interpretation: the tests look stale at least on the reduction rule because both docs agree on `max`, but the width requirement remains unresolved from the three spec sets alone.

- **Missing coverage: the source spec defines a single authoritative CSS property inventory, but the other sets do not expose an equivalent canonical list.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-src/04-styling-and-css-engine.md`, `spec/spec-docs/css_overview.md`, `spec/spec-docs/styles_*.md`, `spec/spec-tests/css_*.md`
  - Discrepancy: the source spec explicitly names `RulesMap` as the authoritative style-key inventory and gives a current key count, while the docs split style properties across many pages and the tests split them across targeted behavior files without one canonical inventory.
  - Why it matters: it is harder to resolve “is this a supported style?” questions from the docs/tests alone.
  - Best interpretation: coverage asymmetry, not contradiction.

- **Missing coverage: compositor responsibilities are richly specified in tests and source specs but have little direct representation in the docs set.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-tests/compositor.md`, `spec/spec-src/05-layout-render-and-compositor.md`, `spec/spec-docs/layout.md`, `spec/spec-docs/widgets_overview.md`
  - Discrepancy: the tests and source specs describe region-to-span conversion, visibility tracking, scroll-aware placement, dirty regions, and compositor lookup helpers; the docs set covers layout and widget rendering concepts, but not the compositor contract at similar depth.
  - Why it matters: low-level rendering behavior is machine-specified in tests/src, but largely implicit in docs.
  - Best interpretation: major docs coverage gap.

- **Missing coverage: exact compositor span-merging rules and `StylesCache` behavior are effectively test-only.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-tests/compositor.md`, `spec/spec-tests/css_styles.md`, `spec/spec-src/05-layout-render-and-compositor.md`, `spec/spec-src/12-supporting-subsystems.md`
  - Discrepancy: tests define `_regions_to_spans` merging semantics, exclusive-end spans, dirty-line behavior, and callback caching, while the source/docs sets do not give the same precision.
  - Why it matters: these are concrete rendering and invalidation contracts with regression value.
  - Best interpretation: source and docs under-specify important compositor/cache behavior.

- **Scope difference: animation ownership is split differently across spec sets.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/animation.md`, `spec/spec-tests/animations.md`, `spec/spec-src/12-supporting-subsystems.md`, `spec/spec-src/04-styling-and-css-engine.md`
  - Discrepancy: the docs and tests treat animation as a user-facing subsystem centered on `animate()` and `Animator`, while the source spec spreads animation across supporting subsystems and CSS transitions.
  - Why it matters: not a semantic conflict, but it fragments where animation behavior is expected to live.
  - Best interpretation: categorization difference.

### Input, Bindings, Actions, Commands, Workers, Timers, Signals, Drivers, and Platform Behavior

- **Direct contradiction: `check_action(None)` footer behavior differs between docs and tests.**
  - Spec sets: `spec-docs`, `spec-tests`
  - Files: `spec/spec-docs/actions_and_bindings.md`, `spec/spec-tests/bindings_and_actions.md`
  - Discrepancy: the docs say `None` prevents the action but keeps the key visible in the footer, dimmed; the tests say `None` hides the binding and consumes the key press, the same as `False`.
  - Why it matters: this changes both UI discoverability and runtime behavior.
  - Best interpretation: the specs are incompatible and need explicit reconciliation.

- **Missing coverage: driver normalization and backend differences are first-class in source specs but only lightly surfaced elsewhere.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-src/08-drivers-io-and-platform-behavior.md`, `spec/spec-tests/driver.md`, `spec/spec-docs/app.md`, `spec/spec-docs/testing.md`
  - Discrepancy: the source spec defines `Driver.process_message` as the single input-normalization boundary and enumerates concrete drivers and delivery behavior; the docs mostly expose `driver_class` and headless testing, and the tests cover selected driver behavior without presenting the same boundary model.
  - Why it matters: the source spec identifies a clear cross-platform enforcement point that readers of the other sets may miss.
  - Best interpretation: docs/tests under-document the architectural boundary.

- **Missing coverage: signal publish semantics in docs exceed what tests and source specs restate.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/api_signal.md`, `spec/spec-tests/reactivity.md`, `spec/spec-src/07-workers-timers-and-signals.md`
  - Discrepancy: the docs define `immediate=False`, weak-reference cleanup, owner-attachment gating, and callback scheduling via `call_next`; the tests cover subscription rules and lifecycle cleanup; the source spec keeps signal behavior high-level and app-signal focused.
  - Why it matters: the docs contain operational detail that is not reinforced by the behavior and source sets.
  - Best interpretation: docs are detailed here; tests/source are comparatively sparse.

- **Scope difference: workers and timers are described as explicit API objects in docs/tests but as lifecycle ownership boundaries in source specs.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/api_worker.md`, `spec/spec-docs/api_timer.md`, `spec/spec-tests/workers.md`, `spec/spec-src/07-workers-timers-and-signals.md`
  - Discrepancy: the docs/tests focus on concrete object behavior (`Worker`, `Timer`, `run_worker`, `@work`), while the source spec emphasizes ownership, lifecycle authority, and cross-cutting enforcement.
  - Why it matters: these views are complementary, but they make it hard to see one canonical “single enforcer” narrative outside the source spec.
  - Best interpretation: organizational difference, not contradiction.

- **Missing coverage: command-palette UX and hard-coded fallback bindings are fragmented across sets.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/actions_and_bindings.md`, `spec/spec-docs/command_palette.md`, `spec/spec-src/06-input-bindings-actions-and-commands.md`, `spec/spec-tests/bindings_and_actions.md`, `spec/spec-tests/command_palette.md`
  - Discrepancy: the source spec omits visible palette behaviors like click-away dismissal and “No matches found,” while the docs omit hard-coded fallback bindings that the tests treat as contractual.
  - Why it matters: users and maintainers must read all three sets to reconstruct one command and binding surface.
  - Best interpretation: fragmented coverage more than outright disagreement.

### Widget Base Contracts and Shared Widget Semantics

- **Direct contradiction: widget ID uniqueness scope conflicts here too, not just in DOM docs.**
  - Spec sets: `spec-docs`, `spec-tests`
  - Files: `spec/spec-docs/widgets_overview.md`, `spec/spec-tests/widget.md`
  - Discrepancy: the overview says widget IDs must be unique within a screen; the tests enforce uniqueness among siblings during mount.
  - Why it matters: widget composition APIs depend on the real uniqueness boundary.
  - Best interpretation: the overview is overstated.

- **Likely factual error: maximization terminology drifts between docs and the source widget contract.**
  - Spec sets: `spec-docs`, `spec-src`
  - Files: `spec/spec-docs/widgets_overview.md`, `spec/spec-src/09-widget-base-contract.md`
  - Discrepancy: the docs highlight `ALLOW_MAXIMIZE` as a shared widget class variable, while the source-spec widget surface calls out `ALLOW_IN_MAXIMIZED_VIEW`.
  - Why it matters: these are different concepts and blur the shared widget contract.
  - Best interpretation: terminology drift or an incomplete overview in the docs.

- **Missing coverage: the source widget-base spec describes disabled-state event gating and event forwarding, but the docs/tests only expose pieces of that contract.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/widgets_overview.md`, `spec/spec-tests/widget.md`, `spec/spec-src/09-widget-base-contract.md`
  - Discrepancy: the source spec states that disabled-state gating suppresses most pointer interactions while still allowing wheel scroll, and it explicitly documents `_forward_event`; the docs and tests describe disabled state and loading overlays, but not the same centralized event-gating contract.
  - Why it matters: event pass-through on disabled widgets affects accessibility and interaction expectations.
  - Best interpretation: source spec is more complete here.

- **Missing coverage: the source widget-base spec omits many observable behaviors that only appear in tests.**
  - Spec sets: `spec-tests`, `spec-src`
  - Files: `spec/spec-tests/widget.md`, `spec/spec-src/09-widget-base-contract.md`
  - Discrepancy: tests cover child movement and sorting helpers, visibility inheritance, focus-chain and trap behavior, tooltip dismissal triggers, loading-state interaction blocking, mount-point resolution, and positional pseudo-class properties that are not comparably explicit in the source widget-base spec.
  - Why it matters: the implementation-derived set does not fully own the widget behavior it is supposed to anchor.
  - Best interpretation: incomplete source-spec coverage.

### Built-in Widget Coverage

- **Direct contradiction: `ContentSwitcher` child-ID requirements differ between docs and tests.**
  - Spec sets: `spec-docs`, `spec-tests`
  - Files: `spec/spec-docs/widget_content_switcher.md`, `spec/spec-tests/containers.md`
  - Discrepancy: the docs say children without IDs are hidden and ignored by the switcher, while the tests say all children must have IDs and adding one without an ID raises `ValueError`.
  - Why it matters: this changes whether ID-less children are tolerated or rejected.
  - Best interpretation: the tests read like the stricter behavioral contract and the docs appear stale or incomplete.

- **Direct contradiction: `Tabs` visibility method names drift between docs and tests.**
  - Spec sets: `spec-docs`, `spec-tests`
  - Files: `spec/spec-docs/widget_tabs.md`, `spec/spec-tests/tabs_and_tabbed_content.md`
  - Discrepancy: docs describe `hide(tab_id)` and `show(tab_id)`, while tests attribute the same behavior to `hide_tab` and `show_tab`.
  - Why it matters: consumers cannot tell which API name is canonical.
  - Best interpretation: one set is carrying stale method names.

- **Missing coverage: several public built-ins from the source catalog lack dedicated docs pages and targeted tests.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-src/10-widget-catalog.md`, `spec/spec-docs/widgets_overview.md`, `spec/spec-tests/widget.md`
  - Discrepancy: the source catalog lists public built-ins including `HelpPanel`, `KeyPanel`, `Tooltip`, and `Welcome`, but the docs set has no dedicated widget pages for them and the tests set has no targeted files covering them.
  - Why it matters: these are part of the exported widget surface, but they are comparatively invisible in the docs/test specs.
  - Best interpretation: documentation and test coverage lag the exported catalog.

- **Scope difference: the docs set gives internal toast widgets standalone treatment even though the source catalog calls them internal companions, not public built-ins.**
  - Spec sets: `spec-docs`, `spec-src`
  - Files: `spec/spec-docs/widget_toast.md`, `spec/spec-src/10-widget-catalog.md`
  - Discrepancy: `widget_toast.md` reads like a normal widget spec page, while the source catalog explicitly classifies `_toast.py` as an internal companion module supporting notifications.
  - Why it matters: the docs set can mislead readers about which widget types are public API versus internal implementation surface.
  - Best interpretation: this is a scope mismatch, not necessarily a behavior error.

- **Missing coverage: some widgets are only covered indirectly in grouped files.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-src/10-widget-catalog.md`, `spec/spec-docs/widget_header_footer.md`, `spec/spec-docs/widget_tabbed_content.md`, `spec/spec-docs/widget_tabs.md`, `spec/spec-tests/header_and_footer.md`, `spec/spec-tests/tabs_and_tabbed_content.md`
  - Discrepancy: `Header`/`Footer` and `Tab`/`TabPane` are public widgets in the source catalog, but the docs/tests cover them only inside grouped pages rather than with their own per-widget specs.
  - Why it matters: grouped coverage is not wrong, but it makes inventory-level comparisons look thinner than the actual behavior coverage.
  - Best interpretation: organization difference with some discoverability cost.

### Text Editing, Document Model, Validation, Suggestions, Content, and Supporting Subsystems

- **Missing coverage: source ownership for text editing is deeper than the docs’ single-widget emphasis.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/widget_text_area.md`, `spec/spec-tests/text_area.md`, `spec/spec-tests/document.md`, `spec/spec-src/11-text-editing-and-document-model.md`
  - Discrepancy: the source spec and tests cover `Document`, `WrappedDocument`, navigator/history behavior, syntax-aware documents, and theme/language registration; the docs center on `TextArea` with less explicit treatment of the underlying document subsystem.
  - Why it matters: the deeper editor model is part of the stable behavior surface exercised by tests.
  - Best interpretation: the docs are user-facing and omit much of the internal-but-observable editor machinery.

- **Missing coverage: concrete `TextArea` editing semantics are mostly test-only.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/widget_text_area.md`, `spec/spec-tests/text_area.md`, `spec/spec-src/11-text-editing-and-document-model.md`
  - Discrepancy: the tests define insert / replace / delete offset rules, newline normalization, and API edits while `read_only=True`, while the docs and source specs stay much higher level.
  - Why it matters: core editor behavior is recoverable mainly from the tests.
  - Best interpretation: `TextArea` lacks one authoritative, user-visible behavioral owner.

- **Missing coverage: validation semantics are test-heavy and source-light in the docs set.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/api_validation.md`, `spec/spec-tests/input_validation.md`, `spec/spec-src/12-supporting-subsystems.md`
  - Discrepancy: tests specify `validate_on`, `valid_empty`, and CSS-class toggling on `Input`; the source spec names the validation framework and its consumers; the docs API page covers validators generically but not the same `Input`-level contract depth.
  - Why it matters: the user-visible validation surface is defined most concretely in tests, not in the docs.
  - Best interpretation: docs under-specify integration behavior.

- **Missing coverage: suggestions/completion behavior is under-specified in the source-oriented set.**
  - Spec sets: `spec-tests`, `spec-src`
  - Files: `spec/spec-tests/suggester.md`, `spec/spec-src/12-supporting-subsystems.md`
  - Discrepancy: the source spec names `Suggester`, `SuggestionReady`, and prefix completion, while the tests define cache-hit message posting and case-insensitive cache normalization.
  - Why it matters: observable suggester behavior is largely test-only.
  - Best interpretation: the implementation-derived spec is too shallow for a user-visible subsystem.

### Terminology, Ownership, and Source-of-Truth Drift

// [LAW:one-source-of-truth] The most consistent cross-cutting problem is that inventory, public intent, and observable behavior are split across three sets and do not consistently converge back to one authority.

- **Likely factual error: the docs coverage matrix still points at flat `spec/...` targets instead of the current split spec-set layout.**
  - Spec sets: `spec-docs`
  - Files: `spec/spec-docs/spec_coverage_matrix.md`
  - Discrepancy: the matrix maps documentation pages to paths like `spec/getting_started.md`, `spec/app.md`, and `spec/widget_button.md`, but the actual compared spec files live under `spec/spec-docs`, `spec/spec-src`, and `spec/spec-tests`.
  - Why it matters: the matrix claims complete coverage while pointing to canonical target paths that do not match the current spec-set structure.
  - Best interpretation: this file is stale relative to the present consolidated-spec layout.

- **Scope difference: the docs coverage matrix and source coverage matrix measure different things and are easy to misread as equivalent.**
  - Spec sets: `spec-docs`, `spec-src`
  - Files: `spec/spec-docs/spec_coverage_matrix.md`, `spec/spec-src/99-source-coverage-matrix.md`
  - Discrepancy: the docs matrix is nav-page-to-doc-spec coverage, while the source matrix is module-to-source-spec ownership. Both are called coverage matrices, but they answer different questions.
  - Why it matters: this can create false expectations that one matrix validates the other.
  - Best interpretation: naming overlap without semantic equivalence.

- **Cross-cutting finding: the three sets do not function as one authoritative stack in practice.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-src/00-overview-and-scope.md`, `spec/spec-src/10-widget-catalog.md`, `spec/spec-tests/command_palette.md`, `spec/spec-tests/renderables.md`, `spec/spec-tests/widget.md`
  - Discrepancy: `spec-src` declares source-derived authority, but many externally visible contracts only appear in tests or docs rather than in the source-derived set.
  - Why it matters: readers must merge all three sets mentally to recover one contract, and sometimes the sets disagree.
  - Best interpretation: `spec-src` currently acts as architectural ownership, `spec-docs` as public API intent, and `spec-tests` as observable behavior, but those roles are not consistently synchronized.

- **Cross-cutting finding: terminology drift now changes perceived ownership and behavior.**
  - Spec sets: `spec-docs`, `spec-tests`, `spec-src`
  - Files: `spec/spec-docs/widget_tabs.md`, `spec/spec-docs/widgets_overview.md`, `spec/spec-src/09-widget-base-contract.md`, `spec/spec-tests/tabs_and_tabbed_content.md`, `spec/spec-tests/widget.md`
  - Discrepancy: examples include `ALLOW_MAXIMIZE` versus `ALLOW_IN_MAXIMIZED_VIEW`, `hide/show` versus `hide_tab/show_tab`, and conflicting `id` uniqueness scopes.
  - Why it matters: readers cannot tell whether names changed, concepts split, or one set is stale.
  - Best interpretation: the drift is no longer merely editorial; it materially obscures the contract.

### Coverage Gaps

- `spec-src` is the clearest authority for architectural ownership and cross-cutting boundaries, but many of those boundaries are not re-expressed in `spec-docs` or `spec-tests`.
- `spec-docs` is broadest on API surface, but public-widget coverage is uneven relative to the source widget catalog.
- `spec-tests` is strongest on observable behavior, but some files contain internally conflicting statements, especially around command-palette initial visibility.
- Notification internals, app-level signals, compositor mechanics, and driver normalization are the largest cross-set depth mismatches.
- `TextArea`, suggestions, validation, and renderables all have one-source-of-truth problems: inventory and public intent live in one set while concrete behavior lives in another.

## Audit Notes

- The strongest direct contradictions are in command-palette provider semantics, `check_action(None)` footer behavior, reactive `init` defaults, reactive execution order, widget/DOM ID uniqueness scope, `ContentSwitcher` child ID rules, `Tabs` visibility method names, CSS `initial`, Sparkline behavior, and `force_stop_animation` callback timing.
- The largest likely stale file is `spec/spec-docs/spec_coverage_matrix.md`.
- The largest “public API exists but is hard to find in docs/tests” gap is the source-catalog exposure of `HelpPanel`, `KeyPanel`, `Tooltip`, and `Welcome`.
