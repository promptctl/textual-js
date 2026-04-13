# Header and Footer

## Header

### Display

The Header widget displays a title and an optional sub-title. The title and sub-title are rendered inside a child widget queryable as `HeaderTitle` (a `Static` widget).

- When both title and sub-title are set, the content is formatted as `"{title} — {sub-title}"` (with an em dash separator).
- When only the title is set and no sub-title is provided, the content is the title alone.

### Title Resolution

The Header resolves its title and sub-title from two sources: the `App` and the active `Screen`. The screen takes precedence over the app.

- If the screen defines a `TITLE`, it overrides `App.TITLE`.
- If the screen's title is `None` (not set), the app's title is used as a fallback.
- The same precedence applies to `SUB_TITLE`: screen sub-title overrides app sub-title; `None` falls back to the app's value.

### Reactive Title Updates

Both `title` and `sub_title` on the screen are reactive attributes.

- Setting `app.screen.title` to a new value updates the Header content immediately.
- Setting `app.screen.sub_title` to a new value updates the Header content immediately.
- Changing `app.title` does **not** update the Header when the active screen already defines its own `TITLE`. The screen-level title remains authoritative.

## Footer

### Display

The Footer widget renders at the bottom of the screen and displays the currently available key bindings. Each binding is rendered as a `FooterKey` child widget.

### Key Bindings Display

The Footer displays bindings gathered from the app, the active screen, and focused widgets.

- Each binding is defined via `Binding(key, action, description)`.
- Priority bindings (`priority=True`) are displayed and take precedence over widget-level bindings that share the same key.
- Clicking a `FooterKey` in the Footer triggers the associated action. Repeated clicks trigger the action each time.
- Bindings with `show=False` are hidden from the Footer. A screen-level binding can override an app-level binding's `show` setting; if the screen binding for the same key sets `show=True` (the default), the binding is displayed even if the app binding was hidden.

### Compact Mode

The Footer supports a `compact` reactive attribute that toggles between two visual styles.

- `footer.compact = True` switches to the compact rendering style.
- `footer.compact = False` restores the standard (default) rendering style.
- The `compact` attribute can be toggled at runtime and the Footer re-renders immediately.

### Styling

The Footer and its child `FooterKey` widgets are styleable via CSS. The internal structure exposes the following CSS targets:

- `Footer` -- the outer container.
- `FooterKey` -- each individual key binding widget.
- `.footer-key--key` -- the key label portion within a `FooterKey`.
- `.footer-key--description` -- the description text portion within a `FooterKey`.

Hover state is supported: the Footer visually responds when the mouse hovers over a `FooterKey`.

## Constraints

- The Header always displays a title. If neither the screen nor the app provides one, the app class name is used as the default title.
- Screen-level `TITLE` and `SUB_TITLE` are the single source of truth when set; app-level values are fallbacks, not merged.
- The Footer must display only bindings where `show` is not `False`. Visibility is resolved per-binding, with the most local scope (screen over app) winning.
- Priority bindings override same-key bindings from deeper in the widget tree for both execution and display purposes.
- The `compact` reactive on Footer must trigger a re-render; stale visual state after toggling is a bug.
