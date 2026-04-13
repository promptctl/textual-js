# DirectoryTree

## Overview

`DirectoryTree` is a `Tree[DirEntry]` subclass that presents the filesystem as an expandable tree. It loads directory contents asynchronously in a background worker, sorts entries (directories first, then files, case-insensitive alphabetical), and supports filtering, reloading, and path changes at runtime.

- Focusable: yes
- Container: no
- Import: `from textual.widgets import DirectoryTree`

## Constructor

```python
DirectoryTree(
    path: str | Path,
    *,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

The `path` argument sets the root directory. It accepts `str` or `pathlib.Path`.

## DirEntry Data Type

Each tree node carries a `DirEntry` dataclass (attached as `node.data`):

| Field | Type | Default | Description |
|---|---|---|---|
| `path` | `Path` | -- | The filesystem path for this node. |
| `loaded` | `bool` | `False` | Whether this node's children have been loaded. |

## Reactive Attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `path` | `str \| Path` | `Path(".")` | Root path of the tree. Setting this repopulates the entire tree. Always stored as a `Path` object regardless of input type. |
| `show_root` | `bool` | `True` | Show the root node. Inherited from `Tree`. |
| `show_guides` | `bool` | `True` | Show guide lines between levels. Inherited from `Tree`. |
| `guide_depth` | `int` | `4` | Indentation between parent and child. Inherited from `Tree`. |

When `path` is changed at runtime, the tree resets the root node, reloads all content, moves the cursor to line 0, and scrolls to the top.

## Messages

### DirectoryTree.FileSelected

Posted when a file node is selected (via `Enter` key or click). Also posted when a file node is expanded.

| Attribute | Type | Description |
|---|---|---|
| `node` | `TreeNode[DirEntry]` | The tree node for the selected file. |
| `path` | `Path` | The filesystem path of the selected file. |
| `control` | `Tree[DirEntry]` | The tree widget that posted the message. |

Handler name: `on_directory_tree_file_selected`

### DirectoryTree.DirectorySelected

Posted when a directory node is selected (via `Enter` key or click). This is distinct from expansion -- selecting a directory posts `DirectorySelected`, while expanding it loads its children.

| Attribute | Type | Description |
|---|---|---|
| `node` | `TreeNode[DirEntry]` | The tree node for the selected directory. |
| `path` | `Path` | The filesystem path of the selected directory. |
| `control` | `Tree[DirEntry]` | The tree widget that posted the message. |

Handler name: `on_directory_tree_directory_selected`

### Message Routing

`DirectoryTree` intercepts `Tree.NodeExpanded` and `Tree.NodeSelected` from its parent class and stops their propagation. It translates them into `FileSelected` or `DirectorySelected` based on whether the node's path is a directory.

- `NodeExpanded` on a directory: loads children (no `DirectorySelected` posted).
- `NodeExpanded` on a file: posts `FileSelected`.
- `NodeSelected` on a directory: posts `DirectorySelected`.
- `NodeSelected` on a file: posts `FileSelected`.

## Bindings

Inherited from `Tree`. No additional bindings are defined.

## Component Classes

| Class | Description | Default Style |
|---|---|---|
| `directory-tree--folder` | Applied to directory/folder labels. | `text-style: bold` |
| `directory-tree--file` | Applied to file labels. | (none) |
| `directory-tree--extension` | Applied to the file extension portion of a filename (matches `\..+$`). | `text-style: italic` |
| `directory-tree--hidden` | Applied to entries whose name starts with `.`. | `text-style: dim` |

Also inherits component classes from `Tree` (e.g., `tree--guides`, `tree--cursor`, `tree--highlight`).

## Icons

Three class-level constants control the Unicode icons prepended to labels:

| Constant | Default | Used For |
|---|---|---|
| `ICON_NODE_EXPANDED` | `"folder-open "` | Expanded directory nodes. |
| `ICON_NODE` | `"folder "` | Collapsed directory nodes. |
| `ICON_FILE` | `"page "` | File nodes. |

Override these in a subclass to customize icons.

## Filtering

Override `filter_paths` to control which entries appear in the tree:

```python
def filter_paths(self, paths: Iterable[Path]) -> Iterable[Path]:
```

The default implementation returns all paths unchanged. The method receives an iterable of `Path` objects for a single directory's contents and returns the subset to display. Filtering runs inside the background loading worker thread.

Example -- hide dotfiles:

```python
class FilteredDirectoryTree(DirectoryTree):
    def filter_paths(self, paths: Iterable[Path]) -> Iterable[Path]:
        return [path for path in paths if not path.name.startswith(".")]
```

## Loading Behavior

Directory contents are loaded asynchronously:

1. When a directory node is expanded, it is placed on an internal load queue.
2. A background worker (`_loader`, exclusive) processes the queue sequentially.
3. Each directory's contents are loaded in a thread worker (`_load_directory`) that calls `Path.iterdir()`, applies `filter_paths`, and sorts results (directories first, then alphabetical by lowercase name).
4. The node's children are replaced with the loaded content.
5. Nodes are only loaded once (tracked by `DirEntry.loaded`). Use `reload` or `reload_node` to force a refresh.

## Key Methods

### `reload() -> AwaitComplete`

Reloads the entire tree from the root. Orphans the old load queue, resets the root node, and starts a new loader. The return value can be awaited to wait for completion.

### `reload_node(node: TreeNode[DirEntry]) -> AwaitComplete`

Reloads a specific subtree rooted at `node`. Preserves expanded/collapsed state of child nodes that still exist after reload. Also preserves the highlighted cursor position (falls back to the nearest existing parent if the highlighted node was removed). The return value can be awaited.

### `clear_node(node: TreeNode[DirEntry]) -> Self`

Removes all children from the given node immediately (synchronous). Returns the tree instance.

### `reset_node(node, label, data=None) -> Self`

Clears the subtree and resets the node's label and data. Returns the tree instance.

### `render_label(node, base_style, style) -> Text`

Renders a node label with the appropriate icon prefix and component class styling. Applies `directory-tree--folder` to directories, `directory-tree--file` to files, `directory-tree--extension` to file extensions, and `directory-tree--hidden` to dot-prefixed names.

## Sorting

Entries within each directory are sorted with two keys:
1. Directories before files.
2. Alphabetical by `path.name.lower()`.

## Error Handling

- `OSError` during `Path.iterdir()` is silently caught (the directory appears empty).
- `OSError` during `Path.is_dir()` is caught and the path is treated as not-a-directory.
- `WorkerFailed` during loading is caught; the node remains without children.
- `WorkerCancelled` during loading breaks out of the loader loop.

## PATH Class Variable

```python
PATH: Callable[[str | Path], Path] = Path
```

A callable used to create path objects. Can be overridden in subclasses to support alternative path implementations (e.g., for testing or virtual filesystems).
