# textual.containers

Container widgets for quick styling. With the exception of `Center` and `Middle`, containers fill all of the space in the parent widget.

## Container

- Extends: `Widget`
- Layout: vertical
- Overflow: hidden hidden
- Default size: `1fr` x `1fr`

Simple container widget with vertical layout. No scrollbars.

## ScrollableContainer

- Extends: `Widget` (with `can_focus=True`)
- Layout: vertical
- Overflow: auto auto
- Default size: `1fr` x `1fr`
- `ALLOW_MAXIMIZE = False` -- Scrollable containers are not typically maximized.

A scrollable container with vertical layout and auto scrollbars on both axes.

### Constructor

`ScrollableContainer(*children, name=None, id=None, classes=None, disabled=False, can_focus=None, can_focus_children=None, can_maximize=None)`

- `can_focus: bool | None` -- Override default focusability. `None` uses the class default (`True`).
- `can_focus_children: bool | None` -- Override whether children can be focused. `None` uses default.
- `can_maximize: bool | None` -- Allow this container to maximize. `None` uses default logic.

### Properties

- `allow_maximize -> bool` -- Returns `can_maximize` if set, otherwise delegates to `super().allow_maximize`.

### Bindings

| Key | Action | Description |
|---|---|---|
| `up` | `scroll_up` | Scroll up |
| `down` | `scroll_down` | Scroll down |
| `left` | `scroll_left` | Scroll left |
| `right` | `scroll_right` | Scroll right |
| `home` | `scroll_home` | Scroll to home |
| `end` | `scroll_end` | Scroll to end |
| `pageup` | `page_up` | Page up |
| `pagedown` | `page_down` | Page down |
| `ctrl+pageup` | `page_left` | Page left |
| `ctrl+pagedown` | `page_right` | Page right |

All bindings have `show=False`.

## Vertical

- Extends: `Widget`
- Layout: vertical
- Overflow: hidden hidden
- Default size: `1fr` x `1fr`

An expanding container with vertical layout and no scrollbars.

## VerticalGroup

- Extends: `Widget`
- Layout: vertical
- Overflow: hidden hidden
- Default size: `1fr` x `auto`

A non-expanding container with vertical layout and no scrollbars. Height is `auto` (shrinks to content).

## VerticalScroll

- Extends: `ScrollableContainer`
- Layout: vertical
- Overflow: hidden x, auto y

A container with vertical layout and an automatic scrollbar on the Y axis only.

## Horizontal

- Extends: `Widget`
- Layout: horizontal
- Overflow: hidden hidden
- Default size: `1fr` x `1fr`

An expanding container with horizontal layout and no scrollbars.

## HorizontalGroup

- Extends: `Widget`
- Layout: horizontal
- Overflow: hidden hidden
- Default size: `1fr` x `auto`

A non-expanding container with horizontal layout and no scrollbars. Height is `auto` (shrinks to content).

## HorizontalScroll

- Extends: `ScrollableContainer`
- Layout: horizontal
- Overflow: hidden y, auto x

A container with horizontal layout and an automatic scrollbar on the X axis only.

## Center

- Extends: `Widget`
- Alignment: `align-horizontal: center`
- Default size: `1fr` x `auto`

A container which centers children horizontally.

## Right

- Extends: `Widget`
- Alignment: `align-horizontal: right`
- Default size: `1fr` x `auto`

A container which right-aligns children horizontally.

## Middle

- Extends: `Widget`
- Alignment: `align-vertical: middle`
- Default size: `auto` x `1fr`

A container which vertically centers children.

## CenterMiddle

- Extends: `Widget`
- Alignment: `align: center middle`
- Default size: `1fr` x `1fr`

A container which centers children both horizontally and vertically.

## Grid

- Extends: `Widget`
- Layout: grid
- Default size: `1fr` x `1fr`

A container with CSS grid layout.

## ItemGrid

- Extends: `Widget`
- Layout: grid
- Default size: `1fr` x `auto`

A container with grid layout and automatic columns.

### Reactive Attributes

- `stretch_height: reactive[bool] = True` -- Expand the height of widgets to the row height.
- `min_column_width: reactive[int | None] = None` -- The smallest permitted column width. Triggers layout on change.
- `max_column_width: reactive[int | None] = None` -- The largest permitted column width. Triggers layout on change.
- `regular: reactive[bool] = False` -- All rows should have the same number of items.

### Constructor

`ItemGrid(*children, name=None, id=None, classes=None, disabled=False, min_column_width=None, max_column_width=None, stretch_height=True, regular=False)`

All reactive attributes can be set via constructor parameters using `set_reactive`.

### Methods

- `pre_layout(layout: Layout) -> None` -- Called before layout. If the layout is a `GridLayout`, configures it with the reactive attributes (`stretch_height`, `min_column_width`, `max_column_width`, `regular`).
