# Walk

## Overview

**Module:** `textual.walk`

Provides functions for traversing the Textual DOM tree. These are the low-level primitives used internally by `DOMNode.query`. For most use cases, prefer `query` over calling these functions directly.

**Important:** Avoid modifying the DOM (mounting, removing widgets) while iterating with these functions. Use `DOMNode.walk_children` instead if DOM mutations are needed during traversal.

---

## Functions

### `walk_depth_first(root, filter_type=None, *, with_root=True)`

Walks the DOM tree in depth-first order (parents before children).

| Parameter | Type | Default | Description |
|---|---|---|---|
| `root` | `DOMNode` | *(required)* | The starting node. |
| `filter_type` | `type[WalkType] \| None` | `None` | Optional DOMNode subclass to filter results. Only nodes of this type are yielded. |
| `with_root` | `bool` | `True` | Whether to include the root node in the output. |

**Returns:** `Iterable[DOMNode]` or `Iterable[WalkType]` when `filter_type` is provided.

**Implementation:** Uses an explicit stack of child iterators. When `filter_type` is `None`, yields every node. When set, applies `isinstance` filtering at each node.

**Type overloads:**
- Without `filter_type`: returns `Iterable[DOMNode]`.
- With `filter_type`: returns `Iterable[WalkType]` (the filtered type).

---

### `walk_breadth_first(root, filter_type=None, *, with_root=True)`

Walks the DOM tree in breadth-first order (siblings before children).

| Parameter | Type | Default | Description |
|---|---|---|---|
| `root` | `DOMNode` | *(required)* | The starting node. |
| `filter_type` | `type[WalkType] \| None` | `None` | Optional DOMNode subclass to filter results. |
| `with_root` | `bool` | `True` | Whether to include the root node in the output. |

**Returns:** `Iterable[DOMNode]` or `Iterable[WalkType]` when `filter_type` is provided.

**Implementation:** Uses a `deque` as a FIFO queue. Extends the queue with each node's children as they are visited.

**Type overloads:**
- Without `filter_type`: returns `Iterable[DOMNode]`.
- With `filter_type`: returns `Iterable[WalkType]` (the filtered type).

---

### `walk_breadth_search_id(root, node_id, *, with_root=True)`

Searches breadth-first for a node with a specific ID. More efficient than `walk_breadth_first` for ID lookups because it leverages an internal index (`_nodes._get_by_id`) at each level rather than checking every node individually.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `root` | `DOMNode` | *(required)* | The starting node. |
| `node_id` | `str` | *(required)* | The node ID to search for. |
| `with_root` | `bool` | `True` | Whether to check the root node's ID. If `True` and root matches, returns immediately. |

**Returns:** `DOMNode | None` -- the matching node, or `None` if not found.

**Implementation:** Checks root first (if `with_root`), then uses a `deque`-based BFS. At each level, queries the node's children collection via `_get_by_id` for O(1) lookup before extending the queue.

---

## Type Variables

### `WalkType`

`TypeVar` bound to `DOMNode`. Used in the `filter_type` overloads to provide typed iteration results.
