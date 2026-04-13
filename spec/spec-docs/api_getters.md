# textual.getters

Descriptors to define properties on widgets, screens, or the App. These are Python descriptor classes that provide convenient typed access to parts of the DOM.

## app

`app(Generic[AppType])` (`textual.getters`) -- A descriptor that returns the active app instance, cast to a specific App subclass.

All widgets have a default `app` property returning a base `App` instance. This descriptor allows type checkers to see the correct subclass.

### Constructor

- `__init__(app_type: type[AppType] | Callable[[], type[AppType]])` -- Accepts the App subclass directly or a callable that returns the App subclass.

### Descriptor Protocol

- `__get__(obj: MessagePump, obj_type: type[MessagePump]) -> AppType` -- Returns the active app. First tries the `active_app` context variable; if not found, walks the `_parent` chain from `obj` until an `App` instance is found. Raises `NoActiveAppError` if no app is found. Asserts the app is an instance of the configured `app_type`.

### Usage Example

```python
class MyWidget(Widget):
    app = getters.app(MyApp)
```

## query_one

`query_one(Generic[QueryType])` (`textual.getters`) -- A descriptor that calls `DOMNode.query_one` when accessed, returning a widget matching a selector and/or type.

### Constructor (Overloaded)

- `__init__(selector: str)` -- Match by TCSS selector string.
- `__init__(selector: type[QueryType])` -- Match by widget type. The type name becomes the selector.
- `__init__(selector: str, expect_type: type[QueryType])` -- Match by selector and expected type.
- `__init__(selector: type[QueryType], expect_type: type[QueryType])` -- Match by type used as selector, with explicit expected type.

### Instance Attributes

- `selector: str` -- The TCSS selector string used for the query.
- `expect_type: type[Widget]` -- The expected widget type. Defaults to `Widget` if not provided.

### Descriptor Protocol

- `__get__(obj: DOMNode, obj_type: type[DOMNode]) -> QueryType` -- Calls `obj.query_one(self.selector, self.expect_type)` and returns the result. Raises the same exceptions as `query_one` (`NoMatches`, `WrongType`) if no match or wrong type. When accessed on the class (`obj is None`), returns the descriptor itself.

### Usage Example

```python
class MyScreen(Screen):
    output_log = getters.query_one("#output", RichLog)

    def on_mount(self) -> None:
        self.output_log.write("Screen started")
```

## child_by_id

`child_by_id(Generic[QueryType])` (`textual.getters`) -- A descriptor that returns a direct child widget by its ID. More efficient than `query_one` with an ID selector because it does not search the full DOM tree.

### Constructor (Overloaded)

- `__init__(child_id: str)` -- Match by child ID (not a selector -- just the raw ID string).
- `__init__(child_id: str, expect_type: type[QueryType])` -- Match by child ID and expected type.

### Instance Attributes

- `child_id: str` -- The `id` of the widget to find.
- `expect_type: type[Widget]` -- The expected widget type. Defaults to `Widget` if not provided.

### Descriptor Protocol

- `__get__(obj: DOMNode, obj_type: type[DOMNode]) -> QueryType` -- Looks up the child by ID in the node's internal `_nodes` collection. Raises `NoMatches` if no child with the given ID exists. Raises `WrongType` if the child exists but is not an instance of `expect_type`. When accessed on the class (`obj is None`), returns the descriptor itself.

### Usage Example

```python
class MyScreen(Screen):
    output_log = getters.child_by_id("output", RichLog)

    def on_mount(self) -> None:
        self.output_log.write("Screen started")
```
