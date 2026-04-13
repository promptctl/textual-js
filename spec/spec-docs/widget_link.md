# Link Widget

## Overview

`Link` is a clickable text widget that opens a URL in the user's web browser when clicked or activated via keyboard. It extends `Static` and behaves like a hyperlink in a web browser.

- Focusable: yes
- Container: no
- Import: `from textual.widgets import Link`

Added in version 0.84.0.

## Constructor

```python
Link(
    text: str,
    *,
    url: str | None = None,
    tooltip: str | None = None,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

| Parameter  | Type             | Default | Description                                                                 |
|------------|------------------|---------|-----------------------------------------------------------------------------|
| `text`     | `str`            | ---     | The visible text of the link. Required positional argument.                 |
| `url`      | `str \| None`    | `None`  | The URL to open when activated. If `None`, the `text` value is used as the URL. |
| `tooltip`  | `str \| None`    | `None`  | Optional tooltip shown on hover.                                            |
| `name`     | `str \| None`    | `None`  | Widget name.                                                                |
| `id`       | `str \| None`    | `None`  | Widget DOM ID.                                                              |
| `classes`  | `str \| None`    | `None`  | CSS classes.                                                                |
| `disabled` | `bool`           | `False` | Whether the widget is disabled.                                             |

Note: The `text` is rendered with `markup=False`, so markup syntax in the text is displayed literally, not interpreted.

## Reactive Attributes

| Name   | Type  | Default | Description                                    |
|--------|-------|---------|------------------------------------------------|
| `text` | `str` | `""`    | The visible text of the link. Triggers layout on change. |
| `url`  | `str` | `""`    | The URL to open when the link is activated.    |

When `text` changes, the widget's displayed content is updated automatically via a watcher.

## Messages

This widget sends no messages.

## Bindings

| Key     | Action      | Description                   |
|---------|-------------|-------------------------------|
| `enter` | `open_link` | Open the link in the browser. |

## Actions

### action_open_link

Opens the URL stored in the `url` reactive attribute by calling `self.app.open_url(self.url)`. Does nothing if `url` is empty/falsy. This action is also triggered on mouse click.

## Methods

None beyond the inherited `Static` interface.

## Component Classes

None.

## Default CSS and Styling

### Layout defaults

- `width: auto`
- `height: auto`
- `min-height: 1`

### Visual defaults

- `color: $text-accent`
- `text-style: underline`
- `pointer: pointer` (cursor indicates clickability)

### Hover state

- `color: $accent`

### Focus state

- `text-style: bold reverse`

## Usage Patterns

### Basic link with explicit URL

```python
def compose(self) -> ComposeResult:
    yield Link(
        "Go to textualize.io",
        url="https://textualize.io",
        tooltip="Click me",
    )
```

### Link where text is the URL

When `url` is omitted, the `text` value doubles as the URL:

```python
yield Link("https://textualize.io")
```

### Updating link attributes reactively

```python
link = self.query_one(Link)
link.text = "New destination"
link.url = "https://example.com"
```
