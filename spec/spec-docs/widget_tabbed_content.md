# TabbedContent and Tabs

## Overview

`TabbedContent` provides a container that switches between mutually exclusive content panes via a row of tabs. It composes `Tabs` and `ContentSwitcher` internally. Only one child pane is visible at a time; selecting a tab makes its associated pane visible and hides all others.

`Tabs` is the lower-level widget that displays a row of focusable tab headers with an animated underline indicator. It can be used standalone or is used internally by `TabbedContent`.

`Tab` is the individual tab header widget (a `Static` subclass) managed by `Tabs`.

`TabPane` is a container widget that wraps content within `TabbedContent` and carries a title for its associated tab label.

## Widget Traits

| Widget | Focusable | Container |
|---|---|---|
| `TabbedContent` | Yes | Yes |
| `Tabs` | Yes | No |
| `Tab` | No (ALLOW_SELECT = False) | No |
| `TabPane` | No | Yes |

## TabbedContent

### Constructor

```python
TabbedContent(
    *titles: ContentType,
    initial: str = "",
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

- `*titles` -- Positional strings or `Text` objects used as tab labels. Each title corresponds to a child widget added via compose context manager.
- `initial` -- The `id` of the `TabPane` to activate initially. Empty string (default) activates the first pane.

### Composing Content

Two composition patterns are supported:

1. **Positional titles with child widgets** -- Titles passed to the constructor are paired with children yielded inside the `TabbedContent` context. Children are automatically wrapped in `TabPane` widgets.

2. **Explicit `TabPane` wrappers** -- Children are wrapped in `TabPane(title, ...)` which carries the tab label. No positional titles needed on `TabbedContent`.

When no explicit `id` is set on a `TabPane`, IDs are auto-assigned sequentially: `tab-1`, `tab-2`, etc.

### Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `active` | `str` | `""` | The `id` of the active `TabPane`. Set this to switch tabs programmatically. Empty string means no active tab. |

### Properties

| Name | Type | Description |
|---|---|---|
| `active_pane` | `TabPane \| None` | The currently active pane, or `None` if no pane is active. |
| `tab_count` | `int` | Total number of tabs. |

### Methods

| Method | Returns | Description |
|---|---|---|
| `add_pane(pane, *, before=None, after=None)` | `AwaitComplete` | Add a new `TabPane`. Optionally position it `before` or `after` an existing pane (by `TabPane` instance or string ID). Only one of `before`/`after` may be specified. |
| `remove_pane(pane_id)` | `AwaitComplete` | Remove the pane with the given ID. |
| `clear_panes()` | `AwaitComplete` | Remove all panes. |
| `get_tab(pane_id)` | `Tab` | Get the `Tab` associated with a pane ID or `TabPane` instance. Raises `ValueError` if no ID available. |
| `get_pane(pane_id)` | `TabPane` | Get the `TabPane` associated with a pane ID or `ContentTab` instance. Raises `ValueError` if no ID available. |
| `disable_tab(tab_id)` | `None` | Disable the tab for the given `TabPane` ID. Raises `Tabs.TabError` on failure. |
| `enable_tab(tab_id)` | `None` | Enable the tab for the given `TabPane` ID. Raises `Tabs.TabError` on failure. |
| `hide_tab(tab_id)` | `None` | Hide the tab for the given `TabPane` ID. Raises `Tabs.TabError` on failure. |
| `show_tab(tab_id)` | `None` | Show the tab for the given `TabPane` ID. Raises `Tabs.TabError` on failure. |

All `AwaitComplete` return values can be optionally awaited to wait for the DOM mutation to complete.

### Messages

#### `TabbedContent.TabActivated`

Posted when the active tab changes (either by user interaction or programmatic change to `active`).

| Attribute | Type | Description |
|---|---|---|
| `tabbed_content` | `TabbedContent` | The parent `TabbedContent` widget. |
| `tab` | `ContentTab` | The `Tab` widget that was activated. |
| `pane` | `TabPane` | The `TabPane` that became visible. |
| `control` | `TabbedContent` | Alias for `tabbed_content` (used by `on` decorator). |

`ALLOW_SELECTOR_MATCH = {"pane"}` -- The `pane` attribute can be used with the `on` decorator for selector matching.

#### `TabbedContent.Cleared`

Posted when no tab pane is active. This occurs when all panes are removed or the active pane is unset.

| Attribute | Type | Description |
|---|---|---|
| `tabbed_content` | `TabbedContent` | The `TabbedContent` widget that was cleared. |
| `control` | `TabbedContent` | Alias for `tabbed_content`. |

### Bindings

`TabbedContent` defines no bindings of its own. Tab navigation is handled by the internal `Tabs` widget.

### Component Classes

None.

### Internal Structure

`TabbedContent` composes:
1. A `ContentTabs` widget (subclass of `Tabs`) docked to the top.
2. A `ContentSwitcher` containing all `TabPane` children.

Tab IDs within the internal `ContentTabs` are prefixed with `--content-tab-`. For example, a `TabPane` with `id="leto"` gets a tab with `id="--content-tab-leto"`. This prefix is relevant when writing CSS selectors that target individual tabs.

### Default CSS

```css
TabbedContent {
    height: auto;
}
TabbedContent > ContentTabs {
    dock: top;
}
TabPane {
    height: auto;
}
```

### Synchronization Between Tabs and Panes

Disabling/enabling a `TabPane` (via its `disabled` attribute) automatically disables/enables the corresponding tab header, and vice versa. The `TabbedContent` widget intercepts `TabPane.Disabled`, `TabPane.Enabled`, `Tabs.TabDisabled`, and `Tabs.TabEnabled` messages to keep both sides in sync, preventing message loops with `self.prevent()`.

When a descendant widget inside a `TabPane` receives focus programmatically, the `TabPane.Focused` message is posted, which causes `TabbedContent` to switch to that pane.

## Tabs

### Constructor

```python
Tabs(
    *tabs: Tab | ContentText,
    active: str | None = None,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

- `*tabs` -- Positional arguments: either `Tab` instances or strings/`Text` objects (which are auto-wrapped in `Tab` widgets with sequential IDs `tab-1`, `tab-2`, etc.).
- `active` -- ID of the tab to activate on mount. `None` (default) activates the first tab.

### Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `active` | `str` | `""` | The ID of the active tab. Set to switch tabs. Empty string means no active tab. |

### Properties

| Name | Type | Description |
|---|---|---|
| `active_tab` | `Tab \| None` | The currently active `Tab`, or `None`. |
| `tab_count` | `int` | Total number of tabs. |

### Methods

| Method | Returns | Description |
|---|---|---|
| `add_tab(tab, *, before=None, after=None)` | `AwaitComplete` | Add a tab (string, `Text`, or `Tab` instance). Optionally position `before`/`after` an existing tab. If tabs were empty, the new tab is auto-activated. |
| `remove_tab(tab_or_id)` | `AwaitComplete` | Remove a tab by instance or ID string. Activates the next available tab if the removed tab was active. |
| `clear()` | `AwaitComplete` | Remove all tabs. Posts `Tabs.Cleared`. |
| `get_tab(tab_id)` | `Tab \| None` | Get a tab by ID, or `None` if not found. |
| `disable(tab_id)` | `Tab` | Disable a tab. Raises `TabError` if not found. |
| `enable(tab_id)` | `Tab` | Enable a tab. Raises `TabError` if not found. |
| `hide(tab_id)` | `Tab` | Hide a tab (sets `display: none` via `-hidden` class). If the hidden tab was active, activates the next available tab. Raises `TabError` if not found. |
| `show(tab_id)` | `Tab` | Show a hidden tab. If no tab is currently active, activates the shown tab. Raises `TabError` if not found. |

### Messages

All tab-specific messages (except `Cleared`) inherit from `Tabs.TabMessage` which carries:

| Attribute | Type | Description |
|---|---|---|
| `tabs` | `Tabs` | The `Tabs` widget. |
| `tab` | `Tab` | The specific tab that is the subject. |
| `control` | `Tabs` | Alias for `tabs` (used by `on` decorator). |

`ALLOW_SELECTOR_MATCH = {"tab"}` -- The `tab` attribute can be used with the `on` decorator.

#### Message Types

| Message | When Posted |
|---|---|
| `Tabs.TabActivated` | A new tab becomes active (click, keyboard, or programmatic). |
| `Tabs.TabDisabled` | A tab is disabled. |
| `Tabs.TabEnabled` | A tab is enabled. |
| `Tabs.TabHidden` | A tab is hidden via `hide()`. |
| `Tabs.TabShown` | A tab is shown via `show()`. |
| `Tabs.Cleared` | No active tab remains (all cleared, all hidden, or active unset). Has only `tabs` attribute, no `tab`. |

### Bindings

| Key | Action | Description |
|---|---|---|
| `left` | `previous_tab` | Move to the previous tab (wraps around). |
| `right` | `next_tab` | Move to the next tab (wraps around). |

These bindings are hidden (`show=False`).

### Tab Navigation Behavior

When moving to the next/previous tab, only enabled and visible tabs are considered. Navigation wraps around: moving past the last tab returns to the first, and vice versa. If no tab is currently active, "next" selects the first tab and "previous" selects the last.

### Exceptions

`Tabs.TabError` -- Raised by `add_tab`, `remove_tab`, `disable`, `enable`, `hide`, `show` when the request is invalid (e.g., tab not found, conflicting `before`/`after`).

### Default CSS

```css
Tabs {
    width: 100%;
    height: 2;
}
```

When focused, the active tab receives `$block-cursor-foreground`/`$block-cursor-background` styling and the underline bar background brightens.

### Internal Structure

`Tabs` composes a scroll container (`#tabs-scroll`) holding a vertical layout (`#tabs-list-bar`) that contains a horizontal layout (`#tabs-list`) with the `Tab` widgets and an `Underline` widget below.

## Tab

### Constructor

```python
Tab(
    label: ContentText,
    *,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

### Properties

| Name | Type | Description |
|---|---|---|
| `label` | `Content` | The tab label. Settable; updating it triggers a `Tab.Relabelled` message. |
| `label_text` | `str` | Plain text of the label (read-only). |

### CSS Classes

| Class | Description |
|---|---|
| `-active` | Applied to the currently active tab. |
| `-hidden` | Applied to hidden tabs (sets `display: none`). |

### Messages (Internal)

All inherit from `Tab.TabMessage`:

| Message | Description |
|---|---|
| `Tab.Clicked` | The tab was clicked. |
| `Tab.Disabled` | The tab was disabled (via `disabled` reactive). |
| `Tab.Enabled` | The tab was enabled. |
| `Tab.Relabelled` | The tab label was updated. |

These messages are consumed internally by `Tabs` and re-posted as `Tabs.TabActivated`, `Tabs.TabDisabled`, `Tabs.TabEnabled` respectively.

### Default CSS

```css
Tab {
    width: auto;
    height: 1;
    padding: 0 1;
    text-align: center;
    color: $foreground 50%;
}
Tab:hover {
    color: $foreground;
}
Tab:disabled {
    color: $foreground 25%;
}
Tab.-active {
    color: $foreground;
}
Tab.-hidden {
    display: none;
}
```

## TabPane

### Constructor

```python
TabPane(
    title: ContentType,
    *children: Widget,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

- `title` -- Displayed as the tab label in the parent `TabbedContent`.

### Messages

All inherit from `TabPane.TabPaneMessage` which carries a `tab_pane` attribute.

| Message | Description |
|---|---|
| `TabPane.Disabled` | Posted when the pane's `disabled` reactive becomes `True`. |
| `TabPane.Enabled` | Posted when the pane's `disabled` reactive becomes `False`. |
| `TabPane.Focused` | Posted when a descendant widget within the pane receives focus. |

These are consumed by `TabbedContent` to synchronize tab and pane state.

## ContentTab

A `Tab` subclass used internally by `TabbedContent`. All tab IDs are prefixed with `--content-tab-` (stored in `ContentTab._PREFIX`). This prefix maps tab IDs to their corresponding `TabPane` IDs.

| Class Method | Description |
|---|---|
| `add_prefix(content_id)` | Returns the prefixed tab ID for a given pane ID. |
| `sans_prefix(content_id)` | Strips the prefix, returning the original pane ID. |

## Underline

Internal widget rendered beneath the tab row. Displays an animated highlight bar under the active tab. Has a single component class:

| Component Class | Description |
|---|---|
| `underline--bar` | Controls the color and background of the underline bar. |

The underline animates position changes at the `"basic"` animation level with a 0.3s duration.

## Usage Patterns

### Programmatic Tab Switching

```python
self.query_one(TabbedContent).active = "some-pane-id"
```

### Handling Tab Changes

```python
def on_tabbed_content_tab_activated(self, event: TabbedContent.TabActivated) -> None:
    pane = event.pane  # The activated TabPane
    tab = event.tab    # The activated Tab
```

### Dynamic Tab Management

```python
# Add a pane
await tabbed_content.add_pane(TabPane("New", id="new-pane"))

# Add before an existing pane
await tabbed_content.add_pane(TabPane("Early", id="early"), before="new-pane")

# Remove a pane
await tabbed_content.remove_pane("new-pane")

# Clear all panes
await tabbed_content.clear_panes()
```

### Disable/Enable/Hide/Show Tabs

```python
tabbed_content.disable_tab("pane-id")
tabbed_content.enable_tab("pane-id")
tabbed_content.hide_tab("pane-id")
tabbed_content.show_tab("pane-id")
```

### Standalone Tabs (Without TabbedContent)

```python
def compose(self) -> ComposeResult:
    yield Tabs("First", "Second", "Third")

def on_tabs_tab_activated(self, event: Tabs.TabActivated) -> None:
    tab_id = event.tab.id
```

### Styling Individual Tabs via CSS

Target tabs within `TabbedContent` using the `--content-tab-` prefix:

```css
#--content-tab-leto {
    color: red;
}
#--content-tab-jessica {
    color: green;
}
```
