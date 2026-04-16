# Docs Spec: TabbedContent Widget

## Purpose
Describe the TabbedContent widget (and its closely related pieces: TabPane,
and the internal ContentSwitcher it composes) - a container that shows a row
of tabs above a set of mutually exclusive content panes, activating exactly
one pane at a time.

## Audience
Application authors building multi-section screens: settings, multi-view
dashboards, wizards, or any UI that needs switched panes behind tabs.

## Required sections
1. Overview (structure: tab bar + content switcher; only one pane visible)
2. Widget traits (TabbedContent: focusable, container; TabPane: container)
3. Construction patterns:
   - Positional titles + children (children auto-wrapped in TabPane)
   - Explicit TabPane wrappers with titles
4. Auto-assigned TabPane IDs when not specified (`tab-1`, `tab-2`, ...)
5. Props / constructor parameters (`titles`, `initial`, standard widget
   props)
6. Observable state (`active`: id of active pane; empty string means none)
7. Properties: `activePane`, `tabCount`
8. Methods: `addPane`, `removePane`, `clearPanes`, `getTab`, `getPane`,
   `disableTab`, `enableTab`, `hideTab`, `showTab`
9. Return values: DOM-mutation methods return an awaitable handle for
   callers that need to wait for the mutation to land
10. Messages: `TabbedContent.TabActivated`, `TabbedContent.Cleared`
11. Tab/Pane state synchronization (disabling a pane disables its tab, and
    vice versa; synchronization is centralized - single enforcer)
12. Focus-follows-pane behavior (focusing a descendant of a non-active pane
    switches to that pane)
13. Internal structure and tab-id prefix (`--content-tab-`) - relevant for
    CSS selectors targeting individual tabs
14. Default TCSS
15. Examples

## Key concepts
- Single-source-of-truth: the `active` string is the authoritative selected
  pane; tab highlight and pane visibility are derived from it
- Tab and pane states (enabled, visible) are kept in sync by a single
  enforcer in TabbedContent, not duplicated across callsites
- Auto-IDs let users construct panes positionally; explicit IDs let them
  be addressed later
- The tab bar is an internal Tabs subclass; its tab IDs are prefixed so
  tab IDs don't collide with pane IDs
- Focus propagation: focusing a widget inside a pane activates that pane

## Behaviors and contracts
- `active` is set to the id of the pane to show; setting it to a different
  id switches panes and posts `TabActivated`
- Setting `active` to `""` clears the selection and posts `Cleared`
- `addPane(pane, { before?, after? })` - exactly zero or one of `before` /
  `after` may be specified; both is an error
- `removePane(id)` - if the active pane is removed, the next available pane
  becomes active; if no panes remain, `Cleared` is posted
- `clearPanes()` - removes all panes and posts `Cleared`
- `disableTab` / `enableTab` operate on the pane's id (not the prefixed
  tab id); `hideTab` / `showTab` likewise
- The synchronization logic must not loop: when TabbedContent intercepts a
  pane or tab state change, it issues the paired state change with a
  suppression guard so the paired message is not reprocessed
- `TabActivated` carries both the tab and the pane; its `control` alias
  points at the TabbedContent
- Selector matching on the `pane` attribute is supported for event
  dispatch

## Example requirements
All examples JSX/TypeScript using Ink primitives:
- Positional titles: `TabbedContent` with string titles wrapping three
  children that are each auto-wrapped in a TabPane
- Explicit `TabPane` children with titles and ids
- Programmatic tab switching by setting `active`
- Handling `TabActivated`
- Dynamic tab management: adding a pane before/after another, removing a
  pane, clearing all panes
- Enabling, disabling, hiding, and showing a tab by pane id
- Targeting an individual tab via CSS using the `--content-tab-` prefix

## Cross-references
- spec/docs-spec/widget_tabs.md (the lower-level Tabs widget)
- spec/docs-spec/api_await_complete.md (awaitable DOM-mutation handle)
- spec/spec-src/05-layout-render-and-compositor.md (dock, overlay, layout)
- spec/spec-src/10-widget-catalog.md (catalog entry)

## Notes for writers
- Do not describe Python `self.prevent()`; describe message-loop
  prevention as "the synchronizer uses a suppression guard so the paired
  message is not reprocessed" in framework-neutral terms.
- Do not describe `ALLOW_SELECTOR_MATCH` as a class attribute; describe
  the behavior - namely, that the `pane` attribute on `TabActivated` can
  be used in event-selector matching.
- Do not reference `ContentText` / Rich `Text` types for titles; titles are
  strings or React nodes.
- Synchronization between tab and pane state is the most commonly
  misunderstood behavior on this widget - spend explicit space on it, and
  frame it as a single enforcer pattern: one piece of code owns the cross-
  boundary invariant, and callsites don't duplicate the check.
- The tab-id prefix is important for CSS targeting; call it out with a
  concrete example.
