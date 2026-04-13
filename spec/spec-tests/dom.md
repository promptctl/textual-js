# DOM Tree, Querying, and Node Lists

## Overview

Textual maintains a DOM (Document Object Model) tree of `DOMNode` objects. Widgets are composed into parent-child hierarchies, queryable via CSS selectors, and carry CSS classes and unique IDs. The `NodeList` provides the underlying ordered collection for children within each node.

### DOMNode Identity

Each `DOMNode` can have an optional `id` (string) and a set of CSS `classes`.

**ID rules:**
- IDs must be valid CSS identifiers. They must not start with a digit, contain whitespace, contain special characters (`&`, `!`, `@`, `/`, `'`, `.`), or use non-ASCII characters.
- Constructing `DOMNode(id=<invalid>)` raises `BadIdentifier`.

**Class rules:**
- Classes follow the same identifier validation as IDs.
- Passing an invalid class name to the constructor, `add_class`, `remove_class`, or `toggle_class` raises `BadIdentifier`.

### CSS Class Manipulation on DOMNode

- `node.classes` returns a `frozenset` of current class names.
- `node.classes = "foo bar"` replaces all classes (space-delimited string).
- `node.classes = ["foo", "bar"]` replaces all classes (iterable of strings).
- `node.classes = ""` or `node.classes = []` clears all classes.
- `node.set_classes("foo bar")` replaces classes from a space-delimited string.
- `node.set_classes(["foo"])` replaces classes from an iterable.
- `node.add_class("name")` adds a single class.
- `node.remove_class("name")` removes a single class.
- `node.toggle_class("name")` toggles a class on/off.
- Assigning invalid class names via any of these methods raises `BadIdentifier`.

### Display Property

- `node.display` defaults to `True`.
- Setting `node.display = True` sets `styles.display` to `"block"`.
- Setting `node.display = False` sets `styles.display` to `"none"`.
- Setting `node.display = "block"` or `"none"` sets the style directly.
- Setting an invalid string (e.g., `"blah"`) raises `StyleValueError`.

### Tree Structure and Walking

Nodes form a tree via `_add_child`. The `walk_children` method traverses descendants:

- `walk_children(method="depth", with_self=False)` yields descendants depth-first, excluding self.
- `walk_children(method="depth", with_self=True)` yields self first, then descendants depth-first.
- `walk_children(method="breadth", with_self=False)` yields descendants breadth-first, excluding self.
- `walk_children(method="breadth", with_self=True)` yields self first, then descendants breadth-first.
- `walk_children(method="breadth", reverse=True)` yields descendants in reverse breadth-first order.

### Querying with CSS Selectors

Queries are invoked on any node and search its descendants (never the node itself).

**`query(selector)`** returns a `DOMQuery` result set:
- Type selectors: `query("Widget")` matches by widget class name. Subclasses match parent type selectors (e.g., `View2` matches `"View"`).
- ID selectors: `query("#main")` matches by ID. IDs are case-sensitive.
- Class selectors: `query(".float")` matches nodes with that CSS class. Multiple classes chain: `query(".float.transient")`.
- Combined: `query("Widget.float")` matches widgets with class `float`.
- Child combinator: `query("App > View")` matches direct children only.
- Descendant combinator: `query("#main .float")` matches descendants.
- Universal selector: `query("*")` matches all descendants (not self).
- Comma-separated selectors: `query("#widget1, #widget2")` unions results.
- `query("Nonexistent")` returns an empty result. Empty results are falsy.

**`query_one(selector, optional_type)`** returns exactly one matching node:
- Raises `WrongType` if the match does not satisfy the given type constraint.
- Raises `InvalidQueryFormat` for malformed selectors (e.g., `"foo_bar"`, `"1"`).

**`query_one_optional(selector, optional_type)`** returns the match or `None`:
- Returns `None` when no match is found (instead of raising).
- Still raises `WrongType` if the match does not satisfy the type constraint.

**`query_exactly_one(type)`** raises `TooManyMatches` if more than one node matches.

**`query_children(selector)`** queries only direct children (not deeper descendants):
- `query_children()` or `query_children("*")` returns all direct children.
- Supports the same selector syntax as `query`.

### DOMQuery Operations

A `DOMQuery` result set supports:

- **Indexing and slicing:** `query("X")[0]`, `query("X")[0:2]`.
- **Iteration and reversal:** `list(query(...))`, `list(reversed(query(...)))`.
- **`first(optional_type)`**: returns the first match. Raises `NoMatches` if empty, `WrongType` if type does not match.
- **`last(optional_type)`**: returns the last match. Same error behavior as `first`.
- **`results(optional_type)`**: iterates matches, optionally filtering by type. If a type is given and no nodes match that type, yields nothing.
- **`filter(selector)`**: narrows results to those matching selector.
- **`exclude(selector)`**: removes results matching selector.
- **Bulk class operations on results:**
  - `query(...).add_class("name")` adds a class to all matched nodes.
  - `query(...).remove_class("name")` removes a class from all matched nodes.
  - `query(...).toggle_class("name")` toggles a class on all matched nodes.
  - `query(...).set_class(True/False, "name")` conditionally adds or removes a class on all matched nodes.
  - `query(...).set_classes("foo bar")` replaces classes on all matched nodes.
  - `query(...).set_classes([])` or `query(...).set_classes("")` clears classes on all matched nodes.
- **`set_styles(css=..., **kwargs)`**: applies inline styles to all matched nodes. Raises `DeclarationError` for invalid CSS. Accepts CSS string and/or keyword arguments.
- **`refresh(repaint=..., layout=...)`**: triggers refresh on all matched nodes.
- **`focus()`**: focuses the first focusable widget in the result set. No-op if result set is empty.
- **`blur()`**: blurs (unfocuses) matched widgets.

### Query Errors

- `InvalidQueryFormat`: raised for syntactically invalid selectors (underscores in names, leading digits, etc.). Raised by both `query` and `query_one`, and by `exclude` on a result set.
- `NoMatches`: raised by `first()` and `last()` when the result set is empty.
- `TooManyMatches`: raised by `query_exactly_one` when more than one node matches.
- `WrongType`: raised by `query_one`, `query_one_optional`, `first`, and `last` when the matched node is not an instance of the expected type.

### NodeList

`NodeList` is the ordered collection backing a node's children. It enforces uniqueness and supports standard sequence operations.

- `len(nodes)` returns the count. An empty `NodeList` has length 0.
- `bool(nodes)` is falsy when empty, truthy when populated.
- `widget in nodes` performs membership testing.
- `nodes.index(widget)` returns the position; raises `ValueError` if absent.
- `nodes[i]` and `nodes[i:j]` support indexing and slicing.
- `list(nodes)` and `list(reversed(nodes))` support forward and reverse iteration.
- `nodes.__length_hint__()` returns the current count as an iteration hint.
- `nodes._append(widget)` adds a widget. Appending the same widget again is a no-op (enforces uniqueness).
- `nodes._insert(index, widget)` inserts at a given position.
- `nodes._remove(widget)` removes a widget.
- `nodes._clear()` removes all widgets.

### Binding and Component Class Inheritance

- Subclasses of `DOMNode` inherit `BINDINGS` from ancestors by default.
- Passing `inherit_bindings=False` in the class definition discards ancestor bindings; only `BINDINGS` defined on that class (and its future subclasses) are used.
- `COMPONENT_CLASSES` follow the same pattern with `inherit_component_classes=False`.
- `DEFAULT_CSS` accumulates through the class hierarchy. Each class that defines `DEFAULT_CSS` adds an entry; classes that do not define it add nothing. Deeper subclasses push ancestor CSS priority down.

## Constraints

- IDs and class names must be valid CSS identifiers: no leading digits, no whitespace, no special characters, ASCII only. Violations raise `BadIdentifier`.
- Queries never include the node being queried (the root of the search). The universal selector `*` matches all descendants but not self.
- `NodeList` enforces uniqueness: appending the same widget instance multiple times results in a single entry.
- Query selectors must be syntactically valid CSS. Invalid selectors raise `InvalidQueryFormat` at call time, including in chained operations like `filter` and `exclude`.
- Type constraints on `query_one`, `query_one_optional`, `first`, and `last` are enforced strictly; mismatches raise `WrongType` rather than returning `None`.
