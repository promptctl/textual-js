# Widgets Overview

A widget is a UI component responsible for managing a rectangular region of the screen. Widgets respond to events, manage state, and render content. Every widget runs in its own asyncio task.

## Widget Base Class

All widgets derive from `textual.widget.Widget`, which itself extends `DOMNode`. The constructor accepts:

- `*children: Widget` -- child widgets to mount immediately.
- `name: str | None` -- an optional name for the widget.
- `id: str | None` -- an optional DOM identifier (must be unique within a screen).
- `classes: str | None` -- space-separated CSS class names. If `None`, uses `DEFAULT_CLASSES`.
- `disabled: bool` -- whether the widget starts in a disabled state.
- `markup: bool` -- whether content markup processing is enabled (default `True`).

A widget cannot be its own parent; passing `self` as a child raises `WidgetError`. All positional arguments must be `Widget` subclasses or `TypeError` is raised.

### Key Class Variables

| Variable | Type | Description |
|---|---|---|
| `DEFAULT_CSS` | `str` | Inline CSS bundled with the widget. Has lower specificity than app or file CSS. |
| `DEFAULT_CLASSES` | `str` | Default CSS classes applied when `classes` is not passed to the constructor. |
| `SCOPED_CSS` | `bool` | When `True` (default), `DEFAULT_CSS` is scoped to the widget and its children only. Set to `False` to make default CSS global. |
| `COMPONENT_CLASSES` | `set[str]` | CSS class names for sub-widget styling via the Line API. Convention: `widgetname--part-name`. |
| `BORDER_TITLE` | `str` | Default value for `border_title`. Displays text in the top border. |
| `BORDER_SUBTITLE` | `str` | Default value for `border_subtitle`. Displays text in the bottom border. |
| `BINDINGS` | `list` | Key bindings associated with the widget. Only active when the widget (or a descendant) has focus. |
| `ALLOW_MAXIMIZE` | `bool \| None` | `None` uses default (focusable widgets may maximize), `True` allows, `False` disallows. |
| `ALLOW_SELECT` | `bool` | Whether the widget supports automatic text selection. |
| `FOCUS_ON_CLICK` | `bool` | Whether focusable widgets receive focus on click (default `True`). |
| `BLANK` | `bool` | Optimization flag for large scrolling containers with no border/content. |

### Key Reactive Attributes

| Attribute | Type | Description |
|---|---|---|
| `disabled` | `bool` | Disabled widgets cannot be interacted with and appear dimmer. |
| `loading` | `bool` | When `True`, replaces the widget with a loading indicator. |
| `has_focus` | `bool` | Read-only. Whether the widget currently has focus. |
| `mouse_hover` | `bool` | Read-only. Whether the mouse is over the widget. |
| `virtual_size` | `Size` | The scrollable content size. If larger than the widget, scrollbars appear. |
| `scroll_x` / `scroll_y` | `float` | Current scroll position. |
| `show_vertical_scrollbar` / `show_horizontal_scrollbar` | `bool` | Whether scrollbars are visible. |

### Instance Attributes

- `border_title` / `border_subtitle` -- text displayed in the top/bottom border. Limited to a single line; cropped with ellipsis if too long. Only visible when a border style is set.
- `absolute_offset` -- forces an absolute screen position (used internally by tooltips).
- `lock` -- an `asyncio` `RLock` for synchronizing concurrent access to widget state.
- `highlight_style` -- optional Rich `Style` applied as a highlight.

## Widget Lifecycle

### Compose

The `compose()` method is called by Textual to create child widgets. It is a generator that yields `Widget` instances. Textual calls `compose()` when the widget is first mounted.

```python
def compose(self) -> ComposeResult:
    yield Header()
    yield Label("Hello")
    yield Footer()
```

Widgets yielded from `compose()` are mounted as children. A widget that yields children from `compose()` is a compound widget (also called a container).

### Mounting

`mount(*widgets, before=None, after=None) -> AwaitMount` mounts one or more child widgets into the DOM. The return value is optionally awaitable.

`mount_all(widgets, *, before=None, after=None) -> AwaitMount` accepts an iterable instead of positional arguments.

The `before` and `after` parameters accept an `int` (child index), `str` (query selector), or `Widget` instance to control insertion position.

Widgets passed as positional arguments to the constructor are treated as pending children and mounted alongside `compose()` results during the initial mount phase.

### Mount Event

After a widget is mounted and composed, Textual dispatches a `Mount` event. Override `on_mount` to perform post-mount initialization.

During `_on_mount`, the widget enables scrollbars if `overflow-x` or `overflow-y` is set to `scroll`.

### Unmounting and Removal

`remove() -> AwaitRemove` removes the widget from the DOM entirely.

`remove_children(selector="*") -> AwaitRemove` removes immediate children matching a CSS selector, a widget type, or an iterable of widgets.

During `_on_unmount`, the widget cancels any workers associated with it and removes any cover widget (loading indicator).

### Recompose

`recompose()` removes all non-system children and re-runs `compose()`, then mounts the new children. This provides a way to fully rebuild a widget's child tree. It can be triggered by calling `refresh(recompose=True)`.

## Render Method

The `render()` method returns the visual content of a widget. It should return one of:

- A string (with optional content markup, e.g. `[bold]Hello[/]`).
- A `Content` object.
- A Rich renderable.

```python
def render(self) -> RenderResult:
    return "Welcome to [bold red]Textual[/]!"
```

The default `render()` implementation returns a keyline visualization for containers with a keyline style, a blank background for other containers, or the widget's CSS identifier for non-containers.

### Pre-render Hook

`pre_render()` is called before rendering. Subclasses that override this must call `super().pre_render()`. It resets cached visual style state.

### Static Widget

`textual.widgets.Static` is a `Widget` subclass that caches the render result and provides an `update()` method to change the displayed content without re-implementing `render()`.

## Line API

For advanced widgets that need efficient partial updates, implement `render_line(y: int) -> Strip` instead of `render()`. The Line API:

- Receives a `y` offset from the top of the widget.
- Returns a `Strip` containing `Segment` objects (text + style pairs).
- Enables refreshing individual regions rather than the full widget.
- Is used by extending `ScrollView` for scrollable content, which requires setting `virtual_size` and accounting for `scroll_offset` in `render_line`.

Component classes (`COMPONENT_CLASSES`) allow CSS styling of sub-parts within Line API widgets via `get_component_rich_style()`.

### Strips and Segments

A `Segment` is a `(text, style)` named tuple from Rich. A `Strip` is an immutable container of segments representing one line. The `Strip` constructor takes a list of segments and an optional cell-length parameter.

## Content Size

When width or height is `auto`, Textual auto-detects dimensions from the renderable. Override these methods to customize:

- `get_content_width(container: Size, viewport: Size) -> int` -- returns the optimal content width.
- `get_content_height(container: Size, viewport: Size, width: int) -> int` -- returns the content height given a width.

## Widget CSS

### DEFAULT_CSS

The `DEFAULT_CSS` class variable embeds CSS directly in the widget class. This is how built-in widgets ship their styling without requiring external CSS files.

- Default CSS has lower specificity than app-level CSS or external stylesheets, so it can always be overridden by application authors.
- Default CSS is scoped by default (`SCOPED_CSS = True`), meaning it only affects the widget and its descendants.

### CSS Class Variable Restriction

Widgets must use `DEFAULT_CSS`, not `CSS`, for inline styles. If a widget defines a `CSS` class variable, a warning is emitted and the value is ignored. The `CSS` class variable is reserved for `App` and `Screen`.

### Pseudo-classes

Widgets support the following pseudo-classes for CSS targeting:

`:hover`, `:focus`, `:blur`, `:can-focus`, `:disabled`, `:enabled`, `:dark`, `:light`, `:focus-within`, `:inline`, `:ansi`, `:nocolor`, `:first-of-type`, `:last-of-type`, `:first-child`, `:last-child`, `:odd`, `:even`, `:empty`.

## Focus and Focusable

Widgets are not focusable by default. To make a widget focusable:

- Set `can_focus = True` as a class variable on the widget subclass.
- Set `can_focus_children = True` (default) to allow children to receive focus.

The `allow_focus()` method returns `can_focus` by default but can be overridden for dynamic logic. Similarly, `allow_focus_children()` returns `can_focus_children` and can be overridden.

Focused widgets can handle key bindings defined in their `BINDINGS` class variable. Focus can be acquired by clicking (if `FOCUS_ON_CLICK` is `True`) or via Tab/Shift+Tab navigation.

The `:focus` pseudo-class applies CSS when the widget has focus. The `:focus-within` pseudo-class applies when any descendant has focus.

## Tooltips

The `tooltip` property accepts a string, Rich renderable, or `None`. When set, hovering the mouse over the widget displays the tooltip content.

```python
widget.tooltip = "Supplementary information"
```

The `with_tooltip(tooltip)` chainable method sets the tooltip and returns `self`, useful in `compose()`:

```python
yield Label("Hello").with_tooltip("A greeting")
```

Setting `tooltip` to `None` clears it. Tooltip appearance can be customized by targeting the `Tooltip` widget type in CSS.

Tooltips should not contain essential information since keyboard-only users may never see them.

## Loading State

The `loading` reactive attribute temporarily replaces the widget with a loading indicator when set to `True`.

```python
self.query_one(DataTable).loading = True
# ... fetch data ...
self.query_one(DataTable).loading = False
```

### set_loading

`set_loading(loading: bool)` applies or removes the loading state. When loading:

1. Calls `get_loading_widget()` to obtain the indicator widget.
2. Adds the `-textual-loading-indicator` class to the indicator.
3. Covers the original widget with the indicator via `_cover()`.

When loading ends, the cover is removed via `_uncover()`.

### get_loading_widget

`get_loading_widget() -> Widget` returns the widget to display during loading. The default implementation defers to `Screen.get_loading_widget()`, which defers to `App.get_loading_widget()`, which returns a `LoadingIndicator`. Override at any level to customize.

## Refresh

`refresh(*regions, repaint=True, layout=False, recompose=False) -> Self` schedules a widget refresh on the next idle event. Multiple calls are coalesced into a single refresh.

- `regions` -- optional `Region` objects to refresh only specific areas (Line API optimization).
- `repaint` -- repaint the widget content.
- `layout` -- recalculate the widget layout.
- `recompose` -- remove children and re-run `compose()`.

## Border Titles

`border_title` and `border_subtitle` display text in the top and bottom borders respectively. They require an active border style to be visible.

Default values come from `BORDER_TITLE` and `BORDER_SUBTITLE` class variables. Titles are single-line only and cropped with ellipsis if they exceed the available width. Title color and alignment are controlled via CSS styles.

## Text Links

Content markup supports click-action links:

```
"Click [@click=app.bell]Me[/]"
```

The `@click` tag runs the specified action when clicked. Links are underlined by default to indicate interactivity.

`auto_links` is a reactive attribute (default `True`) that controls whether links in widget content are automatically highlighted.

## Compound Widgets

A compound widget uses `compose()` to yield child widgets instead of implementing `render()` or `render_line()`. This is the standard way to build widgets that combine multiple sub-widgets.

Compound widgets follow the "attributes down, messages up" pattern (unidirectional data flow):

- **Attributes down**: a parent updates children by setting their attributes or calling their methods directly.
- **Messages up**: a child communicates with its parent by posting messages via `post_message()`.
- Siblings never modify each other directly; changes go through the parent.

## Disabled State

The `disabled` reactive attribute prevents interaction with a widget and typically renders it with a dimmer appearance. Mouse events (except scroll events) are suppressed when a widget is disabled.
