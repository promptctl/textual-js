# Containers

Containers are layout widgets that control how their children are arranged and displayed. They are composed using Python's `with` statement in a `compose` method.

### Vertical

`Vertical` arranges children in a vertical (top-to-bottom) layout. Scrollbars are disabled by default in both directions.

### VerticalScroll

`VerticalScroll` arranges children vertically, like `Vertical`, but enables a vertical scrollbar by default. The horizontal scrollbar remains disabled. `VerticalScroll` and `Vertical` occupy the same width when placed side by side in a horizontal screen layout.

### Horizontal

`Horizontal` arranges children in a horizontal (left-to-right) layout. Scrollbars are disabled by default in both directions.

### HorizontalScroll

`HorizontalScroll` arranges children horizontally, like `Horizontal`, but enables a horizontal scrollbar by default. The vertical scrollbar remains disabled. `HorizontalScroll` and `Horizontal` occupy the same height when placed side by side in a vertical screen layout.

### Center

`Center` horizontally centers its child content. It expands to the full width of its parent but collapses its height to fit its children. For example, a `Center` containing a 3-line label will have `width == parent.width` and `height == 3`.

### Middle

`Middle` vertically centers its child content. It expands to the full height of its parent but collapses its width to fit its children. For example, a `Middle` containing a 4-character label will have `width == 4` and `height == parent.height`.

### Scrollbar Thickness

Scrollbar thickness can be set to zero via CSS properties `scrollbar-size`, `scrollbar-size-vertical`, and `scrollbar-size-horizontal`. Setting these to `0` suppresses scrollbar rendering entirely.

### ContentSwitcher

`ContentSwitcher` is a container that shows exactly one of its children at a time, hiding all others by toggling their `display` property. Children must have unique `id` attributes.

- **`initial` parameter**: Accepts a child widget ID string to display on mount. If omitted or `None`, all children start hidden.
- **`current` property**: A reactive string property holding the `id` of the currently visible child. Setting it switches visibility. Setting it to `None` hides all children.
- **`visible_content` property**: Returns the currently visible child widget, or `None` if no child is shown.
- **`add_content` method**: Dynamically adds a widget to the switcher. The widget must have an `id` (either set on the widget or passed via the `id` keyword argument). If neither is provided, a `ValueError` is raised. The `set_current` keyword argument, when `True`, immediately switches to the newly added widget.
- **Switching to an unknown ID**: Setting `current` to an ID that does not match any child raises `NoMatches`.

## Constraints

- `Vertical` and `Horizontal` never enable scrollbars; use `VerticalScroll` or `HorizontalScroll` when scrolling is needed.
- `Center` sizes to full parent width but only the height of its content; `Middle` sizes to full parent height but only the width of its content. They are complementary axes.
- `ContentSwitcher` children must each have a unique `id`. Adding a widget without an `id` raises `ValueError`.
- Setting `ContentSwitcher.current` to an unknown ID raises `NoMatches`. Only one child is visible at a time; all others have `display` set to `False`.
- Containers are used via `with` context-manager syntax inside `compose`.
