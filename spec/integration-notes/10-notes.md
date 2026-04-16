# Integration notes for spec-src/10-widget-catalog.md

## Critical context

- **Rich-js role**: every content-bearing widget accepts markup/`Content`. Several widgets ARE rich-js renderables (Sparkline, Bar via ProgressBar, Digits, Gradient). Markdown widget emits rich-js `Content` blocks per marked token. RichLog accepts `Content` directly.
- **Terminal-UI reality**: widget props that accept "text" should be typed `string | Content`. Markup parsing happens at render time, not at prop assignment.

## Gaps to fix

### 1. Content-bearing widget reactive types

**Where**: Widget tables throughout the file (Static, Label, Link, Button, ListItem, OptionList.Option, Tab, Header, Footer, Pretty, Collapsible.title, TabPane.title, Tooltip, Toast, etc.).
**Current state**: Most reactives/props of displayed text are typed `string` or unspecified.
**Why insufficient**: All these accept markup. Users write `[bold red]Error[/]` inline; widgets parse via rich-js.
**Required change**: Update types for displayed-text reactives/props:
  - `Static.content`: `string | Content`
  - `Label` (inherits): `string | Content`
  - `Link.text`: `string | Content`; `Link.url`: `string`
  - `Button.label`: `string | Content` (was `ContentText`; standardize to `string | Content`)
  - `Toast.message`: `string | Content`; `Toast.title?`: `string | Content`
  - `Collapsible.title`: `string | Content`
  - `TabPane` constructor `title`: `string | Content`
  - `Tab` label: `string | Content`
  - `ProgressBar` labels: rendered via rich-js internally
  - `OptionList.Option.prompt`: `string | Content`
  - `ListItem` children: JSX (already fine, but rendered content flows through rich-js)
  - `Input.placeholder`: `string | Content`
  - `TextArea.placeholder`: `string | Content`
  - `RichLog.write(content)`: `string | Content | Renderable` (accepts markup, content, or any rich-js renderable)

### 2. Sparkline uses rich-js renderable

**Where**: Sparkline widget section.
**Current state**: "Inline data visualization using block characters."
**Why insufficient**: `Sparkline` IS a rich-js renderable; the widget is a thin React wrapper that mounts the rich-js `Sparkline` renderable inside a `<Box>` with TCSS styling.
**Required change**: Add: "The `Sparkline` widget composes the rich-js `Sparkline` renderable. Reactive `data`, `summaryFunction`, `min`, `max`, `color`, and `colorEnd` (for gradient) flow to the renderable. Framework adds the TCSS outer box, focus handling (none — widget is not focusable), and reactive invalidation."

### 3. ProgressBar internal composition

**Where**: ProgressBar section.
**Current state**: "Composed internally of a bar widget, percentage label, and ETA label."
**Why insufficient**: The "bar" is rich-js `Bar` renderable; percentage/ETA labels use rich-js styled `Content`.
**Required change**: Change "bar widget" to "rich-js `Bar` renderable" and note that percentage and ETA labels are rich-js `Content` with TCSS-resolved `Style`.

### 4. Digits widget uses rich-js Digits renderable

**Where**: Digits widget (if present; may be in a "minor widgets" subsection).
**Current state**: May not be explicit.
**Why insufficient**: `Digits` widget wraps the rich-js `Digits` renderable for 3-row tall-glyph numeric display.
**Required change**: Add "Digits" section (or confirm it exists): "`Digits` — tall-glyph numeric display (3 rows per digit). Wraps the rich-js `Digits` renderable. Reactives: `value: number | string`. Width is 3 cells per character; height is 3 rows."

### 5. Markdown token → rich-js Content mapping

**Where**: Markdown widget section, "Markdown token → widget mapping" table.
**Current state**: Table maps tokens to widgets / Ink components.
**Why insufficient**: Inline tokens (bold, italic, inline code, links) become rich-js `Content` segments within a block, not separate widgets. The table conflates block-level tokens (which become widgets) with inline tokens (which become Content spans within a block's Content).
**Required change**: Restructure the table or add a second table:
  - **Block-level tokens → widgets**: Heading → styled Static, Paragraph → Static rendering rich-js Content, Code block → styled Box with Shiki-highlighted Content, Blockquote → Box wrapping inner blocks, Horizontal rule → Rule, Table → DataTable, List → Box with items.
  - **Inline tokens → rich-js Content segments** (applied WITHIN a block's rendered Content): strong/em → Segment with bold/italic Style, code inline → Segment with background Style, link → Segment styled + wrapped in a focusable Link widget for clickability, strikethrough → Segment with strike Style.

  Add: "Markdown parses to a stream of tokens. Block-level tokens map to widgets; inline tokens map to rich-js `Content` `Segment`s within the enclosing block's rendered Content. marked produces the AST; rich-js produces the styled Content."

### 6. RichLog.write signature

**Where**: RichLog section.
**Current state**: `write(content, ...)`.
**Why insufficient**: Accepts multiple types; should be explicit.
**Required change**: Update: "`write(content: string | Content | Renderable)` — appends content to the log. Strings are parsed as markup (if `markup: true` in constructor options); `Content` is appended directly; rich-js renderables (`Bar`, `Gradient`, etc.) render to `Content` at append time. Each write produces one or more lines depending on the content height."

### 7. Pretty widget uses rich-js rendering

**Where**: Pretty widget section.
**Current state**: "Formatted display of any JS value."
**Why insufficient**: The formatting IS rich-js — it produces styled `Content` with syntax coloring for strings, numbers, keys, etc.
**Required change**: Add: "`Pretty` formats values using rich-js styled `Content`: strings use string-literal styling, numbers use numeric styling, object keys vs. values have distinct styles, nested structures are indented. Styles are resolved via TCSS component classes (`pretty--string`, `pretty--number`, `pretty--key`, etc.) so themes can customize."

### 8. Header / Footer render styled content

**Where**: Header and Footer sections.
**Current state**: Header composes title/clock; Footer shows bindings.
**Why insufficient**: Title / subtitle / clock / binding displays use rich-js `Content` for styling.
**Required change**: Add to both: "Rendered content (title, clock segments, binding keys and descriptions) is rich-js `Content` with TCSS-resolved styles. Binding descriptions accept markup."

### 9. Color-valued reactives on ProgressBar etc.

**Where**: ProgressBar and similar widgets with color props.
**Current state**: Not mentioned (if present).
**Why insufficient**: `ProgressBar.gradient` is described as derived; its values are rich-js `Color` for the gradient stops.
**Required change**: Ensure color-valued reactives are typed as rich-js `Color` (or `string | Color` for input-flexible props that parse strings into `Color`).

## Do not change

- Widget property tables structure (canFocus, bindings, messages)
- Widget message types (Button.Pressed, Input.Changed, etc.)
- Widget-specific behaviors (ContentSwitcher ID rules, Tabs/TabbedContent layered APIs, DataTable cursor modes, Tree expand/collapse, etc.)
- Internal widgets table (Toast, Tooltip, LoadingOverlay, HelpPanel, KeyPanel, ScrollBar, ToggleButton, Markdown helper blocks)
- MarkdownStream section
- DirectoryTree filesystem integration
- Validators integration with Input (covered by spec 12)
- Suggester integration with Input
- The widget inventory itself (do not add/remove widgets)
