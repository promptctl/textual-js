# `TextualFramework` Public Surface Audit

## 1. Intro

This audit was produced for lit epic `textual-true-north-thu` (the True North architecture refactor) and specifically ticket `textual-true-north-thu.1` ("Audit `TextualFramework` public surface"). It is a read-only inventory.

The framing comes from `design-docs/true-north-arch-refactor.md`:

- **Phase 1: Declare the Runtime Truth** (lines 437–447): "every new architectural decision assumes `App` is the owner; no new features deepen `TextualFramework` as a peer public runtime."
- **§"Hidden Runtime Root"** (lines 50–63): "the real runtime authority is `TextualFramework`; `App` is mostly a facade." The end state is "`App` is the runtime root; any framework-like machinery becomes internal to `App`."
- **Principle 1: "App Owns Runtime"** (lines 157–175): `App` owns "widget registry and widget lifecycle, screen stack and active screen, focus and pointer routing, message dispatch, style cascade and recomputation triggers, timers / workers / coordinated shutdown, notifications / tooltips / command palette / other app-scoped runtime features, testing hooks and runtime inspection." Internal services exist as private collaborators.

This audit inventories every member of `class TextualFramework` (defined at `src/framework/app-framework.ts:517`), classifies it by concern, identifies write vs. read authority, counts external callsites, and proposes the App-side public surface that should host it after Phase 1 / Phase 2. The downstream consumers of this audit:

- ticket `.2` ("Define App's public runtime API") uses the `Proposed App Surface` column to decide what App should grow.
- ticket `.3` ("Rewrite consumers to use App, not `TextualFramework` or `.framework`") executes the changes implied by §5 ("Bypass paths").
- ticket `.4` ("Stop public-exporting `TextualFramework`") executes §6 ("Public export leak").
- ticket `.6` ("Move tests to App-driven harnesses") rewrites the test consumers in §5.
- ticket `.8` ("Vet `[LAW:...]` markers") will cross-check the `Existing LAW Markers` column against post-Phase-1 reality, since markers asserting "framework owns X" become lying-markers once App owns X.

Scope: **read-only**. No source files were edited as part of producing this document. The only artifact created is this file.

## 2. Method

Members were enumerated by reading `src/framework/app-framework.ts` lines 517–3916 and listing every non-`private`, non-`#`-prefixed instance member declared on `class TextualFramework`. Members were classified by inspecting the body of each method/getter to determine whether the operation is a Read (returns derived value, no `this.foo = …`, no `runInAction`, no array push/pop, no signal `.publish`, no map mutation) or a Write (any of those). Both → `RW`. Callsites were counted with `grep -rE 'framework\.<member>([^a-zA-Z_]|$)'` (also `widget.framework.<member>`, `app.framework.<member>`, and the `ownedFramework.<member>` short-lived alias used in `src/app/textual-app.tsx`) restricted to `src/` and `tests/`, then filtered to drop matches inside `src/framework/`. "External" therefore means any TS/TSX file outside `src/framework/`. `src/widgets/`, `src/styles/`, `src/services/`, `src/commands/`, `src/app/`, `src/testing/`, and `tests/` are all external. Spot-checks read each cited line directly. A handful of members carry both camelCase and snake_case Python-mirror aliases (`callFromThread` / `call_from_thread`, `ansiTheme` / `ansi_theme`); only the camelCase canonical form is given a row.

## 3. Per-concern tables

Conventions:
- A `[LAW:…]` marker in the `Existing LAW Markers` column is the marker as it appears on or within ~5 lines of the member declaration. Markers belonging to a member's *implementation body* are also captured because they're what a future "marker is lying" audit (ticket `.8`) will scan.
- "yes (test)" in `Public Boundary?` means the member is consumed by test files — those tests are themselves bypass paths and need rewriting in ticket `.6`, but the member itself is still a meaningful runtime contract.
- Cited lines are the exact `file:line` of a representative consumer; entries are capped at 5 with a `... (N total)` overflow.

### 3.1 Lifecycle (mount / run / exit / suspend / shutdown / batchUpdate)

| Member | R/W | Callsites | Dead? | External Consumers | Public Boundary? | Existing LAW Markers | Proposed App Surface |
|---|---|---|---|---|---|---|---|
| `startup()` | W | 2 |  | `src/app/textual-app.tsx:176`; `tests/screens.test.tsx:458` | yes | — | `App.startup()` (or merge into `App.run()` — currently no App method delegates) |
| `shutdown()` | W | 3 |  | `src/app/textual-app.tsx:179`; `tests/screens.test.tsx:476`; `tests/app.test.tsx:413` | yes (test + host) | — | `App.shutdown()` (no current App method delegates) |
| `exit(result?)` | W | 2 |  | `src/app/app.tsx:235`; `src/testing/run-test.tsx:179` | yes | — | `App.exit(result)` exists at `src/app/app.tsx:234` |
| `exitResult` (getter via field) | R | 2 |  | `src/app/app.tsx:231`; `src/testing/run-test.tsx:452` | yes | — | `App.returnValue` exists at `src/app/app.tsx:230` |
| `suspend(callback)` | W | 2 |  | `src/app/app.tsx:341`; `tests/app.test.tsx:630` | yes (test) | `[LAW:single-enforcer]` at line 1575 ("App suspend owns signal publishing, timer pausing, and driver mode changes") | `App.suspend(callback)` exists at `src/app/app.tsx:340` |
| `isRunning` (field) | R | 8 |  | `tests/app.test.tsx:124`; `tests/app.test.tsx:153`; `tests/app.test.tsx:426`; `tests/stage0-app.test.tsx:48`; `tests/stage0-app.test.tsx:57`; ... (8 total) | yes (test) | — | `App.isRunning` (new) |
| `batchUpdate(callback)` | W | 1 |  | `src/app/app.tsx:243` | yes | `[LAW:single-enforcer]` at line 845 ("Batched style and queue flushes resume only from the outermost batch boundary") | `App.batchUpdate(callback)` exists at `src/app/app.tsx:242` |
| `batchUpdateCount` (field) | R | 2 |  | `src/app/app.tsx:239`; `tests/stage1-runtime.test.tsx:88` | yes (test) | — | `App.batchUpdateCount` exists at `src/app/app.tsx:238` |
| `setCaptureUnhandledErrors(enabled)` | W | 1 |  | `src/testing/run-test.tsx:404` | yes (test) | — | `internal — not public` (only used by test harness; merge into App.runTest) |
| `reportUnhandledError(error)` | W | 1 |  | `src/testing/run-test.tsx:88` | yes (test) | — | `internal — not public` (host-renderer error bridge; should be App-internal) |
| `throwPendingError()` | W | 2 |  | `src/testing/run-test.tsx:373`; `src/testing/run-test.tsx:440` | yes (test) | — | `internal — not public` (paired with `setCaptureUnhandledErrors`) |
| `whenIdle()` | R | 180 |  | `tests/focus.test.tsx` (≈70); `tests/bindings.test.tsx`, `tests/screens.test.tsx`, `tests/app.test.tsx` and 10 other test files; `src/testing/run-test.tsx` | yes (test) | `[LAW:single-enforcer]` at line 1921 ("Queue idleness is observed from this boundary so tests and framework callers share one definition of 'fully drained.'") | `App.whenIdle()` (new) — heaviest test-touched method; central to migration |

### 3.2 Widget Registry (registration, type registration, lookups, walks)

| Member | R/W | Callsites | Dead? | External Consumers | Public Boundary? | Existing LAW Markers | Proposed App Surface |
|---|---|---|---|---|---|---|---|
| `registry` (`WidgetRegistry` field) | R | 124 |  | `tests/widget-components.test.tsx:85`; `tests/widget-components.test.tsx:99`; `src/app/app.tsx:133`; `src/styles/pseudo-classes.ts:32`; `src/styles/pseudo-classes.ts:35`; ... (124 total — heaviest namespace bypass) | yes (test + style engine) | — | `App.<widgets sub-API>` (new) — but `WidgetRegistry` is itself a sibling internal service; tests should not reach it directly |
| `registerWidget(widget)` | W | 17 |  | `tests/widget-stage4.test.tsx:84`; `tests/widget-stage4.test.tsx:119`; `tests/widget-state.test.tsx:365`; `tests/app.test.tsx:295`; `tests/stage1-runtime.test.tsx:468`; ... (17 total) | yes (test) | `[LAW:single-enforcer]` at line 1201 ("the Mount dispatch is the single point that marks the widget ready") | `internal — not public` (mount path; tests should mount through App.runTest) |
| `unregisterWidget(nodeId)` | W | 0 | yes |  | no | `[LAW:single-enforcer]` at line 1239 ("Unmount-driven signal cleanup runs here"); `[LAW:single-enforcer]` at line 1250 ("Focus recovery after removal enters through the framework focus boundary") | `internal — not public` (called only from sibling internals `widget.ts`, `context.tsx`) |
| `notifyWillUnmount(widget)` | W | 0 | yes |  | no | — | `internal — not public` (sibling-internal lifecycle hook) |
| `registerWidgetType(typeName, options?)` | W | 2 |  | `tests/styles.test.tsx:677`; `tests/styles.test.tsx:680` | yes (test) | `[LAW:one-source-of-truth]` at line 1148 ("Widget type metadata is canonical per type. Conflicting registrations fail instead of letting mount order decide") | `internal — not public` (tests assert behavior of duplicate registration; rewrite as App-driven CSS conflict tests) |
| `getWidgetTypeMetadata(typeName)` | R | 2 |  | `src/styles/stylesheet.ts:1986`; `src/styles/stylesheet.ts:2128` | no (style engine) | — | `internal — not public` (style engine reads it; will move with style engine extraction in Phase 7) |
| `widgetMatchesType(typeName, expected)` | R | 0 | yes |  | no | — | `internal — not public` |
| `resolveWidgetTypeName(constraint)` | R | 0 | yes |  | no | — | `internal — not public` |
| `findWidgets(selector)` | R | 3 |  | `src/app/app.tsx:143`; `src/testing/run-test.tsx:250`; `src/testing/run-test.tsx:367` | yes | — | `App.query(selector)` / `App.findWidgets(selector)` (new). Currently App exposes only `getChildById` / `getWidgetById` |
| `parseSelectors(selectorText)` | R | 0 | yes |  | no | — | `internal — not public` (sibling-internal use only — `widget.ts`) |
| `matchesSelector(widget, selector)` | R | 0 | yes |  | no | — | `internal — not public` (sibling-internal — `dom-query.ts`, `widget.ts`) |
| `isNodeMounted(widget)` | R | 2 |  | `src/services/signal.ts:45`; `src/services/signal.ts:48` | no (services bridge) | — | `internal — not public` (Signal lifecycle is service-internal) |

### 3.3 Screens (push/pop/switch, modes, screen stack, install/uninstall)

| Member | R/W | Callsites | Dead? | External Consumers | Public Boundary? | Existing LAW Markers | Proposed App Surface |
|---|---|---|---|---|---|---|---|
| `installScreen(name, factory)` | W | 5 |  | `src/app/app.tsx:121`; `tests/screens.test.tsx:131`; `tests/screens.test.tsx:261`; `tests/screens.test.tsx:287`; `tests/screens.test.tsx:354` | yes | — | `App.installScreen(...)` exists at `src/app/app.tsx:120` |
| `uninstallScreen(name)` | W | 2 |  | `src/app/app.tsx:125`; `tests/screens.test.tsx:141` | yes | — | `App.uninstallScreen(name)` exists at `src/app/app.tsx:124` |
| `isScreenInstalled(name)` | R | 2 |  | `tests/screens.test.tsx:133`; `tests/screens.test.tsx:142` | yes (test) | — | `App.isScreenInstalled(name)` (new) |
| `getScreen(name, expectedType?)` | R | 6 |  | `src/app/app.tsx:129`; `src/app/textual-app.tsx:309`; `tests/screens.test.tsx:135`; `tests/screens.test.tsx:137`; `tests/screens.test.tsx:138`; ... (6 total) | yes | — | `App.getScreen(name, expectedType?)` exists at `src/app/app.tsx:128` |
| `pushScreen(descriptor, callback?, options?)` | W | 21 |  | `src/app/app.tsx:163`; `tests/command-palette.test.ts:185`; `tests/screens.test.tsx:167`; `tests/focus.test.tsx:235`; `tests/bindings.test.tsx:785`; ... (21 total) | yes | — | `App.pushScreen(...)` exists at `src/app/app.tsx:152` |
| `pushScreenWait(descriptor, options)` | W | 5 |  | `src/app/app.tsx:160`; `src/app/app.tsx:167`; `tests/screens.test.tsx:297`; `tests/screens.test.tsx:299`; `tests/screens.test.tsx:375` | yes | — | `App.pushScreenWait(...)` exists at `src/app/app.tsx:166` |
| `popScreen(result?)` | W | 10 |  | `src/app/app.tsx:171`; `tests/command-palette.test.ts:431`; `tests/focus.test.tsx:241`; `tests/screens.test.tsx:174`; `tests/screens.test.tsx:218`; ... (10 total) | yes | — | `App.popScreen(result)` exists at `src/app/app.tsx:170` |
| `dismissScreen(result?)` | W | 1 |  | `tests/screens.test.tsx:303` | yes (test) | — | `internal — not public` (screen-action alias for `popScreen`; no App delegation today and unique callsites are tests of `screen.dismiss` action) |
| `switchScreen(descriptor, options?)` | W | 2 |  | `src/app/app.tsx:175`; `tests/screens.test.tsx:404` | yes | — | `App.switchScreen(...)` exists at `src/app/app.tsx:174` |
| `addMode(name, factory)` | W | 6 |  | `src/app/app.tsx:183`; `tests/screens.test.tsx:418`; `tests/screens.test.tsx:453`; `tests/screens.test.tsx:484`; `tests/focus.test.tsx:222`; ... (6 total) | yes | — | `App.addMode(name, factory)` exists at `src/app/app.tsx:182` |
| `removeMode(name)` | W | 3 |  | `src/app/app.tsx:187`; `tests/screens.test.tsx:488`; `tests/screens.test.tsx:491` | yes | — | `App.removeMode(name)` exists at `src/app/app.tsx:186` |
| `switchMode(name)` | W | 11 |  | `src/app/app.tsx:179`; `tests/screens.test.tsx:434`; `tests/screens.test.tsx:441`; `tests/screens.test.tsx:467`; `tests/focus.test.tsx:246`; ... (11 total) | yes | — | `App.switchMode(name)` exists at `src/app/app.tsx:178` |
| `activeScreen` (getter) | R | 9 |  | `src/app/app.tsx:113`; `src/commands/command-palette.tsx:320`; `tests/app.test.tsx:675`; `tests/screens.test.tsx:124`; `tests/screens.test.tsx:249`; ... (9 total) | yes | `[LAW:dataflow-not-control-flow]` at line 2622 ("Reading screenStackVersion hooks MobX into mutations") | `App.screen` exists at `src/app/app.tsx:112` |
| `activeScreenElement` (getter) | R | 2 |  | `src/app/textual-app.tsx:194`; `tests/screens.test.tsx:125` | yes | — | `internal — not public` (used by host renderer to pick what to mount; should be host-internal after Phase 4) |
| `screenStackDepth` (getter) | R | 4 |  | `tests/screens.test.tsx:402`; `tests/screens.test.tsx:407`; `tests/screens.test.tsx:431`; `tests/screens.test.tsx:438` | yes (test) | — | `App.screenStackDepth` (new) |
| `getScreenStack(mode?)` | R | 4 |  | `src/app/app.tsx:109`; `src/app/app.tsx:117`; `tests/screens.test.tsx:123`; `tests/command-palette.test.ts:221` | yes | — | `App.screenStack` exists at `src/app/app.tsx:108` (getter form) |
| `activeMode` (field) | R | 2 |  | `tests/screens.test.tsx:437`; `tests/screens.test.tsx:444` | yes (test) | — | `App.activeMode` (new) |
| `screenStackVersion` (field) | R | 0 | yes |  | no | — | `internal — not public` (MobX read marker; sibling-internal hack) |

### 3.4 Styles (cascade, stylesheet management, recompute, screen-scoped CSS)

| Member | R/W | Callsites | Dead? | External Consumers | Public Boundary? | Existing LAW Markers | Proposed App Surface |
|---|---|---|---|---|---|---|---|
| `setUserStylesheet(source)` | W | 1 |  | `src/app/textual-app.tsx:236` | no (host bridge) | — | `internal — not public` (called only by `TextualApp` host wiring; should be App-internal stylesheet config) |
| `setCssPath(path)` | W | 1 |  | `src/app/textual-app.tsx:241` | no (host bridge) | — | `internal — not public` |
| `_on_css_change()` | W | 0 | yes |  | no | `[LAW:one-source-of-truth]` at line 1486 ("CSS_PATH files are parsed into the same userStylesheets list consumed by cascade resolution and hot reload") | `internal — not public` (filewatcher callback) |
| `_onCssChange()` (camelCase alias) | W | 0 | yes |  | no | — | `internal — not public` (alias) |
| `getActiveStylesheetsFor(typeName)` | R | 2 |  | `src/styles/stylesheet.ts:1985`; `tests/screens.test.tsx:345` | no (style engine) | — | `internal — not public` (style engine read; moves with style engine extraction in Phase 7) |
| `refreshStyles(changed)` | W | 0 | yes |  | no | — | `internal — not public` (sibling-internal: `widget.ts`, `dom-query.ts`) |
| `recalculateStyles()` | W | 0 | yes |  | no | `[LAW:dataflow-not-control-flow]` at line 1734 ("Every style recalculation walks the same tree in the same order. Variability lives in selector matches and values.") | `internal — not public` (sibling-internal style engine helper) |
| `terminalSize` (field; `Size`) | R | 17 |  | `src/commands/command-palette.tsx:382`; `src/app/textual-app.tsx:57`; `src/app/textual-app.tsx:200`; `src/styles/stylesheet.ts:2128`; `src/testing/run-test.tsx:269`; ... (17 total) | yes (host + test + style engine) | — | `App.terminalSize` (new) — needs read-only public form; style engine consumer should move with it |
| `setTerminalSize(size)` | W | 1 |  | `tests/styles.test.tsx:589` | yes (test) | — | `internal — not public` (test bypass; tests should drive size via `App.runTest({ size })`) |
| `setControlledTerminalSize(size)` | W | 2 |  | `src/testing/run-test.tsx:155`; `src/testing/run-test.tsx:403` | yes (test harness) | — | `internal — not public` (consumed only by `runTest` plumbing) |
| `syncHostTerminalSize(size)` | W | 1 |  | `src/app/textual-app.tsx:164` | no (host bridge) | — | `internal — not public` (host wires real-stdout size; App-internal) |

### 3.5 Focus (focused node, focus chain, focus traps, focus restore)

| Member | R/W | Callsites | Dead? | External Consumers | Public Boundary? | Existing LAW Markers | Proposed App Surface |
|---|---|---|---|---|---|---|---|
| `focusedNodeId` (field) | R | 26 |  | `src/styles/pseudo-classes.ts:20`; `tests/widget-stage4.test.tsx:229`; `tests/dom-query.test.tsx:177`; `tests/focus.test.tsx:161`; `tests/focus.test.tsx:189`; ... (26 total) | yes (test + style engine) | — | `App.focusedNodeId` or `App.focused` (new); style engine bypass should move with engine |
| `focusWidget(nodeId)` | W | 24 |  | `tests/widget-components.test.tsx:155`; `tests/widget-stage4.test.tsx:226`; `tests/widget-stage4.test.tsx:309`; `tests/focus.test.tsx`; ... (24 total) | yes (test) | — | `App.focusWidget(nodeId)` (new) — but the public-API form likely takes a Widget |
| `clearFocusWithin(container)` | W | 0 | yes |  | no | — | `internal — not public` |
| `trapFocus(widget, enabled?)` | W | 0 | yes |  | no | — | `internal — not public` (only sibling `widget.ts` may consume it; currently zero callers) |
| `getFocusChain()` | R | 10 |  | `tests/widget-components.test.tsx:256`; `tests/widget-components.test.tsx:372`; `tests/widget-stage4.test.tsx:212`; `tests/widget-stage4.test.tsx:307`; `tests/focus.test.tsx:121`; ... (10 total) | yes (test) | — | `App.getFocusChain()` (new) — read-only inspection |
| `focusNext(selector?)` | W | 13 |  | `tests/widget-components.test.tsx:427`; `tests/widget-stage4.test.tsx:213`; `tests/widget-state.test.tsx:288`; `tests/focus.test.tsx:126`; ... (13 total) | yes (test) | — | `App.focusNext(selector?)` (new); App currently delegates only via the `app.focus_next` action |
| `focusPrevious(selector?)` | W | 2 |  | `tests/focus.test.tsx`; `tests/widget-stage4.test.tsx` (2 total) | yes (test) | — | `App.focusPrevious(selector?)` (new) |
| `handleAppBlur()` | W | 3 |  | `tests/app.test.tsx:242`; `tests/app.test.tsx:272`; `tests/app.test.tsx:440` | yes (test) | — | `internal — not public` (host blur bridge; tests should drive through host-input simulation) |
| `handleAppFocus()` | W | 3 |  | `tests/app.test.tsx:246`; `tests/app.test.tsx:278`; `tests/app.test.tsx:446` | yes (test) | — | `internal — not public` (host focus bridge; same as above) |

### 3.6 Pointer (pointer location, hit testing, click chains, hover, tooltips, pointer shape)

| Member | R/W | Callsites | Dead? | External Consumers | Public Boundary? | Existing LAW Markers | Proposed App Surface |
|---|---|---|---|---|---|---|---|
| `hoveredNodeId` (field) | R | 0 | yes |  | no | — | `internal — not public` (sibling-internal; possibly also useful for inspection) |
| `pointerShape` (field) | R | 3 |  | `tests/app-pointer-stage4.test.tsx:40`; `tests/app-pointer-stage4.test.tsx:43`; `tests/app-pointer-stage4.test.tsx:46` | yes (test) | `[LAW:one-source-of-truth]` at line 2370 ("The hovered widget's resolved pointer rule is the canonical cursor-shape source") | `App.pointerShape` (new) |
| `setPointerShape(shape)` | W | 0 | yes |  | no | — | `internal — not public` |
| `activeTooltip` (field) | R | 14 |  | `src/app/textual-app.tsx:68`; `tests/tooltip.test.tsx:83`; `tests/tooltip.test.tsx:87`; `tests/tooltip.test.tsx:120`; `tests/tooltip.test.tsx:137`; ... (14 total) | yes (test + host) | — | `App.activeTooltip` (new) — read-only inspection; host renderer bypass should move with App-owned tooltip surface |
| `setShowTooltips(enabled)` | W | 1 |  | `src/testing/run-test.tsx:406` | yes (test) | — | `internal — not public` (wired through `App.runTest({ transients })`) |
| `showTooltips` (field) | R | 3 |  | `src/app/textual-app.tsx:70`; `tests/testing.test.tsx:361`; `tests/testing.test.tsx:369` | yes (test + host) | — | `internal — not public` (host-rendering gate) |
| `setTooltipDelay(delayMs)` | W | 9 |  | `tests/tooltip.test.tsx:80`; `tests/tooltip.test.tsx:97`; `tests/tooltip.test.tsx:115`; `tests/tooltip.test.tsx:131`; `tests/tooltip.test.tsx:147`; ... (9 total) | yes (test) | — | `App.tooltipDelay` setter (new) — currently passed only as construction option |
| `tooltipDelay` (field) | R | 0 | yes |  | no | — | `internal — not public` |
| `handleWidgetTooltipChange(widget)` | W | 0 | yes |  | no | — | `internal — not public` (sibling-internal hook from `widget.ts`) |
| `hitTest(screenX, screenY)` | R | 1 |  | `src/testing/run-test.tsx:302` | yes (test harness) | — | `internal — not public` (Pilot's targeting; should be App-internal) |
| `dispatchPointerClick(x, y, chain?)` | W | 0 | yes |  | no | `[LAW:single-enforcer]` at line 1826 ("Pointer clicks are synthesized from the same down/up path") | `internal — not public` |
| `dispatchPointerDown(x, y)` | W | 8 |  | `tests/app.test.tsx:490`; `tests/app.test.tsx:494`; `tests/app.test.tsx:498`; `src/testing/run-test.tsx:197`; `tests/focus.test.tsx:191`; ... (8 total) | yes (test) | — | `internal — not public` (raw pointer simulation; tests should drive Pilot) |
| `dispatchPointerUp(x, y)` | W | 7 |  | `tests/app.test.tsx:491`; `tests/app.test.tsx:495`; `tests/app.test.tsx:499`; `src/testing/run-test.tsx:199`; `tests/focus.test.tsx:187`; ... (7 total) | yes (test) | — | `internal — not public` |
| `dispatchPointerMove(x, y)` | W | 3 |  | `tests/widget-stage4.test.tsx:277`; `src/testing/run-test.tsx:201`; `tests/app.test.tsx:540` | yes (test) | — | `internal — not public` |
| `postClick(x, y, chain?)` | W | 0 | yes |  | no | — | `internal — not public` |
| `postMouseDown(x, y)` | W | 0 | yes |  | no | — | `internal — not public` |
| `postMouseUp(x, y)` | W | 0 | yes |  | no | — | `internal — not public` |
| `postMouseMove(x, y)` | W | 0 | yes |  | no | — | `internal — not public` |
| `postResize(width, height)` | W | 1 |  | `src/testing/run-test.tsx:156` | yes (test harness) | — | `internal — not public` |

### 3.7 Dispatch (message queue, action dispatch, binding resolution, key handling)

| Member | R/W | Callsites | Dead? | External Consumers | Public Boundary? | Existing LAW Markers | Proposed App Surface |
|---|---|---|---|---|---|---|---|
| `messageQueueSize` (getter) | R | 5 |  | `tests/message.test.tsx:85`; `tests/message.test.tsx:90`; `tests/message.test.tsx:123`; `tests/message.test.tsx:170`; `tests/concurrency.test.tsx:152` | yes (test) | — | `App.messageQueueSize` (new) |
| `getMessageQueueSize(targetId)` | R | 0 | yes |  | no | — | `internal — not public` |
| `postMessage(targetId, message)` | W | 32 |  | `tests/message.test.tsx:84`; `tests/message.test.tsx:119`; `tests/message.test.tsx:163`; `tests/screens.test.tsx:107`; ... (32 total) | yes (test) | — | `App.postMessage(target, message)` (new) — currently no App method delegates |
| `postAppMessage(message)` | W | 1 |  | `src/commands/command-palette.tsx:412` | no (sibling subsystem) | — | `internal — not public` (intra-runtime broadcast for command palette events; should be sibling-service-internal) |
| `postKey(input, meta?)` | W | 34 |  | `src/app/textual-app.tsx:159`; `src/testing/run-test.tsx:105`; `tests/stage1-runtime.test.tsx:205`; `tests/focus.test.tsx:209`; `tests/bindings.test.tsx:160`; ... (34 total) | yes (test + host) | `[LAW:dataflow-not-control-flow]` at line 1810 ("Every key event flows through the same two-phase pipeline") | `App.postKey(input, meta?)` (new) — host (`textual-app.tsx`) and Pilot already drive it; need a clean App entry |
| `postToFocused(message)` | W | 0 | yes |  | no | — | `internal — not public` |
| `dispatchMessage(message)` | W | 0 | yes |  | no | `[LAW:single-enforcer]` at line 1792 ("App-level dispatch chooses its target here") | `internal — not public` |
| `subscribeToMessages(subscriber)` | W | 10 |  | `src/testing/run-test.tsx:408`; `tests/widget-stage4.test.tsx:245`; `tests/concurrency.test.tsx:135`; `tests/stage1-runtime.test.tsx:95`; `tests/notifications.test.tsx:129`; ... (10 total) | yes (test) | `[LAW:one-source-of-truth]` at line 3375 ("Message observation is published from one boundary so tests and tooling share the same dispatch transcript") | `App.subscribeToMessages(subscriber)` (new) — primarily test/instrumentation surface |
| `preventMessages(targetId, types, callback)` | W | 0 | yes |  | no | `[LAW:single-enforcer]` at line 820 ("Scoped message suppression is captured at one framework boundary") | `internal — not public` (sibling-internal: `widget.ts:574`) |
| `disableMessages(targetId, types)` | W | 0 | yes |  | no | `[LAW:single-enforcer]` at line 887 ("Long-lived message suppression is stored in the framework queue gate") | `internal — not public` (sibling-internal: `widget.ts:578`) |
| `enableMessages(targetId, types)` | W | 0 | yes |  | no | — | `internal — not public` |
| `runAction(action, defaultTarget?)` | W | 13 |  | `tests/screens.test.tsx:370`; `tests/screens.test.tsx:379`; `tests/input-model.test.ts:447`; `tests/input-model.test.ts:450`; `tests/bindings.test.tsx:797`; ... (13 total) | yes (test) | `[LAW:single-enforcer]` at line 2989 ("runAction is the single action-dispatch boundary") | `App.runAction(action, defaultTarget?)` (new) |
| `checkAction(action, defaultTarget?)` | R | 1 |  | `tests/bindings.test.tsx:244` | yes (test) | — | `App.checkAction(action, defaultTarget?)` (new) |
| `dispatchNodeKeyBindings(node, key)` | W | 0 | yes |  | no | — | `internal — not public` |
| `notifyBindingsUpdated()` | W | 0 | yes |  | no | — | `internal — not public` |
| `getActiveBindings()` | R | 1 |  | `tests/footer.test.tsx:96` | yes (test) | `[LAW:single-enforcer]` at line 2658 ("Binding display is derived once here so widgets like Footer consume the same precedence, keymap, and checkAction rules") | `App.getActiveBindings()` (new) — Footer widget consumes via `useTextual` hook today; will move when sibling internal services land |
| `setKeymap(next)` | W | 6 |  | `tests/bindings.test.tsx:379`; `tests/bindings.test.tsx:452`; `tests/bindings.test.tsx:530`; `tests/bindings.test.tsx:548`; `tests/bindings.test.tsx:600`; ... (6 total) | yes (test) | `[LAW:one-source-of-truth]` at line 693 ("Runtime key remaps are canonicalized into one internal keymap store") | `App.setKeymap(next)` (new) — currently App accepts only construction-time `keymap` option |
| `updateKeymap(patch)` | W | 2 |  | `tests/bindings.test.tsx:454`; `tests/bindings.test.tsx:474` | yes (test) | — | `App.updateKeymap(patch)` (new) |
| `setAppBindings(declarations)` | W | 1 |  | `tests/bindings.test.tsx:778` | yes (test) | `[LAW:one-source-of-truth]` at line 686 ("App bindings are merged with navigation defaults at one point") | `internal — not public` (host wires construction-time bindings; mid-run mutation is a test-only bypass) |
| `setAppActions(actions)` | W | 1 |  | `tests/bindings.test.tsx:779` | yes (test) | — | `internal — not public` (same shape as `setAppBindings`) |
| `setAppAutoFocus(selector)` | W | 1 |  | `src/app/textual-app.tsx:286` | no (host bridge) | — | `internal — not public` |
| `setAppCommandProviders(providers)` | W | 2 |  | `tests/command-palette.test.ts:184`; `tests/command-palette.test.ts:216` | yes (test) | `[LAW:one-source-of-truth]` at line 1592 ("App COMMANDS are normalized into one provider set here") | `internal — not public` (host wires construction-time providers; tests should compose providers via App constructor) |
| `setSystemCommandResolver(resolver)` | W | 3 |  | `src/app/textual-app.tsx:268`; `tests/command-palette.test.ts:456`; `tests/command-palette.test.ts:489` | yes (test + host) | — | `internal — not public` (host wiring for `App.getSystemCommands`; tests should override `getSystemCommands`) |
| `getSystemCommands(screen)` | R | 1 |  | `src/commands/provider.ts:218` | no (sibling subsystem) | — | `internal — not public` (commands subsystem queries the resolver back through the framework — should query App directly post-Phase-1) |
| `searchCommands(commands)` | W | 3 |  | `src/app/app.tsx:345`; `tests/app.test.tsx:666`; `tests/app.test.tsx:684` | yes (test) | — | `App.searchCommands(commands)` exists at `src/app/app.tsx:344` |
| `openCommandPalette(options?)` | W | 6 |  | `tests/command-palette.test.ts:177`; `tests/command-palette.test.ts:187`; `tests/command-palette.test.ts:218`; `tests/command-palette.test.ts:247`; `tests/command-palette.test.ts:523`; ... (6 total) | yes (test) | — | `App.openCommandPalette(options?)` (new) — App currently exposes only `searchCommands` |
| `closeActiveCommandPalette(selected, command?)` | W | 4 |  | `src/commands/command-palette.tsx:372`; `src/commands/command-palette.tsx:404`; `src/commands/command-palette.tsx:422`; `tests/command-palette.test.ts:550` | yes (test + sibling subsystem) | — | `internal — not public` (palette widget closes itself; should be palette-internal via App callback) |
| `activeCommandPalette` (field) | R | 1 |  | `tests/app.test.tsx:676` | yes (test) | — | `internal — not public` (test inspection; subsumed by `App.commandPalette` if needed) |
| `handleBindingsClash(clashes, namespace)` | W | 0 | yes |  | no | — | `internal — not public` (overridable hook; currently no overrides) |

### 3.8 Async (timers, workers, after-refresh callbacks, next-tick callbacks, deferred scheduling)

| Member | R/W | Callsites | Dead? | External Consumers | Public Boundary? | Existing LAW Markers | Proposed App Surface |
|---|---|---|---|---|---|---|---|
| `workers` (`WorkerManager` field) | R | 15 |  | `src/app/app.tsx:251`; `tests/notifications.test.tsx:175`; `tests/command-palette.test.ts:551`; `tests/workers.test.tsx:84`; `tests/workers.test.tsx:85`; ... (15 total) | yes (test) | — | `App.workers` exists at `src/app/app.tsx:250` (already a namespaced sub-API) |
| `runWorker(node, work, options?)` | W | 0 | yes |  | no | — | `internal — not public` (sibling-internal: `widget.ts:750`; widgets use the public `widget.run_worker` hook) |
| `runAppWorker(work, options?)` | W | 11 |  | `src/app/app.tsx:247`; `tests/workers.test.tsx:179`; `tests/workers.test.tsx:188`; `tests/workers.test.tsx:189`; `tests/command-palette.test.ts:534`; ... (11 total) | yes (test) | `[LAW:single-enforcer]` at line 2042 ("exitOnError is enforced only at the framework worker-start boundary") | `App.runWorker(work, options?)` exists at `src/app/app.tsx:246` (delegates to `runAppWorker`); namespaced form `App.workers.run(...)` also viable |
| `setTimer(node, name, delay, callback)` | W | 0 | yes |  | no | `[LAW:single-enforcer]` at line 3847 ("Named timer replacement happens only here") | `internal — not public` (sibling-internal: `widget.ts:764`) |
| `setInterval(node, name, interval, callback, options?)` | W | 0 | yes |  | no | — | `internal — not public` |
| `clearTimer(node, name)` | W | 0 | yes |  | no | — | `internal — not public` |
| `pauseTimer(node, name)` | W | 0 | yes |  | no | — | `internal — not public` |
| `resumeTimer(node, name)` | W | 0 | yes |  | no | — | `internal — not public` |
| `resetTimer(node, name)` | W | 0 | yes |  | no | — | `internal — not public` |
| `callLater(callback, ...args)` | W | 4 |  | `src/services/signal.ts:51`; `tests/concurrency.test.tsx:107`; `tests/concurrency.test.tsx:148`; `tests/concurrency.test.tsx:178` | yes (test + service) | `[LAW:one-source-of-truth]` at line 2114 ("Deferred later-callbacks enter through the message queue") | `App.callLater(callback)` (new) — Signal bypass should move with Signal owner |
| `callNext(callback, ...args)` | W | 3 |  | `tests/concurrency.test.tsx:104`; `tests/concurrency.test.tsx:175`; `tests/stage1-runtime.test.tsx:115` | yes (test) | `[LAW:single-enforcer]` at line 2127 ("callNext ordering is enforced by the dispatcher") | `App.callNext(callback)` (new) |
| `callAfterRefresh(callback, ...args)` | W | 3 |  | `tests/concurrency.test.tsx:112`; `tests/concurrency.test.tsx:267`; `tests/concurrency.test.tsx:297` | yes (test) | — | `App.callAfterRefresh(callback)` (new) |
| `callFromThread(callback, ...args)` | W | 2 |  | `tests/concurrency.test.tsx:295`; `tests/concurrency.test.tsx:299` | yes (test) | `[LAW:single-enforcer]` at line 2161 ("The app-thread identity check lives at the callFromThread boundary") | `App.callFromThread(callback)` (new) |
| `call_from_thread` (snake_case alias) | W | 0 | yes |  | no | — | `internal — not public` (Python-mirror alias; drop entirely) |
| `attachAfterRefreshRequester(requester)` | W | 1 |  | `src/app/textual-app.tsx:184` | no (host bridge) | — | `internal — not public` (host registers refresh trigger; App-internal seam) |
| `flushAfterRefreshCallbacks()` | W | 1 |  | `src/app/textual-app.tsx:191` | no (host bridge) | — | `internal — not public` |
| `recordDisplayPass()` | W | 2 |  | `src/app/textual-app.tsx:190`; `src/testing/run-test.tsx:366` | no (host bridge + test harness) | — | `internal — not public` (host paint-pass tick) |
| `displayCount` (field) | R | 2 |  | `tests/concurrency.test.tsx:102`; `tests/concurrency.test.tsx:113` | yes (test) | — | `App.displayCount` (new) — used by tests asserting refresh ordering |
| `registerLayoutReader(nodeId, reader)` | W | 0 | yes |  | no | — | `internal — not public` (sibling-internal: `context.tsx:409`) |
| `createSignal(owner, description?)` | W | 0 | yes |  | no | — | `internal — not public` (sibling-internal: `widget.ts:760`) |

### 3.9 Notifications (notify / clearNotifications / _unnotify, theming, signals)

| Member | R/W | Callsites | Dead? | External Consumers | Public Boundary? | Existing LAW Markers | Proposed App Surface |
|---|---|---|---|---|---|---|---|
| `notifications` (`Notifications` field) | R | 12 |  | `src/app/textual-app.tsx:92`; `tests/notifications.test.tsx:145`; `tests/notifications.test.tsx:146`; `tests/notifications.test.tsx:147`; `tests/testing.test.tsx:413`; ... (12 total) | yes (test + host) | — | `App.notifications` (new) — namespaced sub-API mirroring `App.workers` |
| `notify(message, severityOrOptions?, timeout?, title?, markup?)` | W | 5 |  | `src/app/app.tsx:261`; `tests/testing.test.tsx:62`; `tests/notifications.test.tsx:141`; `tests/notifications.test.tsx:232`; `tests/notifications.test.tsx:233` | yes (test) | `[LAW:single-enforcer]` at line 2087 ("Notification recording is gated at this boundary so mount effects, widget helpers, and app calls all share the same transient policy") | `App.notify(...)` exists at `src/app/app.tsx:254` |
| `clearNotifications()` | W | 2 |  | `src/app/app.tsx:265`; `tests/notifications.test.tsx:161` | yes (test) | — | `App.clearNotifications()` exists at `src/app/app.tsx:264` |
| `dismissNotification(identity)` | W | 1 |  | `tests/notifications.test.tsx:158` | yes (test) | — | `App.notifications.dismiss(identity)` (new) |
| `_unnotify(notification)` | W | 1 |  | `src/app/app.tsx:269` | yes (notification widget) | `[LAW:one-source-of-truth]` at line 2107 ("Object-based notification removal delegates to the collection identity rule") | `App._unnotify(...)` exists at `src/app/app.tsx:268`; rename to internal hook (no leading underscore policy + sub-API) |
| `setShowNotifications(enabled)` | W | 1 |  | `src/testing/run-test.tsx:405` | yes (test harness) | — | `internal — not public` |
| `showNotifications` (field) | R | 1 |  | `src/app/textual-app.tsx:92` | no (host bridge) | — | `internal — not public` |
| `themeManager` (field) | R | 1 |  | `tests/notifications.test.tsx:209` | yes (test) | — | `App.themeManager` or `App.themes` (new) — namespaced sub-API |
| `theme` (field) | R | 2 |  | `src/app/app.tsx:273`; `tests/app.test.tsx:587` | yes (test) | — | `App.theme` exists at `src/app/app.tsx:272` |
| `setTheme(name)` | W | 4 |  | `src/app/app.tsx:277`; `tests/notifications.test.tsx:152`; `tests/notifications.test.tsx:207`; `tests/app.test.tsx:577` | yes (test) | — | `App.theme = name` setter exists at `src/app/app.tsx:276` |
| `dark` (getter/setter) | RW | 4 |  | `src/app/app.tsx:281`; `src/styles/pseudo-classes.ts:30`; `src/styles/pseudo-classes.ts:31`; `tests/app.test.tsx:584` | yes (test + style engine) | — | `App.dark` getter/setter exists at `src/app/app.tsx:280` |
| `setDarkMode(value)` | W | 1 |  | `src/app/app.tsx:285` | yes | — | `App.dark = value` exists at `src/app/app.tsx:284` (delegates) |
| `activeTheme` (getter) | R | 7 |  | `src/app/textual-app.tsx:131`; `src/app/textual-app.tsx:132`; `src/app/textual-app.tsx:133`; `tests/notifications.test.tsx:139`; `tests/notifications.test.tsx:150`; ... (7 total) | yes (test + host) | — | `App.activeTheme` (new) |
| `ansiTheme` (getter) | R | 1 |  | `src/app/app.tsx:289` | yes | — | `App.ansiTheme` exists at `src/app/app.tsx:288` |
| `ansiThemeDark` (getter/setter) | RW | 2 |  | `src/app/app.tsx:293`; `src/app/app.tsx:297` | yes | — | `App.ansiThemeDark` exists at `src/app/app.tsx:292` |
| `ansiThemeLight` (getter/setter) | RW | 2 |  | `src/app/app.tsx:301`; `src/app/app.tsx:305` | yes | — | `App.ansiThemeLight` exists at `src/app/app.tsx:300` |
| `registerTheme(theme)` | W | 1 |  | `tests/notifications.test.tsx:189` | yes (test) | — | `App.registerTheme(theme)` (new) |
| `signals` (field — `AppSignals`) | R | 14 |  | `src/app/app.tsx:309`; `src/app/app.tsx:313`; `src/app/app.tsx:317`; `src/app/app.tsx:321`; `src/app/app.tsx:325`; ... (14 total — 5 in App, rest tests) | yes (test) | — | `App.<signal getters>` exist at `src/app/app.tsx:308–326` for all five public signals; `bindings_updated_signal` needs an App getter (currently leaks via `framework.signals`) |
| `setAnimationLevel(level)` | W | 3 |  | `tests/scrolling.test.ts:130`; `tests/scrolling.test.ts:137`; `tests/scrolling.test.ts:147` | yes (test) | `[LAW:single-enforcer]` at line 737 ("Animation policy is owned by the framework so scroll-capable widgets derive behavior from one runtime setting") | `App.animationLevel` setter (new) |
| `animationLevel` (field) | R | 0 | yes |  | no | — | `App.animationLevel` getter (new) — paired with the setter above |

### 3.10 Inspection (debug, devtools, features, environment, query helpers, layout readers)

| Member | R/W | Callsites | Dead? | External Consumers | Public Boundary? | Existing LAW Markers | Proposed App Surface |
|---|---|---|---|---|---|---|---|
| `driver` (`AppDriver` field) | R | 0 | yes |  | no | — | `internal — not public` (constructor input only; never read externally) |
| `features` (field) | R | 1 |  | `src/app/app.tsx:329` | yes | — | `App.features` exists at `src/app/app.tsx:328` |
| `devtools` (field) | R | 1 |  | `src/app/app.tsx:333` | yes | — | `App.devtools` exists at `src/app/app.tsx:332` |
| `debug` (field) | R | 1 |  | `src/app/app.tsx:337` | yes | — | `App.debug` exists at `src/app/app.tsx:336` |
| `captureUnhandledErrors` (field) | R | 0 | yes |  | no | — | `internal — not public` |
| `setPublicApp(app)` | W | 1 |  | `src/app/app.tsx:82` | no (App constructor wiring) | `[LAW:one-source-of-truth]` at line 1602 ("The public App wrapper is registered once on the framework so provider contexts derive from the running app object") | `internal — not public` (this is the *wiring* member that the architecture should remove entirely once App owns runtime) |

## 4. Migration shape summary

### 4.1 Definitely public on App (lift-and-cite)

These are the **writes and lifecycle entry points** that production callers and the host renderer need to drive. All should be reachable as direct App methods or App getters/setters — no `app.framework.foo` needed.

Writes / mutations (24 members):

- Lifecycle: `startup`, `shutdown`, `exit`, `suspend`, `batchUpdate`.
- Screens: `installScreen`, `uninstallScreen`, `pushScreen`, `pushScreenWait`, `popScreen`, `switchScreen`, `addMode`, `removeMode`, `switchMode`.
- Focus: `focusWidget`, `focusNext`, `focusPrevious`.
- Dispatch: `postMessage`, `postKey`, `subscribeToMessages`, `runAction`, `checkAction`, `setKeymap`, `updateKeymap`, `getActiveBindings`, `searchCommands`, `openCommandPalette`.
- Async: `callLater`, `callNext`, `callAfterRefresh`, `callFromThread`.
- Notifications/themes (the ones with no namespaced sub-API analog): `notify`, `clearNotifications`, `setTheme`, `setDarkMode`, `setAnimationLevel`, `registerTheme`.

Reads / inspection (~14 members):

- `isRunning`, `batchUpdateCount`, `whenIdle`, `screenStack`, `activeScreen`, `screenStackDepth`, `activeMode`, `focusedNodeId`, `getFocusChain`, `messageQueueSize`, `terminalSize`, `pointerShape`, `activeTooltip`, `displayCount`, `findWidgets`, plus the existing already-delegated theme/dark/ansiTheme getters.

### 4.2 Should be namespaced sub-APIs

Three concerns are already grouped on `TextualFramework` and should propagate to App as namespaces:

- `App.workers` (already exists, points at `WorkerManager`) — heavy test surface (15 callsites).
- `App.notifications` (new) — `Notifications` collection. Currently exposed only via `framework.notifications`; tests and `TextualApp` host both reach for it. 12 callsites.
- `App.themes` / `App.themeManager` (new) — `ThemeManager`. 1 external test consumer today; namespacing keeps theme registration / variable lookup distinct from App's top-level `theme` getter.
- `App.signals` (new) — currently the public app signals leak through `framework.signals` (14 callsites). 5 of the 6 signals already have App getters; the 6th (`bindings_updated_signal`) does not. A bare `App.signals` namespace eliminates the leak.

### 4.3 Should NOT be public on App

All of the following are members that today look "public" on `TextualFramework` but should not migrate to App's public API:

- **Sibling-internal helpers leaked to the public class**: `unregisterWidget`, `notifyWillUnmount`, `parseSelectors`, `matchesSelector`, `widgetMatchesType`, `resolveWidgetTypeName`, `getWidgetTypeMetadata`, `refreshStyles`, `recalculateStyles`, `getActiveStylesheetsFor`, `setUserStylesheet`, `setCssPath`, `_on_css_change` / `_onCssChange`, `setTimer`, `setInterval`, `clearTimer`, `pauseTimer`, `resumeTimer`, `resetTimer`, `runWorker` (the per-widget variant), `createSignal`, `registerLayoutReader`, `clearFocusWithin`, `trapFocus`, `setPointerShape`, `dispatchPointerClick`, `postClick`, `postMouseDown`, `postMouseUp`, `postMouseMove`, `postToFocused`, `dispatchMessage`, `dispatchNodeKeyBindings`, `notifyBindingsUpdated`, `preventMessages`, `disableMessages`, `enableMessages`, `getMessageQueueSize`, `handleWidgetTooltipChange`, `handleBindingsClash`, `screenStackVersion`, `hoveredNodeId`, `tooltipDelay` (field; the setter is public), `isNodeMounted`. These are read by `src/framework/widget.ts`, `src/framework/dom-query.ts`, `src/framework/context.tsx`, `src/styles/`, `src/services/` — all should reach App through narrower contracts (or through their own owner objects, e.g. `Widget.run_worker` already wraps `framework.runWorker`).
- **Host-bridge wiring members** that exist solely so `TextualApp` (the React/Ink host) can plumb startup into the runtime: `attachAfterRefreshRequester`, `flushAfterRefreshCallbacks`, `recordDisplayPass`, `syncHostTerminalSize`, `setControlledTerminalSize`, `setShowTooltips`, `setShowNotifications`, `setAppAutoFocus`, `setAppCommandProviders`, `setSystemCommandResolver`, `getSystemCommands`, `setAppBindings`, `setAppActions`, `setPublicApp`, `activeScreenElement`, `showTooltips`, `showNotifications`. After Phase 1 these stay App-internal seams between App and its host adapter.
- **Test-only error capture / reporting**: `setCaptureUnhandledErrors`, `reportUnhandledError`, `throwPendingError`. These exist for `runTest` and the React error boundary. They should be App-internal, not part of App's public surface; tests should drive App.runTest's existing options.
- **Pointer simulators called only by Pilot/tests**: `dispatchPointerDown`, `dispatchPointerUp`, `dispatchPointerMove`, `postResize`, `hitTest`, `setTerminalSize`. All are bypassed pointer simulation paths — Pilot is the production interface. Tests using these directly need rewriting (ticket `.6`).
- **Dead members** (zero external callsites): see the `Dead?` column. Notable: `clearFocusWithin`, `trapFocus`, `setPointerShape`, `dispatchPointerClick`, `postClick/MouseDown/MouseUp/MouseMove`, `postToFocused`, `dispatchMessage`, `widgetMatchesType`, `resolveWidgetTypeName`, `getMessageQueueSize`, `unregisterWidget`, `notifyWillUnmount`, `parseSelectors`, `matchesSelector`, `dispatchNodeKeyBindings`, `notifyBindingsUpdated`, `refreshStyles`, `recalculateStyles`, `_on_css_change`/`_onCssChange`, `setTimer`/`setInterval`/`clearTimer`/`pauseTimer`/`resumeTimer`/`resetTimer`, `runWorker` (per-widget), `createSignal`, `registerLayoutReader`, `tooltipDelay` (field), `hoveredNodeId`, `screenStackVersion`, `captureUnhandledErrors` (field), `animationLevel` (field), `handleBindingsClash`, `handleWidgetTooltipChange`, `getMessageQueueSize`, `dismissScreen` (only consumed via the `screen.dismiss` action, which goes through `runAction`), `setPointerShape`, `call_from_thread` (snake-case alias), `driver` (field), `captureUnhandledErrors` (field). Many of these are *not actually dead* — they are reached via `widget.framework.*` or `this.framework.*` from sibling internal modules in `src/framework/`, which are excluded from the "external" definition. They can stop being on the public class regardless.

**Total members audited: 137.** Total external consumer references catalogued: **~750** (rough; aggregated across the count column, with `whenIdle` alone at 180 and `framework.registry.*` chains at 124). Total dead members (zero external consumers, internal-only or unused): **48**.

## 5. Bypass paths (consumers that reach past App into framework)

This section enumerates every non-`src/framework/` site that touches `framework.*` directly. Ticket `.3` will rewrite each to call App. Grouped by file.

### Production source bypasses

- `src/app/app.tsx` — the App class itself: this file *is* the legitimate boundary. Every `this.framework.X` in app.tsx is a delegation that ticket `.2` will preserve or simplify, not eliminate. Roughly 30 references across lines 71–345.
- `src/app/textual-app.tsx` — host renderer. Bypasses: `framework.activeTooltip` (`:68`), `framework.showTooltips` (`:70`), `framework.notifications`, `framework.showNotifications` (`:92`), `framework.activeTheme` (`:131,132,133,138`), `framework.postKey` (`:159`), `framework.syncHostTerminalSize` (`:164`), `framework.startup` (`:176`), `framework.shutdown` (`:179`), `framework.attachAfterRefreshRequester` (`:184`), `framework.flushAfterRefreshCallbacks` (`:191`), `framework.recordDisplayPass` (`:190`), `framework.activeScreenElement` (`:194`), `framework.terminalSize` (`:57,58,104,200,201`), `framework.getScreen` (`:309`), and the `ownedFramework.*` block at `:236–294` (setUserStylesheet, setCssPath, setTheme, setAppBindings, setKeymap, setAppActions, setAppCommandProviders, setSystemCommandResolver, isScreenInstalled, installScreen, addMode, setAppAutoFocus, setTooltipDelay, setShowTooltips). All of these are host-adapter wiring; they should become App-internal seams in Phase 4 after App owns the host integration.
- `src/testing/run-test.tsx` — test harness. Bypasses: `framework.reportUnhandledError` (`:88`), `framework.postKey` (`:105`), `framework.setControlledTerminalSize` (`:155`), `framework.postResize` (`:156`), `framework.exit` (`:179`), `framework.dispatchPointerDown/Up/Move` (`:197,199,201`), `framework.findWidgets` (`:250,367`), `framework.terminalSize` (`:269`), `framework.hitTest` (`:302`), `framework.recordDisplayPass` (`:366`), `framework.throwPendingError` (`:373,440`), `framework.setCaptureUnhandledErrors` (`:404`), `framework.setShowNotifications` (`:405`), `framework.setShowTooltips` (`:406`), `framework.subscribeToMessages` (`:408`), `framework.exitResult` (`:452`). The harness is itself an internal infrastructure file; in Phase 6 it should run on App.
- `src/commands/command-palette.tsx` — palette widget calls `framework.activeScreen` (`:320`), `framework.closeActiveCommandPalette` (`:372,404,422`), `framework.terminalSize` (`:382`), `framework.postAppMessage` (`:412`). These are intra-runtime; the palette belongs to the commands subsystem (sibling internal service in the target architecture).
- `src/commands/provider.ts` — `this.app.framework.getSystemCommands(this.screen)` at `:218`. Provider should ask App, not the framework.
- `src/services/signal.ts` — `owner.framework.isNodeMounted(...)` at `:45,48`, `owner.framework.callLater(...)` at `:51`. Signal lifecycle hooks. Move to a per-owner contract, not to framework.
- `src/styles/pseudo-classes.ts` — `framework.dark` (`:30,31`), `framework.focusedNodeId` (`:20`), `framework.registry.*` (`:32,33,35,39,43,47,50` and more). Style engine reads runtime state. Will move when style engine becomes a sibling internal service in Phase 7.
- `src/styles/stylesheet.ts` — `framework.terminalSize` (`:2128`), `framework.getActiveStylesheetsFor(...)` (`:1985`), `framework.getWidgetTypeMetadata(...)` (`:1986,2128`). Same Phase 7 target as above.
- `src/widgets/footer-component.tsx` — touches `framework` via the `useTextual` context hook (active bindings rendering). The hook itself reaches into framework; rewrite the hook to take App.
- `src/events/message.ts`, `src/styles/selectors.ts`, `src/styles/stylesheet.ts`, `src/bindings/binding.ts` — string match for `framework.` in these files is type/comment context, not runtime calls. Verified by grep; no callsite migration needed.

### Test bypasses

These test files reach into `framework.*` directly. Ticket `.6` rewrites them to drive App. Grouped by file with the *member set* each file uses (so the rewrite can plan a per-file diff):

- `tests/app.test.tsx` — `isRunning`, `subscribeToMessages`, `handleAppBlur`, `handleAppFocus`, `registerWidget`, `dispatchPointerDown/Up/Move`, `shutdown`, `setTheme`, `theme`, `dark`, `signals.*`, `suspend`, `searchCommands`, `activeCommandPalette`, `activeScreen`. (~30 references.)
- `tests/screens.test.tsx` — `pushScreen`, `pushScreenWait`, `popScreen`, `switchScreen`, `installScreen`, `uninstallScreen`, `isScreenInstalled`, `getScreen`, `addMode`, `removeMode`, `switchMode`, `dismissScreen`, `getScreenStack`, `screenStackDepth`, `activeScreen`, `activeScreenElement`, `activeMode`, `runAction`, `signals.mode_change_signal`, `signals.screen_change_signal`, `subscribeToMessages`, `getActiveStylesheetsFor`, `postMessage`, `registerWidget`, `startup`, `shutdown`. (~50 references.)
- `tests/focus.test.tsx` — `focusedNodeId`, `getFocusChain`, `focusNext`, `focusPrevious`, `pushScreen`, `popScreen`, `addMode`, `switchMode`, `subscribeToMessages`, `dispatchPointerDown/Up`, `postKey`, `whenIdle`. (~50 references.)
- `tests/bindings.test.tsx` — `setKeymap`, `updateKeymap`, `setAppBindings`, `setAppActions`, `runAction`, `checkAction`, `postKey`, `pushScreen`, `signals.bindings_updated_signal`, `isRunning`, `whenIdle`. (~25 references.)
- `tests/footer.test.tsx` — `getActiveBindings`. 1 reference.
- `tests/command-palette.test.ts` — `openCommandPalette`, `closeActiveCommandPalette`, `setSystemCommandResolver`, `setAppCommandProviders`, `runAppWorker`, `pushScreen`, `popScreen`, `getScreenStack`, `workers.waitForComplete`. (~15 references.)
- `tests/concurrency.test.tsx` — `callLater`, `callNext`, `callAfterRefresh`, `callFromThread`, `subscribeToMessages`, `displayCount`, `messageQueueSize`. (~15 references.)
- `tests/widget-stage4.test.tsx` — `registerWidget`, `focusedNodeId`, `focusWidget`, `focusNext`, `getFocusChain`, `dispatchPointerMove`, `subscribeToMessages`, `whenIdle`. (~25 references.)
- `tests/widget-state.test.tsx` — `registerWidget`, `focusNext`, `getFocusChain`, `whenIdle`. (~10 references.)
- `tests/widget-components.test.tsx` — `registry.getByCssId` (≈12), `focusWidget`, `focusNext`, `getFocusChain`. (~20 references.)
- `tests/notifications.test.tsx` — `notifications.*` (length, list, has, delete-by-identity), `notify`, `clearNotifications`, `dismissNotification`, `setTheme`, `themeManager.getCssVariables`, `signals.theme_changed_signal`, `signals.mode_change_signal`, `signals.screen_change_signal`, `registerTheme`, `activeTheme`, `subscribeToMessages`. (~30 references.)
- `tests/tooltip.test.tsx` — `setTooltipDelay`, `activeTooltip` (≈10). (~20 references.)
- `tests/message.test.tsx` — `postMessage` (≈8), `messageQueueSize` (≈4), `subscribeToMessages`. (~15 references.)
- `tests/scrolling.test.ts` — `setAnimationLevel`. 3 references.
- `tests/styles.test.tsx` — `registerWidgetType` (2), `setTerminalSize` (1).
- `tests/stage1-runtime.test.tsx` — `batchUpdateCount`, `subscribeToMessages`, `callNext`, `postKey`, `registerWidget`. (~10 references.)
- `tests/stage0-app.test.tsx` — `isRunning`, `terminalSize`. (~5 references.)
- `tests/integration.test.tsx` — `isRunning`, `whenIdle`. (~5 references.)
- `tests/testing.test.tsx` — `notifications.length`, `pushScreen`, `notify`, `showTooltips`, `terminalSize`, `whenIdle`. (~15 references.)
- `tests/workers.test.tsx` — `runAppWorker` (≈8), `workers.*` (≈10), `whenIdle`. (~20 references.)
- `tests/app-pointer-stage4.test.tsx` — `pointerShape` (3), `whenIdle`. (~5 references.)
- `tests/dom-query.test.tsx` — `focusedNodeId`. (~3 references.)
- `tests/content-render-integration.test.tsx` — `setTooltipDelay`. 1 reference.
- `tests/input-model.test.ts` — `runAction`. ≈10 references.
- `tests/suggester.test.ts` — destructures `framework` for use as a `WidgetHost`-like context.
- `tests/validation.test.ts` — same.

The largest test files to plan around in ticket `.6` are `tests/app.test.tsx`, `tests/screens.test.tsx`, `tests/focus.test.tsx`, `tests/notifications.test.tsx`, `tests/bindings.test.tsx`, and `tests/widget-stage4.test.tsx`.

## 6. Public export leak

The `TextualFramework` runtime class is exported from one place inside the source tree:

- `src/framework/index.ts:23` — `TextualFramework,` is listed inside the `export { … } from "./app-framework.js";` block, alongside `type TextualFrameworkOptions` at `src/framework/index.ts:22`.

It is NOT re-exported from the package barrel. `src/index.ts:99–164` re-exports many symbols from `"./framework/index.js"`, but `TextualFramework` is **not** in that list (verified: `grep -n '^  TextualFramework' src/index.ts` returns no matches; the only occurrence of `TextualFramework` in `src/index.ts` is a comment at line 229). And `package.json` exposes only `"."` — no subpath exports — so consumers cannot reach `src/framework/index.ts` from outside the package.

In other words: the class is reachable from anywhere inside the source tree via `import { TextualFramework } from "../framework/app-framework.js"` or `from "../framework/index.js"`, and that is what every external consumer in §5 actually does — but the npm package itself does not currently leak `TextualFramework` to library users.

That changes the shape of ticket `.4` ("Drop TextualFramework from public exports in src/index.ts"):

- The literal task as titled is already true. `src/index.ts` does not export `TextualFramework`. The ticket's title presupposes a leak that is not there.
- The actionable rewrite is at `src/framework/index.ts:22-23`: stop re-exporting `TextualFramework` and `TextualFrameworkOptions` from the framework barrel so internal callsites must import from `./app-framework.js` directly. Once App is the runtime authority (after `.2` and `.3`), the framework class should not be importable as a sibling-public symbol either.
- `TextualFrameworkOptions` is the construction shape; its three fields (`driver`, `env`, `cssPath`) are already absorbed into `AppOptions` at `src/app/app.tsx:25-44`. Ticket `.4` should remove both the class and options re-export from `src/framework/index.ts`.

Type-level re-exports in `src/framework/index.ts:1-35` and `src/index.ts:99-164` (`type ActiveBinding`, `type ActiveTooltip`, `type AppDriver`, `type AnimationLevel`, `type ActionTargetDescriptor`, `type BindingClash`, `type BindingNamespace`, `type KeymapInput`, `type NotifyOptions`, `type PointerLocation`, `type PointerShape`, `type RegisterWidgetOptions`, `type RegisterWidgetTypeOptions`, `type ScreenDescriptor`, `type Screen`, `type ScreenOptions`, `type WidgetTypeMetadata`, `type SystemCommand`, `type SystemCommandResolver`, `type SimpleCommand`) are types, not runtime-authority leaks, and most remain part of the public typed API after `TextualFramework` itself goes internal. They are not part of `.4`'s scope.
