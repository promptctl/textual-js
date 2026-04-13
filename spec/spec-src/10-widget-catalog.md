# Built-In Widget Catalog

This catalog covers every widget class exported from `textual.widgets.__all__` (42 entries). Base `Widget` behavior (DOM, messaging, styling, lifecycle) is owned by spec 09; this catalog lists the per-widget surface — class, bindings, posted messages, key reactives, salient public methods, and composition assumptions. `TextArea`'s editing engine is owned by spec 11; only the widget surface is captured here.

## Export and Loading Contract

- `textual.widgets.__all__` enumerates the 42 supported built-in widget class names.
- `textual.widgets.__getattr__` lazily imports a class by converting its name to a snake_case `_<module>` path and caches the resolved class in `_WIDGETS_LAZY_LOADING_CACHE`.
- `textual/widgets/__init__.pyi` mirrors the exports for type checkers and editors.
- Non-underscored sibling modules (`widgets/button.py`, `widgets/input.py`, `widgets/tree.py`, etc.) are re-export shims around their canonical `_foo.py` implementation; `_markdown_viewer.py`, `_tab.py`, and `_tab_pane.py` are in-package re-export shims for `MarkdownViewer`, `Tab`, and `TabPane`.

// [LAW:one-source-of-truth] `textual.widgets.__all__` is the canonical inventory of supported built-in widget classes.
// [LAW:one-type-per-behavior] Re-export shims forward to a single implementation class per widget family instead of cloning behavior.

## Internal Support Modules

These modules live under `widgets/` but are not in `__all__`; they exist to support exported widgets and are not part of the public catalog:

- `_toggle_button.py` — `ToggleButton` base for `Checkbox` and `RadioButton`. Owns the shared `BINDINGS = [space/enter → toggle]`, `value: reactive[bool]`, `label` property, `compact` reactive, `Changed` message, `toggle()` method, and `ALLOW_SELECT = False`.
- `_toast.py` — `Toast`, `ToastHolder`, `ToastRack` notification widgets mounted by `App` when `Notifications` fire. Not user-composed.
- Markdown helper blocks in `_markdown.py` (`MarkdownBlock`, `MarkdownH1…H6`, `MarkdownTable*`, `MarkdownFence`, etc.) and the `MarkdownTableOfContents` widget support `Markdown`/`MarkdownViewer` rendering.

## Shared Characteristics

- Interaction widgets post custom `Message` subclasses nested on the widget class (e.g. `Button.Pressed`).
- Widgets where direct text selection would conflict with manipulation set `ALLOW_SELECT = False` (Button, ToggleButton family, Tree, DataTable, OptionList, Tabs, Select, RadioSet, Footer, Collapsible title, etc.).
- Most built-ins define `DEFAULT_CSS`; the exceptions are `Checkbox`, `ListItem`, `MaskedInput`, `RadioButton` (they inherit from a styled base).

---

## Display / Static Widgets

### `Static` (`_static.py`)
Base renderable content widget. `inherit_bindings=False`. Exposes `content` property and `update(content, *, layout=True)`. Parent for `Label`, `Link`, `Tooltip`, `Welcome`, `Digits`-adjacent helpers, and most Markdown blocks.

### `Label` (`_label.py`)
Trivial `Static` subclass with inline-block default styling. No bindings, messages, or reactives.

### `Link` (`_link.py`)
Focusable `Static`. `BINDINGS = [enter → open_link]`. Reactives: `text`, `url`. `action_open_link` opens `url` via `App.open_url`; `on_click` also opens. No custom message.

### `Tooltip` (`_tooltip.py`)
`Static` subclass with `inherit_css=False`. Presentation-only; content set by the tooltip subsystem (spec 09).

### `Welcome` (`_welcome.py`)
Splash `Static`. `compose()` yields a `Button("OK")`. No bindings or messages of its own.

### `Placeholder` (`_placeholder.py`)
Debug/layout placeholder. `variant: reactive["default"|"size"|"text"|"state"|"css"]`. `cycle_variant()` rotates variants. `validate_variant` raises `InvalidPlaceholderVariant`. No bindings/messages.

### `Pretty` (`_pretty.py`)
Renders any Python object via Rich `Pretty`. `update(object)` replaces the value. No bindings/messages/reactives.

### `Digits` (`_digits.py`)
Segment-display numeric renderer. `value` property, `update(value: str)`. Overrides `get_content_width`/`get_content_height` for 3x1 glyph sizing. No bindings/messages/reactives.

### `Rule` (`_rule.py`)
Horizontal/vertical separator. Reactives: `orientation: "horizontal"|"vertical"`, `line_style` (solid/heavy/dashed/…). Validators raise `InvalidRuleOrientation`/`InvalidLineStyle`. Classmethods `Rule.horizontal(...)`, `Rule.vertical(...)`. `can_focus=False`.

### `LoadingIndicator` (`_loading_indicator.py`)
Animated spinner. Swallows input via `on_input` (stops propagation). No bindings/messages/reactives.

### `Sparkline` (`_sparkline.py`)
Inline data chart. Reactives: `data: Sequence[float] | None`, `summary_function: Callable[[Sequence[float]], float]` (defaults to `max`). Component classes for bar coloring.

### `ProgressBar` (`_progress_bar.py`)
Composed of internal `Bar`, `PercentageStatus`, `ETAStatus` labels. Reactives: `progress: float`, `total: float | None`, `percentage: float | None` (derived), `gradient: Gradient | None`. Public methods: `advance(amount)`, `update(*, total, progress, advance)`. Not focusable. No custom messages.

---

## Chrome / App-Level Widgets

### `Header` (`_header.py`)
App chrome. Composes `HeaderIcon`, `HeaderTitle`, `HeaderClockSpace`/`HeaderClock`. Reactives: `tall` (double-height), `icon`, `sub_title`, `screen_title`. `watch_tall` toggles `-tall` class. Not focusable.

### `Footer` (`_footer.py`)
`ScrollableContainer` (not focusable, children not focusable). `ALLOW_SELECT = False`. Reactives: `compact: bool`, `show_command_palette: bool`, `combine_groups: bool`, private `_bindings_ready`. Composes `FooterKey` children from the active screen's bindings; subscribes to `Screen.bindings_updated` on mount. Internal `FooterKey.compact` reactive; `FooterLabel(Label)`.

### `HelpPanel` (`_help_panel.py`)
Pop-out bindings help. `update_help(focused_widget)` rebuilds the listing. Composed of internal widgets; not intended for user composition.

### `KeyPanel` (`_key_panel.py`)
`VerticalScroll`, not focusable. Hosts internal `BindingsTable(Static)` that renders the active screen's bindings as a Rich `Table`.

---

## Buttons and Toggles

### `Button` (`_button.py`)
Focusable. `ALLOW_SELECT = False`. `BINDINGS = [enter → press]`. Reactives: `label: ContentText`, `variant: "default"|"primary"|"success"|"warning"|"error"`, `compact: bool`, `flat: bool`. Message: `Button.Pressed(button)`. Raises `InvalidButtonVariant` on bad variant. Action `action_press` and public `press()` post `Pressed`.

### `Checkbox` (`_checkbox.py`)
Empty subclass of `ToggleButton`. Posts `Checkbox.Changed` (via override of `ToggleButton.Changed`). Inherits `value`, `toggle()`, space/enter bindings.

### `RadioButton` (`_radio_button.py`)
Empty subclass of `ToggleButton` with `Changed` variant for use inside `RadioSet`.

### `RadioSet` (`_radio_set.py`)
`VerticalScroll`, focusable, children not focusable. `ALLOW_SELECT = False`. `BINDINGS` for up/down/left/right/enter/space navigation among contained `RadioButton`s. Reactive `compact: bool`. Message: `RadioSet.Changed(pressed)` (with `pressed` the active `RadioButton`). Ensures at most one child is selected.

### `Switch` (`_switch.py`)
Focusable. `ALLOW_SELECT = False`. `BINDINGS = [enter → toggle_switch]`. `COMPONENT_CLASSES = {"switch--slider"}`. Reactives: `value: bool`, internal `_slider_position: float` (animated). Message: `Switch.Changed(switch, value)`. Public `toggle()`.

---

## Text Input Widgets

### `Input` (`_input.py`)
`ScrollView`, focusable. Rich binding table covering caret navigation, word motion, selection, deletion, submit, and suggestion acceptance. `COMPONENT_CLASSES` for placeholder, cursor, selection, suggestion. Reactives: `value`, `selection: Selection`, `placeholder`, `password`, `cursor_blink`, `compact`, internal `_suggestion`, `_cursor_visible`. Messages: `Input.Changed`, `Input.Submitted`, `Input.Blurred`. Accepts `type` ("text"|"integer"|"number"), `validators`, `valid_empty`, `restrict`, `max_length`, `suggester`, `highlighter`. Public: `insert_text_at_cursor`, `action_cursor_*`, `action_delete_*`, `action_submit`, `clear`.

### `MaskedInput` (`_masked_input.py`)
`Input` subclass, focusable. Accepts a `template` string (character-class mask via internal `_Template(Validator)` and `_CharFlags`) that enforces per-position character rules and drives placeholder glyphs. Inherits `Input`'s bindings, messages, and reactives. No `DEFAULT_CSS` of its own.

### `TextArea` (`_text_area.py`) — widget surface only
`ScrollView`, focusable. Large `BINDINGS` set for motion, selection, deletion, indent, undo/redo, copy/cut/paste. `COMPONENT_CLASSES` for gutter, cursor, selection, matched bracket, placeholder. Reactives: `language`, `theme`, `selection: Selection`, `show_line_numbers`, `line_number_start`, `indent_width`, `match_cursor_bracket`, `cursor_blink`, `soft_wrap`, `read_only`, `show_cursor`, `compact`, `highlight_cursor_line`, `suggestion`, `hide_suggestion_on_blur`, `placeholder`. Messages: `TextArea.Changed`, `TextArea.SelectionChanged`. Convenience constructors: `TextArea.code_editor(...)`. Document model, editing history, and syntax highlighting are owned by spec 11.

---

## List / Option Widgets

### `ListItem` (`_list_item.py`)
`can_focus=False`. Reactive `highlighted: bool`. Internal `_ChildClicked` message used by `ListView`. Composition assumption: lives inside `ListView`.

### `ListView` (`_list_view.py`)
`VerticalScroll`, focusable, children not focusable. `BINDINGS` for up/down/home/end/enter, plus page nav. Reactive `index: int | None`. Messages: `ListView.Highlighted(item)`, `ListView.Selected(item)`. Public: `append`, `extend`, `insert`, `pop`, `clear`, `remove_items`, `highlighted_child` property, action_cursor_up/down, `action_select_cursor`.

### `OptionList` (`_option_list.py`)
`ScrollView`, focusable. `ALLOW_SELECT = False`. `BINDINGS` for up/down/home/end/page/enter. `COMPONENT_CLASSES` for option, highlighted, disabled. Reactives: `highlighted: int | None`, `compact: bool`, internal `_mouse_hovering_over`. Messages: `OptionList.OptionMessage` base, `OptionList.OptionHighlighted`, `OptionList.OptionSelected`. Exceptions: `OptionListError`, `DuplicateID`, `OptionDoesNotExist`. `Option` model class defined in this module. Public: `add_option(s)`, `remove_option`, `replace_option_prompt`, `enable_option`/`disable_option`, `get_option`, `clear_options`, `action_select`, `action_first`/`last`/`cursor_up`/`cursor_down`/`page_*`.

### `SelectionList[SelectionType]` (`_selection_list.py`)
`OptionList` subclass, generic over selection value type. Adds `BINDINGS = [space → select]` (toggle) on top of inherited bindings. Additional `COMPONENT_CLASSES` for checkbox glyphs. `Selection` model subclasses `Option` with a value and initial state. Messages: `SelectionList.SelectionMessage`, `SelectionList.SelectionToggled` (toggled option), `SelectionList.SelectedChanged` (selection set changed). Public: `select`, `deselect`, `toggle`, `select_all`, `deselect_all`, `toggle_all`, `selected` property (list of values).

### `Select[SelectType]` (`_select.py`)
`Vertical`, focusable. `ALLOW_SELECT = False`. `BINDINGS` for space/enter/up/down to open and navigate overlay. Composes `SelectCurrent` (current value row) and `SelectOverlay` (internal `OptionList` subclass with escape dismiss binding). Reactives: `value: SelectType | NoSelection`, `expanded: bool`, `compact: bool`. Message: `Select.Changed(select, value)`. Exceptions: `InvalidSelectValueError`, `EmptySelectError`. Sentinel `Select.BLANK = NoSelection()`. Classmethod `Select.from_values(values)`. Public: `clear`, `set_options`, `action_show_overlay`.

---

## Structured Content Widgets

### `Collapsible` (`_collapsible.py`)
`Widget` container. Reactives: `collapsed: bool`, `title: str`. Composes a `CollapsibleTitle` (internal focusable `Static`, `ALLOW_SELECT = False`, `BINDINGS = [enter/space → toggle_collapsible]`, own `Toggle` message and `collapsed`/`label` reactives) plus a `Contents` container. `compose_add_child` routes children into the contents pane. Message: `Collapsible.Toggled(collapsible)`.

### `ContentSwitcher` (`_content_switcher.py`)
`Container`. Reactive `current: str | None` (child id to show). `watch_current` toggles child `display`. Public: `visible_content` property, `add_content(widget, *, id, set_current=False)`. No bindings or messages.

### `Tabs` (`_tabs.py`)
Focusable `Widget`. `BINDINGS` for left/right/home/end navigation. Internal `Underline(Widget)` (with `highlight_start`/`highlight_end`/`show_highlight` reactives and `Clicked` message) and `Tab(Static)` (with nested `TabMessage`/`Clicked`/`Disabled`/`Enabled`/`Relabelled`, `ALLOW_SELECT = False`). `Tabs` reactive `active: str` (tab id). Messages: `Tabs.TabMessage` base, `Tabs.TabActivated`, `Tabs.TabDisabled`, `Tabs.TabEnabled`, `Tabs.TabHidden`, `Tabs.TabShown`, `Tabs.Cleared`. Public: `add_tab`, `remove_tab`, `clear`, `action_previous_tab`/`next_tab`, `disable`/`enable`/`hide`/`show` by id.

### `Tab` (`_tabs.py`)
Individual clickable tab (internal-facing type, exported for construction). `Static` subclass, `ALLOW_SELECT = False`. Carries label, id, disabled state; emits `Tab.Clicked`/`Disabled`/`Enabled`/`Relabelled` via parent `Tabs`.

### `TabbedContent` (`_tabbed_content.py`)
`Widget` composing an internal `ContentTabs(Tabs)` + `ContentSwitcher`. Reactive `active: str`. Messages: `TabbedContent.TabActivated`, `TabbedContent.Cleared`. Public: `add_pane`, `remove_pane`, `clear_panes`, `get_tab`, `get_pane`, `disable_tab`/`enable_tab`/`hide_tab`/`show_tab`. Composition assumption: children are `TabPane` instances; titles may be passed as plain strings via the constructor for implicit panes.

### `TabPane` (`_tabbed_content.py`)
`Widget` holding a titled pane body. Nested `TabPaneMessage` with `Disabled`/`Enabled`/`Focused` variants routed through `TabbedContent`. Accepts `title`, `id`, `disabled` in constructor.

---

## Log Widgets

### `Log` (`_log.py`)
`ScrollView`, focusable. `ALLOW_SELECT = True`. Plain-text log optimised for line append. Public: `write_line(line)`, `write_lines(lines)`, `clear`. No custom bindings or messages beyond `ScrollView` inheritance.

### `RichLog` (`_rich_log.py`)
`ScrollView`, focusable. Accepts Rich renderables; deferred rendering via internal `DeferredRender`. Constructor options: `max_lines`, `min_width`, `wrap`, `highlight`, `markup`, `auto_scroll`. Public: `write(content, ...)`, `clear`. No custom bindings/messages.

---

## Hierarchical Widgets

### `Tree[TreeDataType]` (`_tree.py`)
Generic tree. `ScrollView`, focusable. `ALLOW_SELECT = False`. `BINDINGS` for up/down/left/right (collapse/expand), home/end, pageup/down, enter, space, plus scroll. `COMPONENT_CLASSES` for cursor, highlight, guides, label. Reactives: `show_root: bool`, `show_guides: bool`, `guide_depth: int`, plus `cursor_line`, `hover_line`, `guide_depth` internals. `TreeNode[TreeDataType]` model with `add`, `add_leaf`, `remove`, `expand`/`collapse`/`toggle`, `set_label`, `data`, `allow_expand`. Messages (all generic): `Tree.NodeCollapsed`, `Tree.NodeExpanded`, `Tree.NodeHighlighted`, `Tree.NodeSelected`. Exceptions: `RemoveRootError`, `UnknownNodeID`, `AddNodeError`. Public: `root` property, `get_node_by_id`, `select_node`, `scroll_to_node`, `clear`, `reset`.

### `DirectoryTree` (`_directory_tree.py`)
`Tree[DirEntry]` for filesystem browsing. Additional `COMPONENT_CLASSES` for file/folder/extension colouring. Reactive `path: str | Path`. Messages: `DirectoryTree.FileSelected(path, node)`, `DirectoryTree.DirectorySelected(path, node)`. Hook methods: `filter_paths(paths)`, `process_label(label)`, `render_label(node, base_style, style)`. Internal `DirEntry` dataclass holds the `Path` + loaded flag.

### `DataTable[CellType]` (`_data_table.py`)
`ScrollView`, focusable, generic. `ALLOW_SELECT = False`. Large `BINDINGS` for motion, page, selection, enter. Extensive `COMPONENT_CLASSES` for header, cursor, hover, fixed, odd/even rows. Reactives: `show_header`, `show_row_labels`, `fixed_rows`, `fixed_columns`, `zebra_stripes`, `header_height`, `show_cursor`, `cursor_type: "cell"|"row"|"column"|"none"`, `cursor_coordinate: Coordinate`, `hover_coordinate: Coordinate`, `cell_padding`. Messages: `CellHighlighted`, `CellSelected`, `RowHighlighted`, `RowSelected`, `ColumnHighlighted`, `ColumnSelected`, `HeaderSelected`, `RowLabelSelected`. Exceptions: `CellDoesNotExist`, `RowDoesNotExist`, `ColumnDoesNotExist`, `DuplicateKey`. Key types: `RowKey`, `ColumnKey`, `CellKey`. Public surface: `add_column(s)`, `add_row(s)`, `remove_row`, `remove_column`, `clear`, `update_cell`, `update_cell_at`, `get_cell`, `get_cell_at`, `get_row`, `get_row_at`, `get_column`, `get_column_at`, `sort`, `move_cursor`, `action_*` movement/selection actions.

---

## Markdown Widgets

### `Markdown` (`_markdown.py`)
`Widget` that parses markdown via `markdown-it-py` and mounts one `MarkdownBlock` child per token. Reactive `table_of_contents` via property. Messages: `Markdown.TableOfContentsUpdated`, `Markdown.TableOfContentsSelected`, `Markdown.LinkClicked`. Public: `update(markdown)`, `append(markdown)` (both return `AwaitComplete`), `load(path)`, `goto_anchor(anchor)`, `sanitize_location`, `get_block_class`, classmethod `get_stream`. Streaming helper `MarkdownStream` and block class hierarchy (`MarkdownH1…H6`, lists, tables, fences, bullets) live in this module. Hook `unhandled_token` for custom tokens.

### `MarkdownViewer` (`_markdown.py`, re-exported from `_markdown_viewer.py`)
`VerticalScroll`, not focusable, children focusable. Composes an internal `MarkdownTableOfContents` sidebar + a `Markdown` document. Reactives: `show_table_of_contents: bool`, `top_block: str`, `navigator: Navigator`. Message: `MarkdownViewer.NavigatorUpdated`. Public: `document` property, `table_of_contents` property, `go(path)`, `back()`, `forward()`. `Navigator` tracks history for back/forward.
