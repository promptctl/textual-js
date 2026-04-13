# Widgets

## Shared Widget Behavior

`Widget` (a `DOMNode` subclass) is the primary renderable, scrollable, and interactable unit. `Screen` is a `Widget` subclass that acts as the compose root and owns focus, bindings, mouse capture coordination, and the screen-level compositor.

Every widget shares these behavioral expectations:

- composition and mount/unmount lifecycle, with `__init__` deferring all DOM mutation until mount
- DOM participation, selectors, and pseudo-class state evaluated as pure functions of widget state (`:hover`, `:focus`, `:can-focus`, `:disabled`, `:first-of-type`, `:empty`, `:dark`, etc.)
- reactive attributes owning virtual size, scroll offsets, focus, mouse hover, disabled, loading, and highlight state; derived caches (render, styles, arrangement, rich-style) are rebuilt from those sources
- disabled state filtering input at the widget boundary via `check_message_enabled`; wheel/scroll mouse events always pass through disabled subtrees, other mouse events drop when any ancestor is disabled
- optional focus participation governed by `can_focus`/`can_focus_children` plus overridable `allow_focus()`/`allow_focus_children()` predicates
- loading, tooltip, and visibility behavior
- mounting, reordering, and removal APIs with clear failure cases
- `batch()` — an async context manager combining the widget's `RLock` with `App.batch_update()` for coordinated multi-widget changes

Maximization has two layers:

- `Widget.ALLOW_MAXIMIZE` controls whether a widget itself may be maximized (default: focusable widgets may be maximized)
- app/screen maximized-view settings (`ALLOW_IN_MAXIMIZED_VIEW`) control what remains visible around it

// [LAW:one-source-of-truth] Widget state (virtual size, scroll offsets, focused widget, maximized widget, bindings) lives in reactives/attributes on `Widget`/`Screen`; caches are derived and invalidated by `refresh()`, `notify_style_update`, and `_message_loop_exit`.

## Lifecycle

### Compose and mount

- `__init__` stores positional children in `_pending_children`; no DOM mutation happens until mount.
- On `events.Compose`, `_on_compose` calls `_compose`, which concatenates `_pending_children` with the result of the user `compose()` generator, clears pending children, calls `_extend_compose` (Screen uses this to inject the tooltip and toast rack), then calls `mount_composed_widgets(widgets)`. The default delegates to `mount_all`; `Lazy` overrides it to defer mounting.
- `TypeError` from `compose()` is rewrapped with widget context; any other exception is routed through `App._handle_exception`.
- `_on_mount` wires scroll/anchor state (e.g. enables anchoring on `overflow-y: scroll`); user code overrides `on_mount` to run once the widget is in the DOM.

### Refresh and layout scheduling

`refresh(*regions, repaint=True, layout=False, recompose=False)` records intent on the widget; the actual screen messages are emitted from `_check_refresh`, which runs from `_on_idle`:

- `repaint` → clear rich/layout style caches, mark dirty regions, then `screen.post_message(messages.Update(self))`.
- `layout` → walk ancestors, clear arrangement caches and bump `_layout_updates` up to the first non-auto-dimension ancestor, then `screen.post_message(messages.Layout(self))`.
- `_refresh_scroll` (called by internal scroll updates) → `screen.post_message(messages.UpdateScroll())`.
- `recompose=True` → schedule `_check_recompose` via `call_next` and return immediately; recompose removes children and re-runs compose.

A pre-mount `refresh()` records the request and returns without clearing caches — the first real refresh happens once the widget is attached.

// [LAW:dataflow-not-control-flow] `refresh()` records intent on flags and `_check_refresh` executes the same message pipeline every idle tick; repaint, layout, scroll, and recompose are all data-driven transitions resolved uniformly rather than ad-hoc branches inside callers.

### Removal and pruning

- `remove()` and `remove_children(selector="*")` both route through `App._prune(*nodes, parent=...)` and return an `AwaitRemove`.
- `remove_children` accepts a CSS selector string, a `Widget` subclass (converted to its name), or an explicit iterable of widgets.
- Prune posts `messages.Prune` to each target; `on_prune` closes the message loop. `_message_loop_exit` then prunes descendants recursively, awaits their tasks, dispatches `events.Unmount`, detaches from the parent's `_nodes`, removes from `App._registry`, and clears per-widget caches.

## Rendering

- Default `render()`: if `is_container` with a non-`none` keyline layout, return `layout.render_keyline(self)`; otherwise if `is_container`, return `Blank(background_colors[1])`; otherwise return the CSS-identifier Content for the leaf.
- `_render()` runs `render()` through `visualize(...)` and caches the resulting `Visual` in `_layout_cache`. `notify_style_update` clears `_rich_style_cache` and `_visual_style_cache`.
- `_render_content` rasterizes the cached visual via `Visual.to_strips` into `_render_cache`. `render_line(y)` returns a single `Strip`; `render_lines(crop)` delegates to `_styles_cache.render_widget(self, crop)` for cropped strip lists used by the compositor.
- `BLANK = True` short-circuits both paths to blank strips sized to the widget.
- `is_container` reports whether the widget has children and should participate in layout arrangement; `is_scrollable` reports whether the widget can own scrollbars.

## Geometry, Virtual Size, and Scrolling

Subclass-visible geometry surface: `size`, `region`, `container_size`, `content_region`, `scrollable_content_region`, `content_size`, `window_region`, `virtual_size`, `scroll_offset`.

- `virtual_size` is a reactive `Size` with `layout=True`; subclasses (notably `ScrollView`) update it from `get_content_width`/`get_content_height`.
- `_size_updated(size, virtual_size, container_size, layout=True)` is the single entry point for size changes; it updates internal sizes and calls `_scroll_update(virtual_size)` which pushes `window_size`/`window_virtual_size` into the scrollbars.

Scroll API (all return nothing and schedule work through the animator):

- `scroll_to(x, y, *, animate, speed, duration, easing, force, on_complete, level, immediate=False, release_anchor=True)` — absolute scroll. When `immediate=False`, the real work is deferred via `call_after_refresh(self._scroll_to, ...)`; `immediate=True` calls `_scroll_to` directly. `release_anchor=True` clears the anchor before scrolling.
- `scroll_relative`, `scroll_home`, `scroll_end`, `scroll_left`, `scroll_right`, `scroll_up`, `scroll_down`, `scroll_page_*` — all forward to `scroll_to` with computed targets.
- `scroll_to_widget(...)`, `scroll_to_region(...)`, `scroll_to_center(...)`, `scroll_visible(...)` — compute a target region then dispatch through `scroll_to`.
- `anchor(anchor=True)` marks a scrollable widget as anchored and immediately scrolls to end; `release_anchor()` marks it released; `_check_anchor` restores the anchor when `scroll_y` returns to `max_scroll_y`.
- `allow_vertical_scroll`/`allow_horizontal_scroll` return `False` when disabled/loading, otherwise require `is_scrollable` and the matching scrollbar to be shown.
- Scrollbar visibility is driven from `overflow-*` styles in `_size_updated`/`_scroll_update`; `_vertical_scrollbar`, `_horizontal_scrollbar`, and `_scrollbar_corner` are lazily created `ScrollBar`/`ScrollBarCorner` widgets stored on the parent.
- Scroll action handlers (`action_scroll_home`/`end`/`left`/`right`/`up`/`down`/`page_*`) are the canonical bindings entry point for keyboard scrolling.

### ScrollView

`ScrollView` extends `ScrollableContainer` and is the base for Line API widgets (`Input`, `TextArea`, `Log`, `RichLog`, `OptionList`, `Tree`, `DataTable`) that manage their own content rather than compose child widgets.

- Forces `is_scrollable=True`, `is_container=False`, `ALLOW_MAXIMIZE=True`, and `overflow-x/y: auto` in default CSS.
- Subclasses own `virtual_size` and override `get_content_width`/`get_content_height`; `_size_updated` synchronizes container size and pushes `virtual_size` into the scrollbars via `_scroll_update`.
- `watch_scroll_x`/`watch_scroll_y` update scrollbar positions and call `refresh(self.size.region)` when the integer-rounded scroll position changes.
- `scroll_to` is overridden to call `_scroll_to` directly (no `call_after_refresh` detour) so line-based subclasses can request immediate repaints.
- `refresh_line(y)` / `refresh_lines(y_start, line_count)` refresh a rectangle computed from `scroll_offset` and `max(virtual_size.width, size.width)`.
- Default `render()` returns a debug `Panel` — subclasses must override `render_line` (and optionally `render_lines`) to produce actual output.

### Scrollbar

`ScrollBar` is an internal `Widget` subclass instantiated as a child of any widget showing scrollbars.

- Reactive state: `window_virtual_size`, `window_size`, `position` (1/8-cell granularity enforced by `validate_position`), `mouse_over`, `grabbed: Offset | None`.
- Rendering uses the parent's `scrollbar-*` style tokens, selects active/hover/normal variants from `grabbed`/`mouse_over`, and delegates to `ScrollBar.renderer` (a class-level `ScrollBarRender` overridable globally or per instance).
- Mouse down/up/click are stopped so they do not bubble to the parent. `action_grab` captures the mouse; `_on_mouse_capture` stores `grabbed_position`/`grabbed` and releases the parent's anchor; `_on_mouse_release` clears `grabbed` and re-checks the parent's anchor. While grabbed, `_on_mouse_move` converts pointer delta into a virtual-space offset and posts `ScrollTo(x, y)` to the parent.
- `ScrollBarCorner` fills the gap between horizontal and vertical scrollbars.
- Scroll messages (`ScrollUp`/`ScrollDown`/`ScrollLeft`/`ScrollRight`/`ScrollTo`) are `Message` subclasses with `bubble=False`; the scrollable parent handles them.

## Focus and Input

- `can_focus`/`can_focus_children` are class attributes; `focusable` combines them with ancestor walk.
- `focus(scroll_visible=True)` calls `self.refresh()` then schedules `screen.set_focus(self, scroll_visible=...)` via `app.call_later`. `blur()` calls `screen._reset_focus(self)`. Both tolerate `NoScreen`.
- Key dispatch: `_on_key` → `handle_key` → `dispatch_key(self, event)`. `check_consume_key(key, character)` is the hook widgets override to claim a key (e.g. `Input`, `TextArea`); Screen's `_binding_chain` calls it to strip consumed keys from ancestor binding maps.
- Mouse capture: `capture_mouse(True)` calls `app.capture_mouse(self)`; `release_mouse()` releases only if currently captured. The app owns the single `mouse_captured` slot; widgets cooperate but do not duplicate that state.
- `_forward_event(event)` marks the event forwarded then posts it on the widget; Screen uses this to re-dispatch mouse events onto the widget under the pointer (with coordinate translation for maximized/offset regions).
- `broker_event(event_name, event)` delegates to `App._broker_event`, letting style metadata (e.g. `@click="..."`) be translated into actions from `_on_mouse_down`/`_on_mouse_up`/`_on_click`.
- `run_action(action, namespaces=None)` forwards to `App.run_action` with `self` as default namespace. `check_action(action, parameters)` is the hook a widget overrides to dynamically enable/disable bindings.
- Widgets can opt in to stdout/stderr capture via `begin_capture_print(...)`/`end_capture_print()`; captured text is delivered as `events.Print` messages. Both methods are thin forwards to `App`.
- `text_select_all()` delegates to `Screen._select_all_in_widget`. `_on_click` honors `ALLOW_SELECT`/`Screen.allow_select`/`App.ALLOW_SELECT`, selects the widget on double-click and `select_container` on triple-click, then dispatches the `click` broker event.

## Screen

`Screen` is the compose root and coordination point for focus, bindings, maximize/minimize, selection, and modal behavior.

- `_extend_compose` inserts internal `Tooltip` and `ToastRack` widgets (unless disabled on the app). `_on_mount` subscribes to `screen_layout_refresh_signal` for tooltip clearing.
- `Screen.size` is `app.size - gutter.totals`, making it the sole authority on screen dimensions. `layers` appends internal layers (`_loading`, `_toastrack`, `_tooltips`) to the parent layers tuple.

### Focus chain

- `focused` is a reactive `Widget | None`; do not mutate it directly — use `set_focus`.
- `focus_chain` walks the DOM for all focusable widgets in tab order.
- `set_focus(widget, scroll_visible=True, from_app_focus=False)` is the single enforcer: early-exits if already focused, posts `Blur` to the previous focus, posts `Focus(from_app_focus=...)` to the new one, updates focus styles, and schedules `refresh_bindings` after the next refresh. If `scroll_visible` is set and the widget cannot be fully viewed, it schedules `scroll_to_center` on the next tick.
- `_reset_focus(widget)` moves focus away from a blurring widget; `focus_next`/`focus_previous(selector="*")` walk `focus_chain`.

### Bindings and `_binding_chain`

- `_binding_chain` constructs `[(namespace, BindingsMap)]` starting at the focused widget's `ancestors_with_self` (or `[screen, app]` when nothing is focused or the focused widget is loading). Each returned `BindingsMap` is a copy so filtering does not mutate the source of truth.
- It then walks the chain and, for each earlier namespace, calls `filter_namespace.check_consume_key(key, character)` on every later binding, dropping keys claimed by widgets like `Input` or `TextArea`. Finally it applies `App._keymap` to every map, raising `handle_bindings_clash` on conflicts.
- `_modal_binding_chain` truncates `_binding_chain` at the first modal ancestor — bindings behind a modal screen never fire.
- `active_bindings` walks `_modal_binding_chain`, asks `App._check_action_state` for each binding's action, drops bindings whose state is `False`, and merges priority bindings on top of existing ones.
- `refresh_bindings()` publishes `bindings_updated_signal`; it is invoked automatically from `_watch_focused`, `_watch_stack_updates`, and after `set_focus`.

### Maximize / minimize

- `maximized` is a reactive `Widget | None` with `layout=True`; `_watch_maximized` toggles `-maximized-view` on the screen and `-maximized` on the widget. The classes are derived state; the reactive is the source of truth.
- `maximize(widget, container=True)` respects `widget.allow_maximize`; with `container=True` it walks ancestors looking for the nearest maximizable one.
- `minimize()` clears `maximized` and re-centers any focused widget after the next refresh.
- `ALLOW_IN_MAXIMIZED_VIEW` (on screen or app) selects additional direct children that remain visible alongside the maximized widget. `arrange()` caches layout keyed by `(size, _nodes._updates, maximized)`.

### Event forwarding and mouse capture

- `Screen._forward_event` is the single place mouse/pointer events are translated from screen coordinates to the target widget and re-posted via `widget._forward_event`, including offset translation for maximized regions.
- Mouse capture is coordinated through `App.mouse_captured`; widgets call `capture_mouse`/`release_mouse`, but the screen is where pointer events are routed and where disabled-state filtering decides delivery.

### Suspend / resume ordering

- `_on_screen_suspend` adds `SUSPENDED_SCREEN_CLASS`, clears mouse-over state via `app._set_mouse_over(None, None)`, clears tooltip, and increments `stack_updates`.
- `_on_screen_resume` removes `SUSPENDED_SCREEN_CLASS`, increments `stack_updates`, refreshes app notifications, recomputes auto-focus, and (when attached) conditionally reapplies styles, reruns `_refresh_layout` on size change, and calls `refresh()`.
- Stack-update bumps on both edges trigger `refresh_bindings` via `_watch_stack_updates`.

### Modal and system screens

- `ModalScreen` sets `self._modal = True` in `__init__`; the flag is surfaced through `is_modal` and consumed by `_modal_binding_chain` so a modal truncates the binding chain of ancestors.
- `SystemModalScreen` extends `ModalScreen` with `inherit_css=False` for internal dialogs.
- `dismiss(result=None)` returns an `AwaitComplete` that pops the screen; `pop_until_active()` unwinds background screens stacked above; `action_dismiss(result=None)` is the keyboard entry point.

// [LAW:single-enforcer] Focus changes, binding resolution, mouse capture, and event forwarding are enforced at `Screen` (with `App` for cross-screen concerns). Widgets cooperate by posting messages or calling screen/app methods; they do not duplicate that enforcement.

## Public Widget Inventory

The public built-in widget surface is exactly `textual.widgets.__all__` (42 entries). `textual.widgets.__getattr__` lazily imports each class by converting its name to a snake_case `_<module>` path and caches the result in `_WIDGETS_LAZY_LOADING_CACHE`. Non-underscored sibling modules (`widgets/button.py`, `widgets/input.py`, etc.) and `_markdown_viewer.py`/`_tab.py`/`_tab_pane.py` are re-export shims around the canonical `_foo.py` implementation.

// [LAW:one-source-of-truth] `textual.widgets.__all__` is the canonical inventory of supported built-in widget classes.
// [LAW:one-type-per-behavior] Re-export shims forward to a single implementation class per widget family instead of cloning behavior.

Internal support modules live under `widgets/` but are not in `__all__`:

- `_toggle_button.py` — `ToggleButton` base for `Checkbox`/`RadioButton`. Owns the shared `BINDINGS = [space/enter → toggle]`, `value: reactive[bool]`, `label` property, `compact` reactive, `Changed` message, `toggle()` method, and `ALLOW_SELECT = False`.
- `_toast.py` — `Toast`, `ToastHolder`, `ToastRack` notification widgets mounted by `App` when `Notifications` fire; real runtime UI but not user-composed and not part of the public inventory.
- Markdown helper blocks (`MarkdownBlock`, `MarkdownH1…H6`, `MarkdownTable*`, `MarkdownFence`, `MarkdownTableOfContents`, etc.) support `Markdown`/`MarkdownViewer` rendering.

Shared characteristics across the public surface:

- Interaction widgets post custom `Message` subclasses nested on the widget class (e.g. `Button.Pressed`).
- Widgets where direct text selection would conflict with manipulation set `ALLOW_SELECT = False` (Button, ToggleButton family, Tree, DataTable, OptionList, Tabs, Select, RadioSet, Footer, Collapsible title, etc.).
- Most built-ins define `DEFAULT_CSS`; the exceptions are `Checkbox`, `ListItem`, `MaskedInput`, `RadioButton` (which inherit from a styled base).

### Display / Static

- **`Static`** — base renderable; `inherit_bindings=False`; `content` property, `update(content, *, layout=True)`. Parent for `Label`, `Link`, `Tooltip`, `Welcome`, and most Markdown blocks.
- **`Label`** — trivial `Static` with inline-block styling. No bindings, messages, or reactives.
- **`Link`** — focusable `Static`. `BINDINGS = [enter → open_link]`. Reactives `text`, `url`. `action_open_link` and `on_click` both open `url` via `App.open_url`.
- **`Tooltip`** — `Static` with `inherit_css=False`; content set by the tooltip subsystem.
- **`Welcome`** — splash `Static`; `compose()` yields a `Button("OK")`.
- **`Placeholder`** — debug/layout placeholder. `variant: reactive["default"|"size"|"text"|"state"|"css"]`. `cycle_variant()` rotates variants; `validate_variant` raises `InvalidPlaceholderVariant`.
- **`Pretty`** — renders any Python object via Rich `Pretty`; `update(object)` replaces the value.
- **`Digits`** — segment-display numeric renderer; overrides `get_content_width`/`get_content_height` for 3x1 glyph sizing.
- **`Rule`** — horizontal/vertical separator. Reactives `orientation`, `line_style`; classmethods `Rule.horizontal(...)`, `Rule.vertical(...)`. `can_focus=False`.
- **`LoadingIndicator`** — animated spinner; `on_input` stops input propagation.
- **`Sparkline`** — inline data chart. Reactives `data`, `summary_function` (defaults to `max`).
- **`ProgressBar`** — composed of internal `Bar`, `PercentageStatus`, `ETAStatus`. Reactives `progress`, `total`, derived `percentage`, `gradient`. Public `advance(amount)`, `update(*, total, progress, advance)`. Not focusable.

### Chrome / app-level

- **`Header`** — composes `HeaderIcon`, `HeaderTitle`, `HeaderClockSpace`/`HeaderClock`. Reactives `tall`, `icon`, `sub_title`, `screen_title`; `watch_tall` toggles `-tall`. Not focusable.
- **`Footer`** — `ScrollableContainer`, not focusable, children not focusable, `ALLOW_SELECT = False`. Reactives `compact`, `show_command_palette`, `combine_groups`, private `_bindings_ready`. Composes `FooterKey` children from the active screen's bindings and subscribes to `Screen.bindings_updated` on mount. Footer content is built from active visible bindings; bindings consumed by the focused widget are omitted; disabled-but-visible actions remain visible but disabled; hidden actions do not appear; command-palette footer behavior follows the same logic plus `show_command_palette`.
- **`HelpPanel`** — pop-out bindings help; `update_help(focused_widget)` rebuilds the listing. Internal composition; not user-composed.
- **`KeyPanel`** — `VerticalScroll`, not focusable; hosts internal `BindingsTable(Static)` rendering active bindings as a Rich `Table`.

### Buttons and toggles

- **`Button`** — focusable, `ALLOW_SELECT = False`. `BINDINGS = [enter → press]`. Reactives `label: ContentText`, `variant` (`default|primary|success|warning|error`), `compact`, `flat`. Message `Button.Pressed(button)`; raises `InvalidButtonVariant`. `action_press`/`press()` post `Pressed`.
- **`Checkbox`** — empty subclass of `ToggleButton`; posts `Checkbox.Changed`.
- **`RadioButton`** — empty subclass of `ToggleButton` for use inside `RadioSet`.
- **`RadioSet`** — `VerticalScroll`, focusable, children not focusable, `ALLOW_SELECT = False`. `BINDINGS` for up/down/left/right/enter/space. Reactive `compact`. Message `RadioSet.Changed(pressed)`; ensures at most one child selected.
- **`Switch`** — focusable, `ALLOW_SELECT = False`. `BINDINGS = [enter → toggle_switch]`. `COMPONENT_CLASSES = {"switch--slider"}`. Reactives `value`, internal animated `_slider_position`. Message `Switch.Changed(switch, value)`; public `toggle()`.

### Text input

- **`Input`** — `ScrollView`, focusable. Rich bindings for caret, word motion, selection, deletion, submit, suggestion. `COMPONENT_CLASSES` for placeholder/cursor/selection/suggestion. Reactives `value`, `selection: Selection`, `placeholder`, `password`, `cursor_blink`, `compact`, internal `_suggestion`, `_cursor_visible`. Messages `Input.Changed`, `Input.Submitted`, `Input.Blurred`. Constructor accepts `type` (`text|integer|number`), `validators`, `valid_empty`, `restrict`, `max_length`, `suggester`, `highlighter`. Public: `insert_text_at_cursor`, `action_cursor_*`, `action_delete_*`, `action_submit`, `clear`.
- **`MaskedInput`** — `Input` subclass. Accepts a `template` string (internal `_Template(Validator)` and `_CharFlags`) that enforces per-position character rules and drives placeholder glyphs. Inherits `Input` bindings/messages/reactives; no `DEFAULT_CSS` of its own.
- **`TextArea`** — widget surface only (document model/editing history/highlighting live in the text-editing spec). `ScrollView`, focusable. Large `BINDINGS` set (motion, selection, deletion, indent, undo/redo, copy/cut/paste). `COMPONENT_CLASSES` for gutter/cursor/selection/matched bracket/placeholder. Reactives `language`, `theme`, `selection`, `show_line_numbers`, `line_number_start`, `indent_width`, `match_cursor_bracket`, `cursor_blink`, `soft_wrap`, `read_only`, `show_cursor`, `compact`, `highlight_cursor_line`, `suggestion`, `hide_suggestion_on_blur`, `placeholder`. Messages `TextArea.Changed`, `TextArea.SelectionChanged`. Classmethod `TextArea.code_editor(...)`.

### List / option

- **`ListItem`** — `can_focus=False`; reactive `highlighted`. Internal `_ChildClicked` used by `ListView`.
- **`ListView`** — `VerticalScroll`, focusable, children not focusable. `BINDINGS` for up/down/home/end/enter/page nav. Reactive `index: int | None`. Messages `ListView.Highlighted(item)`, `ListView.Selected(item)`. Public: `append`, `extend`, `insert`, `pop`, `clear`, `remove_items`, `highlighted_child`, `action_cursor_up/down`, `action_select_cursor`.
- **`OptionList`** — `ScrollView`, focusable, `ALLOW_SELECT = False`. `BINDINGS` for up/down/home/end/page/enter. `COMPONENT_CLASSES` for option/highlighted/disabled. Reactives `highlighted`, `compact`, internal `_mouse_hovering_over`. Messages `OptionMessage` base, `OptionHighlighted`, `OptionSelected`. Exceptions `OptionListError`, `DuplicateID`, `OptionDoesNotExist`. `Option` model in this module. Public: `add_option(s)`, `remove_option`, `replace_option_prompt`, `enable_option`/`disable_option`, `get_option`, `clear_options`, `action_select`, `action_first`/`last`/`cursor_up`/`cursor_down`/`page_*`.
- **`SelectionList[SelectionType]`** — `OptionList` subclass, generic over selection value. Adds `BINDINGS = [space → select]`. `Selection` subclasses `Option` with value + initial state. Messages `SelectionMessage`, `SelectionToggled`, `SelectedChanged`. Public: `select`, `deselect`, `toggle`, `select_all`, `deselect_all`, `toggle_all`, `selected` property.
- **`Select[SelectType]`** — `Vertical`, focusable, `ALLOW_SELECT = False`. `BINDINGS` for space/enter/up/down to open/navigate overlay. Composes `SelectCurrent` + `SelectOverlay` (internal `OptionList` subclass with escape dismiss). Reactives `value: SelectType | NoSelection`, `expanded`, `compact`. Message `Select.Changed(select, value)`. Exceptions `InvalidSelectValueError`, `EmptySelectError`. Sentinel `Select.BLANK = NoSelection()`. Classmethod `Select.from_values(values)`. Public: `clear`, `set_options`, `action_show_overlay`.

### Structured content

- **`Collapsible`** — `Widget` container. Reactives `collapsed`, `title`. Composes internal focusable `CollapsibleTitle(Static)` (`ALLOW_SELECT = False`, `BINDINGS = [enter/space → toggle_collapsible]`, own `Toggle` message, `collapsed`/`label` reactives) plus a `Contents` container. `compose_add_child` routes children into contents. Message `Collapsible.Toggled(collapsible)`.
- **`ContentSwitcher`** — `Container`. Reactive `current: str | None` (child id to show). `watch_current` toggles child `display`. Public: `visible_content` property, `add_content(widget, *, id, set_current=False)`. Children are switched by child ID; constructor-time children without IDs may exist but are not addressable through switching; dynamically added content must have an ID.
- **`Tabs`** — focusable `Widget`. `BINDINGS` for left/right/home/end. Internal `Underline(Widget)` (with `highlight_start`/`highlight_end`/`show_highlight` reactives and `Clicked` message) and `Tab(Static)` (nested `TabMessage`/`Clicked`/`Disabled`/`Enabled`/`Relabelled`, `ALLOW_SELECT = False`). Reactive `active: str`. Messages `TabMessage` base, `TabActivated`, `TabDisabled`, `TabEnabled`, `TabHidden`, `TabShown`, `Cleared`. Public: `add_tab`, `remove_tab`, `clear`, `action_previous_tab`/`next_tab`, `disable`/`enable`/`hide`/`show` by id.
- **`Tab`** — individual clickable tab (internal-facing type, exported for construction). `Static`, `ALLOW_SELECT = False`. Emits `Tab.Clicked`/`Disabled`/`Enabled`/`Relabelled` via parent `Tabs`.
- **`TabbedContent`** — `Widget` composing internal `ContentTabs(Tabs)` + `ContentSwitcher`. Reactive `active: str` tracks the active pane and visible content. Messages `TabbedContent.TabActivated`, `TabbedContent.Cleared`. Public: `add_pane`, `remove_pane`, `clear_panes`, `get_tab`, `get_pane`, `disable_tab`/`enable_tab`/`hide_tab`/`show_tab`. `Tabs` and `TabbedContent` expose layered APIs (pane-oriented vs tab-id-oriented), not competing names for the same object.
- **`TabPane`** — `Widget` holding a titled pane body. Nested `TabPaneMessage` with `Disabled`/`Enabled`/`Focused` variants routed through `TabbedContent`. Constructor accepts `title`, `id`, `disabled`.

### Log

- **`Log`** — `ScrollView`, focusable, `ALLOW_SELECT = True`. Plain-text log optimised for line append. Public: `write_line(line)`, `write_lines(lines)`, `clear`.
- **`RichLog`** — `ScrollView`, focusable. Accepts Rich renderables via internal `DeferredRender`. Constructor options `max_lines`, `min_width`, `wrap`, `highlight`, `markup`, `auto_scroll`. Public: `write(content, ...)`, `clear`.

### Hierarchical

- **`Tree[TreeDataType]`** — generic tree. `ScrollView`, focusable, `ALLOW_SELECT = False`. `BINDINGS` for up/down/left/right (collapse/expand), home/end, pageup/down, enter, space, plus scroll. `COMPONENT_CLASSES` for cursor/highlight/guides/label. Reactives `show_root`, `show_guides`, `guide_depth`, plus `cursor_line`/`hover_line`. `TreeNode` model with `add`, `add_leaf`, `remove`, `expand`/`collapse`/`toggle`, `set_label`, `data`, `allow_expand`. Messages `NodeCollapsed`, `NodeExpanded`, `NodeHighlighted`, `NodeSelected`. Exceptions `RemoveRootError`, `UnknownNodeID`, `AddNodeError`. Public: `root`, `get_node_by_id`, `select_node`, `scroll_to_node`, `clear`, `reset`.
- **`DirectoryTree`** — `Tree[DirEntry]` for filesystem browsing. Extra `COMPONENT_CLASSES` for file/folder/extension colouring. Reactive `path`. Messages `FileSelected(path, node)`, `DirectorySelected(path, node)`. Hook methods `filter_paths`, `process_label`, `render_label`. Internal `DirEntry` dataclass.
- **`DataTable[CellType]`** — `ScrollView`, focusable, generic, `ALLOW_SELECT = False`. Large `BINDINGS` for motion/page/selection/enter. Extensive `COMPONENT_CLASSES` for header/cursor/hover/fixed/odd-even rows. Reactives `show_header`, `show_row_labels`, `fixed_rows`, `fixed_columns`, `zebra_stripes`, `header_height`, `show_cursor`, `cursor_type` (`cell|row|column|none`), `cursor_coordinate`, `hover_coordinate`, `cell_padding`. Messages `CellHighlighted`, `CellSelected`, `RowHighlighted`, `RowSelected`, `ColumnHighlighted`, `ColumnSelected`, `HeaderSelected`, `RowLabelSelected`. Exceptions `CellDoesNotExist`, `RowDoesNotExist`, `ColumnDoesNotExist`, `DuplicateKey`. Key types `RowKey`, `ColumnKey`, `CellKey`. Public: `add_column(s)`, `add_row(s)`, `remove_row`, `remove_column`, `clear`, `update_cell`, `update_cell_at`, `get_cell`, `get_cell_at`, `get_row`, `get_row_at`, `get_column`, `get_column_at`, `sort`, `move_cursor`, movement/selection actions.

### Markdown

- **`Markdown`** — `Widget` parsing markdown via `markdown-it-py` and mounting one `MarkdownBlock` child per token. Reactive `table_of_contents` via property. Messages `TableOfContentsUpdated`, `TableOfContentsSelected`, `LinkClicked`. Public: `update(markdown)`, `append(markdown)` (both return `AwaitComplete`), `load(path)`, `goto_anchor(anchor)`, `sanitize_location`, `get_block_class`, classmethod `get_stream`. Streaming helper `MarkdownStream` and block class hierarchy live in this module. Hook `unhandled_token` for custom tokens.
- **`MarkdownViewer`** — `VerticalScroll`, not focusable, children focusable. Composes internal `MarkdownTableOfContents` + `Markdown`. Reactives `show_table_of_contents`, `top_block`, `navigator: Navigator`. Message `NavigatorUpdated`. Public: `document`, `table_of_contents`, `go(path)`, `back()`, `forward()`. `Navigator` tracks history.
