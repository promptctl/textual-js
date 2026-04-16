# Docs Spec: Header and Footer Widgets

## Purpose
Document the two standard app-chrome widgets — `Header` (docked top, shows app title, optional icon that opens the command palette, optional live clock) and `Footer` (docked bottom, automatically lists key bindings available for the focused widget) — so readers can add consistent chrome to any textual-js app.

## Audience
App authors adding top/bottom chrome to a textual-js app; theme authors styling the header/footer; binding authors controlling what appears in the footer.

## Required sections

### Header
1. Overview — what the Header provides (title, icon, optional clock) and how it docks.
2. Importing and mounting — how to include `<Header />` in an app shell.
3. Props / options — `showClock`, `icon`, `timeFormat`, plus standard widget props.
4. Reactive attributes — `tall`, `icon`, `timeFormat` and their effects.
5. Title sources — how the displayed title and subtitle are derived from app-level and screen-level title values, with screen values taking precedence.
6. Icon behavior — clicking the icon opens the command palette when the palette is enabled at the app level.
7. Clock behavior — when `showClock` is true, a live clock is displayed and refreshed every second using the format string.
8. Internal composition — the header is composed of an icon, a title, and either a clock or a reserved placeholder on the right.
9. Tall vs. compact — clicking the header toggles between 1-row and 3-row modes (and the `-tall` TCSS class).
10. Styling — default TCSS rules and how to customize.
11. Examples — basic header, header with clock, custom icon, custom time format.

### Footer
1. Overview — what the Footer provides (automatic key-binding display for the focused widget) and how it docks.
2. Importing and mounting.
3. Props / options — `showCommandPalette`, `compact`, plus standard widget props.
4. Reactive attributes — `compact`, `showCommandPalette`, `combineGroups`.
5. Binding discovery — the footer subscribes to the screen's binding-updated signal and recomposes when bindings change.
6. What appears in the footer — only bindings marked for display (`show = true`); hidden bindings are omitted.
7. Key display customization — the `keyDisplay` field on a binding controls the text shown for the key.
8. Binding groups — bindings sharing a group are rendered together under a shared label; individual descriptions are suppressed in favor of the group description.
9. Clicking keys — clicking a footer key simulates the keypress; clicking a disabled key rings the bell.
10. Styling and component classes — `footer-key--key`, `footer-key--description`, `-compact`, `-disabled`, `-grouped`, `-command-palette`.
11. Horizontal overflow — bindings overflow into a horizontally scrollable area; scrollbars are hidden but mouse wheel still scrolls.
12. Examples — footer in a simple app, compact footer, hiding a binding from the footer, customizing the displayed key text, grouping bindings.

## Key concepts
- Header is purely chrome — not focusable, not a container for app content.
- Footer reflects focused-widget bindings automatically; no manual registration.
- Header and Footer both use TCSS `dock` to pin to top/bottom.
- Title/subtitle form a single-source-of-truth pattern: screen values override app values.
- Footer hides scrollbars but remains horizontally scrollable.
- The command palette key appears in the footer when enabled and is visually separated with a docked-right `-command-palette` class.

## Behaviors and contracts
- Header title updates automatically when `App.title`, `App.subTitle`, `Screen.title`, or `Screen.subTitle` change.
- Clicking the header toggles the `tall` state (adds/removes the `-tall` class).
- Clicking the header icon opens the command palette if the palette is enabled at the app level.
- `timeFormat` accepts a format string (textual-js uses the standard locale date/time formatting; writers should clearly document the format used).
- Footer only renders bindings with `show: true`.
- Footer recomposes in response to the screen's bindings-updated signal.
- Grouped bindings display the group description once; individual descriptions within the group are suppressed.
- Clicking a footer key simulates the key press via the app's key-simulation API.
- Clicking a disabled footer key rings the terminal bell and does nothing else.
- Both Header and Footer do not participate in text selection.

## Example requirements
All examples are JSX/TypeScript using Ink primitives and textual-js components.
- Minimal app shell with `<Header />` and `<Footer />`.
- Header with `showClock` and a custom icon/time format.
- Screen-level title/subtitle overriding app-level title/subtitle.
- Footer hiding a binding by setting `show: false`.
- Footer with a grouped set of bindings sharing a group label.
- Customizing `keyDisplay` on a binding so that, e.g., `question_mark` renders as `?`.

## Cross-references
- Related docs specs: `spec/docs-spec/actions_and_bindings.md`, `spec/docs-spec/widget_label.md`.
- Related behavioral specs: `spec/spec-src/01-runtime-app-and-lifecycle.md` (app title/subtitle, command palette enable flag), `spec/spec-src/06-input-bindings-actions-and-commands.md` (binding discovery, groups, show flag, keyDisplay), `spec/spec-src/03-message-event-and-dispatch.md` (signals like `bindings_updated_signal`).

## Notes for writers
- Do not describe `strftime`. Document the time format using whatever textual-js actually uses (e.g., `Intl.DateTimeFormat` options or a token-based formatter). Verify before writing.
- Do not describe Python `reactive`. Describe reactive attributes as MobX-backed observable fields on the widget instance or equivalent props on the React component.
- Do not describe `app.simulate_key` as a Python method; describe it as the app-level key simulation API documented in the app services section.
- Avoid `&:ansi` TCSS example unless textual-js confirms parity; reference the styling spec if in doubt.
- The Python spec notes a possible inconsistency in `tall`'s default (spec says `False` in source but docs say `True`). Writers should verify against the textual-js implementation and document whichever is true there; do not carry over the uncertainty.
