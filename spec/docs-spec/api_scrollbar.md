# Docs Spec: Scrollbar

## Purpose
Document the scrollbar widget, its associated messages, and its rendering component — used internally by any scrollable container and by ScrollView. Most apps don't interact with these directly; this page is for widget authors who need to customize or subclass scrollbars.

## Audience
Advanced widget authors customizing scrollbar appearance or behavior; theme authors styling scrollbars; framework extenders.

## Required sections
1. Overview — where scrollbars come from (automatically attached to scrollable widgets) and when to customize them.
2. Scroll messages — `ScrollMessage` base, `ScrollUp`, `ScrollDown`, `ScrollLeft`, `ScrollRight`, `ScrollTo` (with `x`, `y`, `animate` fields). All non-bubbling.
3. `ScrollBarRender` renderable — sub-cell glyph arrays, thickness, vertical/horizontal, metadata on track/thumb for click handling.
4. `ScrollBar` widget — construction (vertical flag, thickness), reactive attributes (`windowVirtualSize`, `windowSize`, `position`, `mouseOver`, `grabbed`).
5. Position validator — quantization to 1/8 cell.
6. Rendering behavior — style selection based on grabbed/hover/default, alpha compositing against parent background.
7. Default CSS class (`-textual-system`) and `ALLOW_SELECT=false`.
8. Actions — `scrollUp`, `scrollDown`, `grab`.
9. Mouse event handling — down/up/move, capture, release, click propagation.
10. `ScrollBarCorner` — the small filler between horizontal and vertical scrollbars.
11. Customizing rendering — swapping the renderer class on the class or an instance.

## Key concepts
- Scrollbars are widgets; they participate in focus/select as needed but are marked `-textual-system` and do not allow text selection.
- The `ScrollBarRender` class draws a scrollbar into strips using sub-cell glyphs (`▁▂▃▄▅▆▇` for vertical ends, `▉▊▋▌▍▎▏` for horizontal ends, space for the track).
- Track-above-thumb, track-below-thumb, and thumb segments carry distinct click-down metadata so clicking routes to `scrollUp`, `scrollDown`, or `grab` actions respectively.
- Thumb size is proportional to `windowSize / virtualSize`.
- Grab-dragging computes new scroll position from mouse delta scaled by `virtualSize / windowSize`.
- Position is quantized to eighths of a cell so sub-cell rendering is consistent.
- Style selection is three-way: default, hover, grabbed — with theme-defined color tokens for each (`scrollbar_color`, `scrollbar_color_hover`, `scrollbar_color_active`, and matching background tokens).
- Translucent scrollbar colors are composited against the parent's effective background.
- The `ScrollBar.renderer` class-level reference can be replaced to swap in a custom renderable class for all or specific scrollbar instances.

## Behaviors and contracts
- All scroll messages have `bubble=false`; they do not bubble past their target.
- `ScrollTo` carries `x`, `y` (either may be null), and an `animate` flag (default true).
- `ScrollBarRender.renderBar` returns a renderable that, when drawn, produces the scrollbar strips with appropriate click metadata.
- `ScrollBarRender.renderBar` short-circuits to a thumbless track when any of: `windowSize == 0`, `size == 0`, `virtualSize == 0`, or `size == virtualSize` (content fits).
- `ScrollBar.validatePosition` quantizes the reactive position to 1/8 cell.
- `ScrollBar.render` picks colors based on state, composites alpha < 1 backgrounds against the parent's background, and delegates to the renderer.
- `actionScrollUp` / `actionScrollDown` post the appropriate message; both no-op while grabbed.
- `actionGrab` captures the mouse via the widget's `captureMouse` primitive.
- Mouse capture sets the cursor to "grabbing", starts realtime animation, and records the starting mouse position and scroll position. Release reverses these.
- Mouse move while grabbed computes `deltaPixels * virtualSize / windowSize` for the new scroll position and posts `ScrollTo`; the `animate` flag is `!app.supportsSmoothScrolling`.
- `ScrollBar` stops propagation on mouse-down/mouse-up/click so clicks on the bar don't propagate to the parent.
- Hiding a grabbed scrollbar releases the mouse and clears `grabbed`.
- Leaving/entering the scrollbar toggles `mouseOver`.
- `ScrollBarCorner` renders as a solid fill using the parent's `scrollbarCornerColor` style token.

## Example requirements
JSX/TypeScript examples. Include at minimum:
- A custom `ScrollBarRender` subclass providing an alternative glyph set and assigning it to `ScrollBar.renderer` (either globally or on an instance).
- A custom scrollable container reading theme tokens to restyle scrollbars via CSS.
- A message-handler on a custom scrollable widget that intercepts `ScrollTo` and adjusts behavior.

## Cross-references
- `api_scroll_view.md` in `spec/docs-spec/` — Line API widget that owns scrollbars.
- `api_widget.md` in `spec/docs-spec/` — `captureMouse` / mouse event lifecycle.
- `api_style.md` in `spec/docs-spec/` — theme tokens (`scrollbar_color*`, `scrollbar_background*`, `scrollbar_corner_color`).
- `api_strip.md` in `spec/docs-spec/` — output format.
- `api_message.md` in `spec/docs-spec/` — message base and non-bubbling semantics.
- `spec/spec-src/05-layout-render-and-compositor.md` — rendering and click metadata.
- `spec/spec-src/06-input-bindings-actions-and-commands.md` — action dispatch.

## Notes for writers
- The source references Rich `Segments`; in the JS port scrollbar rendering produces strips (or the framework's internal segment equivalent). Describe the output as "strips" and cross-reference `api_strip.md`; don't mention Rich.
- Do not document `@rich.repr.auto`; it has no JS equivalent and is not part of the public surface.
- The `-textual-system` class marker is a convention used for framework-managed widgets; the doc should note it exists but should not encourage user code to rely on its name.
- Describe `ClassVar`-style fields as "static class fields / class-level configuration" in JS terms.
- Smooth-scrolling behavior: the `animate` flag on `ScrollTo` is inverted from the app's smooth-scrolling capability — when the terminal supports smooth scrolling natively, the framework disables per-step animation. Document this carefully; it's a common source of confusion.
- Emphasize the audience: most app and widget authors should never subclass or touch scrollbar internals. The doc should front-load this so readers don't think they need it.
