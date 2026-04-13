# Header and Footer Widgets

## Purpose

**Header** is a docked-top widget displaying the application title, an optional icon (which opens the command palette), and an optional clock. It is not focusable and not a container.

**Footer** (added in version 0.63.0) is a docked-bottom widget that automatically displays keybindings available for the currently focused widget. It is a horizontally-scrollable container but is not focusable (`can_focus=False`, `can_focus_children=False`).

Sources:
- `textual.widgets.Header` (`src/textual/widgets/_header.py`)
- `textual.widgets.Footer` (`src/textual/widgets/_footer.py`)

---

## Header

### Constructor

```python
Header(
    show_clock: bool = False,
    *,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    icon: str | None = None,
    time_format: str | None = None,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `show_clock` | `bool` | `False` | Show a live clock on the right side of the header. |
| `name` | `str \| None` | `None` | Widget name. |
| `id` | `str \| None` | `None` | Widget DOM ID. |
| `classes` | `str \| None` | `None` | CSS classes. |
| `icon` | `str \| None` | `None` | Single character for the icon (top-left). `None` uses the default `"⭘"`. |
| `time_format` | `str \| None` | `None` | `strftime` format string for the clock. `None` uses the default `"%X"`. |

### Reactive Attributes

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `tall` | `bool` | `False` | When `True`, the header expands to 3 cells tall (via the `-tall` CSS class). When `False`, it is 1 cell tall. Clicking the header toggles this. Note: the official docs list this default as `True`; verify against source if behavior matters. |
| `icon` | `str` | `"⭘"` | The character displayed as the icon in the top-left corner. Data-bound to the child `HeaderIcon`. |
| `time_format` | `str` | `"%X"` | The `strftime` format string used by the clock. Data-bound to the child `HeaderClock`. |

### Title Display

The header displays text derived from the application and screen titles:

- `screen_title` property: Returns `Screen.title` if set, otherwise falls back to `App.title`.
- `screen_sub_title` property: Returns `Screen.sub_title` if set, otherwise falls back to `App.sub_title`.

Title rendering is delegated to `format_title()`, which by default calls `App.format_title(title, sub_title)`. Override `format_title()` to customize how the title appears in the header.

The header watches `App.title`, `App.sub_title`, `Screen.title`, and `Screen.sub_title` for changes and updates the display automatically.

### Child Widgets (Composition)

The header composes three internal widgets:

| Widget | Position | Description |
|--------|----------|-------------|
| `HeaderIcon` | Docked left, 8 cells wide | Displays the `icon` character. Clicking it opens the command palette (via `app.command_palette` action). Disabled when `App.ENABLE_COMMAND_PALETTE` is `False`. |
| `HeaderTitle` | Center, full width | A `Static` widget that displays the formatted title. Text uses `nowrap` and `ellipsis` overflow. |
| `HeaderClockSpace` / `HeaderClock` | Docked right, 10 cells wide | If `show_clock=True`, a `HeaderClock` renders a live clock (refreshes every 1 second). Otherwise, a `HeaderClockSpace` placeholder reserves the space. |

### Messages

This widget posts no messages.

### Bindings

This widget has no bindings.

### Component Classes

This widget has no component classes.

### CSS Classes (automatic)

| Class | Condition |
|-------|-----------|
| `-tall` | Applied when `tall` is `True`. Removed when `False`. |

### Default CSS

```
Header {
    dock: top;
    width: 100%;
    background: $panel;
    color: $foreground;
    height: 1;
}
Header.-tall {
    height: 3;
}
```

### Usage Notes

- Set `App.title` and `App.sub_title` (or `Screen.title` / `Screen.sub_title`) to control what text the header shows.
- Clicking the header toggles between tall (3-row) and compact (1-row) modes.
- The icon in the top-left opens the command palette when clicked, provided `App.ENABLE_COMMAND_PALETTE` is `True`.

---

## Footer

### Constructor

```python
Footer(
    *children: Widget,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
    show_command_palette: bool = True,
    compact: bool = False,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `*children` | `Widget` | | Child widgets (rarely used directly). |
| `name` | `str \| None` | `None` | Widget name. |
| `id` | `str \| None` | `None` | Widget DOM ID. |
| `classes` | `str \| None` | `None` | CSS classes. |
| `disabled` | `bool` | `False` | Whether the widget is disabled. |
| `show_command_palette` | `bool` | `True` | Show the command palette keybinding on the right side. |
| `compact` | `bool` | `False` | Use a more compact layout with less whitespace. |

### Reactive Attributes

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `compact` | `bool` | `False` | When `True`, applies the `-compact` CSS class for reduced whitespace. Toggled via `toggle_class`. |
| `show_command_palette` | `bool` | `True` | When `True`, the command palette binding is displayed docked to the right side of the footer. |
| `combine_groups` | `bool` | `True` | When `True`, bindings sharing the same group are visually grouped together. |

The internal `_bindings_ready` reactive (bool) gates initial rendering; the footer composes no children until bindings are first received.

### Binding Discovery

The footer subscribes to `Screen.bindings_updated_signal` on mount (and unsubscribes on unmount). When bindings change, it recomposes its children to reflect the currently active bindings.

Only bindings with `show=True` (the default) appear in the footer. To hide a binding from the footer, set `show=False` on the `Binding`.

The `key_display` argument of `Binding` controls the text shown for the key in the footer. For example, `Binding(key="question_mark", action="help", description="Help", key_display="?")` displays `?` instead of `question_mark`.

### Binding Groups

When multiple bindings share the same `group` (a `BindingGroup` instance), the footer renders them together in a `KeyGroup` container with a shared label from `group.description`. Individual key descriptions are suppressed within groups; only the group description is shown. If `group.compact` is `True`, the `KeyGroup` uses reduced spacing.

### Child Widgets (Composition)

| Widget | Description |
|--------|-------------|
| `FooterKey` | Renders a single key binding: key display and description. Clicking it simulates the key press (`app.simulate_key`). Disabled keys ring the bell instead. |
| `FooterLabel` | A `Label` used to display binding group descriptions. |
| `KeyGroup` | A `HorizontalGroup` that wraps grouped `FooterKey` widgets. |

### FooterKey Component Classes

| Class | Description |
|-------|-------------|
| `footer-key--key` | Targets the key display portion. Default: bold text, `$footer-key-foreground` color, `$footer-key-background` background, horizontal padding of 1. |
| `footer-key--description` | Targets the description portion. Default: `$footer-description-foreground` color, `$footer-description-background` background, right padding of 1. |

### Messages

This widget posts no messages.

### Bindings

This widget has no bindings.

### CSS Classes (automatic)

| Class | Condition |
|-------|-----------|
| `-compact` | Applied to the `Footer` when `compact` is `True`. |
| `-disabled` | Applied to individual `FooterKey` widgets when the binding is disabled. Adds `dim` text style. |
| `-grouped` | Applied to `FooterKey` widgets that belong to a binding group. |
| `-command-palette` | Applied to the `FooterKey` for the command palette binding. Docked right with a left border separator. |

### Default CSS

```
Footer {
    layout: horizontal;
    color: $footer-foreground;
    background: $footer-background;
    dock: bottom;
    height: 1;
    scrollbar-size: 0 0;
}
```

The footer hides its scrollbars (`scrollbar-size: 0 0`) but supports horizontal mouse-wheel scrolling when content overflows.

Key ANSI-mode overrides are provided under `&:ansi` for terminals without truecolor support.

### Usage Notes

- The footer automatically reflects bindings for the currently focused widget. No manual binding registration is needed.
- Set `show=False` on a `Binding` to prevent it from appearing in the footer (e.g., for vim-style aliases like `j`/`k`).
- Use `key_display` on a `Binding` to customize the displayed key text.
- The footer is horizontally scrollable when bindings overflow the available width.
- `ALLOW_SELECT` is `False` on both `Footer` and `FooterKey`, so they do not participate in text selection.
- Clicking a `FooterKey` simulates the associated key press. Clicking a disabled key rings the terminal bell.
