# DirectoryTree Widget

`DirectoryTree` is a tree widget for browsing the filesystem. It is constructed with a path and displays the directory contents as an expandable tree structure.

## Specification

### Construction and Path

A `DirectoryTree` is created with a path argument representing the root directory to browse:

```python
DirectoryTree(".")
```

The initial path becomes the root node of the tree. The root node's `data.path` attribute reflects the current filesystem path.

### Changing the Path

The `path` property is reactive. Assigning a new value to `path` causes the tree to reload and display the contents of the new directory. After the update, the root node's `data.path` reflects the newly assigned path.

```python
tree = app.query_one(DirectoryTree)
tree.path = new_path
# After processing, tree.root.data.path == new_path
```

### show_root Behavior

The `show_root` property controls whether the root node of the tree is visible. It can be set before the widget is mounted (i.e., during `compose`) without error, and the value is preserved after mounting.

```python
tree = DirectoryTree(".")
tree.show_root = True
# After mount, tree.show_root is still True
```

Setting `show_root` before mount was a fix for a prior issue where early assignment would fail (see Textualize/textual#2363).

### Messages

#### DirectoryTree.FileSelected

Emitted when the user selects a file node (navigating to it and pressing `enter`). The event's `node` references the selected file node.

#### DirectoryTree.DirectorySelected

Emitted when the user selects a directory node. Selecting the same directory node multiple times emits the message each time.

### Reloading Nodes

`tree.reload_node(node)` marks a directory node's content as stale. After the node is collapsed and re-expanded, newly created files in that directory appear as children. Reloading one node does not affect the displayed children of other nodes.

### Clearing a Node

`tree.clear_node(node)` immediately removes all children of the specified node. When called on the root, it empties `root.children`. The node itself is preserved.

```python
directory_tree.clear_node(directory_tree.root)
# directory_tree.root.children is now empty
```

## Constraints

- `DirectoryTree` must accept a path at construction time and use it as the root of the displayed tree.
- Assigning to `path` must update the tree root so that `root.data.path` equals the newly assigned path.
- `show_root` must be settable before the widget is mounted, and the assigned value must be retained after mount.
- Selecting a file node emits `FileSelected`; selecting a directory node emits `DirectorySelected`. Re-selecting the same directory emits the message again.
- `reload_node` only refreshes the content of the specified node; other nodes are unaffected.
- `clear_node` removes all children from the specified node immediately.
