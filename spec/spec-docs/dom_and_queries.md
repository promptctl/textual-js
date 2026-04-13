# DOM and Queries

The Textual Document Object Model (DOM) is a tree of `DOMNode` instances that represents the structure of an application. Every `App`, `Screen`, and `Widget` is a `DOMNode`. The DOM supports CSS-selector-based queries for finding and manipulating widgets.

## DOM Tree Structure

### Node Hierarchy

- The `App` is the root node of the DOM. It has no parent (`parent is None`).
- Below the `App` sits the active `Screen`. Below the `Screen` sit the widgets composed into it.
- Every node except the root has exactly one `parent`. The `parent` property returns `DOMNode | None`.
- Direct children are accessible via the `children` property, which returns a sequence of `Widget` in insertion order.
- `displayed_children` returns only those children where `display` is `True`.

### Ancestors

- `ancestors` returns a list of ancestor nodes from the immediate parent up to and including the `App`.
- `ancestors_with_self` returns the same list but includes the node itself as the first element.

### Walking the Tree

- `walk_children()` returns all descendants (recursively) as a flat list.
- `walk_children(filter_type=SomeType)` limits results to instances of the given type.
- `with_self=True` includes the node itself in the results.
- `method` controls traversal order: `"depth"` (default) or `"breadth"`.
- `reverse=True` reverses the result list (bottom-up order).
- The walk produces a snapshot of the DOM at call time; mutations during iteration do not affect the result.

### Screen Access

- `node.screen` returns the `Screen` containing the node. Raises `NoScreen` if the node is not mounted.
- `node.screen` may differ from `node.app.screen` (the currently active screen).

## Node Identity

### ID

- Each node may have an `id` (a string or `None`). IDs should be unique within the DOM; they are used in `#id` CSS selectors.
- IDs must contain only letters, numbers, underscores, or hyphens, and must not begin with a number. Invalid IDs raise `BadIdentifier`.

### CSS Classes

- Nodes carry a set of CSS class names exposed as the `classes` property (a `frozenset[str]`).
- Setting `classes` accepts a space-separated string or an iterable of strings; the previous set is replaced entirely.
- Class names follow the same identifier rules as IDs.
- `DEFAULT_CLASSES` (class variable) provides the initial classes when none are supplied to the constructor.

### Class Manipulation Methods

- `add_class(*class_names)` adds one or more CSS classes.
- `remove_class(*class_names)` removes one or more CSS classes.
- `toggle_class(*class_names)` adds each class if absent, removes it if present.
- `has_class(*class_names)` returns `True` only if all of the given classes are present.
- `set_class(add, *class_names)` adds or removes classes based on the boolean `add` parameter.
- `set_classes(classes)` replaces the entire class set (accepts a string or iterable).

## CSS Selectors

Queries accept any valid CSS selector. The supported selector forms are:

### Simple Selectors

- **Type selector**: The widget class name, e.g. `"Button"`. Matches any instance of that widget type (including subclasses).
- **Class selector**: A dot-prefixed class name, e.g. `".disabled"`. Matches nodes that have that CSS class.
- **ID selector**: A hash-prefixed identifier, e.g. `"#send"`. Matches the node with that ID.
- **Universal selector**: `"*"` matches any node.

### Pseudo-classes

- Pseudo-classes such as `:focus`, `:hover`, `:disabled`, etc. reflect dynamic widget state.
- `get_pseudo_classes()` returns the set of currently active pseudo-class names for a node.

### Combinators

- **Descendant combinator** (space): `"Dialog Button"` matches any `Button` that is a descendant of a `Dialog`.
- **Child combinator** (`>`): Matches only direct children.
- **Compound selectors**: Multiple simple selectors without a combinator match the same element, e.g. `"Button.disabled"` matches buttons that have the `disabled` class.
- **Comma-separated selectors**: `"Button, Input"` matches nodes matching either selector.

## Query Methods on DOMNode

All query methods are available on both `App` and `Widget` subclasses. Queries search the subtree rooted at the node they are called on (not the node itself).

### `query(selector=None)`

- With no argument or `None`, returns a `DOMQuery` containing all descendant widgets (recursive).
- With a CSS selector string, returns a `DOMQuery` of descendants matching that selector.
- With a widget type (class), returns a `DOMQuery` of descendants that are instances of that type.
- The query is lazy; the node list is not evaluated until accessed.

### `query_children(selector=None)`

- Identical to `query()` except it searches only immediate children (one level deep, not recursive).

### `query_one(selector, expect_type=None)`

- Returns the first descendant matching the selector (breadth-first search).
- Accepts a CSS selector string or a widget type.
- Raises `NoMatches` if no node matches.
- If `expect_type` is provided and the matched node is not an instance of that type, raises `WrongType`.
- When the selector is a simple ID selector, results are cached and the cache is invalidated when the child list changes.

### `query_one_optional(selector, expect_type=None)`

- Same as `query_one` but returns `None` instead of raising `NoMatches`.
- Still raises `WrongType` if the matched widget is the wrong type.

### `query_exactly_one(selector, expect_type=None)`

- Same as `query_one` but additionally raises `TooManyMatches` if more than one node matches the selector.
- This is the strict variant: exactly one match is required.

### `query_ancestor(selector, expect_type=None)`

- Searches upward through the ancestor chain (not downward through children).
- Returns the first ancestor matching the selector.
- Raises `NoMatches` if no ancestor matches.
- Raises `InvalidQueryFormat` if the selector cannot be parsed.

## DOMQuery Object

`DOMQuery` is a list-like container of widgets returned by `query()` and `query_children()`. It supports `len()`, indexing (`query[0]`, `query[1:3]`), iteration, `reversed()`, and boolean truthiness (empty query is falsy).

### Refinement Methods

These return a new `DOMQuery` (they do not mutate the original).

#### `filter(selector)`

- Returns a new query containing only widgets that match both the original query and the additional selector.

#### `exclude(selector)`

- Returns a new query containing only widgets that do not match the given selector.

### Single-Element Retrieval

#### `first(expect_type=None)`

- Returns the first widget in the query.
- Raises `NoMatches` if the query is empty.
- Raises `WrongType` if `expect_type` is provided and the widget is not that type.

#### `last(expect_type=None)`

- Returns the last widget in the query.
- Raises `NoMatches` if the query is empty.
- Raises `WrongType` if `expect_type` is provided and the widget is not that type.

#### `only_one(expect_type=None)`

- Returns the single widget in the query.
- Raises `NoMatches` if the query is empty.
- Raises `TooManyMatches` if there is more than one widget.
- Raises `WrongType` if `expect_type` is provided and the widget is not that type.

### Iteration

#### `results(filter_type=None)`

- Yields widgets from the query.
- If `filter_type` is provided, yields only instances of that type (an `isinstance` check).
- This enables type-checkers to narrow the type of the iteration variable.

### Bulk (Loop-Free) Operations

These methods apply an action to every matched widget and return the `DOMQuery` for chaining.

- `add_class(*class_names)` -- adds CSS class(es) to all matched widgets.
- `remove_class(*class_names)` -- removes CSS class(es) from all matched widgets.
- `toggle_class(*class_names)` -- toggles CSS class(es) on all matched widgets.
- `set_class(add, *class_names)` -- conditionally adds or removes CSS class(es).
- `set_classes(classes)` -- replaces the entire class set on all matched widgets.
- `set(display=None, visible=None, disabled=None, loading=None)` -- sets common attributes on all matched widgets. `None` values leave the attribute unchanged.
- `set_styles(css=None, **update_styles)` -- applies inline CSS declarations to all matched widgets.
- `refresh(repaint=True, layout=False, recompose=False)` -- refreshes all matched widgets.
- `focus()` -- focuses the first matched widget that permits focus.
- `blur()` -- blurs (removes focus from) a matched widget if it is currently focused.
- `remove()` -- removes all matched widgets from the DOM. Returns an `AwaitRemove` that can be awaited.

## Exceptions

All query exceptions derive from `QueryError`:

- `InvalidQueryFormat` -- the selector string could not be parsed.
- `NoMatches` -- no node matched the query.
- `TooManyMatches` -- more than one node matched when exactly one was expected.
- `WrongType` -- the matched node is not an instance of the expected type.

## Component Classes

- `COMPONENT_CLASSES` (class variable, `set[str]`) defines virtual DOM nodes that expose styles to line-API widgets. These are not real child widgets but participate in CSS matching for styling purposes.
