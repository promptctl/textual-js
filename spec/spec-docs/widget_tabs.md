# Tabs

## Overview

`Tabs` displays a row of focusable tab headers with an animated underline indicator. Tabs can be activated by clicking or navigated with cursor keys. It can be used standalone or is used internally by `TabbedContent`.

`Tab` is the individual tab header widget (a `Static` subclass) managed by `Tabs`.

## Widget Traits

| Widget | Focusable | Container |
|---|---|---|
| `Tabs` | Yes | No |
| `Tab` | No | No |

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

- `*tabs` -- Positional arguments: either `Tab` instances or strings/`Text` objects. Strings and `Text` objects are auto-wrapped in `Tab` widgets with sequential IDs (`tab-1`, `tab-2`, etc.).
- `active` -- ID of the tab to activate on mount. `None` (default) activates the first tab.

### Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `active` | `str` | `""` | The ID of the active tab. Set to switch tabs programmatically. Empty string means no active tab. |

### Properties

| Name | Type | Description |
|---|---|---|
| `active_tab` | `Tab \| None` | The currently active `Tab`, or `None` if no tab is active. |
| `tab_count` | `int` | Total number of tabs. |

### Methods

| Method | Returns | Description |
|---|---|---|
| `add_tab(tab, *, before=None, after=None)` | `AwaitComplete` | Add a tab (string, `Text`, or `Tab` instance). Optionally position `before`/`after` an existing tab by ID or instance. If tabs were empty, the new tab is auto-activated. |
| `remove_tab(tab_or_id)` | `AwaitComplete` | Remove a tab by instance or ID string. Activates the next available tab if the removed tab was active. |
| `clear()` | `AwaitComplete` | Remove all tabs. Posts `Tabs.Cleared`. |
| `get_tab(tab_id)` | `Tab \| None` | Get a tab by ID, or `None` if not found. |
| `disable(tab_id)` | `Tab` | Disable a tab. Raises `Tabs.TabError` if not found. |
| `enable(tab_id)` | `Tab` | Enable a tab. Raises `Tabs.TabError` if not found. |
| `hide(tab_id)` | `Tab` | Hide a tab (applies `-hidden` class which sets `display: none`). If the hidden tab was active, activates the next available tab. Raises `Tabs.TabError` if not found. |
| `show(tab_id)` | `Tab` | Show a hidden tab. If no tab is currently active, activates the shown tab. Raises `Tabs.TabError` if not found. |

All `AwaitComplete` return values can be optionally awaited to wait for the DOM mutation to complete.

### Messages

All tab-specific messages (except `Cleared`) inherit from `Tabs.TabMessage` which carries:

| Attribute | Type | Description |
|---|---|---|
| `tabs` | `Tabs` | The `Tabs` widget. |
| `tab` | `Tab` | The specific tab that is the subject. |
| `control` | `Tabs` | Alias for `tabs` (used by `on` decorator). |

`ALLOW_SELECTOR_MATCH = {"tab"}` -- The `tab` attribute can be used with the `on` decorator for selector matching.

#### Message Types

| Message | When Posted |
|---|---|
| `Tabs.TabActivated` | A new tab becomes active (by click, keyboard navigation, or programmatic change). The `tab` attribute is set to `None` when tabs are cleared. |
| `Tabs.TabDisabled` | A tab is disabled via the `disable()` method. |
| `Tabs.TabEnabled` | A tab is enabled via the `enable()` method. |
| `Tabs.TabHidden` | A tab is hidden via the `hide()` method. |
| `Tabs.TabShown` | A tab is shown via the `show()` method. |
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

### Component Classes

None.

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

- `label` -- The text to display in the tab header. Accepts a string or `Text` object.

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

## Underline

Internal widget rendered beneath the tab row. Displays an animated highlight bar under the active tab.

| Component Class | Description |
|---|---|
| `underline--bar` | Controls the color and background of the underline bar. |

The underline animates position changes at the `"basic"` animation level with a 0.3s duration.

## Usage Patterns

### Constructing with Strings

```python
def compose(self) -> ComposeResult:
    yield Tabs("First tab", "Second tab", "Third tab")
```

Tab widgets are created internally with auto-incrementing IDs (`tab-1`, `tab-2`, etc.).

### Constructing with Tab Instances

```python
def compose(self) -> ComposeResult:
    yield Tabs(
        Tab("First tab", id="one"),
        Tab("Second tab", id="two"),
    )
```

Supplying `Tab` instances directly allows explicit control over tab IDs.

### Handling Tab Activation

```python
def on_tabs_tab_activated(self, event: Tabs.TabActivated) -> None:
    if event.tab is None:
        # Tabs were cleared
        ...
    else:
        tab_id = event.tab.id
        label_text = event.tab.label
```

### Dynamic Tab Management

```python
# Add a tab
tabs.add_tab("New Tab")

# Add before an existing tab
tabs.add_tab("Early", before="tab-2")

# Remove a tab
tabs.remove_tab("tab-1")

# Clear all tabs
tabs.clear()
```

### Disable/Enable/Hide/Show

```python
tabs.disable("tab-1")
tabs.enable("tab-1")
tabs.hide("tab-2")
tabs.show("tab-2")
```
