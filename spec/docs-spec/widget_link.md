# Docs Spec: Link Widget

## Purpose
Document the `Link` widget — a focusable, clickable text widget that opens a URL in the user's default web browser when activated via click or Enter — so readers can present hyperlinks and "external link" affordances in a textual-js app.

## Audience
App authors embedding external links (help, documentation, pricing, etc.); theme authors styling focus and hover states.

## Required sections
1. Overview — what `Link` is, its click/keyboard activation, and when to use it.
2. Importing and mounting.
3. Props / options — `text` (required), `url` (optional — defaults to using `text` as the URL), `tooltip`, plus standard widget props.
4. Reactive attributes — `text` and `url`.
5. Messages / events — the widget posts none.
6. Bindings — `Enter` triggers the `open_link` action.
7. Actions — `open_link` opens the URL through the app's `openUrl` API; does nothing if `url` is empty.
8. Markup handling — the `text` is rendered with markup disabled, so markup characters appear literally.
9. Styling — default TCSS: auto width/height, accent color, underline style, pointer cursor; hover changes color; focus applies bold + reverse.
10. Examples — link with explicit URL and tooltip; link where text is used as the URL; updating `text` and `url` via observable state.

## Key concepts
- Link is a focusable widget that is semantically "open this URL".
- URL defaults to `text` when not provided, matching the "URL is the label" pattern.
- Activation paths are mouse click and Enter key.
- Open behavior is delegated to the app's URL-opening service (platform-dependent via the driver).
- No messages — consumers do not observe activation; the URL opens as a side effect.

## Behaviors and contracts
- Pressing Enter while focused invokes the `open_link` action.
- The `open_link` action calls the app-level `openUrl(url)` and does nothing if `url` is empty.
- Mouse click produces the same effect as Enter.
- Updating `text` triggers a layout refresh.
- Markup in `text` is rendered literally.
- The widget is focusable by default.

## Example requirements
All examples are JSX/TypeScript using Ink primitives.
- Link with explicit `url` and `tooltip`.
- Link where text is the URL.
- A link whose `text` and `url` are bound to observable state and changed at runtime.
- (Optional) Using an `on` handler to observe focus changes if relevant.

## Cross-references
- Related docs specs: `spec/docs-spec/widget_label.md`, `spec/docs-spec/actions_and_bindings.md`.
- Related behavioral specs: `spec/spec-src/10-widget-catalog.md`, `spec/spec-src/06-input-bindings-actions-and-commands.md`, `spec/spec-src/08-drivers-io-and-platform-behavior.md` (URL opening is a driver capability), `spec/spec-src/04-styling-and-css-engine.md`.

## Notes for writers
- Do not describe `self.app.open_url()` as a Python method. Document it as `app.openUrl(url)` or the textual-js app service equivalent.
- URL opening depends on the driver/environment (terminal emulator, OS). Reference the drivers spec for platform behavior and note that headless/test environments may intercept the call.
- Markup-disabled rendering should be described without invoking Rich or Textual's markup parser by name — say "markup is not interpreted; the text appears literally".
- If textual-js does not expose tooltips, note the gap and remove the tooltip prop; do not fabricate behavior.
