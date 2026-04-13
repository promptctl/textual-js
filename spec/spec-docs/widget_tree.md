# Tree Widget Spec

## Purpose

`Tree` is a generic, focusable widget for displaying and navigating hierarchical data. It renders a scrollable tree of nodes with optional guide lines, expand/collapse toggles, and keyboard navigation. The widget is parameterized by a data type (`Tree[DataType]`) so each node can carry arbitrary associated data.

**Added in version 0.6.0.**

- Focusable: Yes
- Container: No
- Base class: `ScrollView`

## Constructor

```python
Tree(
    label: TextType,           # Label for the root node
    data: TreeDataType | None = None,  # Optional data for the root node
    *,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

The constructor creates a root node with the given label and optional data. The root is accessible via `tree.root`.

## Reactive Attributes

| Name           | Type   | Default | Description                                          |
| -------------- | ------ | ------- | ---------------------------------------------------- |
| `show_root`    | `bool` | `True`  | Show the root node.                                  |
| `show_guides`  | `bool` | `True`  | Show guide lines between levels.                     |
| `guide_depth`  | `int`  | `4`     | Indentation depth between parent and child (2-10).   |
| `hover_line`   | `int`  | `-1`    | Line number under the mouse pointer (-1 if none).    |
| `cursor_line`  | `int`  | `-1`    | Line with the cursor (-1 if no cursor).              |
| `auto_expand`  | `bool` | `True`  | Auto-expand/collapse nodes when selected.            |
| `center_scroll`| `bool` | `False` | Keep selected node centered in the viewport.         |

## Properties

| Property      | Type                             | Description                                |
| ------------- | -------------------------------- | ------------------------------------------ |
| `root`        | `TreeNode[TreeDataType]`         | The root node of the tree.                 |
| `cursor_node` | `TreeNode[TreeDataType] \| None` | The currently highlighted node, or `None`. |
| `last_line`   | `int`                            | Index of the last visible line.            |

## Class Attributes

| Attribute            | Default  | Description                                      |
| -------------------- | -------- | ------------------------------------------------ |
| `ICON_NODE`          | `"▶ "`  | Icon for a collapsed expandable node.            |
| `ICON_NODE_EXPANDED` | `"▼ "`  | Icon for an expanded node.                       |
| `ALLOW_SELECT`       | `False`  | Whether selection is allowed (for subclass use). |

## Messages

All messages carry a `node` attribute (`TreeNode[DataType]`) and a `control` property returning the originating `Tree`.

| Message            | Trigger                                    | Handler name                    |
| ------------------ | ------------------------------------------ | ------------------------------- |
| `NodeCollapsed`    | A node is collapsed (children hidden).     | `on_tree_node_collapsed`        |
| `NodeExpanded`     | A node is expanded (children shown).       | `on_tree_node_expanded`         |
| `NodeHighlighted`  | The cursor moves to a different node.      | `on_tree_node_highlighted`      |
| `NodeSelected`     | A node is selected (Enter or click).       | `on_tree_node_selected`         |

## Bindings

| Key           | Action                          | Description                              |
| ------------- | ------------------------------- | ---------------------------------------- |
| `enter`       | `select_cursor`                 | Select the current item.                 |
| `space`       | `toggle_node`                   | Toggle expand/collapse of current item.  |
| `shift+space` | `toggle_expand_all`             | Expand or collapse all siblings.         |
| `up`          | `cursor_up`                     | Move cursor up.                          |
| `down`        | `cursor_down`                   | Move cursor down.                        |
| `shift+left`  | `cursor_parent`                 | Move cursor to parent node.              |
| `shift+right` | `cursor_parent_next_sibling`    | Move cursor to parent's next sibling.    |
| `shift+up`    | `cursor_previous_sibling`       | Move cursor to previous sibling.         |
| `shift+down`  | `cursor_next_sibling`           | Move cursor to next sibling.             |

## Component Classes

| Class                    | Description                                         |
| ------------------------ | --------------------------------------------------- |
| `tree--cursor`           | Style for the cursor (highlighted row).             |
| `tree--guides`           | Style for indentation guide lines.                  |
| `tree--guides-hover`     | Style for guide lines under the mouse hover.        |
| `tree--guides-selected`  | Style for guide lines of the selected node.         |
| `tree--highlight`        | Style for highlighted item labels.                  |
| `tree--highlight-line`   | Style for the full line under the cursor.           |
| `tree--label`            | Style for node text labels.                         |

Guide lines can be hidden by setting their color to transparent. Guide line styles support bold (thick lines) and double-underline (double lines) via `text-style`.

## Tree Methods

### Node lookup

- `get_node_at_line(line_no: int) -> TreeNode | None` -- Get the node displayed at a given line number.
- `get_node_by_id(node_id: NodeID) -> TreeNode` -- Get a node by its unique ID. Raises `UnknownNodeID` if not found.

### Cursor and selection

- `move_cursor(node: TreeNode | None, animate: bool = False)` -- Move the cursor to a node, or reset it with `None`.
- `move_cursor_to_line(line: int, animate: bool = False)` -- Move cursor to a line number. Raises `IndexError` if invalid.
- `select_node(node: TreeNode | None)` -- Move cursor to a node and post a `NodeSelected` message.
- `unselect()` -- Hide and reset the cursor.

### Scrolling

- `scroll_to_line(line: int, animate: bool = True)` -- Scroll to make a line visible.
- `scroll_to_node(node: TreeNode, animate: bool = True)` -- Scroll to make a node visible.

### Tree manipulation

- `clear() -> Self` -- Remove all nodes under root, preserving the root label and data.
- `reset(label: TextType, data: TreeDataType | None = None) -> Self` -- Clear the tree and reset the root node with a new label and data.
- `add_json(json_data: object, node: TreeNode | None = None)` -- Populate a subtree from decoded JSON data (dicts become expandable nodes, lists become indexed nodes, primitives become leaves).

### Rendering (overridable)

- `process_label(label: TextType) -> Text` -- Convert a string or `Text` into a label. Parses markup from strings. Can be overridden.
- `render_label(node: TreeNode, base_style: Style, style: Style) -> Text` -- Render a node label with icon prefix. Can be overridden to customize appearance.
- `get_label_width(node: TreeNode) -> int` -- Get the cell width of a node's label. Can be overridden for efficiency.

## TreeNode

`TreeNode[DataType]` represents a single node in the tree.

### TreeNode Properties

| Property           | Type                            | Description                                    |
| ------------------ | ------------------------------- | ---------------------------------------------- |
| `tree`             | `Tree[DataType]`                | The tree this node belongs to.                 |
| `parent`           | `TreeNode \| None`              | Parent node (`None` for root).                 |
| `children`         | `TreeNodes` (immutable view)    | Child nodes.                                   |
| `siblings`         | `TreeNodes` (immutable view)    | Sibling nodes (includes self).                 |
| `next_sibling`     | `TreeNode \| None`              | Next sibling below, or `None`.                 |
| `previous_sibling` | `TreeNode \| None`              | Previous sibling above, or `None`.             |
| `id`               | `NodeID`                        | Unique integer node ID.                        |
| `label`            | `TextType`                      | The display label (settable).                  |
| `data`             | `DataType \| None`              | Associated data (settable directly).           |
| `is_expanded`      | `bool`                          | Whether children are visible.                  |
| `is_collapsed`     | `bool`                          | Inverse of `is_expanded`.                      |
| `is_last`          | `bool`                          | Whether this is the last child of its parent.  |
| `is_root`          | `bool`                          | Whether this is the tree's root node.          |
| `allow_expand`     | `bool`                          | Whether the user can expand this node.         |
| `line`             | `int`                           | Display line number, or -1 if not displayed.   |

### TreeNode Methods

#### Adding children

- `add(label, data=None, *, before=None, after=None, expand=False, allow_expand=True) -> TreeNode` -- Add a child node. The `before`/`after` parameters accept an index or a `TreeNode` for insertion position. Only one of `before`/`after` may be provided; providing both raises `AddNodeError`.
- `add_leaf(label, data=None, *, before=None, after=None) -> TreeNode` -- Add a leaf node (cannot be expanded). Same positioning parameters as `add`.

#### Expand/collapse

- `expand() -> Self` -- Expand this node (show children). Posts `NodeExpanded`.
- `expand_all() -> Self` -- Expand this node and all descendants recursively.
- `collapse() -> Self` -- Collapse this node (hide children). Posts `NodeCollapsed`.
- `collapse_all() -> Self` -- Collapse this node and all descendants recursively.
- `toggle() -> Self` -- Toggle between expanded and collapsed.
- `toggle_all() -> Self` -- Toggle this node and make all descendants match.

#### Removal

- `remove()` -- Remove this node and all its children from the tree. Raises `RemoveRootError` if called on the root.
- `remove_children()` -- Remove all child nodes of this node.

#### Other

- `set_label(label: TextType)` -- Set a new label for the node.
- `refresh()` -- Request a repaint of this node.

## Exceptions

| Exception        | When raised                                              |
| ---------------- | -------------------------------------------------------- |
| `RemoveRootError`| Attempting to remove the root node.                      |
| `UnknownNodeID`  | Looking up a node by an ID that does not exist.          |
| `AddNodeError`   | Invalid add request (e.g., both `before` and `after`).   |

## Guide Line Styles

The `LINES` class attribute defines three named guide-line character sets:

| Name      | Characters                   |
| --------- | ---------------------------- |
| `default` | `│`, `└─`, `├─`             |
| `bold`    | `┃`, `┗━`, `┣━`             |
| `double`  | `║`, `╚═`, `╠═`             |

The active set is selected based on the `text-style` of the `tree--guides` component class (bold selects bold lines, double-underline selects double lines, otherwise default).

## Usage Pattern

```python
from textual.app import App, ComposeResult
from textual.widgets import Tree

class TreeApp(App):
    def compose(self) -> ComposeResult:
        tree: Tree[str] = Tree("Root")
        tree.root.expand()
        branch = tree.root.add("Branch", expand=True)
        branch.add_leaf("Leaf A")
        branch.add_leaf("Leaf B")
        yield tree
```

## Behavior Notes

- When `auto_expand` is `True` (default), selecting a non-leaf node toggles its expanded state.
- `NodeHighlighted` fires when the cursor moves to a different node (not on repeated selection of the same node).
- `NodeExpanded` and `NodeCollapsed` fire for each node during recursive `expand_all`/`collapse_all` operations.
- The tree lazily rebuilds its line list on idle; changes to nodes invalidate the cache.
- Click on the expand/collapse icon toggles the node without selecting it. Click elsewhere on the line selects the node.
- The `guide_depth` value is clamped to the range 2-10.
