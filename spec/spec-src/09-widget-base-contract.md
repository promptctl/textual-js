# Widget Base Contract

## Core Type

`textual.widget.Widget` extends `DOMNode` and is the primary renderable, scrollable, and interactable unit of a Textual application.

It defines contracts for:

- composition and mount/unmount lifecycle,
- rendering and cached strip production,
- layout/scroll integration (including virtual size and scrollbars),
- focus, keybinding forwarding, and mouse capture,
- event forwarding, message bubbling, and action dispatch.

`Screen` is a `Widget` subclass that acts as the compose root for all other widgets and owns focus, bindings, mouse capture coordination, and the screen-level compositor.

## Class-Level Surface

Common class vars a subclass may override:

- `DEFAULT_CSS`, `COMPONENT_CLASSES`,
- `BINDINGS`,
- `ALLOW_SELECT`, `ALLOW_MAXIMIZE`, `FOCUS_ON_CLICK`, `BLANK`,
- `BORDER_TITLE`, `BORDER_SUBTITLE`,
- `can_focus`, `can_focus_children`.

Reactive attributes on the base: `virtual_size`, `scroll_x`/`scroll_y`, `scroll_target_x`/`scroll_target_y`, `show_vertical_scrollbar`/`show_horizontal_scrollbar`, `has_focus`, `mouse_hover`, `disabled`, `loading`, `hover_style`, `highlight_link_id`.

Pseudo-class hooks live in `_PSEUDO_CLASSES` (`:hover`, `:focus`, `:can-focus`, `:disabled`, `:first-of-type`, `:empty`, `:dark`, etc.) and are evaluated as pure functions of widget state.

## Lifecycle Semantics

### Compose and mount

- `__init__` stores positional children in `_pending_children`; no DOM mutation happens until the widget is mounted.
- On `events.Compose`, `_on_compose` calls `_compose`, which concatenates `_pending_children` with the result of the user-level `compose()` generator, clears pending children, calls `_extend_compose` (Screen uses this to inject the tooltip and toast rack), and then calls `mount_composed_widgets(widgets)`. The default `mount_composed_widgets` delegates to `mount_all`; `Lazy` overrides it to defer mounting.
- `TypeError` from `compose()` is rewrapped with widget context; any other exception is routed through `App._handle_exception`.
- `_on_mount` wires scroll/anchor state (e.g. enables anchoring on `overflow-y: scroll`); user code overrides `on_mount` to run once the widget is in the DOM.

### Refresh / layout scheduling

`refresh(*regions, repaint=True, layout=False, recompose=False)` records intent on the widget; the actual screen messages are emitted from `_check_refresh`, which runs from `_on_idle`:

- `repaint` → clear rich/layout style caches, mark dirty regions, then `screen.post_message(messages.Update(self))`.
- `layout` → walk ancestors, clear arrangement caches and bump `_layout_updates` up to the first non-auto-dimension ancestor, then `screen.post_message(messages.Layout(self))`.
- `_refresh_scroll` (called by internal scroll updates) → `screen.post_message(messages.UpdateScroll())`.
- `recompose=True` → schedule `_check_recompose` via `call_next` and return immediately; recompose removes children and re-runs compose.

A pre-mount `refresh()` records the request and returns without clearing caches — the first real refresh happens once the widget is attached.

### Removal / pruning

- `remove()` and `remove_children(selector="*")` both route through `App._prune(*nodes, parent=...)` and return an `AwaitRemove`.
- `remove_children` accepts a CSS selector string, a `Widget` subclass (converted to its name), or an explicit iterable of widgets.
- Prune posts `messages.Prune` to each target; `on_prune` closes the message loop. `_message_loop_exit` then prunes descendants recursively, awaits their tasks, dispatches `events.Unmount`, detaches from the parent's `_nodes`, removes from `App._registry`, and clears per-widget caches (`_arrangement_cache`, `_render_cache`, `_component_styles`, `_query_one_cache`).
- `batch()` is an async context manager combining `self.lock` (an `RLock`) with `App.batch_update()` for coordinated multi-widget changes.

## Rendering Contract

- Default `render()`:
  - if `is_container` and a layout with a non-`none` keyline is set, return `layout.render_keyline(self)`;
  - otherwise if `is_container`, return `Blank(background_colors[1])`;
  - otherwise return the CSS-identifier Content for the leaf.
- `_render()` runs `render()` through `visualize(...)` and caches the resulting `Visual` in `_layout_cache` under `"_render.visual"`. `notify_style_update` clears `_rich_style_cache` and `_visual_style_cache` so subsequent renders pick up new styles.
- `_render_content` rasterizes the cached visual via `Visual.to_strips` and stores the result in `_render_cache`.
- `render_line(y)` returns a single `Strip` from the render cache (re-rendering content if `_dirty_regions` is non-empty); `render_lines(crop)` delegates to `_styles_cache.render_widget(self, crop)` to produce cropped strip lists used by the compositor.
- `BLANK = True` short-circuits both paths to blank strips sized to the widget.

Caches (`_layout_cache`, `_styles_cache`, `_rich_style_cache`, `_visual_style_cache`, `_arrangement_cache`, `_box_model_cache`) are all derived state; they are invalidated by `refresh()`, `notify_style_update`, and `_message_loop_exit`.

## Geometry, Virtual Size, and Scrolling

Geometry surface visible to subclasses:

- `size`, `region`, `container_size`, `content_region`, `scrollable_content_region`, `content_size`, `window_region`, `virtual_size`, `scroll_offset`.
- `virtual_size` is a reactive `Size` with `layout=True`; subclasses (notably `ScrollView`) update it from `get_content_width`/`get_content_height`.
- `_size_updated(size, virtual_size, container_size, layout=True)` is the single entry point for size changes; it updates internal sizes and calls `_scroll_update(virtual_size)` which pushes `window_size`/`window_virtual_size` into the scrollbars.

Scroll API (all return nothing, schedule work through the animator):

- `scroll_to(x, y, *, animate, speed, duration, easing, force, on_complete, level, immediate=False, release_anchor=True)` — absolute scroll. When `immediate=False`, the real work is deferred via `call_after_refresh(self._scroll_to, ...)`; `immediate=True` calls `_scroll_to` directly. `release_anchor=True` clears the anchor before scrolling.
- `scroll_relative`, `scroll_home`, `scroll_end`, `scroll_left`, `scroll_right`, `scroll_up`, `scroll_down`, `scroll_page_*` — all forward to `scroll_to` with computed targets.
- `scroll_to_widget(widget, ...)`, `scroll_to_region(region, ...)`, `scroll_to_center(widget, ...)`, `scroll_visible(...)` — compute a target region then dispatch through `scroll_to`.
- `anchor(anchor=True)` marks a scrollable widget as anchored and immediately scrolls to end; `release_anchor()` marks the anchor released (user has scrolled away); `_check_anchor` restores the anchor when `scroll_y` returns to `max_scroll_y`.
- `allow_vertical_scroll`/`allow_horizontal_scroll` return `False` when disabled/loading, otherwise require `is_scrollable` and the matching scrollbar to be shown. Subclasses may override.
- Scrollbar visibility is driven from `overflow-*` styles in `_size_updated`/`_scroll_update`; `_vertical_scrollbar`, `_horizontal_scrollbar`, and `_scrollbar_corner` are lazily created `ScrollBar`/`ScrollBarCorner` widgets stored on the parent.

Scroll action handlers (`action_scroll_home`/`end`/`left`/`right`/`up`/`down`/`page_*`) are the canonical bindings entry point for keyboard scrolling.

`check_message_enabled` enforces disabled-state input policy at the widget boundary: if `super().check_message_enabled` rejects the message or the type is prevented, drop it; mouse events in `_MOUSE_EVENTS_ALLOW_IF_DISABLED` (wheel/scroll) always pass so wheel scrolling traverses disabled subtrees; other mouse events in `_MOUSE_EVENTS_DISALLOW_IF_DISABLED` require `not self._self_or_ancestors_disabled`.

## Focus and Input

- `can_focus` / `can_focus_children` are class attributes; `allow_focus()` / `allow_focus_children()` are overridable predicates defaulting to those attributes. `focusable` combines them with ancestor walk.
- `ALLOW_MAXIMIZE` controls the `allow_maximize` predicate (default: focusable widgets may be maximized).
- `focus(scroll_visible=True)` calls `self.refresh()`, then schedules `screen.set_focus(self, scroll_visible=...)` via `app.call_later`. `blur()` calls `screen._reset_focus(self)`. Both tolerate `NoScreen`.
- Key dispatch: `_on_key` → `handle_key` → `dispatch_key(self, event)`. `check_consume_key(key, character)` is the hook widgets override to claim a key (e.g. `Input`, `TextArea`); Screen's `_binding_chain` calls it to strip consumed keys from ancestor binding maps.
- Mouse capture: `capture_mouse(True)` calls `app.capture_mouse(self)`, `release_mouse()` releases only if currently captured, and `_on_mouse_capture`/`_on_mouse_release` are hooks invoked when capture state changes. The app owns the single `mouse_captured` slot; widgets cooperate but do not duplicate that state.

## Event Forwarding, Messages, and Actions

- `_forward_event(event)` marks the event forwarded via `event._set_forwarded()` then `post_message(event)` on the widget; Screen uses this to re-dispatch mouse events onto the widget under the pointer (with coordinate translation for maximized/offset regions).
- Message bubbling is inherited from `DOMNode`/`MessagePump`; `Widget.post_message` adds a debug assertion that `Message.__init__` was called and a dev warning if a widget receives messages while not running.
- `broker_event(event_name, event)` delegates to `App._broker_event`, letting style metadata (e.g. `@click="..."`) be translated into actions from `_on_mouse_down`/`_on_mouse_up`/`_on_click`.
- `run_action(action, namespaces=None)` forwards to `App.run_action` with `self` as default namespace. Action targets (`app`, `screen`, `focused`) are resolved by `App`; individual widgets do not maintain an `action_targets` map.
- `check_action(action, parameters)` (inherited from `DOMNode`) is the hook a widget overrides to dynamically enable/disable bindings; `Screen.active_bindings` calls `App._check_action_state` for every entry in `_modal_binding_chain` and discards any binding whose state is `False`.

## Print Capture

Widgets can opt in to stdout/stderr capture via `begin_capture_print(stdout=True, stderr=True)` and `end_capture_print()`; captured text is delivered as `events.Print` messages. Both methods are thin forwards to `App.begin_capture_print`/`end_capture_print`.

## Selection Helpers

`text_select_all()` delegates to `Screen._select_all_in_widget`. `_on_click` honors `ALLOW_SELECT`/`Screen.allow_select`/`App.ALLOW_SELECT`, selects the widget on double-click and the `select_container` on triple-click, then dispatches the `click` broker event.

## Container vs. Widget Distinction

- `is_container` reports whether the widget has children and should participate in layout arrangement; the default `render()` path uses it to choose between keyline/blank and the leaf CSS-identifier render.
- `is_scrollable` reports whether the widget can own scrollbars. `ScrollView` hard-codes `is_scrollable=True` and `is_container=False`.

## ScrollView Contract

`ScrollView` extends `ScrollableContainer` and is the base for Line API widgets that manage their own content (i.e. not composed from child widgets).

- Forces `is_scrollable=True`, `is_container=False`, `ALLOW_MAXIMIZE=True`, and `overflow-x/y: auto` in default CSS.
- Subclasses own `virtual_size` and override `get_content_width` / `get_content_height` to report it; `_size_updated` synchronizes the container size and pushes `virtual_size` into the scrollbars via `_scroll_update`.
- `watch_scroll_x`/`watch_scroll_y` update scrollbar positions and call `refresh(self.size.region)` when the integer-rounded scroll position changes.
- `scroll_to` is overridden to call `_scroll_to` directly (no `call_after_refresh` detour) so line-based subclasses can request immediate repaints.
- `refresh_line(y)` / `refresh_lines(y_start, line_count)` refresh a rectangle computed from `scroll_offset` and `max(virtual_size.width, size.width)`.
- Default `render()` returns a debug `Panel` — subclasses must override `render_line` (and optionally `render_lines`) to produce actual output.

## Scrollbar Contract

`ScrollBar` is a `Widget` subclass used internally as a child of any widget that shows scrollbars.

- Reactive state: `window_virtual_size`, `window_size`, `position`, `mouse_over`, `grabbed` (an `Offset | None`).
- `position` has 1/8-cell granularity enforced by `validate_position`.
- Rendering uses the parent's `scrollbar-*` style tokens, picks active/hover/normal variants from `grabbed`/`mouse_over`, then delegates to `ScrollBar.renderer` (a class-level `ScrollBarRender` that can be overridden globally or per instance).
- Mouse down/up/click are stopped on the scrollbar so they do not bubble to the parent; `action_grab` captures the mouse, `_on_mouse_capture` stores `grabbed_position`/`grabbed` and releases the parent's anchor, `_on_mouse_release` clears `grabbed` and re-checks the parent's anchor.
- While grabbed, `_on_mouse_move` converts pointer delta into a virtual-space offset and posts `ScrollTo(x, y)` to the parent.
- `ScrollBarCorner` fills the gap between horizontal and vertical scrollbars.
- Scroll messages (`ScrollUp`/`ScrollDown`/`ScrollLeft`/`ScrollRight`/`ScrollTo`) are `Message` subclasses with `bubble=False`; they are handled by the scrollable parent.

## Screen Contract

`Screen` is the compose root and the coordination point for focus, bindings, maximize/minimize, selection, and modal behavior.

### Mount and compose

- `_extend_compose` inserts the internal `Tooltip` and `ToastRack` into the composed widget list (unless disabled on the app).
- `_on_mount` subscribes to `screen_layout_refresh_signal` for tooltip clearing.
- `Screen.size` is `app.size - gutter.totals`, making it the sole authority on screen dimensions.
- `layers` appends internal layers (`_loading`, `_toastrack`, `_tooltips`) to the parent layers tuple.

### Focus chain

- `focused` is a reactive `Widget | None`; do not mutate it directly — use `set_focus`.
- `focus_chain` walks the DOM for all focusable widgets in tab order.
- `set_focus(widget, scroll_visible=True, from_app_focus=False)` is the single enforcer: it early-exits if already focused, posts `Blur` to the previous focus, posts `Focus(from_app_focus=...)` to the new one, updates focus styles, and schedules `refresh_bindings` after the next refresh. If `scroll_visible` is set and the widget cannot be fully viewed, it schedules `scroll_to_center` on the next tick.
- `_reset_focus(widget)` moves focus away from a blurring widget; `focus_next`/`focus_previous(selector="*")` walk `focus_chain`; `_move_focus(...)` is the internal helper.

### Bindings and `_binding_chain`

- `_binding_chain` constructs `[(namespace, BindingsMap)]` starting at the focused widget's `ancestors_with_self` (or `[screen, app]` when nothing is focused or the focused widget is loading). Each returned `BindingsMap` is a copy so filtering does not mutate the source of truth.
- It then walks the chain and, for each earlier namespace, calls `filter_namespace.check_consume_key(key, character)` on every later binding, dropping keys claimed by widgets like `Input` or `TextArea`. Finally it applies `App._keymap` to every map, raising `handle_bindings_clash` on conflicts.
- `_modal_binding_chain` truncates `_binding_chain` at the first modal ancestor — bindings behind a modal screen never fire.
- `active_bindings` walks `_modal_binding_chain`, asks `App._check_action_state` for each binding's action, drops bindings whose state is `False`, and merges priority bindings on top of existing ones.
- `refresh_bindings()` publishes `bindings_updated_signal`. It is invoked automatically from `_watch_focused`, `_watch_stack_updates`, and after `set_focus`.

### Maximize / minimize

- `maximized` is a reactive `Widget | None` with `layout=True`. Setting it drives `_watch_maximized`, which toggles `-maximized-view` on the screen and `-maximized` on the widget — the classes are derived state, the reactive is the source of truth.
- `maximize(widget, container=True)` respects `widget.allow_maximize`; with `container=True` it walks ancestors looking for the nearest maximizable one and assigns that.
- `minimize()` clears `maximized` and, if there is a focused widget, re-centers it after the next refresh.
- `action_maximize`/`action_minimize` are the keyboard entry points; `ALLOW_IN_MAXIMIZED_VIEW` (on the screen or app) selects additional direct children that remain visible alongside the maximized widget. `arrange()` caches the layout keyed by `(size, _nodes._updates, maximized)`.

### Event forwarding and mouse capture

- `Screen._forward_event` is the single place mouse/pointer events are translated from screen coordinates to the target widget and re-posted via `widget._forward_event`, including offset translation for maximized regions.
- The screen coordinates mouse capture through `App.mouse_captured`; widgets call `capture_mouse`/`release_mouse`, but the screen is where pointer events are routed (and where disabled-state filtering via `check_message_enabled` decides whether the event is delivered).

### Modal and system screens

- `ModalScreen` sets `self._modal = True` in `__init__`; the flag is surfaced through `is_modal` and consumed by `_modal_binding_chain` so a modal truncates the binding chain of ancestors.
- `SystemModalScreen` extends `ModalScreen` with `inherit_css=False` for internal dialogs.
- `dismiss(result=None)` returns an `AwaitComplete` that pops the screen; `pop_until_active()` unwinds any background screens stacked above this one; `action_dismiss(result=None)` is the keyboard entry point.

// [LAW:one-source-of-truth] Widget state (virtual size, scroll offsets, focused widget, maximized widget, bindings) lives in reactives/attributes on `Widget`/`Screen`; derived caches (render, styles, arrangement, rich-style, binding chain copies) are rebuilt from those sources rather than written to independently.
// [LAW:single-enforcer] Focus changes, binding resolution, mouse capture, and event forwarding are all enforced at `Screen` (with `App` for cross-screen concerns). Widgets cooperate by posting messages or calling screen/app methods; they do not duplicate that enforcement.
// [LAW:dataflow-not-control-flow] `refresh()` records intent on flags and `_check_refresh` executes the same message pipeline every idle tick; scroll, layout, repaint, recompose, and style updates are all data-driven transitions resolved uniformly rather than ad-hoc branches inside callers.
