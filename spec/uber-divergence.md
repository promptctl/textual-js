# Uber-Spec Divergence Ledger

<!-- // [LAW:one-source-of-truth] All real or apparent divergences are collected here instead of being scattered through the main spec. -->
<!-- // [LAW:behavior-not-structure] Each entry resolves or records divergence in behavioral terms first. -->

## How To Read This File

Each entry records:

- the viewpoints in tension
- the intended behavior chosen for the uber-spec, if it can be inferred
- the reason for that choice
- any remaining uncertainty

This file includes both:

- true divergences
- apparent divergences that are better understood as different layers of the same behavior

## Resolved Divergences

### Reactive `init` Default

- Viewpoints:
  - source behavior: `reactive(...)` defaults to `init=True`
  - some older prose/spec text says `reactive(...)` defaults to `init=False`
  - tests explicitly exercise `init=False` as an override and `init=True` as normal behavior
- Intended behavior:
  - `reactive(...)` defaults to `init=True`
- Why:
  - source and test usage align on that reading
  - the contrary prose does not fit the codebase’s actual behavior model

### Reactive Update Order

- Viewpoints:
  - source behavior runs validation, then watchers, then dependent recompute
  - some prose/spec text says compute happens before validation/watchers
  - tests assert validation-before-watcher ordering
- Intended behavior:
  - validation precedes watcher invocation, and dependent recompute follows watcher processing
- Why:
  - source and tests agree
  - the contrary prose reads as stale implementation commentary

### Widget ID Scope

- Viewpoints:
  - docs/spec prose often talks about DOM- or screen-wide ID uniqueness
  - runtime insertion paths visibly enforce sibling-level uniqueness
  - queries by `#id` are written as if IDs are logically unique selectors
- Intended behavior:
  - IDs should be treated like HTML document IDs: logically unique within the active DOM
- Why:
  - selector semantics and intended `#id` usage require document-wide uniqueness, not merely sibling-local uniqueness
- Divergence record:
  - some runtime paths still enforce this incompletely, but that does not change the intended behavior

### `check_action(None)`

- Viewpoints:
  - action-state plumbing and footer composition treat `None` as disabled but still visible
  - some prose/spec text says `None` hides the action
  - tests confirm disabled actions do not run, but some summaries overstate the hiding behavior
- Intended behavior:
  - `None` means disabled but still visible
  - `False` means disabled and hidden
- Why:
  - source behavior has a clear two-way distinction between `None` and `False`
  - that distinction is behaviorally meaningful in footer rendering

### App `COMMANDS` Semantics

- Viewpoints:
  - current command-palette behavior uses app-level `COMMANDS` as the app’s full provider set
  - screen-level `COMMANDS` are unioned in
  - some prose/spec text describes custom app providers as extending the default system provider
- Intended behavior:
  - overriding app-level `COMMANDS` replaces the app’s default provider set
  - screen-level providers are added by union
- Why:
  - the provider resolution behavior is consistent across source and tests
  - the “extends the default” description is too broad

### Command-Palette Initial Results Visibility

- Viewpoints:
  - discovery behavior makes results visible immediately when discovery hits exist
  - some test/spec wording says results are hidden until the user types
  - no-result behavior shows the list later for non-discovery searches
- Intended behavior:
  - discovery hits make the results list visible immediately
  - without hits, the list may remain hidden until search state produces visible content
- Why:
  - this resolves the tension by separating discovery mode from no-results and idle states

### CSS `initial`

- Viewpoints:
  - some summary prose says `initial` always resets to the class default
  - stylesheet behavior and tests show property-sensitive fallback to default-rule values or built-in defaults
- Intended behavior:
  - `initial` is a property reset mechanism whose fallback depends on the default-rule landscape for that property
- Why:
  - source behavior and tests support the more precise reading

### Sparkline Width And Reduction

- Viewpoints:
  - current renderable behavior supports `width=None` and defaults `summary_function` to `max`
  - older spec prose claims explicit width is required or describes non-`max` aggregation
- Intended behavior:
  - `width=None` means use available render width
  - default reduction is `max`
- Why:
  - the runtime renderable behavior is clear and the focused renderable tests align with `max`

### `ContentSwitcher` ID Rules

- Viewpoints:
  - constructor-time children without IDs are tolerated but ignored
  - dynamic `add_content(...)` requires an ID
  - older summary text flattened these into one inconsistent rule
- Intended behavior:
  - constructor-time and dynamic-add paths have different requirements
- Why:
  - both viewpoints are true at different entry points

### `Tabs` Versus `TabbedContent` Show/Hide APIs

- Viewpoints:
  - `Tabs` uses `hide(...)` and `show(...)`
  - `TabbedContent` uses `hide_tab(...)` and `show_tab(...)`
  - some older summaries treated these as competing names
- Intended behavior:
  - these are layered APIs on different objects
- Why:
  - the codebase exposes both surfaces for different levels of abstraction

### `ALLOW_MAXIMIZE` Versus `ALLOW_IN_MAXIMIZED_VIEW`

- Viewpoints:
  - `Widget.ALLOW_MAXIMIZE` controls whether a widget may itself be maximized
  - `App.ALLOW_IN_MAXIMIZED_VIEW` / `Screen.ALLOW_IN_MAXIMIZED_VIEW` control what remains visible around a maximized widget
  - some summary text blurred these into one “maximize setting”
- Intended behavior:
  - they are distinct but related controls
- Why:
  - they answer different behavioral questions

### Public Versus Internal Toast Surface

- Viewpoints:
  - toast widgets are real runtime behavior and deserve documentation
  - toast widgets are not part of `textual.widgets.__all__`
  - some prose made them look like ordinary public built-ins
- Intended behavior:
  - toast behavior is documented
  - toast widgets are internal support UI, not public built-in inventory
- Why:
  - both runtime reality and public-surface boundaries matter

## Open Or Partially Open Divergences

### `Animator.force_stop_animation(...)`

- Viewpoints:
  - current implementation directly invokes `on_complete`
  - a focused test expects the callback to be scheduled with `call_later`
  - existing prose has also described the callback path inconsistently
- Intended behavior chosen in the uber-spec:
  - `force_stop_animation(...)` should schedule `on_complete` with `call_later`
- Why:
  - forced completion should preserve the same completion-notification semantics as ordinary completion
- Divergence record:
  - the current source implementation does not yet match the intended behavior cleanly

### ID Uniqueness Enforcement Scope

- Viewpoints:
  - intended selector semantics imply DOM/screen-wide uniqueness
  - current enforcement is only partial
- Intended behavior chosen in the uber-spec:
  - IDs are logically DOM/screen unique
- Remaining uncertainty:
  - the codebase still allows some duplicate-ID situations that the intended contract should forbid

## Apparent Divergences That Are Better Read As Multiple Levels

### Dispatch Ownership

- Viewpoints:
  - source-oriented material centralizes dispatch ownership in `MessagePump`
  - docs and tests discuss event behavior through API and usage examples
- Resolution:
  - this is not a behavioral divergence
  - it is one subsystem seen from architectural, API, and test-observable angles

### Animation Ownership

- Viewpoints:
  - docs and tests often describe animation as a user-facing subsystem
  - source-oriented material spreads animation responsibility across animator, styles, and CSS transitions
- Resolution:
  - this is categorization drift, not a behavior conflict

### Grouped Widget Documentation

- Viewpoints:
  - source inventory names `Tab`, `TabPane`, `Header`, `Footer`, and others as public widgets
  - docs/tests sometimes describe them in grouped files rather than standalone pages
- Resolution:
  - this is a discoverability issue, not a contradiction about behavior
