# Built-In Widget Catalog

This catalog covers the built-in widget set. Base widget behavior (lifecycle, messaging, styling, focus, disabled/loading state) is owned by spec 09. This catalog lists the per-widget surface: static properties, bindings, posted messages, reactives, public methods, and composition assumptions. TextArea's editing engine is owned by spec 11. Markdown parsing uses **marked**. Syntax highlighting uses **Shiki**.

All widgets are React function components wrapped in `observer()` from mobx-react-lite. They render using Ink primitives (`<Box>`, `<Text>`) with TCSS-resolved styles via `useStyles()`.
Text-oriented surfaces accept `string | Content` unless noted otherwise. Visual-bearing surfaces accept the broader visual/renderable contract. Plain strings render with the ambient widget style, markup strings are parsed by rich-js at render time, pre-built `Content` is used directly, and rich-js renderables stay renderables on visual-bearing surfaces.

## Shared Characteristics

- Interactive widgets post custom message types nested on the widget (e.g., `Button.Pressed`).
- Most built-ins define `DEFAULT_CSS` for their default appearance.
- All styling comes through the TCSS cascade — no hardcoded Ink props.
- Widgets that capture text input override `checkConsumeKey` to claim printable keys.

### How widget messages work

Each widget defines its message types as classes nested on the component:

```tsx
// Button defines its message type
Button.Pressed = class extends Message {
  static bubble = true;
  constructor(readonly button: typeof Button) { super(); }
};

// Usage in a parent widget's handler
const handlers = {
  onButtonPressed(message: typeof Button.Pressed) {
    const whichButton = message.button;
    // ...
  },
};
```

### How widgets render

All widgets follow the same pattern — Ink primitives with TCSS styles:

```tsx
const Button = observer(({ id, classes, variant = 'default', children }) => {
  const { register, postMessage } = useTextual();
  const styles = useStyles();

  useEffect(() => register({ id, classes, typeName: 'Button', canFocus: true }), []);

  const handleClick = () => postMessage(new Button.Pressed(/* this */));

  return (
    <Box {...styles.box} onClick={handleClick}>
      <Text {...styles.text}>{children}</Text>
    </Box>
  );
});
```

---

## Display / Static Widgets

### `Static`

Base content widget for displaying text and rich content.

| Property | Value |
|----------|-------|
| `canFocus` | `false` |
| `inheritBindings` | `false` |
| Reactives | `content` |
| Messages | — |

- `update(content, layout?)` replaces the displayed content. `content` is a visual-bearing value: string, `Content`, `RichText`, or a supported rich-js renderable. If `layout` is true, triggers a layout refresh.
- Parent type for `Label`, `Link`, and most Markdown-generated blocks.
- Renders content through the framework's visual seam; text-like values may normalize to `Content`, while rich-js renderables remain renderables.

### `Label`

Single-line text with inline-block default styling. Thin wrapper over `Static`.

| Property | Value |
|----------|-------|
| `canFocus` | `false` |
| Reactives | Inherited from `Static` |
| Messages | — |

`Label` inherits the visual-bearing `content` contract from `Static`.

### `Link`

Focusable text that opens a URL.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | `enter` → `open_link` |
| Reactives | `text`, `url` |
| Messages | — |

`action_open_link` opens the `url`. How the URL is opened depends on the platform (e.g., `open` command on macOS). `text` is `string | Content`; `url` remains a plain `string`.

### `Pretty`

Formatted display of any JS value (objects, arrays, primitives).

| Property | Value |
|----------|-------|
| `canFocus` | `false` |
| Reactives | — |
| Messages | — |

- `update(value)` replaces the displayed value.
- Renders rich-js `Content` with syntax coloring and indentation.
- Nested objects and arrays may be collapsible.
- TCSS component classes such as `pretty--string`, `pretty--number`, and `pretty--key` resolve to the rich-js `Style` overlays used for strings, numbers, and object keys.

### `Rule`

Horizontal or vertical separator line.

| Property | Value |
|----------|-------|
| `canFocus` | `false` |
| Reactives | `orientation` (`"horizontal"` \| `"vertical"`), `lineStyle` (`solid` / `heavy` / `dashed` / ...) |
| Validators | `validate_orientation` throws `InvalidRuleOrientation`, `validate_lineStyle` throws `InvalidLineStyle` |

### `Sparkline`

Inline data visualization using block characters (▁▂▃▄▅▆▇█).

| Property | Value |
|----------|-------|
| `canFocus` | `false` |
| Reactives | `data: number[] \| null`, `summaryFunction` (default: `max`) |

- `width: null` uses available render width.
- Default reduction is `max`.
- Each cell maps a data value to one of 8 block heights.
- The widget is a thin wrapper around the rich-js `Sparkline` renderable. Reactive `data`, `summaryFunction`, `min`, `max`, `color`, and `colorEnd` inputs flow to the renderable; the framework adds the outer TCSS box and reactive invalidation. Color-valued inputs accept `string | Color` and are parsed into rich-js `Color`.

### `Digits`

Tall-glyph numeric display.

| Property | Value |
|----------|-------|
| `canFocus` | `false` |
| Reactives | `value: number \| string` |
| Messages | — |

- Wraps the rich-js `Digits` renderable.
- Height is always 3 rows; width is 3 cells per rendered character.

### `ProgressBar`

Progress display with bar, percentage, and optional ETA.

| Property | Value |
|----------|-------|
| `canFocus` | `false` |
| Reactives | `progress: number`, `total: number \| null` |

- `advance(amount)` increments progress.
- `update({ progress?, total?, ... })` sets progress values.
- `total: null` → indeterminate mode (animated bar).
- Internally composes a rich-js `Bar` renderable plus percentage / ETA labels rendered as rich-js `Content` with TCSS-resolved `Style`.
- Color-valued inputs such as gradient stops accept `string | Color` and resolve to rich-js `Color`.

### `LoadingIndicator`

Animated spinner. Swallows all input. Used as the loading overlay for widgets with `loading: true`.

---

## Chrome / App-Level Widgets

### `Header`

App title bar.

| Property | Value |
|----------|-------|
| `canFocus` | `false` |
| Reactives | `tall` (double-height), `icon`, `subTitle`, `screenTitle` |

- Reads `App.title` and `App.subTitle` from the app context.
- Optionally shows a clock display.
- Rendered title, subtitle, and clock segments are rich-js `Content` with TCSS-resolved styles.

```css
Header {
  dock: top;
  height: 1;
  background: $primary;
  color: $foreground;
}
```

### `Footer`

Active key binding display.

| Property | Value |
|----------|-------|
| `canFocus` | `false` |
| Reactives | `compact`, `showCommandPalette` |

- Reads `activeBindings` from the active screen.
- Subscribes to `bindings_updated_signal` to refresh when focus or bindings change.
- Shows key → description pairs for visible bindings.
- Optionally shows a command palette hint.
- Binding keys and descriptions are rendered as rich-js `Content`; binding descriptions accept markup.

```css
Footer {
  dock: bottom;
  height: 1;
  background: $panel;
}
```

---

## Buttons and Toggles

### `Button`

Clickable button with variant styling.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | `enter` → `press`, `space` → `press` |
| Reactives | `label: string \| Content`, `variant`, `compact`, `flat` |
| Messages | `Button.Pressed(button)` |
| Variants | `"default"`, `"primary"`, `"success"`, `"warning"`, `"error"` |

- Variant maps to CSS class: `.-primary`, `.-success`, etc.
- `validate_variant` throws `InvalidButtonVariant` on invalid values.

```css
Button {
  background: $surface;
  color: $foreground;
  min-width: 16;
  height: 3;
  padding: 0 2;
  text-align: center;
}
Button.-primary { background: $primary; }
Button.-success { background: $success; }
Button:focus { background: $accent; }
```

### `Checkbox`

Toggle control with checked/unchecked/indeterminate state.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | `space` → `toggle`, `enter` → `toggle` |
| Reactives | `value: boolean` |
| Messages | `Checkbox.Changed(checkbox, value)` |

- `toggle()` flips the value.
- Shares toggle behavior with `RadioButton` via a common base pattern.

### `RadioButton`

Toggle within a `RadioSet` group.

| Property | Value |
|----------|-------|
| `canFocus` | `false` (focus managed by RadioSet) |
| Reactives | `value: boolean` |
| Messages | `RadioButton.Changed(radioButton, value)` |

### `RadioSet`

Container for `RadioButton`s with mutual exclusion.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| `canFocusChildren` | `false` |
| Bindings | `up`/`left` → `previous`, `down`/`right` → `next`, `enter`/`space` → `toggle` |
| Reactives | `compact` |
| Messages | `RadioSet.Changed(pressed)` |

- Ensures at most one child is selected at a time.
- Keyboard navigation cycles through children.

### `Switch`

Toggle switch with on/off state.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | `enter` → `toggle_switch`, `space` → `toggle_switch` |
| Reactives | `value: boolean` |
| Messages | `Switch.Changed(switch, value)` |

- `toggle()` flips the value.

---

## Text Input Widgets

### `Input`

Single-line text input with cursor, selection, validation, and suggestions.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | Caret navigation (left/right/home/end), word motion (ctrl+left/right), selection (shift+arrows), deletion (backspace/delete/ctrl+backspace/ctrl+delete), submit (enter), suggestion (tab) |
| Reactives | `value`, `selection`, `placeholder: string \| Content`, `password`, `cursorBlink`, `compact` |
| Messages | `Input.Changed(input, value)`, `Input.Submitted(input, value)` |

Configuration props:

| Prop | Type | Description |
|------|------|-------------|
| `type` | `"text"` \| `"integer"` \| `"number"` | Input type — restricts allowed characters |
| `validators` | `Validator[]` | Validation rules (from spec 12) |
| `validEmpty` | `boolean` | Whether empty string passes validation |
| `restrict` | `RegExp \| null` | Character filter — reject characters not matching the pattern |
| `maxLength` | `number \| null` | Maximum character count |
| `suggester` | `Suggester \| null` | Autocomplete provider (from spec 12) |

Public methods: `insertTextAtCursor(text)`, `clear()`.

Overrides `checkConsumeKey` to claim printable character keys — typing does not trigger ancestor bindings.

Built-in input type semantics:
- `type="text"` accepts all printable text; no built-in restrict pattern is applied.
- `type="integer"` accepts an optional leading `+` or `-`, digits, and `_` as a visual separator between digits. Decimal points, exponent markers, alphabetic characters, and misplaced signs are rejected.
- `type="number"` accepts decimal and scientific-notation input, including partial in-progress values needed while typing. Valid partials include a bare `+`, a bare `-`, a bare `.`, exponent forms in progress, and a trailing underscore after a numeric group. `inf`, `nan`, and a bare `e` are rejected.
- Built-in and custom `restrict` rules are evaluated against the entire proposed value, not just the inserted character.

### `MaskedInput`

Input with per-position character constraints.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | Inherited from `Input` |
| Reactives | Inherited from `Input` |

- `template` prop: character-class mask string (e.g., `"999-999-9999"` for phone numbers).
- Template characters define what's allowed at each position.
- Fixed characters (e.g., `-`) are displayed as placeholder glyphs and auto-skipped during cursor movement.

### `TextArea`

Multi-line text editor. Widget surface only — the editing engine (Document model, Navigator, History) is defined in spec 11. Syntax highlighting via **Shiki** is defined in spec 11.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | Motion (arrows, home/end, ctrl+home/end, page up/down), selection (shift+motion), deletion (backspace/delete, ctrl+backspace/delete), indent (tab/shift+tab), undo/redo (ctrl+z/ctrl+shift+z), clipboard (ctrl+c/x/v) |
| Reactives | `language`, `theme`, `selection`, `showLineNumbers`, `indentWidth`, `softWrap`, `readOnly`, `showCursor`, `suggestion`, `placeholder: string \| Content` |
| Messages | `TextArea.Changed(textArea)`, `TextArea.SelectionChanged(textArea, selection)` |

---

## Container Widgets

### `ScrollableContainer`

Scrollable container with vertical and/or horizontal scroll support.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | `pageup` → `scroll_page_up`, `pagedown` → `scroll_page_down`, `home` → `scroll_home`, `end` → `scroll_end` |

- Children overflow the visible area and are scrollable.
- Scrollbars rendered at right edge (vertical) and bottom edge (horizontal).
- Mouse wheel and keyboard scrolling via scroll API (spec 09).

### `Vertical` / `Horizontal`

Flow containers.

| Property | Value |
|----------|-------|
| `canFocus` | `false` |

- `Vertical` sets `flexDirection: column` — children stack top-to-bottom.
- `Horizontal` sets `flexDirection: row` — children flow left-to-right.
- Thin wrappers that apply TCSS styling + flex direction.

### `ContentSwitcher`

Shows one child at a time.

| Property | Value |
|----------|-------|
| `canFocus` | `false` |
| Reactives | `current: string \| null` (child ID to show) |

- `visibleContent` property returns the currently visible child.
- `addContent(widget, id, setCurrent?)` dynamically adds a child. Requires an ID.
- Constructor tolerates ID-less children; `addContent` requires ID.
- Children not matching `current` have `display: none`.

### `Collapsible`

Expandable/collapsible content region.

| Property | Value |
|----------|-------|
| Reactives | `collapsed: boolean`, `title: string \| Content` |
| Messages | `Collapsible.Toggled(collapsible)` |

- Composes a focusable title bar (with enter/space toggle binding) plus a contents container.
- When `collapsed`, the contents container has `display: none`.

### `Tabs`

Tab bar with keyboard navigation.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | `left` → `previous`, `right` → `next`, `home` → `first`, `end` → `last` |
| Reactives | `active: string` (tab ID) |
| Messages | `Tabs.TabActivated`, `Tabs.TabDisabled`, `Tabs.TabEnabled`, `Tabs.TabHidden`, `Tabs.TabShown`, `Tabs.Cleared` |

Public methods: `addTab`, `removeTab`, `clear`, `disable(id)`, `enable(id)`, `hide(id)`, `show(id)`.

`Tab` is the individual clickable tab widget. `label` is `string | Content`; `id` remains a string.

### `TabbedContent`

Tabs + content panes in one component.

| Property | Value |
|----------|-------|
| Reactives | `active: string` (pane ID) |
| Messages | `TabbedContent.TabActivated`, `TabbedContent.Cleared` |

- Composes `Tabs` + `ContentSwitcher` internally.
- Public methods: `addPane`, `removePane`, `clearPanes`, `getTab(id)`, `getPane(id)`, `disableTab(id)`, `enableTab(id)`, `hideTab(id)`, `showTab(id)`.
- `Tabs.hide()`/`show()` and `TabbedContent.hideTab()`/`showTab()` are layered APIs on different objects.

`TabPane` holds a titled pane body. `title` is `string | Content`; `id` remains a string.

### Usage example

```tsx
<TabbedContent>
  <TabPane title="Code" id="code">
    <TextArea language="typescript" />
  </TabPane>
  <TabPane title="Preview" id="preview">
    <Markdown>{previewContent}</Markdown>
  </TabPane>
  <TabPane title="Output" id="output">
    <RichLog />
  </TabPane>
</TabbedContent>
```

---

## List / Option Widgets

### `ListItem`

Individual item in a `ListView`.

| Property | Value |
|----------|-------|
| `canFocus` | `false` |
| Reactives | `highlighted: boolean` |

`ListItem` content is its JSX children; when those children render text, the text flow is rich-js-driven like any other content widget.

### `ListView`

Keyboard-navigable vertical list with selection.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| `canFocusChildren` | `false` |
| Bindings | `up` → `cursor_up`, `down` → `cursor_down`, `home` → `first`, `end` → `last`, `enter` → `select`, `pageup`/`pagedown` |
| Reactives | `index: number \| null` |
| Messages | `ListView.Highlighted(item)`, `ListView.Selected(item)` |

Public methods: `append(item)`, `extend(items)`, `insert(index, item)`, `pop()`, `clear()`, `removeItems(indices)`.

Virtualized rendering: only visible items are rendered (via Ink's rendering or manual virtualization for large lists).

### `OptionList`

Scrollable list of options with separators.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | `up`/`down`/`home`/`end`/`pageup`/`pagedown`/`enter` |
| Reactives | `highlighted: number \| null`, `compact` |
| Messages | `OptionList.OptionHighlighted(index)`, `OptionList.OptionSelected(index)` |

Public methods: `addOption(option)`, `addOptions(options)`, `removeOption(index)`, `enableOption(index)`, `disableOption(index)`, `getOption(index)`, `clearOptions()`.

Building block for `Select`.
Each `OptionList.Option.prompt` is `string | Content`.

### `SelectionList<T>`

Multi-select list (generic over value type).

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | `space` → `select` (toggle current item) |
| Messages | `SelectionList.SelectionToggled(index, value)`, `SelectionList.SelectedChanged(selectionList)` |

Public methods: `select(index)`, `deselect(index)`, `toggle(index)`, `selectAll()`, `deselectAll()`, `toggleAll()`. Property: `selected` (array of selected values).

### `Select<T>`

Dropdown selection (generic over value type).

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | `space`/`enter` → `show_overlay`, `up`/`down` → `cursor_up`/`cursor_down` |
| Reactives | `value: T \| NoSelection`, `expanded`, `compact` |
| Messages | `Select.Changed(select, value)` |

- Composes a current-value display and an overlay (`OptionList`) that opens on activation.
- Sentinel value: `Select.BLANK` represents "no selection."
- Public methods: `clear()`, `setOptions(options)`.

---

## Log Widgets

### `Log`

Plain-text log optimized for high-throughput line append.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | Scroll bindings |

Public methods: `writeLine(line)`, `writeLines(lines)`, `clear()`.

### `RichLog`

Rich content log with formatting.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | Scroll bindings |
| Constructor options | `maxLines`, `minWidth`, `wrap`, `highlight`, `markup`, `autoScroll` |

- `write(content: string | Content | Renderable, ...)` appends styled content.
- `clear()` removes all content.
- `maxLines` prunes oldest content when exceeded.
- `autoScroll` keeps the view at the bottom when new content is appended (anchor behavior from spec 09).
- Strings are parsed as markup when `markup: true`; `Content` is appended directly; rich-js renderables such as `Bar`, `Gradient`, and `Sparkline` render to `Content` at append time. A single write may produce multiple visual lines.

---

## Hierarchical Widgets

### `Tree<T>`

Generic tree with expand/collapse and lazy loading.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | `up`/`down` → cursor navigation, `left` → collapse, `right` → expand, `home`/`end`, `pageup`/`pagedown`, `enter` → select, `space` → toggle |
| Messages | `Tree.NodeCollapsed(node)`, `Tree.NodeExpanded(node)`, `Tree.NodeHighlighted(node)`, `Tree.NodeSelected(node)` |

`TreeNode<T>` model:

| Property / Method | Description |
|-------------------|-------------|
| `label` | Display text |
| `data` | Generic data payload |
| `allowExpand` | Whether this node can be expanded |
| `add(label, data?)` | Add a child branch node |
| `addLeaf(label, data?)` | Add a child leaf node |
| `remove()` | Remove this node and its subtree |
| `expand()` / `collapse()` / `toggle()` | Expand/collapse state |
| `setLabel(label)` | Update display text |

Public methods on `Tree`: `root` property, `getNodeById(id)`, `selectNode(node)`, `scrollToNode(node)`, `clear()`, `reset()`.

Lazy loading: override the `onTreeNodeExpanded` handler to load children asynchronously via workers:

```tsx
const handlers = {
  async onTreeNodeExpanded(message: typeof Tree.NodeExpanded) {
    const node = message.node;
    if (node.data.childrenLoaded) return;
    const children = await loadChildren(node.data.id);
    for (const child of children) {
      node.add(child.name, child);
    }
    node.data.childrenLoaded = true;
  },
};
```

### `DirectoryTree`

Tree subclass for filesystem browsing.

| Property | Value |
|----------|-------|
| Reactives | `path: string` |
| Messages | `DirectoryTree.FileSelected(path, node)`, `DirectoryTree.DirectorySelected(path, node)` |

- Loads directory contents via `fs.readdir` (Node.js API).
- Lazy loading on expand — children loaded when the node is first expanded.
- Hook methods for customization: `filterPaths(paths)` to exclude entries, `renderLabel(node, baseStyle, style)` to customize display.

### `DataTable<T>`

Tabular data display with sorting, cursor, and virtualization.

| Property | Value |
|----------|-------|
| `canFocus` | `true` |
| Bindings | Arrow keys, home/end, pageup/pagedown, enter |
| Reactives | `showHeader`, `showRowLabels`, `fixedRows`, `fixedColumns`, `zebraStripes`, `headerHeight`, `showCursor`, `cursorType` (`"cell"` \| `"row"` \| `"column"` \| `"none"`), `cursorCoordinate`, `hoverCoordinate`, `cellPadding` |
| Messages | `CellHighlighted`, `CellSelected`, `RowHighlighted`, `RowSelected`, `ColumnHighlighted`, `ColumnSelected`, `HeaderSelected` |

Key types: `RowKey`, `ColumnKey`, `CellKey` — stable identifiers that survive sorting and reordering.

Public methods:

| Method | Description |
|--------|-------------|
| `addColumn(label, key?, width?, default?)` | Add a column |
| `addColumns(columns)` | Add multiple columns |
| `addRow(...cells, key?, label?, height?)` | Add a row |
| `addRows(rows)` | Add multiple rows |
| `removeRow(key)` | Remove a row |
| `removeColumn(key)` | Remove a column |
| `clear(columns?)` | Clear data (optionally clear columns too) |
| `updateCell(rowKey, colKey, value)` | Update a single cell |
| `getCell(rowKey, colKey)` | Read a cell value |
| `getRow(key)` | Read a row |
| `getColumn(key)` | Read a column |
| `sort(colKey, reverse?)` | Sort by column |
| `moveCursor(row, col)` | Move cursor to position |

Virtualized rendering: only visible rows are rendered. For datasets with thousands of rows, the component renders a window of rows based on scroll position and row height.

---

## Markdown Widgets

### `Markdown`

Renders markdown content as a tree of textual-js widgets. Parses via **marked**.

| Property | Value |
|----------|-------|
| `canFocus` | `false` |
| Reactives | `tableOfContents` |
| Messages | `Markdown.TableOfContentsUpdated`, `Markdown.TableOfContentsSelected(id)`, `Markdown.LinkClicked(href)` |

Markdown token → widget / content mapping:

Block-level tokens → widgets:

| Markdown token | Widget |
|----------------|--------|
| Heading | Styled `Static` rendering rich-js `Content` |
| Paragraph | `Static` rendering rich-js `Content` |
| Code block | Styled `<Box>` with Shiki-highlighted rich-js `Content` |
| Unordered / ordered list | `<Box>` with list-item children |
| Table | `DataTable`-style grid of textual-js cells |
| Blockquote | `<Box>` wrapping inner blocks with quote styling |
| Horizontal rule | `<Rule>` |
| Image | Alt text display (terminal cannot render images) |

Inline tokens → rich-js `Content` segments within a block:

| Markdown token | Rich-js mapping |
|----------------|-----------------|
| Strong / emphasis | `Segment` with bold / italic `Style` |
| Inline code | `Segment` with code-background `Style` |
| Strikethrough | `Segment` with strike `Style` |
| Link text | Styled `Content` span; blocks that expose clickability wrap the span in a focusable `Link` widget |

`marked` produces the markdown AST. Block-level tokens map to widgets; inline tokens map to rich-js `Content` spans inside the enclosing block's rendered content.

Public methods: `update(markdown)`, `append(markdown)`, `gotoAnchor(anchor)`.

#### Streaming content — `MarkdownStream`

`Markdown` supports streaming content via a `MarkdownStream` helper class. `MarkdownStream` is an async-iterable / streaming interface that accepts chunks of markdown text over time and appends them to the rendered output without re-rendering the entire document.

```tsx
const markdown = markdownRef.current;
const stream = markdown.stream();              // create a MarkdownStream bound to this widget
await stream.write(chunk);                     // append a chunk; parser updates incrementally
await markdown.stream(myAsyncIterable);        // consume an AsyncIterable<string> end-to-end
```

Behavioral contract:

- The stream parses incrementally as chunks arrive; only affected token subtrees re-render.
- Partial / incomplete tokens at a chunk boundary (e.g., an unterminated fenced code block or half-written link) are buffered internally and deferred until a subsequent chunk completes them.
- Chunk boundaries never corrupt the rendered output — worst case, the tail of the document briefly shows buffered prose that has not yet been promoted to its final token type.
- Closing the stream flushes any remaining buffered text as best-effort plain text.
- Useful for rendering LLM responses, streaming log outputs, or progressively loaded content.

// [LAW:one-source-of-truth] The buffered-token state for a streaming document lives on the `MarkdownStream` instance, not duplicated on the widget.
// [LAW:dataflow-not-control-flow] Stream chunks feed a single incremental parse pipeline; the same parse+diff+render path runs for every chunk regardless of content.

### `MarkdownViewer`

Markdown document with navigation sidebar.

| Property | Value |
|----------|-------|
| `canFocus` | `true` (scrollable) |
| Reactives | `showTableOfContents`, `topBlock`, `navigator` |

- Composes a table-of-contents sidebar (built from headings) + a `Markdown` document area.
- `document` property returns the inner `Markdown` widget.
- Navigation: `go(path)`, `back()`, `forward()` for document history.

---

## Internal Widgets

The following widgets are real React components participating in the widget registry (they have the same base contract as user-facing widgets — see spec 09), but they are **not** exported from `textual-js/widgets` and are **not** part of the public widget inventory. They are mounted by the framework in response to runtime events, reactive state, or default bindings, and are never user-composed.

| Widget | Owner / Trigger | Purpose |
|--------|-----------------|---------|
| `Toast` / `ToastHolder` / `ToastRack` | `App.notify()` (spec 01) | Notification display. `Toast` renders `message: string \| Content` and optional `title: string \| Content`; `ToastRack` is mounted once per app; `ToastHolder` slots per severity; individual `Toast` widgets auto-appear and auto-dismiss. |
| `Tooltip` | Widget `tooltip` reactive + hover dwell timer (spec 07) | Displayed near the mouse pointer when a widget with a `tooltip` property (`string \| Content`) is hovered for the configured dwell interval. |
| `LoadingOverlay` | Widget `loading: true` reactive (spec 09) | Rendered over a widget while it is in loading state; wraps `LoadingIndicator` and swallows input. |
| `HelpPanel` | `f1` default binding (app-level) | Pop-out panel showing currently active bindings for the focused widget chain. |
| `KeyPanel` | Bound by app or used internally by `HelpPanel` | Scrollable table of active bindings (key / description / action). |
| `ScrollBar` / `ScrollBarCorner` | Any scrollable container (spec 09) | Internal widgets rendered as children of scrollable containers. Contract: spec 09. |
| `ToggleButton` | Base class for `Checkbox` and `RadioButton` | Internal shared-behavior base carrying the toggle reactive, bindings, and message shape. Never instantiated directly. |
| Markdown helper blocks | Generated by `Markdown` from parsed tokens | `MarkdownBlock`, `MarkdownH1`..`MarkdownH6`, `MarkdownTable`, `MarkdownTableRow`, `MarkdownTableCell`, `MarkdownFence`, `MarkdownList`, `MarkdownListItem`, `MarkdownBlockQuote`, etc. Emitted by the token→widget mapping table above. |

These widgets participate in TCSS selector matching by type name (e.g., `Toast`, `Tooltip`, `LoadingOverlay` are valid type selectors), so themes can style them. They are, however, excluded from the public `textual-js/widgets` export and from documentation of the user widget catalog.

// [LAW:single-enforcer] `ToastRack` is the single mount point for notifications — `App.notify()` dispatches into it, callsites never mount `Toast` directly.
// [LAW:one-type-per-behavior] `ToggleButton` exists so toggle behavior has one implementation; `Checkbox` and `RadioButton` are instance-level specializations, not duplicated behavior.
// [LAW:one-source-of-truth] The internal-widget table above is the canonical list of framework-mounted widgets not exported to users; no other inventory of "non-public widgets" should exist.

---

// [LAW:one-source-of-truth] The widget catalog is the canonical inventory of supported built-in widget types.
// [LAW:one-type-per-behavior] Shared toggle behavior (Checkbox, RadioButton, Switch) is implemented once in a common pattern, not duplicated per widget. Shared scroll behavior is implemented in the base widget contract (spec 09), not per scrollable widget.
