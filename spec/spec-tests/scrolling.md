# Scrolling

Describes scrolling behavior, overflow handling, scrollbar configuration, and scroll navigation for widgets and containers.

### Overflow Modes

A widget's `overflow_x` and `overflow_y` styles control whether scrollbars appear on each axis. The supported values are:

- `"scroll"` -- always show a scrollbar on that axis.
- `"hidden"` -- never show a scrollbar on that axis.
- `"auto"` -- show a scrollbar only when content overflows.

Changing overflow at runtime updates the widget's `virtual_size` immediately (after the next frame). Enabling a scrollbar on one axis reduces virtual size on the perpendicular axis to make room for the scrollbar track. Reverting to `"hidden"` restores the original virtual size.

### Container Scrollbar Defaults

- `Horizontal` has both scrollbars disabled: `scrollbars_enabled == (False, False)`.
- `HorizontalScroll` enables the horizontal scrollbar only: `scrollbars_enabled == (False, True)`.
- `Vertical` has both scrollbars disabled: `scrollbars_enabled == (False, False)`.
- `VerticalScroll` enables the vertical scrollbar only: `scrollbars_enabled == (True, False)`.

A plain `Widget` does not allow scrolling by default (`_allow_scroll` is `False`). A `ScrollableContainer` allows scrolling when its content exceeds its dimensions.

### Scrollbar Sizing

Scrollbar thickness is configurable via the `scrollbar-size` CSS property, which accepts horizontal and vertical values (e.g., `scrollbar-size: 5 5`). Individual axes can be set with `scrollbar-size-vertical` and `scrollbar-size-horizontal`.

Setting scrollbar size to zero (`scrollbar-size: 0 0`) is valid and produces invisible scrollbars -- the content remains scrollable but no track is rendered.

The `scrollbar-size` property supports `!important` for CSS specificity overrides. When `!important` is applied, it takes precedence over more-specific selectors that lack the flag.

### Scrollbar Gutter

The `scrollbar-gutter` property controls whether space is reserved for scrollbars even when they are not visible. Setting `scrollbar-gutter: stable` reserves the gutter space permanently, preventing layout shifts when scrollbars appear or disappear. This can be set programmatically at runtime via `styles.scrollbar_gutter = "stable"`.

### Scrollbar Visibility

The `scrollbar-visibility` CSS property controls whether scrollbar chrome is rendered, independent of whether scrolling is enabled. Setting `scrollbar-visibility: hidden` on a container with `overflow: auto` allows the content to scroll but hides the scrollbar track and thumb entirely.

### Scrollbar Styling

Scrollbar colors are configurable:

- `scrollbar-background` sets the track background color and supports opacity (e.g., `scrollbar-background: blue 10%`).
- `scrollbar-color` sets the thumb color (e.g., `scrollbar-color: cyan`).

### Scroll Navigation Methods

Widgets expose several methods for programmatic scroll control:

- `scroll_visible()` -- scrolls the nearest scrollable ancestor so that the widget is within the visible viewport. Accounts for margins on ancestor containers.
- `scroll_to(x, y, animate=True)` -- scrolls to absolute coordinates. Passing `animate=False` jumps immediately.
- `scroll_to_center(widget, origin_visible=False)` -- scrolls so that a target widget is centered in the viewport. Operates recursively through nested scroll containers (e.g., a `VerticalScroll` containing a `HorizontalScroll`).
- `scroll_end(animate=True)` -- scrolls to the bottom (or end) of the content.
- `scroll_page_down` / `scroll_page_up` -- scrolls by one page height.

### Scroll-to-Visible Geometry

`Region.get_scroll_to_visible(window, region)` computes the minimum scroll offset needed to bring a target region into view within a window region. The resulting offset, when applied to the window, guarantees that the target region overlaps the shifted window.

### Auto-Scroll on Content Append

Widgets like `RichLog` support an `auto_scroll` parameter. When `auto_scroll=True` (the default for `RichLog`), appending content via `write()` automatically scrolls to show the new content. When `auto_scroll=False`, the scroll position is unchanged after writes. Individual `write()` calls can override with `scroll_end=False` to suppress auto-scrolling regardless of the widget-level setting.

### ScrollView and Virtual Size

`ScrollView` is a base class for widgets that render virtual content larger than their viewport. The widget sets `virtual_size` to declare total content dimensions, and the framework provides scrollbar management. Content is rendered line-by-line via `render_line(y)`, where `y` is relative to the scroll offset (`scroll_offset.y`).

### Scroll Animation Levels

Scroll animations respect the application's `animation_level` setting:

- `"full"` -- scrolling is animated with the specified duration.
- `"basic"` -- scrolling is animated (scroll is considered a basic animation).
- `"none"` -- scrolling jumps immediately; no animation occurs regardless of the requested duration.

### Loading State and Scrollbars

Setting `loading = True` on a scrollable container disables interaction and removes scrollbars for the duration of the loading state.

### Compositor Scroll Placement

When a `Screen` has `overflow: scroll` and contains offset children inside a container wider than the viewport, scrolling the screen (e.g., `scroll_to(20, 0)`) correctly updates the compositor's visible widget set. Widgets that remain within the scrolled viewport stay in the visible set.

## Constraints

- Changing `overflow_x` or `overflow_y` at runtime must trigger a virtual size recalculation before the next frame completes.
- Scrollbar defaults for `Horizontal`/`Vertical` vs. `HorizontalScroll`/`VerticalScroll` must not change; they are part of the container contract.
- `scroll_visible()` must account for margins on intermediate containers between the target widget and the scrollable ancestor.
- `Region.get_scroll_to_visible` must return the minimum offset such that the target region overlaps the shifted window.
- `scrollbar-size: 0 0` must not crash or produce layout errors; the content area must use the full available space.
- Scroll animations must be suppressed entirely when `animation_level` is `"none"`.
- Scroll animations must play on both `"full"` and `"basic"` animation levels.
- `scrollbar-visibility: hidden` must hide scrollbar chrome without disabling scroll functionality.
- CSS `!important` on `overflow` and `scrollbar-size` must override more-specific selectors that lack the flag.
- `auto_scroll` on content-appending widgets must be independently overridable per-write via `scroll_end=False`.
- A widget's `loading = True` state must disable the widget and suppress its scrollbars.
