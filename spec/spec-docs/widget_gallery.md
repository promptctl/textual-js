# Widget Gallery

This spec defines the role and scope of the Textual widget gallery page.

## Purpose

The widget gallery is a visual discovery index for built-in widgets. It is not the canonical API contract for widget behavior.

Canonical behavior for each widget is defined in the corresponding `spec/widget_*.md` file.

## Gallery Contract

The gallery page must:

- Present built-in widgets as browsable examples.
- Link each showcased widget to its reference page.
- Demonstrate widgets using runnable examples in a terminal context.

## Widgets Showcased

The gallery currently showcases these built-in widgets:

- Button
- Checkbox
- Collapsible
- ContentSwitcher
- DataTable
- Digits
- DirectoryTree
- Footer
- Header
- Input
- Label
- Link
- ListView
- LoadingIndicator
- Log
- MarkdownViewer
- Markdown
- MaskedInput
- OptionList
- Placeholder
- Pretty
- ProgressBar
- RadioButton
- RadioSet
- RichLog
- Rule
- Select
- SelectionList
- Sparkline
- Static
- Switch
- Tabs
- TabbedContent
- TextArea
- Tree

## Non-Goals

The gallery does not define:

- Constructor signatures
- Event semantics
- CSS class contracts
- Reactive attribute guarantees

Those belong to the canonical widget specs.

## Source of Truth

- Discovery and demo surface: widget gallery doc page.
- Widget behavior contracts: individual widget spec files.
