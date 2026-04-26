# Docs Spec: LoadingIndicator Widget

## Purpose
Document the `LoadingIndicator` widget — a non-focusable widget showing five pulsating dots to signal a loading or in-progress state, and its dual role as an overlay automatically managed by any widget's `loading` reactive attribute — so readers can display loading UI both standalone and as an overlay over arbitrary content.

## Audience
App authors indicating in-progress work; widget authors overriding the default loading overlay.

## Required sections
1. Overview — the loading indicator's visual behavior and its two usage modes (standalone and overlay).
2. Importing and mounting.
3. Props / options — standard widget props only (no special parameters).
4. Reactive attributes, messages, bindings, component classes — all empty; document that it is purely presentational.
5. Input handling — the widget stops all input events from propagating to widgets beneath it; this blocks interaction while the indicator is visible.
6. Rendering behavior — on mount the widget begins auto-refreshing (~60fps), computes a gradient each frame from background to the widget's `color` style, and displays five pulsing dots. When the app's `animationLevel` is `"none"`, the widget shows the static text `Loading...` instead.
7. Default TCSS — full width/height, centered content, primary color, `not reverse` style.
8. Overlay mode — when used as the loading overlay attached by a widget's `loading` reactive, the `-textual-loading-indicator` class is applied, placing the indicator on the `_loading` layer, docked top, with a boosted background.
9. Integration with `Widget.loading` — setting `widget.loading = true` overlays a `LoadingIndicator` on the widget; setting `false` removes it. The overlay can be customized by overriding `getLoadingWidget` on the host widget.
10. Changing the indicator color — set `color` in TCSS (the gradient is derived from this).
11. Examples — standalone loading indicator; using the `loading` reactive on another widget to overlay a loading state; customizing the overlay via a `getLoadingWidget` override.

## Key concepts
- Purely presentational — no user state, no messages, no bindings.
- Blocks all input from passing through to underlying widgets.
- Animation-rate auto-refresh produces the pulsing effect.
- Respects `animationLevel: "none"` by falling back to static text.
- Gradient is derived from the widget's `background` blended toward its `color`.
- Two roles: standalone visual element or automatic overlay placed on the `_loading` TCSS layer.

## Behaviors and contracts
- `auto_refresh` is set to `1/16` seconds on mount, giving roughly 60fps.
- Every `InputEvent` hitting the indicator is stopped and not bubbled to parents — this is intentional and makes the indicator act as an input shield.
- When `app.animationLevel` is `"none"`, the indicator renders the literal text `Loading...`.
- As an overlay, the `-textual-loading-indicator` class applies the `_loading` layer, a boosted background, and docks to the top.
- Setting any widget's `loading` to true attaches a loading indicator via `getLoadingWidget()`; setting it false removes the overlay.
- Overriding `getLoadingWidget()` on a widget changes the overlay used, enabling custom loading visuals per widget.

## Example requirements
All examples are JSX/TypeScript using Ink primitives.
- Standalone indicator inside a simple app shell.
- Triggering a widget-level overlay via `widget.loading = true` around an async fetch (use MobX observable state to drive loading, and show how the overlay disappears on completion).
- Changing the indicator color via TCSS.
- Overriding `getLoadingWidget` to provide a custom loading visual on a specific widget.
- Noting the behavior difference when `animationLevel` is `"none"` (useful for low-motion preferences).

## Cross-references
- Related docs specs: `spec/docs-spec/widget_progress_bar.md`, `spec/docs-spec/animation.md`.
- Related behavioral specs: `spec/spec-src/10-widget-catalog.md`, `spec/spec-src/09-widget-base-contract.md` (`loading` reactive, `getLoadingWidget`), `spec/spec-src/04-styling-and-css-engine.md` (layers, gradients), `spec/spec-src/05-layout-render-and-compositor.md` (auto-refresh, animation).

## Notes for writers
- Do not describe `auto_refresh` as a Python attribute. Describe the refresh cadence in user-visible terms ("approximately 60fps") and tie to the animation/rendering spec.
- Do not describe `Gradient` as a Python class; describe it as a color blend between the widget's background and its `color` style.
- `animationLevel` is the app-wide animation preference; link to where it is defined (app services / animation spec).
- Emphasize that the indicator intentionally blocks input events — framing this as a feature, not a bug. Developers relying on passthrough input must not mount this widget on top of their interactive content without understanding the shield behavior.
- Document `getLoadingWidget` as a component override / method on the host widget class; if textual-js uses a different extension seam (e.g., a prop on the host), document that instead — do not invent API.
- Do not mention `Widget.loading` in Python terms. In textual-js, this is a MobX-observable property on the widget (or a controlled prop on a React component, depending on the implementation) — verify and document accordingly.
