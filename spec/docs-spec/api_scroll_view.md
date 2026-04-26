# Docs Spec: ScrollView (Line API Base)

## Purpose
Document the base class for "Line API" widgets — widgets that implement their own scrolling and produce line-by-line rendered output rather than laying out child widgets. Explain when to use it vs. a standard scrolling container.

## Audience
Widget authors building custom data-heavy widgets (log views, large tables, text areas) that need fine-grained control over what is rendered per visible line.

## Required sections
1. Overview — what a Line API widget is, how it differs from a container with `overflow: auto`, when to choose each.
2. Not-the-common-case warning — most scrolling needs are met by setting `overflow` or using a pre-built container such as `VerticalScroll`.
3. Class-level configuration — default CSS (both axes auto), `ALLOW_MAXIMIZE` default true.
4. Properties — `isScrollable` (always true), `isContainer` (always false).
5. Content-size hooks — `getContentWidth(container, viewport)`, `getContentHeight(container, viewport, width)`.
6. Scrolling API — `scrollTo(x, y, { animate, speed, duration, easing, force, onComplete, level, immediate })`.
7. Line-invalidation API — `refreshLine(y)`, `refreshLines(yStart, count)`.
8. Render fallback — `render()` default (debugging panel) vs. the real entry point for Line API widgets (implementing the framework's `renderLines(...)` hook).
9. Scroll watchers — automatic scrollbar position updates and refresh when scroll-x/scroll-y change by a whole cell.
10. Mount behavior — initial scrollbar refresh.
11. Internal size-updated behavior — how virtual size and container size interact.

## Key concepts
- A Line API widget has no children and is not a container; the compositor asks it for per-line output based on scroll offset.
- `virtualSize` represents the full scrollable area; `size` is the visible viewport.
- `scrollTo` is a custom implementation that avoids deferring to an after-refresh hook; it can scroll immediately or after the next refresh.
- `refreshLine`/`refreshLines` address lines in virtual space; the framework translates to viewport coordinates using the current scroll offset.
- The default `render()` is only a fallback for debugging; Line API widgets are expected to implement the per-line render hook documented in the widget base contract.
- Scroll watchers update scrollbar thumb positions and trigger a repaint when the rounded integer scroll position changes.

## Behaviors and contracts
- `isScrollable` is always true for ScrollView.
- `isContainer` is always false for ScrollView.
- `getContentWidth` returns the widget's current `virtualSize.width`.
- `getContentHeight` returns the widget's current `virtualSize.height`.
- `scrollTo` supports animation with configurable speed/duration/easing and respects `force` to override overflow styling. `immediate: true` applies the scroll synchronously; `immediate: false` defers until after a screen refresh. An `onComplete` callback fires when the animation finishes.
- `refreshLine(y)` and `refreshLines(yStart, count)` mark lines dirty so they are re-queried on the next paint.
- `watchScrollX` / `watchScrollY` fire on every reactive change but only update the scrollbar and request a refresh when the rounded integer cell changes (avoiding sub-cell redraw storms).
- On mount, the widget calls the internal scrollbar-refresh helper so initial scrollbar state matches the current content size.
- `_sizeUpdated` subtracts the gutter to compute container size, triggers scroll recalculation, and indicates whether a resize event should be dispatched. It does not overwrite `virtualSize` from its argument; the widget owns the virtual size via its own reactives.

## Example requirements
JSX/TypeScript examples using Ink primitives. Include at minimum:
- A minimal Line API widget that extends ScrollView, sets `virtualSize`, and implements the per-line render hook.
- A Line API widget that calls `refreshLines` in response to data changes.
- A Line API widget that scrolls to a specific row with animation, and another that scrolls immediately.
- Comparison: the same feature built with a regular scrolling container using `overflow: auto` instead.

## Cross-references
- `api_widget.md` in `spec/docs-spec/` — widget base contract including the per-line render hook.
- `api_containers.md` in `spec/docs-spec/` — standard scrolling containers (VerticalScroll, HorizontalScroll).
- `api_scrollbar.md` in `spec/docs-spec/` — the scrollbar widget used by ScrollView.
- `api_strip.md` in `spec/docs-spec/` — the line data returned from per-line render.
- `animation.md` in `spec/docs-spec/` — animation/easing used by scrollTo.
- `spec/spec-src/05-layout-render-and-compositor.md` — line rendering and scroll-offset composition.
- `spec/spec-src/09-widget-base-contract.md` — widget hooks.

## Notes for writers
- Do not describe ScrollView's parent class `ScrollableContainer` in Python inheritance terms; just say ScrollView "is a scrollable widget with no children" and note it builds on the framework's scrolling/scrollbar infrastructure.
- Do not mention Rich `Panel`; the default `render()` fallback in the JS port should produce a simple debug message (layout implementers are expected to override it). The doc should emphasize "override the per-line render hook" as the primary extension point.
- Avoid prescribing the exact TS signature for the per-line render hook here; cross-reference `api_widget.md` for that.
- Be explicit that ScrollView is an advanced API; the doc should lead with the "prefer `overflow: auto` or a container" guidance.
- MobX note: `virtualSize` is a reactive; updates schedule the appropriate framework work automatically.
