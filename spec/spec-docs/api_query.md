# CSS Query

The `textual.css.query` module provides the `DOMQuery` class, which represents a set of DOM nodes returned by `DOMNode.query()`. Queries support filtering, exclusion, and bulk operations on matched widgets. The API is inspired by jQuery.

## Exception Classes

| Exception | Base | Description |
|---|---|---|
| `QueryError` | `Exception` | Base class for all query-related errors |
| `InvalidQueryFormat` | `QueryError` | The query string did not parse correctly |
| `NoMatches` | `QueryError` | No nodes matched the query |
| `TooManyMatches` | `QueryError` | More than one node matched when exactly one was expected |
| `WrongType` | `QueryError` | The query result was not of the expected type |

## DOMQuery

A generic class `DOMQuery[QueryType]` representing a lazy, filterable set of DOM nodes. Nodes are not resolved until accessed.

### Construction

`DOMQuery` objects are not constructed directly. They are returned by `DOMNode.query()`.

```python
# Query all Button widgets
buttons = self.query("Button")

# Query with type parameter
buttons = self.query(Button)
```

#### Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `node` | `DOMNode` | required | The DOM node to query within |
| `filter` | `str \| None` | `None` | CSS selector to filter children |
| `exclude` | `str \| None` | `None` | CSS selector to exclude children |
| `deep` | `bool` | `True` | If `True`, query recursively through all descendants |
| `parent` | `DOMQuery \| None` | `None` | Parent query, if this is the result of filtering another query |

Raises `InvalidQueryFormat` if the filter or exclude selector cannot be parsed.

### Properties

| Property | Type | Description |
|---|---|---|
| `node` | `DOMNode` | The DOM node being queried |
| `nodes` | `list[QueryType]` | Lazily evaluated list of matching nodes |

### Sequence Protocol

`DOMQuery` supports the standard sequence operations:

| Operation | Description |
|---|---|
| `len(query)` | Number of matched nodes |
| `bool(query)` | `True` if any nodes matched |
| `iter(query)` | Iterate over matched nodes |
| `reversed(query)` | Iterate in reverse order |
| `query[index]` | Access by integer index |
| `query[start:stop]` | Slice to get a list of nodes |

### Filtering Methods

#### filter(selector)

Return a new `DOMQuery` with an additional CSS selector filter applied. Filters are combined with AND logic (all filters must match).

| Parameter | Type | Description |
|---|---|---|
| `selector` | `str` | A CSS selector string |

Returns a new `DOMQuery[QueryType]`.

#### exclude(selector)

Return a new `DOMQuery` that excludes nodes matching the given CSS selector.

| Parameter | Type | Description |
|---|---|---|
| `selector` | `str` | A CSS selector string |

Returns a new `DOMQuery[QueryType]`.

### Retrieval Methods

#### first(expect_type=None)

Get the first matching node.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `expect_type` | `type \| None` | `None` | If provided, the first node must be this type |

Returns the first matched widget.

| Raises | Condition |
|---|---|
| `NoMatches` | No nodes matched the query |
| `WrongType` | First node is not of `expect_type` |

#### only_one(expect_type=None)

Get the only matching node. Raises if zero or more than one node matches.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `expect_type` | `type \| None` | `None` | If provided, the node must be this type |

Returns the single matched widget.

| Raises | Condition |
|---|---|
| `NoMatches` | No nodes matched the query |
| `TooManyMatches` | More than one node matched |
| `WrongType` | The node is not of `expect_type` |

#### last(expect_type=None)

Get the last matching node.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `expect_type` | `type \| None` | `None` | If provided, the last node must be this type |

Returns the last matched widget.

| Raises | Condition |
|---|---|
| `NoMatches` | No nodes matched the query |
| `WrongType` | Last node is not of `expect_type` |

#### results(filter_type=None)

Iterate over query results, optionally filtering by type. Unlike `first`/`last`/`only_one`, this never raises on empty results -- it yields nothing.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `filter_type` | `type \| None` | `None` | If provided, only yield nodes of this type |

Yields matching widgets.

### CSS Class Methods

All class methods return `self` for chaining.

#### set_class(add, *class_names)

Set or remove CSS class names based on a boolean condition.

| Parameter | Type | Description |
|---|---|---|
| `add` | `bool` | `True` to add classes, `False` to remove them |
| `*class_names` | `str` | One or more CSS class names |

#### set_classes(classes)

Set the CSS classes on all matched nodes to exactly the given set, replacing any existing classes.

| Parameter | Type | Description |
|---|---|---|
| `classes` | `str \| Iterable[str]` | Space-separated string or iterable of class names |

#### add_class(*class_names)

Add CSS class names to all matched nodes.

#### remove_class(*class_names)

Remove CSS class names from all matched nodes.

#### toggle_class(*class_names)

Toggle CSS class names on all matched nodes.

### DOM Manipulation

#### remove()

Remove all matched nodes from the DOM. Returns an `AwaitRemove` that can be awaited to wait for the removal to complete.

### Style Methods

#### set_styles(css=None, **update_styles)

Set inline styles on all matched nodes. Accepts either a CSS declaration string or keyword arguments.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `css` | `str \| None` | `None` | CSS declarations to parse and apply |
| `**update_styles` | -- | -- | Style attributes as keyword arguments |

Returns `DOMQuery[QueryType]` for chaining.

### Display and State Methods

#### refresh(*, repaint=True, layout=False, recompose=False)

Refresh all matched nodes.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `repaint` | `bool` | `True` | Repaint nodes |
| `layout` | `bool` | `False` | Recalculate layout |
| `recompose` | `bool` | `False` | Recompose nodes |

Returns `DOMQuery[QueryType]` for chaining.

#### focus()

Focus the first matched node that permits focus. Returns `DOMQuery[QueryType]` for chaining.

#### blur()

Blur (unfocus) the first matched node that is currently focused. Returns `DOMQuery[QueryType]` for chaining.

#### set(display=None, visible=None, disabled=None, loading=None)

Set common attributes on all matched nodes. Only attributes that are not `None` are changed.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `display` | `bool \| None` | `None` | Set `display` attribute |
| `visible` | `bool \| None` | `None` | Set `visible` attribute |
| `disabled` | `bool \| None` | `None` | Set `disabled` attribute |
| `loading` | `bool \| None` | `None` | Set `loading` attribute |

Returns `DOMQuery[QueryType]` for chaining.
