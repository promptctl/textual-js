# Tabs and TabbedContent

## Tabs Widget

The `Tabs` widget provides a horizontal strip of selectable tabs. Each tab is a `Tab` instance. Tabs can be constructed from strings or `Tab` objects.

### Construction

- `Tabs()` creates an empty tab strip with `tab_count == 0` and `active_tab is None`.
- `Tabs("A", "B", "C")` creates tabs from strings. Each tab receives an auto-generated ID (`tab-1`, `tab-2`, ...).
- `Tabs(Tab("A"), Tab("B"))` creates tabs from `Tab` objects, also auto-generating IDs.
- The first tab is activated by default on mount.

### Tab Labels

- `Tab("label").label_text` returns the label as a string.
- Setting `tab.label = "new_label"` updates the label; `tab.label_text` reflects the change.

### Active Tab

- `tabs.active` is a string reactive holding the ID of the active tab, or `""` when no tab is active.
- `tabs.active_tab` returns the active `Tab` instance, or `None` when no tab is active.
- Setting `tabs.active = "tab-2"` activates that tab programmatically.
- Setting `tabs.active = ""` deactivates all tabs so `active_tab` becomes `None`.

### Adding Tabs

- `await tabs.add_tab("label")` appends a new tab. The first tab added to an empty strip becomes active.
- `await tabs.add_tab("label", before="tab-1")` inserts a tab before the tab with the given ID. The `before` argument also accepts a `Tab` instance that is already mounted in the strip.
- `await tabs.add_tab("label", after="tab-1")` inserts a tab after the specified tab. The `after` argument also accepts a `Tab` instance.
- Specifying both `before` and `after` raises `Tabs.TabError`.
- Referencing a nonexistent tab ID (or an unmounted `Tab` instance) in `before` or `after` raises `Tabs.TabError`.
- Adding a tab does not change which tab is active (unless the strip was empty).

### Removing Tabs

- `await tabs.remove_tab("tab-1")` removes the tab by ID. A `Tab` instance may also be passed.
- When the active tab is removed, the next tab in order becomes active. When the last tab in order is removed, the previous tab becomes active instead.
- Removing a nonexistent ID or passing `None` is a no-op (no error raised, count unchanged).
- Removing all tabs results in `tab_count == 0` and `active_tab is None`.

### Clearing Tabs

- `await tabs.clear()` removes every tab. Afterwards `tab_count == 0` and `active_tab is None`.

### Keyboard Navigation

- `right` arrow moves activation to the next tab. `left` arrow moves to the previous tab.
- Navigation does not wrap: pressing `left` repeatedly on the first tab keeps it active.
- Keyboard navigation on an empty `Tabs` is a no-op.
- Disabled tabs are skipped during keyboard navigation (`action_next_tab` / `action_previous_tab`). Navigation wraps around the enabled tabs only.

### Mouse Navigation

- Clicking a `Tab` activates it.
- Clicking the `Underline` region beneath a tab activates the tab above.
- Clicking the underline beneath a disabled tab does not change the active tab.

### Messages

- **`Tabs.TabActivated`**: Posted when a tab becomes active. This fires on initial mount (for the default first tab) and on every subsequent activation change. The message exposes `event.tab` (the `Tab` that was activated) and `event.tabs` (the parent `Tabs` widget). `event.control` is the same as `event.tabs`.
- **`Tabs.Cleared`**: Posted when the last tab is removed and the strip becomes empty. `event.control` is the `Tabs` widget.
- **`Tabs.TabHidden`** / **`Tabs.TabShown`**: Posted when `hide_tab` / `show_tab` is called.
- Removing tabs from the front fires one `TabActivated` per removal (as the active tab shifts), followed by a single `Cleared` when the strip empties.
- Removing tabs from the back fires no extra `TabActivated` messages (the active tab stays put) until the active tab itself is removed; a single `Cleared` fires at the end.

### Disabled Tabs

- A `Tab` can be created disabled: `Tab("label", disabled=True)`.
- A disabled tab cannot be activated by clicking it or by clicking its underline region.
- Keyboard navigation skips disabled tabs.

---

## TabbedContent Widget

`TabbedContent` pairs a `Tabs` strip with a stack of `TabPane` content areas. Only the pane corresponding to the active tab is visible (has a nonzero region).

### Construction

- `TabbedContent()` creates an empty container with `active == ""` and `tab_count == 0`.
- Compose panes using the context-manager pattern:
  ```python
  with TabbedContent():
      with TabPane("title", id="my-pane"):
          yield Label("content")
  ```
- When children are `Label` widgets yielded directly (without explicit `TabPane` wrappers), auto-generated pane IDs are used (`tab-1`, `tab-2`, ...).

### Initial Tab

- `TabbedContent(initial="bar")` activates the pane with `id="bar"` on mount instead of the first pane.

### Active Pane

- `tabbed_content.active` is a string reactive holding the pane ID of the active pane, or `""` when nothing is active.
- `tabbed_content.active_pane` returns the active `TabPane` instance.
- Setting `tabbed_content.active = "bar"` switches to that pane. Only the active pane has a nonzero display region; all others collapse.
- Setting `tabbed_content.active = ""` deactivates all panes and posts a `TabbedContent.Cleared` message.
- Setting `active` to a nonexistent pane ID raises `ValueError`.

### Adding Panes

- `await tabbed_content.add_pane(TabPane("title", id="new"))` appends a pane. The first pane added to an empty container becomes active.
- `await tabbed_content.add_pane(pane, before="existing-id")` inserts the pane before the referenced pane. The `before` argument also accepts a `TabPane` instance.
- `await tabbed_content.add_pane(pane, after="existing-id")` inserts after. The `after` argument also accepts a `TabPane` instance.
- Specifying both `before` and `after` raises `Tabs.TabError`.
- Referencing a nonexistent pane ID raises `Tabs.TabError`.
- Adding panes does not change the active pane (unless the container was empty).

### Removing Panes

- `await tabbed_content.remove_pane("pane-id")` removes a pane and its corresponding tab.
- When the active pane is removed, the next pane becomes active. When all panes are removed, `active` becomes `""` and a `Cleared` message is posted.
- Removing non-active panes does not change the active pane.

### Clearing Panes

- `await tabbed_content.clear_panes()` removes all panes. Afterwards `tab_count == 0`, `active == ""`, and one `Cleared` message is posted.

### Messages

- **`TabbedContent.TabActivated`**: Posted on initial mount and whenever the active pane changes. The message carries `event.tab` (the `Tab` widget within the header) and `event.pane` (the `TabPane`). Use `tabbed_content.get_tab("pane-id")` to retrieve the `Tab` for a given pane.
- **`TabbedContent.Cleared`**: Posted when all panes have been removed or when `active` is set to `""`.

### Disabled Tabs

Tabs can be disabled through three equivalent mechanisms:

1. **Via the `Tab` widget directly**: `tabbed_content.get_tab("pane-id").disabled = True`
2. **Via `TabbedContent` methods**: `tabbed_content.disable_tab("pane-id")` / `tabbed_content.enable_tab("pane-id")`
3. **Via the `TabPane`**: `query_one("TabPane#pane-id").disabled = True` (this propagates to the associated tab)
4. **At creation time**: `TabPane("title", disabled=True)` creates the pane with its tab already disabled.

- Disabling an already-active tab does not deactivate it; it remains active.
- A disabled tab cannot be activated by clicking.
- Calling `disable_tab` or `enable_tab` with an unknown ID raises `Tabs.TabError`.
- Re-enabling a tab (by any of the above mechanisms) makes it clickable again.

### Hiding and Showing Tabs

- `tabbed_content.hide_tab("pane-id")` hides a tab from the strip.
- `tabbed_content.show_tab("pane-id")` reveals a previously hidden tab.
- Hiding the active tab activates the next visible tab. Hiding the only remaining visible tab sets `active` to `""`.
- Showing a tab when no tab is currently active causes the shown tab to become active.
- Showing a tab when another tab is already active does not change the active tab.
- Calling `hide_tab` or `show_tab` with an unknown ID raises `Tabs.TabError`.

### Nesting

- A `Tabs` widget can be nested inside a `TabPane` of a `TabbedContent`. Messages from the inner `Tabs` do not interfere with the outer `TabbedContent`; the `TabbedContent` only responds to messages from its direct child `Tabs`.
- `TabbedContent` can itself be nested inside a `TabPane` of another `TabbedContent`.
- Disabling a `Tab` inside an inner `Tabs` (that shares an ID with a `TabPane` in the outer `TabbedContent`) does not affect the outer pane's disabled state.

---

## Constraints

- `Tabs.TabError` is the exception type for all tab-manipulation errors (bad `before`/`after` references, unknown IDs for enable/disable/hide/show).
- Setting `TabbedContent.active` to a nonexistent pane ID raises `ValueError` (not `TabError`).
- Auto-generated tab IDs follow the pattern `tab-N` where N increments globally across the process.
- `ContentTab.add_prefix` / `ContentTab.sans_prefix` translate between pane IDs and the corresponding `Tab` widget IDs used internally by `TabbedContent`.
- Only the active pane has a nonzero display region; inactive panes have zero-size regions.
- A `Tabs.Cleared` / `TabbedContent.Cleared` message is posted exactly once when the strip transitions from non-empty to empty, not once per removal.
- Keyboard navigation wraps only among enabled tabs; it does not wrap at the boundary of the full tab list when disabled tabs are at the edges.
- Removing a tab with a nonexistent ID or `None` from `Tabs` is silently ignored; it does not raise.
