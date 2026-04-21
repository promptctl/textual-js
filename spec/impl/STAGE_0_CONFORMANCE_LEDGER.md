# Stage 0 Conformance Ledger

Seeded: 2026-04-21

This ledger records the Stage 0 conformance boundary from
`spec/impl/IMPLEMENTATION_ORDER.md` against the backlog seed in
`spec/spec-src/99-source-coverage-matrix.md`.

// [LAW:one-source-of-truth] Stage ownership below is derived from
`spec/impl/IMPLEMENTATION_ORDER.md`; the source coverage matrix seeds the
backlog but does not override the implementation order.

// [LAW:verifiable-goals] Every deferred row names the source backlog item, the
Stage 0 decision, the owning stage, and the deterministic acceptance artifact.

## Stage 0 Owned Scope

Stage 0 owns the harness and renderer seam only:

| Source | Stage 0 acceptance artifact |
| --- | --- |
| `testing.md` | Deterministic `runTest()` / `Pilot` behavior coverage |
| `geometry.md` | Deterministic geometry value behavior coverage |
| `app.md` construction subset | App instantiation and title/subtitle coercion coverage |
| `app.md` running subset | `run_test` / `runTest` harness coverage yielding a pilot |
| `app.md` lifecycle subset | `exit()` termination and return-value propagation coverage |

## Deferred Backlog

These source-coverage-matrix entries are intentionally outside Stage 0. They
must not be used as Stage 0 readiness gates, and their existence in source or
test filenames is not evidence that the owning stage is complete.

| Source backlog item | Stage 0 decision | Owning stage | Acceptance artifact |
| --- | --- | --- | --- |
| `reactivity.md` | Defer | Stage 1 | Reactive pipeline behavior coverage |
| `events_and_messages.md` | Defer | Stage 1 | Message/event dispatch behavior coverage |
| `app.md` runtime subset | Defer | Stage 1 | Runtime lifecycle, mount, disabled/loading, batch, and shutdown behavior coverage |
| `color.md` | Defer | Stage 2 | Color parsing and normalization behavior coverage |
| `css_scalars.md` | Defer | Stage 2 | Scalar unit parsing and resolution behavior coverage |
| `css_parsing.md` | Defer | Stage 2 | TCSS parsing behavior coverage |
| `css_styles.md` | Defer | Stage 3 | Cascade, specificity, variables, and inline override behavior coverage |
| `css_nested.md` | Defer | Stage 3 | Nested selector expansion behavior coverage |
| `dom.md` | Defer | Stage 3 | Query traversal and mutation behavior coverage |
| `borders.md` | Defer | Stage 3 | Border rendering and border title behavior coverage |
| `widget.md` | Defer | Stage 4 | Widget base contract behavior coverage |
| `screens.md` | Defer | Stage 4 | Screen stack, modal, mode, and dismiss behavior coverage |
| `bindings_and_actions.md` | Defer | Stage 4 | Binding resolution and action dispatch behavior coverage |
| `app.md` interaction subset | Defer | Stage 4 | Screen stack, focus/blur, hover/pointer, and click-chain behavior coverage |
| `input.md` key-routing subset | Defer | Stage 4 | Key action dispatch pipeline behavior coverage |
| `scrolling.md` infrastructure subset | Defer | Stage 4 | Scroll geometry, scrollbar parsing, gutter, and animation-level behavior coverage |
| `workers.md` | Defer | Stage 5 | Worker lifecycle and cancellation behavior coverage |
| `concurrency.md` | Defer | Stage 5 | Concurrent worker and exclusive-group behavior coverage |
| `notifications.md` | Defer | Stage 5 | Notification model and rendering behavior coverage |
| `app.md` services subset | Defer | Stage 5 | Theme, suspend, command search, features, and environment behavior coverage |
| `command_palette.md` | Defer | Stage 6 | Command palette provider/search/discovery behavior coverage |
| `input_validation.md` | Defer | Stage 6 | Validation framework behavior coverage |
| `suggester.md` | Defer | Stage 6 | Suggester and suggestion-ready behavior coverage |
| `content_and_strip.md` | Defer | Stage 7 | Rich content and strip primitive behavior coverage |
| `markup.md` | Defer | Stage 7 | Markup parsing behavior coverage |
| `renderables.md` | Defer | Stage 7 | Renderable helper behavior coverage |
| `static.md` | Defer | Stage 7 | Static/Label behavior coverage |
| `rule.md` | Defer | Stage 7 | Rule widget behavior coverage |
| `button.md` | Defer | Stage 7 | Button widget and pressed-message behavior coverage |
| `switch.md` | Defer | Stage 7 | Switch widget behavior coverage |
| `toggles.md` | Defer | Stage 7 | Checkbox, RadioButton, and RadioSet behavior coverage |
| `progress_bar.md` | Defer | Stage 7 | ProgressBar behavior coverage |
| `input.md` widget subset | Defer | Stage 7 | Input widget value, cursor, selection, clipboard, restriction, validation, and terminal-cursor behavior coverage |
| `header_and_footer.md` | Defer | Stage 7 | Header and Footer behavior coverage |
| `links.md` | Defer | Stage 7 | Link widget and open-link action behavior coverage |
| `selection.md` | Defer | Stage 7 | Text selection behavior coverage |
| `containers.md` | Defer | Stage 8 | Container widget behavior coverage |
| `collapsible.md` | Defer | Stage 8 | Collapsible widget behavior coverage |
| `tabs_and_tabbed_content.md` | Defer | Stage 8 | Tabs and TabbedContent behavior coverage |
| `list_view.md` | Defer | Stage 8 | ListView and ListItem behavior coverage |
| `option_list.md` | Defer | Stage 8 | OptionList behavior coverage |
| `select.md` | Defer | Stage 8 | Select widget behavior coverage |
| `selection_list.md` | Defer | Stage 8 | SelectionList behavior coverage |
| `scrolling.md` container/rendering subset | Defer | Stage 8 | Overflow, scrollbar rendering, scroll navigation, auto-scroll, virtual-size, and compositor scroll placement behavior coverage |
| `document.md` | Defer | Stage 9 | Document model behavior coverage |
| `text_area.md` | Defer | Stage 9 | TextArea behavior coverage |
| `masked_input.md` | Defer | Stage 9 | MaskedInput behavior coverage |
| `data_table.md` | Defer | Stage 9 | DataTable behavior coverage |
| `tree.md` | Defer | Stage 9 | Tree behavior coverage |
| `directory_tree.md` | Defer | Stage 9 | DirectoryTree behavior coverage |
| `rich_log.md` | Defer | Stage 9 | RichLog behavior coverage |
| `sparkline.md` | Defer | Stage 9 | Sparkline behavior coverage |
| `markdown.md` | Defer | Stage 10 | Markdown and MarkdownViewer behavior coverage |
| `animations.md` | Defer | Stage 11 | Animator and CSS transition behavior coverage |

## Source-Coverage-Matrix Entries Without Standalone Stage Ownership

These entries are retained from `99-source-coverage-matrix.md`, but the current
implementation order assigns them through other stage-owned surfaces rather than
as standalone spec-test ownership rows.

| Source backlog item | Stage 0 decision | Owning surface | Acceptance artifact |
| --- | --- | --- | --- |
| `auto_refresh.md` | Defer as subsumed | Stage 1 `reactivity.md` | Reactive observer behavior coverage |
| `compositor.md` | Defer as Ink-delegated behavior | Stage 3 styling and Stage 8 scroll/container rendering | Paint order, visibility, clipping, and scroll-placement behavior coverage through owning surfaces |
| `driver.md` | Split as Ink-delegated behavior | Stage 0 terminal seam and Stage 5 suspend/resume | Explicit terminal I/O seam coverage plus suspend/resume behavior coverage |
| `xterm_parser.md` | Defer as Ink-delegated behavior | Stage 4 input/binding routing | Key and mouse event routing behavior coverage |
| `file_monitor.md` | Defer as worker pattern | Stage 5 `workers.md` | File-watching behavior covered through worker lifecycle/cancellation surfaces if implemented |
| `filters.md` | Defer as query behavior | Stage 3 `dom.md` | `DOMQuery.filter()` and `DOMQuery.exclude()` behavior coverage |
| `lazy.md` | Defer as worker/tree behavior | Stage 5 workers and Stage 9 tree | Lazy-loading behavior coverage at the consuming surface |
| `layouts.md` | Defer as Ink/Yoga-delegated behavior | Stage 3 styling and Stage 8 containers | Layout translation and container behavior coverage |
| `utilities.md` | Defer as internal helper behavior | Owning consumer stages | Utility behavior covered through the public surfaces that consume it |
