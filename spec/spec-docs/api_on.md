# textual.on

The `on` decorator for declaring message handlers with CSS selector filtering.

Publicly available as `textual.on` (re-exported from `textual._on`).

## OnDecoratorError

`OnDecoratorError(Exception)` -- Raised at import/decoration time when the `on` decorator is misconfigured. Acts as an early warning system for invalid usage.

Raised when:
- A CSS selector is provided for the `control` attribute but the message class does not define a `control` property (i.e. it inherits the default `Message.control`).
- A keyword argument names an attribute not listed in the message's `ALLOW_SELECTOR_MATCH` set.
- A CSS selector string has syntax errors and cannot be parsed.

## OnNoWidget

`OnNoWidget(Exception)` -- Raised at runtime when a selector is applied to an attribute that is not a widget.

## on

```python
def on(
    message_type: type[Message],
    selector: str | None = None,
    **kwargs: str,
) -> Callable[[DecoratedType], DecoratedType]
```

Decorator to declare that a method is a message handler, optionally filtered by CSS selectors.

- **Parameters:**
  - `message_type: type[Message]` -- The message class to handle.
  - `selector: str | None` -- Optional CSS selector matched against the widget exposed by the message's `control` property. If supplied, the handler is only called when `selector` matches `control`.
  - `**kwargs: str` -- Additional CSS selectors for attributes listed in the message's `ALLOW_SELECTOR_MATCH` set.
- **Returns:** A decorator that stores handler metadata on the decorated method without altering it.

### Selector Matching

- The positional `selector` argument is matched against the `control` attribute of the message.
- Keyword arguments are matched against the named attributes. Each attribute name must be present in `message_type.ALLOW_SELECTOR_MATCH`.
- Selectors are parsed at decoration time (import time) using `parse_selectors`. Invalid selectors raise `OnDecoratorError` immediately.

### Internal Mechanism

The decorator stores a `_textual_on` attribute on the decorated method. This is a list of `(message_type, parsed_selectors)` tuples, where `parsed_selectors` is a `dict[str, tuple[SelectorSet, ...]]` mapping attribute names to their parsed CSS selector sets. Multiple `@on` decorators can be stacked on the same method, appending to this list.

### Usage Examples

```python
# Handle Button.Pressed only from the widget with id "#quit"
@on(Button.Pressed, "#quit")
def quit_button(self) -> None:
    self.app.quit()

# Handle TabbedContent.TabActivated with selectors on multiple attributes
@on(TabbedContent.TabActivated, "#tabs", pane="#home")
def switch_to_home(self) -> None:
    ...
```

### Validation Rules

1. If `selector` is provided, `message_type.control` must be overridden from `Message.control` (the message must expose a meaningful control widget).
2. Each keyword argument name must appear in `message_type.ALLOW_SELECTOR_MATCH`.
3. All selector strings must be valid CSS selectors parseable by `parse_selectors`.

Violations of any rule raise `OnDecoratorError` at decoration time.
