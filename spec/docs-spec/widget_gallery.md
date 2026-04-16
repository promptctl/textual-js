# Docs Spec: Widget Gallery

## Purpose
Define the role and scope of the textual-js widget gallery page — a visual discovery index that links each built-in widget to its reference documentation. The gallery is a browseable catalog, not the canonical behavior contract for any widget.

## Audience
New users exploring what widgets ship with textual-js; developers picking between widgets for a given UI need.

## Required sections
1. Purpose — one-paragraph statement that the gallery is for discovery, not API contract.
2. How to run the gallery — how to launch the gallery application locally (script/binary/package entrypoint).
3. Widget index — a browseable list of every built-in widget with a short description and a link to its dedicated docs page.
4. Navigation conventions — how to move between examples within the gallery app (keybindings inherited from the standard shell).
5. Non-goals — explicitly state the gallery does not define constructor props, event semantics, TCSS contracts, or reactive attribute guarantees.
6. Source of truth — point readers at the dedicated per-widget docs for authoritative information.

## Key concepts
- The gallery is a runnable textual-js application that demos each built-in widget.
- Each showcased widget has a dedicated reference page; the gallery links to it.
- The gallery is a discovery surface, not a specification.

## Behaviors and contracts
- The gallery links to every widget whose dedicated docs page exists under the widgets section.
- The gallery does not duplicate information from per-widget pages — it demonstrates and defers.
- If a new built-in widget is added to textual-js, it must also appear in the gallery.

## Widgets that must be showcased
At minimum, the gallery must include live demos and links for:
- Button, Checkbox, Collapsible, ContentSwitcher, DataTable, Digits, DirectoryTree, Footer, Header, Input, Label, Link, ListView, LoadingIndicator, Log, MarkdownViewer, Markdown, MaskedInput, OptionList, Placeholder, Pretty, ProgressBar, RadioButton, RadioSet, RichLog (or its textual-js equivalent), Rule, Select, SelectionList, Sparkline, Static, Switch, Tabs, TabbedContent, TextArea, Tree.

Writers should verify the catalog matches the textual-js widget catalog (`spec/spec-src/10-widget-catalog.md`) at the time of publication; textual-js may add, rename, or omit items relative to Python Textual.

## Example requirements
The gallery doc page itself is primarily links and screenshots. Any inline code samples must be JSX/TypeScript using Ink primitives. No Python.

## Cross-references
- Every per-widget docs spec under `spec/docs-spec/widget_*.md`.
- Behavioral spec: `spec/spec-src/10-widget-catalog.md`.

## Notes for writers
- Keep the gallery page short and visual. It is a table of contents with pictures, not a reference.
- Do not copy-paste constructor signatures or event tables into the gallery.
- Verify the list of widgets against the textual-js catalog before publishing — do not inherit the Python list uncritically (e.g., some widgets may be renamed or merged).
