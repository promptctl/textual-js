# textual.lazy

Tools for lazy loading widgets. Provides two widget wrappers (`Lazy` and `Reveal`) that defer mounting of child widgets to improve perceived responsiveness.

## Lazy Class

`Lazy` (`textual.lazy`) extends `Widget`. Wraps a widget so that it is mounted lazily -- after the first refresh rather than during initial composition.

### Purpose

Lazy widgets reduce the time the user sees a blank screen by allowing the UI to render immediately with visible widgets, then mount the lazy widgets afterward. This is particularly beneficial for widgets that start out invisible, such as tab panes.

### Important Note

Since lazy widgets are not mounted immediately, they will not appear in DOM queries for a brief interval until they are mounted. Application code must account for this.

### Default CSS

```css
Lazy {
    display: none;
}
```

The `Lazy` wrapper itself is hidden; it is replaced by the wrapped widget after mounting.

### Constructor

```python
def __init__(self, widget: Widget) -> None
```

**Parameters:**

- `widget: Widget` -- The widget that should be mounted after a refresh.

**Internal State:**

- `_replace_widget: Widget` -- Stores the widget to be lazily mounted.

### Methods

#### compose_add_child

```python
def compose_add_child(self, widget: Widget) -> None
```

Delegates child composition to the wrapped widget by calling `self._replace_widget.compose_add_child(widget)`.

#### mount_composed_widgets

```python
async def mount_composed_widgets(self, widgets: list[Widget]) -> None
```

Called after composition. Schedules a post-refresh callback that:

1. Mounts the wrapped `_replace_widget` into the parent, positioned after the `Lazy` widget.
2. Removes the `Lazy` widget from the DOM.

Uses `self.call_after_refresh(mount)` to defer the operation until after the first refresh.

### Example

```python
def compose(self) -> ComposeResult:
    yield Footer()
    with ColorTabs("Theme Colors", "Named Colors"):
        yield Content(ThemeColorButtons(), ThemeColorsView(), id="theme")
        yield Lazy(NamedColorsView())
```

## Reveal Class

`Reveal` (`textual.lazy`) extends `Widget`. Similar to `Lazy`, but mounts children sequentially over multiple frames rather than all at once.

### Purpose

Useful when a container has so many child widgets that there is a noticeable delay before anything appears. By mounting children incrementally (one per frame), the user perceives continuous progress.

### Default CSS

```css
Reveal {
    display: none;
}
```

### Constructor

```python
def __init__(self, widget: Widget) -> None
```

**Parameters:**

- `widget: Widget` -- The container widget to mount.

**Internal State:**

- `_replace_widget: Widget` -- The container widget to mount in place of `Reveal`.
- `_widgets: list[Widget]` -- Accumulated child widgets collected during composition.

### Class Methods

#### _reveal

```python
@classmethod
def _reveal(cls, parent: Widget, widgets: list[Widget]) -> None
```

Reveal children lazily by mounting them one at a time with a 20ms delay between each.

**Parameters:**

- `parent: Widget` -- The parent container widget.
- `widgets: list[Widget]` -- The child widgets to reveal incrementally.

**Behavior:**

1. Pops the first widget from the list and mounts it into the parent.
2. If more widgets remain, sets a 20ms timer to mount the next one.
3. Handles exceptions gracefully (e.g. if the parent is removed during mounting).

### Methods

#### compose_add_child

```python
def compose_add_child(self, widget: Widget) -> None
```

Appends the widget to `self._widgets` for later incremental mounting.

#### mount_composed_widgets

```python
async def mount_composed_widgets(self, widgets: list[Widget]) -> None
```

Called after composition. Performs the following:

1. Mounts `_replace_widget` into the parent, positioned after the `Reveal` widget.
2. Removes the `Reveal` widget from the DOM.
3. Calls `_reveal` with a copy of `_widgets` to begin incremental child mounting.
4. Clears `_widgets`.

### Example

```python
def compose(self) -> ComposeResult:
    with lazy.Reveal(containers.VerticalScroll(can_focus=False)):
        yield Markdown(WIDGETS_MD, classes="column")
        yield Buttons()
        yield Checkboxes()
        yield Datatables()
        yield Inputs()
        yield ListViews()
        yield Logs()
        yield Sparklines()
    yield Footer()
```
