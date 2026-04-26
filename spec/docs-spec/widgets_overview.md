# Docs Spec: Widgets Overview

## Purpose
Describes the overview doc for widgets in textual-js — the conceptual and API introduction to building and using widgets: how they are composed, mounted, rendered, focused, styled, and refreshed. This is the entry point every widget author reads before visiting specific widget pages.

## Audience
New widget authors; application developers building compound widgets out of the catalog; framework extenders implementing custom rendering.

## Required sections
1. What a widget is — a UI component owning a rectangular region of the screen, responding to events, managing reactive state, and rendering content. In textual-js, widgets are React function components wrapped in `observer()` and hosted by Ink.
2. Widget props and static configuration — `id`, `classes` (defaults to `DEFAULT_CLASSES`), `disabled`, `markup` flag, children, and the "widget cannot be its own parent" invariant.
3. Static configuration catalog — `DEFAULT_CSS`, `DEFAULT_CLASSES`, `SCOPED_CSS`, `COMPONENT_CLASSES`, `BORDER_TITLE`, `BORDER_SUBTITLE`, `BINDINGS`, `ALLOW_MAXIMIZE`, `ALLOW_SELECT`, `FOCUS_ON_CLICK`, `BLANK`. Presented as TypeScript static members / component metadata.
4. Reactive attributes — `disabled`, `loading`, `hasFocus` (read-only), `mouseHover` (read-only), `virtualSize`, `scrollX`/`scrollY`, `showVerticalScrollbar`/`showHorizontalScrollbar`.
5. Instance attributes — `borderTitle`/`borderSubtitle`, `absoluteOffset`, and the highlight-style seam. Emphasize that titles are single-line and require a border style to show.
6. Widget lifecycle — composition (children declared via JSX, not a generator), mounting, the Mount event, dynamic `mount`/`mountAll` with `before`/`after` insertion, unmount and removal, and recompose.
7. Rendering — the default render path through Ink flexbox; the `render` seam for widgets that produce their own content (string, content-markup, or a structured content object); the pre-render hook for cached visual state reset.
8. Static widget — the caching text/content widget, its `update()` method, and when to use it instead of a full React component.
9. Line API — the lower-level rendering contract for widgets that need efficient per-line control; `renderLine(y) -> Strip`; component classes surface styling of sub-parts; `ScrollView` extension for scrollable content with `virtualSize` and `scrollOffset`; Strip/Segment data shape.
10. Content size — auto-sizing hooks `getContentWidth` and `getContentHeight`.
11. Widget CSS — `DEFAULT_CSS` semantics, lower specificity than app/external CSS, scoping by default; reservation of the `CSS` variable for App and Screen (widgets using `CSS` trigger a warning and are ignored).
12. Pseudo-classes supported on widgets — full list including `:hover`, `:focus`, `:blur`, `:can-focus`, `:disabled`, `:enabled`, `:dark`, `:light`, `:focus-within`, `:inline`, `:ansi`, `:nocolor`, `:first-of-type`, `:last-of-type`, `:first-child`, `:last-child`, `:odd`, `:even`, `:empty`.
13. Focus — `canFocus` / `canFocusChildren` class-level flags, the `allowFocus()` / `allowFocusChildren()` override hooks, focus via click (`FOCUS_ON_CLICK`) and Tab/Shift+Tab, and the `:focus` / `:focus-within` pseudo-classes.
14. Tooltips — setting the `tooltip` property, the `withTooltip(tooltip)` chainable helper for JSX use, clearing via `null`, and styling via the `Tooltip` widget type. Accessibility caveat: keyboard-only users may never see tooltips.
15. Loading state — the `loading` reactive attribute, `setLoading(bool)`, the `getLoadingWidget()` override chain (widget -> screen -> app -> default `LoadingIndicator`), and the cover/uncover mechanism.
16. Refresh — `refresh(...)` options: specific regions, `repaint`, `layout`, `recompose`, with the coalescing guarantee on the next idle.
17. Border titles — `borderTitle` and `borderSubtitle`, defaults from the static config, single-line cropping rule, styling via CSS.
18. Text links — content-markup click actions (`@click=...`) and the `autoLinks` reactive attribute that governs auto-highlighting.
19. Compound widgets — building by composing children (JSX) instead of custom rendering; the "attributes down, messages up" pattern and the sibling-isolation rule.
20. Disabled state — interaction suppression (scroll still allowed), dimmer rendering, and the `:disabled` / `:enabled` pseudo-classes.

## Key concepts
- Widgets are React function components; reactive state is MobX-backed and consumed via `observer()`.
- Composition in textual-js is JSX, not a compose generator; children are declared in the component's return.
- The widget base contract covers lifecycle, styling, focus, rendering, and refresh; specific widget pages layer messages and bindings on top.
- Default CSS and component-class naming (`widgetname--part-name`) let widgets ship styling with the framework while remaining overridable.
- The Line API is for advanced widgets that need per-line control and is layered on top of standard rendering; most widgets never need it.
- Loading and tooltips are widget-level affordances that delegate to app-level defaults, overridable at any level.

## Behaviors and contracts
- A widget cannot be its own parent; framing this as an invariant the component must enforce.
- `DEFAULT_CSS` has lower specificity than app-level or external CSS; a widget using the reserved `CSS` variable triggers a warning and is ignored.
- `SCOPED_CSS = true` (default) scopes default CSS to the widget subtree; setting it false makes default CSS global.
- `borderTitle` / `borderSubtitle` are only visible when a border style is set; content exceeding the width is ellipsis-cropped.
- `mount` / `mountAll` return a Promise-like handle; the `before` / `after` parameter accepts a child index, a selector string, or a widget instance.
- `recompose()` removes non-system children and re-runs composition; `-textual-system` children are preserved.
- `refresh()` is idle-coalesced: multiple calls in a tick result in a single refresh pass.
- The loading-indicator override chain is strictly widget → screen → app; subclassing any level wins for that subtree.
- The "attributes down, messages up" pattern forbids sibling-to-sibling mutation; changes route through the parent.
- Disabled widgets receive scroll events but not other mouse events.

## Example requirements
All examples JSX/TypeScript, using Ink primitives and textual-js APIs. Describe (do not inline) examples for:
- A minimal custom widget: React function component wrapped in `observer()` with static configuration (bindings, default classes, default CSS) attached.
- Overriding `render` for a single-string widget vs. composing children via JSX for a compound widget.
- Mounting a widget dynamically into a container with `before` / `after` insertion.
- Using `refresh({ layout: true })` after a state change that changes dimensions.
- Implementing a Line-API widget that extends the scrollable-view primitive, with `virtualSize` and per-line rendering.
- Setting a tooltip on a widget both imperatively and via the chainable `withTooltip` helper in JSX.
- Setting `loading` around an async fetch and customizing the loading indicator at the widget level.
- Using content-markup `@click` for action links inside a widget's text.

## Cross-references
- `spec/docs-spec/api_app.md` — app-level loading widget, notifications, and binding precedence.
- `spec/docs-spec/actions_and_bindings.md` — widget BINDINGS format and scope.
- `spec/docs-spec/events_reference.md` — message dispatch patterns for widgets.
- `spec/docs-spec/api_style.md` — styles applied to widgets.
- `spec/docs-spec/api_content.md` — the content/markup model for render output.
- `spec/spec-src/09-widget-base-contract.md` — the authoritative contract for widgets.
- `spec/spec-src/02-dom-reactivity-and-query.md` — reactive attributes and queries.
- `spec/spec-src/04-styling-and-css-engine.md` — CSS precedence and pseudo-classes.
- `spec/spec-src/05-layout-render-and-compositor.md` — how render output is composited by Ink.

## Notes for writers
- Do not describe widgets as asyncio tasks. In textual-js, each widget is a React component; there is no per-widget task. Reactive updates flow through MobX.
- Drop Python base-class talk (`Widget` derives from `DOMNode`): describe the widget base as a conceptual contract, not an inheritance chain.
- Python `compose()` generator does not exist. Composition is JSX. Explicitly steer readers away from looking for a `compose` method.
- `RLock` has no JavaScript equivalent and is not part of the textual-js widget surface; omit.
- `Rich` types (`Style`, `Renderable`, `Segment`, `Strip`) are conceptual in textual-js; describe them via textual-js types without naming Rich.
- `AwaitMount`/`AwaitRemove` from the Python surface translate to Promises; describe the return values as Promise-like.
- The Python snake_case method-name handler convention (`on_mount`, `_on_unmount`) translates to textual-js's message/event subscription model — describe in neutral terms and link to the events/messages spec.
- Scrollbar attributes carry over as reactive bits. Underlying rendering is Ink + a scroll primitive; do not describe custom compositor internals as if they lived in the widget.
- Keep the pseudo-class list, the component-class convention, and the default-CSS specificity rule — these are framework-level contracts.
- Do not mention `WidgetError` / `TypeError` as Python exceptions; describe the invariant ("passing self as child is a framework error") without naming specific exception classes.
