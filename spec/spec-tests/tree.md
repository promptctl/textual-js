# Tree Widget

The `Tree` widget displays hierarchical data as a tree of expandable/collapsible nodes. It is generic over a data type (`Tree[DataType]`), allowing each node to carry an optional typed `data` payload.

A tree always has a `root` node. The root cannot be removed.

## Nodes

### Adding Nodes

Nodes are added to any existing node via `add()` (adds a subtree node that can have children) or `add_leaf()` (adds a terminal node). Both return the newly created `TreeNode`.

```python
tree = Tree[None]("root")
child = tree.root.add("child")
grandchild = child.add("grandchild")
leaf = tree.root.add_leaf("leaf")
```

Nodes can carry data:

```python
tree.root.add("Londinium", VersePlanet())
```

#### Positional Insertion with `before` and `after`

Both `add()` and `add_leaf()` accept optional `before` or `after` parameters to control insertion order. These parameters accept either an integer index or a `TreeNode` reference.

- Specifying both `before` and `after` in the same call raises `AddNodeError`.
- Passing a string (or other invalid type) raises `TypeError`.
- Referencing a removed node raises `AddNodeError`.

Index values are clamped: a very negative index inserts at the beginning; an index beyond the end inserts at the end.

```python
tree.root.add("first", before=0)
tree.root.add("last", before=99)        # clamped to end
tree.root.add("before node", before=node)  # relative to a TreeNode
tree.root.add_leaf("after leaf", after=leaf)
```

### Removing Nodes

- `node.remove()` removes a node and all its descendants from the tree.
- `node.remove_children()` removes all children of a node but keeps the node itself.
- Attempting to remove the root node raises `RemoveRootError`.

```python
tree.root.children[0].remove()
tree.root.remove_children()
```

### Node Labels

Every node has a `label` property (a `Rich.Text` value). Labels can be read and written at any time.

```python
node.label = "New Label"
assert node.label == Text("New Label")
```

Setting a plain string as the label converts it to `Text` internally.

### Node Children

`node.children` returns an immutable sequence of the node's child nodes. It supports indexing (positive and negative), slicing, iteration, and `len()`. Assignment and deletion through the sequence are not allowed and raise `TypeError`.

### Node Parent

`node.parent` returns the parent `TreeNode`, or `None` for the root node. The parent chain forms a path back to the root.

```python
assert tree.root.parent is None
assert child.parent == tree.root
assert grandchild.parent == child
```

### Node Data

Each node can hold a typed `data` value (the type parameter of `Tree[T]`). Data is set when calling `add()` / `add_leaf()` and is accessible on the node.

## Cursor

The tree maintains a cursor that tracks the currently highlighted node, exposed as `cursor_line`.

### move_cursor

`tree.move_cursor(node)` moves the highlight to the given node, emitting a `NodeHighlighted` message. Passing `None` resets the cursor to the root node (emitting `NodeHighlighted` for the root). Moving the cursor does not select the node -- no `NodeSelected` message is emitted.

### select_node

`tree.select_node(node)` moves the cursor to the node and selects it, emitting both `NodeHighlighted` and `NodeSelected`. Passing `None` resets the cursor to the root without emitting `NodeSelected`.

## Expand and Collapse

Nodes track their expanded/collapsed state via the `is_expanded` boolean property.

### Single-Node Operations

- `node.expand()` -- expands the node only; children remain in their current state.
- `node.collapse()` -- collapses the node only; descendants keep their own state.
- `node.toggle()` -- toggles the node between expanded and collapsed.

### Recursive Operations

- `node.expand_all()` -- expands the node and all descendants.
- `node.collapse_all()` -- collapses the node and all descendants.
- `node.toggle_all()` -- toggles the node and all descendants. Calling `toggle_all()` twice restores the original state.

### auto_expand

When `auto_expand` is `True` (the default), selecting a collapsed node via `enter` automatically expands it, emitting both `NodeSelected` and `NodeExpanded`. When `False`, selecting a node emits only `NodeSelected`.

## Clearing and Resetting

### clear

`tree.clear()` removes all children from the root but preserves the root's label and data.

### reset

`tree.reset(label, data)` removes all children from the root and replaces the root's label and data. If `data` is omitted, the root's data is set to `None`.

### clear_node

`tree.clear_node(node)` clears all children of the specified node. When called on the root, it removes all root children.

## Messages

The tree emits four message types. Each message carries a `node` attribute referencing the affected `TreeNode`, and `node.tree` references the owning `Tree` widget.

### Tree.NodeHighlighted

Emitted when the cursor moves to a node (keyboard navigation, `move_cursor()`, `select_node()`). Also emitted once on mount for the initially highlighted root node.

### Tree.NodeSelected

Emitted when a node is explicitly selected (pressing `enter`, calling `select_node()`). Not emitted by `move_cursor()`.

### Tree.NodeExpanded

Emitted when a node is expanded -- by keyboard (`space`, or `enter` with `auto_expand`), by code (`expand()`, `expand_all()`, `toggle()`), or by clicking the disclosure triangle.

### Tree.NodeCollapsed

Emitted when a node is collapsed -- by keyboard, by code (`collapse()`, `collapse_all()`, `toggle()`), or by click.

### Message Routing

Messages bubble up the DOM. Handlers can be attached via the `on_tree_node_*` naming convention or using the `@on(Tree.NodeExpanded)` decorator. Subclasses of `Tree` emit messages that reference the subclass tree (via `event.node.tree`).

## Availability (Disabled State)

A tree can be created with `disabled=True`.

- An enabled tree (the default) is focusable (`focusable` is `True`). A disabled tree is not focusable (`focusable` is `False`).
- `cursor_line` starts at `0` regardless of whether the tree is enabled or disabled.
- Keyboard navigation on an enabled tree moves `cursor_line`; pressing `down` from the root advances it to `1`.
- Keyboard navigation does not move the cursor in a disabled tree; `cursor_line` remains `0` after pressing `down`.
- Clicking a disabled tree does not emit `NodeSelected`, `NodeExpanded`, or `NodeCollapsed` messages. A `NodeHighlighted` message is still emitted on click.
- Setting `tree.disabled = False` at runtime re-enables the tree; subsequent interactions emit messages normally.
- Setting `tree.disabled = True` at runtime disables the tree; subsequent interactions stop emitting messages.

## Node Refresh

Calling `node.refresh()` on any node (root, child, or deeper descendant) triggers a re-render of that node's label. This causes `render_label()` to be called again for the refreshed node on the next render pass.

## Node Lookup by ID

Every node has a unique integer `id` (of type `NodeID`). `tree.get_node_by_id(node_id)` returns the corresponding `TreeNode`. Requesting an unknown ID raises `UnknownNodeID`.

## DirectoryTree

`DirectoryTree` is a subclass of `Tree` specialized for filesystem paths.

- It emits `DirectoryTree.FileSelected` when a file node is selected.
- It emits `DirectoryTree.DirectorySelected` when a directory node is selected. Selecting the same directory again emits the message again.
- `tree.reload_node(node)` marks a directory node for reload. After collapsing and re-expanding the node, newly created files appear as children. Reloading one node does not affect other nodes.

## Constraints

- The root node cannot be removed. Attempting `root.remove()` raises `RemoveRootError`.
- `node.children` is immutable. Item assignment and deletion raise `TypeError`.
- Specifying both `before` and `after` in `add()` / `add_leaf()` raises `AddNodeError`.
- The `before` / `after` parameter must be an `int` or `TreeNode`. Other types raise `TypeError`.
- Adding relative to a removed node raises `AddNodeError`.
- Looking up a nonexistent node ID via `get_node_by_id()` raises `UnknownNodeID`.
- A disabled tree does not respond to keyboard navigation and suppresses selection/expand/collapse messages.
- `clear()` preserves the root's label and data; `reset()` replaces them.
- `move_cursor()` never emits `NodeSelected`; `select_node()` always emits both `NodeHighlighted` and `NodeSelected` (unless passed `None`).
- `expand()` / `collapse()` / `toggle()` affect only the target node. The `_all` variants recurse through all descendants.
