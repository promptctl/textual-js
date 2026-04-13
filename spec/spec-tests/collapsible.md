# Collapsible

A widget that wraps child content in an expandable/collapsible container with a clickable title bar.

## Spec

### Construction

- `Collapsible` accepts zero or more child widgets as positional arguments. These become the collapsible content.
- An empty `Collapsible()` with no children is valid and produces a contents area with zero children.
- `title` parameter sets the label displayed on the title bar. Defaults to `"Toggle"`.
- `collapsed` parameter controls initial state. Defaults to collapsed.

### Title

- The title bar is a `CollapsibleTitle` child widget.
- The title label is accessible and reflects the `title` parameter at construction time.
- Setting `collapsible.title` reactively updates the displayed label immediately.

### Expanding and Collapsing

- The `collapsed` reactive property represents the current state: `True` means collapsed, `False` means expanded.
- Clicking the `CollapsibleTitle` toggles the `collapsed` state.
- Clicking toggles in both directions: expanded to collapsed, and collapsed to expanded.
- Setting `collapsed` programmatically (e.g., `collapsible.collapsed = False`) has the same effect as clicking.

### Content Display

- When `collapsed` is `True`, the `Contents` container has `display` set to `False` (hidden).
- When `collapsed` is `False`, the `Contents` container has `display` set to `True` (visible).
- Both the `CollapsibleTitle` and `Contents` children receive the CSS class `"-collapsed"` when collapsed, and the class is removed when expanded.

### Nesting

- Collapsible widgets can be nested. Inner collapsibles are placed inside the outer collapsible's `Contents` area.
- Parent and child collapsibles are independent: collapsing a parent does not change the `collapsed` state of any nested child.

### Messages

- `Collapsible.Toggled` is posted every time the collapsed state changes, regardless of direction. It fires on both click-driven and programmatic changes.
- `Collapsible.Expanded` is posted when the widget transitions from collapsed to expanded. It fires on both click-driven toggles and programmatic assignment of `collapsed = False`.
- `Collapsible.Collapsed` is posted when the widget transitions from expanded to collapsed. It fires on both click-driven toggles and programmatic assignment of `collapsed = True`.

## Constraints

- The default title label MUST be `"Toggle"`.
- An empty `Collapsible` (no children) MUST compose without error and produce a `Contents` area with zero children.
- Toggling MUST always post the corresponding message (`Toggled`, `Expanded`, or `Collapsed`), whether the state change originates from a click or from a programmatic write to the `collapsed` property.
- Nesting MUST NOT couple parent and child collapsed state: collapsing a parent leaves the child's `collapsed` value unchanged.
- Reactively updating `title` MUST immediately update the rendered label without requiring recomposition.
