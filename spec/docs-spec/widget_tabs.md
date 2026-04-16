# Docs Spec: Tabs Widget

## Purpose
Describe the Tabs widget - the lower-level focusable row of tab headers
with an animated underline - and the Tab widget it manages. Usable
standalone, and also the engine inside TabbedContent.

## Audience
Application authors who want a tab bar without a paired content switcher
(for example, to route app-level mode changes from a tab press), and
widget authors composing their own tabbed UIs.

## Required sections
1. Overview (tab row with animated underline; focusable)
2. Widget traits (Tabs: focusable, not a container; Tab: not focusable,
   not a container)
3. Construction (string/label positional args auto-wrapped as Tabs;
   explicit Tab instances for custom ids)
4. Auto-ids when unspecified (`tab-1`, `tab-2`, ...)
5. Props / constructor parameters (`tabs`, `active`, standard widget props)
6. Observable state (`active`: id of active tab; empty string = none)
7. Properties: `activeTab`, `tabCount`
8. Methods: `addTab`, `removeTab`, `clear`, `getTab`, `disable`, `enable`,
   `hide`, `show`
9. Return values: DOM-mutation methods return an awaitable handle
10. Messages: `TabActivated`, `TabDisabled`, `TabEnabled`, `TabHidden`,
    `TabShown`, `Cleared`
11. Bindings: Left / Right for previous / next (hidden from binding
    display); click also activates
12. Navigation semantics: wraps around, skips disabled and hidden tabs
13. Errors: invalid tab id or conflicting before/after arguments
14. Default TCSS and focus styling
15. Tab widget: label, label_text, automatic `-active` / `-hidden` classes
16. Underline internal widget and its `underline--bar` component class
17. Examples

## Key concepts
- The tab bar is a focusable widget; the individual Tab headers are not
  focusable but are targets of clicks and messages
- The `active` reactive is the sole source of truth for which tab is
  highlighted; the underline position and the `-active` class are both
  derived from it
- Navigation (left/right) considers only enabled and visible tabs; this is
  a single filtering rule applied uniformly
- When activating a new tab is impossible (all hidden or all disabled),
  the widget reports `Cleared`, not a silent fallback
- Changing a tab's label emits a `Tab.Relabelled` message that the parent
  Tabs consumes

## Behaviors and contracts
- `addTab(tab, { before?, after? })` - at most one of before/after may be
  specified; both is an error
- Adding a tab when the list was empty auto-activates the new tab
- `removeTab` on the currently active tab activates the next available tab
  (by navigation rules); if none is available, posts `Cleared`
- `hide` on the active tab activates the next available tab (same rule)
- `show` activates the shown tab only if no tab is currently active
- `clear()` removes all tabs and posts `Cleared`
- `getTab(id)` returns the Tab or null
- `disable`, `enable`, `hide`, `show` throw a tab error on unknown id
- Left/Right wrap around, skipping disabled and hidden tabs (uniform rule;
  no "if at last tab then stop" branch)
- `TabActivated` may carry a null `tab` when the widget just cleared
- `Cleared` carries only the Tabs reference, no specific tab

## Example requirements
All examples JSX/TypeScript using Ink primitives:
- Tabs constructed from strings (auto-ids)
- Tabs constructed from explicit Tab instances with custom ids
- Handling `TabActivated`, including the cleared case
- Dynamic tab management: add, add-before, remove, clear
- Disable / enable / hide / show a tab
- Styling the active tab and the underline via CSS

## Cross-references
- spec/docs-spec/widget_tabbed_content.md (tabs + content panes)
- spec/docs-spec/api_await_complete.md (awaitable mutation handle)
- spec/docs-spec/animation.md (underline animation)
- spec/spec-src/10-widget-catalog.md (catalog entry)

## Notes for writers
- Do not document Python `ALLOW_SELECTOR_MATCH` as a class attribute;
  describe the behavior: the `tab` attribute on a tab message can be used
  for event-selector matching.
- Do not describe Python handler names like `on_tabs_tab_activated`; use
  the JS/React event-handler idiom for textual-js messages.
- Do not describe Rich `Text` labels; labels are strings or React nodes.
- Tab / underline animation should be referenced by name only; defer the
  concrete duration and curve to the animation spec.
- Navigation semantics (wrap, skip disabled, skip hidden) must be stated
  as a single uniform rule; do not phrase it as "if disabled, skip; if
  hidden, skip; if at end, wrap" - it is one filter applied once.
