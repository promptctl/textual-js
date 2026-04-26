# Widget

The `Widget` base class is the fundamental building block of Textual UIs. Every visible element in a Textual application is a Widget or a subclass of one. Widgets manage their own lifecycle, children, visibility, disabled state, focus participation, tooltips, and loading state.

## Lifecycle

### Construction

- Widgets can be constructed outside of a running app context without error. Passing child widgets to the constructor is supported: `Widget(child1, child2, id="parent")`.
- All constructor arguments that are not `Widget` instances raise `TypeError`.
- A widget that fails to call `super().__init__()` raises `MountError` when mounted.
- Yielding a non-widget from `compose()` raises `MountError`.
- Widget class names must start with an uppercase letter. A lowercase name raises `BadWidgetName`.

### Mounting

- `mount(*widgets)` adds one or more widgets as children of the target. The target must itself be mounted; calling `mount()` on an unmounted widget raises `MountError`.
- `mount_all(widgets)` accepts an iterable and mounts every widget in it.
- Positional placement is controlled via `before` and `after` parameters, which accept an integer index, a widget reference, or a CSS selector string. Specifying both `before` and `after` raises `MountError`. A selector that matches more than one widget raises `TooManyMatches`. A reference to a widget not in the DOM raises `MountError`.
- Negative indices are supported: `before=-1` means before the last child, `after=-1` means after the last child.
- Widget IDs must be unique within the active widget tree (DOM/screen-wide), not merely among siblings.
- Mounting widgets with duplicate IDs raises `MountError` (single call) or `DuplicateIds` (separate calls).
// [LAW:one-source-of-truth] The registry owns the canonical ID index for CSS selectors and queries, so ID uniqueness is enforced globally rather than per-parent.
- `is_mounted` is `False` before mounting and `True` after.
- Render is not called until after the mount event has been processed.
- Mount events fire bottom-up: children receive `Mount` before their parents.

### Unmounting

- Unmount events fire in reverse DOM order (leaves first, root last). When a subtree is removed, every descendant receives `Unmount` before its ancestors do.
- At unmount time, each widget still has a reference to its parent (`parent is not None`) but its children have already been removed (`len(self._nodes) == 0`).

## Child Management

### Adding Children

- Children composed via `compose()` or added via `mount()` appear in `_nodes` in insertion order.

### Moving Children

- `move_child(child, before=target)` or `move_child(child, after=target)` repositions `child` relative to `target`. Both `child` and `target` can be widget references or integer indices.
- Calling `move_child` with neither `before` nor `after` raises `WidgetError`. Specifying both raises `WidgetError`.
- Moving a widget that is not a child of the caller raises `WidgetError`. Moving relative to a widget that is not a child raises `WidgetError`.
- Moving a child relative to itself (same widget or same index) is a no-op and does not raise.
- An out-of-range index (positive or negative beyond bounds) raises `WidgetError`.

### Removing Children

- `widget.remove()` removes the widget and its entire subtree from the DOM. Calling `remove()` on an unmounted widget is a safe no-op.
- Multiple simultaneous removals (e.g., widgets that self-remove in `on_mount`) complete without error.
- `query(...).remove()` removes all matched widgets. Overlapping selections (a parent and its descendants both matched) are handled correctly; descendants are removed first.
- Removal order is always bottom-first (deepest descendants removed before ancestors).
- `remove_children()` removes all direct children. An optional selector (string or type) limits removal to matching direct children only; the selector does not propagate to match nested descendants inside other child widgets. A `"*"` selector is equivalent to no selector. If no children match, the operation is a no-op.
- Removing a focused widget causes focus to move to another focusable widget.
- `is_attached` is `True` while mounted and becomes `False` after removal.

### Sorting Children

- `sort_children(key=..., reverse=...)` reorders children in place. The `key` callable and `reverse` flag follow the same semantics as Python's `sorted()`. Without a key, sort order is based on widget instantiation order.

### Querying Children

- `get_child_by_id(id)` returns an immediate child with the given ID, or raises `NoMatches`. It does not search deeper descendants.
- `get_widget_by_id(id)` searches all descendants (but not self), raising `NoMatches` if not found.
- `get_child_by_type(type)` returns the first immediate child of the given type, raising `NoMatches` if none exists.
- An orphan widget (no parent) reports `siblings` as an empty list.
- `App.get_child_by_id(id)` delegates to the current screen, finding widgets that are direct children of the screen. `App.get_widget_by_id(id)` similarly searches all descendants of the screen.

## Visibility

### Setting Visibility

- `widget.visible` can be set to `True`, `False`, `"visible"`, or `"hidden"`. Setting an invalid string raises `StyleValueError`.
- Visibility can also be controlled via `styles.visibility` (the string `"visible"` or `"hidden"`) or by applying a CSS class.
- The `visible` property reflects the computed visibility: if a parent is hidden, children are hidden too, unless the child explicitly sets `visibility: visible`.

### Show / Hide Events

- When a widget becomes visible, it receives a `Show` event. When it becomes hidden, it receives a `Hide` event. Toggling visibility repeatedly produces the expected sequence of events.

### Inherited Visibility

- A child inherits its parent's hidden visibility by default. A child can override this by explicitly setting `visibility: visible` in CSS, making it visible even inside a hidden container.
- A child inside a visible container that explicitly sets `visibility: hidden` is hidden, and so are its descendants (unless they also override).

## Disabled State

### Enabling and Disabling

- All widgets start enabled by default (`disabled` is `False`). Setting `disabled = True` on a widget disables it.
- Enabled widgets have the `:enabled` pseudo-class. Disabled widgets have the `:disabled` pseudo-class. These are mutually exclusive.

### Container Disabling

- Disabling a container causes all descendants to report as disabled (they gain the `:disabled` pseudo-class and lose `:enabled`), without each descendant being individually disabled.
- Children of a disabled container lose focus. If a focused widget's ancestor becomes disabled, `app.focused` becomes `None`.
- Pointer interactions that land on a disabled widget or disabled subtree are consumed at that widget boundary. They do not fall through to an enabled ancestor, sibling, or background widget behind the disabled target.

### Pseudo-Classes

- `get_pseudo_class_state()` returns a `PseudoClasses` named tuple with `enabled`, `focus`, and `hover` fields.
- A widget with a disabled parent reports `enabled=False` even if the widget itself is not directly disabled.
- `hover` is `True` when `mouse_hover` is set. `focus` is `True` when `has_focus` is set.

## Focus

### Focus Chain

- The focus chain is the ordered list of focusable widgets on a screen. A widget is in the focus chain if `can_focus=True` (or `allow_focus()` returns `True`) and it is visible.
- A container with `can_focus_children=False` excludes its descendants from the chain. This can be overridden by `allow_focus_children()` returning `True`.
- `allow_focus()` overrides `can_focus`. A widget declared with `can_focus=False` but whose `allow_focus()` returns `True` is focusable (and vice versa).
- Invisible widgets are excluded from the focus chain. A visible widget inside a hidden container is excluded unless it explicitly sets `visibility: visible`.

### Navigating Focus

- `focus_next()` and `focus_previous()` move focus forward or backward through the chain. They wrap around at the ends.
- Both accept an optional selector (type or CSS string) to skip to the next/previous widget matching that selector.
- If the selector matches nothing, focus is cleared (`focused` becomes `None`) and the method returns `None`.

### Focus Trapping

- `widget.trap_focus()` restricts the focus chain to descendants of that widget, but only if a focused widget is already inside it. `trap_focus(False)` releases the trap and restores the full chain.

### Mouse Interaction

- Mouse down on a focusable widget gives it focus. Mouse up alone does not.
- Clicking a non-focusable widget that is a descendant of a focusable container focuses the container.

### Pseudo-Classes (focus/blur)

- A focused widget has the `:focus` pseudo-class and does not have `:blur`. An unfocused widget has `:blur` and does not have `:focus`.

## Tooltips

### Setting Tooltips

- `widget.tooltip` is `None` by default.
- Assigning a string sets the tooltip text.
- Assigning styled content or another supported renderable/visual value sets the tooltip content without stripping its styling or flattening renderables to text.

### Display Behavior

- The tooltip appears after a delay (`TOOLTIP_DELAY`) when the mouse hovers over a widget that has a tooltip set. Hovering over a widget with no tooltip never shows a tooltip.
- Moving the mouse to a different widget hides the tooltip.
- The tooltip is dismissed when the source widget is removed, made invisible (`visible = False`), made not displayed (`display = False`), or shifted out from under the cursor (e.g., by mounting a widget before it).
- Tooltip rendering preserves the source content's styling/renderable structure. A tooltip built from styled `Content`, markup, or a supported renderable must render with that structure intact rather than flattening to plain text.
- Tooltip rendering preserves the full rich-js style model. The overlay must not translate colors through a reduced Ink / Chalk name subset before display.

## Loading State

### Setting Loading

- `widget.loading` is `False` by default. Setting it to `True` overlays a loading indicator (`_cover_widget` becomes non-`None`). Setting it back to `False` removes the overlay.
- Setting `loading` to its current value is a no-op.
- Setting `loading = True` before mounting does not crash; the indicator appears once the widget is mounted.

### Interaction Blocking

- A widget in the loading state blocks user interaction. Clicks on a loading button do not fire actions. Removing the loading state re-enables interaction.
- A container in the loading state reports as disabled (`_check_disabled()` returns `True`).
- Pointer interactions that land on a loading widget or loading overlay are consumed there. They do not fall through to enabled content behind the loading target.

## Content and Rendering

### Render

- `render()` can return a string. Strings are processed as console markup and converted to `Content` objects. `render_str()` performs the same conversion explicitly. If a `Content` object is passed directly to `render_str()`, it is returned unchanged (identity preserved — no re-wrapping).

### Content Dimensions

- `get_content_width()` and `get_content_height()` compute the natural dimensions of the rendered content based on the text.

### Offset

- `widget.offset` defaults to `Offset(0, 0)` and can be set as a tuple.

## Module Import Behavior

### textual.widgets Lazy Loading

- The `textual.widgets` module uses lazy loading for widget classes. Importing a name that does not exist (e.g., `from textual.widgets import Foo`) raises `ImportError`.
- After a failed import attempt, `hasattr(widgets, "non_existent_name")` returns `False`.
- `hasattr(widgets, "Label")` (and any other valid widget name) returns `True` once the module is available.

## Widget Navigation Helpers

The `textual._widget_navigation` module provides utility functions for navigating among widgets that may be enabled or disabled.

### get_directed_distance

- `get_directed_distance(index, start, direction, wrap_at)` computes the distance from `start` to `index` in the given `direction` (1 for forward, -1 for backward), wrapping around at `wrap_at`.
- When `index == start`, the distance is 0.
- Forward distance wraps: from index 8 to index 2 with `wrap_at=10`, the forward distance is 4.
- Backward distance wraps: from index 8 to index 2 with `wrap_at=10`, the backward distance is 6.

### find_first_enabled / find_last_enabled

- `find_first_enabled(candidates)` returns the index of the first enabled item (where `item.disabled` is `False`), or `None` if the list is empty or all items are disabled.
- `find_last_enabled(candidates)` returns the index of the last enabled item, or `None` if the list is empty or all items are disabled.

### find_next_enabled

- `find_next_enabled(candidates, anchor, direction)` finds the next enabled item from `anchor` in the given direction, wrapping around the list.
- If `anchor` is `None` and direction is forward (1), returns the index of the first enabled item. If direction is backward (-1), returns the index of the last enabled item.
- If all candidates are disabled and `anchor` is not `None`, returns `anchor` (the current position is preserved).
- If all candidates are disabled and `anchor` is `None`, returns `None`.
- Wrapping: searching forward from the last enabled item wraps to the first enabled item, and vice versa.

### find_next_enabled_no_wrap

- `find_next_enabled_no_wrap(candidates, anchor, direction, with_anchor=False)` behaves like `find_next_enabled` but does NOT wrap around.
- When no enabled item exists in the search direction, returns `None` (unlike the wrapping version which returns the anchor).
- If `with_anchor=True`, returns the `anchor` index itself (staying in place) instead of searching.

## Mount Point Resolution

### _find_mount_point

- `widget._find_mount_point(spot)` resolves a mount reference to a `(parent, index)` tuple indicating where a new widget should be inserted.
- `spot` can be an integer index, a widget reference, a CSS type selector (e.g., `"Body"`), or an ID selector (e.g., `"#body"`).
- An integer index returns the widget as parent with the given index position.
- A widget reference returns the same result as the integer index of that widget within its parent.
- A type selector finds the first matching child by class name.
- An ID selector finds the first matching child by ID.
- If the reference widget is not found in the DOM, raises `MountError`.

## Positional Pseudo-Classes

### first_of_type / last_of_type

- `widget.first_of_type` is `True` if the widget is the first of its type among its parent's children.
- `widget.last_of_type` is `True` if the widget is the last of its type among its parent's children.

### first_child / last_child

- `widget.first_child` is `True` if the widget is the first child of its parent.
- `widget.last_child` is `True` if the widget is the last child of its parent.

### is_odd / is_even

- `widget.is_odd` is `True` if the widget's 1-based position among siblings is odd.
- `widget.is_even` is `True` if the widget's 1-based position among siblings is even.

## Constraints

- Widget class names must begin with an uppercase letter.
- Widget IDs must be unique within the active widget tree (DOM/screen-wide).
- A widget cannot own itself (passing `self` as a child to `__init__` raises `WidgetError`).
- `mount()` may only be called on a widget that is already part of the DOM. Calling it on an unmounted widget raises `MountError`.
- `mount()` does not accept both `before` and `after` simultaneously.
- `move_child()` requires exactly one of `before` or `after`.
- `move_child()` only operates on direct children; the child and the reference must both be children of the caller.
- Removal always proceeds bottom-up (leaves before ancestors).
- Unmount events guarantee the widget still has a parent reference but its children have already been detached.
- Disabled state cascades from containers to descendants for pseudo-class purposes, without mutating each descendant's `disabled` property.
- Visibility is inherited by default but can be explicitly overridden per-widget in CSS.
- The focus chain excludes invisible and disabled widgets. `allow_focus()` and `allow_focus_children()` are the definitive authorities on focusability, overriding `can_focus` and `can_focus_children` class parameters.
- Loading state blocks interaction and behaves as a disable for the covered widget.
- Tooltips are dismissed whenever the source widget is removed, hidden, or moved away from the cursor.
- `find_next_enabled` must wrap around the list; `find_next_enabled_no_wrap` must not.
- `find_next_enabled` returns the anchor when all candidates are disabled; `find_next_enabled_no_wrap` returns `None`.
- `_find_mount_point` raises `MountError` for widgets not in the DOM.
- Positional pseudo-class properties (`first_of_type`, `last_of_type`, `first_child`, `last_child`, `is_odd`, `is_even`) must reflect the widget's current position among its parent's children.
